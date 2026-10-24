/**
 * Módulo inventory da demonstração (espelho do inventory-service): estoque
 * central por tipo sanguíneo (D6), movimentações de entrada e saída (RN10),
 * níveis crítico/atenção/adequado (RN11) e histórico reconstruído.
 */
import {
  BLOOD_TYPE_LABELS,
  BLOOD_TYPES,
  EVENTS,
  MOVEMENT_REASON_CODES,
  MOVEMENT_REASONS,
  MOVEMENT_TYPES,
  stockStatusFor,
  type AuthUser,
  type BloodType,
  type InventoryStats,
  type MovementReason,
  type MovementType,
  type MovementView,
  type PublicStockLevel,
  type StockHistoryResponse,
  type StockItemView,
  type StockLevelChangedData,
  type StockOverview,
  type StatsFilters,
  type StockStatus,
} from '@pulso/contracts';
import { SEED_IDS } from '@backend/libs/common/src/seed/dataset';
import {
  computeTrend,
  emptyBalances,
  endOfLocalDay,
  lastLocalDays,
  minimumBalanceSince,
  reconstructDailyBalances,
  type BalanceByType,
} from '@backend/services/inventory/src/stock/stock-history';
import { recordAudit } from '../../core/audit';
import { publish } from '../../core/events';
import { fail, route, type AuthedRequest } from '../../core/http';
import { internal } from '../../core/internal';
import { db, type SeedContext } from '../../core/state';
import {
  inRange,
  localDayRange,
  nowIso,
  paginate,
  statsRange,
  todayLocal,
  uuid,
} from '../../core/support';
import {
  PAGINATION,
  bodyObject,
  isIn,
  isInt,
  isIso8601,
  isString,
  max,
  maxLength,
  min,
  queryNumber,
  queryObject,
  toNumber,
  trim,
  validate,
} from './validation';

export interface InventoryStock {
  bloodType: BloodType;
  quantity: number;
  minimum: number;
  ideal: number;
  updatedAt: string;
}

export interface InventoryMovement {
  id: string;
  bloodType: BloodType;
  type: MovementType;
  quantity: number;
  reason: MovementReason;
  notes: string | null;
  occurredAt: string;
  responsibleId: string;
  responsibleName: string;
  /** Saldo do tipo logo após a movimentação. */
  balanceAfter: number;
  createdAt: string;
}

export interface InventoryState {
  stock: InventoryStock[];
  movements: InventoryMovement[];
}

const SERVICE = 'inventory';
/** Nome do administrador fictício que registrou o histórico de demonstração. */
const SEED_RESPONSIBLE_NAME = 'Ana Paula Ribeiro';
/** Dias da minissérie (sparkline) de cada tipo; o último é hoje. */
const SPARKLINE_DAYS = 14;
/** Tolerância para relógios levemente adiantados no cliente. */
const FUTURE_TOLERANCE_MS = 60_000;
/** Movimentações retroativas aceitas até este limite. */
const MAX_BACKDATE_DAYS = 30;
const MAX_MOVEMENT_QUANTITY = 10_000;
const MAX_THRESHOLD = 100_000;
const UNKNOWN_RESPONSIBLE = 'Responsável não identificado';

/**
 * Mesmo seed do back-end: estoque fictício e 90 dias de movimentações do
 * dataset e, para qualquer tipo que falte, uma linha zerada com limites
 * provisórios (1 bolsa).
 */
export function seedInventory({ dataset }: SeedContext): InventoryState {
  const seededAt = nowIso();
  const stock: InventoryStock[] = dataset.stock.map((item) => ({
    bloodType: item.bloodType,
    quantity: item.quantity,
    minimum: item.minimum,
    ideal: item.ideal,
    updatedAt: seededAt,
  }));
  for (const bloodType of BLOOD_TYPES) {
    if (!stock.some((row) => row.bloodType === bloodType)) {
      stock.push({ bloodType, quantity: 0, minimum: 1, ideal: 1, updatedAt: seededAt });
    }
  }
  const movements: InventoryMovement[] = dataset.movements.map((movement) => ({
    id: movement.id,
    bloodType: movement.bloodType,
    type: movement.type,
    quantity: movement.quantity,
    reason: movement.reason,
    notes: null,
    occurredAt: movement.occurredAt,
    responsibleId: SEED_IDS.users.admin,
    responsibleName: SEED_RESPONSIBLE_NAME,
    balanceAfter: movement.balanceAfter,
    createdAt: movement.occurredAt,
  }));
  return { stock, movements };
}

