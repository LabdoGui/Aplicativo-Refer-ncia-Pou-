import { useState } from 'react';
import { ScrollText } from 'lucide-react';
import { ROLE_LABELS, type Role } from '@pulso/contracts';
import { SelectField, TextField } from '@/components/form';
import {
  EmptyState,
  PageHeader,
  QueryState,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '@/components/ui';
import { FilterBar } from '@/features/admin/FilterBar';
import { useAuditLogs } from '@/features/admin-config/api';
import { AUDIT_ACTION_LABELS, AUDITED_SERVICES } from '@/features/admin-config/audit-labels';
import { UnavailableAlert } from '@/features/insights/UnavailableAlert';
import { localDayBoundsIso } from '@/lib/datetime-local';
import { addDaysIso, formatDateTime, todayIso } from '@/lib/format';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useDocumentTitle } from '@/lib/use-document-title';

const SERVICE_LABEL = new Map<string, string>(AUDITED_SERVICES.map((s) => [s.value, s.label]));
const short = (id: string | null) => (id ? `${id.slice(0, 8)}…` : '—');

/** Trilha de auditoria de todos os serviços (quem fez o quê e quando). */
export function AuditPage() {
  useDocumentTitle('Auditoria');
  const [filters, setFilters] = useState({
    service: '',
    from: addDaysIso(todayIso(), -7),
    to: todayIso(),
    action: '',
    limit: '100',
  });
  const action = useDebouncedValue(filters.action.trim());
  const logs = useAuditLogs({
    service: filters.service,
    from: filters.from ? localDayBoundsIso(filters.from).start : undefined,
    to: filters.to ? localDayBoundsIso(filters.to).end : undefined,
    action,
    limit: filters.limit,
  });
  const set = (patch: Partial<typeof filters>) =>
    setFilters((current) => ({ ...current, ...patch }));

  return (
    <>
      <PageHeader
        title="Auditoria"
        description="Ações administrativas, acessos a dados sensíveis e eventos de segurança. Sem dados de saúde."
      />
      <FilterBar>
        <SelectField
          label="Serviço"
          className="w-52"
          placeholder="Todos"
          options={AUDITED_SERVICES}
          value={filters.service}
          onChange={(e) => set({ service: e.target.value })}
        />
        <TextField
          label="De"
          type="date"
          className="w-40"
          value={filters.from}
          onChange={(e) => set({ from: e.target.value })}
        />
        <TextField
          label="Até"
          type="date"
          className="w-40"
          value={filters.to}
          onChange={(e) => set({ to: e.target.value })}
        />
        <TextField
          label="Ação (começa com)"
          className="w-52"
          placeholder="ex.: stock."
          value={filters.action}
          onChange={(e) => set({ action: e.target.value })}
        />
        <SelectField
          label="Registros"
          className="w-32"
          options={['50', '100', '200', '500'].map((v) => ({ value: v, label: v }))}
          value={filters.limit}
          onChange={(e) => set({ limit: e.target.value })}
        />
      </FilterBar>
      <QueryState isLoading={logs.isLoading} error={logs.error} onRetry={() => logs.refetch()}>
        {logs.data && (
          <div className="space-y-4">
            <UnavailableAlert services={logs.data.unavailable} />
            {logs.data.items.length === 0 ? (
              <EmptyState
                icon={ScrollText}
                title="Nenhum registro no período"
                description="Ajuste os filtros."
              />
            ) : (
              <Table caption="Registros de auditoria">
                <THead>
                  <Tr>
                    <Th>Quando</Th>
                    <Th>Serviço</Th>
                    <Th>Ação</Th>
                    <Th>Registro</Th>
                    <Th>Quem</Th>
                    <Th>Requisição</Th>
                  </Tr>
                </THead>
                <TBody>
                  {logs.data.items.map((entry) => (
                    <Tr key={`${entry.service}-${entry.id}`} className="align-top">
                      <Td className="whitespace-nowrap">{formatDateTime(entry.createdAt)}</Td>
                      <Td>{SERVICE_LABEL.get(entry.service) ?? entry.service}</Td>
                      <Td>
                        <span className="block font-semibold">
                          {AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
                        </span>
                        <span className="font-mono text-xs text-ink-muted">{entry.action}</span>
                        {entry.metadata && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-xs font-semibold text-petroleo-700">
                              Detalhes
                            </summary>
                            <pre className="mt-1 max-w-sm overflow-x-auto rounded bg-canvas p-2 text-xs">
                              {JSON.stringify(entry.metadata, null, 2)}
                            </pre>
                          </details>
                        )}
                      </Td>
                      <Td>
                        {entry.entity}{' '}
                        <span className="font-mono text-xs text-ink-muted">
                          {short(entry.entityId)}
                        </span>
                      </Td>
                      <Td>
                        {entry.actorRole
                          ? (ROLE_LABELS[entry.actorRole as Role] ?? entry.actorRole)
                          : 'Sistema'}{' '}
                        <span className="font-mono text-xs text-ink-muted">
                          {short(entry.actorId)}
                        </span>
                      </Td>
                      <Td className="font-mono text-xs break-all">{entry.requestId ?? '—'}</Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            )}
          </div>
        )}
      </QueryState>
    </>
  );
}
