/**
 * Conteúdo inicial da pré-triagem e da triagem profissional.
 *
 * As perguntas são inspiradas em orientações públicas sobre doação de sangue e
 * TODAS as regras nascem pendentes de validação por profissional de saúde.
 * Nenhuma regra bloqueia: elas só orientam (RN07). A única data de espera usa o
 * intervalo configurável entre doações (D7), também pendente de validação.
 */
import type {
  AnswerValue,
  QuestionType,
  RuleOperator,
  RuleSeverity,
  ScreeningFieldType,
} from '@pulso/contracts';

export const SEED_RULE_SET = {
  version: '2026.1-demo',
  normativeReference:
    'Perguntas inspiradas em orientações públicas sobre doação de sangue (Ministério da Saúde). Conteúdo pendente de validação por profissional de saúde; não substitui a triagem clínica.',
};

interface SeedRule {
  operator: RuleOperator;
  value: AnswerValue;
  settingKey?: string;
  severity: RuleSeverity;
  message: string;
}

export interface SeedQuestion {
  code: string;
  step: number;
  order: number;
  text: string;
  helpText?: string;
  type: QuestionType;
  required?: boolean;
  showIf?: { code: string; value: AnswerValue };
  rule?: SeedRule;
}

const TALK = 'TALK_TO_UNIT' as const;

export const SEED_QUESTIONS: SeedQuestion[] = [
  {
    code: 'WEIGHT_50',
    step: 1,
    order: 1,
    text: 'Você pesa 50 kg ou mais?',
    type: 'BOOLEAN',
    rule: {
      operator: 'EQUALS',
      value: false,
      severity: TALK,
      message:
        'O peso é um dos critérios avaliados na triagem. Converse com a unidade antes de ir.',
    },
  },
  {
    code: 'FEELING_WELL',
    step: 2,
    order: 1,
    text: 'Você está se sentindo bem de saúde hoje?',
    type: 'BOOLEAN',
    rule: {
      operator: 'EQUALS',
      value: false,
      severity: TALK,
      message: 'Se você não está se sentindo bem, converse com a unidade antes de ir.',
    },
  },
  {
    code: 'SLEPT_6H',
    step: 2,
    order: 2,
    text: 'Dormiu pelo menos 6 horas nas últimas 24 horas?',
    type: 'BOOLEAN',
    rule: {
      operator: 'EQUALS',
      value: false,
      severity: 'INFO',
      message: 'Descansar bem antes de doar ajuda. A equipe vai conversar com você.',
    },
  },
  {
    code: 'ATE_RECENTLY',
    step: 3,
    order: 1,
    text: 'Você se alimentou nas últimas horas, evitando alimentos gordurosos?',
    type: 'BOOLEAN',
    rule: {
      operator: 'EQUALS',
      value: false,
      severity: 'INFO',
      message: 'Faça uma refeição leve antes de doar. Não é preciso estar em jejum.',
    },
  },
  {
    code: 'ALCOHOL_12H',
    step: 3,
    order: 2,
    text: 'Ingeriu bebida alcoólica nas últimas 12 horas?',
    type: 'BOOLEAN',
    rule: {
      operator: 'EQUALS',
      value: true,
      severity: TALK,
      message: 'O consumo recente de álcool é avaliado na triagem. Converse com a unidade.',
    },
  },
  {
    code: 'RECENT_ILLNESS',
    step: 4,
    order: 1,
    text: 'Teve febre, gripe ou resfriado nos últimos dias?',
    type: 'BOOLEAN',
    rule: {
      operator: 'EQUALS',
      value: true,
      severity: TALK,
      message: 'Sintomas recentes precisam ser avaliados pela equipe. Converse com a unidade.',
    },
  },
  {
    code: 'MEDICATION',
    step: 4,
    order: 2,
    text: 'Usa algum medicamento atualmente?',
    type: 'BOOLEAN',
    rule: {
      operator: 'EQUALS',
      value: true,
      severity: TALK,
      message: 'Alguns medicamentos precisam ser avaliados pela equipe. Leve o nome deles.',
    },
  },
  {
    code: 'TATTOO_12M',
    step: 5,
    order: 1,
    text: 'Fez tatuagem, piercing ou maquiagem definitiva nos últimos 12 meses?',
    type: 'BOOLEAN',
    rule: {
      operator: 'EQUALS',
      value: true,
      severity: TALK,
      message: 'Procedimentos desse tipo são avaliados na triagem. Converse com a unidade.',
    },
  },
  {
    code: 'RECENT_PROCEDURE',
    step: 5,
    order: 2,
    text: 'Passou recentemente por cirurgia, procedimento odontológico ou endoscopia?',
    type: 'BOOLEAN',
    rule: {
      operator: 'EQUALS',
      value: true,
      severity: TALK,
      message: 'Procedimentos recentes precisam ser avaliados pela equipe. Converse com a unidade.',
    },
  },
  {
    code: 'DONATED_BEFORE',
    step: 6,
    order: 1,
    text: 'Você já doou sangue antes?',
    type: 'BOOLEAN',
  },
  {
    code: 'LAST_DONATION_DATE',
    step: 6,
    order: 2,
    text: 'Quando foi sua última doação?',
    helpText: 'Se não lembrar o dia exato, informe uma data aproximada.',
    type: 'DATE',
    showIf: { code: 'DONATED_BEFORE', value: true },
    rule: {
      operator: 'WITHIN_DAYS',
      value: 0,
      settingKey: 'donationIntervalDays',
      severity: 'WAIT_UNTIL',
      message:
        'Pelo intervalo configurado no sistema (pendente de validação), a data informativa para a próxima doação é {date}. A equipe confirma no atendimento.',
    },
  },
];

export interface SeedField {
  code: string;
  label: string;
  type: ScreeningFieldType;
  unit: string | null;
  helpText: string | null;
  min: number | null;
  max: number | null;
  order: number;
}

/** Limites só contra erro de digitação (não são critérios clínicos). */
export const SEED_FIELDS: SeedField[] = [
  {
    code: 'WEIGHT',
    label: 'Peso',
    type: 'NUMBER',
    unit: 'kg',
    helpText: null,
    min: 30,
    max: 250,
    order: 1,
  },
  {
    code: 'BLOOD_PRESSURE',
    label: 'Pressão arterial',
    type: 'TEXT',
    unit: 'mmHg',
    helpText: 'Ex.: 120/80',
    min: null,
    max: null,
    order: 2,
  },
  {
    code: 'HEART_RATE',
    label: 'Frequência cardíaca',
    type: 'NUMBER',
    unit: 'bpm',
    helpText: null,
    min: 30,
    max: 220,
    order: 3,
  },
  {
    code: 'TEMPERATURE',
    label: 'Temperatura',
    type: 'NUMBER',
    unit: '°C',
    helpText: null,
    min: 34,
    max: 42,
    order: 4,
  },
  {
    code: 'HEMOGLOBIN',
    label: 'Hemoglobina',
    type: 'NUMBER',
    unit: 'g/dL',
    helpText: null,
    min: 5,
    max: 25,
    order: 5,
  },
];
