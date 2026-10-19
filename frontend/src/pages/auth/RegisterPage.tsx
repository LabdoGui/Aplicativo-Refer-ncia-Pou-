import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { MIN_DONOR_AGE, PASSWORD_POLICY, ROLE_HOME } from '@pulso/contracts';
import {
  applyApiFieldErrors,
  CheckboxField,
  FormErrorAlert,
  PasswordField,
  TextField,
} from '@/components/form';
import { Alert, Button } from '@/components/ui';
import { register as registerAccount, useSession } from '@/features/auth/use-auth';
import { ageFromBirthDate, todayIso } from '@/lib/format';
import { useDocumentTitle } from '@/lib/use-document-title';
import { AuthCard } from './AuthCard';

const schema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, 'Informe seu nome completo.')
      .max(120, 'Use no máximo 120 caracteres.')
      .regex(/^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/, 'Use apenas letras, espaços, apóstrofo e hífen.'),
    email: z.string().trim().min(1, 'Informe seu e-mail.').email('Informe um e-mail válido.'),
    birthDate: z
      .string()
      .min(1, 'Informe sua data de nascimento.')
      .refine((value) => value <= todayIso(), 'A data não pode ser futura.'),
    phone: z
      .string()
      .trim()
      .refine(
        (value) => value === '' || /^\+?[\d\s().-]{10,20}$/.test(value),
        'Informe um telefone com DDD.',
      ),
    password: z
      .string()
      .min(PASSWORD_POLICY.minLength, PASSWORD_POLICY.message)
      .max(PASSWORD_POLICY.maxLength)
      .regex(PASSWORD_POLICY.pattern, PASSWORD_POLICY.message),
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: 'É preciso aceitar os Termos e a Política de Privacidade.' }),
    }),
    acceptCommunications: z.boolean(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não conferem.',
  });

type FormValues = z.input<typeof schema>;
const SERVER_FIELDS = ['name', 'email', 'birthDate', 'phone', 'password'] as const;

export function RegisterPage() {
  useDocumentTitle('Criar conta');
  const navigate = useNavigate();
  const session = useSession();
  const [submitError, setSubmitError] = useState<unknown>(null);
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      email: '',
      birthDate: '',
      phone: '',
      password: '',
      confirmPassword: '',
      acceptCommunications: false,
    },
  });

  const birthDate = watch('birthDate');
  const age = birthDate ? ageFromBirthDate(birthDate) : null;
  const underage = age !== null && age >= 0 && age < MIN_DONOR_AGE;

  if (session.status === 'authenticated' && session.user) {
    return <Navigate to={ROLE_HOME[session.user.role]} replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await registerAccount({
        name: values.name.trim(),
        email: values.email.trim(),
        birthDate: values.birthDate,
        phone: values.phone?.trim() || undefined,
        password: values.password,
        acceptTerms: true,
        acceptCommunications: values.acceptCommunications,
      });
      navigate('/app?boas-vindas=1', { replace: true });
    } catch (error) {
      if (!applyApiFieldErrors(error, setError, SERVER_FIELDS)) setSubmitError(error);
    }
  });

  return (
    <AuthCard
      title="Criar conta de doador"
      description="Leva menos de um minuto. Pedimos só o necessário para agendar sua doação."
      footer={
        <>
          Já tem conta?{' '}
          <Link
            to="/entrar"
            className="font-semibold text-petroleo-700 underline-offset-2 hover:underline"
          >
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormErrorAlert error={submitError} />
        <TextField
          label="Nome completo"
          autoComplete="name"
          required
          error={errors.name?.message}
          {...register('name')}
        />
        <TextField
          label="E-mail"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          error={errors.email?.message}
          {...register('email')}
        />
        <TextField
          label="Data de nascimento"
          type="date"
          autoComplete="bday"
          max={todayIso()}
          required
          error={errors.birthDate?.message}
          {...register('birthDate')}
        />
        {underage && (
          <Alert tone="warn" role="status">
            O cadastro no Pulso é para maiores de {MIN_DONOR_AGE} anos. Se você tem 16 ou 17 anos,
            procure diretamente uma unidade de coleta: lá a equipe orienta sobre a autorização do
            responsável.
          </Alert>
        )}
        <TextField
          label="Celular (opcional)"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder="(11) 91234-5678"
          hint="Usado só para contato da unidade sobre o seu agendamento."
          error={errors.phone?.message}
          {...register('phone')}
        />
        <PasswordField
          label="Senha"
          autoComplete="new-password"
          required
          hint={PASSWORD_POLICY.message}
          error={errors.password?.message}
          {...register('password')}
        />
        <PasswordField
          label="Confirme a senha"
          autoComplete="new-password"
          required
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <CheckboxField
          label={
            <>
              Li e aceito os Termos de Uso e a{' '}
              <Link
                to="/privacidade"
                target="_blank"
                className="font-semibold text-petroleo-700 underline"
              >
                Política de Privacidade
              </Link>
            </>
          }
          error={errors.acceptTerms?.message}
          {...register('acceptTerms')}
        />
        <CheckboxField
          label="Quero receber lembretes e avisos de campanhas"
          description="Opcional. Você pode mudar isso quando quiser em Privacidade."
          {...register('acceptCommunications')}
        />
        <Button type="submit" fullWidth size="lg" loading={isSubmitting} disabled={underage}>
          Criar conta
        </Button>
      </form>
    </AuthCard>
  );
}
