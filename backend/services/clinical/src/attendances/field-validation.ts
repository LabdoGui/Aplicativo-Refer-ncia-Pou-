/**
 * Validação dos valores da triagem profissional contra os campos configurados.
 * Os limites mínimo/máximo só evitam erros de digitação: não são critérios
 * clínicos e não decidem nada (o resultado é escolhido pelo profissional).
 */
import type { AnswerValue, QuestionOption, ScreeningFieldType } from '@pulso/contracts';

export interface FieldDefinition {
  code: string;
  label: string;
  type: ScreeningFieldType;
  options: QuestionOption[] | null;
  required: boolean;
  min: number | null;
  max: number | null;
}

export const TEXT_FIELD_MAX_LENGTH = 500;

export function validateFieldValues(
  fields: FieldDefinition[],
  values: Record<string, unknown>,
): { values: Record<string, AnswerValue>; errors: Array<{ field: string; message: string }> } {
  const errors: Array<{ field: string; message: string }> = [];
  const known = new Map(fields.map((field) => [field.code, field]));
  for (const code of Object.keys(values)) {
    if (!known.has(code)) errors.push({ field: `values.${code}`, message: 'Campo desconhecido.' });
  }

  const clean: Record<string, AnswerValue> = {};
  for (const field of fields) {
    const key = `values.${field.code}`;
    let raw = values[field.code];
    if (typeof raw === 'string') raw = raw.trim();
    if (raw === undefined || raw === null || raw === '') {
      if (field.required)
        errors.push({ field: key, message: `Informe ${field.label.toLowerCase()}.` });
      continue;
    }
    switch (field.type) {
      case 'NUMBER': {
        if (typeof raw !== 'number' || !Number.isFinite(raw)) {
          errors.push({ field: key, message: 'Informe um número.' });
          break;
        }
        if (field.min !== null && raw < field.min) {
          errors.push({ field: key, message: `Confira o valor: mínimo ${field.min}.` });
          break;
        }
        if (field.max !== null && raw > field.max) {
          errors.push({ field: key, message: `Confira o valor: máximo ${field.max}.` });
          break;
        }
        clean[field.code] = raw;
        break;
      }
      case 'BOOLEAN':
        if (typeof raw === 'boolean') clean[field.code] = raw;
        else errors.push({ field: key, message: 'Responda com sim ou não.' });
        break;
      case 'SELECT':
        if (typeof raw === 'string' && (field.options ?? []).some((o) => o.value === raw)) {
          clean[field.code] = raw;
        } else {
          errors.push({ field: key, message: 'Escolha uma das opções.' });
        }
        break;
      case 'TEXT':
        if (typeof raw !== 'string') errors.push({ field: key, message: 'Deve ser um texto.' });
        else if (raw.length > TEXT_FIELD_MAX_LENGTH) {
          errors.push({
            field: key,
            message: `Deve ter no máximo ${TEXT_FIELD_MAX_LENGTH} caracteres.`,
          });
        } else clean[field.code] = raw;
        break;
    }
  }
  return { values: clean, errors };
}
