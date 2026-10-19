import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PASSWORD_POLICY } from '@pulso/contracts';
import { applyApiFieldErrors, FormErrorAlert, PasswordField } from '@/components/form';
import { Button, Card } from '@/components/ui';
import { useChangePassword } from './api';

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

/** Troca da própria senha (doador, equipe e administração). */
export function PasswordForm() {
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
