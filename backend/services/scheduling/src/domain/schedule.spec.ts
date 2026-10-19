import { SCHEDULING_POLICY } from '@pulso/contracts';
import {
  bookingWindow,
  canChange,
  dayAvailability,
  findSlotForStart,
  isBlocked,
  slotsForDay,
  validateRules,
  type RuleLike,
} from './schedule';

const ZONE = 'America/Sao_Paulo';
// 2026-10-19 é uma segunda-feira (weekday 1).
const MONDAY = '2026-10-19';
const rule = (overrides: Partial<RuleLike> = {}): RuleLike => ({
  weekday: 1,
  startTime: '08:00',
  endTime: '10:00',
  slotMinutes: 30,
  capacity: 3,
  active: true,
  ...overrides,
});

describe('slotsForDay', () => {
  it('gera as vagas da regra em hora local, convertidas para UTC', () => {
    const slots = slotsForDay([rule()], MONDAY, ZONE);
    expect(slots.map((slot) => slot.startsAt.toISOString())).toEqual([
      '2026-10-19T11:00:00.000Z',
      '2026-10-19T11:30:00.000Z',
      '2026-10-19T12:00:00.000Z',
      '2026-10-19T12:30:00.000Z',
    ]);
    expect(slots[0].endsAt.toISOString()).toBe('2026-10-19T11:30:00.000Z');
    expect(slots.every((slot) => slot.capacity === 3)).toBe(true);
  });

  it('ignora regras inativas e de outros dias da semana', () => {
    expect(slotsForDay([rule({ active: false }), rule({ weekday: 2 })], MONDAY, ZONE)).toEqual([]);
  });

  it('junta várias regras do dia em ordem', () => {
    const slots = slotsForDay(
      [rule({ startTime: '13:00', endTime: '14:00' }), rule({ endTime: '09:00' })],
      MONDAY,
      ZONE,
    );
    expect(slots).toHaveLength(4);
    expect(slots[0].startsAt.toISOString()).toBe('2026-10-19T11:00:00.000Z');
    expect(slots[3].startsAt.toISOString()).toBe('2026-10-19T16:30:00.000Z');
  });
});

describe('findSlotForStart', () => {
  it('encontra só horários alinhados à grade', () => {
    expect(findSlotForStart([rule()], new Date('2026-10-19T11:30:00Z'), ZONE)).not.toBeNull();
    expect(findSlotForStart([rule()], new Date('2026-10-19T11:15:00Z'), ZONE)).toBeNull();
    // 10:00 local é o fim da regra: não há vaga começando ali.
    expect(findSlotForStart([rule()], new Date('2026-10-19T13:00:00Z'), ZONE)).toBeNull();
    // Terça-feira sem regra.
    expect(findSlotForStart([rule()], new Date('2026-10-20T11:00:00Z'), ZONE)).toBeNull();
  });
});

describe('isBlocked', () => {
  const slot = {
    startsAt: new Date('2026-10-19T11:00:00Z'),
    endsAt: new Date('2026-10-19T11:30:00Z'),
  };
  it('detecta sobreposição parcial e ignora bloqueios encostados', () => {
    expect(
      isBlocked(slot, [
        { startsAt: new Date('2026-10-19T11:20:00Z'), endsAt: new Date('2026-10-19T12:00:00Z') },
      ]),
    ).toBe(true);
    expect(
      isBlocked(slot, [
        { startsAt: new Date('2026-10-19T11:30:00Z'), endsAt: new Date('2026-10-19T12:00:00Z') },
      ]),
    ).toBe(false);
  });
});

describe('canChange (RN06)', () => {
  const now = new Date('2026-10-19T12:00:00Z');
  const hours = (h: number) => new Date(now.getTime() + h * 3_600_000);
  it(`permite alterar até ${SCHEDULING_POLICY.cancelMinHours} h antes`, () => {
    expect(canChange('BOOKED', hours(SCHEDULING_POLICY.cancelMinHours), now)).toBe(true);
    expect(canChange('CONFIRMED', hours(5), now)).toBe(true);
    expect(canChange('BOOKED', hours(SCHEDULING_POLICY.cancelMinHours - 0.5), now)).toBe(false);
  });
  it('não permite alterar agendamentos encerrados ou em atendimento', () => {
    expect(canChange('CHECKED_IN', hours(5), now)).toBe(false);
    expect(canChange('CANCELLED', hours(5), now)).toBe(false);
    expect(canChange('COMPLETED', hours(5), now)).toBe(false);
  });
});

describe('bookingWindow (RN05)', () => {
  it('vai da antecedência mínima ao fim do último dia permitido', () => {
    const now = new Date('2026-10-19T12:00:00Z'); // 09:00 local
    const window = bookingWindow(now, ZONE);
    expect(window.earliest.getTime() - now.getTime()).toBe(
      SCHEDULING_POLICY.minLeadMinutes * 60_000,
    );
    expect(window.firstDay).toBe('2026-10-19');
    expect(window.lastDay).toBe('2026-12-18');
    expect(window.latest.toISOString()).toBe('2026-12-19T02:59:59.999Z');
  });
});

describe('dayAvailability', () => {
  const generated = slotsForDay([rule()], MONDAY, ZONE);

  it('desconta reservas, remove bloqueadas e horários antes da antecedência mínima', () => {
    const usage = new Map([[new Date('2026-10-19T11:30:00Z').getTime(), { bookedCount: 3 }]]);
    const result = dayAvailability({
      generated,
      blocks: [
        { startsAt: new Date('2026-10-19T12:30:00Z'), endsAt: new Date('2026-10-19T13:00:00Z') },
      ],
      usage,
      earliest: new Date('2026-10-19T11:10:00Z'),
    });
    expect(result.map((slot) => [slot.startsAt, slot.remaining])).toEqual([
      ['2026-10-19T11:30:00.000Z', 0],
      ['2026-10-19T12:00:00.000Z', 3],
    ]);
  });

  it('usa a capacidade da regra vigente, mesmo que a vaga já tenha reservas', () => {
    const usage = new Map([[generated[0].startsAt.getTime(), { bookedCount: 1 }]]);
    const [first] = dayAvailability({ generated, blocks: [], usage, earliest: new Date(0) });
    expect(first).toMatchObject({ capacity: 3, remaining: 2 });
  });

  it('capacidade reduzida abaixo das reservas feitas: vaga lotada, sem número negativo', () => {
    const usage = new Map([[generated[0].startsAt.getTime(), { bookedCount: 5 }]]);
    const [first] = dayAvailability({ generated, blocks: [], usage, earliest: new Date(0) });
    expect(first).toMatchObject({ capacity: 3, remaining: 0 });
  });
});

describe('validateRules', () => {
  it('aceita regras consistentes', () => {
    expect(
      validateRules([rule(), rule({ startTime: '13:00', endTime: '17:00' }), rule({ weekday: 2 })]),
    ).toEqual([]);
  });

  it('aponta fim antes do início, divisão com sobra e sobreposição', () => {
    const issues = validateRules([
      rule(),
      rule({ startTime: '09:30', endTime: '11:00' }),
      rule({ weekday: 3, startTime: '10:00', endTime: '09:00' }),
      rule({ weekday: 4, startTime: '08:00', endTime: '09:10', slotMinutes: 30 }),
    ]);
    expect(issues).toEqual([
      expect.objectContaining({ index: 1, field: 'startTime' }),
      expect.objectContaining({ index: 2, field: 'endTime' }),
      expect.objectContaining({ index: 3, field: 'slotMinutes' }),
    ]);
  });
});
