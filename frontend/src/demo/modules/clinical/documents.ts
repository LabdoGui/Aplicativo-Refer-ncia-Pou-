/**
 * Documentos (espelho de documents/*): emissão da declaração com PDF gerado no
 * navegador, lista do titular, arquivo e verificação pública pelo código.
 * O código de verificação usa as mesmas funções do back-end (verification-code.ts).
 */
import {
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPES,
  EVENTS,
  type AuthUser,
  type DocumentIssuedData,
  type DocumentType,
  type DocumentVerification,
  type DocumentView,
} from '@pulso/contracts';
import {
  canonicalCode,
  hashVerificationCode,
  initialsOf,
  newVerificationCode,
} from '@backend/services/clinical/src/documents/verification-code';
import { recordAudit } from '../../core/audit';
import { publish } from '../../core/events';
import { created, fail, fileResponse, ok, route, type AuthedRequest } from '../../core/http';
import { toLocalDate, uuid } from '../../core/support';
import { donationOf } from './attendances';
import { fromBase64, renderDocumentPdf, toBase64 } from './document-pdf';
import { clinical, SERVICE, type ClinicalDocument } from './state';
import {
  asString,
  assertCanWrite,
  bodyOf,
  Checker,
  UNPROCESSABLE_TITLE,
  uuidParam,
} from './validation';

const INVALID: DocumentVerification = {
  valid: false,
  type: null,
  title: null,
  holderInitials: null,
  unitName: null,
  attendanceDate: null,
  issuedAt: null,
};

function toView(document: ClinicalDocument): DocumentView {
  return {
    id: document.id,
    type: document.type,
    title: document.title,
    attendanceId: document.attendanceId,
    issuedAt: document.issuedAt,
    verificationCode: document.verificationCode,
  };
}

/**
 * Endereço público de verificação: a demonstração usa rotas com # no próprio
 * arquivo (no back-end, PUBLIC_APP_URL + /verificar/<código>).
 */
function verificationUrl(code: string): string {
  return `${location.origin}${location.pathname}#/verificar/${code}`;
}

/**
 * Emite (ou devolve, se já existir) a declaração de um atendimento finalizado
 * do próprio doador: 201 quando o documento é novo, 200 quando já existia.
 */
async function issue(actor: AuthUser, input: unknown) {
  const body = bodyOf(input);
  const check = new Checker(body, ['attendanceId', 'type']);
  const attendanceId = asString(body.attendanceId);
  const type = asString(body.type);
  check.uuidV4('attendanceId', attendanceId);
  check.oneOf('type', type, DOCUMENT_TYPES);
  check.done();
  const dto = { attendanceId: attendanceId as string, type: type as DocumentType };

  const state = clinical();
  const attendance = state.attendances.find((candidate) => candidate.id === dto.attendanceId);
  if (!attendance || attendance.donorId !== actor.id || !attendance.completedAt) {
    fail(404, 'ATTENDANCE_NOT_FOUND', 'Atendimento não encontrado.');
  }
  if (dto.type === 'DONATION_DECLARATION' && donationOf(attendance.id)?.status !== 'COMPLETED') {
    fail(
      422,
      'DONATION_NOT_COMPLETED',
      'A declaração de doação só é emitida para doações concluídas. Você pode emitir a declaração de comparecimento.',
      UNPROCESSABLE_TITLE,
    );
  }
  const existing = state.documents.find(
    (document) => document.attendanceId === attendance.id && document.type === dto.type,
  );
  if (existing) return ok(toView(existing));

  const code = newVerificationCode();
  const issuedAt = new Date().toISOString();
  const title = DOCUMENT_TYPE_LABELS[dto.type];
  const { pdf, sha256 } = await renderDocumentPdf({
    type: dto.type,
    holderName: actor.name,
    unitName: attendance.unitName,
    attendedAt: attendance.createdAt,
    issuedAt,
    verificationCode: code,
    verificationUrl: verificationUrl(code),
  });
  // Duas emissões simultâneas do mesmo documento: devolve o que venceu (unique attendanceId+type).
  const winner = state.documents.find(
    (document) => document.attendanceId === attendance.id && document.type === dto.type,
  );
  if (winner) return ok(toView(winner));

  const document: ClinicalDocument = {
    id: uuid(),
    donorId: actor.id,
    attendanceId: attendance.id,
    type: dto.type,
    title,
    verificationCodeHash: hashVerificationCode(code),
    verificationCode: code,
    holderInitials: initialsOf(actor.name),
    unitName: attendance.unitName,
    attendanceDate: toLocalDate(attendance.createdAt),
    pdfBase64: toBase64(pdf),
    sha256,
    issuedAt,
  };
  state.documents.push(document);
  publish<DocumentIssuedData>(EVENTS.DOCUMENT_ISSUED, {
    documentId: document.id,
    donorId: actor.id,
    title,
  });
  recordAudit(SERVICE, {
    actor,
    action: 'document.issued',
    entity: 'document',
    entityId: document.id,
    metadata: { type: dto.type, attendanceId: attendance.id },
  });
  return created(toView(document));
}

function mine(actor: AuthUser): DocumentView[] {
  return clinical()
    .documents.filter((document) => document.donorId === actor.id)
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
    .map(toView);
}

function file(actor: AuthUser, id: string) {
  const document = clinical().documents.find((candidate) => candidate.id === id);
  if (!document || document.donorId !== actor.id) {
    fail(404, 'DOCUMENT_NOT_FOUND', 'Documento não encontrado.');
  }
  const kind =
    document.type === 'DONATION_DECLARATION' ? 'declaracao-doacao' : 'declaracao-comparecimento';
  const bytes = fromBase64(document.pdfBase64);
  const response = fileResponse(
    new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
    'application/pdf',
  );
  Object.assign(response.headers, {
    'cache-control': 'no-store',
    'x-content-sha256': document.sha256,
    'content-disposition': `inline; filename="pulso-${kind}-${document.attendanceDate}.pdf"`,
  });
  return response;
}

/** Verificação pública: confirma a autenticidade sem expor dados pessoais. */
function verify(code: string): DocumentVerification {
  const canonical = canonicalCode(code);
  if (!canonical) return INVALID;
  const hash = hashVerificationCode(canonical);
  const document = clinical().documents.find(
    (candidate) => candidate.verificationCodeHash === hash,
  );
  if (!document) return INVALID;
  return {
    valid: true,
    type: document.type,
    title: document.title,
    holderInitials: document.holderInitials,
    unitName: document.unitName,
    attendanceDate: document.attendanceDate,
    issuedAt: document.issuedAt,
  };
}

export function registerDocuments(): void {
  route('GET', '/documents/verify/:code', (request) => verify(request.params.code.slice(0, 64)), {
    auth: 'public',
  });
  const self = { permissions: ['self:documents' as const] };
  route(
    'POST',
    '/documents',
    (request: AuthedRequest) => {
      assertCanWrite(request.user);
      return issue(request.user, request.body);
    },
    self,
  );
  route('GET', '/documents/me', (request) => mine(request.user), self);
  route(
    'GET',
    '/documents/:id/file',
    (request) => file(request.user, uuidParam(request.params.id)),
    self,
  );
}
