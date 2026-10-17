import { Module } from '@nestjs/common';
import { CoreModule, HealthModule } from '@pulso/common';
import { envSchema } from './config';
import { DocsModule } from './docs/docs.module';
import { EdgeModule } from './edge/edge.module';
import { ServicesHealthModule } from './health/services-health.module';

@Module({
  imports: [
    // O AuthGuard global protege as rotas do próprio gateway (as abertas usam @Public()).
    // Requisições encaminhadas aos serviços terminam no ProxyMiddleware, antes do guard:
    // lá vale a validação de borda (EdgeAuthMiddleware) e o guard de cada serviço.
    CoreModule.forRoot({ serviceName: 'gateway', envSchema }),
    HealthModule.forRoot(),
    EdgeModule,
    ServicesHealthModule,
    DocsModule,
  ],
})
export class AppModule {}
