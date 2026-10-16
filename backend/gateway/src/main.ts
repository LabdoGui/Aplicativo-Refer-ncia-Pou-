import 'reflect-metadata';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { APP_CONFIG, bootstrapService } from '@pulso/common';
import { HEADERS } from '@pulso/contracts';
import { AppModule } from './app.module';
import type { GatewayEnv } from './config';
import { DocsService } from './docs/docs.service';

function configure(app: NestExpressApplication): void {
  const config = app.get<GatewayEnv>(APP_CONFIG);

  app.enableCors({
    origin: config.CORS_ORIGINS,
    credentials: true,
    exposedHeaders: [HEADERS.requestId, 'Retry-After'],
  });

  // Rotas do próprio gateway entram no OpenAPI unificado servido em /api/docs.
  const gatewayDocument = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Pulso — gateway')
      .setVersion(config.SERVICE_VERSION)
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
      .build(),
  );
  app.get(DocsService).setGatewayDocument(gatewayDocument);
}

void bootstrapService({
  module: AppModule,
  // Sem prefixo global: o proxy é montado na raiz e as rotas próprias declaram o caminho completo.
  useGlobalPrefix: false,
  // Corpo repassado intacto (stream) aos serviços.
  bodyParser: false,
  configure,
});
