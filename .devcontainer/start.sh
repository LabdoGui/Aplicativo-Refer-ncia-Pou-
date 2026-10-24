#!/usr/bin/env bash
# Sobe o SangueConecta inteiro dentro do Codespace (docker compose) e mostra o link do
# app. Roda a cada início do Codespace; da segunda vez em diante usa o cache e
# os dados já gravados nos volumes.
set -euo pipefail
cd "$(dirname "$0")/.."

# Imagens base pelo espelho do Google: o Docker Hub limita downloads anônimos
# e os IPs dos Codespaces são compartilhados. Valores já definidos prevalecem.
export NODE_IMAGE="${NODE_IMAGE:-mirror.gcr.io/library/node:22-alpine}"
export NGINX_IMAGE="${NGINX_IMAGE:-mirror.gcr.io/library/nginx:1.27-alpine}"
export POSTGRES_IMAGE="${POSTGRES_IMAGE:-mirror.gcr.io/library/postgres:16-alpine}"
export RABBITMQ_IMAGE="${RABBITMQ_IMAGE:-mirror.gcr.io/library/rabbitmq:3.13-management-alpine}"

url="http://localhost:8080"
if [ -n "${CODESPACE_NAME:-}" ]; then
  url="https://${CODESPACE_NAME}-8080.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
fi
# Link e QR code de verificação das declarações em PDF apontam para o Codespace.
export PUBLIC_APP_URL="${PUBLIC_APP_URL:-$url}"

echo "▶ SangueConecta: aguardando o Docker do Codespace..."
for _ in $(seq 1 60); do
  docker info >/dev/null 2>&1 && break
  sleep 2
done

echo "▶ SangueConecta: subindo o app (a primeira vez leva alguns minutos)..."
if ! docker compose up -d --build --wait; then
  echo
  echo "✘ O SangueConecta não subiu. Veja os logs com: docker compose logs --tail=50"
  echo "  e tente de novo com: bash .devcontainer/start.sh"
  exit 1
fi

visibility=""
if [ -n "${CODESPACE_NAME:-}" ]; then
  # Link público para abrir também no celular (dados fictícios). Se a conta ou
  # a organização não permitir, o link continua valendo para quem estiver
  # logado no GitHub com a conta dona do Codespace.
  visibility="privado: abre só com a sua conta do GitHub. Para abrir em qualquer aparelho: aba PORTAS → botão direito na porta 8080 → Visibilidade da porta → Pública"
  for _ in 1 2 3 4 5; do
    if gh codespace ports visibility 8080:public -c "$CODESPACE_NAME" >/dev/null 2>&1; then
      visibility="público: abre em qualquer celular ou computador enquanto o Codespace estiver ligado"
      break
    fi
    sleep 3
  done
fi

cat <<EOF

✔ SangueConecta no ar: ${url}
${visibility:+  Link ${visibility}.
}
  Contas de demonstração (senha Pulso@2026):
    doador@demo.com · enfermeiro@demo.com · colaborador@demo.com · admin@demo.com

  O Codespace desliga sozinho depois de 30 minutos sem uso (e o link para de
  abrir). Para religar, abra o Codespace de novo pelo GitHub: o app volta em
  menos de um minuto, com os mesmos dados.
EOF
