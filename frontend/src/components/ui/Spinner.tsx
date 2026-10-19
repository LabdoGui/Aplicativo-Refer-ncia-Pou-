import { cn } from '@/lib/cn';

type SpinnerSize = 'sm' | 'md' | 'lg';

interface SpinnerProps {
  size?: SpinnerSize;
  /** Texto anunciado (e exibido) enquanto carrega. Sem ele, o spinner é decorativo. */
  label?: string;
  hideLabel?: boolean;
  className?: string;
}

const SIZES: Record<SpinnerSize, string> = { sm: 'size-4', md: 'size-5', lg: 'size-8' };

export function Spinner({ size = 'md', label, hideLabel = false, className }: SpinnerProps) {
  const icon = (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn('shrink-0 animate-spin', SIZES[size], !label && className)}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );

  if (!label) return icon;

  return (
    <span role="status" className={cn('inline-flex items-center gap-2', className)}>
      {icon}
      <span className={hideLabel ? 'sr-only' : undefined}>{label}</span>
    </span>
  );
}
