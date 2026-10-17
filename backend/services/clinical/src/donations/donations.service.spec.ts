import { AppException } from '@pulso/common';
import type { AuthUser } from '@pulso/contracts';
import { DonationsService } from './donations.service';

const nurse: AuthUser = { id: 'n1', role: 'NURSE', name: 'Enf. Teste', unitIds: ['u-centro'] };
const donor: AuthUser = { id: 'd1', role: 'DONOR', name: 'Doadora', unitIds: [] };

const attendance = {
  id: 'att-1',
  appointmentId: 'ap-1',
  donorId: 'd1',
  unitId: 'u-centro',
  unitName: 'Pulso Unidade Centro',
  campaignId: 'camp-1',
  campaignTitle: 'Campanha',
  result: 'FIT',
  completedAt: null as Date | null,
  createdAt: new Date('2026-10-17T12:10:00Z'),
  professionalName: 'Enf. Teste',
  donation: null as { id: string } | null,
};

function setup(state: Partial<typeof attendance> = {}) {
  const prisma = {
    professionalScreening: {
      findUnique: jest.fn(async () => ({ ...attendance, ...state })),
      update: jest.fn(async () => ({
        ...attendance,
        completedAt: new Date(),
        donation: { id: 'don-1', code: 'DO-AAAAAA', status: 'COMPLETED' },
      })),
    },
    donation: {
      findUnique: jest.fn(async () => null),
      findFirst: jest.fn(async () => ({ occurredAt: new Date('2026-07-01T13:00:00Z') })),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'don-1',
        ...data,
      })),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma));
  const settings = {
    get: jest.fn(async () => ({
      donationIntervalDays: 90,
      preScreeningValidityDays: 30,
      intervalValidationStatus: 'PENDING_VALIDATION',
    })),
  };
  const outbox = { enqueue: jest.fn(async () => ({})) };
  const audit = { record: jest.fn(async () => undefined) };
  const service = new DonationsService(
    prisma as never,
    { encrypt: (value: string) => `cifrado:${value}` } as never,
    settings as never,
    outbox as never,
    audit as never,
  );
  return { service, prisma, outbox };
}

const dto = {
  attendanceId: 'att-1',
  bloodType: 'O_POS' as const,
  volumeMl: 450,
  status: 'COMPLETED' as const,
};

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(AppException);
  await promise.catch((error: AppException) => expect(error.code).toBe(code));
}

describe('DonationsService.record', () => {
  it('só registra doação de triagem apta', async () => {
    const { service } = setup({ result: 'NEEDS_EVALUATION' });
    await expectCode(service.record(nurse, dto), 'SCREENING_NOT_FIT');
  });

  it('não registra duas vezes', async () => {
    const { service } = setup({ donation: { id: 'x' } });
    await expectCode(service.record(nurse, dto), 'DONATION_EXISTS');
  });

  it('respeita a unidade do profissional', async () => {
    const { service } = setup({ unitId: 'u-norte' });
    await expectCode(service.record(nurse, dto), 'UNIT_SCOPE');
  });

  it('doação concluída: data informativa, dois eventos e atendimento finalizado', async () => {
    const { service, prisma, outbox } = setup();
    const view = await service.record(nurse, dto);
    expect(view.completed).toBe(true);
    const data = prisma.donation.create.mock.calls[0][0].data;
    expect(data.nextEligibleAt).toBeInstanceOf(Date);
    expect(data.campaignId).toBe('camp-1');
    const types = outbox.enqueue.mock.calls.map(
      (call) => (call as unknown as [unknown, string])[1],
    );
    expect(types).toEqual(['clinical.donation.completed', 'clinical.attendance.completed']);
    const attendanceEvent = (
      outbox.enqueue.mock.calls[1] as unknown as [unknown, string, Record<string, unknown>]
    )[2];
    expect(attendanceEvent).toMatchObject({
      donationCompleted: true,
      donationId: 'don-1',
      appointmentId: 'ap-1',
    });
  });

  it('coleta interrompida: sem data informativa e sem evento de doação concluída', async () => {
    const { service, prisma, outbox } = setup();
    await service.record(nurse, { ...dto, status: 'NOT_COMPLETED', volumeMl: 120 });
    expect(prisma.donation.create.mock.calls[0][0].data.nextEligibleAt).toBeNull();
    const types = outbox.enqueue.mock.calls.map(
      (call) => (call as unknown as [unknown, string])[1],
    );
    expect(types).toEqual(['clinical.attendance.completed']);
  });
});

describe('DonationsService.attendance', () => {
  it('outro doador recebe 404', async () => {
    const { service } = setup({ completedAt: new Date(), donorId: 'outra-pessoa' });
    await expectCode(service.attendance(donor, 'att-1'), 'ATTENDANCE_NOT_FOUND');
  });
});

describe('DonationsService.eligibility', () => {
  it('calcula a data informativa com o intervalo vigente', async () => {
    const { service } = setup();
    const view = await service.eligibility(donor);
    expect(view).toMatchObject({
      nextEligibleAt: '2026-09-29',
      intervalDays: 90,
      validationStatus: 'PENDING_VALIDATION',
    });
  });
});
