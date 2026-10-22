/**
 * Doações (espelho de donations/*): registro pela equipe, histórico e data
 * informativa do doador, e a listagem da administração.
 */
import { DateTime } from 'luxon';
import {
  BLOOD_TYPES,
  DONATION_STATUSES,
  EVENTS,
  type AdminDonationItem,
  type AttendanceCompletedData,
  type AttendanceStaffView,
  type AuthUser,
  type BloodType,
  type DonationCompletedData,
  type DonationStatus,
  type DonorAttendanceView,
  type EligibilityView,
  type Paginated,
} from '@pulso/contracts';
import { recordAudit } from '../../core/audit';
import { publish } from '../../core/events';
import { fail, route, type AuthedRequest } from '../../core/http';
import {
  assertUnitScope,
  humanCode,
  localDayRange,
  paginate,
  todayLocal,
  uuid,
} from '../../core/support';
import { donationOf, toAttendanceStaffView } from './attendances';
import { nextEligibleDate } from './eligibility';
import { preScreeningsOf } from './pre-screening';
import { getSettings } from './settings';
import { clinical, SERVICE, type ClinicalAttendance, type ClinicalDonation } from './state';
import {
  asNumber,
  asString,
  assertCanWrite,
  bodyOf,
  Checker,
  isUuid,
  trim,
  UNPROCESSABLE_TITLE,
  uuidParam,
} from './validation';

function donationExists(): never {
  return fail(
    409,
    'DONATION_EXISTS',
    'A doação deste atendimento já foi registrada. Atualize a página.',
  );
}

function uniqueCode(): string {
  const taken = new Set(clinical().donations.map((donation) => donation.code));
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = humanCode('DO');
    if (!taken.has(code)) return code;
  }
  throw new Error('Não foi possível gerar um código de doação único');
}

/** Registra a doação de um atendimento com triagem apta e finaliza o atendimento. */
function record(actor: AuthUser, input: unknown): AttendanceStaffView {
  const body = bodyOf(input);
  const check = new Checker(body, ['attendanceId', 'bloodType', 'volumeMl', 'status', 'notes']);
  const attendanceId = asString(body.attendanceId);
  const bloodType = asString(body.bloodType);
  const volumeMl = asNumber(body.volumeMl);
  const status = asString(body.status);
  const notes = trim(asString(body.notes));
  check.uuidV4('attendanceId', attendanceId);
  check.oneOf('bloodType', bloodType, BLOOD_TYPES);
  check.number('volumeMl', volumeMl, { int: true, min: 0, max: 1000 });
  check.oneOf('status', status, DONATION_STATUSES);
  if (notes !== undefined && notes !== null) check.string('notes', notes, { max: 1000 });
  check.done();
  const dto = {
    attendanceId: attendanceId as string,
    bloodType: bloodType as BloodType,
    volumeMl: volumeMl as number,
    status: status as DonationStatus,
    notes: typeof notes === 'string' ? notes : undefined,
  };

  // Doação concluída tem volume coletado; 0 mL só faz sentido em "não concluída".
  if (dto.status === 'COMPLETED' && dto.volumeMl <= 0) {
    fail(400, 'VALIDATION_ERROR', 'Informe o volume coletado.', 'Dados inválidos', [
      { field: 'volumeMl', message: 'Para uma doação concluída, informe um volume maior que zero.' },
    ]);
  }
  const state = clinical();
  const attendance = state.attendances.find((candidate) => candidate.id === dto.attendanceId);
  if (!attendance) fail(404, 'ATTENDANCE_NOT_FOUND', 'Atendimento não encontrado.');
  assertUnitScope(actor, attendance.unitId);
  if (donationOf(attendance.id)) donationExists();
  if (attendance.result !== 'FIT') {
    fail(
      422,
      'SCREENING_NOT_FIT',
      'A doação só pode ser registrada quando a triagem foi concluída como apta.',
      UNPROCESSABLE_TITLE,
    );
  }
  if (attendance.completedAt) {
    fail(409, 'ATTENDANCE_COMPLETED', 'Este atendimento já foi finalizado.');
  }

  const settings = getSettings();
  const now = new Date().toISOString();
  const completed = dto.status === 'COMPLETED';
  const donation: ClinicalDonation = {
    id: uuid(),
    code: uniqueCode(),
    attendanceId: attendance.id,
    donorId: attendance.donorId,
    unitId: attendance.unitId,
    unitName: attendance.unitName,
    campaignId: attendance.campaignId,
    professionalId: actor.id,
    bloodType: dto.bloodType,
    volumeMl: dto.volumeMl,
    status: dto.status,
    notes: dto.notes ? dto.notes : null,
    occurredAt: now,
    nextEligibleAt: completed ? nextEligibleDate(now, settings.donationIntervalDays) : null,
    createdAt: now,
  };
  state.donations.push(donation);
  attendance.completedAt = now;
  if (completed) {
    publish<DonationCompletedData>(EVENTS.DONATION_COMPLETED, {
      donationId: donation.id,
      code: donation.code,
      donorId: donation.donorId,
      unitId: donation.unitId,
      attendanceId: attendance.id,
      campaignId: donation.campaignId,
      occurredAt: now,
    });
  }
  publish<AttendanceCompletedData>(EVENTS.ATTENDANCE_COMPLETED, {
    attendanceId: attendance.id,
    appointmentId: attendance.appointmentId,
    donorId: attendance.donorId,
    unitId: attendance.unitId,
    donationCompleted: completed,
    donationId: donation.id,
    campaignId: attendance.campaignId,
    occurredAt: now,
  });
  recordAudit(SERVICE, {
    actor,
    action: 'donation.recorded',
    entity: 'donation',
    entityId: donation.id,
    metadata: { attendanceId: attendance.id, status: dto.status },
  });
  return toAttendanceStaffView(attendance);
}

