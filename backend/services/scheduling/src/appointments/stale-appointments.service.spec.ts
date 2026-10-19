import { StaleAppointmentsService, NO_SHOW_GRACE_HOURS } from './stale-appointments.service';

function setup(noShows: string[], unfinished: string[]) {
  const tx = {
    $queryRawUnsafe: jest
      .fn()
      .mockResolvedValueOnce(noShows.map((id) => ({ id })))
      .mockResolvedValueOnce(unfinished.map((id) => ({ id }))),
  };
  const prisma = { $transaction: jest.fn(async (fn: (t: unknown) => unknown) => fn(tx)) };
  const audit = { record: jest.fn(async () => undefined) };
  const service = new StaleAppointmentsService(prisma as never, audit as never);
  return { service, tx, audit };
}

// 19/10/2026 10:00 em São Paulo (UTC−3).
const now = new Date('2026-10-19T13:00:00.000Z');

describe('StaleAppointmentsService.expire', () => {
  it('marca falta depois da tolerância e encerra check-in de antes de ontem', async () => {
    const { service, tx, audit } = setup(['a1', 'a2'], ['a3']);
    await expect(service.expire(now)).resolves.toBe(3);

    const [noShowSql, ...noShowParams] = tx.$queryRawUnsafe.mock.calls[0];
    expect(noShowSql).toContain(`"status" IN ('BOOKED', 'CONFIRMED')`);
    expect(noShowSql).not.toContain('donorId');
    expect(noShowParams).toEqual([
      now.toISOString(),
      new Date(now.getTime() - NO_SHOW_GRACE_HOURS * 3_600_000).toISOString(),
    ]);

    const [unfinishedSql, ...unfinishedParams] = tx.$queryRawUnsafe.mock.calls[1];
    expect(unfinishedSql).toContain(`"status" = 'CHECKED_IN'`);
    // Início de ontem no fuso local (00:00 de 18/10 em São Paulo = 03:00 UTC):
    // um check-in de ontem ainda pode receber a triagem atrasada.
    expect(unfinishedParams[1]).toBe('2026-10-18T03:00:00.000Z');

    expect(audit.record).toHaveBeenCalledTimes(3);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'appointment.no_show', entityId: 'a1', actor: null }),
      tx,
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'appointment.cancelled', entityId: 'a3' }),
      tx,
    );
  });

  it('restringe ao doador quando chamado antes de uma nova reserva', async () => {
    const { service, tx } = setup([], []);
    await expect(service.expire(now, 'd1')).resolves.toBe(0);
    for (const [sql, ...params] of tx.$queryRawUnsafe.mock.calls) {
      expect(sql).toContain(`"donorId" = $3::uuid`);
      expect(params[2]).toBe('d1');
    }
  });
});
