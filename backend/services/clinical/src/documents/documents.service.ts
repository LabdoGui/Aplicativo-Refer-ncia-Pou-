import { Inject, Injectable } from '@nestjs/common';
import {
  APP_CONFIG,
  AppException,
  AuditService,
  FieldEncryption,
  OutboxService,
  toLocalDate,
} from '@pulso/common';
import {
  DOCUMENT_TYPE_LABELS,
  EVENTS,
  type AuthUser,
  type DocumentVerification,
  type DocumentView,
} from '@pulso/contracts';
import { Prisma, type Document } from '../../generated/prisma';
import type { ClinicalEnv } from '../config';
import { PrismaService } from '../prisma/prisma.service';
import { renderDocumentPdf } from './document-pdf';
import type { IssueDocumentDto } from './dto/document.dto';
import {
  canonicalCode,
  hashVerificationCode,
  initialsOf,
  newVerificationCode,
} from './verification-code';

const INVALID: DocumentVerification = {
  valid: false,
  type: null,
  title: null,
  holderInitials: null,
  unitName: null,
  attendanceDate: null,
  issuedAt: null,
};

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: FieldEncryption,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: ClinicalEnv,
  ) {}

  /**
   * Emite (ou devolve, se já existir) a declaração de um atendimento finalizado
   * do próprio doador. `created` diz se o documento é novo.
   */
  async issue(
    actor: AuthUser,
    dto: IssueDocumentDto,
    requestId?: string,
  ): Promise<{ document: DocumentView; created: boolean }> {
    const attendance = await this.prisma.professionalScreening.findUnique({
      where: { id: dto.attendanceId },
      include: { donation: { select: { status: true } } },
    });
    if (!attendance || attendance.donorId !== actor.id || !attendance.completedAt) {
      throw new AppException(404, 'ATTENDANCE_NOT_FOUND', 'Atendimento não encontrado.');
    }
    if (dto.type === 'DONATION_DECLARATION' && attendance.donation?.status !== 'COMPLETED') {
      throw new AppException(
        422,
        'DONATION_NOT_COMPLETED',
        'A declaração de doação só é emitida para doações concluídas. Você pode emitir a declaração de comparecimento.',
      );
    }
    const existing = await this.prisma.document.findUnique({
      where: { attendanceId_type: { attendanceId: attendance.id, type: dto.type } },
    });
    if (existing) return { document: this.toView(existing), created: false };

    const code = newVerificationCode();
    const issuedAt = new Date();
    const title = DOCUMENT_TYPE_LABELS[dto.type];
    const { pdf, sha256 } = await renderDocumentPdf({
      type: dto.type,
      holderName: actor.name,
      unitName: attendance.unitName,
      attendedAt: attendance.createdAt,
      issuedAt,
      verificationCode: code,
      verificationUrl: `${this.config.PUBLIC_APP_URL.replace(/\/$/, '')}/verificar/${code}`,
    });
    try {
      const document = await this.prisma.$transaction(async (tx) => {
        const created = await tx.document.create({
          data: {
            donorId: actor.id,
            attendanceId: attendance.id,
            type: dto.type,
            title,
            verificationCodeHash: hashVerificationCode(code),
            verificationCodeEncrypted: this.encryption.encrypt(code),
            holderInitials: initialsOf(actor.name),
            unitName: attendance.unitName,
            attendanceDate: new Date(`${toLocalDate(attendance.createdAt)}T00:00:00Z`),
            pdf: new Uint8Array(pdf),
            sha256,
            issuedAt,
          },
        });
        await this.outbox.enqueue(
          tx,
          EVENTS.DOCUMENT_ISSUED,
          { documentId: created.id, donorId: actor.id, title },
          requestId,
        );
        await this.audit.record(
          {
            actor,
            action: 'document.issued',
            entity: 'document',
            entityId: created.id,
            metadata: { type: dto.type, attendanceId: attendance.id },
            requestId,
          },
          tx,
        );
        return created;
      });
      return { document: this.toView(document), created: true };
    } catch (error) {
      // Duas emissões simultâneas do mesmo documento: devolve o que venceu.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const winner = await this.prisma.document.findUnique({
          where: { attendanceId_type: { attendanceId: attendance.id, type: dto.type } },
        });
        if (winner) return { document: this.toView(winner), created: false };
      }
      throw error;
    }
  }

  async mine(actor: AuthUser): Promise<DocumentView[]> {
    const documents = await this.prisma.document.findMany({
      where: { donorId: actor.id },
      orderBy: { issuedAt: 'desc' },
      omit: { pdf: true },
    });
    return documents.map((document) => this.toView(document));
  }

  async file(
    actor: AuthUser,
    id: string,
  ): Promise<{ pdf: Buffer; filename: string; sha256: string }> {
    const document = await this.prisma.document.findUnique({ where: { id } });
    if (!document || document.donorId !== actor.id) {
      throw new AppException(404, 'DOCUMENT_NOT_FOUND', 'Documento não encontrado.');
    }
    const kind =
      document.type === 'DONATION_DECLARATION' ? 'declaracao-doacao' : 'declaracao-comparecimento';
    return {
      pdf: Buffer.from(document.pdf),
      filename: `pulso-${kind}-${document.attendanceDate.toISOString().slice(0, 10)}.pdf`,
      sha256: document.sha256,
    };
  }

  /** Verificação pública: confirma a autenticidade sem expor dados pessoais. */
  async verify(code: string): Promise<DocumentVerification> {
    const canonical = canonicalCode(code);
    if (!canonical) return INVALID;
    const document = await this.prisma.document.findUnique({
      where: { verificationCodeHash: hashVerificationCode(canonical) },
      omit: { pdf: true },
    });
    if (!document) return INVALID;
    return {
      valid: true,
      type: document.type,
      title: document.title,
      holderInitials: document.holderInitials,
      unitName: document.unitName,
      attendanceDate: document.attendanceDate.toISOString().slice(0, 10),
      issuedAt: document.issuedAt.toISOString(),
    };
  }

  private toView(document: Omit<Document, 'pdf'>): DocumentView {
    return {
      id: document.id,
      type: document.type,
      title: document.title,
      attendanceId: document.attendanceId,
      issuedAt: document.issuedAt.toISOString(),
      verificationCode: this.encryption.decrypt(document.verificationCodeEncrypted),
    };
  }
}