const state = () => db().inventory;

/** Linhas do estoque por tipo; os 8 tipos precisam existir (criados pelo seed). */
function loadStock(): Map<BloodType, InventoryStock> {
  const byType = new Map(state().stock.map((row) => [row.bloodType, row]));
  const missing = BLOOD_TYPES.filter((type) => !byType.has(type));
  if (missing.length > 0) {
    fail(
      503,
      'STOCK_NOT_INITIALIZED',
      `O estoque ainda não foi configurado para: ${missing.map((type) => BLOOD_TYPE_LABELS[type]).join(', ')}.`,
      'Serviço indisponível',
    );
  }
  return byType;
}

/** Saldo no fim de cada dia, reconstruído pelas movimentações (mesma função do back-end). */
function dailyBalances(rows: Map<BloodType, InventoryStock>, days: string[]) {
  const current: BalanceByType = emptyBalances();
  for (const [type, row] of rows) current[type] = row.quantity;
  const after = endOfLocalDay(days[0]).getTime();
  const movements = state()
    .movements.filter((movement) => Date.parse(movement.occurredAt) > after)
    .map((movement) => ({
      bloodType: movement.bloodType,
      type: movement.type,
      quantity: movement.quantity,
      occurredAt: new Date(movement.occurredAt),
    }));
  return reconstructDailyBalances(current, movements, days);
}

function toItem(
  row: InventoryStock,
  points: ReturnType<typeof reconstructDailyBalances>,
  type: BloodType,
): StockItemView {
  const sparkline = points.map((point) => point.values[type]);
  // 7 dias atrás = penúltima semana da série (o último ponto é hoje).
  const weekAgo = sparkline[sparkline.length - 8] ?? sparkline[0];
  return {
    bloodType: type,
    quantity: row.quantity,
    minimum: row.minimum,
    ideal: row.ideal,
    status: stockStatusFor(row.quantity, row.minimum, row.ideal),
    trend: computeTrend(row.quantity, weekAgo),
    sparkline,
    updatedAt: row.updatedAt,
  };
}

function overview(): StockOverview {
  const rows = loadStock();
  const days = lastLocalDays(SPARKLINE_DAYS, todayLocal());
  const points = dailyBalances(rows, days);
  const items = BLOOD_TYPES.map((type) => toItem(rows.get(type)!, points, type));
  return {
    items,
    totals: {
      quantity: items.reduce((sum, item) => sum + item.quantity, 0),
      critical: items.filter((item) => item.status === 'CRITICAL').length,
      attention: items.filter((item) => item.status === 'ATTENTION').length,
      normal: items.filter((item) => item.status === 'NORMAL').length,
    },
    updatedAt: new Date(Math.max(...items.map((item) => Date.parse(item.updatedAt)))).toISOString(),
  };
}

function publicLevels(): PublicStockLevel[] {
  const rows = loadStock();
  return BLOOD_TYPES.map((type) => {
    const row = rows.get(type)!;
    return { bloodType: type, status: stockStatusFor(row.quantity, row.minimum, row.ideal) };
  });
}

function history(request: AuthedRequest): StockHistoryResponse {
  const query = validate<{ days?: number }>(queryObject(request.query), {
    days: { optional: true, transform: queryNumber, rules: [isInt, min(7), max(90)] },
  });
  const daysCount = query.days ?? 30;
  const rows = loadStock();
  const days = lastLocalDays(daysCount, todayLocal());
  return { days: daysCount, points: dailyBalances(rows, days) };
}

