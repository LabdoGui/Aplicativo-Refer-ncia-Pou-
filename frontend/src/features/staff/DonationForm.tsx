import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import {
  BLOOD_TYPES,
  BLOOD_TYPE_LABELS,
  DONATION_STATUS_LABELS,
  type BloodType,
  type DonationStatus,
} from '@pulso/contracts';
import { SelectField, TextAreaField, TextField } from '@/components/form';
import { Button, Card, ProblemAlert } from '@/components/ui';
import { useRecordDonation } from './api';

type FormValues = {
  bloodType: BloodType | '';
  volumeMl: string;
  status: DonationStatus;
  notes: string;
};

interface DonationFormProps {
  attendanceId: string;
  declaredBloodType: BloodType | null;
}

/** Registro da coleta depois de uma triagem "apto". */
export function DonationForm({ attendanceId, declaredBloodType }: DonationFormProps) {
  const record = useRecordDonation();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      bloodType: declaredBloodType ?? '',
      volumeMl: '',
      status: 'COMPLETED',
      notes: '',
    },
  });

  useEffect(() => headingRef.current?.focus(), []);

  const onSubmit = handleSubmit(async (form) => {
    await record
      .mutateAsync({
        attendanceId,
        bloodType: form.bloodType as BloodType,
        volumeMl: Number(form.volumeMl),
        status: form.status,
        notes: form.notes.trim() || undefined,
      })
      .catch(() => undefined);
  });

  return (
    <Card as="section" aria-labelledby="doacao-titulo">
      <h2 id="doacao-titulo" ref={headingRef} tabIndex={-1} className="text-lg font-bold text-ink">
        Registrar doação
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Triagem registrada como apto. Informe os dados da coleta.
      </p>
      <form onSubmit={onSubmit} noValidate className="mt-5 grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Tipo sanguíneo"
          required
          placeholder="Selecione"
          hint={declaredBloodType ? 'Pré-preenchido com o tipo declarado; confirme.' : undefined}
          options={BLOOD_TYPES.map((type) => ({ value: type, label: BLOOD_TYPE_LABELS[type] }))}
          error={errors.bloodType?.message}
          {...register('bloodType', { required: 'Informe o tipo sanguíneo.' })}
        />
        <TextField
          label="Volume coletado (mL)"
          required
          inputMode="numeric"
          error={errors.volumeMl?.message}
          {...register('volumeMl', {
            required: 'Informe o volume coletado.',
            validate: (value, form) => {
              const number = Number(value);
              if (!Number.isInteger(number) || number < 0 || number > 1000) {
                return 'Use um número inteiro de 0 a 1000.';
              }
              return (
                form.status !== 'COMPLETED' ||
                number > 0 ||
                'Para uma doação concluída, informe um volume maior que zero.'
              );
            },
          })}
        />
        <SelectField
          label="Situação da coleta"
          required
          options={(['COMPLETED', 'NOT_COMPLETED'] as const).map((status) => ({
            value: status,
            label: DONATION_STATUS_LABELS[status],
          }))}
          {...register('status')}
        />
        <TextAreaField
          label="Observações (opcional)"
          className="sm:col-span-2"
          maxLength={500}
          {...register('notes')}
        />
        <div className="space-y-3 sm:col-span-2">
          <ProblemAlert error={record.error} />
          <Button type="submit" loading={record.isPending}>
            Registrar doação
          </Button>
        </div>
      </form>
    </Card>
  );
}
