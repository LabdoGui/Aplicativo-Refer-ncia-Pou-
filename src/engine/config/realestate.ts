export interface RegionDef {
  id: string;
  name: string;
  description: string;
  /** Valorização de longo prazo por passo imobiliário (log). */
  drift: number;
  /** Amplitude do ciclo imobiliário (log por passo, no pico do ciclo). */
  cycleAmplitude: number;
  /** Duração de um ciclo completo, em passos. */
  cyclePeriod: number;
  /** Ruído pequeno por passo. */
  noise: number;
  /** Multiplicador sobre o aluguel. */
  rentMultiplier: number;
}

export const REGIONS: readonly RegionDef[] = [
  {
    id: 'centro',
    name: 'Centro Financeiro',
    description: 'Valorização firme, aluguel moderado.',
    drift: 0.0006,
    cycleAmplitude: 0.002,
    cyclePeriod: 60,
    noise: 0.002,
    rentMultiplier: 1,
  },
  {
    id: 'litoral',
    name: 'Orla Azul',
    description: 'Ciclos fortes: compra na baixa, venda no pico.',
    drift: 0.0004,
    cycleAmplitude: 0.006,
    cyclePeriod: 45,
    noise: 0.004,
    rentMultiplier: 0.9,
  },
  {
    id: 'industrial',
    name: 'Polo Industrial',
    description: 'Pouca valorização, aluguel alto.',
    drift: 0.0002,
    cycleAmplitude: 0.0015,
    cyclePeriod: 80,
    noise: 0.002,
    rentMultiplier: 1.35,
  },
  {
    id: 'suburbio',
    name: 'Vila Nova',
    description: 'Entrada barata, demanda constante.',
    drift: 0.0004,
    cycleAmplitude: 0.002,
    cyclePeriod: 60,
    noise: 0.002,
    rentMultiplier: 1.1,
  },
];

export const REGION_BY_ID: Record<string, RegionDef> = Object.fromEntries(REGIONS.map((r) => [r.id, r]));

export type PropertySynergy =
  | { kind: 'businessExpense'; businessId: string; fraction: number; text: string }
  | { kind: 'businessRevenue'; businessId: string; fraction: number; text: string }
  | { kind: 'passiveMult'; fraction: number; text: string }
  | { kind: 'unlockBusiness'; businessId: string; text: string };

export interface PropertyDef {
  id: string;
  name: string;
  icon: string;
  type: string;
  region: string;
  description: string;
  /** Preço base em centavos (índice da região = 1). */
  basePrice: number;
  /** Aluguel bruto por segundo, em centavos (0 para terreno). */
  baseRent: number;
  /** Manutenção por segundo, em centavos. */
  maintenance: number;
  /** Cada unidade extra encarece a próxima (profundidade de mercado). */
  unitPriceStep: number;
  unlockNetWorth: number;
  synergies: PropertySynergy[];
  /** Pode ser desenvolvido em outro imóvel. */
  develop?: { toId: string; cost: number; durationMs: number };
}

export const PROPERTIES: readonly PropertyDef[] = [
  {
    id: 'casa',
    name: 'Casa',
    icon: '🏠',
    type: 'Residencial',
    region: 'suburbio',
    description: 'Casa de 2 quartos para aluguel.',
    basePrice: 2_000_000,
    baseRent: 3_200,
    maintenance: 600,
    unitPriceStep: 0.03,
    unlockNetWorth: 500_000,
    synergies: [],
  },
  {
    id: 'apartamento',
    name: 'Apartamento',
    icon: '🏢',
    type: 'Residencial',
    region: 'centro',
    description: 'Apartamento compacto perto do metrô.',
    basePrice: 6_000_000,
    baseRent: 9_000,
    maintenance: 1_800,
    unitPriceStep: 0.03,
    unlockNetWorth: 1_500_000,
    synergies: [],
  },
  {
    id: 'loja_comercial',
    name: 'Loja de rua',
    icon: '🏬',
    type: 'Comercial',
    region: 'centro',
    description: 'Ponto comercial movimentado.',
    basePrice: 15_000_000,
    baseRent: 24_000,
    maintenance: 4_000,
    unitPriceStep: 0.04,
    unlockNetWorth: 4_000_000,
    synergies: [{ kind: 'businessRevenue', businessId: 'loja', fraction: 0.1, text: '+10% receita da Loja virtual (showroom)' }],
  },
  {
    id: 'terreno',
    name: 'Terreno',
    icon: '🌳',
    type: 'Terreno',
    region: 'litoral',
    description: 'Não gera aluguel, mas pode virar um prédio comercial.',
    basePrice: 30_000_000,
    baseRent: 0,
    maintenance: 500,
    unitPriceStep: 0.05,
    unlockNetWorth: 10_000_000,
    synergies: [{ kind: 'businessRevenue', businessId: 'construtora', fraction: 0.15, text: '+15% receita da Construtora' }],
    develop: { toId: 'predio', cost: 250_000_000, durationMs: 300_000 },
  },
  {
    id: 'galpao',
    name: 'Galpão logístico',
    icon: '🏭',
    type: 'Industrial',
    region: 'industrial',
    description: 'Armazém grande com doca de carga.',
    basePrice: 50_000_000,
    baseRent: 80_000,
    maintenance: 15_000,
    unitPriceStep: 0.04,
    unlockNetWorth: 15_000_000,
    synergies: [{ kind: 'businessExpense', businessId: 'transportadora', fraction: 0.1, text: '-10% despesas da Transportadora' }],
  },
  {
    id: 'escritorio',
    name: 'Escritório corporativo',
    icon: '🗄️',
    type: 'Comercial',
    region: 'centro',
    description: 'Andar inteiro em torre corporativa.',
    basePrice: 200_000_000,
    baseRent: 300_000,
    maintenance: 60_000,
    unitPriceStep: 0.05,
    unlockNetWorth: 60_000_000,
    synergies: [{ kind: 'unlockBusiness', businessId: 'holding', text: 'Permite fundar a Holding empresarial' }],
  },
  {
    id: 'predio',
    name: 'Prédio comercial',
    icon: '🏙️',
    type: 'Comercial',
    region: 'centro',
    description: 'Edifício inteiro com vários inquilinos.',
    basePrice: 1_000_000_000,
    baseRent: 1_700_000,
    maintenance: 300_000,
    unitPriceStep: 0.06,
    unlockNetWorth: 300_000_000,
    synergies: [
      { kind: 'unlockBusiness', businessId: 'holding', text: 'Permite fundar a Holding empresarial' },
      { kind: 'passiveMult', fraction: 0.02, text: '+2% em toda renda passiva (sede própria)' },
    ],
  },
  {
    id: 'luxo',
    name: 'Resort de luxo',
    icon: '🏝️',
    type: 'Luxo',
    region: 'litoral',
    description: 'Empreendimento de alto padrão que atrai investidores.',
    basePrice: 20_000_000_000,
    baseRent: 30_000_000,
    maintenance: 6_000_000,
    unitPriceStep: 0.08,
    unlockNetWorth: 8_000_000_000,
    synergies: [{ kind: 'passiveMult', fraction: 0.05, text: '+5% em toda renda passiva (reputação)' }],
  },
];

export const PROPERTY_BY_ID: Record<string, PropertyDef> = Object.fromEntries(PROPERTIES.map((p) => [p.id, p]));
