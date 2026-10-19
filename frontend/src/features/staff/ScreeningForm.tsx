import { useEffect, useId, useRef } from 'react';
import { useForm, type RegisterOptions } from 'react-hook-form';
import {
  SCREENING_RESULTS,
  SCREENING_RESULT_LABELS,
  type AnswerValue,
  type ScreeningFieldView,
  type ScreeningResult,
} from '@pulso/contracts';
import { SelectField, TextAreaField, TextField } from '@/components/form';
import { Button, Card, ProblemAlert } from '@/components/ui';
import { isApiError } from '@/lib/api';
import { useRecordScreening } from './api';

type FormValues = {
  values: Record<string, string>;
  result: ScreeningResult | '';
  notes: string;
};

/** Converte o texto do formulário no tipo do campo configurado. */
function toAnswer(field: ScreeningFieldView, raw: string): AnswerValue | undefined {
  if (raw === '') return undefined;
  if (field.type === 'NUMBER') return Number(raw.replace(',', '.'));
  if (field.type === 'BOOLEAN') return raw === 'true';
  return raw.trim();
}

type FieldRules = RegisterOptions<FormValues, `values.${string}`>;

function rulesFor(field: ScreeningFieldView): FieldRules {
  const rules: FieldRules = {};
  if (field.required) rules.required = `Informe ${field.label.toLowerCase()}.`;
  if (field.type === 'NUMBER') {
    rules.validate = (value: string) => {
      if (value === '' || value === undefined) return true;
      const number = Number(value.replace(',', '.'));
      if (!Number.isFinite(number)) return 'Informe um número.';
      if (field.min !== null && number < field.min) return `Confira o valor: mínimo ${field.min}.`;
      if (field.max !== null && number > field.max) return `Confira o valor: máximo ${field.max}.`;
      return true;
    };
  }
  return rules;
}

interface ScreeningFormProps {
  appointmentId: string;
  fields: ScreeningFieldView[];
}

/**
 * Triagem profissional com os campos configurados pela administração. Os limites
 * dos campos só evitam erro de digitação: o resultado é decisão do enfermeiro.
 */
export function ScreeningForm({ appointmentId, fields }: ScreeningFormProps) {
  const record = useRecordScreening();
  const resultGroupId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: { values: {}, result: '', notes: '' } });

  useEffect(() => headingRef.current?.focus(), []);

  const onSubmit = handleSubmit(async (form) => {
    const values: Record<string, AnswerValue> = {};
    for (const field of fields) {
      const answer = toAnswer(field, form.values[field.code] ?? '');
      if (answer !== undefined) values[field.code] = answer;
    }
    try {
      await record.mutateAsync({
        appointmentId,
        values,
        result: form.result as ScreeningResult,
        notes: form.notes.trim() || undefined,
      });
    } catch (error) {
      if (isApiError(error)) {
        for (const [field, message] of Object.entries(error.fieldErrors)) {
          if (field.startsWith('values.')) {
            setError(`values.${field.slice('values.'.length)}`, { type: 'server', message });
          }
        }
      }
    }
  });

  return (
    <Card as="section" aria-labelledby="triagem-titulo">
      <h2 id="triagem-titulo" ref={headingRef} tabIndex={-1} className="text-lg font-bold text-ink">
        Triagem
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Os limites dos campos servem só para evitar erros de digitação; não são critérios clínicos.
      </p>
      <form onSubmit={onSubmit} noValidate className="mt-5 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <ScreeningInput
              key={field.id}
              field={field}
              error={errors.values?.[field.code]?.message}
              registration={register(`values.${field.code}`, rulesFor(field))}
            />
          ))}
        </div>
        <fieldset aria-describedby={errors.result ? `${resultGroupId}-erro` : undefined}>
          <legend className="text-sm font-semibold text-ink">
            Resultado da triagem{' '}
            <span className="text-critical-strong" aria-hidden="true">
              *
            </span>
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {SCREENING_RESULTS.map((result) => (
              <label
                key={result}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-line bg-surface px-4 has-[:checked]:border-petroleo-700 has-[:checked]:bg-petroleo-50"
              >
                <input
                  type="radio"
                  value={result}
                  className="size-4 accent-petroleo-700"
                  {...register('result', { required: 'Escolha o resultado da triagem.' })}
                />
                <span className="text-sm font-semibold">{SCREENING_RESULT_LABELS[result]}</span>
              </label>
            ))}
          </div>
          {errors.result && (
            <p
              id={`${resultGroupId}-erro`}
              className="mt-1 text-sm font-medium text-critical-strong"
            >
              {errors.result.message}
            </p>
          )}
        </fieldset>
        <TextAreaField
          label="Observações (opcional)"
          hint="Guardadas cifradas; não aparecem para o doador."
          maxLength={500}
          {...register('notes', {
            maxLength: { value: 500, message: 'Use no máximo 500 caracteres.' },
          })}
          error={errors.notes?.message}
        />
        <ProblemAlert error={record.error} />
        <Button type="submit" loading={record.isPending}>
          Registrar triagem
        </Button>
      </form>
    </Card>
  );
}

function ScreeningInput({
  field,
  error,
  registration,
}: {
  field: ScreeningFieldView;
  error?: string;
  registration: ReturnType<ReturnType<typeof useForm<FormValues>>['register']>;
}) {
  const label = field.unit ? `${field.label} (${field.unit})` : field.label;
  const hint =
    field.helpText ??
    (field.type === 'NUMBER' && field.min !== null && field.max !== null
      ? `Entre ${field.min} e ${field.max}.`
      : undefined);
  if (field.type === 'BOOLEAN' || field.type === 'SELECT') {
    const options =
      field.type === 'BOOLEAN'
        ? [
            { value: 'true', label: 'Sim' },
            { value: 'false', label: 'Não' },
          ]
        : (field.options ?? []);
    return (
      <SelectField
        label={label}
        hint={hint}
        required={field.required}
        placeholder="Selecione"
        options={options}
        error={error}
        {...registration}
      />
    );
  }
  return (
    <TextField
      label={label}
      hint={hint}
      required={field.required}
      inputMode={field.type === 'NUMBER' ? 'decimal' : undefined}
      autoComplete="off"
      error={error}
      {...registration}
    />
  );
}
