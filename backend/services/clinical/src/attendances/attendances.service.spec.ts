import { AppException, todayLocal } from '@pulso/common';
import type { AuthUser, InternalAppointmentView } from '@pulso/contracts';
import { AttendancesService } from './attendances.service';

const nurse: AuthUser = { id: 'n1', role: 'NURSE', name: 'Enf. Teste', unitIds: ['u-centro'] };

const appointment: InternalAppointmentView = {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'AG-AAAAAA',
  donorId: 'd1',
  unitId: 'u-centro',
  unitName: 'Pulso Unidade Centro',
  status: 'CHECKED_IN',
  startsAt: '2026-10-17T12:00:00.000Z',
  campaignId: null,
  campaignTitle: null,
};

const fields = [
  {
    code: 'WEIGHT',
    label: 'Peso',
    type: 'NUMBER',
    options: null,
    required: true,
    min: 30,
    max: 250,
  },
];

function setup(overrides: Partial<InternalAppointmentView> = {}) {
  const prisma = {
    professionalScreening: {
      findUnique: jest.fn(async () => null),
      findFirst: jest.fn(async (): Promise<{ id: string } | null> => null),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'att-1',
        createdAt: new Date('2026-10-17T12:10:00Z'),
        donation: null,
        ...data,
      })),
    },
    professionalScreeningField: { findMany: jest.fn(async () => fields) },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma));
  const scheduling = { appointment: jest.fn(async () => ({ ...appointment, ...overrides })) };
  const outbox = { enqueue: jest.fn(async () => ({})) };
  const audit = { record: jest.fn(async () => undefined) };
  const encryption = {
    encryptJson: jest.fn((value: unknown) => `cifrado:${JSON.stringify(value)}`),
    encrypt: jest.fn((value: string) => `cifrado:${value}`),
  };
  const preScreenings = { sharedForStaff: jest.fn(async () => ({ id: 'pre-1' })) };
  const service = new AttendancesService(
    prisma as never,
    encryption as never,
    scheduling as never,
    preScreenings as never,
    outbox as never,
    audit as never,
  );
  return { service, prisma, outbox, audit, preScreenings };
}

const dto = { appointmentId: appointment.id, values: { WEIGHT: 70 }, result: 'FIT' as const };

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(AppException);
  await promise.catch((error: AppException) => expect(error.code).toBe(code));
}

describe('AttendancesService.record', () => {
  it('exige check-in antes da triagem', async () => {
    const { service } = setup({ status: 'BOOKED' });
    await expectCode(service.record(nurse, dto), 'APPOINTMENT_NOT_CHECKED_IN');
  });

  it('recusa profissional de outra unidade', async () => {
    const { service } = setup({ unitId: 'u-norte' });
    await expectCode(service.record(nurse, dto), 'UNIT_SCOPE');
  });

  it('valida os campos configurados', async () => {
    const { service } = setup();
    await expectCode(service.record(nurse, { ...dto, values: { WEIGHT: 5 } }), 'VALIDATION_ERROR');
  });

  it('apto: grava cifrado e deixa o atendimento aberto para a doação', async () => {
    const { service, prisma, outbox } = setup();
    const view = await service.record(nurse, dto);
    expect(view.completed).toBe(false);
    const data = prisma.professionalScreening.create.mock.calls[0][0].data;
    expect(data.valuesEncrypted).toBe('cifrado:{"WEIGHT":70}');
    expect(data.professionalName).toBe('Enf. Teste');
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('sem aptidão: finaliza o atendimento e publica o evento sem o resultado', async () => {
    const { service, outbox, audit } = setup();
    const view = await service.record(nurse, { ...dto, result: 'UNFIT', notes: 'observação' });
    expect(view.completed).toBe(true);
    const [, type, data] = outbox.enqueue.mock.calls[0] as unknown as [
      unknown,
      string,
      Record<string, unknown>,
    ];
    expect(type).toBe('clinical.attendance.completed');
    expect(data).toMatchObject({ donationCompleted: false, donationId: null, donorId: 'd1' });
    // RN19: nem o evento nem a auditoria levam o resultado da triagem ou valores.
    expect(JSON.stringify(data)).not.toMatch(/UNFIT|WEIGHT|observação/);
    expect(JSON.stringify(audit.record.mock.calls)).not.toMatch(/UNFIT|WEIGHT|observação/);
  });

  it('não registra duas triagens para o mesmo agendamento', async () => {
    const { service, prisma } = setup();
    prisma.professionalScreening.findUnique.mockResolvedValueOnce({ id: 'existente' } as never);
    await expectCode(service.record(nurse, dto), 'ATTENDANCE_EXISTS');
  });
});

describe('AttendancesService.sharedPreScreening', () => {
  const todayNoon = `${todayLocal()}T15:00:00.000Z`;

  it('libera durante o atendimento e audita o acesso', async () => {
    const { service, audit, preScreenings } = setup({ status: 'CHECKED_IN' });
    await expect(service.sharedPreScreening(nurse, appointment.id)).resolves.toEqual({
      id: 'pre-1',
    });
    expect(preScreenings.sharedForStaff).toHaveBeenCalledWith('d1', appointment.startsAt);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'prescreening.viewed_by_staff' }),
    );
  });

  it('libera agendamento do dia antes do check-in', async () => {
    const { service } = setup({ status: 'CONFIRMED', startsAt: todayNoon });
    await expect(service.sharedPreScreening(nurse, appointment.id)).resolves.toEqual({
      id: 'pre-1',
    });
  });

  it.each(['CANCELLED', 'NO_SHOW', 'COMPLETED'] as const)(
    'recusa agendamento %s',
    async (status) => {
      const { service, preScreenings } = setup({ status, startsAt: todayNoon });
      await expectCode(
        service.sharedPreScreening(nurse, appointment.id),
        'PRESCREENING_NOT_AVAILABLE',
      );
      expect(preScreenings.sharedForStaff).not.toHaveBeenCalled();
    },
  );

  it('recusa agendamento de outro dia ainda não atendido', async () => {
    const { service } = setup({ status: 'BOOKED', startsAt: '2020-01-10T12:00:00.000Z' });
    await expectCode(
      service.sharedPreScreening(nurse, appointment.id),
      'PRESCREENING_NOT_AVAILABLE',
    );
  });

  it('recusa depois que o atendimento terminou', async () => {
    const { service, prisma } = setup({ status: 'CHECKED_IN' });
    prisma.professionalScreening.findFirst.mockResolvedValueOnce({ id: 'att-1' });
    await expectCode(
      service.sharedPreScreening(nurse, appointment.id),
      'PRESCREENING_NOT_AVAILABLE',
    );
  });

  it('recusa profissional de outra unidade', async () => {
    const { service } = setup({ unitId: 'u-norte' });
    await expectCode(service.sharedPreScreening(nurse, appointment.id), 'UNIT_SCOPE');
  });
});
