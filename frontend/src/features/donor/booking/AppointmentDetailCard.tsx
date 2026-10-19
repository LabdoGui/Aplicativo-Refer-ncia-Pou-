import { CalendarDays, MapPin, Megaphone, Phone } from 'lucide-react';
import type { AppointmentView } from '@pulso/contracts';
import { Card } from '@/components/ui';
import { AppointmentStatusBadge } from '@/features/scheduling/AppointmentStatusBadge';
import { DetailItem } from './AppointmentSummary';
import { longDate, timeRange } from './format';
import { telHref } from './phone';

/** Dados do agendamento: situação, código, quando, onde e campanha. */
export function AppointmentDetailCard({ appointment }: { appointment: AppointmentView }) {
  const { unit } = appointment;
  return (
    <Card as="section" aria-labelledby="dados-agendamento">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="dados-agendamento" className="text-lg font-bold text-ink">
          Detalhes
        </h2>
        <AppointmentStatusBadge status={appointment.status} />
      </div>
      <dl className="mt-5 space-y-4">
        <DetailItem icon={CalendarDays} label="Data e horário">
          <p className="text-lg font-semibold text-ink">{longDate(appointment.startsAt)}</p>
          <p className="text-ink-muted">{timeRange(appointment.startsAt, appointment.endsAt)}</p>
        </DetailItem>
        <DetailItem icon={MapPin} label="Unidade">
          <p className="font-semibold text-ink">{unit.name}</p>
          <p className="text-sm text-ink-muted">
            {unit.address} · {unit.district}, {unit.city}
          </p>
        </DetailItem>
        {unit.phone && (
          <DetailItem icon={Phone} label="Telefone da unidade">
            <a
              href={telHref(unit.phone)}
              className="inline-flex min-h-11 items-center font-semibold text-petroleo-700 underline underline-offset-2"
            >
              {unit.phone}
            </a>
          </DetailItem>
        )}
        {appointment.campaign && (
          <DetailItem icon={Megaphone} label="Campanha">
            <p className="text-ink">
              Campanha <span className="font-semibold">{appointment.campaign.title}</span>
            </p>
          </DetailItem>
        )}
      </dl>
      <p className="mt-5 border-t border-line pt-4 text-sm text-ink-muted">
        Código do agendamento:{' '}
        <span className="font-mono font-semibold text-ink">{appointment.code}</span>
      </p>
    </Card>
  );
}
