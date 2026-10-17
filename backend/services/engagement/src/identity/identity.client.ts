import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG, InternalHttpClient } from '@pulso/common';
import { API_PREFIX, type DonorSummary } from '@pulso/contracts';
import type { EngagementEnv } from '../config';

export type DonorName = { id: string; name: string; donorCode: string | null };

/** Nomes dos doadores (rota interna do identity) para as telas administrativas. */
@Injectable()
export class IdentityClient {
  private readonly logger = new Logger(IdentityClient.name);

  constructor(
    private readonly http: InternalHttpClient,
    @Inject(APP_CONFIG) private readonly config: EngagementEnv,
  ) {}

  /**
   * Se o identity estiver fora, a lista continua utilizável (degradação parcial):
   * os nomes aparecem como indisponíveis.
   */
  async names(ids: string[], requestId?: string): Promise<Map<string, DonorName>> {
    const unique = [...new Set(ids)];
    const result = new Map<string, DonorName>(
      unique.map((id) => [id, { id, name: 'Nome indisponível', donorCode: null }]),
    );
    if (unique.length === 0) return result;
    try {
      const summaries = await this.http.get<DonorSummary[]>(
        this.config.IDENTITY_URL,
        `/${API_PREFIX}/internal/donors/summaries`,
        { requestId, query: { ids: unique.join(',') } },
      );
      for (const summary of summaries) {
        result.set(summary.id, {
          id: summary.id,
          name: summary.name,
          donorCode: summary.donorCode === '—' ? null : summary.donorCode,
        });
      }
    } catch (error) {
      this.logger.warn({ err: (error as Error)?.message }, 'Nomes dos doadores indisponíveis');
    }
    return result;
  }
}
