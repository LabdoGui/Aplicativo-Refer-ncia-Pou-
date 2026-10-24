/** Trilha de auditoria da demonstração (o gateway real junta a de cada serviço). */
import type { AuditLogEntry, AuthUser } from '@pulso/contracts';
import { db } from './state';
import { nowIso, uuid } from './support';

export interface AuditRecord {
  actor?: Pick<AuthUser, 'id' | 'role'> | null;
  /** Verbo no formato `<entidade>.<ação>` (ex.: donor.viewed). */
  action: string;
  entity: string;
  entityId?: string | null;
  /** Só identificadores e fatos mínimos: nunca respostas de saúde nem senhas. */
  metadata?: Record<string, unknown>;
}

/** Mesmo contrato do AuditService.record, com o nome do serviço que registrou. */
export function recordAudit(service: string, entry: AuditRecord): void {
  const row: AuditLogEntry = {
    id: uuid(),
    service,
    actorId: entry.actor?.id ?? null,
    actorRole: entry.actor?.role ?? null,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId ?? null,
    metadata: entry.metadata ?? null,
    requestId: null,
    createdAt: nowIso(),
  };
  db().audit.push(row);
}
