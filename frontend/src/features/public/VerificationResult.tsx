import type { ReactNode } from 'react';
import { BadgeCheck, SearchX } from 'lucide-react';
import {
  DOCUMENT_DISCLAIMER,
  DOCUMENT_TYPE_LABELS,
  type DocumentVerification,
} from '@pulso/contracts';
import { Alert, Card } from '@/components/ui';
import { formatDate, formatDateTime } from '@/lib/format';

interface VerificationResultProps {
  code: string;
  result: DocumentVerification;
}

/** Resultado da verificação: documento autêntico (dados mínimos) ou código não encontrado. */
export function VerificationResult({ code, result }: VerificationResultProps) {
  if (!result.valid) {
    return (
      <Card className="text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-surface-muted text-ink-muted">
          <SearchX aria-hidden="true" className="size-7" strokeWidth={1.75} />
        </span>
        <h2 className="mt-4 text-xl font-bold text-ink">
          Não encontramos um documento com este código
        </h2>
        <p className="mx-auto mt-2 max-w-md text-ink-muted">
          Confira se o código <span className="font-mono font-semibold text-ink">{code}</span> foi
          digitado exatamente como aparece no documento e tente novamente.
        </p>
      </Card>
    );
  }

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="flex items-center gap-3 border-b border-ok/20 bg-ok-soft px-5 py-4 sm:px-6">
        <BadgeCheck aria-hidden="true" className="size-6 shrink-0 text-ok-strong" />
        <div>
          <h2 className="font-sans text-base font-bold text-ok-strong">Documento autêntico</h2>
          <p className="text-sm text-ink">
            Este código corresponde a um documento emitido pelo SangueConecta.
          </p>
        </div>
      </div>
      <div className="p-5 sm:p-6">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          {result.type && <Item label="Tipo">{DOCUMENT_TYPE_LABELS[result.type]}</Item>}
          {result.title && result.title !== (result.type && DOCUMENT_TYPE_LABELS[result.type]) && (
            <Item label="Título">{result.title}</Item>
          )}
          <Item label="Titular (iniciais)">{result.holderInitials ?? '—'}</Item>
          <Item label="Unidade">{result.unitName ?? '—'}</Item>
          <Item label="Data do atendimento">
            {result.attendanceDate ? formatDate(result.attendanceDate) : '—'}
          </Item>
          <Item label="Emitido em">{result.issuedAt ? formatDateTime(result.issuedAt) : '—'}</Item>
          <Item label="Código">
            <span className="font-mono break-all">{code}</span>
          </Item>
        </dl>
        <Alert tone="warn" className="mt-5">
          {DOCUMENT_DISCLAIMER}
        </Alert>
      </div>
    </Card>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-semibold text-ink">{children}</dd>
    </div>
  );
}
