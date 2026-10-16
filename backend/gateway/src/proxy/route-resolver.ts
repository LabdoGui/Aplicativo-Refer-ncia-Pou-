import { SERVICES, type ServiceDescriptor, type ServiceName } from '@pulso/contracts';
import { splitPath } from '../http/request-path';

/** Segmentos do prefixo externo da API (`/api/v1`). */
const API_SEGMENTS = ['api', 'v1'];

/** Primeiro segmento (após /api/v1) das rotas entre serviços, que nunca saem pelo gateway. */
const INTERNAL_SEGMENT = 'internal';

/**
 * Resultado da resolução de rota:
 * - `proxy`: encaminhar ao serviço dono do prefixo;
 * - `blocked`: rota interna (/api/v1/internal/**), responder 404;
 * - `invalid`: caminho malformado ou suspeito, responder 400;
 * - `local`: não é rota de serviço; segue para os controllers do próprio gateway (ou 404).
 */
export type RouteResolution =
  | { kind: 'proxy'; service: ServiceName; prefix: string }
  | { kind: 'blocked' }
  | { kind: 'invalid' }
  | { kind: 'local' };

interface RouteEntry {
  service: ServiceName;
  prefix: string;
  segments: string[];
}

function buildRouteTable(services: Iterable<ServiceDescriptor>): RouteEntry[] {
  const table: RouteEntry[] = [];
  const owners = new Map<string, ServiceName>();
  for (const service of services) {
    for (const prefix of service.routePrefixes) {
      const segments = splitPath(prefix);
      if (!segments || segments.length === 0) {
        throw new Error(`Prefixo de rota inválido para ${service.name}: "${prefix}"`);
      }
      const key = segments.join('/');
      const owner = owners.get(key);
      if (owner && owner !== service.name) {
        throw new Error(`Prefixo "${prefix}" declarado por ${owner} e ${service.name}`);
      }
      if (segments[0] === INTERNAL_SEGMENT) {
        throw new Error(`Prefixo "${prefix}" de ${service.name} expõe rotas internas`);
      }
      owners.set(key, service.name);
      table.push({ service: service.name, prefix: key, segments });
    }
  }
  // O prefixo mais longo vence (ex.: admin/users antes de um eventual admin).
  return table.sort((a, b) => b.segments.length - a.segments.length);
}

function startsWith(segments: string[], prefix: string[], offset = 0): boolean {
  return prefix.every((segment, index) => segments[offset + index] === segment);
}

/**
 * Cria a função pura que decide o destino de uma requisição a partir do caminho
 * (sem query string). O caminho repassado ao serviço não é alterado: os serviços
 * também montam suas rotas em /api/v1.
 */
export function createRouteResolver(
  services: Iterable<ServiceDescriptor> = Object.values(SERVICES),
): (pathname: string) => RouteResolution {
  const table = buildRouteTable(services);

  return (pathname) => {
    const segments = splitPath(pathname);
    if (!segments) return { kind: 'invalid' };
    if (!startsWith(segments, API_SEGMENTS)) return { kind: 'local' };

    const offset = API_SEGMENTS.length;
    if (segments[offset] === INTERNAL_SEGMENT) return { kind: 'blocked' };

    const entry = table.find((candidate) => startsWith(segments, candidate.segments, offset));
    return entry
      ? { kind: 'proxy', service: entry.service, prefix: entry.prefix }
      : { kind: 'local' };
  };
}

/** Resolvedor com o registro oficial de serviços de @pulso/contracts. */
export const resolveRoute = createRouteResolver();
