import { AppException } from '@pulso/common';
import type { AuthUser } from '@pulso/contracts';
import { DocumentsService } from './documents.service';
import { hashVerificationCode } from './verification-code';

const donor: AuthUser = { id: 'd1', role: 'DONOR', name: 'Mariana Alves Souza', unitIds: [] };

function setup(attendance: Record<string, unknown> | null) {
  const stored: Record<string, unknown>[] = [];
  const prisma = {
    professionalScreening: { findUnique: jest.fn(async () => attendance) },
    document: {
      findUnique: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
        if ('verificationCodeHash' in where) {
          return (
            stored.find((doc) => doc.verificationCodeHash === where.verificationCodeHash) ?? null
          );
        }
        return null;
      }),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const doc = { id: 'doc-1', ...data };
        stored.push(doc);
        return doc;
      }),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma));
  const encryption = {
    encrypt: (value: string) => `cifrado:${value}`,
    decrypt: (value: string) => value.replace('cifrado:', ''),
  };
  const outbox = { enqueue: jest.fn(async () => ({})) };
  const service = new DocumentsService(
    prisma as never,
    encryption as never,
    outbox as never,
    { record: jest.fn(async () => undefined) } as never,
    { PUBLIC_APP_URL: 'http://localhost:8080' } as never,
  );
  return { service, outbox, stored };
}

const completed = {
  id: 'att-1',
  donorId: 'd1',
  unitName: 'SangueConecta Unidade Centro',
  completedAt: new Date('2026-10-17T13:00:00Z'),
  createdAt: new Date('2026-10-17T12:10:00Z'),
  donation: { status: 'COMPLETED' },
};

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(AppException);
  await promise.catch((error: AppException) => expect(error.code).toBe(code));
}

describe('DocumentsService', () => {
  it('emite a declaração, grava o hash do código e publica o evento', async () => {
    const { service, outbox, stored } = setup(completed);
    const { document, created } = await service.issue(donor, {
      attendanceId: 'att-1',
      type: 'DONATION_DECLARATION',
    });
    expect(created).toBe(true);
    expect(stored[0].verificationCodeHash).toBe(hashVerificationCode(document.verificationCode));
    expect(stored[0].holderInitials).toBe('M. A. S.');
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      'clinical.document.issued',
      { documentId: 'doc-1', donorId: 'd1', title: 'Declaração de doação' },
      undefined,
    );

    const verification = await service.verify(document.verificationCode.toLowerCase());
    expect(verification).toMatchObject({
      valid: true,
      holderInitials: 'M. A. S.',
      unitName: 'SangueConecta Unidade Centro',
      attendanceDate: '2026-10-17',
    });
  });

  it('declaração de doação exige doação concluída', async () => {
    const { service } = setup({ ...completed, donation: { status: 'NOT_COMPLETED' } });
    await expectCode(
      service.issue(donor, { attendanceId: 'att-1', type: 'DONATION_DECLARATION' }),
      'DONATION_NOT_COMPLETED',
    );
  });

  it('atendimento de outra pessoa ou não finalizado → 404', async () => {
    await expectCode(
      setup({ ...completed, donorId: 'outra' }).service.issue(donor, {
        attendanceId: 'att-1',
        type: 'ATTENDANCE_DECLARATION',
      }),
      'ATTENDANCE_NOT_FOUND',
    );
    await expectCode(
      setup({ ...completed, completedAt: null }).service.issue(donor, {
        attendanceId: 'att-1',
        type: 'ATTENDANCE_DECLARATION',
      }),
      'ATTENDANCE_NOT_FOUND',
    );
  });

  it('código desconhecido ou malformado não é válido', async () => {
    const { service } = setup(completed);
    expect((await service.verify('PUL-22222-22222')).valid).toBe(false);
    expect((await service.verify('qualquer coisa')).valid).toBe(false);
  });
});
