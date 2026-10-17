/**
 * Mensagens de validação em português para as regras do class-validator.
 *
 * As mensagens padrão da biblioteca vêm em inglês ("email must be an email").
 * Mensagens personalizadas no DTO (`@IsEmail({}, { message: '...' })`) são mantidas;
 * só as padrão, que começam pelo nome do campo, são traduzidas.
 */

type Translator = (defaultMessage: string) => string;

/** Primeiro número da mensagem padrão (ex.: o limite de minLength). */
const numberIn = (message: string) => message.match(/-?\d+(\.\d+)?/)?.[0] ?? '';
const listAfterColon = (message: string) => message.split(':').slice(1).join(':').trim();

const fixed =
  (text: string): Translator =>
  () =>
    text;

const TRANSLATIONS: Record<string, Translator> = {
  whitelistValidation: fixed('Campo não permitido.'),
  isDefined: fixed('Preenchimento obrigatório.'),
  isNotEmpty: fixed('Preenchimento obrigatório.'),
  isString: fixed('Deve ser um texto.'),
  isEmail: fixed('Informe um e-mail válido.'),
  isBoolean: fixed('Deve ser verdadeiro ou falso.'),
  isInt: fixed('Deve ser um número inteiro.'),
  isNumber: fixed('Deve ser um número.'),
  isPositive: fixed('Deve ser um número positivo.'),
  isUuid: fixed('Identificador inválido.'),
  isUUID: fixed('Identificador inválido.'),
  isDate: fixed('Informe uma data válida.'),
  isDateString: fixed('Informe uma data válida.'),
  isIso8601: fixed('Informe uma data válida.'),
  isISO8601: fixed('Informe uma data válida.'),
  isArray: fixed('Deve ser uma lista.'),
  isObject: fixed('Deve ser um objeto.'),
  isUrl: fixed('Informe um endereço (URL) válido.'),
  isIn: fixed('Valor não permitido.'),
  matches: fixed('Formato inválido.'),
  nestedValidation: fixed('Deve ser um objeto válido.'),
  isEnum: (message) => `Deve ser um destes valores: ${listAfterColon(message)}.`,
  minLength: (message) => `Deve ter ao menos ${numberIn(message)} caracteres.`,
  maxLength: (message) => `Deve ter no máximo ${numberIn(message)} caracteres.`,
  min: (message) => `Deve ser maior ou igual a ${numberIn(message)}.`,
  max: (message) => `Deve ser menor ou igual a ${numberIn(message)}.`,
  arrayNotEmpty: fixed('Informe ao menos um item.'),
  arrayMinSize: (message) => `Informe ao menos ${numberIn(message)} itens.`,
  arrayMaxSize: (message) => `Informe no máximo ${numberIn(message)} itens.`,
  arrayUnique: fixed('Não repita itens na lista.'),
};

const GENERIC = 'Valor inválido.';

/** As mensagens padrão do class-validator começam pelo nome do campo. */
function isDefaultMessage(property: string, message: string): boolean {
  return (
    message.startsWith(`${property} `) ||
    message.startsWith(`property ${property} `) ||
    message.startsWith('each value in ')
  );
}

/** Traduz a mensagem de uma regra; mantém mensagens personalizadas do DTO. */
export function translateConstraint(property: string, constraint: string, message: string): string {
  if (!isDefaultMessage(property, message)) return message;
  return TRANSLATIONS[constraint]?.(message) ?? GENERIC;
}
