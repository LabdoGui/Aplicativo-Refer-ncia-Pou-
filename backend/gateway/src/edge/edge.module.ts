import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ProxyMiddleware } from '../proxy/proxy.middleware';
import { UpstreamsModule } from '../upstreams/upstreams.module';
import { EdgeAuthMiddleware } from './edge-auth.middleware';
import { RateLimitMiddleware } from './rate-limit.middleware';
import { RateLimitService } from './rate-limit.service';

/**
 * Cadeia de borda, em ordem: limite de requisições → validação do JWT → proxy.
 * Roda depois do middleware global de log (request-id) e antes dos controllers
 * do gateway; o que não é rota de serviço segue para eles.
 */
@Module({
  imports: [UpstreamsModule],
  providers: [RateLimitService],
})
export class EdgeModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RateLimitMiddleware, EdgeAuthMiddleware, ProxyMiddleware)
      .forRoutes({ path: '{*path}', method: RequestMethod.ALL });
  }
}
