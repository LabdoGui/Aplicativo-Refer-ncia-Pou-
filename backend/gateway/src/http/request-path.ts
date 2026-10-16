/** Caminho da URL sem a query string (sem normalizar: é exatamente o que será repassado). */
export function pathnameOf(url: string): string {
  const queryStart = url.indexOf('?');
  return queryStart === -1 ? url : url.slice(0, queryStart);
}

/**
 * Divide um caminho em segmentos decodificados e em minúsculas, ignorando
 * barras repetidas ou finais (o roteador do Express também não diferencia).
 *
 * Retorna `null` para caminhos suspeitos, que nunca são legítimos na API:
 * segmentos "." ou "..", barras codificadas (%2F, %5C) ou percent-encoding inválido.
 */
export function splitPath(pathname: string): string[] | null {
  const segments: string[] = [];
  for (const raw of pathname.split('/')) {
    if (raw === '') continue;
    let decoded: string;
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      return null;
    }
    if (decoded === '.' || decoded === '..' || /[/\\]/.test(decoded)) return null;
    segments.push(decoded.toLowerCase());
  }
  return segments;
}
