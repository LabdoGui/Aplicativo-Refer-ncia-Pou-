import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ShieldCheck } from 'lucide-react';
import {
  BLOOD_TYPE_LABELS,
  BLOOD_TYPES,
  PASSWORD_POLICY,
  type BloodType,
  type MeResponse,
} from '@pulso/contracts';
import {
  applyApiFieldErrors,
  FormErrorAlert,
  PasswordField,
  SelectField,
  TextField,
} from '@/components/form';
import { Button, ButtonLink, Card, PageHeader, QueryState } from '@/components/ui';
import { useChangePassword, useMe, useUpdateMe } from '@/features/account/api';
import { formatDate } from '@/lib/format';
import { useDocumentTitle } from '@/lib/use-document-title';

const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'Informe seu nome completo.')
    .max(120)
    .regex(/^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/, 'Use apenas letras, espaços, apóstrofo e hífen.'),
  phone: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || /^\+?[\d\s().-]{10,20}$/.test(value),
      'Informe um telefone com DDD.',
    ),
  city: z.string().trim().max(80, 'Use no máximo 80 caracteres.'),
  declaredBloodType: z.string(),
});
type ProfileValues = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual.'),
    newPassword: z
      .string()
      .min(PASSWORD_POLICY.minLength, PASSWORD_POLICY.message)
      .regex(PASSWORD_POLICY.pattern, PASSWORD_POLICY.message),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não conferem.',
  });
type PasswordValues = z.infer<typeof passwordSchema>;

const BLOOD_OPTIONS = BLOOD_TYPES.map((type) => ({ value: type, label: BLOOD_TYPE_LABELS[type] }));

export function ProfilePage() {
  useDocumentTitle('Meu perfil');
  const me = useMe();
  return (
    <>
      <PageHeader
        title="Meu perfil"
        description="Mantenha seus dados atualizados para facilitar o atendimento."
      />
      <QueryState isLoading={me.isLoading} error={me.error} onRetry={() => me.refetch()}>
        {me.data && (
          <div className="space-y-6">
            <ProfileForm me={me.data} />
            <PasswordForm />
            <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-3">
                <ShieldCheck
                  aria-hidden="true"
                  className="mt-0.5 size-6 shrink-0 text-petroleo-700"
                />
                <div>
                  <h2 className="font-bold text-ink">Privacidade e dados</h2>
                  <p className="text-sm text-ink-muted">
                    Consentimentos, cópia dos seus dados e exclusão da conta.
                  </p>
                </div>
              </div>
              <ButtonLink to="/app/privacidade" variant="outline">
                Abrir privacidade
              </ButtonLink>
            </Card>
          </div>
        )}
      </QueryState>
    </>
  );
}

function ProfileForm({ me }: { me: MeResponse }) {
  const update = useUpdateMe();
  const [saved, setSaved] = useState(false);
  const toValues = (data: MeResponse): ProfileValues => ({
    name: data.name,
    phone: data.donor?.phone ?? '',
    city: data.donor?.city ?? '',
    declaredBloodType: data.donor?.declaredBloodType ?? '',
  });
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues: toValues(me) });

  useEffect(() => reset(toValues(me)), [me, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setSaved(false);
    try {
      await update.mutateAsync({
        name: values.name,
        phone: values.phone || null,
        city: values.city || null,
        declaredBloodType: (values.declaredBloodType || null) as BloodType | null,
      });
      setSaved(true);
    } catch (error) {
      applyApiFieldErrors(error, setError, ['name', 'phone', 'city', 'declaredBloodType']);
    }
  });

  return (
    <Card as="section" aria-labelledby="dados-pessoais">
      <h2 id="dados-pessoais" className="text-lg font-bold text-ink">
        Dados pessoais
      </h2>
      <dl className="mt-4 grid gap-4 rounded-card bg-canvas p-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-ink-muted">E-mail</dt>
          <dd className="font-semibold break-all text-ink">{me.email}</dd>
        </div>
        {me.donor && (
          <>
            <div>
              <dt className="text-ink-muted">Nascimento</dt>
              <dd className="font-semibold text-ink">{formatDate(me.donor.birthDate)}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Código de doador</dt>
              <dd className="font-mono font-semibold text-ink">{me.donor.donorCode}</dd>
            </div>
          </>
        )}
      </dl>
      <form onSubmit={onSubmit} noValidate className="mt-6 grid gap-4 sm:grid-cols-2">
        {update.error && !Object.keys(errors).length ? (
          <div className="sm:col-span-2">
            <FormErrorAlert error={update.error} />
          </div>
        ) : null}
        <TextField
          label="Nome completo"
          autoComplete="name"
          required
          className="sm:col-span-2"
          error={errors.name?.message}
          {...register('name')}
        />
        <TextField
          label="Celular"
          type="tel"
          autoComplete="tel"
          error={errors.phone?.message}
          {...register('phone')}
        />
        <TextField
          label="Cidade"
          autoComplete="address-level2"
          error={errors.city?.message}
          {...register('city')}
        />
        <SelectField
          label="Tipo sanguíneo (se souber)"
          placeholder="Não sei / prefiro não informar"
          options={BLOOD_OPTIONS}
          hint="Informação sua, não é laudo. O tipo é confirmado pela equipe na doação."
          className="sm:col-span-2"
          {...register('declaredBloodType')}
        />
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            Salvar alterações
          </Button>
          {saved && !isDirty && (
            <p role="status" className="text-sm font-semibold text-ok-strong">
              Dados salvos.
            </p>
          )}
        </div>
      </form>
    </Card>
  );
}

function PasswordForm() {
  const change = useChangePassword();
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    setDone(false);
    try {
      await change.mutateAsync({ currentPassword, newPassword });
      reset();
      setDone(true);
    } catch (error) {
      applyApiFieldErrors(error, setError, ['currentPassword', 'newPassword']);
    }
  });

  return (
    <Card as="section" aria-labelledby="trocar-senha">
      <h2 id="trocar-senha" className="text-lg font-bold text-ink">
        Trocar senha
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Ao trocar, as sessões abertas em outros aparelhos são encerradas.
      </p>
      <form onSubmit={onSubmit} noValidate className="mt-4 grid gap-4 sm:grid-cols-3">
        <PasswordField
          label="Senha atual"
          autoComplete="current-password"
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />
        <PasswordField
          label="Nova senha"
          autoComplete="new-password"
          hint="Mínimo de 8 caracteres, com letras e números."
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <PasswordField
          label="Confirme a nova senha"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
          <Button type="submit" variant="secondary" loading={isSubmitting}>
            Trocar senha
          </Button>
          {done && (
            <p role="status" className="text-sm font-semibold text-ok-strong">
              Senha alterada.
            </p>
          )}
        </div>
        {change.error && !errors.currentPassword && !errors.newPassword ? (
          <div className="sm:col-span-3">
            <FormErrorAlert error={change.error} />
          </div>
        ) : null}
      </form>
    </Card>
  );
}
