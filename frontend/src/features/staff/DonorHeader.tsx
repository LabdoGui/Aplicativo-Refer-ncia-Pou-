import { UserCheck } from 'lucide-react';
import { BLOOD_TYPE_LABELS, type StaffAppointmentView } from '@pulso/contracts';
import { Badge, Button, Card } from '@/components/ui';
import { AppointmentStatusBadge } from '@/features/scheduling/AppointmentStatusBadge';
import { formatLongDate, formatTime } from '@/lib/format';
import { canCheckInOn } from './AgendaTable';

interface DonorHeaderProps {
  appointment: StaffAppointmentView;
  canCheckIn: boolean;
  /** Tipo sanguíneo declarado: só para a enfermagem (a API não o envia aos demais). */
  showBloodType: boolean;
  checkingIn: boolean;
  onCheckIn: () => void;
}

/** Quem é o doador e qual é o agendamento (sem dados clínicos). */
export function DonorHeader({
  appointment,
  canCheckIn,
  showBloodType,
  checkingIn,
  onCheckIn,
}: DonorHeaderProps) {
  const donor = appointment.donorSummary;
  const open =
    (appointment.status === 'BOOKED' || appointment.status === 'CONFIRMED') &&
    canCheckInOn(appointment.startsAt, appointment.earlyCheckInAllowed);
  return (
    <Card as="section" aria-labelledby="doador-titulo" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold tracking-wide text-petroleo-700 uppercase">Doador</p>
          <h2 id="doador-titulo" className="text-xl font-bold text-ink">
            {donor.name}
          </h2>
          <p className="text-sm text-ink-muted">Código {donor.donorCode}</p>
        </div>
        <AppointmentStatusBadge status={appointment.status} />
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-ink-muted">Idade</dt>
          <dd className="font-semibold text-ink">
            {donor.age !== null ? `${donor.age} anos` : '—'}
          </dd>
        </div>
        {showBloodType && (
          <div>
            <dt className="text-ink-muted">Tipo sanguíneo declarado</dt>
            <dd className="font-semibold text-ink">
              {donor.declaredBloodType
                ? BLOOD_TYPE_LABELS[donor.declaredBloodType]
                : 'Não informado'}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-ink-muted">Horário</dt>
          <dd className="font-semibold text-ink">
            {formatTime(appointment.startsAt)} · {formatLongDate(appointment.startsAt)}
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">Unidade</dt>
          <dd className="font-semibold text-ink">{appointment.unit.name}</dd>
        </div>
      </dl>
      {appointment.campaign && <Badge tone="brand">Campanha: {appointment.campaign.title}</Badge>}
      {showBloodType && (
        <p className="text-xs text-ink-muted">
          O tipo sanguíneo acima foi informado pelo próprio doador e não é laudo.
        </p>
      )}
      {open && canCheckIn && (
        <Button variant="secondary" loading={checkingIn} onClick={onCheckIn}>
          <UserCheck aria-hidden="true" className="size-4" /> Fazer check-in
        </Button>
      )}
    </Card>
  );
}
