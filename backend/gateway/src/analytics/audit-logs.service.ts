import { Injectable, Logger } from '@nestjs/common';
import type { AuditLogEntry, AuditLogsResponse } from '@pulso/contracts';
import {
  AUDIT_LOGS_DEFAULT_LIMIT,
  AUDITED_SERVICES,
  type AuditLogsQueryDto,
} from './analytics.dto';
import { AUDIT_LOGS_PATH, InternalSources, isObject } from './internal-sources';

function isEntry(value: unknown): value is AuditLogEntry {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.action === 'string' &&
    typeof value.createdAt === 'string' &&
    !Number.isNaN(Date.parse(value.createdAt))
  );
}

const isEntryList = (body: unknown): body is unknown[] => Array.isArray(body);

/** Mais recentes primeiro; empate decidido pelo id, para a ordem ser estável. */
export function compareByNewest(a: AuditLogEntry, b: AuditLogEntry): number {
  const diff = Date.parse(b.createdAt) - Date.parse(a.createdAt);
  return diff !== 0 ? diff : a.id.localeCompare(b.id);
}

/** Trilha de auditoria unificada: junta a de cada serviço, ordena e corta no limite. */
@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(private readonly sources: InternalSources) {}

  async list(query: AuditLogsQueryDto, requestId?: string): Promise<AuditLogsResponse> {
    const limit = query.limit ?? AUDIT_LOGS_DEFAULT_LIMIT;
    const services = query.service ? [query.service] : [...AUDITED_SERVICES];
    const forwarded = { from: query.from, to: query.to, action: query.action, limit };

    const results = await Promise.all(
      services.map((service) =>
        this.sources.get(service, AUDIT_LOGS_PATH, forwarded, isEntryList, requestId),
      ),
    );

    const items: AuditLogEntry[] = [];
    const unavailable: string[] = [];
    for (const result of results) {
      if (!result.ok) {
        unavailable.push(result.service);
        continue;
      }
      // O nome do serviço vem do gateway (o mesmo aceito no filtro `service`).
      for (const entry of result.value.filter(isEntry))
        items.push({ ...entry, service: result.service });
    }
    if (unavailable.length > 0) {
      this.logger.warn(
        {
          requestId,
          unavailable: Object.fromEntries(
            results.flatMap((result) => (result.ok ? [] : [[result.service, result.reason]])),
          ),
        },
        'Trilha de auditoria incompleta',
      );
    }

    return { items: items.sort(compareByNewest).slice(0, limit), unavailable };
  }
}
