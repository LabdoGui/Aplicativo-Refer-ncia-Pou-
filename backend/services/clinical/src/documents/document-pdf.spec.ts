import { createHash } from 'node:crypto';
import { declarationText, renderDocumentPdf, type DocumentPdfInput } from './document-pdf';

const input: DocumentPdfInput = {
  type: 'DONATION_DECLARATION',
  holderName: 'Mariana Alves Souza',
  unitName: 'Pulso Unidade Centro',
  attendedAt: new Date('2026-10-17T13:10:00Z'),
  issuedAt: new Date('2026-10-17T15:00:00Z'),
  verificationCode: 'PUL-7K3M9-QX2TB',
  verificationUrl: 'http://localhost:8080/verificar/PUL-7K3M9-QX2TB',
};

describe('documento em PDF', () => {
  it('gera um PDF válido com o hash do conteúdo', async () => {
    const { pdf, sha256 } = await renderDocumentPdf(input);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(2_000);
    expect(sha256).toBe(createHash('sha256').update(pdf).digest('hex'));
  });

  it('declara só o fato, com data local, sem informação clínica', () => {
    expect(declarationText(input)).toBe(
      'Declaramos, para os devidos fins, que Mariana Alves Souza realizou doação voluntária de sangue em 17/10/2026, na unidade Pulso Unidade Centro.',
    );
    const attendance = declarationText({ ...input, type: 'ATTENDANCE_DECLARATION' });
    expect(attendance).toContain(
      'compareceu à unidade Pulso Unidade Centro em 17/10/2026, às 10h10',
    );
    expect(attendance).not.toMatch(/apto|inapto|triagem/i);
  });
});
