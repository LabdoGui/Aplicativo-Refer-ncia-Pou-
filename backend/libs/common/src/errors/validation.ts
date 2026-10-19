import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';
import { translateConstraint } from './validation-messages';

/** Erros por campo, sem repetir a mesma mensagem no mesmo campo. */
function flatten(errors: ValidationError[]): Array<{ field: string; message: string }> {
  const seen = new Set<string>();
  return collect(errors).filter(({ field, message }) => {
    const key = `${field}\u0000${message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function collect(
  errors: ValidationError[],
  parent = '',
): Array<{ field: string; message: string }> {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.entries(error.constraints ?? {}).map(([constraint, message]) => ({
      field,
      message: translateConstraint(error.property, constraint, message),
    }));
    return [...own, ...collect(error.children ?? [], field)];
  });
}

/**
 * ValidationPipe global: remove campos desconhecidos e devolve erros por campo,
 * com mensagens em português.
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
    exceptionFactory: (errors) =>
      new BadRequestException({
        code: 'VALIDATION_ERROR',
        title: 'Dados inválidos',
        message: 'Alguns campos precisam de correção.',
        errors: flatten(errors),
      }),
  });
}
