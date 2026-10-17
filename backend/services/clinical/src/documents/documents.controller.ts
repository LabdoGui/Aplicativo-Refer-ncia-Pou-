import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser, Public, RequestId, RequirePermissions, requireUser } from '@pulso/common';
import type { AuthUser, DocumentVerification, DocumentView } from '@pulso/contracts';
import { DocumentsService } from './documents.service';
import { IssueDocumentDto } from './dto/document.dto';

@ApiTags('Documentos')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  // Declarada antes de ":id/file" para "verify/<código>" nunca cair na outra rota.
  @Public()
  @Get('verify/:code')
  @ApiOperation({
    summary: 'Verificação pública de um documento (mostra só iniciais, unidade e datas)',
  })
  verify(@Param('code') code: string): Promise<DocumentVerification> {
    return this.documents.verify(code.slice(0, 64));
  }

  @Post()
  @ApiBearerAuth()
  @RequirePermissions('self:documents')
  @ApiOperation({
    summary:
      'Gerar a declaração de comparecimento ou de doação de um atendimento (idempotente: devolve a existente)',
  })
  @ApiCreatedResponse({ description: 'Documento gerado' })
  @ApiOkResponse({ description: 'Documento já existia' })
  async issue(
    @Body() dto: IssueDocumentDto,
    @Res({ passthrough: true }) response: Response,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<DocumentView> {
    const { document, created } = await this.documents.issue(requireUser(user), dto, requestId);
    response.status(created ? 201 : 200);
    return document;
  }

  @Get('me')
  @ApiBearerAuth()
  @RequirePermissions('self:documents')
  @ApiOperation({ summary: 'Meus documentos emitidos' })
  mine(@CurrentUser() user?: AuthUser): Promise<DocumentView[]> {
    return this.documents.mine(requireUser(user));
  }

  @Get(':id/file')
  @ApiBearerAuth()
  @RequirePermissions('self:documents')
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'Arquivo PDF de um documento meu' })
  async file(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res({ passthrough: true }) response: Response,
    @CurrentUser() user?: AuthUser,
  ): Promise<StreamableFile> {
    const { pdf, filename, sha256 } = await this.documents.file(requireUser(user), id);
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-SHA256', sha256);
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `inline; filename="${filename}"`,
      length: pdf.length,
    });
  }
}
