import { Logger } from '@nestjs/common';
import { EventConsumer } from '@pulso/common';
import { EVENTS, type EventEnvelope } from '@pulso/contracts';
import { ProgressConsumer } from './progress.consumer';
import type { ProgressResult, ProgressService } from './progress.service';

const DONOR = '7c1f3c2a-9d4e-4b6a-8f1e-2a3b4c5d6e7f';

function envelope<T extends 'clinical.attendance.completed' | 'clinical.donation.completed'>(
  type: T,
  data: EventEnvelope<T>['data'],
  id = '0b9d7a3e-5f7c-4b1a-9e2d-1c3f5a7b9d11',
): EventEnvelope<T> {
  return { id, type, source: 'clinical-service', occurredAt: '2026-10-17T12:00:00.000Z', data };
}

const attendance = envelope(EVENTS.ATTENDANCE_COMPLETED, {
  attendanceId: 'a1',
  appointmentId: 'ap1',
  donorId: DONOR,
  unitId: 'u1',
  donationCompleted: true,
  donationId: 'd1',
  campaignId: 'c1',
  occurredAt: '2026-10-17T11:00:00.000Z',
});

const donation = envelope(
  EVENTS.DONATION_COMPLETED,
  {
    donationId: 'd1',
    code: 'DO-ABC123',
    donorId: DONOR,
    unitId: 'u1',
    attendanceId: 'a1',
    campaignId: null,
    occurredAt: '2026-10-17T11:30:00.000Z',
  },
  '1c9d7a3e-5f7c-4b1a-9e2d-1c3f5a7b9d22',
);

function result(overrides: Partial<ProgressResult> = {}): ProgressResult {
  return {
    awards: [],
    pointsAwarded: 0,
    totalPoints: 0,
    unlocked: [],
    hoursCreated: false,
    ...overrides,
  };
}

describe('ProgressConsumer', () => {
  let processed: Set<string>;
  let consumer: EventConsumer;
  let progress: { recordAttendance: jest.Mock; recordDonation: jest.Mock };
  let outbox: { enqueue: jest.Mock };

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    processed = new Set();
    // Transação falsa com a tabela processed_events em memória (como no Postgres).
    const prisma = {
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const pending: string[] = [];
        const tx = {
          // Registro de contas excluídas: nenhuma nos testes.
          $queryRawUnsafe: jest.fn(async () => []),
          $executeRawUnsafe: jest.fn(async (_sql: string, id: string, handler: string) => {
            const key = `${id}:${handler}`;
            if (processed.has(key) || pending.includes(key)) return 0;
            pending.push(key);
            return 1;
          }),
        };
        const value = await fn(tx);
        pending.forEach((key) => processed.add(key));
        return value;
      }),
    };
    consumer = new EventConsumer({} as never, prisma as never, 'engagement-service');
    progress = {
      recordAttendance: jest.fn(async () =>
        result({
          awards: [
            { reason: 'FIRST', points: 100, description: 'Primeiro comparecimento para doar' },
            { reason: 'CAMPAIGN', points: 50, description: 'Participação em campanha' },
          ],
          pointsAwarded: 150,
          totalPoints: 150,
        }),
      ),
      recordDonation: jest.fn(async () =>
        result({
          unlocked: [
            {
              code: 'FIRST_DONATION',
              name: 'Primeira Doação',
              criteria: 'DONATION_COUNT',
              threshold: 1,
              active: true,
            },
          ],
          totalPoints: 150,
        }),
      ),
    };
    outbox = { enqueue: jest.fn(async () => ({})) };
    new ProgressConsumer(
      consumer,
      progress as unknown as ProgressService,
      outbox as never,
    ).onModuleInit();
  });

  it('dá os pontos do comparecimento e publica engagement.points.awarded', async () => {
    await consumer.dispatch(attendance);
    expect(progress.recordAttendance).toHaveBeenCalledWith(expect.anything(), {
      donorId: DONOR,
      campaignId: 'c1',
      occurredAt: new Date('2026-10-17T11:00:00.000Z'),
      sourceEventId: attendance.id,
    });
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      EVENTS.POINTS_AWARDED,
      {
        donorId: DONOR,
        points: 150,
        reason: 'Primeiro comparecimento para doar + Participação em campanha',
        totalPoints: 150,
      },
      undefined,
    );
  });

  it('ignora a segunda entrega do mesmo evento (consumidor idempotente)', async () => {
    await consumer.dispatch(attendance);
    await consumer.dispatch(attendance);
    expect(progress.recordAttendance).toHaveBeenCalledTimes(1);
    expect(outbox.enqueue).toHaveBeenCalledTimes(1);
  });

  it('publica uma conquista por desbloqueio e nada de pontos quando não há pontos', async () => {
    await consumer.dispatch(donation);
    expect(progress.recordDonation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ donationId: 'd1', campaignId: null, sourceEventId: donation.id }),
    );
    expect(outbox.enqueue).toHaveBeenCalledTimes(1);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      EVENTS.ACHIEVEMENT_UNLOCKED,
      { donorId: DONOR, achievementCode: 'FIRST_DONATION', achievementName: 'Primeira Doação' },
      undefined,
    );
  });

  it('não marca o evento como processado se o tratamento falhar (será tentado de novo)', async () => {
    progress.recordAttendance.mockRejectedValueOnce(new Error('banco fora'));
    await expect(consumer.dispatch(attendance)).rejects.toThrow('banco fora');
    await consumer.dispatch(attendance);
    expect(progress.recordAttendance).toHaveBeenCalledTimes(2);
  });
});
