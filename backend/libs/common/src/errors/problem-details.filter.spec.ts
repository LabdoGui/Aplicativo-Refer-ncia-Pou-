import {
  ArgumentsHost,
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpException,
  INestApplication,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { ProblemDetails } from '@pulso/contracts';
import { IsEmail, IsInt, Min } from 'class-validator';
import { AppException } from './app.exception';
import { ProblemDetailsFilter } from './problem-details.filter';
import { createValidationPipe } from './validation';

class CreateDonationDto {
  @IsEmail()
  email!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

interface CapturedResponse {
  headersSent: boolean;
  statusCode?: number;
  contentType?: string;
  body?: ProblemDetails;
}

function createHost(options: { id?: string; headers?: Record<string, string> } = {}) {
  const headers = options.headers ?? {};
  const request = {
    id: options.id,
    originalUrl: '/api/v1/teste',
    header: (name: string) => headers[name.toLowerCase()],
  };
  const captured: CapturedResponse = { headersSent: false };
  const response = {
    get headersSent() {
      return captured.headersSent;
    },
    status(code: number) {
      captured.statusCode = code;
      return response;
    },
    type(contentType: string) {
      captured.contentType = contentType;
      return response;
    },
    json(body: ProblemDetails) {
      captured.body = body;
      return response;
    },
  };
  const host = {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ArgumentsHost;
  return { host, captured };
}

function handle(exception: unknown, options?: Parameters<typeof createHost>[0]) {
  const { host, captured } = createHost(options);
  new ProblemDetailsFilter().catch(exception, host);
  return captured;
}

/** Erro no formato do `http-errors`, como o body-parser lança. */
function httpError(status: number, type: string, message: string): Error {
  return Object.assign(new Error(message), {
    name: 'HttpError',
    status,
    statusCode: status,
    expose: status < 500,
    type,
  });
}

describe('ProblemDetailsFilter', () => {
  let errorLog: jest.SpyInstance;
  let warnLog: jest.SpyInstance;

  beforeEach(() => {
    errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    warnLog = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('mantém código, mensagem e erros por campo de AppException', () => {
    const exception = new AppException(
      409,
      'SLOT_FULL',
      'Este horário acabou de lotar.',
      undefined,
      [{ field: 'slotId', message: 'Escolha outro horário.' }],
    );

    const { statusCode, body } = handle(exception);

    expect(statusCode).toBe(409);
    expect(body).toMatchObject({
      type: 'https://pulso.local/problems/slot-full',
      title: 'Conflito',
      status: 409,
      code: 'SLOT_FULL',
      detail: 'Este horário acabou de lotar.',
      errors: [{ field: 'slotId', message: 'Escolha outro horário.' }],
    });
  });

  it('usa o título próprio de AppException quando informado', () => {
    const { body } = handle(new AppException(422, 'NOT_ELIGIBLE', 'Aguarde.', 'Ainda não'));

    expect(body).toMatchObject({ title: 'Ainda não', detail: 'Aguarde.', status: 422 });
  });

  it('troca a mensagem em inglês de NotFoundException pela mensagem padrão em português', () => {
    const { statusCode, body } = handle(new NotFoundException('User 42 not found'));

    expect(statusCode).toBe(404);
    expect(body).toMatchObject({
      code: 'NOT_FOUND',
      title: 'Não encontrado',
      detail: 'O recurso solicitado não foi encontrado.',
    });
    expect(JSON.stringify(body)).not.toContain('not found');
  });

  it('usa a mensagem padrão em português para outras exceções do framework', () => {
    expect(handle(new ForbiddenException()).body).toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
      detail: 'Você não tem permissão para realizar esta ação.',
    });
    expect(handle(new HttpException('Too Many Requests', 429)).body).toMatchObject({
      status: 429,
      code: 'TOO_MANY_REQUESTS',
      title: 'Muitas tentativas',
    });
  });

  it('mantém errors[] do BadRequestException gerado pelo ValidationPipe', async () => {
    const exception = await createValidationPipe()
      .transform(
        { email: 'invalido', quantity: 0, extra: 'x' },
        { type: 'body', metatype: CreateDonationDto },
      )
      .catch((error: unknown) => error);
    expect(exception).toBeInstanceOf(BadRequestException);

    const { statusCode, body } = handle(exception);

    expect(statusCode).toBe(400);
    expect(body).toMatchObject({
      code: 'VALIDATION_ERROR',
      title: 'Dados inválidos',
      detail: 'Alguns campos precisam de correção.',
    });
    const fields = body?.errors?.map((error) => error.field);
    expect(fields).toEqual(expect.arrayContaining(['email', 'quantity', 'extra']));
  });

  it('não repassa a mensagem técnica de BadRequestException comum', () => {
    const { body } = handle(new BadRequestException('Validation failed (uuid is expected)'));

    expect(body).toMatchObject({
      status: 400,
      code: 'BAD_REQUEST',
      detail: 'Verifique os dados informados e tente novamente.',
    });
  });

  it('converte erro de unicidade do Prisma (P2002) em 409 DUPLICATE', () => {
    const prismaError = Object.assign(
      new Error('Unique constraint failed on the fields: (`email`)'),
      {
        name: 'PrismaClientKnownRequestError',
        code: 'P2002',
        meta: { target: ['email'] },
      },
    );

    const { statusCode, body } = handle(prismaError);

    expect(statusCode).toBe(409);
    expect(body).toMatchObject({
      code: 'DUPLICATE',
      detail: 'Já existe um registro com esses dados.',
    });
    expect(JSON.stringify(body)).not.toContain('email');
  });

  it('converte registro inexistente do Prisma (P2025) em 404', () => {
    const { statusCode, body } = handle({ name: 'PrismaClientKnownRequestError', code: 'P2025' });

    expect(statusCode).toBe(404);
    expect(body?.code).toBe('NOT_FOUND');
  });

  it('responde 500 genérico para erro desconhecido, sem vazar detalhes, e registra o erro', () => {
    const { statusCode, body } = handle(new Error('senha do banco: segredo'));

    expect(statusCode).toBe(500);
    expect(body).toMatchObject({
      code: 'INTERNAL_ERROR',
      title: 'Erro inesperado',
      detail: 'Não foi possível concluir a operação agora. Tente novamente em instantes.',
    });
    expect(JSON.stringify(body)).not.toContain('segredo');
    expect(errorLog).toHaveBeenCalledTimes(1);
  });

  it('não repassa a mensagem de HttpException 5xx, mesmo amigável', () => {
    const exception = new InternalServerErrorException({ code: 'X', message: 'detalhe interno' });

    expect(handle(exception).body).toMatchObject({
      status: 500,
      detail: 'Não foi possível concluir a operação agora. Tente novamente em instantes.',
    });
  });

  it('corpo grande demais (body-parser) vira 413 PAYLOAD_TOO_LARGE, com aviso e sem erro 500', () => {
    const { statusCode, body } = handle(
      httpError(413, 'entity.too.large', 'request entity too large'),
    );

    expect(statusCode).toBe(413);
    expect(body).toMatchObject({
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
      detail: 'O conteúdo enviado é grande demais.',
    });
    expect(errorLog).not.toHaveBeenCalled();
    expect(warnLog).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'PAYLOAD_TOO_LARGE', reason: 'entity.too.large' }),
      expect.any(String),
    );
  });

  it('charset ou encoding não suportado vira 415 UNSUPPORTED_MEDIA_TYPE', () => {
    const { statusCode, body } = handle(
      httpError(415, 'charset.unsupported', 'unsupported charset "LATIN1"'),
    );

    expect(statusCode).toBe(415);
    expect(body?.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    expect(JSON.stringify(body)).not.toContain('LATIN1');
    expect(errorLog).not.toHaveBeenCalled();
  });

  it('JSON malformado (body-parser) vira 400 com a mensagem padrão em português', () => {
    const { statusCode, body } = handle(
      httpError(400, 'entity.parse.failed', 'Unexpected token } in JSON at position 10'),
    );

    expect(statusCode).toBe(400);
    expect(body).toMatchObject({
      code: 'BAD_REQUEST',
      detail: 'Verifique os dados informados e tente novamente.',
    });
    expect(errorLog).not.toHaveBeenCalled();
  });

  it('outro status 4xx exposto usa o padrão do status, ou o de 400', () => {
    expect(handle(httpError(404, 'x', 'not found')).body).toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
    expect(handle(httpError(431, 'x', 'headers too large')).body).toMatchObject({
      status: 431,
      code: 'BAD_REQUEST',
    });
  });

  it('erro com status 5xx ou não exposto continua 500 genérico e registrado', () => {
    const notExposed = Object.assign(new Error('falha interna'), { status: 400, expose: false });

    expect(handle(httpError(502, 'x', 'bad gateway')).statusCode).toBe(500);
    expect(handle(notExposed).statusCode).toBe(500);
    expect(errorLog).toHaveBeenCalledTimes(2);
  });

  it('responde com application/problem+json, instance e requestId do pino-http', () => {
    const { contentType, body } = handle(new NotFoundException(), {
      id: 'req-pino-1',
      headers: { 'x-request-id': 'req-cabecalho' },
    });

    expect(contentType).toBe('application/problem+json');
    expect(body).toMatchObject({ instance: '/api/v1/teste', requestId: 'req-pino-1' });
  });

  it('usa o cabeçalho x-request-id quando a requisição não tem id', () => {
    const { body } = handle(new NotFoundException(), { headers: { 'x-request-id': 'req-gw-7' } });

    expect(body?.requestId).toBe('req-gw-7');
  });

  it.each(['', 'curto', 'tem espaço 123', 'x'.repeat(129)])(
    'ignora x-request-id fora do formato aceito (%j)',
    (requestId) => {
      const { body } = handle(new NotFoundException(), { headers: { 'x-request-id': requestId } });

      expect(body?.requestId).toBeUndefined();
    },
  );

  it('não escreve a resposta se os cabeçalhos já foram enviados', () => {
    const { host, captured } = createHost();
    captured.headersSent = true;

    new ProblemDetailsFilter().catch(new NotFoundException(), host);

    expect(captured.statusCode).toBeUndefined();
    expect(captured.body).toBeUndefined();
  });
});

@Controller('teste')
class FakeController {
  @Get('nao-encontrado')
  notFound(): never {
    throw new NotFoundException();
  }

  @Post('doacoes')
  create(@Body() dto: CreateDonationDto): CreateDonationDto {
    return dto;
  }
}

describe('ProblemDetailsFilter (HTTP real)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [FakeController],
      providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.useGlobalPipes(createValidationPipe());
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  it('envia Content-Type application/problem+json e propaga x-request-id', async () => {
    const response = await fetch(`${baseUrl}/teste/nao-encontrado`, {
      headers: { 'x-request-id': 'req-e2e-1' },
    });
    const body = (await response.json()) as ProblemDetails;

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toMatch(/^application\/problem\+json/);
    expect(body).toMatchObject({
      code: 'NOT_FOUND',
      detail: 'O recurso solicitado não foi encontrado.',
      instance: '/teste/nao-encontrado',
      requestId: 'req-e2e-1',
    });
  });

  it('traduz a rota inexistente do framework ("Cannot GET ...") para a mensagem padrão', async () => {
    const response = await fetch(`${baseUrl}/rota-que-nao-existe`);
    const body = (await response.json()) as ProblemDetails;

    expect(response.status).toBe(404);
    expect(body.detail).toBe('O recurso solicitado não foi encontrado.');
  });

  it('devolve errors[] por campo quando o corpo é inválido', async () => {
    const response = await fetch(`${baseUrl}/teste/doacoes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'doador@exemplo.org', quantity: 'muitos' }),
    });
    const body = (await response.json()) as ProblemDetails;

    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.errors?.length).toBeGreaterThan(0);
    expect(new Set(body.errors?.map((error) => error.field))).toEqual(new Set(['quantity']));
    // Mensagens do class-validator chegam traduzidas (nada em inglês para o usuário).
    for (const error of body.errors ?? []) expect(error.message).not.toMatch(/\bmust\b/);
  });
});
