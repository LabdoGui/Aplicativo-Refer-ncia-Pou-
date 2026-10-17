import {
  answerLabel,
  evaluateRules,
  sanitizeAnswers,
  type EngineQuestion,
  type EngineRule,
} from './rule-engine';

const TODAY = '2026-10-17';

function question(
  overrides: Partial<EngineQuestion> & Pick<EngineQuestion, 'code'>,
): EngineQuestion {
  return {
    id: `q-${overrides.code}`,
    step: 1,
    order: 1,
    text: overrides.code,
    type: 'BOOLEAN',
    options: null,
    required: true,
    showIfCode: null,
    showIfValue: null,
    ...overrides,
  };
}

const questions: EngineQuestion[] = [
  question({ code: 'WEIGHT_50', step: 1 }),
  question({ code: 'SLEPT_6H', step: 2 }),
  question({ code: 'MEDICATION', step: 4 }),
  question({ code: 'DONATED_BEFORE', step: 6, order: 1 }),
  question({
    code: 'LAST_DONATION_DATE',
    step: 6,
    order: 2,
    type: 'DATE',
    showIfCode: 'DONATED_BEFORE',
    showIfValue: true,
  }),
  question({
    code: 'BLOOD_TYPE_KNOWN',
    step: 1,
    order: 2,
    type: 'SINGLE_CHOICE',
    required: false,
    options: [
      { value: 'YES', label: 'Sei meu tipo' },
      { value: 'NO', label: 'Não sei' },
    ],
  }),
];

function rule(overrides: Partial<EngineRule> & Pick<EngineRule, 'questionId'>): EngineRule {
  return {
    id: `r-${overrides.questionId}`,
    operator: 'EQUALS',
    value: true,
    settingKey: null,
    severity: 'TALK_TO_UNIT',
    message: 'Converse com a unidade.',
    order: 0,
    ...overrides,
  };
}

const rules: EngineRule[] = [
  rule({ questionId: 'q-WEIGHT_50', value: false }),
  rule({ questionId: 'q-SLEPT_6H', value: false, severity: 'INFO', message: 'Descanse bem.' }),
  rule({ questionId: 'q-MEDICATION', value: true }),
  rule({
    questionId: 'q-LAST_DONATION_DATE',
    operator: 'WITHIN_DAYS',
    value: 0,
    settingKey: 'donationIntervalDays',
    severity: 'WAIT_UNTIL',
    message: 'Data informativa: {date}.',
  }),
];

const settings = { donationIntervalDays: 90 };
const base = { WEIGHT_50: true, SLEPT_6H: true, MEDICATION: false, DONATED_BEFORE: false };

describe('sanitizeAnswers', () => {
  it('aceita respostas válidas e descarta a de uma pergunta escondida', () => {
    const { answers, errors } = sanitizeAnswers(
      questions,
      { ...base, LAST_DONATION_DATE: '2026-09-01' },
      TODAY,
    );
    expect(errors).toEqual([]);
    expect(answers.LAST_DONATION_DATE).toBeUndefined();
  });

  it('exige a pergunta condicional quando ela aparece', () => {
    const { errors } = sanitizeAnswers(questions, { ...base, DONATED_BEFORE: true }, TODAY);
    expect(errors).toEqual([
      { field: 'answers.LAST_DONATION_DATE', message: 'Responda esta pergunta.' },
    ]);
  });

  it('aponta códigos desconhecidos, obrigatórias ausentes e tipos errados', () => {
    const { errors } = sanitizeAnswers(
      questions,
      {
        WEIGHT_50: 'sim',
        SLEPT_6H: true,
        DONATED_BEFORE: false,
        EXTRA: 1,
        BLOOD_TYPE_KNOWN: 'TALVEZ',
      },
      TODAY,
    );
    expect(errors.map((error) => error.field).sort()).toEqual(
      [
        'answers.BLOOD_TYPE_KNOWN',
        'answers.EXTRA',
        'answers.MEDICATION',
        'answers.WEIGHT_50',
      ].sort(),
    );
  });

  it('recusa data futura ou em formato inválido', () => {
    const future = sanitizeAnswers(
      questions,
      { ...base, DONATED_BEFORE: true, LAST_DONATION_DATE: '2026-12-01' },
      TODAY,
    );
    expect(future.errors[0].message).toMatch(/futura/);
    const invalid = sanitizeAnswers(
      questions,
      { ...base, DONATED_BEFORE: true, LAST_DONATION_DATE: '17/10/2026' },
      TODAY,
    );
    expect(invalid.errors[0].field).toBe('answers.LAST_DONATION_DATE');
  });

  it('pergunta opcional sem resposta não gera erro', () => {
    const { errors, answers } = sanitizeAnswers(questions, base, TODAY);
    expect(errors).toEqual([]);
    expect(answers.BLOOD_TYPE_KNOWN).toBeUndefined();
  });
});

