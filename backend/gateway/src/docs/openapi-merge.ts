import type { OpenAPIObject, OperationObject, PathItemObject, TagObject } from '@nestjs/swagger';
import { resolveRoute } from '../proxy/route-resolver';

/** Documento OpenAPI de um serviço; `null` quando o serviço não respondeu. */
export interface OpenApiSource {
  name: string;
  title: string;
  document: OpenAPIObject | null;
}

export interface MergeOptions {
  title: string;
  version: string;
  /** Texto introdutório (Markdown); a lista de serviços é acrescentada a ele. */
  description: string;
  /** Documento das rotas do próprio gateway. */
  gateway: OpenAPIObject;
  services: OpenApiSource[];
  /** Decide se uma rota do serviço entra (padrão: só as que o gateway encaminha a ele). */
  isRoutable?: (service: string, path: string) => boolean;
}

type ComponentSection =
  | 'schemas'
  | 'responses'
  | 'parameters'
  | 'examples'
  | 'requestBodies'
  | 'headers'
  | 'links'
  | 'callbacks';

const SECTIONS: ComponentSection[] = [
  'schemas',
  'responses',
  'parameters',
  'examples',
  'requestBodies',
  'headers',
  'links',
  'callbacks',
];
const HTTP_METHODS = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']);
const GATEWAY_SOURCE = 'gateway';
const HEALTH_PATH = '/health';
const BEARER_SCHEME = { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } as const;

type Json = Record<string, unknown>;
type RefMapper = (ref: string) => string | undefined;

/** Rotas de um serviço que o gateway realmente encaminha a ele (exclui /health e /internal). */
export function routableThroughGateway(service: string, path: string): boolean {
  const route = resolveRoute(path);
  return route.kind === 'proxy' && route.service === service;
}

const escapePointer = (token: string) => token.replace(/~/g, '~0').replace(/\//g, '~1');
const unescapePointer = (token: string) => token.replace(/~1/g, '/').replace(/~0/g, '~');
const componentRef = (section: string, name: string) =>
  `#/components/${section}/${escapePointer(name)}`;
const prefixedName = (source: string, name: string) => `${source}.${name}`;

/** JSON com chaves ordenadas: compara definições independentemente da ordem das chaves. */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, current: unknown) =>
    current && typeof current === 'object' && !Array.isArray(current)
      ? Object.fromEntries(Object.entries(current).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : current,
  );
}

/** Cópia profunda reescrevendo `$ref` (e o `mapping` de discriminators). */
function rewriteRefs<T>(value: T, mapRef: RefMapper): T {
  if (Array.isArray(value)) return value.map((item) => rewriteRefs(item, mapRef)) as T;
  if (!value || typeof value !== 'object') return value;
  const copy: Json = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === '$ref' && typeof child === 'string') {
      copy[key] = mapRef(child) ?? child;
    } else if (key === 'mapping' && child && typeof child === 'object' && !Array.isArray(child)) {
      copy[key] = Object.fromEntries(
        Object.entries(child).map(([k, ref]) => [
          k,
          typeof ref === 'string' ? (mapRef(ref) ?? ref) : ref,
        ]),
      );
    } else {
      copy[key] = rewriteRefs(child, mapRef);
    }
  }
  return copy as T;
}

/** Mapeador de refs de uma fonte: nomes em colisão ganham o prefixo do serviço. */
function refMapperFor(source: string, renamed: Set<string>): RefMapper {
  return (ref) => {
    const match = /^#\/components\/([^/]+)\/(.+)$/.exec(ref);
    if (!match) return undefined;
    const [, section, token] = match;
    const name = unescapePointer(token);
    return renamed.has(`${section}/${name}`)
      ? componentRef(section, prefixedName(source, name))
      : undefined;
  };
}

/**
 * Descobre quais componentes precisam de prefixo: os que mais de uma fonte define
 * com conteúdos diferentes. Repete até estabilizar, porque renomear um componente
 * pode tornar diferentes outros que apontam para ele.
 */
