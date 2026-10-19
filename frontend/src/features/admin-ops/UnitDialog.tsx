import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { UnitInput, UnitView } from '@pulso/contracts';
import { applyApiFieldErrors, SelectField, TextField } from '@/components/form';
import { Button, Dialog, ProblemAlert } from '@/components/ui';
import { useSaveUnit } from './api';

type FormValues = Required<{ [K in keyof UnitInput]: string }>;

const FIELDS = [
  'name',
  'address',
  'district',
  'city',
  'state',
  'zipCode',
  'phone',
  'openingHours',
  'status',
] as const;

function toForm(unit: UnitView | null): FormValues {
  return {
    name: unit?.name ?? '',
    address: unit?.address ?? '',
    district: unit?.district ?? '',
    city: unit?.city ?? '',
    state: unit?.state ?? '',
    zipCode: unit?.zipCode ?? '',
    phone: unit?.phone ?? '',
    openingHours: unit?.openingHours ?? '',
    status: unit?.status ?? 'ACTIVE',
  };
}

/** Cadastro ou edição dos dados de uma unidade de coleta. */
export function UnitDialog({
  open,
  unit,
  onClose,
  onSaved,
}: {
  open: boolean;
  unit: UnitView | null;
  onClose: () => void;
  onSaved?: (unit: UnitView) => void;
}) {
  const save = useSaveUnit();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>();

  useEffect(() => {
    if (open) {
      reset(toForm(unit));
      save.reset();
    }
  }, [open]);

  const required = (label: string) => ({ required: `Informe ${label}.` });

  const onSubmit = handleSubmit(async (form) => {
    try {
      const saved = await save.mutateAsync({
        id: unit?.id,
        name: form.name.trim(),
        address: form.address.trim(),
        district: form.district.trim(),
        city: form.city.trim(),
        state: form.state.trim().toUpperCase(),
        zipCode: form.zipCode.trim() || null,
        phone: form.phone.trim() || null,
        openingHours: form.openingHours.trim() || null,
        status: form.status as UnitView['status'],
      });
      onSaved?.(saved);
      onClose();
    } catch (error) {
      applyApiFieldErrors(error, setError, FIELDS);
    }
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={unit ? 'Dados da unidade' : 'Nova unidade'}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="unit-form" loading={save.isPending}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="unit-form" onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Nome"
          required
          className="sm:col-span-2"
          error={errors.name?.message}
          {...register('name', required('o nome'))}
        />
        <TextField
          label="Endereço"
          required
          className="sm:col-span-2"
          error={errors.address?.message}
          {...register('address', required('o endereço'))}
        />
        <TextField
          label="Bairro"
          required
          error={errors.district?.message}
          {...register('district', required('o bairro'))}
        />
        <TextField
          label="Cidade"
          required
          error={errors.city?.message}
          {...register('city', required('a cidade'))}
        />
        <TextField
          label="UF"
          required
          maxLength={2}
          error={errors.state?.message}
          {...register('state', {
            required: 'Informe a UF.',
            pattern: { value: /^[A-Za-z]{2}$/, message: 'Use a sigla com 2 letras.' },
          })}
        />
        <TextField
          label="CEP (opcional)"
          error={errors.zipCode?.message}
          {...register('zipCode')}
        />
        <TextField
          label="Telefone (opcional)"
          type="tel"
          error={errors.phone?.message}
          {...register('phone')}
        />
        <TextField
          label="Horário de funcionamento (opcional)"
          placeholder="Seg. a sex., 8h às 17h"
          error={errors.openingHours?.message}
          {...register('openingHours')}
        />
        {unit && (
          <SelectField
            label="Situação"
            hint="Unidade inativa some do agendamento do doador."
            options={[
              { value: 'ACTIVE', label: 'Ativa' },
              { value: 'INACTIVE', label: 'Inativa' },
            ]}
            {...register('status')}
          />
        )}
        <div className="sm:col-span-2">
          <ProblemAlert error={save.error && !Object.keys(errors).length ? save.error : null} />
        </div>
      </form>
    </Dialog>
  );
}
