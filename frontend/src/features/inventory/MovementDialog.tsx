import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  BLOOD_TYPES,
  BLOOD_TYPE_LABELS,
  MOVEMENT_REASONS,
  MOVEMENT_REASON_CODES,
  MOVEMENT_TYPE_LABELS,
  type BloodType,
  type MovementReason,
  type MovementType,
  type MovementView,
} from '@pulso/contracts';
import { applyApiFieldErrors, SelectField, TextAreaField, TextField } from '@/components/form';
import { Button, Dialog, ProblemAlert, SegmentedControl } from '@/components/ui';
import { isoToLocalInput, localInputToIso } from '@/lib/datetime-local';
import { useCreateMovement } from './api';

type FormValues = {
  type: MovementType;
  bloodType: BloodType | '';
  quantity: string;
  reason: MovementReason | '';
  notes: string;
  occurredAt: string;
};

const EMPTY: FormValues = {
  type: 'IN',
  bloodType: '',
  quantity: '',
  reason: '',
  notes: '',
  occurredAt: '',
};

interface MovementDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: (movement: MovementView) => void;
}

/** Entrada ou saída de bolsas (RN10: o estoque só muda por movimentações). */
export function MovementDialog({ open, onClose, onSaved }: MovementDialogProps) {
  const create = useCreateMovement();
  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: EMPTY });
  const type = watch('type');
  const reasons = MOVEMENT_REASON_CODES.filter((code) => MOVEMENT_REASONS[code].type === type);

  useEffect(() => {
    if (open) {
      reset(EMPTY);
      create.reset();
    }
  }, [open]);

  const now = isoToLocalInput(new Date());
  const minDate = isoToLocalInput(new Date(Date.now() - 30 * 86_400_000));

  const onSubmit = handleSubmit(async (form) => {
    try {
      const movement = await create.mutateAsync({
        type: form.type,
        bloodType: form.bloodType as BloodType,
        quantity: Number(form.quantity),
        reason: form.reason as MovementReason,
        notes: form.notes.trim() || undefined,
        occurredAt: form.occurredAt ? localInputToIso(form.occurredAt) : undefined,
      });
      onSaved(movement);
    } catch (error) {
      applyApiFieldErrors(error, setError, [
        'bloodType',
        'quantity',
        'reason',
        'notes',
        'occurredAt',
      ]);
    }
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Registrar movimentação"
      description="Doações registradas não entram sozinhas no estoque: a bolsa passa por processamento e é lançada aqui como entrada."
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="movement-form" loading={create.isPending}>
            Registrar {MOVEMENT_TYPE_LABELS[type].toLowerCase()}
          </Button>
        </>
      }
    >
      <form id="movement-form" onSubmit={onSubmit} noValidate className="space-y-4">
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <SegmentedControl
              label="Tipo de movimentação"
              value={field.value}
              options={(['IN', 'OUT'] as const).map((value) => ({
                value,
                label: MOVEMENT_TYPE_LABELS[value],
              }))}
              onChange={(value) => {
                field.onChange(value);
                setValue('reason', '');
              }}
            />
          )}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Tipo sanguíneo"
            required
            placeholder="Selecione"
            options={BLOOD_TYPES.map((t) => ({ value: t, label: BLOOD_TYPE_LABELS[t] }))}
            error={errors.bloodType?.message}
            {...register('bloodType', { required: 'Escolha o tipo sanguíneo.' })}
          />
          <TextField
            label="Quantidade (bolsas)"
            required
            inputMode="numeric"
            error={errors.quantity?.message}
            {...register('quantity', {
              required: 'Informe a quantidade.',
              validate: (v) =>
                (Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 10_000) ||
                'Use um número inteiro de 1 a 10.000.',
            })}
          />
        </div>
        <SelectField
          label="Motivo"
          required
          placeholder="Selecione"
          options={reasons.map((code) => ({ value: code, label: MOVEMENT_REASONS[code].label }))}
          error={errors.reason?.message}
          {...register('reason', { required: 'Escolha o motivo.' })}
        />
        <TextField
          label="Data e hora (opcional)"
          type="datetime-local"
          min={minDate}
          max={now}
          hint="Deixe em branco para agora. Até 30 dias atrás."
          error={errors.occurredAt?.message}
          {...register('occurredAt')}
        />
        <TextAreaField
          label="Observação (opcional)"
          maxLength={300}
          error={errors.notes?.message}
          {...register('notes')}
        />
        <ProblemAlert error={create.error && !Object.keys(errors).length ? create.error : null} />
      </form>
    </Dialog>
  );
}
