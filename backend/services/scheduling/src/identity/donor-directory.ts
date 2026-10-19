import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, InternalHttpClient } from '@pulso/common';
import type { DonorSummary } from '@pulso/contracts';
import type { SchedulingEnv } from '../config';

/** Limite de IDs por chamada aceito pelo identity. */
const BATCH_SIZE = 200;

/**
 * Nomes e resumos dos doadores, sempre lidos do identity (fonte única dos
 * dados pessoais): o scheduling guarda só o UUID do doador.
 */
@Injectable()
export class DonorDirectory {
  constructor(
    private readonly http: InternalHttpClient,
    @Inject(APP_CONFIG) private readonly config: SchedulingEnv,
  ) {}

  async summaries(ids: string[], requestId?: string): Promise<Map<string, DonorSummary>> {
    const unique = [...new Set(ids)];
    const result = new Map<string, DonorSummary>();
    for (let index = 0; index < unique.length; index += BATCH_SIZE) {
      const batch = unique.slice(index, index + BATCH_SIZE);
      const found = await this.http.get<DonorSummary[]>(
        this.config.IDENTITY_URL,
        '/api/v1/internal/donors/summaries',
        { query: { ids: batch.join(',') }, requestId },
      );
      for (const summary of found) result.set(summary.id, summary);
    }
    return result;
  }

  async summary(id: string, requestId?: string): Promise<DonorSummary> {
    return (
      (await this.summaries([id], requestId)).get(id) ?? {
        id,
        name: 'Doador não encontrado',
        donorCode: '—',
        age: null,
        declaredBloodType: null,
      }
    );
  }
}
