#!/bin/sh
# Cria um usuário e um schema por serviço (database-per-service lógico).
# Executado uma única vez pelo container oficial do PostgreSQL, na criação do volume.
# Cada serviço só enxerga o próprio schema: nenhum serviço lê tabelas de outro.
set -eu

create_service_schema() {
  service="$1"
  password="$2"
  echo "Criando schema e usuário do serviço: ${service}"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${service}_app') THEN
    CREATE ROLE ${service}_app LOGIN PASSWORD '${password}';
  ELSE
    ALTER ROLE ${service}_app LOGIN PASSWORD '${password}';
  END IF;
END
\$\$;
CREATE SCHEMA IF NOT EXISTS ${service} AUTHORIZATION ${service}_app;
REVOKE ALL ON SCHEMA public FROM ${service}_app;
ALTER ROLE ${service}_app SET search_path TO ${service};
SQL
}

create_service_schema identity "${IDENTITY_DB_PASSWORD:-identity_dev_password}"
create_service_schema scheduling "${SCHEDULING_DB_PASSWORD:-scheduling_dev_password}"
create_service_schema clinical "${CLINICAL_DB_PASSWORD:-clinical_dev_password}"
create_service_schema inventory "${INVENTORY_DB_PASSWORD:-inventory_dev_password}"
create_service_schema engagement "${ENGAGEMENT_DB_PASSWORD:-engagement_dev_password}"
create_service_schema notification "${NOTIFICATION_DB_PASSWORD:-notification_dev_password}"

# O banco não deve aceitar objetos criados por qualquer um no schema public.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -c "REVOKE CREATE ON SCHEMA public FROM PUBLIC;"
