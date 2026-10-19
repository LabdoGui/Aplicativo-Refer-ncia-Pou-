import { PreScreeningService } from './pre-screening.service';

const question = {
  id: 'q1',
  ruleSetId: 'rs1',
  code: 'FEVER',
  step: 2,
  order: 1,
  text: 'Teve febre nos últimos 7 dias?',
  helpText: null,
  type: 'BOOLEAN',
  options: null,
  required: true,
  showIfCode: null,
  showIfValue: null,
  active: true,
};

function record(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pre-1',
    donorId: 'd1',
    result: 'FAVORABLE',
    sharedWithStaff: true,
    answersEncrypted: 'cifrado:answers',
    guidanceEncrypted: 'cifrado:guidance',
    createdAt: new Date('2026-10-16T12:00:00Z'),
    expiresAt: new Date(Date.now() + 86_400_000),
    ...overrides,
  };
}

function setup(found: ReturnType<typeof record> | null) {
  const prisma = { preScreening: { findFirst: jest.fn(async () => found) } };
  const encryption = {
    decryptJson: jest.fn((value: string) =>
      value === 'cifrado:answers'
        ? [{ step: 2, question: 'Teve febre nos últimos 7 dias?', answer: 'Não' }]
        : [],
    ),
  };
  const service = new PreScreeningService(
    prisma as never,
    encryption as never,
    {} as never,
    {} as never,
  );
  return { service, prisma };
}

describe('PreScreeningService.sharedForStaff', () => {
  const startsAt = '2026-10-17T12:00:00.000Z';

  it('busca a pré-triagem mais recente até o fim do dia do atendimento, compartilhada ou não', async () => {
    const { service, prisma } = setup(record());
    await service.sharedForStaff('d1', startsAt);
    expect(prisma.preScreening.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { donorId: 'd1', createdAt: { lte: new Date('2026-10-18T02:59:59.999Z') } },
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('mostra as respostas guardadas com o texto da pergunta da época (RN08)', async () => {
    const { service } = setup(record());
    const view = await service.sharedForStaff('d1', startsAt);
    expect(view?.answers).toEqual([
      { step: 2, question: 'Teve febre nos últimos 7 dias?', answer: 'Não' },
    ]);
  });

  it('não mostra respostas antigas quando a mais recente não foi compartilhada', async () => {
    const { service } = setup(record({ sharedWithStaff: false, answersEncrypted: null }));
    await expect(service.sharedForStaff('d1', startsAt)).resolves.toBeNull();
  });

  it('não mostra pré-triagem vencida', async () => {
    const { service } = setup(record({ expiresAt: new Date(Date.now() - 1000) }));
    await expect(service.sharedForStaff('d1', startsAt)).resolves.toBeNull();
  });

  it('devolve null quando o doador não fez pré-triagem', async () => {
    const { service } = setup(null);
    await expect(service.sharedForStaff('d1', startsAt)).resolves.toBeNull();
  });
});

describe('PreScreeningService.submit', () => {
  function setupSubmit() {
    const created: Array<Record<string, unknown>> = [];
    const tx = {
      preScreening: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          created.push(data);
          return {
            id: 'pre-9',
            createdAt: new Date(),
            ruleSet: { version: '1.0', validationStatus: 'PENDING_VALIDATION' },
            ...data,
          };
        }),
      },
    };
    const prisma = {
      screeningRuleSet: {
        findFirst: jest.fn(async () => ({ id: 'rs1', questions: [question], rules: [] })),
      },
      $transaction: jest.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
    };
    const encryption = {
      encryptJson: jest.fn((value: unknown) => ({ cifrado: value })),
      decryptJson: jest.fn((value: { cifrado: unknown }) => value.cifrado),
    };
    const settings = {
      get: jest.fn(async () => ({ preScreeningValidityDays: 7 })),
      numericValues: jest.fn(async () => ({})),
    };
    const audit = { record: jest.fn(async () => undefined) };
    const service = new PreScreeningService(
      prisma as never,
      encryption as never,
      settings as never,
      audit as never,
    );
    return { service, created };
  }

  const donor = { id: 'd1', role: 'DONOR' as const, name: 'Doadora', unitIds: [] };

  it('compartilhada: guarda as respostas com o texto da pergunta do momento', async () => {
    const { service, created } = setupSubmit();
    await service.submit(donor, { answers: { FEVER: false }, shareWithStaff: true });
    expect(created[0].answersEncrypted).toEqual({
      cifrado: [{ step: 2, question: 'Teve febre nos últimos 7 dias?', answer: 'Não' }],
    });
    expect(created[0].sharedWithStaff).toBe(true);
  });

  it('sem compartilhamento: não guarda as respostas (UC03)', async () => {
    const { service, created } = setupSubmit();
    await service.submit(donor, { answers: { FEVER: false }, shareWithStaff: false });
    expect(created[0].answersEncrypted).toBeNull();
  });
});
