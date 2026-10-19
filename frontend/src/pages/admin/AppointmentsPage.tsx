import { useState } from 'react';
import { CalendarSearch } from 'lucide-react';
import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS_LABELS,
  type AdminAppointmentItem,
} from '@pulso/contracts';
import { SelectField, TextAreaField, TextField } from '@/components/form';
import {
  Badge,
  Button,
  Dialog,
  EmptyState,
  PageHeader,
  Pagination,
  ProblemAlert,
  QueryState,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '@/components/ui';
import { FilterBar } from '@/features/admin/FilterBar';
import { unitOptions, useAllUnits } from '@/features/admin/units';
import { useAdminAppointments, useAdminCancelAppointment } from '@/features/admin-ops/api';
import { AppointmentStatusBadge } from '@/features/scheduling/AppointmentStatusBadge';
import { addDaysIso, formatDate, formatTime, todayIso } from '@/lib/format';
import { useDocumentTitle } from '@/lib/use-document-title';

/** Agendamentos de todas as unidades, com filtros e cancelamento pela unidade. */
export function AppointmentsPage() {
  useDocumentTitle('Agendamentos');
  const units = useAllUnits();
  const [filters, setFilters] = useState({
    unitId: '',
    status: '',
    from: todayIso(),
    to: addDaysIso(todayIso(), 30),
  });
  const [page, setPage] = useState(1);
  const appointments = useAdminAppointments({ ...filters, page });
  const [target, setTarget] = useState<AdminAppointmentItem | null>(null);

  const update = (changes: Partial<typeof filters>) => {
    setFilters((current) => ({ ...current, ...changes }));
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title="Agendamentos"
        description="Consulte os agendamentos das unidades e cancele quando necessário."
      />
      <FilterBar>
        <SelectField
          label="Unidade"
          className="w-60"
          placeholder="Todas"
          options={unitOptions(units.data)}
          value={filters.unitId}
          onChange={(e) => update({ unitId: e.target.value })}
        />
        <SelectField
          label="Situação"
          className="w-48"
          placeholder="Todas"
          options={APPOINTMENT_STATUSES.map((s) => ({
            value: s,
            label: APPOINTMENT_STATUS_LABELS[s],
          }))}
          value={filters.status}
          onChange={(e) => update({ status: e.target.value })}
        />
        <TextField
          label="De"
          type="date"
          className="w-40"
          value={filters.from}
          onChange={(e) => update({ from: e.target.value })}
        />
        <TextField
          label="Até"
          type="date"
          className="w-40"
          value={filters.to}
          onChange={(e) => update({ to: e.target.value })}
        />
      </FilterBar>
      <QueryState
        isLoading={appointments.isLoading}
        error={appointments.error}
        onRetry={() => appointments.refetch()}
      >
        {appointments.data && appointments.data.items.length === 0 ? (
          <EmptyState
            icon={CalendarSearch}
            title="Nenhum agendamento encontrado"
            description="Ajuste os filtros para ver outros períodos ou unidades."
          />
        ) : (
          appointments.data && (
            <>
              <Table caption="Agendamentos">
                <THead>
                  <Tr>
                    <Th>Data e hora</Th>
                    <Th>Código</Th>
                    <Th>Doador</Th>
                    <Th>Unidade</Th>
                    <Th>Situação</Th>
                    <Th className="text-right">Ação</Th>
                  </Tr>
                </THead>
                <TBody>
                  {appointments.data.items.map((item) => (
                    <Tr key={item.appointmentId}>
                      <Td className="whitespace-nowrap">
                        {formatDate(item.startsAt)} · {formatTime(item.startsAt)}
                      </Td>
                      <Td className="font-mono text-xs">{item.code}</Td>
                      <Td>
                        <span className="block font-semibold">{item.donor.name}</span>
                        <span className="text-xs text-ink-muted">
                          {item.donor.donorCode ?? '—'}
                        </span>
                        {item.campaign && (
                          <Badge tone="brand" className="mt-1 block w-fit">
                            {item.campaign.title}
                          </Badge>
                        )}
                      </Td>
                      <Td>{item.unit.name}</Td>
                      <Td>
                        <AppointmentStatusBadge status={item.status} />
                      </Td>
                      <Td className="text-right">
                        {(item.status === 'BOOKED' || item.status === 'CONFIRMED') && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setTarget(item)}
                            aria-label={`Cancelar agendamento ${item.code}`}
                          >
                            Cancelar
                          </Button>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
              <Pagination
                page={page}
                pageSize={appointments.data.pageSize}
                total={appointments.data.total}
                onPageChange={setPage}
              />
            </>
          )
        )}
      </QueryState>
      <CancelDialog target={target} onClose={() => setTarget(null)} />
    </>
  );
}

function CancelDialog({
  target,
  onClose,
}: {
  target: AdminAppointmentItem | null;
  onClose: () => void;
}) {
  const cancel = useAdminCancelAppointment();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const invalid = reason.trim().length < 3;
  const close = () => {
    setReason('');
    setTouched(false);
    cancel.reset();
    onClose();
  };
  return (
    <Dialog
      open={target !== null}
      onClose={close}
      title="Cancelar agendamento?"
      description={
        target &&
        `${target.donor.name} · ${formatDate(target.startsAt)} às ${formatTime(target.startsAt)}. O doador será avisado e a vaga volta a ficar livre.`
      }
      actions={
        <>
          <Button variant="ghost" onClick={close}>
            Voltar
          </Button>
          <Button
            variant="danger"
            loading={cancel.isPending}
            onClick={() => {
              setTouched(true);
              if (!invalid && target)
                cancel.mutate(
                  { id: target.appointmentId, reason: reason.trim() },
                  { onSuccess: close },
                );
            }}
          >
            Cancelar agendamento
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <TextAreaField
          label="Motivo"
          required
          maxLength={200}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          error={touched && invalid ? 'Informe o motivo (mínimo de 3 caracteres).' : undefined}
          hint="Fica registrado na auditoria. Não descreva dados de saúde."
        />
        <ProblemAlert error={cancel.error} />
      </div>
    </Dialog>
  );
}