function findCollisions(sources: Array<{ name: string; document: OpenAPIObject }>): Set<string> {
  const definitions = new Map<string, Array<{ source: string; definition: unknown }>>();
  for (const { name: source, document } of sources) {
    for (const section of SECTIONS) {
      for (const [name, definition] of Object.entries(document.components?.[section] ?? {})) {
        const key = `${section}/${name}`;
        definitions.set(key, [...(definitions.get(key) ?? []), { source, definition }]);
      }
    }
  }

  const renamed = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const [key, defs] of definitions) {
      if (defs.length < 2 || renamed.has(key)) continue;
      const variants = new Set(
        defs.map(({ source, definition }) =>
          stableStringify(rewriteRefs(definition, refMapperFor(source, renamed))),
        ),
      );
      if (variants.size > 1) {
        renamed.add(key);
        changed = true;
      }
    }
  }
  return renamed;
}

function buildDescription(options: MergeOptions): string {
  const label = (source: OpenApiSource) => `${source.title} (\`${source.name}\`)`;
  const available = options.services.filter((source) => source.document);
  const unavailable = options.services.filter((source) => !source.document);
  const lines = [options.description, ''];
  lines.push(`**Serviços incluídos:** ${available.map(label).join(', ') || 'nenhum'}.`);
  if (unavailable.length > 0) {
    lines.push(
      '',
      `**Serviços indisponíveis no momento** (as rotas deles não aparecem nesta página até voltarem): ${unavailable.map(label).join(', ')}.`,
    );
  }
  return lines.join('\n');
}

/**
 * Junta o documento do gateway e os dos serviços num único OpenAPI 3:
 * caminhos (sem o /health de cada processo), componentes (prefixados com o nome
 * do serviço só em caso de colisão, com os `$ref` reescritos), tags e o esquema
 * de segurança Bearer. Serviços indisponíveis são listados na descrição.
 */
export function mergeOpenApiDocuments(options: MergeOptions): OpenAPIObject {
  const isRoutable = options.isRoutable ?? routableThroughGateway;
  const sources = [
    { name: GATEWAY_SOURCE, title: 'Gateway', document: options.gateway },
    ...options.services.filter(
      (source): source is OpenApiSource & { document: OpenAPIObject } => source.document !== null,
    ),
  ];
  const renamed = findCollisions(sources);

  const paths: Record<string, PathItemObject> = {};
  const components: Record<string, Json> = { securitySchemes: {} };
  const declaredTags = new Map<string, TagObject>();
  const usedTags: string[] = [];
  const operationIds = new Set<string>();

  for (const source of sources) {
    const document = rewriteRefs(source.document, refMapperFor(source.name, renamed));

    for (const section of SECTIONS) {
      for (const [name, definition] of Object.entries(document.components?.[section] ?? {})) {
        const finalName = renamed.has(`${section}/${name}`)
          ? prefixedName(source.name, name)
          : name;
        components[section] ??= {};
        components[section][finalName] ??= definition;
      }
    }
    for (const [name, scheme] of Object.entries(document.components?.securitySchemes ?? {})) {
      components.securitySchemes[name] ??= scheme;
    }
    for (const tag of document.tags ?? []) {
      if (!declaredTags.has(tag.name)) declaredTags.set(tag.name, tag);
    }

    for (const [path, item] of Object.entries(document.paths ?? {})) {
      if (path === HEALTH_PATH) continue;
      if (source.name !== GATEWAY_SOURCE && !isRoutable(source.name, path)) continue;
      const target = (paths[path] ??= {}) as Json;
      for (const [key, value] of Object.entries(item)) {
        if (key in target) continue; // conflito: vale a primeira definição
        if (!HTTP_METHODS.has(key)) {
          target[key] = value;
          continue;
        }
        const operation = { ...(value as OperationObject) };
        // Operações sem tag ficam agrupadas sob o nome do serviço.
        if (!operation.tags || operation.tags.length === 0) operation.tags = [source.title];
        if (operation.operationId) {
          if (operationIds.has(operation.operationId)) {
            operation.operationId = `${source.name}_${operation.operationId}`;
          }
          operationIds.add(operation.operationId);
        }
        for (const tag of operation.tags) if (!usedTags.includes(tag)) usedTags.push(tag);
        target[key] = operation;
      }
    }
  }

  components.securitySchemes.bearer ??= { ...BEARER_SCHEME };

  return {
    openapi: '3.0.0',
    info: {
      title: options.title,
      version: options.version,
      description: buildDescription(options),
    },
    paths,
    components,
    tags: usedTags.map((name) => declaredTags.get(name) ?? { name }),
    'x-pulso-services': options.services.map((source) => ({
      name: source.name,
      title: source.title,
      available: source.document !== null,
    })),
  } as OpenAPIObject;
}
