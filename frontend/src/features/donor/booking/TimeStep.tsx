import type { AvailabilitySlot } from '@pulso/contracts';
import { formatTime } from '@/lib/format';
import { vacancyLabel } from './booking-logic';
import { OptionTile } from './OptionTile';

interface TimeStepProps {
  slots: AvailabilitySlot[];
  value: string | undefined;
  onChange: (startsAt: string) => void;
  error?: string;
  /** Início do agendamento atual (reagendamento): não pode ser escolhido de novo. */
  currentStartsAt?: string;
}

/** Horários do dia com as vagas restantes; lotados ficam desativados. */
export function TimeStep({ slots, value, onChange, error, currentStartsAt }: TimeStepProps) {
  return (
    <fieldset aria-describedby={error ? 'horario-erro' : undefined}>
      <legend className="sr-only">Horários disponíveis</legend>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {slots.map((slot) => {
          const isCurrent = slot.startsAt === currentStartsAt;
          const status = isCurrent ? 'Horário atual' : vacancyLabel(slot);
          return (
            <OptionTile
              key={slot.startsAt}
              name="horario"
              value={slot.startsAt}
              checked={slot.startsAt === value}
              disabled={slot.remaining <= 0 || isCurrent}
              ariaLabel={`${formatTime(slot.startsAt)}, ${status.toLowerCase()}`}
              onSelect={onChange}
            >
              <span aria-hidden="true" className="font-display text-lg leading-tight font-bold">
                {formatTime(slot.startsAt)}
              </span>
              <span aria-hidden="true" className="text-xs">
                {status}
              </span>
            </OptionTile>
          );
        })}
      </div>
      {error && (
        <p id="horario-erro" role="alert" className="mt-3 text-sm font-medium text-critical-strong">
          {error}
        </p>
      )}
    </fieldset>
  );
}
