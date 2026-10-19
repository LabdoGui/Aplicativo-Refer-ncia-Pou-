import type { IncomingMessage, ServerResponse } from 'node:http';
import { RequestMethod, type INestApplication, type Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { API_PREFIX } from '@pulso/contracts';
import type { BaseEnv } from '../config/env';
import { createValidationPipe } from '../errors/validation';
import { APP_CONFIG, SERVICE_NAME } from '../tokens';

/** Limite do corpo das requisições (o nginx usa o mesmo valor em client_max_body_size). */
export const REQUEST_BODY_LIMIT = '1mb';

/** Cache-Control padrão das respostas da API: nada de dados pessoais em cache do navegador. */
export const DEFAULT_CACHE_CONTROL = 'no-store';

/** Parsers de corpo JSON e de formulário com o limite do Pulso (o padrão do Express é 100 kB). */
export function registerBodyParsers(app: NestExpressApplication): void {
  app.useBodyParser('json', { limit: REQUEST_BODY_LIMIT });
  app.useBodyParser('urlencoded', { limit: REQUEST_BODY_LIMIT, extended: true });
}

/**
 * Middleware: `Cache-Control: no-store` em toda resposta cuja rota não definiu
 * o próprio cabeçalho. A decisão fica para o envio dos cabeçalhos, então uma
 * rota pública pode liberar cache (ex.: `@Header('Cache-Control', 'public, max-age=60')`).
 */
export function noStoreByDefault(
  _request: IncomingMessage,
  response: ServerResponse,
  next: () => void,
): void {
  const writeHead = response.writeHead;
  response.writeHead = function (this: ServerResponse, ...args: unknown[]) {
    if (!this.headersSent && !this.hasHeader('Cache-Control')) {
      this.setHeader('Cache-Control', DEFAULT_CACHE_CONTROL);
    }
    return (writeHead as (...params: unknown[]) => ServerResponse).apply(this, args);
  } as ServerResponse['writeHead'];
  next();
}

export interface SwaggerOptions {
  title: string;
  description: string;
}

export interface BootstrapOptions {
  module: Type<unknown>;
  swagger?: SwaggerOptions;
  /** Prefixo global /api/v1 (padrão: true). O gateway desliga para montar o proxy. */
  useGlobalPrefix?: boolean;
  /**
   * Parsers de corpo JSON e de formulário, com limite REQUEST_BODY_LIMIT (padrão: true).
   * O gateway desliga para repassar o corpo intacto ao proxy.
   */
  bodyParser?: boolean;
  /** Ajustes extras antes do listen (middlewares, CORS...). */
  configure?: (app: NestExpressApplication) => void | Promise<void>;
}

export function setupSwagger(
  app: INestApplication,
  options: SwaggerOptions,
  version: string,
): void {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle(options.title)
      .setDescription(options.description)
      .setVersion(version)
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
      .build(),
  );
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs-json',
    customSiteTitle: options.title,
    // O token informado em "Authorize" fica só na memória da página (nunca no localStorage).
    swaggerOptions: { persistAuthorization: false },
  });
}

/** Inicializa um processo NestJS com as convenções do Pulso. */
export async function bootstrapService(options: BootstrapOptions): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(options.module, {
    bufferLogs: true,
    // Os parsers padrão do Nest (limite de 100 kB) são trocados por registerBodyParsers.
    bodyParser: false,
  });
  const logger = app.get(Logger);
  app.useLogger(logger);

  const config = app.get<BaseEnv>(APP_CONFIG);
  const serviceName = app.get<string>(SERVICE_NAME);

  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback, linklocal, uniquelocal');
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(noStoreByDefault);
  app.use(cookieParser());
  if (options.bodyParser !== false) registerBodyParsers(app);
  if (options.useGlobalPrefix !== false) {
    app.setGlobalPrefix(API_PREFIX, { exclude: [{ path: 'health', method: RequestMethod.GET }] });
  }
  app.useGlobalPipes(createValidationPipe());
  app.enableShutdownHooks();

  await options.configure?.(app);
  if (options.swagger) setupSwagger(app, options.swagger, config.SERVICE_VERSION);

  await app.listen(config.PORT, '0.0.0.0');
  logger.log(`${serviceName} ouvindo na porta ${config.PORT}`, 'Bootstrap');
  return app;
}
