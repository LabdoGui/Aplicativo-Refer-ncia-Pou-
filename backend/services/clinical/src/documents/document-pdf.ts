import { createHash } from 'node:crypto';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { DateTime } from 'luxon';
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
  attendedAt: Date;
  issuedAt: Date;
  verificationCode: string;
  verificationUrl: string;
}

const BRAND = '#A3123A';
const INK = '#1F2937';
const MUTED = '#6B7280';

function local(date: Date) {
  return DateTime.fromJSDate(date).setZone(DEFAULT_TIMEZONE);
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
): Promise<{ pdf: Buffer; sha256: string }> {
  const title = DOCUMENT_TYPE_LABELS[input.type];
  const qr = await QRCode.toBuffer(input.verificationUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 220,
  });
  const doc = new PDFDocument({
    size: 'A4',
    margin: 56,
    info: {
      Title: `${title} — Pulso`,
      Author: 'Pulso (protótipo acadêmico)',
      Subject: title,
      CreationDate: input.issuedAt,
      ModDate: input.issuedAt,
    },
  });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const width = doc.page.width - 112;
  doc.rect(0, 0, doc.page.width, 8).fill(BRAND);
  doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(26).text('Pulso', 56, 48);
  doc.fillColor(MUTED).font('Helvetica').fontSize(10).text('Doe sangue. Mantenha a vida pulsando.');

  doc.moveDown(3);
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(20).text(title, { width, align: 'center' });
  doc.moveDown(2);
  doc.font('Helvetica').fontSize(13).fillColor(INK).text(declarationText(input), {
    width,
    align: 'justify',
    lineGap: 6,
  });

  doc.moveDown(2);
  const issued = local(input.issuedAt).toFormat("dd/MM/yyyy 'às' HH'h'mm");
  doc.fontSize(10).fillColor(MUTED).text(`Emitido em ${issued} (horário de Brasília).`, { width });
  doc.text(`Código de verificação: ${input.verificationCode}`, { width });

  const qrY = doc.y + 24;
  doc.image(qr, 56, qrY, { width: 110 });
  doc
    .fillColor(INK)
    .fontSize(10)
    .text('Confira a autenticidade deste documento:', 180, qrY + 20, { width: width - 124 })
    .fillColor(BRAND)
    .text(input.verificationUrl, { width: width - 124 })
    .fillColor(MUTED)
    .text('A verificação mostra apenas as iniciais do titular, a unidade e as datas.', {
      width: width - 124,
    });

  const footerY = doc.page.height - 96;
  doc
    .moveTo(56, footerY)
    .lineTo(doc.page.width - 56, footerY)
    .strokeColor('#E5E7EB')
    .stroke();
  doc
    .fillColor(MUTED)
    .fontSize(9)
    .text(DOCUMENT_DISCLAIMER, 56, footerY + 12, { width, align: 'center' })
    .text('Este documento não contém informações clínicas.', { width, align: 'center' });

  doc.end();
  const pdf = await finished;
  return { pdf, sha256: createHash('sha256').update(pdf).digest('hex') };
}
