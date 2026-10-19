import { validateFieldValues, type FieldDefinition } from './field-validation';

const fields: FieldDefinition[] = [
  {
    code: 'WEIGHT',
    label: 'Peso',
    type: 'NUMBER',
    options: null,
    required: true,
    min: 30,
    max: 250,
  },
  {
    code: 'BLOOD_PRESSURE',
    label: 'Pressão arterial',
    type: 'TEXT',
    options: null,
    required: true,
    min: null,
    max: null,
  },
  {
    code: 'FASTING',
    label: 'Jejum',
    type: 'BOOLEAN',
    options: null,
    required: false,
    min: null,
    max: null,
  },
  {
    code: 'ARM',
    label: 'Braço',
    type: 'SELECT',
    options: [
      { value: 'LEFT', label: 'Esquerdo' },
      { value: 'RIGHT', label: 'Direito' },
    ],
    required: false,
    min: null,
    max: null,
  },
];

describe('validateFieldValues', () => {
  it('aceita valores válidos e apara textos', () => {
    const { values, errors } = validateFieldValues(fields, {
      WEIGHT: 70.5,
      BLOOD_PRESSURE: ' 120/80 ',
      FASTING: false,
      ARM: 'LEFT',
    });
    expect(errors).toEqual([]);
    expect(values).toEqual({ WEIGHT: 70.5, BLOOD_PRESSURE: '120/80', FASTING: false, ARM: 'LEFT' });
  });

  it('aponta obrigatórios ausentes, limites, tipos e códigos desconhecidos', () => {
    const { errors } = validateFieldValues(fields, {
      WEIGHT: 900,
      FASTING: 'não',
      ARM: 'BOTH',
      SECRET: 1,
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        { field: 'values.SECRET', message: 'Campo desconhecido.' },
        { field: 'values.WEIGHT', message: 'Confira o valor: máximo 250.' },
        { field: 'values.BLOOD_PRESSURE', message: 'Informe pressão arterial.' },
        { field: 'values.FASTING', message: 'Responda com sim ou não.' },
        { field: 'values.ARM', message: 'Escolha uma das opções.' },
      ]),
    );
  });

  it('número como texto não é aceito', () => {
    const { errors } = validateFieldValues(fields, { WEIGHT: '70', BLOOD_PRESSURE: '12/8' });
    expect(errors).toEqual([{ field: 'values.WEIGHT', message: 'Informe um número.' }]);
  });

  it('limita o tamanho dos textos', () => {
    const { errors } = validateFieldValues(fields, { WEIGHT: 70, BLOOD_PRESSURE: 'x'.repeat(501) });
    expect(errors[0].field).toBe('values.BLOOD_PRESSURE');
  });
});
