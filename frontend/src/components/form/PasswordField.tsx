import { useState, type ComponentProps, type ReactNode, type Ref } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { controlStyles, Field } from './Field';

interface PasswordFieldProps extends Omit<ComponentProps<'input'>, 'id' | 'type'> {
  label: string;
  hint?: ReactNode;
  error?: string;
  ref?: Ref<HTMLInputElement>;
}

/** Campo de senha com botão "mostrar/ocultar" acessível. */
export function PasswordField({
  label,
  hint,
  error,
  required,
  className,
  ref,
  ...props
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <input
            ref={ref}
            id={id}
            type={visible ? 'text' : 'password'}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            aria-required={required || undefined}
            className={controlStyles(invalid, 'pr-12')}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((value) => !value)}
            aria-pressed={visible}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-control text-ink-muted hover:text-ink"
          >
            {visible ? (
              <EyeOff aria-hidden="true" className="size-5" />
            ) : (
              <Eye aria-hidden="true" className="size-5" />
            )}
            <span className="sr-only">{visible ? 'Ocultar senha' : 'Mostrar senha'}</span>
          </button>
        </div>
      )}
    </Field>
  );
}
