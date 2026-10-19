import { useId } from 'react';
import type { PreScreeningQuestion } from '@pulso/contracts';
import { TextField } from '@/components/form';
import { cn } from '@/lib/cn';
import { todayIso } from '@/lib/format';
import type { DraftValue } from './questionnaire-logic';

interface QuestionFieldProps {
  question: PreScreeningQuestion;
  value: DraftValue | undefined;
  error?: string;
  onChange: (value: DraftValue) => void;
}

const YES_NO = [
  { value: 'true', label: 'Sim' },
  { value: 'false', label: 'Não' },
];

/** Campo de uma pergunta conforme o tipo (sim/não, opção única, número ou data). */
export function QuestionField({ question, value, error, onChange }: QuestionFieldProps) {
  const label = question.required ? question.text : `${question.text} (opcional)`;
  switch (question.type) {
    case 'BOOLEAN':
      return (
        <ChoiceGroup
          question={question}
          legend={label}
          options={YES_NO}
          value={typeof value === 'boolean' ? String(value) : undefined}
          error={error}
          onChange={(next) => onChange(next === 'true')}
        />
      );
    case 'SINGLE_CHOICE':
      return (
        <ChoiceGroup
          question={question}
          legend={label}
          options={question.options ?? []}
          value={typeof value === 'string' ? value : undefined}
          error={error}
          onChange={onChange}
        />
      );
    case 'NUMBER':
    case 'DATE': {
      const isNumber = question.type === 'NUMBER';
      return (
        <div data-question={question.code}>
          <TextField
            label={label}
            hint={question.helpText ?? undefined}
            error={error}
            className="max-w-xs"
            type={isNumber ? 'number' : 'date'}
            inputMode={isNumber ? 'decimal' : undefined}
            step={isNumber ? 'any' : undefined}
            min={isNumber ? undefined : '1900-01-01'}
            max={isNumber ? undefined : todayIso()}
            value={typeof value === 'string' ? value : ''}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      );
    }
  }
}

interface ChoiceGroupProps {
  question: PreScreeningQuestion;
  legend: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  value: string | undefined;
  error?: string;
  onChange: (value: string) => void;
}

/** Grupo de opções com fieldset/legend e alvos de toque largos. */
function ChoiceGroup({ question, legend, options, value, error, onChange }: ChoiceGroupProps) {
  const id = useId();
  const helpId = question.helpText ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <fieldset
      data-question={question.code}
      aria-describedby={[helpId, errorId].filter(Boolean).join(' ') || undefined}
    >
      <legend className="text-base font-semibold text-ink">{legend}</legend>
      {question.helpText && (
        <p id={helpId} className="mt-1 text-sm text-ink-muted">
          {question.helpText}
        </p>
      )}
      <div
        className={cn(
          'mt-3 grid gap-3',
          options.length === 2 ? 'grid-cols-2 sm:max-w-sm' : 'sm:grid-cols-2',
        )}
      >
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              'flex min-h-12 cursor-pointer items-center gap-3 rounded-control border bg-surface px-4 py-2 transition-colors',
              'hover:border-petroleo-400 has-[:checked]:border-petroleo-700 has-[:checked]:bg-petroleo-50',
              error ? 'border-critical' : 'border-line-strong/50',
            )}
          >
            <input
              type="radio"
              name={`${id}-${question.code}`}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              aria-invalid={error ? true : undefined}
              className="size-5 shrink-0 accent-petroleo-700"
            />
            <span className="font-medium text-ink">{option.label}</span>
          </label>
        ))}
      </div>
      {error && (
        <p id={errorId} className="mt-2 text-sm font-medium text-critical-strong">
          {error}
        </p>
      )}
    </fieldset>
  );
}
