import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { isApiError } from '@/lib/api';

/**
 * Leva os erros por campo da API (Problem Details → errors[]) para o formulário.
 * Devolve true se algum campo conhecido recebeu erro.
 */
export function applyApiFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: ReadonlyArray<Path<T>>,
): boolean {
  if (!isApiError(error)) return false;
  let applied = false;
  for (const [field, message] of Object.entries(error.fieldErrors)) {
    if ((fields as readonly string[]).includes(field)) {
      setError(field as Path<T>, { type: 'server', message });
      applied = true;
    }
  }
  return applied;
}
