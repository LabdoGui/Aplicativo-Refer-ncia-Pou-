import { dirname, join } from 'node:path';

/** Caminhos públicos da documentação unificada. */
export const DOCS_ROUTES = {
  page: '/api/docs',
  json: '/api/docs-json',
  assets: '/api/docs/assets',
} as const;

/** Script de inicialização servido como arquivo (sem <script> inline, compatível com CSP estrita). */
export const INIT_SCRIPT_FILE = 'pulso-docs.js';

export const INIT_SCRIPT = `'use strict';
window.ui = SwaggerUIBundle({
  url: '${DOCS_ROUTES.json}',
  dom_id: '#swagger-ui',
  deepLinking: true,
  persistAuthorization: true,
  displayRequestDuration: true,
  docExpansion: 'none',
  filter: true,
  validatorUrl: null,
});
`;

export const DOCS_PAGE = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Pulso — Documentação da API</title>
    <link rel="icon" type="image/png" href="${DOCS_ROUTES.assets}/favicon-32x32.png" />
    <link rel="stylesheet" href="${DOCS_ROUTES.assets}/swagger-ui.css" />
  </head>
  <body>
    <noscript>
      Ative o JavaScript para navegar pela documentação interativa. O documento OpenAPI está em
      <a href="${DOCS_ROUTES.json}">${DOCS_ROUTES.json}</a>.
    </noscript>
    <div id="swagger-ui"></div>
    <script src="${DOCS_ROUTES.assets}/swagger-ui-bundle.js"></script>
    <script src="${DOCS_ROUTES.assets}/${INIT_SCRIPT_FILE}"></script>
  </body>
</html>
`;

/** CSP da página: só recursos do próprio gateway; estilos inline são usados pelo Swagger UI. */
export const DOCS_PAGE_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

/** Arquivos do swagger-ui-dist liberados (lista fechada: nada além disso é servido). */
const SWAGGER_UI_FILES = ['swagger-ui.css', 'swagger-ui-bundle.js', 'favicon-32x32.png'] as const;

let swaggerUiDir: string | undefined;

/**
 * Pasta do swagger-ui-dist. Ele é dependência do @nestjs/swagger (não do gateway),
 * então a busca parte da pasta do @nestjs/swagger: funciona com ou sem hoisting.
 */
function resolveSwaggerUiDir(): string {
  const modulePath = require.resolve('swagger-ui-dist', {
    paths: [dirname(require.resolve('@nestjs/swagger'))],
  });
  return (require(modulePath) as { getAbsoluteFSPath(): string }).getAbsoluteFSPath();
}

/** Caminho absoluto de um arquivo permitido do swagger-ui-dist, ou `undefined`. */
export function swaggerUiAssetPath(file: string): string | undefined {
  if (!(SWAGGER_UI_FILES as readonly string[]).includes(file)) return undefined;
  swaggerUiDir ??= resolveSwaggerUiDir();
  return join(swaggerUiDir, file);
}