/** Atendimento visto pelo doador: sem resultado nem valores da triagem (RN19). */
function toDonorAttendanceView(row: ClinicalAttendance): DonorAttendanceView {
  const donation = donationOf(row.id);
  const documents = clinical()
    .documents.filter((document) => document.attendanceId === row.id)
    .sort((a, b) => a.issuedAt.localeCompare(b.issuedAt));
  return {
    id: row.id,
    attendedAt: row.createdAt,
    unitName: row.unitName,
    campaignTitle: row.campaignTitle,
    donation: donation
      ? {
          id: donation.id,
          code: donation.code,
          status: donation.status,
          volumeMl: donation.status === 'COMPLETED' ? donation.volumeMl : null,
        }
      : null,
    documents: documents.map((document) => ({ id: document.id, type: document.type })),
  };
}

/** Atendimentos finalizados do doador (sem resultado nem valores da triagem). */
function history(actor: AuthUser): DonorAttendanceView[] {
  return clinical()
    .attendances.filter((row) => row.donorId === actor.id && row.completedAt !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toDonorAttendanceView);
}

function attendance(actor: AuthUser, attendanceId: string): DonorAttendanceView {
  const row = clinical().attendances.find((candidate) => candidate.id === attendanceId);
  if (!row || row.donorId !== actor.id || !row.completedAt) {
    fail(404, 'ATTENDANCE_NOT_FOUND', 'Atendimento não encontrado.');
  }
  return toDonorAttendanceView(row);
}

/**
 * Data informativa da próxima doação (RN04), calculada com o intervalo vigente
 * a partir da última doação registrada. Se a pré-triagem válida mais recente
 * indicar uma data posterior (ex.: última doação autodeclarada), vale essa.
 */
