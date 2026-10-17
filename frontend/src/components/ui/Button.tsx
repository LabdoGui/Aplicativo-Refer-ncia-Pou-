import type { ComponentProps, MouseEvent } from 'react';
import { buttonStyles, type ButtonStyleOptions } from './button-styles';
import { Spinner } from './Spinner';

interface ButtonProps extends ComponentProps<'button'>, Omit<ButtonStyleOptions, 'className'> {
  /**
   * Mostra o indicador de carregamento e bloqueia novos cliques. O botão continua focável
   * (aria-disabled em vez de disabled): quem usa teclado ou leitor de tela não perde o lugar.
   */
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
  onClick,
  ...props
}: ButtonProps) {
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (loading) {
      // Também cancela o envio do formulário (inclusive o implícito, pela tecla Enter).
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }

  return (
    <button
      type={type}
      disabled={disabled}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      className={buttonStyles({ variant, size, fullWidth, className })}
      onClick={handleClick}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}
