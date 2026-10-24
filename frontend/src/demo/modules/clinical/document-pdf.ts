/**
 * PDF da declaração gerado no navegador (jsPDF + qrcode), com o mesmo conteúdo
 * e a mesma disposição de documents/document-pdf.ts (pdfkit no back-end): A4,
 * marca, título, texto da declaração, emissão, código e QR code de verificação.
 */
import { DateTime } from 'luxon';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import {
  DEFAULT_TIMEZONE,
  DOCUMENT_DISCLAIMER,
  DOCUMENT_TYPE_LABELS,
  type DocumentType,
} from '@pulso/contracts';

export interface DocumentPdfInput {
  type: DocumentType;
  holderName: string;
  unitName: string;
  /** ISO */
  attendedAt: string;
  /** ISO */
  issuedAt: string;
  verificationCode: string;
  verificationUrl: string;
}

const BRAND = '#A3123A';
const INK = '#1F2937';
const MUTED = '#6B7280';
const MARGIN = 56;
/** Altura de linha do pdfkit com Helvetica (ascendente + descendente + espaço). */
const LINE = 1.156;

function local(date: string) {
  return DateTime.fromISO(date).setZone(DEFAULT_TIMEZONE);
}

/** Texto da declaração: só o fato (comparecimento ou doação), nenhuma informação clínica (RN16). */
export function declarationText(input: DocumentPdfInput): string {
  const date = local(input.attendedAt).toFormat('dd/MM/yyyy');
  const time = local(input.attendedAt).toFormat("HH'h'mm");
  return input.type === 'DONATION_DECLARATION'
    ? `Declaramos, para os devidos fins, que ${input.holderName} realizou doação voluntária de sangue em ${date}, na unidade ${input.unitName}.`
    : `Declaramos, para os devidos fins, que ${input.holderName} compareceu à unidade ${input.unitName} em ${date}, às ${time}, para atendimento de doação de sangue.`;
}

/** Gera o PDF da declaração (A4) com QR code de verificação pública. */
export async function renderDocumentPdf(
  input: DocumentPdfInput,
): Promise<{ pdf: Uint8Array; sha256: string }> {
  const [{ jsPDF }, QRCode] = await Promise.all([import('jspdf'), import('qrcode')]);
  const title = DOCUMENT_TYPE_LABELS[input.type];
  const qr = await QRCode.toDataURL(input.verificationUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 220,
  });

  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  doc.setProperties({
    title: `${title} — SangueConecta`,
    author: 'SangueConecta (protótipo acadêmico)',
    subject: title,
    creator: 'SangueConecta (demonstração no navegador)',
  });
  doc.setCreationDate(new Date(input.issuedAt));

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const width = pageWidth - MARGIN * 2;
  const top = { baseline: 'top' as const };

  doc.setFillColor(BRAND);
  doc.rect(0, 0, pageWidth, 8, 'F');
  doc.setTextColor(BRAND).setFont('helvetica', 'bold').setFontSize(26);
  doc.text('SangueConecta', MARGIN, 48, top);
  let y = 48 + 26 * LINE;
  doc.setTextColor(MUTED).setFont('helvetica', 'normal').setFontSize(10);
  doc.text('Conectando doadores a vidas que precisam de ajuda.', MARGIN, y, top);
  y += 10 * LINE * 4; // a linha + moveDown(3)

  doc.setTextColor(INK).setFont('helvetica', 'bold').setFontSize(20);
  doc.text(title, pageWidth / 2, y, { ...top, align: 'center' });
  y += 20 * LINE * 3; // a linha + moveDown(2)

  const lineGap = 6;
  doc.setFont('helvetica', 'normal').setFontSize(13).setTextColor(INK);
  const paragraph: string[] = doc.splitTextToSize(declarationText(input), width);
  doc.text(paragraph, MARGIN, y, {
    ...top,
    maxWidth: width,
    align: 'justify',
    lineHeightFactor: (13 * LINE + lineGap) / 13,
  });
  y += paragraph.length * (13 * LINE + lineGap) + 13 * LINE * 2; // linhas + moveDown(2)

  const issued = local(input.issuedAt).toFormat("dd/MM/yyyy 'às' HH'h'mm");
  doc.setFontSize(10).setTextColor(MUTED);
  doc.text(`Emitido em ${issued} (horário de Brasília).`, MARGIN, y, top);
  y += 10 * LINE;
  doc.text(`Código de verificação: ${input.verificationCode}`, MARGIN, y, top);
  y += 10 * LINE;

  const qrY = y + 24;
  doc.addImage(qr, 'PNG', MARGIN, qrY, 110, 110);
  const columnX = 180;
  const columnWidth = width - 124;
  let columnY = qrY + 20;
  const column = (text: string, color: string) => {
    const lines: string[] = doc.splitTextToSize(text, columnWidth);
    doc.setTextColor(color);
    doc.text(lines, columnX, columnY, { ...top, lineHeightFactor: LINE });
    columnY += lines.length * 10 * LINE;
  };
  doc.setFontSize(10);
  column('Confira a autenticidade deste documento:', INK);
  column(input.verificationUrl, BRAND);
  column('A verificação mostra apenas as iniciais do titular, a unidade e as datas.', MUTED);

  const footerY = pageHeight - 96;
  doc.setDrawColor('#E5E7EB').setLineWidth(1);
  doc.line(MARGIN, footerY, pageWidth - MARGIN, footerY);
  doc.setTextColor(MUTED).setFontSize(9);
  doc.text(DOCUMENT_DISCLAIMER, pageWidth / 2, footerY + 12, { ...top, align: 'center' });
  doc.text(
    'Este documento não contém informações clínicas.',
    pageWidth / 2,
    footerY + 12 + 9 * LINE,
    {
      ...top,
      align: 'center',
    },
  );

  const pdf = new Uint8Array(doc.output('arraybuffer'));
  return { pdf, sha256: bytesToHex(sha256(pdf)) };
}

/** Bytes ↔ base64 (o estado da demonstração só guarda JSON). */
export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
