import { EVENTS, type EventEnvelope, type EventType } from '@pulso/contracts';
import { NotificationsConsumer } from './notifications.consumer';

type Handler = (envelope: EventEnvelope, tx: unknown) => Promise<void>;

const DONOR = '6f1b0a52-3a52-4a8e-9d5e-0c4a9b1f2e11';
const EVENT_ID = '0b9d7a3e-5f7c-4b1a-9e2d-1c3f5a7b9d11';

function setup() {
  const handlers = new Map<EventType, Handler>();
  const consumer = {
    on: jest.fn((type: EventType, _name: string, handler: Handler) => handlers.set(type, handler)),
  };
  const http = {
    get: jest.fn(async (): Promise<unknown> => [{ id: 'admin-1' }, { id: 'admin-2' }]),
  };
  // Tabela falsa com a chave única (sourceEventId, userId, type).
  const stored = new Map<string, unknown>();
  const tx = {
    notification: {
      deleteMany: jest.fn(async () => ({ count: 3 })),
      createMany: jest.fn(
        async ({
          data,
        }: {
          data: Array<{ sourceEventId: string; userId: string; type: string }>;
        }) => {
          let count = 0;
          for (const row of data) {
            const key = `${row.sourceEventId}|${row.userId}|${row.type}`;
            if (!stored.has(key)) {
              stored.set(key, row);
              count++;
            }
          }
          return { count };
        },
      ),
    },
  };
  const service = new NotificationsConsumer(
    consumer as never,
    http as never,
    { IDENTITY_URL: 'http://identity:3001' } as never,
  );
  service.onModuleInit();
  return { handlers, http, tx, stored, consumer };
}

function envelope<T extends EventType>(type: T, data: unknown): EventEnvelope {
  return {
    id: EVENT_ID,
    type,
    source: 'teste',
    occurredAt: '2026-10-17T12:00:00.000Z',
    data,
  } as EventEnvelope;
}

describe('NotificationsConsumer', () => {
  it('registra um handler por evento da jornada', () => {
    const { handlers, consumer } = setup();
    expect(handlers.size).toBe(13);
    const names = consumer.on.mock.calls.map((call) => call[1]);
    expect(new Set(names).size).toBe(names.length);
  });

  it('entrega repetida do mesmo evento não duplica a notificação', async () => {
    const { handlers, tx, stored } = setup();
    const event = envelope(EVENTS.USER_REGISTERED, { userId: DONOR, name: 'Maria', role: 'DONOR' });
    await handlers.get(EVENTS.USER_REGISTERED)!(event, tx);
    await handlers.get(EVENTS.USER_REGISTERED)!(event, tx);
    expect(stored.size).toBe(1);
    const [row] = [...stored.values()] as Array<Record<string, unknown>>;
    expect(row).toMatchObject({ userId: DONOR, type: 'WELCOME', sourceEventId: EVENT_ID });
  });

  it('não grava nada quando o evento não gera aviso', async () => {
    const { handlers, tx } = setup();
    await handlers.get(EVENTS.ATTENDANCE_COMPLETED)!(
      envelope(EVENTS.ATTENDANCE_COMPLETED, {
        attendanceId: 'a1',
        appointmentId: null,
        donorId: DONOR,
        unitId: 'u1',
        donationCompleted: true,
        donationId: 'd1',
        campaignId: null,
        occurredAt: '2026-10-17T12:00:00.000Z',
      }),
      tx,
    );
    expect(tx.notification.createMany).not.toHaveBeenCalled();
  });

  it('alerta de estoque vai para todos os administradores ativos', async () => {
    const { handlers, tx, http, stored } = setup();
    await handlers.get(EVENTS.STOCK_LEVEL_CHANGED)!(
      envelope(EVENTS.STOCK_LEVEL_CHANGED, {
        bloodType: 'O_NEG',
        previousStatus: 'ATTENTION',
        status: 'CRITICAL',
        quantity: 10,
      }),
      tx,
    );
    expect(http.get).toHaveBeenCalledWith('http://identity:3001', '/api/v1/internal/users', {
      query: { role: 'ADMIN' },
      requestId: undefined,
    });
    expect(stored.size).toBe(2);
  });

  it('não consulta o identity quando o nível não exige alerta', async () => {
    const { handlers, tx, http } = setup();
    await handlers.get(EVENTS.STOCK_LEVEL_CHANGED)!(
      envelope(EVENTS.STOCK_LEVEL_CHANGED, {
        bloodType: 'O_NEG',
        previousStatus: 'CRITICAL',
        status: 'ATTENTION',
        quantity: 30,
      }),
      tx,
    );
    expect(http.get).not.toHaveBeenCalled();
  });

  it('falha do identity propaga o erro (o consumidor tenta de novo)', async () => {
    const { handlers, tx, http } = setup();
    http.get.mockRejectedValueOnce(new Error('identity fora'));
    await expect(
      handlers.get(EVENTS.STOCK_LEVEL_CHANGED)!(
        envelope(EVENTS.STOCK_LEVEL_CHANGED, {
          bloodType: 'A_NEG',
          previousStatus: 'NORMAL',
          status: 'CRITICAL',
          quantity: 3,
        }),
        tx,
      ),
    ).rejects.toThrow('identity fora');
    expect(tx.notification.createMany).not.toHaveBeenCalled();
  });

  it('conta excluída: apaga as notificações da pessoa', async () => {
    const { handlers, tx } = setup();
    await handlers.get('identity.user.deleted')!(
      {
        id: '00000000-0000-4000-8000-000000000099',
        type: 'identity.user.deleted',
        source: 'identity-service',
        occurredAt: '2026-10-19T12:00:00Z',
        data: { userId: 'u1', occurredAt: '2026-10-19T12:00:00Z' },
      },
      tx,
    );
    expect(tx.notification.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
  });

  describe('lembrete de agendamento', () => {
    const reminder = {
      appointmentId: 'ap1',
      donorId: 'd1',
      unitName: 'Pulso Unidade Centro',
      startsAt: '2026-10-20T12:00:00.000Z',
    };

    it('cria o lembrete para quem aceitou "Lembretes e comunicações"', async () => {
      const { handlers, tx, http, stored } = setup();
      http.get.mockResolvedValueOnce({ granted: ['d1'] });
      await handlers.get(EVENTS.APPOINTMENT_REMINDER_DUE)!(
        envelope(EVENTS.APPOINTMENT_REMINDER_DUE, reminder),
        tx,
      );
      expect(http.get).toHaveBeenCalledWith(
        'http://identity:3001',
        '/api/v1/internal/users/communications-consent',
        { query: { ids: 'd1' }, requestId: undefined },
      );
      expect(stored.size).toBe(1);
    });

    it('não cria lembrete para quem recusou ou revogou o consentimento', async () => {
      const { handlers, tx, http, stored } = setup();
      http.get.mockResolvedValueOnce({ granted: [] });
      await handlers.get(EVENTS.APPOINTMENT_REMINDER_DUE)!(
        envelope(EVENTS.APPOINTMENT_REMINDER_DUE, reminder),
        tx,
      );
      expect(stored.size).toBe(0);
    });
  });
});
