# Imagem única para todos os processos NestJS do SangueConecta (gateway e os 6 serviços).
#
#   docker build -f docker/service.Dockerfile \
#     --build-arg SERVICE_DIR=backend/services/identity --build-arg SERVICE_PORT=3001 \
#     -t pulso/identity:dev .
#
# Estágios: base → manifests → deps (npm ci completo) → build (bibliotecas, gateway
# e todos os serviços) → prod-deps (dependências de produção do back-end) →
# runtime-base (usuário sem privilégios) → runtime (só metadados).
#
# Nenhum estágio de arquivos depende de SERVICE_DIR: as 7 imagens compartilham
# todas as camadas (build feito uma vez, disco ocupado uma vez) e diferem apenas
# em SERVICE_DIR, PORT e no health check. O custo é cada imagem levar o código
# compilado de todos os serviços (alguns MB) e a união das dependências de produção.
#
# NODE_IMAGE pode ser trocada por quem sofre com o limite do Docker Hub, por exemplo:
#   --build-arg NODE_IMAGE=mirror.gcr.io/library/node:22-alpine
ARG NODE_IMAGE=node:22-alpine

FROM ${NODE_IMAGE} AS base
# O Prisma no Alpine precisa das bibliotecas do OpenSSL 3. A imagem oficial do
# Node já traz libssl3/libcrypto3; o pacote só é instalado se faltar.
RUN { apk info -e libssl3 && apk info -e libcrypto3; } >/dev/null 2>&1 \
  || apk add --no-cache openssl
ENV CHECKPOINT_DISABLE=1 \
  NPM_CONFIG_UPDATE_NOTIFIER=false
WORKDIR /app

# Extrai do contexto só o package-lock.json e os package.json dos workspaces.
# Este estágio roda a cada build, mas o resultado só muda quando um manifesto
# muda, e é isso que decide o cache do npm ci (novos workspaces entram sozinhos).
FROM base AS manifests-src
COPY . /src
RUN cd /src \
  && mkdir -p /manifests \
  && find . -name package.json ! -path '*/node_modules/*' > /tmp/manifests.txt \
  && tar -cf - package-lock.json -T /tmp/manifests.txt | tar -xf - -C /manifests

FROM base AS manifests
COPY --from=manifests-src /manifests ./

# Instalação completa (CLIs de build e engines do Prisma para musl).
# É reaproveitada pelas 7 imagens do back-end e pelo frontend.
FROM manifests AS deps
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

# Código-fonte do back-end num estágio vazio: copiar aqui não duplica o
# node_modules, e o estágio build usa tudo numa única camada.
FROM scratch AS backend-src
COPY tsconfig.base.json /tsconfig.base.json
COPY backend /backend

# Compila as bibliotecas, o gateway e todos os serviços (os serviços rodam
# "prisma generate" antes do "nest build"). /out reúne, no mesmo layout de /app,
# só o que vai para a imagem final: dist/, prisma/ e generated/ de cada pacote.
FROM deps AS build
RUN --mount=type=bind,from=backend-src,target=/src \
  cp -R /src/. ./ \
  && npm run build:libs \
  && set -- \
  && for dir in backend/gateway backend/services/*; do set -- "$@" --workspace "$dir"; done \
  && npm run build "$@" \
  && for dir in backend/libs/* backend/gateway backend/services/*; do \
       mkdir -p "/out/${dir}" && cp -R "${dir}/dist" "/out/${dir}/" || exit 1; \
       for extra in prisma generated; do \
         if [ -d "${dir}/${extra}" ]; then cp -R "${dir}/${extra}" "/out/${dir}/"; fi; \
       done; \
     done

# Dependências de produção do gateway e dos serviços (as bibliotecas @pulso entram
# como links do workspace). A CLI do Prisma é dependência de produção dos serviços
# (migrações no boot); os engines já baixados no estágio deps permitem rodar
# "prisma migrate deploy" sem rede.
FROM manifests AS prod-deps
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=bind,from=deps,source=/app/node_modules/@prisma/engines,target=/tmp/prisma-engines \
  set -- \
  && for dir in backend/gateway backend/services/*; do set -- "$@" --workspace "$dir"; done \
  && npm ci --omit=dev --ignore-scripts --no-audit --no-fund "$@" \
  && if [ -d node_modules/prisma ]; then \
       rm -rf node_modules/@prisma/engines && cp -R /tmp/prisma-engines node_modules/@prisma/engines; \
     fi

# Camadas de arquivos comuns às 7 imagens. Os arquivos pertencem ao root e são
# somente leitura para o processo.
FROM base AS runtime-base
ENV NODE_ENV=production
COPY docker/service-entrypoint.sh /usr/local/bin/pulso-service
# Remove o CR de um checkout com CRLF (Windows): com ele, o shebang vira "/bin/sh\r".
# /var/lib/pulso/identity-keys: chaves do JWT do identity (volume próprio, gravável pelo
# usuário node; um volume novo herda o dono e a permissão da pasta da imagem).
RUN sed -i 's/\r$//' /usr/local/bin/pulso-service \
  && chmod 755 /usr/local/bin/pulso-service \
  && install -d -o node -g node -m 700 /var/lib/pulso/identity-keys
COPY --from=prod-deps /app ./
COPY --from=build /out ./

# Imagem final de cada processo: só metadados, nenhuma camada nova.
FROM runtime-base AS runtime
ARG SERVICE_DIR
ARG SERVICE_PORT=3000
ENV SERVICE_DIR=${SERVICE_DIR} \
  PORT=${SERVICE_PORT}
EXPOSE ${SERVICE_PORT}
USER node
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -q -T 4 -O /dev/null "http://127.0.0.1:${PORT}/health" || exit 1
# O entrypoint entra em /app/${SERVICE_DIR} e executa o comando (padrão: o
# processo NestJS). Ex.: docker compose run --rm identity npx prisma migrate deploy
ENTRYPOINT ["pulso-service"]
CMD ["node", "dist/main.js"]
