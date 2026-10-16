import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiExcludeController, type OpenAPIObject } from '@nestjs/swagger';
import type { Response } from 'express';
import { DocsService } from './docs.service';
import {
  DOCS_PAGE,
  DOCS_PAGE_CSP,
  INIT_SCRIPT,
  INIT_SCRIPT_FILE,
  swaggerUiAssetPath,
} from './swagger-ui';

const ASSET_MAX_AGE_MS = 60 * 60 * 1000;

/** Documentação unificada: GET /api/docs (Swagger UI) e GET /api/docs-json (OpenAPI). */
@ApiExcludeController()
@Controller('api')
export class DocsController {
  constructor(private readonly docs: DocsService) {}

  @Get('docs-json')
  document(): Promise<OpenAPIObject> {
    return this.docs.getMergedDocument();
  }

  @Get('docs')
  page(@Res() response: Response): void {
    response.setHeader('Content-Security-Policy', DOCS_PAGE_CSP);
    response.type('html').send(DOCS_PAGE);
  }

  @Get('docs/assets/:file')
  asset(@Param('file') file: string, @Res() response: Response): void {
    response.setHeader('Cache-Control', `public, max-age=${ASSET_MAX_AGE_MS / 1000}`);
    if (file === INIT_SCRIPT_FILE) {
      response.type('application/javascript').send(INIT_SCRIPT);
      return;
    }
    const path = swaggerUiAssetPath(file);
    if (!path) throw new NotFoundException();
    response.sendFile(path, { maxAge: ASSET_MAX_AGE_MS });
  }
}
