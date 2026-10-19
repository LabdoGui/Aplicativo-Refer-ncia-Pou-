import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { GraduationCap } from 'lucide-react';
import type { InstitutionView, MyHoursResponse } from '@pulso/contracts';
import { FormErrorAlert, SelectField } from '@/components/form';
import { Button, Card } from '@/components/ui';
import { useInstitutions, useSetInstitution } from '@/features/donor/api';
import { isApiError } from '@/lib/api';
import { formatNumber } from '@/lib/format';

const schema = z.object({
  institutionId: z.string().min(1, 'Selecione uma instituição da lista.'),
});
type Values = z.infer<typeof schema>;

const hoursLabel = (institution: InstitutionView) =>
  `${formatNumber(institution.hoursPerDonation)} h por doação`;

/** Vínculo com a instituição de ensino (RN15): vale para as próximas doações. */
export function InstitutionCard({ hours }: { hours: MyHoursResponse }) {
  const institutions = useInstitutions();
  const setInstitution = useSetInstitution();
  const [message, setMessage] = useState('');
  const current = hours.institution;
  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { institutionId: current?.id ?? '' },
  });

  useEffect(() => reset({ institutionId: current?.id ?? '' }), [current?.id, reset]);

  const options = (institutions.data ?? []).map((item) => ({ value: item.id, label: item.name }));
  const selected = institutions.data?.find((item) => item.id === watch('institutionId'));
  // Instituição vinculada que saiu da lista de ativas continua visível no seletor.
  if (current && !options.some((option) => option.value === current.id)) {
    options.unshift({ value: current.id, label: `${current.name} (indisponível)` });
  }

  function save(institutionId: string | null, success: string) {
    setMessage('');
    setInstitution.mutate(institutionId, {
      onSuccess: () => setMessage(success),
      onError: (error) => {
        if (isApiError(error) && error.code === 'INSTITUTION_UNAVAILABLE') {
          setError('institutionId', { type: 'server', message: error.detail });
        }
      },
    });
  }

  const onSubmit = handleSubmit(({ institutionId }) => {
    const name = institutions.data?.find((item) => item.id === institutionId)?.name;
    save(institutionId, name ? `Instituição vinculada: ${name}.` : 'Instituição vinculada.');
  });
  const unlinking = setInstitution.isPending && setInstitution.variables === null;
  const linking = setInstitution.isPending && setInstitution.variables !== null;
  const showError =
    setInstitution.error &&
    !(isApiError(setInstitution.error) && setInstitution.error.code === 'INSTITUTION_UNAVAILABLE');

  return (
    <Card as="section" aria-labelledby="instituicao">
      <div className="flex gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-petroleo-50 text-petroleo-700">
          <GraduationCap aria-hidden="true" className="size-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <h2 id="instituicao" className="text-lg font-bold text-ink">
            Instituição de ensino
          </h2>
          {current ? (
            <p className="text-ink">
              Vinculada a <strong className="font-semibold">{current.name}</strong> ·{' '}
              {hoursLabel(current)}
            </p>
          ) : (
            <p className="text-ink-muted">Nenhuma instituição vinculada.</p>
          )}
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        noValidate
        className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
      >
        <SelectField
          label={current ? 'Trocar instituição' : 'Escolha sua instituição'}
          placeholder={institutions.isLoading ? 'Carregando instituições…' : 'Selecione'}
          options={options}
          disabled={institutions.isLoading}
          hint={
            selected && selected.id !== current?.id
              ? `${selected.name}: ${hoursLabel(selected)}.`
              : undefined
          }
          error={
            errors.institutionId?.message ??
            (institutions.error ? 'Não foi possível carregar a lista de instituições.' : undefined)
          }
          {...register('institutionId')}
        />
        <div className="flex flex-wrap gap-2 sm:pt-7">
          <Button type="submit" variant="secondary" loading={linking} disabled={!isDirty}>
            {current ? 'Salvar troca' : 'Vincular'}
          </Button>
          {current && (
            <Button
              variant="ghost"
              loading={unlinking}
              onClick={() => save(null, 'Vínculo desfeito.')}
            >
              Desvincular
            </Button>
          )}
        </div>
      </form>

      <p
        role="status"
        className={message ? 'mt-3 text-sm font-semibold text-ok-strong' : 'sr-only'}
      >
        {message}
      </p>
      {showError ? (
        <div className="mt-3">
          <FormErrorAlert error={setInstitution.error} />
        </div>
      ) : null}

      <ul className="mt-5 list-disc space-y-1 border-t border-line pt-4 pl-5 text-sm text-ink-muted">
        <li>As horas só contam depois que a instituição aprova o pedido.</li>
        <li>Quantas horas cada doação vale é regra da instituição, não do Pulso.</li>
        <li>
          O vínculo vale para as próximas doações concluídas. Pedidos já criados continuam com a
          instituição original.
        </li>
      </ul>
    </Card>
  );
}
