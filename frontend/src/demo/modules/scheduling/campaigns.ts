/**
 * Campanhas (campaigns/campaigns.controller.ts e campaigns.service.ts).
 */
import {
  BLOOD_TYPES,
  hasPermission,
  type BloodType,
  type CampaignInput,
  type CampaignView,
} from '@pulso/contracts';
import { recordAudit } from '../../core/audit';
import { fail, route, type AuthedRequest, type DemoRequest } from '../../core/http';
import { nowIso, todayLocal, toLocalDate, uuid } from '../../core/support';
import {
  SERVICE,
  byText,
  findCampaign,
  findUnit,
  state,
  toCampaignView,
  type SchedulingCampaign,
} from './model';
import { includeInactiveQuery } from './units';
import { DATE_ONLY, DATE_ONLY_MESSAGE, Validator, is, parseUuid, trim } from './validation';

/** A campanha vale para o agendamento: ativa, na data e na unidade (ou em todas). */
export function campaignAppliesTo(
  campaign: Pick<SchedulingCampaign, 'active' | 'unitId' | 'startsAt' | 'endsAt'>,
  unitId: string,
  localDate: string,
): boolean {
  return (
    campaign.active &&
    (campaign.unitId === null || campaign.unitId === unitId) &&
    campaign.startsAt <= localDate &&
    localDate <= campaign.endsAt
  );
}

/**
 * Valida a campanha escolhida no agendamento. Sem campanha → null.
 * `tolerant` (reagendamento): campanha que não vale mais vira null em vez de erro.
 */
export function resolveCampaignForBooking(
  campaignId: string | null | undefined,
  unitId: string,
  startsAt: Date,
  zone: string,
  tolerant = false,
): string | null {
  if (!campaignId) return null;
  const campaign = findCampaign(campaignId);
  if (campaign && campaignAppliesTo(campaign, unitId, toLocalDate(startsAt, zone))) {
    return campaign.id;
  }
  if (tolerant) return null;
  fail(
    422,
    'INVALID_CAMPAIGN',
    'Esta campanha não vale para a unidade ou a data escolhida. Agende sem campanha ou escolha outra data.',
  );
}

const CAMPAIGN_FIELDS = [
  'title',
  'description',
  'bloodTypes',
  'unitId',
  'startsAt',
  'endsAt',
  'active',
] as const;

/** CampaignInputDto (criação) ou UpdateCampaignDto (PartialType: tudo opcional). */
function parseCampaignInput(body: unknown, partial: boolean): Partial<CampaignInput> {
  const v = new Validator(body, CAMPAIGN_FIELDS);
  const date = [is.iso8601(), is.matches(DATE_ONLY, DATE_ONLY_MESSAGE)];
  v.field('title', [is.string(), is.minLength(3), is.maxLength(120)], {
    optional: partial,
    type: 'string',
    transform: trim,
  });
  v.field('description', [is.string(), is.minLength(3), is.maxLength(1000)], {
    optional: partial,
    type: 'string',
    transform: trim,
  });
  v.field(
    'bloodTypes',
    [
      is.array(),
      is.arrayMaxSize(BLOOD_TYPES.length),
      is.arrayUnique('Não repita tipos sanguíneos.'),
      is.each(is.in(BLOOD_TYPES)),
    ],
    { optional: partial },
  );
  v.field('unitId', [is.uuid()], { optional: true, nullable: true });
  v.field('startsAt', date, { optional: partial, type: 'string' });
  v.field('endsAt', date, { optional: partial, type: 'string' });
  v.field('active', [is.boolean()], { optional: true, type: 'boolean' });
  v.done();
  return v.output as Partial<CampaignInput>;
}

function assertPeriod(startsAt: string, endsAt: string): void {
  if (startsAt > endsAt) {
    fail(
      400,
      'INVALID_PERIOD',
      'A data final precisa ser igual ou posterior à inicial.',
      undefined,
      [{ field: 'endsAt', message: 'A data final precisa ser igual ou posterior à inicial.' }],
    );
  }
}

function assertUnit(unitId: string | null | undefined): void {
  if (!unitId) return;
  if (!findUnit(unitId)) {
    fail(422, 'UNIT_NOT_FOUND', 'Unidade não encontrada.', undefined, [
      { field: 'unitId', message: 'Unidade não encontrada.' },
    ]);
  }
}

function list(request: DemoRequest): CampaignView[] {
  const includeInactive = includeInactiveQuery(request);
  if (includeInactive && !(request.user && hasPermission(request.user.role, 'campaign:manage'))) {
    fail(403, 'FORBIDDEN', 'Só a administração vê campanhas encerradas ou inativas.');
  }
  const today = todayLocal();
  return state()
    .campaigns.filter(
      (campaign) => includeInactive || (campaign.active && campaign.endsAt >= today),
    )
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt) || byText(a.title, b.title))
    .map(toCampaignView);
}

function create(request: AuthedRequest): CampaignView {
  const dto = parseCampaignInput(request.body, false);
  assertPeriod(dto.startsAt!, dto.endsAt!);
  assertUnit(dto.unitId);
  const now = nowIso();
  const campaign: SchedulingCampaign = {
    id: uuid(),
    title: dto.title!,
    description: dto.description!,
    bloodTypes: [...(dto.bloodTypes as BloodType[])],
    unitId: dto.unitId ?? null,
    startsAt: dto.startsAt!,
    endsAt: dto.endsAt!,
    active: dto.active ?? true,
    createdAt: now,
    updatedAt: now,
  };
  state().campaigns.push(campaign);
  recordAudit(SERVICE, {
    actor: request.user,
    action: 'campaign.created',
    entity: 'campaign',
    entityId: campaign.id,
  });
  return toCampaignView(campaign);
}

function update(request: AuthedRequest): CampaignView {
  const id = parseUuid(request.params.id);
  const dto = parseCampaignInput(request.body, true);
  const campaign = findCampaign(id);
  if (!campaign) fail(404, 'CAMPAIGN_NOT_FOUND', 'Campanha não encontrada.');
  assertPeriod(dto.startsAt ?? campaign.startsAt, dto.endsAt ?? campaign.endsAt);
  if (dto.unitId !== undefined) assertUnit(dto.unitId);

  if (dto.title !== undefined) campaign.title = dto.title;
  if (dto.description !== undefined) campaign.description = dto.description;
  if (dto.bloodTypes !== undefined) campaign.bloodTypes = [...dto.bloodTypes];
  if (dto.unitId !== undefined) campaign.unitId = dto.unitId;
  if (dto.startsAt !== undefined) campaign.startsAt = dto.startsAt;
  if (dto.endsAt !== undefined) campaign.endsAt = dto.endsAt;
  if (dto.active !== undefined) campaign.active = dto.active;
  campaign.updatedAt = nowIso();
  recordAudit(SERVICE, {
    actor: request.user,
    action: 'campaign.updated',
    entity: 'campaign',
    entityId: id,
    metadata: { fields: Object.keys(dto) },
  });
  return toCampaignView(campaign);
}

export function registerCampaignRoutes(): void {
  route('GET', '/campaigns', list, { auth: 'public' });
  route('POST', '/campaigns', create, { permissions: ['campaign:manage'] });
  route('PATCH', '/campaigns/:id', update, { permissions: ['campaign:manage'] });
}
