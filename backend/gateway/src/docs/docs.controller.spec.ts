import type { INestApplication } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { APP_CONFIG, ProblemDetailsFilter } from '@pulso/common';
import type { ProblemDetails } from '@pulso/contracts';
import { DocsController } from './docs.controller';
import { DocsService } from './docs.service';
import { INIT_SCRIPT, INIT_SCRIPT_FILE } from './swagger-ui';

async function startDocsApp(docsEnabled: boolean): Promise<{ app: INestApplication; url: string }> {
  const moduleRef = await Test.createTestingModule({
    controllers: [DocsController],
    providers: [
      { provide: APP_CONFIG, useValue: { DOCS_ENABLED: docsEnabled } },
      {
        provide: DocsService,
        useValue: { getMergedDocument: async () => ({ openapi: '3.0.0', paths: {} }) },
      },
      { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    ],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  await app.listen(0, '127.0.0.1');
  return { app, url: await app.getUrl() };
}

/**
 * Encerra o servidor sem esperar as conexões keep-alive abertas pelo fetch:
 * sem isso, o app.close() pode passar do tempo limite do afterAll.
 */
async function stopApp(app: INestApplication): Promise<void> {
  (app.getHttpServer() as import('node:http').Server).closeAllConnections();
  await app.close();
}

const DOCS_PATHS = [
  '/api/docs',
  '/api/docs-json',
  '/api/docs/assets/swagger-ui.css',
  `/api/docs/assets/${INIT_SCRIPT_FILE}`,
];

describe('DocsController', () => {
  describe('DOCS_ENABLED=true', () => {
    let app: INestApplication;
    let url: string;

    beforeAll(async () => ({ app, url } = await startDocsApp(true)));
    afterAll(() => stopApp(app));

    it.each(DOCS_PATHS)('%s responde 200', async (path) => {
      expect((await fetch(`${url}${path}`)).status).toBe(200);
    });
  });

  describe('DOCS_ENABLED=false', () => {
    let app: INestApplication;
    let url: string;

    beforeAll(async () => ({ app, url } = await startDocsApp(false)));
    afterAll(() => stopApp(app));

    it.each(DOCS_PATHS)('%s responde 404 (Problem Details)', async (path) => {
      const response = await fetch(`${url}${path}`);

      expect(response.status).toBe(404);
      expect(((await response.json()) as ProblemDetails).code).toBe('NOT_FOUND');
    });
  });

  it('a página não guarda o token do "Authorize" no localStorage', () => {
    expect(INIT_SCRIPT).toContain('persistAuthorization: false');
    expect(INIT_SCRIPT).not.toContain('persistAuthorization: true');
  });
});