function eligibility(actor: AuthUser): EligibilityView {
  const settings = getSettings();
  const last = clinical()
    .donations.filter((donation) => donation.donorId === actor.id && donation.status === 'COMPLETED')
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];
  const now = Date.now();
  const preScreening = preScreeningsOf(actor.id).find(
    (candidate) => Date.parse(candidate.expiresAt) > now,
  );
  const fromDonation = last ? nextEligibleDate(last.occurredAt, settings.donationIntervalDays) : null;
  const fromPreScreening = preScreening?.waitUntil ?? null;
  const usePreScreening =
    fromPreScreening !== null && (fromDonation === null || fromPreScreening > fromDonation);
  return {
    lastDonationAt: last?.occurredAt ?? null,
    nextEligibleAt: usePreScreening ? fromPreScreening : fromDonation,
    source: usePreScreening ? 'PRE_SCREENING' : fromDonation ? 'DONATION' : null,
    intervalDays: settings.donationIntervalDays,
    validationStatus: settings.intervalValidationStatus,
  };
}

const ADMIN_QUERY_KEYS = ['page', 'pageSize', 'from', 'to', 'unitId', 'bloodType', 'status'];

/** @IsISO8601({ strict: true }): data (ou data e hora) ISO válida. */
function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}/.test(value) && DateTime.fromISO(value).isValid;
}

function adminList(query: URLSearchParams): Paginated<AdminDonationItem> {
  const params = Object.fromEntries(query.entries());
  const check = new Checker(params, ADMIN_QUERY_KEYS);
  for (const key of ['page', 'pageSize'] as const) {
    if (params[key] !== undefined) {
      check.number(key, Number(params[key]), { int: true, min: 1, max: key === 'pageSize' ? 100 : undefined });
    }
  }
  for (const key of ['from', 'to'] as const) {
    if (params[key] && !isIsoDate(params[key])) check.add(key, 'Informe uma data válida.');
  }
  if (params.unitId && !isUuid(params.unitId)) check.add('unitId', 'Identificador inválido.');
  if (params.bloodType) check.oneOf('bloodType', params.bloodType, BLOOD_TYPES);
  if (params.status) check.oneOf('status', params.status, DONATION_STATUSES);
  check.done();

  let period: { start: number; end: number } | undefined;
  try {
    if (params.from || params.to) {
      const range = localDayRange(params.from || '2000-01-01', params.to || todayLocal());
      period = { start: range.start.getTime(), end: range.end.getTime() };
    }
  } catch {
    fail(400, 'INVALID_PERIOD', 'Informe datas válidas no formato AAAA-MM-DD.');
  }
  const attendances = new Map(clinical().attendances.map((row) => [row.id, row]));
  const rows = clinical()
    .donations.filter((row) => {
      const time = Date.parse(row.occurredAt);
      return (
        (!period || (time >= period.start && time <= period.end)) &&
        (!params.unitId || row.unitId === params.unitId) &&
        (!params.bloodType || row.bloodType === params.bloodType) &&
        (!params.status || row.status === params.status)
      );
    })
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .map(
      (row): AdminDonationItem => ({
        id: row.id,
        code: row.code,
        status: row.status,
        bloodType: row.bloodType,
        volumeMl: row.volumeMl,
        unitId: row.unitId,
        unitName: row.unitName,
        occurredAt: row.occurredAt,
        campaignTitle: attendances.get(row.attendanceId)?.campaignTitle ?? null,
      }),
    );
  return paginate(rows, query);
}

export function registerDonations(): void {
  route(
    'POST',
    '/donations',
    (request: AuthedRequest) => {
      assertCanWrite(request.user);
      return record(request.user, request.body);
    },
    { permissions: ['donation:record'] },
  );
  const self = { permissions: ['self:donations' as const] };
  route('GET', '/donations/history', (request) => history(request.user), self);
  route(
    'GET',
    '/donations/history/:attendanceId',
    (request) => attendance(request.user, uuidParam(request.params.attendanceId)),
    self,
  );
  route('GET', '/donations/eligibility', (request) => eligibility(request.user), self);
  route('GET', '/admin/donations', (request) => adminList(request.query), {
    permissions: ['donation:read-all'],
  });
}
