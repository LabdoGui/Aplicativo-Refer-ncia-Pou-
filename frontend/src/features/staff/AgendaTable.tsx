import { ClipboardList, UserCheck, UserX } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AgendaItem } from '@pulso/contracts';
import { Badge, Button, buttonStyles, Table, TBody, Td, Th, THead, Tr } from '@/components/ui';
import { AppointmentStatusBadge } from '@/features/scheduling/AppointmentStatusBadge';
import { formatTime } from '@/lib/format';

interface AgendaTableProps {
  items: AgendaItem[];
  /** Link de volta para a agenda com a mesma unidade e dia. */
  attendancePath: (appointmentId: string) => string;
  pendingId: string | null;
  onCheckIn: (item: AgendaItem) => void;
  onNoShow: (item: AgendaItem) => void;
}

const isOpen = (item: AgendaItem) => item.status === 'BOOKED' || item.status === 'CONFIRMED';

/** Atendimentos do dia em ordem de horário, com as ações da recepção. */
export function AgendaTable({
  items,
  attendancePath,
  pendingId,
  onCheckIn,
  onNoShow,
}: AgendaTableProps) {
  const now = Date.now();
  return (
    <Table caption="Atendimentos do dia">
      <THead>
        <Tr>
          <Th>Horário</Th>
          <Th>Doador</Th>
          <Th>Situação</Th>
          <Th className="text-right">Ações</Th>
        </Tr>
      </THead>
      <TBody>
        {items.map((item) => {
          const started = Date.parse(item.startsAt) <= now;
          return (
            <Tr key={item.appointmentId}>
              <Td className="font-semibold tabular-nums">{formatTime(item.startsAt)}</Td>
              <Td>
                <span className="block font-semibold">{item.donor.name}</span>
                <span className="block text-xs text-ink-muted">
                  {item.donor.donorCode ?? 'Sem código'} · {item.code}
                </span>
                {item.campaign && (
                  <Badge tone="brand" className="mt-1">
                    {item.campaign.title}
                  </Badge>
                )}
              </Td>
              <Td>
                <AppointmentStatusBadge status={item.status} />
              </Td>
              <Td>
                <div className="flex flex-wrap justify-end gap-2">
                  {isOpen(item) && (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={pendingId === item.appointmentId}
                      onClick={() => onCheckIn(item)}
                      aria-label={`Fazer check-in de ${item.donor.name}`}
                    >
                      <UserCheck aria-hidden="true" className="size-4" /> Check-in
                    </Button>
                  )}
                  {isOpen(item) && started && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onNoShow(item)}
                      aria-label={`Registrar falta de ${item.donor.name}`}
                    >
                      <UserX aria-hidden="true" className="size-4" /> Falta
                    </Button>
                  )}
                  <Link
                    to={attendancePath(item.appointmentId)}
                    className={buttonStyles({ variant: 'outline', size: 'sm' })}
                    aria-label={`Abrir atendimento de ${item.donor.name}`}
                  >
                    <ClipboardList aria-hidden="true" className="size-4" /> Abrir
                  </Link>
                </div>
              </Td>
            </Tr>
          );
        })}
      </TBody>
    </Table>
  );
}
