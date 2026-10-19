import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { applyApiFieldErrors, FormErrorAlert, TextField } from '@/components/form';
import { Button } from '@/components/ui';
import { useRankingOptIn } from '@/features/donor/api';
import { nicknameSchema, normalizeNickname, type NicknameValues } from './nickname-schema';

interface NicknameFormProps {
  initialNickname?: string;
  submitLabel: string;
  onDone: (nickname: string) => void;
  onCancel?: () => void;
}

/** Entrar no ranking (ou trocar o apelido). Apelido repetido vira erro no campo. */
export function NicknameForm({
  initialNickname,
  submitLabel,
  onDone,
  onCancel,
}: NicknameFormProps) {
  const optIn = useRankingOptIn();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<NicknameValues>({
    resolver: zodResolver(nicknameSchema),
    defaultValues: { nickname: initialNickname ?? '' },
  });

  const onSubmit = handleSubmit(async ({ nickname }) => {
    const value = normalizeNickname(nickname);
    try {
      await optIn.mutateAsync({ optIn: true, nickname: value });
      onDone(value);
    } catch (error) {
      applyApiFieldErrors(error, setError, ['nickname']);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <TextField
        label="Apelido"
        autoComplete="off"
        maxLength={24}
        hint="De 3 a 24 caracteres: letras, números, espaços, ponto, hífen ou sublinhado. Evite usar seu nome completo."
        error={errors.nickname?.message}
        {...register('nickname')}
      />
      {optIn.error && !errors.nickname ? <FormErrorAlert error={optIn.error} /> : null}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="secondary" loading={isSubmitting}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
