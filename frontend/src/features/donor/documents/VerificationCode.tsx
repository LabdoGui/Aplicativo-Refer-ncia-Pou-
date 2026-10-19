import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { buttonStyles } from '@/components/ui';
import { CopyLinkButton } from './CopyLinkButton';
import { verificationPath, verificationUrl } from './verification';

/** Código de verificação do documento, com link para a página pública e opção de copiar. */
export function VerificationCode({ code }: { code: string }) {
  return (
    <div className="min-w-0 rounded-control bg-canvas px-4 pt-3 pb-1">
      <p className="text-sm text-ink-muted">Código de verificação</p>
      <p className="font-mono text-base font-semibold tracking-wide break-all text-ink">{code}</p>
      {/* A margem negativa alinha o texto dos botões "ghost" com o código acima. */}
      <div className="-ml-3 flex flex-wrap items-center">
        <Link
          to={verificationPath(code)}
          target="_blank"
          rel="noopener"
          className={buttonStyles({ variant: 'ghost', size: 'sm' })}
        >
          <ExternalLink aria-hidden="true" className="size-4" />
          Verificar autenticidade<span className="sr-only"> (abre em nova aba)</span>
        </Link>
        <CopyLinkButton url={verificationUrl(code)} />
      </div>
    </div>
  );
}
