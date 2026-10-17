import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ROLE_HOME } from '@pulso/contracts';
import { FormErrorAlert, PasswordField, TextField } from '@/components/form';
import { Alert, Button } from '@/components/ui';
import { safeRedirect } from '@/features/auth/RequireRole';
import { login, useSession } from '@/features/auth/use-auth';
import { useDocumentTitle } from '@/lib/use-document-title';
import { AuthCard } from './AuthCard';

const schema = z.object({
  email: z.string().trim().min(1, 'Informe seu e-mail.').email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe sua senha.'),
});
type FormValues = z.infer<typeof schema>;

/** Contas fictícias do seed (README); a senha é a mesma para todas. */
const DEMO_ACCOUNTS = [
  { email: 'doador@demo.com', label: 'Doador' },
  { email: 'enfermeiro@demo.com', label: 'Enfermeiro' },
  { email: 'colaborador@demo.com', label: 'Colaborador' },
  { email: 'admin@demo.com', label: 'Administrador' },
];
const DEMO_PASSWORD = 'Pulso@2026';

export function LoginPage() {
  useDocumentTitle('Entrar');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const session = useSession();
  const [submitError, setSubmitError] = useState<unknown>(null);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  if (session.status === 'authenticated' && session.user) {
    return <Navigate to={ROLE_HOME[session.user.role]} replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const { user } = await login(values);
      navigate(safeRedirect(params.get('redirect'), user.role), { replace: true });
    } catch (error) {
      setSubmitError(error);
    }
  });

  return (
    <AuthCard
      title="Entrar no Pulso"
      description="Acompanhe seus agendamentos, doações e conquistas."
      footer={
        <>
          Ainda não tem conta?{' '}
          <Link
            to="/cadastro"
            className="font-semibold text-petroleo-700 underline-offset-2 hover:underline"
          >
            Criar conta de doador
          </Link>
        </>
      }
    >
      {session.endedReason === 'expired' && (
        <Alert tone="info" className="mb-4" role="status">
          Sua sessão expirou. Entre novamente para continuar.
        </Alert>
      )}
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormErrorAlert error={submitError} />
        <TextField
          label="E-mail"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          error={errors.email?.message}
          {...register('email')}
        />
        <PasswordField
          label="Senha"
          autoComplete="current-password"
          required
          error={errors.password?.message}
          {...register('password')}
        />
        <Button type="submit" fullWidth size="lg" loading={isSubmitting}>
          Entrar
        </Button>
      </form>

      <details className="mt-6 rounded-card border border-line bg-canvas p-4 text-sm">
        <summary className="cursor-pointer font-semibold text-petroleo-800">
          Contas de demonstração (dados fictícios)
        </summary>
        <p className="mt-2 text-ink-muted">
          Senha de todas: <code className="font-semibold text-ink">{DEMO_PASSWORD}</code>. Toque
          para preencher.
        </p>
        <ul className="mt-3 grid grid-cols-2 gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <li key={account.email}>
              <button
                type="button"
                className="min-h-11 w-full rounded-control border border-line bg-surface px-3 text-left hover:border-petroleo-300"
                onClick={() => {
                  setValue('email', account.email, { shouldValidate: true });
                  setValue('password', DEMO_PASSWORD, { shouldValidate: true });
                }}
              >
                <span className="block font-semibold text-ink">{account.label}</span>
                <span className="block truncate text-xs text-ink-muted">{account.email}</span>
              </button>
            </li>
          ))}
        </ul>
      </details>
    </AuthCard>
  );
}
