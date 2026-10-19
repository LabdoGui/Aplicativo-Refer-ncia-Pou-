import type { ReactNode } from 'react';
import { CalendarDays, MapPin, type LucideIcon } from 'lucide-react';
import type { AppointmentView } from '@pulso/contracts';
import { longDate, timeRange } from './format';

/** Item de uma lista de detalhes com ícone (o rótulo fica só para leitores de tela). */
export function DetailItem({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd className="flex gap-3">
        <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-petroleo-700" />
        <div className="min-w-0">{children}</div>
      </dd>
    </div>
  );
}

/** Quando e onde: resumo compacto de um agendamento (início e tela de agendar). */
export function AppointmentSummary({ appointment }: { appointment: AppointmentView }) {
  const { unit } = appointment;
  return (
    <dl className="space-y-3">
      <DetailItem icon={CalendarDays} label="Data e horário">
        <p className="font-semibold text-ink">{longDate(appointment.startsAt)}</p>
        <p className="text-sm text-ink-muted">
          {timeRange(appointment.startsAt, appointment.endsAt)}
        </p>
      </DetailItem>
      <DetailItem icon={MapPin} label="Unidade">
        <p className="font-semibold text-ink">{unit.name}</p>
        <p className="text-sm text-ink-muted">
          {unit.address} · {unit.district}, {unit.city}
        </p>
      </DetailItem>
    </dl>
  );
}
