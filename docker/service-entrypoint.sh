#!/bin/sh
# Entrypoint das imagens do back-end: todas trazem o gateway e os 6 serviços, e
# SERVICE_DIR (definido no build de cada imagem) diz qual pasta usar.
#
# RUN_MIGRATIONS=true aplica as migrações pendentes do serviço (prisma migrate
# deploy) antes de iniciar o processo. Em produção, prefira rodar as migrações
# como etapa separada do deploy.
set -eu

if [ -z "${SERVICE_DIR:-}" ] || [ ! -f "/app/${SERVICE_DIR}/dist/main.js" ]; then
  echo "SERVICE_DIR inválido: \"${SERVICE_DIR:-}\". Construa a imagem com --build-arg SERVICE_DIR (ex.: backend/services/identity)." >&2
  exit 1
fi

cd "/app/${SERVICE_DIR}"

if [ "${RUN_MIGRATIONS:-false}" = "true" ] && [ -d prisma/migrations ]; then
  echo "Aplicando migrações de ${SERVICE_DIR}..."
  node /app/node_modules/prisma/build/index.js migrate deploy
fi

exec "$@"