function toMovementView(row: InventoryMovement): MovementView {
  return {
    id: row.id,
    bloodType: row.bloodType,
    type: row.type,
    quantity: row.quantity,
    reason: row.reason,
    notes: row.notes,
    occurredAt: row.occurredAt,
    responsibleName: row.responsibleName,
    balanceAfter: row.balanceAfter,
    createdAt: row.createdAt,
  };
}

function enqueueLevelChange(data: StockLevelChangedData): void {
  publish<StockLevelChangedData>(EVENTS.STOCK_LEVEL_CHANGED, data);
}

interface CreateMovementBody {
  bloodType: BloodType;
  type: MovementType;
  quantity: number;
  reason: MovementReason;
  notes?: string;
  occurredAt?: string;
}

/**
 * Registra uma entrada ou saída (RN10: o estoque só muda por movimentações).
 * Movimentação retroativa: o saldo não pode ter ficado negativo em nenhum
 * momento desde a data informada, e as posteriores passam a refletir esta.
 */
function createMovement(request: AuthedRequest): MovementView {
  const actor: AuthUser = request.user;
  const dto = validate<CreateMovementBody>(bodyObject(request.body), {
    bloodType: { rules: [isIn(BLOOD_TYPES)] },
    type: { rules: [isIn(MOVEMENT_TYPES)] },
    quantity: {
      transform: toNumber,
      rules: [isInt, min(1), max(MAX_MOVEMENT_QUANTITY)],
    },
    reason: { rules: [isIn(MOVEMENT_REASON_CODES)] },
    notes: { optional: true, transform: trim, rules: [isString, maxLength(300)] },
    occurredAt: { optional: true, rules: [isIso8601()] },
  });

  if (MOVEMENT_REASONS[dto.reason].type !== dto.type) {
    fail(
      400,
      'REASON_TYPE_MISMATCH',
      'O motivo escolhido não corresponde ao tipo da movimentação.',
      undefined,
      [
        {
          field: 'reason',
          message:
            dto.type === 'IN' ? 'Escolha um motivo de entrada.' : 'Escolha um motivo de saída.',
        },
      ],
    );
  }
  const now = Date.now();
  const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date(now);
  if (occurredAt.getTime() > now + FUTURE_TOLERANCE_MS) {
    fail(400, 'INVALID_OCCURRED_AT', 'A data da movimentação não pode ser futura.', undefined, [
      { field: 'occurredAt', message: 'A data não pode ser futura.' },
    ]);
  }
  if (occurredAt.getTime() < now - MAX_BACKDATE_DAYS * 86_400_000) {
    fail(
      400,
      'INVALID_OCCURRED_AT',
      `Registre movimentações de até ${MAX_BACKDATE_DAYS} dias atrás.`,
      undefined,
      [{ field: 'occurredAt', message: `Informe uma data dos últimos ${MAX_BACKDATE_DAYS} dias.` }],
    );
  }

  const label = BLOOD_TYPE_LABELS[dto.bloodType];
  const stock = state().stock.find((row) => row.bloodType === dto.bloodType);
  if (!stock) {
    fail(404, 'STOCK_NOT_FOUND', `O tipo ${label} não está cadastrado no estoque.`);
  }

  // Movimentações com data posterior à informada (registro retroativo), da mais recente à mais antiga.
  const occurredMs = occurredAt.getTime();
  const later = state()
    .movements.filter(
      (item) => item.bloodType === dto.bloodType && Date.parse(item.occurredAt) > occurredMs,
    )
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  if (dto.type === 'OUT') {
    if (dto.quantity > stock.quantity) {
      fail(
        422,
        'INSUFFICIENT_STOCK',
        `Saída maior que o estoque atual de ${label} (${stock.quantity} bolsas).`,
        'Operação não permitida',
      );
    }
    // Saída retroativa: o saldo não pode ter ficado negativo em nenhum momento desde então.
    const minimum = minimumBalanceSince(stock.quantity, later);
    if (dto.quantity > minimum) {
      fail(
        422,
        'INSUFFICIENT_STOCK',
        `Na data informada, o saldo de ${label} era menor que a saída (mínimo de ${minimum} bolsas no período).`,
        'Operação não permitida',
      );
    }
  }

  const previousQuantity = stock.quantity;
  const delta = dto.type === 'IN' ? dto.quantity : -dto.quantity;
  const quantity = previousQuantity + delta;
  // Saldo na data informada: o atual sem o efeito das movimentações posteriores.
  const laterNet = later.reduce(
    (sum, item) => sum + (item.type === 'IN' ? item.quantity : -item.quantity),
    0,
  );
  const timestamp = nowIso();
  stock.quantity = quantity;
  stock.updatedAt = timestamp;
  // As posteriores passam a refletir esta movimentação no saldo de cada uma.
  for (const item of later) item.balanceAfter += delta;
  const created: InventoryMovement = {
    id: uuid(),
    bloodType: dto.bloodType,
    type: dto.type,
    quantity: dto.quantity,
    reason: dto.reason,
    notes: dto.notes ? dto.notes : null,
    occurredAt: occurredAt.toISOString(),
    responsibleId: actor.id,
    responsibleName: actor.name || UNKNOWN_RESPONSIBLE,
    balanceAfter: previousQuantity - laterNet + delta,
    createdAt: timestamp,
  };
  state().movements.push(created);

  const previousStatus = stockStatusFor(previousQuantity, stock.minimum, stock.ideal);
  const status = stockStatusFor(quantity, stock.minimum, stock.ideal);
  if (status !== previousStatus) {
    enqueueLevelChange({ bloodType: dto.bloodType, previousStatus, status, quantity });
  }
  recordAudit(SERVICE, {
    actor,
    action: 'stock.movement_created',
    entity: 'blood_stock_movement',
    entityId: created.id,
    metadata: {
      bloodType: dto.bloodType,
      type: dto.type,
      quantity: dto.quantity,
      reason: dto.reason,
    },
  });
  return toMovementView(created);
}

