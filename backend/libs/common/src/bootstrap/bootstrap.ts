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

export interface SwaggerOptions {
  title: string;
  description: string;
}

export interface BootstrapOptions {
  module: Type<unknown>;
  swagger?: SwaggerOptions;
  /** Prefixo global /api/v1 (padrão: true). O gateway desliga para montar o proxy. */
  useGlobalPrefix?: boolean;
  /** Parser de corpo do Nest (padrão: true). O gateway desliga para repassar o corpo intacto ao proxy. */
  bodyParser?: boolean;
  /** Ajustes extras antes do listen (middlewares, CORS...). */
  configure?: (app: NestExpressApplication) => void | Promise<void>;
}

export function setupSwagger(app: INestApplication, options: SwaggerOptions, version: string): void {
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
    swaggerOptions: { persistAuthorization: true },
  });
}

/** Inicializa um processo NestJS com as convenções do Pulso. */
export async function bootstrapService(options: BootstrapOptions): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(options.module, {
    bufferLogs: true,
    bodyParser: options.bodyParser ?? true,
  });
  const logger = app.get(Logger);
  app.useLogger(logger);

  const config = app.get<BaseEnv>(APP_CONFIG);
  const serviceName = app.get<string>(SERVICE_NAME);

  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback, linklocal, uniquelocal');
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cookieParser());
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
