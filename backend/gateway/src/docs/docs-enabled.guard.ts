import { CanActivate, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { APP_CONFIG } from '@pulso/common';
import type { GatewayEnv } from '../config';

/** Responde 404 nas rotas de documentação quando DOCS_ENABLED=false. */
@Injectable()
export class DocsEnabledGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: GatewayEnv) {}

  canActivate(): boolean {
    if (!this.config.DOCS_ENABLED) throw new NotFoundException();
    return true;
  }
}
