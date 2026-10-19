import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { APP_CONFIG } from '@pulso/common';
import type { GatewayEnv } from '../config';
import {
  FixedWindowRateLimiter,
  type RateLimitBucket,
  type RateLimitDecision,
} from './rate-limiter';

/** Mantém um limitador por categoria de rota e limpa janelas vencidas periodicamente. */
@Injectable()
export class RateLimitService implements OnModuleDestroy {
  private readonly limiters: Record<Exclude<RateLimitBucket, 'exempt'>, FixedWindowRateLimiter>;
  private readonly purgeTimer: NodeJS.Timeout;

  constructor(@Inject(APP_CONFIG) config: GatewayEnv) {
    const windowMs = config.RATE_LIMIT_WINDOW_MS;
    this.limiters = {
      auth: new FixedWindowRateLimiter({ windowMs, max: config.AUTH_RATE_LIMIT_MAX }),
      default: new FixedWindowRateLimiter({ windowMs, max: config.RATE_LIMIT_MAX }),
    };
    this.purgeTimer = setInterval(() => {
      this.limiters.auth.purgeExpired();
      this.limiters.default.purgeExpired();
    }, windowMs);
    // O timer não deve manter o processo vivo no desligamento.
    this.purgeTimer.unref();
  }

  hit(bucket: Exclude<RateLimitBucket, 'exempt'>, clientKey: string): RateLimitDecision {
    return this.limiters[bucket].hit(clientKey);
  }

  onModuleDestroy(): void {
    clearInterval(this.purgeTimer);
  }
}
