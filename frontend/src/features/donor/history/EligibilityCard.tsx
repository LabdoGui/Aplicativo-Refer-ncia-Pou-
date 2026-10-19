import type { ReactNode } from 'react';
import { CalendarClock } from 'lucide-react';
import { Button, Spinner } from '@/components/ui';
import { useEligibility } from '@/features/donor/api';
import { cn } from '@/lib/cn';
import { formatDate, todayIso } from '@/lib/format';

interface EligibilityCardProps {
  /** Ação opcional exibida quando a data informativa já chegou (ex.: link para agendar). */
  actionWhenAvailable?: ReactNode;
  className?: string;
}

/**
 * Data informativa da próxima doação (RN04). Só orienta: quem confirma é a equipe na
 * triagem presencial, e o intervalo segue pendente de validação enquanto a API disser.
 */
export function EligibilityCard({ actionWhenAvailable, className }: EligibilityCardProps) {
  const eligibility = useEligibility();
  const data = eligibility.data;
  const available = data?.nextEligibleAt ? data.nextEligibleAt <= todayIso() : false;

  return (
    <section
      aria-labelledby="proxima-doacao"
      className={cn('rounded-card border border-line bg-surface p-5 shadow-card', className)}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id="proxima-doacao" className="font-sans text-sm font-medium text-ink-muted">
          Próxima doação
        </h2>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-petroleo-50 text-petroleo-700">
          <CalendarClock aria-hidden="true" className="size-5" />
        </span>
      </div>

      {eligibility.isLoading ? (
        <Spinner label="Carregando…" className="mt-3 text-sm text-ink-muted" />
      ) : eligibility.error || !data ? (
        <div className="mt-2 space-y-2 text-sm text-ink-muted">
          <p>Não foi possível carregar a data informativa agora.</p>
          <Button variant="ghost" size="sm" onClick={() => eligibility.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : data.nextEligibleAt ? (
        <>
          <p className="mt-2 font-display text-2xl font-bold text-ink">
            A partir de {formatDate(data.nextEligibleAt)}
          </p>
          <p className="mt-1 text-sm text-ink">
            {available
              ? 'Pela data informativa, você já pode agendar uma nova doação.'
              : data.source === 'PRE_SCREENING'
                ? 'Indicada pelas respostas da sua pré-triagem, como a data da última doação que você informou.'
                : `Calculada a partir da sua última doação, com intervalo de ${data.intervalDays} dias.`}
          </p>
          <EligibilityNote pending={data.validationStatus === 'PENDING_VALIDATION'} />
          {available && actionWhenAvailable && <div className="mt-4">{actionWhenAvailable}</div>}
        </>
      ) : (
        <>
          <p className="mt-2 font-display text-2xl font-bold text-ink">Sem data definida</p>
          <p className="mt-1 text-sm text-ink">
            A data aparece aqui depois da sua primeira doação concluída.
          </p>
        </>
      )}
    </section>
  );
}

function EligibilityNote({ pending }: { pending: boolean }) {
  return (
    <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-ink-muted">
      Data informativa{pending ? ', pendente de validação por profissional de saúde' : ''}. Quem
      confirma se você pode doar é a equipe, na triagem presencial.
    </p>
  );
}
