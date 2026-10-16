import type { ComponentProps } from 'react';
import { buttonStyles, type ButtonStyleOptions } from './button-styles';
import { Spinner } from './Spinner';

interface ButtonProps extends ComponentProps<'button'>, Omit<ButtonStyleOptions, 'className'> {
  /** Mostra o indicador de carregamento e bloqueia novos cliques. */
  loading?: boolean;
}

export function Button({
  variant,
  size,
  fullWidth,
  loading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonStyles({ variant, size, fullWidth, className })}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}
