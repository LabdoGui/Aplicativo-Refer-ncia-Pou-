import { Module } from '@nestjs/common';
import { CoreModule, HealthModule } from '@pulso/common';
import { envSchema } from './config';
import { DocsModule } from './docs/docs.module';
import { EdgeModule } from './edge/edge.module';
import { ServicesHealthModule } from './health/services-health.module';

@Module({
  imports: [
    // O guard global fica desligado: a autenticação de borda é feita por middleware.
    CoreModule.forRoot({ serviceName: 'gateway', envSchema, disableAuthGuard: true }),
    HealthModule.forRoot(),
    EdgeModule,
    ServicesHealthModule,
    DocsModule,
  ],
})
export class AppModule {}
