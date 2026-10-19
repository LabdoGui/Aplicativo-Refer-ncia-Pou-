import type { CookieOptions, Request, Response } from 'express';
import { API_PREFIX, REFRESH_COOKIE_NAME, SESSION_HINT_COOKIE_NAME } from '@pulso/contracts';

/** O cookie só viaja para as rotas de autenticação. */
const COOKIE_PATH = `/${API_PREFIX}/auth`;

function baseOptions(secure: boolean): CookieOptions {
  return { httpOnly: true, sameSite: 'strict', secure, path: COOKIE_PATH };
}

/** Indicador de sessão: visível para o front em todo o site, sem conteúdo sensível. */
function hintOptions(secure: boolean): CookieOptions {
  return { httpOnly: false, sameSite: 'strict', secure, path: '/' };
}

export function setRefreshCookie(
  response: Response,
  token: string,
  maxAgeMs: number,
  secure: boolean,
): void {
  response.cookie(REFRESH_COOKIE_NAME, token, { ...baseOptions(secure), maxAge: maxAgeMs });
  response.cookie(SESSION_HINT_COOKIE_NAME, '1', { ...hintOptions(secure), maxAge: maxAgeMs });
}

export function clearRefreshCookie(response: Response, secure: boolean): void {
  response.clearCookie(REFRESH_COOKIE_NAME, baseOptions(secure));
  response.clearCookie(SESSION_HINT_COOKIE_NAME, hintOptions(secure));
}

export function readRefreshCookie(request: Request): string | undefined {
  const value = (request.cookies as Record<string, unknown> | undefined)?.[REFRESH_COOKIE_NAME];
  return typeof value === 'string' && value.length > 0 && value.length < 200 ? value : undefined;
}
