import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { BLOOD_TYPE_LABELS, type StockItemView } from '@pulso/contracts';
import { applyApiFieldErrors, TextField } from '@/components/form';
import { Button, Dialog, ProblemAlert } from '@/components/ui';
import { useUpdateThresholds } from './api';

type FormValues = { minimum: string; ideal: string };

/** Níveis de referência de um tipo (RN11: crítico abaixo do mínimo, atenção abaixo do ideal). */
export function ThresholdsDialog({
  item,
  onClose,
}: {
  item: StockItemView | null;
  onClose: () => void;
}) {
  const update = useUpdateThresholds();
  const {
    register,
    handleSubmit,
    reset,
    getValues,
    setError,
    formState: { errors },
  } = useForm<FormValues>();

  useEffect(() => {
    if (item) {
      reset({ minimum: String(item.minimum), ideal: String(item.ideal) });
      update.reset();
    }
  }, [item]);

  const intRule = {
    required: 'Informe um número.',
    validate: (v: string) =>
      (Number.isInteger(Number(v)) && Number(v) >= 0) || 'Use um número inteiro a partir de 0.',
  };

  const onSubmit = handleSubmit(async (form) => {
    if (!item) return;
    try {
      await update.mutateAsync({
        bloodType: item.bloodType,
        minimum: Number(form.minimum),
        ideal: Number(form.ideal),
      });
      onClose();
    } catch (error) {
      applyApiFieldErrors(error, setError, ['minimum', 'ideal']);
    }
  });

  return (
    <Dialog
      open={item !== null}
      onClose={onClose}
      title={item ? `Níveis do tipo ${BLOOD_TYPE_LABELS[item.bloodType]}` : 'Níveis'}
      description="Abaixo do mínimo o tipo fica crítico; entre o mínimo e o ideal, em atenção. Os valores são da instituição."
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="thresholds-form" loading={update.isPending}>
            Salvar níveis
          </Button>
        </>
      }
    >
      <form
        id="thresholds-form"
        onSubmit={onSubmit}
        noValidate
        className="grid gap-4 sm:grid-cols-2"
      >
        <TextField
          label="Mínimo (bolsas)"
          inputMode="numeric"
          error={errors.minimum?.message}
          {...register('minimum', intRule)}
        />
        <TextField
          label="Ideal (bolsas)"
          inputMode="numeric"
          error={errors.ideal?.message}
          {...register('ideal', {
            ...intRule,
            validate: (v) =>
              intRule.validate(v) === true
                ? Number(v) >= Number(getValues('minimum')) ||
                  'O ideal não pode ser menor que o mínimo.'
                : intRule.validate(v),
          })}
        />
        <div className="sm:col-span-2">
          <ProblemAlert error={update.error && !Object.keys(errors).length ? update.error : null} />
        </div>
      </form>
    </Dialog>
  );
}
