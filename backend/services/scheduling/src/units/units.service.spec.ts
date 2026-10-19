import type { AuthUser } from '@pulso/contracts';
import { UnitsService } from './units.service';

const admin: AuthUser = { id: 'a1', role: 'ADMIN', name: 'Ana', unitIds: [] };

function setup(affected: Array<{ id: string; slotId: string }>, updated = 1) {
  const tx = {
    scheduleBlock: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'blk-1',
        createdAt: new Date('2026-10-19T12:00:00Z'),
        ...data,
      })),
    },
    appointment: {
      findMany: jest.fn(async () =>
        affected.map((item) => ({
          ...item,
          donorId: `donor-${item.id}`,
          startsAt: new Date(Date.now() + 2 * 86_400_000),
          unit: { name: 'Pulso Unidade Centro' },
        })),
      ),
      updateMany: jest.fn(async () => ({ count: updated })),
    },
    $executeRawUnsafe: jest.fn(async () => 1),
  };
  const prisma = {
    healthUnit: { findUnique: jest.fn(async () => ({ id: 'u1', status: 'ACTIVE' })) },
    $transaction: jest.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
  };
  const audit = { record: jest.fn(async () => undefined) };
  const outbox = { enqueue: jest.fn(async () => ({})) };
  const service = new UnitsService(prisma as never, audit as never, outbox as never);
  return { service, tx, outbox, audit };
}

// Período sempre no futuro (o bloqueio precisa terminar depois de agora).
const inTwoDays = Date.now() + 2 * 86_400_000;
const dto = {
  startsAt: new Date(inTwoDays).toISOString(),
  endsAt: new Date(inTwoDays + 4 * 3_600_000).toISOString(),
  reason: 'Manutenção elétrica',
};

describe('UnitsService.createBlock (RF53)', () => {
  it('cancela os agendamentos do período, libera as vagas e avisa os doadores', async () => {
    const { service, tx, outbox } = setup([
      { id: 'ap1', slotId: 's1' },
      { id: 'ap2', slotId: 's2' },
    ]);
    const view = await service.createBlock(admin, 'u1', dto);
    expect(view.cancelledAppointments).toBe(2);
    expect(tx.appointment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'CANCELLED',
          cancelledBy: 'STAFF',
          cancelReason: 'Período bloqueado pela unidade: Manutenção elétrica',
        }),
      }),
    );
    expect(tx.$executeRawUnsafe).toHaveBeenCalledTimes(2);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      tx,
      'scheduling.appointment.cancelled',
      expect.objectContaining({ appointmentId: 'ap1', donorId: 'donor-ap1', cancelledBy: 'STAFF' }),
      undefined,
    );
  });

  it('agendamento que mudou de situação no meio do caminho não é contado nem avisado', async () => {
    const { service, outbox } = setup([{ id: 'ap1', slotId: 's1' }], 0);
    const view = await service.createBlock(admin, 'u1', dto);
    expect(view.cancelledAppointments).toBe(0);
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });
});
