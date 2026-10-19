import {
  computeTrend,
  emptyBalances,
  endOfLocalDay,
  lastLocalDays,
  minimumBalanceSince,
  reconstructDailyBalances,
  type MovementDelta,
} from './stock-history';

const at = (iso: string) => new Date(iso);

describe('lastLocalDays', () => {
  it('lista os dias em ordem crescente terminando hoje', () => {
    expect(lastLocalDays(3, '2026-10-17')).toEqual(['2026-10-15', '2026-10-16', '2026-10-17']);
    expect(lastLocalDays(2, '2026-03-01')).toEqual(['2026-02-28', '2026-03-01']);
  });
});

describe('endOfLocalDay', () => {
  it('usa o fuso de São Paulo (UTC−3)', () => {
    expect(endOfLocalDay('2026-10-17').toISOString()).toBe('2026-10-18T02:59:59.999Z');
  });
});

describe('reconstructDailyBalances', () => {
  const current = { ...emptyBalances(), O_NEG: 10, A_POS: 50 };
  const days = ['2026-10-15', '2026-10-16', '2026-10-17'];

  it('desfaz, de trás para frente, as movimentações posteriores ao fim de cada dia', () => {
    const movements: MovementDelta[] = [
      // 17/10 15h local: saída de 5 O−  → antes dela havia 15
      { bloodType: 'O_NEG', type: 'OUT', quantity: 5, occurredAt: at('2026-10-17T18:00:00Z') },
      // 16/10 10h local: entrada de 3 O− → antes dela havia 12
      { bloodType: 'O_NEG', type: 'IN', quantity: 3, occurredAt: at('2026-10-16T13:00:00Z') },
      // 16/10 23h local (17/10 02h UTC): ainda conta como dia 16
      { bloodType: 'A_POS', type: 'IN', quantity: 4, occurredAt: at('2026-10-17T02:00:00Z') },
    ];
    const points = reconstructDailyBalances(current, movements, days);
    expect(points.map((p) => p.date)).toEqual(days);
    expect(points.map((p) => p.values.O_NEG)).toEqual([12, 15, 10]);
    expect(points.map((p) => p.values.A_POS)).toEqual([46, 50, 50]);
    expect(points[2].total).toBe(60);
  });

  it('acomoda movimentações com data retroativa (registradas depois, ocorridas antes)', () => {
    // Registrada hoje, mas ocorrida em 15/10: o saldo de 15/10 em diante já a inclui.
    const movements: MovementDelta[] = [
      { bloodType: 'O_NEG', type: 'IN', quantity: 6, occurredAt: at('2026-10-15T12:00:00Z') },
    ];
    const points = reconstructDailyBalances(current, movements, days);
    expect(points.map((p) => p.values.O_NEG)).toEqual([10, 10, 10]);
    const earlier = reconstructDailyBalances(current, movements, ['2026-10-14', ...days]);
    expect(earlier[0].values.O_NEG).toBe(4);
  });

  it('sem movimentações, todos os dias têm o saldo atual', () => {
    const points = reconstructDailyBalances(current, [], days);
    expect(points.every((p) => p.values.O_NEG === 10)).toBe(true);
  });
});

describe('computeTrend', () => {
  it('calcula delta, percentual e direção', () => {
    expect(computeTrend(30, 40)).toEqual({ delta7d: -10, deltaPercent7d: -25, direction: 'DOWN' });
    expect(computeTrend(45, 40)).toEqual({ delta7d: 5, deltaPercent7d: 12.5, direction: 'UP' });
    expect(computeTrend(40, 40)).toEqual({ delta7d: 0, deltaPercent7d: 0, direction: 'STABLE' });
  });

  it('percentual nulo quando a base é zero', () => {
    expect(computeTrend(8, 0)).toEqual({ delta7d: 8, deltaPercent7d: null, direction: 'UP' });
  });
});

describe('minimumBalanceSince', () => {
  it('é o saldo atual quando não há movimentações depois', () => {
    expect(minimumBalanceSince(7, [])).toBe(7);
  });

  it('encontra o menor saldo do período (uma entrada posterior não cobre uma saída anterior)', () => {
    // Hoje há 10; depois do instante houve uma entrada de 10 (mais recente) e uma saída de 4.
    // Antes da entrada: 0; antes da saída: 4. O menor saldo do período foi 0.
    expect(
      minimumBalanceSince(10, [
        { type: 'IN', quantity: 10 },
        { type: 'OUT', quantity: 4 },
      ]),
    ).toBe(0);
  });
});
