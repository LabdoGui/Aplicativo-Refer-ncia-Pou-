import { AppException } from '../errors/app.exception';

/**
 * Motivo da falha ao validar um token:
 * - `invalid`: problema da credencial (vencida, assinatura errada, malformada,
 *   chave desconhecida, claims ausentes) → 401;
 * - `unavailable`: não foi possível validar agora (JWKS fora do ar, lento ou
 *   com resposta inválida, erro de rede) → 503.
 */
export type TokenVerificationFailure = 'invalid' | 'unavailable';

/** Erro lançado pelos verificadores do SangueConecta com a classificação já definida. */
export class TokenVerificationError extends Error {
  constructor(
    readonly failure: TokenVerificationFailure,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'TokenVerificationError';
  }
}

/**
 * Códigos de erro do `jose` que indicam credencial inválida. Os demais
 * (ERR_JWKS_TIMEOUT, ERR_JWKS_INVALID, ERR_JWK_INVALID e ERR_JOSE_GENERIC,
 * usado para resposta não-200 ou JSON inválido do JWKS) indicam que as chaves
 * não puderam ser obtidas.
 */
const CREDENTIAL_ERROR_CODES = new Set([
  'ERR_JWT_EXPIRED',
  'ERR_JWT_CLAIM_VALIDATION_FAILED',
  'ERR_JWT_INVALID',
  'ERR_JWS_INVALID',
  'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
  'ERR_JWKS_NO_MATCHING_KEY',
  'ERR_JWKS_MULTIPLE_MATCHING_KEYS',
  'ERR_JOSE_ALG_NOT_ALLOWED',
  'ERR_JOSE_NOT_SUPPORTED',
]);

/**
 * Classifica o erro de `TokenVerifier.verify()`. Na dúvida (erro de rede,
 * TypeError, erro desconhecido) o resultado é `unavailable`: a requisição é
 * negada do mesmo jeito, mas a sessão do usuário não é tratada como vencida
 * e a causa fica registrada.
 */
export function classifyVerificationError(error: unknown): TokenVerificationFailure {
  if (error instanceof TokenVerificationError) return error.failure;
  const code = (error as { code?: unknown } | null | undefined)?.code;
  return typeof code === 'string' && CREDENTIAL_ERROR_CODES.has(code) ? 'invalid' : 'unavailable';
}

export const TOKEN_INVALID_DETAIL = 'Sua sessão expirou. Entre novamente.';
export const AUTH_UNAVAILABLE_DETAIL =
  'Não foi possível validar sua sessão agora. Tente novamente em instantes.';

interface ErrorLogger {
  error(message: unknown, ...optionalParams: unknown[]): unknown;
}

/**
 * Converte a falha de validação em AppException: 401 TOKEN_INVALID para
 * credencial inválida; 503 AUTH_UNAVAILABLE para indisponibilidade, registrada
 * aqui como erro, com a causa (o filtro de Problem Details só registra um aviso).
 */
export function tokenVerificationException(
  error: unknown,
  logger: ErrorLogger,
  context: Record<string, unknown> = {},
): AppException {
  if (classifyVerificationError(error) === 'invalid') {
    return new AppException(401, 'TOKEN_INVALID', TOKEN_INVALID_DETAIL);
  }
  logger.error(
    { ...context, err: error },
    'Não foi possível validar o token: falha ao obter as chaves públicas (JWKS) ou erro inesperado',
  );
  return new AppException(503, 'AUTH_UNAVAILABLE', AUTH_UNAVAILABLE_DETAIL, 'Serviço indisponível');
}
