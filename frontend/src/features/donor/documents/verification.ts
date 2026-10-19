import type { DocumentType, DocumentView } from '@pulso/contracts';
import { toIsoDate } from '@/lib/format';

/** Caminho da verificação pública de um código (mesmo formato impresso no PDF). */
export const verificationPath = (code: string): string => `/verificar/${encodeURIComponent(code)}`;

/** Link completo da verificação, para copiar e compartilhar. */
export const verificationUrl = (code: string): string =>
  `${window.location.origin}${verificationPath(code)}`;

const FILE_KIND: Record<DocumentType, string> = {
  ATTENDANCE_DECLARATION: 'declaracao-comparecimento',
  DONATION_DECLARATION: 'declaracao-doacao',
};

/** Nome sugerido para o download (o mesmo padrão do servidor). */
export const documentFileName = (document: Pick<DocumentView, 'type' | 'issuedAt'>): string =>
  `pulso-${FILE_KIND[document.type]}-${toIsoDate(document.issuedAt)}.pdf`;