describe('evaluateRules', () => {
  const evaluate = (answers: Record<string, unknown>) => {
    const clean = sanitizeAnswers(questions, answers, TODAY);
    expect(clean.errors).toEqual([]);
    return evaluateRules(questions, rules, clean.answers, settings, TODAY);
  };

  it('sem regras disparadas, o resultado é favorável', () => {
    expect(evaluate(base)).toEqual({
      result: 'FAVORABLE',
      guidance: [],
      waitUntil: null,
      triggeredRuleIds: [],
    });
  });

  it('regra informativa só acrescenta orientação', () => {
    const result = evaluate({ ...base, SLEPT_6H: false });
    expect(result.result).toBe('FAVORABLE');
    expect(result.guidance).toEqual([
      { severity: 'INFO', message: 'Descanse bem.', waitUntil: null },
    ]);
  });

  it('"converse com a unidade" vence a informativa', () => {
    const result = evaluate({ ...base, SLEPT_6H: false, MEDICATION: true });
    expect(result.result).toBe('TALK_TO_UNIT');
    expect(result.triggeredRuleIds).toEqual(['r-q-SLEPT_6H', 'r-q-MEDICATION']);
  });

  it('última doação dentro do intervalo configurado → aguardar, com data informativa', () => {
    const result = evaluate({
      ...base,
      DONATED_BEFORE: true,
      LAST_DONATION_DATE: '2026-09-01',
      MEDICATION: true,
    });
    expect(result.result).toBe('WAIT_UNTIL');
    expect(result.waitUntil).toBe('2026-11-30');
    expect(result.guidance.find((g) => g.severity === 'WAIT_UNTIL')?.message).toBe(
      'Data informativa: 30/11/2026.',
    );
  });

  it('última doação fora do intervalo não dispara a regra', () => {
    const result = evaluate({ ...base, DONATED_BEFORE: true, LAST_DONATION_DATE: '2026-06-01' });
    expect(result.result).toBe('FAVORABLE');
  });

  it('o intervalo acompanha a configuração (settingKey)', () => {
    const clean = sanitizeAnswers(
      questions,
      { ...base, DONATED_BEFORE: true, LAST_DONATION_DATE: '2026-09-01' },
      TODAY,
    );
    const result = evaluateRules(
      questions,
      rules,
      clean.answers,
      { donationIntervalDays: 30 },
      TODAY,
    );
    expect(result.result).toBe('FAVORABLE');
  });

  it('operadores numéricos comparam números', () => {
    const numberQuestion = question({ code: 'AGE', type: 'NUMBER' });
    const numberRule = rule({ questionId: 'q-AGE', operator: 'LT', value: 18 });
    const run = (age: number) =>
      evaluateRules([numberQuestion], [numberRule], { AGE: age }, {}, TODAY).result;
    expect(run(17)).toBe('TALK_TO_UNIT');
    expect(run(18)).toBe('FAVORABLE');
  });
});

describe('answerLabel', () => {
  it('traduz respostas para a visão da equipe', () => {
    expect(answerLabel(questions[0], true)).toBe('Sim');
    expect(answerLabel(questions[0], false)).toBe('Não');
    expect(answerLabel(questions[4], '2026-09-01')).toBe('01/09/2026');
    expect(answerLabel(questions[5], 'NO')).toBe('Não sei');
  });
});
