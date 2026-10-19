import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { BOOKING_STEPS, type BookingStep } from './booking-logic';

interface StepperProps {
  current: BookingStep;
  /** Volta para uma etapa já concluída. */
  onSelect: (step: BookingStep) => void;
}

/** Etapas do agendamento. As concluídas viram botões para voltar e ajustar. */
export function Stepper({ current, onSelect }: StepperProps) {
  const currentIndex = BOOKING_STEPS.findIndex((step) => step.key === current);
  return (
    <nav aria-label="Etapas do agendamento" className="mb-6">
      <ol className="grid grid-cols-4 gap-1">
        {BOOKING_STEPS.map((step, index) => {
          const done = index < currentIndex;
          const isCurrent = index === currentIndex;
          const marker = (
            <>
              <span
                aria-hidden="true"
                className={cn(
                  'grid size-8 place-items-center rounded-full text-sm font-bold',
                  done && 'bg-petroleo-100 text-petroleo-800',
                  isCurrent && 'bg-petroleo-700 text-white',
                  !done && !isCurrent && 'border border-line-strong/50 bg-surface text-ink-muted',
                )}
              >
                {done ? <Check className="size-4" strokeWidth={3} /> : index + 1}
              </span>
              <span
                className={cn(
                  'text-xs sm:text-sm',
                  isCurrent ? 'font-semibold text-ink' : 'text-ink-muted',
                )}
              >
                {step.label}
                {done && <span className="sr-only"> (concluída, voltar)</span>}
              </span>
            </>
          );
          return (
            <li key={step.key} aria-current={isCurrent ? 'step' : undefined}>
              {done ? (
                <button
                  type="button"
                  onClick={() => onSelect(step.key)}
                  className="flex min-h-14 w-full flex-col items-center gap-1 rounded-control py-1 hover:bg-surface-muted"
                >
                  {marker}
                </button>
              ) : (
                <div className="flex min-h-14 flex-col items-center gap-1 py-1">{marker}</div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
