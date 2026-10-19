import { UserDeletedHandler } from './user-deleted.handler';

type Handler = (envelope: unknown, tx: unknown) => Promise<void>;

function setup(open: Array<{ id: string; slotId: string }>, updated = 1) {
  let handler: Handler | undefined;
  const consumer = {
    on: jest.fn((_type: string, _name: string, fn: Handler) => {
      handler = fn;
    }),
  };
  const audit = { record: jest.fn(async () => undefined) };
  const tx = {
    appointment: {
      findMany: jest.fn(async () => open),
      updateMany: jest.fn(async () => ({ count: updated })),
    },
    $executeRawUnsafe: jest.fn(async () => 1),
  };
  new UserDeletedHandler(consumer as never, audit as never).onModuleInit();
  const run = () =>
    handler!({ id: 'e1', data: { userId: 'd1', occurredAt: '2026-10-19T12:00:00Z' } }, tx);
  return { run, tx, audit, consumer };
}

describe('UserDeletedHandler (scheduling)', () => {
  it('cancela os agendamentos em aberto pelo sistema e libera as vagas', async () => {
    const { run, tx, audit, consumer } = setup([
      { id: 'a1', slotId: 's1' },
      { id: 'a2', slotId: 's2' },
    ]);
    await run();
    expect(consumer.on).toHaveBeenCalledWith(
      'identity.user.deleted',
      'cancel-open-appointments',
      expect.any(Function),
    );
    expect(tx.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { donorId: 'd1', status: { in: ['BOOKED', 'CONFIRMED'] } },
      }),
    );
    expect(tx.appointment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'CANCELLED', cancelledBy: 'SYSTEM' }),
      }),
    );
    expect(tx.$executeRawUnsafe).toHaveBeenCalledTimes(2);
    expect(audit.record).toHaveBeenCalledTimes(2);
  });

  it('não libera vaga de agendamento que mudou de situação no meio do caminho', async () => {
    const { run, tx, audit } = setup([{ id: 'a1', slotId: 's1' }], 0);
    await run();
    expect(tx.$executeRawUnsafe).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});
