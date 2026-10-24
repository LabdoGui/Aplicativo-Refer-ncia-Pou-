# Frontend do SangueConecta: compila a SPA (Vite) e a serve com nginx sem root na porta 8080.
# O nginx também encaminha /api/ ao gateway (veja docker/nginx.conf).
#
# NODE_IMAGE e NGINX_IMAGE podem ser trocadas por quem sofre com o limite do
# Docker Hub, por exemplo: --build-arg NGINX_IMAGE=mirror.gcr.io/library/nginx:1.27-alpine
ARG NODE_IMAGE=node:22-alpine
ARG NGINX_IMAGE=nginx:1.27-alpine

# Os estágios base, manifests-src, manifests e deps são idênticos aos do
# docker/service.Dockerfile: o BuildKit reaproveita a mesma camada do npm ci
# em todas as imagens. Altere os dois arquivos juntos.
FROM ${NODE_IMAGE} AS base
# O Prisma no Alpine precisa das bibliotecas do OpenSSL 3. A imagem oficial do
# Node já traz libssl3/libcrypto3; o pacote só é instalado se faltar.
RUN { apk info -e libssl3 && apk info -e libcrypto3; } >/dev/null 2>&1 \
  || apk add --no-cache openssl
ENV CHECKPOINT_DISABLE=1 \
  NPM_CONFIG_UPDATE_NOTIFIER=false
WORKDIR /app

# Extrai do contexto só o package-lock.json e os package.json dos workspaces.
FROM base AS manifests-src
COPY . /src
RUN cd /src \
  && mkdir -p /manifests \
  && find . -name package.json ! -path '*/node_modules/*' > /tmp/manifests.txt \
  && tar -cf - package-lock.json -T /tmp/manifests.txt | tar -xf - -C /manifests

FROM base AS manifests
COPY --from=manifests-src /manifests ./

FROM manifests AS deps
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

# Código-fonte num estágio vazio: copiar aqui não duplica o node_modules, e o
# estágio build usa tudo numa única camada. O frontend importa @pulso/contracts
# direto do código-fonte (alias do Vite); o esbuild do Vite lê o tsconfig.json
# dos contratos, que estende o tsconfig.base.json.
FROM scratch AS frontend-src
COPY tsconfig.base.json /tsconfig.base.json
COPY backend/libs/contracts /backend/libs/contracts
COPY frontend /frontend

FROM deps AS build
RUN --mount=type=bind,from=frontend-src,target=/src \
  cp -R /src/. ./ \
  && npm run build -w @pulso/frontend

FROM ${NGINX_IMAGE} AS runtime
COPY docker/nginx.conf /etc/nginx/nginx.conf
# Sem o default.conf da imagem: toda a configuração está em nginx.conf.
RUN rm -f /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -T 3 -O /dev/null http://127.0.0.1:8080/healthz || exit 1