interface MovementsQueryParams {
  bloodType?: BloodType;
  type?: MovementType;
  from?: string;
  to?: string;
}

function listMovements(request: AuthedRequest) {
  const query = validate<MovementsQueryParams>(queryObject(request.query), {
    bloodType: { optional: true, rules: [isIn(BLOOD_TYPES)] },
    type: { optional: true, rules: [isIn(MOVEMENT_TYPES)] },
    from: { optional: true, rules: [isIso8601(true)] },
    to: { optional: true, rules: [isIso8601(true)] },
    // Campos herdados (PaginationQueryDto) são validados depois dos próprios.
    ...PAGINATION,
  });
  let gte: Date | undefined;
  let lte: Date | undefined;
  try {
    if (query.from) gte = localDayRange(query.from, query.from).start;
    if (query.to) lte = localDayRange(query.to, query.to).end;
  } catch {
    fail(400, 'INVALID_PERIOD', 'Informe datas válidas no formato AAAA-MM-DD.');
  }
  if (gte && lte && gte > lte) {
    fail(400, 'INVALID_PERIOD', 'A data inicial deve ser anterior à final.');
  }
  // Empates (mesma data e criação) saem na ordem inversa da gravação, como a leitura
  // de trás para frente do índice por data no Postgres.
  const rows = [...state().movements]
    .reverse()
    .filter((row) => {
      if (query.bloodType && row.bloodType !== query.bloodType) return false;
      if (query.type && row.type !== query.type) return false;
      const time = Date.parse(row.occurredAt);
      if (gte && time < gte.getTime()) return false;
      if (lte && time > lte.getTime()) return false;
      return true;
    })
    .sort(
      (a, b) =>
        Date.parse(b.occurredAt) - Date.parse(a.occurredAt) ||
        Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );
  return paginate(rows.map(toMovementView), request.query);
}

