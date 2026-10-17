import { Body, Controller, Get, Header, Logger, Post, Res } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { ProblemDetails } from '@pulso/contracts';
import type { Response } from 'express';
import { ProblemDetailsFilter } from '../errors/problem-details.filter';
import { noStoreByDefault, registerBodyParsers, REQUEST_BODY_LIMIT } from './bootstrap';

@Controller('teste')
class FakeController {
  @Get('dados')
  data(): { ok: boolean } {
    return { ok: true };
  }

  @Get('publico')
  @Header('Cache-Control', 'public, max-age=60')
  publicData(): { ok: boolean } {
    return { ok: true };
  }

  @Get('manual')
  manual(@Res() response: Response): void {
    response.writeHead(200, { 'Cache-Control': 'private, max-age=5' }).end('ok');
  }

  @Post('eco')
  echo(@Body() body: { texto?: string }): { tamanho: number } {
    return { tamanho: body.texto?.length ?? 0 };
  }
}

/** Corpo JSON com aproximadamente `bytes` bytes. */
function jsonOfSize(bytes: number): string {
  return JSON.stringify({ texto: 'a'.repeat(bytes) });
}

describe('convenções HTTP do bootstrap (corpo e cache)', () => {
  let app: NestExpressApplication;
  let baseUrl: string;
  let errorLog: jest.SpyInstance;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [FakeController],
      providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
    }).compile();
    // Mesma sequência do bootstrapService: parsers do Nest desligados e os do Pulso registrados.
    app = moduleRef.createNestApplication<NestExpressApplication>({
      logger: false,
      bodyParser: false,
    });
    app.use(noStoreByDefault);
    registerBodyParsers(app);
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  const postJson = (body: string, contentType = 'application/json') =>
    fetch(`${baseUrl}/teste/eco`, {
      method: 'POST',
      headers: { 'content-type': contentType },
      body,
    });

  describe('Cache-Control', () => {
    it('é no-store por padrão', async () => {
      const response = await fetch(`${baseUrl}/teste/dados`);

      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-store');
    });

    it('respeita o Cache-Control definido pela rota', async () => {
      const decorated = await fetch(`${baseUrl}/teste/publico`);
      const manual = await fetch(`${baseUrl}/teste/manual`);

      expect(decorated.headers.get('cache-control')).toBe('public, max-age=60');
      expect(manual.headers.get('cache-control')).toBe('private, max-age=5');
    });

    it('também vale para respostas de erro (Problem Details)', async () => {
      const response = await fetch(`${baseUrl}/rota-que-nao-existe`);

      expect(response.status).toBe(404);
      expect(response.headers.get('cache-control')).toBe('no-store');
    });
  });

  describe(`limite de corpo (${REQUEST_BODY_LIMIT})`, () => {
    it('aceita corpo acima do padrão do Express (100 kB) e abaixo de 1 MB', async () => {
      const response = await postJson(jsonOfSize(500 * 1024));

      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({ tamanho: 500 * 1024 });
    });

    it('recusa corpo JSON acima de 1 MB com 413 amigável, sem erro 500', async () => {
      const response = await postJson(jsonOfSize(1024 * 1024 + 1));
      const body = (await response.json()) as ProblemDetails;

      expect(response.status).toBe(413);
      expect(response.headers.get('content-type')).toMatch(/^application\/problem\+json/);
      expect(body).toMatchObject({
        code: 'PAYLOAD_TOO_LARGE',
        detail: 'O conteúdo enviado é grande demais.',
      });
      expect(errorLog).not.toHaveBeenCalled();
    });

    it('recusa formulário acima de 1 MB com 413', async () => {
      const response = await postJson(
        `texto=${'a'.repeat(1024 * 1024 + 1)}`,
        'application/x-www-form-urlencoded',
      );

      expect(response.status).toBe(413);
      expect(((await response.json()) as ProblemDetails).code).toBe('PAYLOAD_TOO_LARGE');
    });

    it('charset não suportado vira 415 UNSUPPORTED_MEDIA_TYPE', async () => {
      const response = await postJson('{"texto":"ok"}', 'application/json; charset=latin1');

      expect(response.status).toBe(415);
      expect(((await response.json()) as ProblemDetails).code).toBe('UNSUPPORTED_MEDIA_TYPE');
      expect(errorLog).not.toHaveBeenCalled();
    });

    it('JSON malformado vira 400 BAD_REQUEST', async () => {
      const response = await postJson('{"texto":');

      expect(response.status).toBe(400);
      expect(((await response.json()) as ProblemDetails).code).toBe('BAD_REQUEST');
      expect(errorLog).not.toHaveBeenCalled();
    });
  });
});
