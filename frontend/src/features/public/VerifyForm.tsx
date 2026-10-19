import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TextField } from '@/components/form';
import { Button } from '@/components/ui';
import { verificationPathFor } from './verification-path';
import { normalizeCode, verifySchema, type VerifyValues } from './verify-schema';

/** Campo do código de verificação; ao enviar, abre /verificar/<código>. */
export function VerifyForm({ initialCode = '' }: { initialCode?: string }) {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<VerifyValues>({
    resolver: zodResolver(verifySchema),
    defaultValues: { code: initialCode },
  });

  useEffect(() => reset({ code: initialCode }), [initialCode, reset]);

  const onSubmit = handleSubmit(({ code }) => navigate(verificationPathFor(normalizeCode(code))));

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
    >
      <TextField
        label="Código de verificação"
        placeholder="PUL-XXXXX-XXXXX"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        hint="Está impresso no documento, junto do QR code de verificação."
        error={errors.code?.message}
        className="[&_input]:font-mono [&_input]:uppercase"
        {...register('code')}
      />
      <div className="sm:pt-7">
        <Button type="submit" variant="secondary" fullWidth>
          <Search aria-hidden="true" className="size-4" />
          Verificar
        </Button>
      </div>
    </form>
  );
}
