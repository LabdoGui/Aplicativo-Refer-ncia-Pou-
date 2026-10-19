import { cn } from '@/lib/cn';

/** "Etapa X de N" com barra segmentada acessível. */
export function StepProgress({ current, total }: { current: number; total: number }) {
  return (
    <div>
      <p className="text-sm font-semibold text-petroleo-700" aria-hidden="true">
        Etapa {current} de {total}
      </p>
      <div
        role="progressbar"
        aria-label="Progresso da pré-triagem"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current}
        aria-valuetext={`Etapa ${current} de ${total}`}
        className="mt-2 grid gap-1"
        style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={cn(
              'h-1.5 rounded-full',
              index < current ? 'bg-petroleo-600' : 'bg-surface-muted',
            )}
          />
        ))}
      </div>
    </div>
  );
}
