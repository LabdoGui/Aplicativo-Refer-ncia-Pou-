#!/bin/sh
# Cria um usuário e um schema por serviço (database-per-service lógico).
# Executado pelo container oficial do PostgreSQL na criação do volume. É idempotente:
# pode ser reexecutado num volume existente para recriar o que faltar e reaplicar as
# senhas (veja "Banco de dados" no README).
# Cada serviço só enxerga o próprio schema: nenhum serviço lê tabelas de outro.
#
# Também cria o banco de sombra (shadow database) do "prisma migrate dev", com o
# mesmo layout: um schema por serviço, de propriedade do usuário do serviço. Assim
# o Prisma não precisa criar bancos temporários, e os usuários continuam sem CREATEDB.
set -eu

SHADOW_DB=pulso_shadow

run_sql() {
  database="$1"
  shift
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$database" "$@"
}

create_shadow_database() {
  echo "Criando o banco de sombra do Prisma: ${SHADOW_DB}"
  # CREATE DATABASE não roda num bloco DO: o \gexec só o executa se o banco não existir.
  # O dono é o superusuário que executa o script.
  run_sql "$POSTGRES_DB" <<SQL
SELECT format('CREATE DATABASE %I OWNER %I', '${SHADOW_DB}', current_user)
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${SHADOW_DB}')\gexec
-- Sem acesso padrão (CONNECT e TEMPORARY): cada usuário de serviço recebe o próprio GRANT.
REVOKE ALL ON DATABASE ${SHADOW_DB} FROM PUBLIC;
SQL
  # O schema public do banco de sombra não serve a ninguém.
  run_sql "$SHADOW_DB" -c "REVOKE ALL ON SCHEMA public FROM PUBLIC;"
}

create_service_schema() {
  service="$1"
  password="$2"
  role="${service}_app"
  echo "Criando schema e usuário do serviço: ${service}"
  run_sql "$POSTGRES_DB" <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${role}') THEN
    CREATE ROLE ${role} LOGIN PASSWORD '${password}';
  ELSE
    ALTER ROLE ${role} LOGIN PASSWORD '${password}';
  END IF;
END
\$\$;
CREATE SCHEMA IF NOT EXISTS ${service} AUTHORIZATION ${role};
ALTER SCHEMA ${service} OWNER TO ${role};
REVOKE ALL ON SCHEMA public FROM ${role};
ALTER ROLE ${role} SET search_path TO ${service};
-- No banco de sombra: CONNECT e CREATE (criar schemas só neste banco; não é CREATEDB).
-- O "prisma migrate dev" limpa a sombra com DROP SCHEMA + CREATE SCHEMA, e sem o
-- CREATE o schema seria apagado e não voltaria. Sem TEMPORARY.
GRANT CONNECT, CREATE ON DATABASE ${SHADOW_DB} TO ${role};
SQL
  # Mesmo schema no banco de sombra, também de propriedade do usuário do serviço.
  run_sql "$SHADOW_DB" <<SQL
CREATE SCHEMA IF NOT EXISTS ${service} AUTHORIZATION ${role};
ALTER SCHEMA ${service} OWNER TO ${role};
SQL
}

create_shadow_database

create_service_schema identity "${IDENTITY_DB_PASSWORD:-identity_dev_password}"
create_service_schema scheduling "${SCHEDULING_DB_PASSWORD:-scheduling_dev_password}"
create_service_schema clinical "${CLINICAL_DB_PASSWORD:-clinical_dev_password}"
create_service_schema inventory "${INVENTORY_DB_PASSWORD:-inventory_dev_password}"
create_service_schema engagement "${ENGAGEMENT_DB_PASSWORD:-engagement_dev_password}"
create_service_schema notification "${NOTIFICATION_DB_PASSWORD:-notification_dev_password}"

# O banco não deve aceitar objetos criados por qualquer um no schema public.
run_sql "$POSTGRES_DB" -c "REVOKE CREATE ON SCHEMA public FROM PUBLIC;"
