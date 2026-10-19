import type { AvailabilityDay } from '@pulso/contracts';
import { dayParts, longDate } from './format';
import { isDayFull } from './booking-logic';
import { OptionTile } from './OptionTile';

interface DateStepProps {
  days: AvailabilityDay[];
  value: string | undefined;
  onChange: (date: string) => void;
  error?: string;
}

/** Dias com horários na grade; dias sem vaga aparecem como "Lotado" (desativados). */
export function DateStep({ days, value, onChange, error }: DateStepProps) {
  return (
    <fieldset aria-describedby={error ? 'dia-erro' : undefined}>
      <legend className="sr-only">Dias disponíveis</legend>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-7">
        {days.map((day) => {
          const full = isDayFull(day);
          const { weekday, day: dayNumber, month } = dayParts(day.date);
          return (
            <OptionTile
              key={day.date}
              name="dia"
              value={day.date}
              checked={day.date === value}
              disabled={full}
              ariaLabel={`${longDate(day.date)}${full ? ', lotado' : ''}`}
              onSelect={onChange}
            >
              <span aria-hidden="true" className="text-xs font-medium uppercase">
                {weekday}
              </span>
              <span aria-hidden="true" className="font-display text-xl leading-tight font-bold">
                {dayNumber}
              </span>
              <span aria-hidden="true" className="text-xs">
                {full ? 'Lotado' : month}
              </span>
            </OptionTile>
          );
        })}
      </div>
      {error && (
        <p id="dia-erro" role="alert" className="mt-3 text-sm font-medium text-critical-strong">
          {error}
        </p>
      )}
    </fieldset>
  );
}
