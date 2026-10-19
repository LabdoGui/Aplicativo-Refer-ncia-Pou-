/** Caminho da página pública de verificação para um código. */
export const verificationPathFor = (code: string): string =>
  `/verificar/${encodeURIComponent(code)}`;
