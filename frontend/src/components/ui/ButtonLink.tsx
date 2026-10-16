import { Link, type LinkProps } from 'react-router-dom';
import { buttonStyles, type ButtonStyleOptions } from './button-styles';

type ButtonLinkProps = LinkProps & Omit<ButtonStyleOptions, 'className'>;

/** Link de navegação com aparência de botão (navegar é link, agir é botão). */
export function ButtonLink({ variant, size, fullWidth, className, ...props }: ButtonLinkProps) {
  return (
    <Link
      className={buttonStyles({
        variant,
        size,
        fullWidth,
        className: typeof className === 'string' ? className : undefined,
      })}
      {...props}
    />
  );
}
