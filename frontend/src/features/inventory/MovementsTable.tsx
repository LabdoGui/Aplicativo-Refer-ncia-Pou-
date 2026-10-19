import { useState } from 'react';
import { ArrowDownUp } from 'lucide-react';
import {
  BLOOD_TYPES,
  BLOOD_TYPE_LABELS,
  MOVEMENT_REASONS,
  MOVEMENT_TYPE_LABELS,
} from '@pulso/contracts';
import { SelectField } from '@/components/form';
import {
  Badge,
  EmptyState,
  Pagination,
  QueryState,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { useMovements } from './api';

/** Histórico de movimentações com filtros. */
export function MovementsTable() {
  const [bloodType, setBloodType] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const movements = useMovements({ bloodType, type, page });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <SelectField
          label="Tipo sanguíneo"
          className="w-44"
          placeholder="Todos"
          value={bloodType}
          options={BLOOD_TYPES.map((t) => ({ value: t, label: BLOOD_TYPE_LABELS[t] }))}
          onChange={(e) => {
            setBloodType(e.target.value);
            setPage(1);
          }}
        />
        <SelectField
          label="Movimentação"
          className="w-56"
          placeholder="Entradas e saídas"
          value={type}
          options={(['IN', 'OUT'] as const).map((t) => ({
            value: t,
            label: MOVEMENT_TYPE_LABELS[t],
          }))}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
        />
      </div>
      <QueryState
        isLoading={movements.isLoading}
        error={movements.error}
        onRetry={() => movements.refetch()}
      >
        {movements.data && movements.data.items.length === 0 ? (
          <EmptyState
            icon={ArrowDownUp}
            title="Nenhuma movimentação"
            description="Ajuste os filtros ou registre uma movimentação."
          />
        ) : (
          movements.data && (
            <>
              <Table caption="Movimentações do estoque">
                <THead>
                  <Tr>
                    <Th>Data</Th>
                    <Th>Movimentação</Th>
                    <Th>Tipo</Th>
                    <Th className="text-right">Bolsas</Th>
                    <Th>Motivo</Th>
                    <Th>Responsável</Th>
                    <Th className="text-right">Saldo após</Th>
                  </Tr>
                </THead>
                <TBody>
                  {movements.data.items.map((movement) => (
                    <Tr key={movement.id}>
                      <Td className="whitespace-nowrap">{formatDateTime(movement.occurredAt)}</Td>
                      <Td>
                        <Badge tone={movement.type === 'IN' ? 'ok' : 'neutral'}>
                          {movement.type === 'IN' ? '↑' : '↓'} {MOVEMENT_TYPE_LABELS[movement.type]}
                        </Badge>
                      </Td>
                      <Td className="font-semibold">{BLOOD_TYPE_LABELS[movement.bloodType]}</Td>
                      <Td className="text-right tabular-nums">{movement.quantity}</Td>
                      <Td>
                        {MOVEMENT_REASONS[movement.reason].label}
                        {movement.notes && (
                          <span className="block text-xs text-ink-muted">{movement.notes}</span>
                        )}
                      </Td>
                      <Td>{movement.responsibleName}</Td>
                      <Td className="text-right tabular-nums">{movement.balanceAfter}</Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
              <Pagination
                page={page}
                pageSize={movements.data.pageSize}
                total={movements.data.total}
                onPageChange={setPage}
              />
            </>
          )
        )}
      </QueryState>
    </div>
  );
}
