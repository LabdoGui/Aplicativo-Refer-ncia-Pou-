#!/bin/sh
# Entrypoint das imagens do back-end: todas trazem o gateway e os 6 serviços, e
# SERVICE_DIR (definido no build de cada imagem) diz qual pasta usar.
set -eu

if [ -z "${SERVICE_DIR:-}" ] || [ ! -f "/app/${SERVICE_DIR}/dist/main.js" ]; then
  echo "SERVICE_DIR inválido: \"${SERVICE_DIR:-}\". Construa a imagem com --build-arg SERVICE_DIR (ex.: backend/services/identity)." >&2
  exit 1
fi

cd "/app/${SERVICE_DIR}"
exec "$@"
