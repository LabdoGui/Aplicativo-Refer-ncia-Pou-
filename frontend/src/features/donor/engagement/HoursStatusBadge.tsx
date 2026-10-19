import { CircleCheck, CircleX, Clock, type LucideIcon } from 'lucide-react';
import { HOURS_STATUS_LABELS, type HoursStatus } from '@pulso/contracts';
import { Badge, type BadgeTone } from '@/components/ui';

export const HOURS_STATUS_STYLE: Record<HoursStatus, { tone: BadgeTone; icon: LucideIcon }> = {
  PENDING: { tone: 'warn', icon: Clock },
  APPROVED: { tone: 'ok', icon: CircleCheck },
  REJECTED: { tone: 'neutral', icon: CircleX },
};

/** Situação de um pedido de horas, com ícone + texto. */
export function HoursStatusBadge({ status }: { status: HoursStatus }) {
  const { tone, icon: Icon } = HOURS_STATUS_STYLE[status];
  return (
    <Badge tone={tone} icon={<Icon aria-hidden="true" className="size-3.5" strokeWidth={2.25} />}>
      {HOURS_STATUS_LABELS[status]}
    </Badge>
  );
}
