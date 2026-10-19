import { CalendarClock } from 'lucide-react';
import type { EligibilityView } from '@pulso/contracts';
import { formatDate, todayIso } from '@/lib/format';
import { cn } from '@/lib/cn';

/** A data informativa ainda está no futuro (RN04: só orienta, nunca bloqueia). */
export function isBeforeNextEligible(
  eligibility: EligibilityView | undefined,
  date = todayIso(),
): eligibility is EligibilityView & { nextEligibleAt: string } {
  return Boolean(eligibility?.nextEligibleAt && date < eligibility.nextEligibleAt.slice(0, 10));
}

/** Origem da data: intervalo configurado, com o estado da validação clínica (RN04/RN08). */
export function eligibilitySource(eligibility: EligibilityView): string {
  const pending = eligibility.validationStatus === 'PENDING_VALIDATION';
  if (eligibility.source === 'PRE_SCREENING') {
    return (
      'Indicada pelas respostas da sua pré-triagem (como a data da última doação que você informou).' +
      ' Não impede o agendamento: a equipe confirma no atendimento presencial.'
    );
  }
  return (
    `Calculada com o intervalo de ${eligibility.intervalDays} dias configurado no sistema` +
    (pending ? ', ainda pendente de validação por profissional de saúde.' : '.') +
    ' Não impede o agendamento: a equipe confirma no atendimento presencial.'
  );
}

/** Nota da próxima data informativa de doação (só aparece se ela estiver no futuro). */
export function EligibilityNote({
  eligibility,
  className,
}: {
  eligibility: EligibilityView | undefined;
  className?: string;
}) {
  if (!isBeforeNextEligible(eligibility)) return null;
  return (
    <div className={cn('flex gap-3 rounded-control bg-petroleo-50 p-4', className)}>
      <CalendarClock aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-petroleo-700" />
      <div>
        <p className="font-semibold text-ink">
          Data informativa para a próxima doação: {formatDate(eligibility.nextEligibleAt)}
        </p>
        <p className="mt-1 text-sm text-ink-muted">{eligibilitySource(eligibility)}</p>
      </div>
    </div>
  );
}