function updateThresholds(request: AuthedRequest): StockItemView {
  const actor = request.user;
  const { bloodType } = validate<{ bloodType: BloodType }>(request.params, {
    bloodType: { rules: [isIn(BLOOD_TYPES)] },
  });
  const dto = validate<{ minimum: number; ideal: number }>(bodyObject(request.body), {
    minimum: { transform: toNumber, rules: [isInt, min(0), max(MAX_THRESHOLD)] },
    ideal: { transform: toNumber, rules: [isInt, min(0), max(MAX_THRESHOLD)] },
  });
  if (dto.ideal < dto.minimum) {
    fail(
      400,
      'INVALID_THRESHOLDS',
      'O nível ideal precisa ser maior ou igual ao mínimo.',
      undefined,
      [{ field: 'ideal', message: 'Informe um valor maior ou igual ao mínimo.' }],
    );
  }
  const locked = state().stock.find((row) => row.bloodType === bloodType);
  if (!locked) fail(404, 'STOCK_NOT_FOUND', 'Tipo sanguíneo não encontrado no estoque.');
  const previous = { minimum: locked.minimum, ideal: locked.ideal };
  const previousStatus = stockStatusFor(locked.quantity, locked.minimum, locked.ideal);
  const status = stockStatusFor(locked.quantity, dto.minimum, dto.ideal);
  locked.minimum = dto.minimum;
  locked.ideal = dto.ideal;
  locked.updatedAt = nowIso();
  if (status !== previousStatus) {
    enqueueLevelChange({ bloodType, previousStatus, status, quantity: locked.quantity });
  }
  recordAudit(SERVICE, {
    actor,
    action: 'stock.thresholds_updated',
    entity: 'blood_stock',
    entityId: bloodType,
    metadata: { bloodType, minimum: dto.minimum, ideal: dto.ideal, previous },
  });
  return overview().items.find((item) => item.bloodType === bloodType)!;
}

/**
 * Indicadores para o dashboard (GET /internal/stats). Com `bloodType`, níveis e
 * movimentações ficam restritos a esse tipo; `unitId` é ignorado (estoque central, D6).
 */
function stats(filters: StatsFilters): InventoryStats {
  const range = statsRange(filters);
  const matchesType = (type: BloodType) => !filters.bloodType || type === filters.bloodType;
  const levels = BLOOD_TYPES.flatMap((type) => {
    const row = state().stock.find((item) => item.bloodType === type);
    return row && matchesType(type)
      ? [
          {
            bloodType: type,
            quantity: row.quantity,
            status: stockStatusFor(row.quantity, row.minimum, row.ideal),
          },
        ]
      : [];
  });
  const byStatus: Record<StockStatus, number> = { NORMAL: 0, ATTENTION: 0, CRITICAL: 0 };
  for (const level of levels) byStatus[level.status] += 1;
  const sumOf = (type: MovementType) =>
    state()
      .movements.filter(
        (row) => row.type === type && matchesType(row.bloodType) && inRange(row.occurredAt, range),
      )
      .reduce((sum, row) => sum + row.quantity, 0);
  return {
    totalBags: levels.reduce((sum, level) => sum + level.quantity, 0),
    byStatus,
    levels,
    movementsIn: sumOf('IN'),
    movementsOut: sumOf('OUT'),
  };
}

export function registerInventory(): void {
  route('GET', '/blood-inventory', () => overview(), { permissions: ['inventory:read'] });
  route('GET', '/blood-inventory/public', () => publicLevels(), { auth: 'public' });
  route('GET', '/blood-inventory/history', history, { permissions: ['inventory:read'] });
  route('GET', '/blood-inventory/movements', listMovements, { permissions: ['inventory:read'] });
  route('POST', '/blood-inventory/movements', createMovement, {
    permissions: ['inventory:move'],
  });
  route('PATCH', '/blood-inventory/:bloodType/thresholds', updateThresholds, {
    permissions: ['inventory:move'],
  });

  internal.inventory.stats = stats;
}
