import type { DonorAttendanceView } from '@pulso/contracts';
import { Badge } from '@/components/ui';
import { attendanceOutcome } from './outcome';

/** Desfecho do atendimento com ícone + texto (nunca só a cor). */
export function OutcomeBadge({ attendance }: { attendance: DonorAttendanceView }) {
  const { label, tone, icon: Icon } = attendanceOutcome(attendance);
  return (
    <Badge tone={tone} icon={<Icon aria-hidden="true" className="size-3.5" strokeWidth={2.25} />}>
      {label}
    </Badge>
  );
}
