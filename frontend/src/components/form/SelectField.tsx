import type { ComponentProps, ReactNode, Ref } from 'react';
import { controlStyles, Field } from './Field';

interface SelectFieldProps extends Omit<ComponentProps<'select'>, 'id'> {
  label: string;
  hint?: ReactNode;
  error?: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  /** Primeira opção vazia (ex.: "Selecione"). */
  placeholder?: string;
  ref?: Ref<HTMLSelectElement>;
}

export function SelectField({
  label,
  hint,
  error,
  required,
  options,
  placeholder,
  className,
  ref,
  ...props
}: SelectFieldProps) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {({ id, describedBy, invalid }) => (
        <select
          ref={ref}
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          aria-required={required || undefined}
          className={controlStyles(invalid, 'pr-8')}
          {...props}
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}
