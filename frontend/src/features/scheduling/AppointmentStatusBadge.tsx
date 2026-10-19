import {
  CalendarCheck,
  CalendarClock,
  CalendarX,
  CircleCheck,
  CircleX,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';
import { APPOINTMENT_STATUS_LABELS, type AppointmentStatus } from '@pulso/contracts';
import { Badge, type BadgeTone } from '@/components/ui';

const PRESENTATION: Record<AppointmentStatus, { tone: BadgeTone; icon: LucideIcon }> = {
  BOOKED: { tone: 'info', icon: CalendarClock },
  CONFIRMED: { tone: 'ok', icon: CalendarCheck },
  CHECKED_IN: { tone: 'info', icon: UserCheck },
  COMPLETED: { tone: 'ok', icon: CircleCheck },
  CANCELLED: { tone: 'neutral', icon: CircleX },
  NO_SHOW: { tone: 'warn', icon: CalendarX },
};

/** Situação do agendamento: ícone + texto (nunca só a cor). */
export function AppointmentStatusBadge({
  status,
  className,
}: {
  status: AppointmentStatus;
  className?: string;
}) {
  const { tone, icon: Icon } = PRESENTATION[status];
  return (
    <Badge
      tone={tone}
      className={className}
      icon={<Icon aria-hidden="true" className="size-3.5" strokeWidth={2.25} />}
    >
      {APPOINTMENT_STATUS_LABELS[status]}
    </Badge>
  );
}
