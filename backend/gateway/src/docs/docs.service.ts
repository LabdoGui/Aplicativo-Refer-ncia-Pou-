import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';
import { APP_CONFIG } from '@pulso/common';
import type { GatewayEnv } from '../config';
import { fetchJson } from '../upstreams/fetch-json';
import { UPSTREAMS, type Upstream } from '../upstreams/upstreams';
import { mergeOpenApiDocuments, type OpenApiSource } from './openapi-merge';

/** Por quanto tempo o documento unificado é reaproveitado. */
export const DOCS_CACHE_TTL_MS = 30_000;
const DOCS_FETCH_TIMEOUT_MS = 3_000;

const INTRODUCTION = [
  'Documentação unificada das APIs do Pulso, reunida pelo gateway a partir do Swagger de cada serviço.',
  '',
  'Todas as rotas usam o prefixo `/api/v1`. Rotas protegidas exigem o cabeçalho `Authorization: Bearer <token>` ' +
    '(use o botão **Authorize**). Erros seguem o formato Problem Details (RFC 9457).',
].join('\n');

function isOpenApiDocument(value: unknown): value is OpenAPIObject {
  const candidate = value as Partial<OpenAPIObject> | undefined;
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    typeof candidate.openapi === 'string' &&
    typeof candidate.paths === 'object'
  );
}

/** Monta (e guarda por 30 s) o OpenAPI unificado do gateway + serviços. */
@Injectable()
export class DocsService {
  private readonly logger = new Logger(DocsService.name);
  private gatewayDocument: OpenAPIObject | undefined;
  private cache: { document: OpenAPIObject; expiresAt: number } | undefined;
  private inFlight: Promise<OpenAPIObject> | undefined;

  constructor(
    @Inject(UPSTREAMS) private readonly upstreams: Upstream[],
    @Inject(APP_CONFIG) private readonly config: GatewayEnv,
  ) {}

  /** Documento das rotas do próprio gateway, gerado no bootstrap pelo SwaggerModule. */
  setGatewayDocument(document: OpenAPIObject): void {
    this.gatewayDocument = document;
    this.cache = undefined;
  }

  async getMergedDocument(): Promise<OpenAPIObject> {
    if (this.cache && this.cache.expiresAt > Date.now()) return this.cache.document;
    // Requisições simultâneas compartilham a mesma montagem.
    this.inFlight ??= this.build().finally(() => {
      this.inFlight = undefined;
    });
    return this.inFlight;
  }

  private async build(): Promise<OpenAPIObject> {
    const services = await Promise.all(
      this.upstreams.map(async (upstream): Promise<OpenApiSource> => ({
        name: upstream.name,
        title: upstream.title,
        document: await this.fetchServiceDocument(upstream),
      })),
    );
    const document = mergeOpenApiDocuments({
      title: 'Pulso — API',
      version: this.config.SERVICE_VERSION,
      description: INTRODUCTION,
      gateway: this.gatewayDocument ?? {
        openapi: '3.0.0',
        info: { title: '', version: '' },
        paths: {},
      },
      services,
    });
    this.cache = { document, expiresAt: Date.now() + DOCS_CACHE_TTL_MS };
    return document;
  }

  private async fetchServiceDocument(upstream: Upstream): Promise<OpenAPIObject | null> {
    try {
      const result = await fetchJson(`${upstream.url}/docs-json`, {
        timeoutMs: DOCS_FETCH_TIMEOUT_MS,
      });
      if (result.ok && isOpenApiDocument(result.body)) return result.body;
      this.logger.warn(
        { service: upstream.name, status: result.status },
        'Documento OpenAPI inválido',
      );
    } catch (error) {
      this.logger.warn({ err: error, service: upstream.name }, 'Documento OpenAPI indisponível');
    }
    return null;
  }
}
