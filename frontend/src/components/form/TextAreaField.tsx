import type { ComponentProps, ReactNode, Ref } from 'react';
import { controlStyles, Field } from './Field';

interface TextAreaFieldProps extends Omit<ComponentProps<'textarea'>, 'id'> {
  label: string;
  hint?: ReactNode;
  error?: string;
  ref?: Ref<HTMLTextAreaElement>;
}

export function TextAreaField({
  label,
  hint,
  error,
  required,
  className,
  ref,
  rows = 3,
  ...props
}: TextAreaFieldProps) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {({ id, describedBy, invalid }) => (
        <textarea
          ref={ref}
          id={id}
          rows={rows}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          aria-required={required || undefined}
          className={controlStyles(invalid, 'min-h-24')}
          {...props}
        />
      )}
    </Field>
  );
}
