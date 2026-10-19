import { CircleCheck, CircleMinus, ClipboardCheck, type LucideIcon } from 'lucide-react';
import { DONATION_STATUS_LABELS, type DonorAttendanceView } from '@pulso/contracts';
import type { BadgeTone } from '@/components/ui';

export interface AttendanceOutcome {
  label: string;
  description: string;
  tone: BadgeTone;
  icon: LucideIcon;
}

/**
 * Como o doador vê o desfecho do atendimento: só fatos de comparecimento e doação.
 * O resultado e os valores da triagem profissional nunca aparecem (RN19).
 */
export function attendanceOutcome(attendance: DonorAttendanceView): AttendanceOutcome {
  switch (attendance.donation?.status) {
    case 'COMPLETED':
      return {
        label: DONATION_STATUS_LABELS.COMPLETED,
        description: 'Sua doação foi registrada pela equipe da unidade.',
        tone: 'ok',
        icon: CircleCheck,
      };
    case 'NOT_COMPLETED':
      return {
        label: DONATION_STATUS_LABELS.NOT_COMPLETED,
        description: 'Você compareceu, mas a doação não foi concluída neste dia.',
        tone: 'neutral',
        icon: CircleMinus,
      };
    default:
      return {
        label: 'Atendimento realizado',
        description: 'Você compareceu e foi atendido pela equipe de saúde.',
        tone: 'neutral',
        icon: ClipboardCheck,
      };
  }
}

export const isCompletedDonation = (attendance: DonorAttendanceView): boolean =>
  attendance.donation?.status === 'COMPLETED';
