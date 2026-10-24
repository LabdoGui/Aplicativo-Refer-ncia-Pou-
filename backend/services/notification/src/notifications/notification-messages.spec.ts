import type { NotificationDraft } from './notification-messages';
import * as messages from './notification-messages';
import { BODY_MAX, TITLE_MAX } from './notification-messages';

const DONOR = '6f1b0a52-3a52-4a8e-9d5e-0c4a9b1f2e11';
const APPOINTMENT = '0b9d7a3e-5f7c-4b1a-9e2d-1c3f5a7b9d11';
const ATTENDANCE = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';

/**
 * Termos de resultado ou dado clínico que nunca podem aparecer em mensagens
 * automáticas (RN19). O convite para a pré-triagem informativa é permitido.
 */
const CLINICAL = /\bapt[oa]s?\b|inapt|resultado|hemoglobina|press[aã]o|\bpeso\b|motivo|necessita/i;

function expectSafe(draft: NotificationDraft | null): NotificationDraft {
  expect(draft).not.toBeNull();
  const item = draft as NotificationDraft;
  expect(Array.from(item.title).length).toBeLessThanOrEqual(TITLE_MAX);
  expect(Array.from(item.body).length).toBeLessThanOrEqual(BODY_MAX);
  expect(`${item.title} ${item.body}`).not.toMatch(CLINICAL);
  return item;
}

