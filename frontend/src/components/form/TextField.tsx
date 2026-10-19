import type { ComponentProps, ReactNode, Ref } from 'react';
import { controlStyles, Field } from './Field';

interface TextFieldProps extends Omit<ComponentProps<'input'>, 'id'> {
  label: string;
  hint?: ReactNode;
  error?: string;
  ref?: Ref<HTMLInputElement>;
}

export function TextField({
  label,
  hint,
  error,
  required,
  className,
  ref,
  ...props
}: TextFieldProps) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {({ id, describedBy, invalid }) => (
        <input
          ref={ref}
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          aria-required={required || undefined}
          className={controlStyles(invalid)}
          {...props}
        />
      )}
    </Field>
  );
}
