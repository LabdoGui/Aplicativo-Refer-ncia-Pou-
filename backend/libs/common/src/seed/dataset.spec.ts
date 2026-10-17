import { ACTIVE_APPOINTMENT_STATUSES, BLOOD_TYPES } from '@pulso/contracts';
import { buildSeedDataset, SEED_IDS, seedUuid } from './dataset';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('buildSeedDataset', () => {
  const dataset = buildSeedDataset('2026-10-17');

  it('é determinístico (os serviços gravam partes coerentes)', () => {
    expect(JSON.stringify(buildSeedDataset('2026-10-17'))).toBe(JSON.stringify(dataset));
  });

  it('gera UUIDs v4 válidos e estáveis', () => {
    expect(seedUuid('x')).toMatch(UUID);
    expect(seedUuid('x')).toBe(seedUuid('x'));
    for (const user of dataset.users) expect(user.id).toMatch(UUID);
  });

  it('inclui as contas de demonstração pedidas', () => {
    const emails = dataset.users.map((user) => user.email);
    expect(emails).toEqual(
      expect.arrayContaining(['admin@demo.com', 'enfermeiro@demo.com', 'doador@demo.com']),
    );
    expect(new Set(emails).size).toBe(emails.length);
  });

  it('mantém no máximo um agendamento ativo por doador', () => {
    const counts = new Map<string, number>();
    for (const appointment of dataset.appointments) {
      if (ACTIVE_APPOINTMENT_STATUSES.includes(appointment.status)) {
        counts.set(appointment.donorId, (counts.get(appointment.donorId) ?? 0) + 1);
      }
    }
    expect(Math.max(...counts.values())).toBe(1);
    expect(counts.has(SEED_IDS.users.donor)).toBe(false);
  });

  it('liga cada atendimento a um agendamento concluído do mesmo doador', () => {
    const byId = new Map(dataset.appointments.map((a) => [a.id, a]));
    for (const attendance of dataset.attendances) {
      const appointment = byId.get(attendance.appointmentId);
      expect(appointment?.status).toBe('COMPLETED');
      expect(appointment?.donorId).toBe(attendance.donorId);
      if (attendance.donation) expect(attendance.screeningResult).toBe('FIT');
    }
  });

  it('reconstrói o estoque pelas movimentações, sem saldo negativo', () => {
    for (const item of dataset.stock) {
      const moves = dataset.movements.filter((m) => m.bloodType === item.bloodType);
      expect(moves.every((m) => m.balanceAfter >= 0 && m.quantity > 0)).toBe(true);
      expect(moves[moves.length - 1].balanceAfter).toBe(item.quantity);
    }
    expect(dataset.stock.map((s) => s.bloodType).sort()).toEqual([...BLOOD_TYPES].sort());
  });

  it('tem atendimentos para a agenda de hoje na unidade do enfermeiro de demonstração', () => {
    const today = dataset.appointments.filter(
      (a) => a.unitId === SEED_IDS.units.centro && ACTIVE_APPOINTMENT_STATUSES.includes(a.status),
    );
    expect(today.length).toBeGreaterThan(0);
  });
});