describe('mensagens de notificação', () => {
  it('boas-vindas só para doadores, com o primeiro nome', () => {
    const item = expectSafe(
      messages.welcome({ userId: DONOR, name: 'Maria da Silva', role: 'DONOR' }),
    );
    expect(item).toMatchObject({ type: 'WELCOME', link: '/app', userId: DONOR });
    expect(item.body).toContain('Olá, Maria!');
    expect(messages.welcome({ userId: DONOR, name: 'Ana', role: 'NURSE' })).toBeNull();
  });

  it('agendamento confirmado com unidade, data local e código', () => {
    const item = expectSafe(
      messages.appointmentBooked({
        appointmentId: APPOINTMENT,
        code: 'AG-7K3M9P',
        donorId: DONOR,
        unitId: 'u1',
        unitName: 'SangueConecta Unidade Centro',
        startsAt: '2026-10-16T12:30:00.000Z',
        campaignId: null,
      }),
    );
    expect(item.type).toBe('APPOINTMENT_CONFIRMED');
    expect(item.body).toBe(
      'sex., 16/10 às 09:30 em SangueConecta Unidade Centro. Código AG-7K3M9P.',
    );
    expect(item.link).toBe(`/app/agendamentos/${APPOINTMENT}`);
  });

  it('cancelamento muda o texto conforme quem cancelou', () => {
    const base = {
      appointmentId: APPOINTMENT,
      donorId: DONOR,
      unitName: 'SangueConecta Unidade Centro',
      startsAt: '2026-10-16T12:30:00.000Z',
    };
    const byDonor = expectSafe(messages.appointmentCancelled({ ...base, cancelledBy: 'DONOR' }));
    expect(byDonor.title).toBe('Cancelamento confirmado');
    const byUnit = expectSafe(messages.appointmentCancelled({ ...base, cancelledBy: 'STAFF' }));
    expect(byUnit.title).toBe('Seu agendamento foi cancelado pela unidade');
    expect(byUnit.body).toContain('novo horário');
    expect(byUnit.link).toBe('/app/agendar');
  });

  it('lembrete diz "hoje" ou "amanhã" pelo dia local', () => {
    const data = {
      appointmentId: APPOINTMENT,
      donorId: DONOR,
      unitName: 'SangueConecta Unidade Centro',
      startsAt: '2026-10-17T12:00:00.000Z',
    };
    expect(expectSafe(messages.appointmentReminder(data, '2026-10-17')).title).toBe(
      'Lembrete: sua doação é hoje',
    );
    const tomorrow = expectSafe(messages.appointmentReminder(data, '2026-10-16'));
    expect(tomorrow.title).toBe('Lembrete: sua doação é amanhã');
    expect(tomorrow.body).toContain('Amanhã às 09:00');
    expect(tomorrow.body).toContain('documento oficial com foto');
    expect(expectSafe(messages.appointmentReminder(data, '2026-10-10')).title).toBe(
      'Lembrete: sua doação está chegando',
    );
  });

  it('atendimento sem doação agradece sem revelar o resultado; com doação é ignorado', () => {
    const base = {
      attendanceId: ATTENDANCE,
      appointmentId: APPOINTMENT,
      donorId: DONOR,
      unitId: 'u1',
      donationId: null,
      campaignId: null,
      occurredAt: '2026-10-17T12:00:00.000Z',
    };
    const item = expectSafe(messages.attendanceCompleted({ ...base, donationCompleted: false }));
    expect(item).toMatchObject({
      type: 'ATTENDANCE_COMPLETED',
      link: `/app/doacoes/${ATTENDANCE}`,
    });
    expect(messages.attendanceCompleted({ ...base, donationCompleted: true })).toBeNull();
  });

  it('doação concluída leva para a tela de agradecimento', () => {
    const item = expectSafe(
      messages.donationCompleted({
        donationId: 'd1',
        code: 'DO-ABC123',
        donorId: DONOR,
        unitId: 'u1',
        attendanceId: ATTENDANCE,
        campaignId: null,
        occurredAt: '2026-10-17T12:00:00.000Z',
      }),
    );
    expect(item.link).toBe(`/app/doacoes/${ATTENDANCE}/obrigado`);
  });

  it('documento, pontos e conquista', () => {
    expect(
      expectSafe(
        messages.documentIssued({ documentId: 'x', donorId: DONOR, title: 'Declaração de doação' }),
      ).body,
    ).toBe('Declaração de doação disponível para visualizar e baixar.');
    const points = expectSafe(
      messages.pointsAwarded({
        donorId: DONOR,
        points: 150,
        reason: 'RECURRING',
        totalPoints: 250,
      }),
    );
    expect(points.title).toBe('+150 pontos');
    expect(points.body).toContain('250 pontos');
    expect(
      messages.pointsAwarded({ donorId: DONOR, points: 0, reason: 'X', totalPoints: 10 }),
    ).toBeNull();
    const achievement = expectSafe(
      messages.achievementUnlocked({
        donorId: DONOR,
        achievementCode: 'FIRST_DONATION',
        achievementName: 'Primeira Doação',
      }),
    );
    expect(achievement.title).toBe('Nova conquista: Primeira Doação');
  });

  it('horas complementares aprovadas e não aprovadas (texto neutro)', () => {
    const base = { hoursId: 'h1', donorId: DONOR, hours: 4, institutionName: 'Faculdade Exemplo' };
    expect(expectSafe(messages.hoursReviewed({ ...base, status: 'APPROVED' })).title).toBe(
      'Horas complementares aprovadas',
    );
    const rejected = expectSafe(messages.hoursReviewed({ ...base, status: 'REJECTED' }));
    expect(rejected.body).toContain('fale com a sua instituição');
    expect(rejected.link).toBe('/app/horas');
  });

  it('alerta de estoque só quando piora ou volta ao adequado, para cada administrador', () => {
    const admins = ['a1', 'a2'];
    const worse = messages.stockAlert(
      { bloodType: 'O_NEG', previousStatus: 'ATTENTION', status: 'CRITICAL', quantity: 12 },
      admins,
    );
    expect(worse.map((item) => item.userId)).toEqual(admins);
    expect(worse[0].title).toBe('Estoque crítico: O−');
    expect(worse[0].body).toBe(
      'O estoque de O− está abaixo do mínimo (12 bolsas). Avalie campanhas e movimentações.',
    );
    expect(worse[0].link).toBe('/admin/estoque');

    expect(
      messages.stockAlert(
        { bloodType: 'A_POS', previousStatus: 'NORMAL', status: 'ATTENTION', quantity: 1 },
        admins,
      )[0].body,
    ).toContain('abaixo do ideal (1 bolsa)');
    expect(
      messages.stockAlert(
        { bloodType: 'A_POS', previousStatus: 'CRITICAL', status: 'NORMAL', quantity: 200 },
        admins,
      )[0].title,
    ).toBe('Estoque adequado: A+');
    // Melhora parcial (crítico → atenção) não gera aviso.
    expect(
      messages.stockAlert(
        { bloodType: 'A_POS', previousStatus: 'CRITICAL', status: 'ATTENTION', quantity: 50 },
        admins,
      ),
    ).toEqual([]);
  });

  it('corta textos longos no limite', () => {
    const item = expectSafe(
      messages.appointmentBooked({
        appointmentId: APPOINTMENT,
        code: 'AG-7K3M9P',
        donorId: DONOR,
        unitId: 'u1',
        unitName: 'Unidade '.repeat(40),
        startsAt: '2026-10-16T12:30:00.000Z',
        campaignId: null,
      }),
    );
    expect(item.body.endsWith('…')).toBe(true);
  });
});
