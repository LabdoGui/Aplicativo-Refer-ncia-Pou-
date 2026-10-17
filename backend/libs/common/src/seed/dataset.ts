/**
 * Conjunto de dados FICTÍCIOS de demonstração, determinístico e compartilhado
 * pelos serviços: cada um grava a sua parte (mesmos IDs em todos os schemas),
 * então agenda, doações, pontos e notificações ficam coerentes entre si.
 *
 * Nenhum dado é real: nomes, endereços, telefones e números são inventados.
 * As datas são relativas ao dia do seed (fuso America/Sao_Paulo), para o
 * painel sempre ter histórico recente e a agenda de hoje ter atendimentos.
 */
import { createHash } from 'node:crypto';
import { DateTime } from 'luxon';
import {
  BLOOD_TYPES,
  DEFAULT_TIMEZONE,
  type AppointmentStatus,
  type BloodType,
  type CancelledBy,
  type DonationStatus,
  type MovementReason,
  type MovementType,
  type Role,
  type ScreeningResult,
} from '@pulso/contracts';
import { todayLocal } from '../util/dates';

/** Senha de todas as contas de demonstração (documentada no README). */
export const SEED_PASSWORD = 'Pulso@2026';

/** UUID determinístico a partir de uma chave (formato v4, para validadores de UUID). */
export function seedUuid(key: string): string {
  const hex = createHash('sha256').update(`pulso-seed:${key}`).digest('hex');
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export const SEED_IDS = {
  units: {
    centro: seedUuid('unit:centro'),
    norte: seedUuid('unit:norte'),
    campus: seedUuid('unit:campus'),
  },
  users: {
    admin: seedUuid('user:admin'),
    nurse: seedUuid('user:nurse'),
    nurseNorte: seedUuid('user:nurse-norte'),
    collaborator: seedUuid('user:collaborator'),
    donor: seedUuid('user:donor'),
  },
  campaigns: {
    junho: seedUuid('campaign:junho-vermelho'),
    estoque: seedUuid('campaign:estoque-negativos'),
    campus: seedUuid('campaign:semana-universitaria'),
  },
  institutions: {
    faculdade: seedUuid('institution:faculdade-exemplo'),
    centroUniversitario: seedUuid('institution:centro-universitario-modelo'),
  },
} as const;

export interface SeedUnit {
  id: string;
  name: string;
  address: string;
  district: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  openingHours: string;
}

export interface SeedScheduleRule {
  id: string;
  unitId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  capacity: number;
}

export interface SeedUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  unitIds: string[];
  registryNumber: string | null;
  createdAt: string;
  donor: {
    donorCode: string;
    birthDate: string;
    phone: string | null;
    bloodType: BloodType;
    city: string;
  } | null;
}

export interface SeedCampaign {
  id: string;
  title: string;
  description: string;
  bloodTypes: BloodType[];
  unitId: string | null;
  startsAt: string;
  endsAt: string;
}

export interface SeedAppointment {
  id: string;
  code: string;
  donorId: string;
  unitId: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  campaignId: string | null;
  createdAt: string;
  cancelledAt: string | null;
  cancelledBy: CancelledBy | null;
  checkedInAt: string | null;
  completedAt: string | null;
}

/** Atendimento finalizado (triagem profissional + doação, se houve). */
export interface SeedAttendance {
  id: string;
  appointmentId: string;
  donorId: string;
  unitId: string;
  campaignId: string | null;
  professionalId: string;
  attendedAt: string;
  screeningResult: ScreeningResult;
  donation: {
    id: string;
    code: string;
    status: DonationStatus;
    bloodType: BloodType;
    volumeMl: number;
    occurredAt: string;
  } | null;
}

export interface SeedStock {
  bloodType: BloodType;
  quantity: number;
  minimum: number;
  ideal: number;
}

export interface SeedMovement {
  id: string;
  bloodType: BloodType;
  type: MovementType;
  quantity: number;
  reason: MovementReason;
  occurredAt: string;
  balanceAfter: number;
}

export interface SeedInstitution {
  id: string;
  name: string;
  hoursPerDonation: number;
}

export interface SeedDataset {
  today: string;
  units: SeedUnit[];
  scheduleRules: SeedScheduleRule[];
  users: SeedUser[];
  campaigns: SeedCampaign[];
  appointments: SeedAppointment[];
  attendances: SeedAttendance[];
  stock: SeedStock[];
  movements: SeedMovement[];
  institutions: SeedInstitution[];
  /** Doador → instituição de ensino vinculada (horas complementares). */
  donorInstitutions: Record<string, string>;
  /** Participantes do ranking (opt-in, com apelido). */
  rankingOptIns: Array<{ donorId: string; nickname: string }>;
}

/** Gerador pseudoaleatório com semente fixa (mulberry32): mesmo resultado em todo serviço. */
function createRandom(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)],
    chance: (probability: number) => next() < probability,
    code: (prefix: string, length = 6) => {
      const alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
      let value = '';
      for (let i = 0; i < length; i++) value += alphabet[Math.floor(next() * alphabet.length)];
      return `${prefix}-${value}`;
    },
  };
}

const FIRST_NAMES = [
  'Ana',
  'Bruno',
  'Camila',
  'Diego',
  'Eduarda',
  'Felipe',
  'Gabriela',
  'Henrique',
  'Isabela',
  'João',
  'Larissa',
  'Lucas',
  'Marina',
  'Mateus',
  'Natália',
  'Otávio',
  'Patrícia',
  'Rafael',
  'Renata',
  'Samuel',
  'Tatiane',
  'Thiago',
  'Vanessa',
  'Vinícius',
  'Yasmin',
  'Leonardo',
  'Beatriz',
  'Gustavo',
  'Letícia',
  'Pedro',
];
const LAST_NAMES = [
  'Almeida',
  'Barbosa',
  'Cardoso',
  'Dias',
  'Ferreira',
  'Gomes',
  'Lopes',
  'Martins',
  'Moreira',
  'Nascimento',
  'Oliveira',
  'Pereira',
  'Ramos',
  'Rocha',
  'Santos',
  'Silva',
  'Teixeira',
  'Vieira',
];
const NICKNAMES = [
  'Gota Solidária',
  'Coração Vermelho',
  'Veia Heroica',
  'Plasma Amigo',
  'Doador da Quebrada',
  'Sangue Bom',
  'Hemácia Feliz',
  'Vida que Pulsa',
  'Gotinha',
  'Heroína Anônima',
  'Bolsa Cheia',
  'Doa Que Eu Doo',
  'Fluxo do Bem',
  'Ritmo Vital',
];
/** Distribuição só para variar os dados de demonstração (não é estatística real). */
const BLOOD_TYPE_WEIGHTS: Array<[BloodType, number]> = [
  ['O_POS', 36],
  ['A_POS', 30],
  ['B_POS', 8],
  ['AB_POS', 3],
  ['O_NEG', 9],
  ['A_NEG', 6],
  ['B_NEG', 5],
  ['AB_NEG', 3],
];

const ZONE = DEFAULT_TIMEZONE;

function weightedBloodType(random: ReturnType<typeof createRandom>): BloodType {
  const total = BLOOD_TYPE_WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random.next() * total;
  for (const [type, weight] of BLOOD_TYPE_WEIGHTS) {
    roll -= weight;
    if (roll < 0) return type;
  }
  return 'O_POS';
}

function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, '.');
}

export const SEED_UNITS: SeedUnit[] = [
  {
    id: SEED_IDS.units.centro,
    name: 'Pulso Unidade Centro',
    address: 'Rua da Solidariedade, 120',
    district: 'Centro',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '01000-000',
    phone: '0800 000 0101',
    openingHours: 'Seg. a sex., 8h às 17h · Sáb., 8h às 12h',
  },
  {
    id: SEED_IDS.units.norte,
    name: 'Pulso Unidade Zona Norte',
    address: 'Avenida das Doações, 455',
    district: 'Santana',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '02000-000',
    phone: '0800 000 0202',
    openingHours: 'Seg. a sex., 7h30 às 13h30',
  },
  {
    id: SEED_IDS.units.campus,
    name: 'Pulso Posto Campus Universitário',
    address: 'Alameda do Conhecimento, 1000 — Bloco B',
    district: 'Cidade Universitária',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '05500-000',
    phone: '0800 000 0303',
    openingHours: 'Ter. e qui., 9h às 16h',
  },
];

function buildScheduleRules(): SeedScheduleRule[] {
  const rules: SeedScheduleRule[] = [];
  const add = (
    unitId: string,
    weekday: number,
    startTime: string,
    endTime: string,
    capacity: number,
  ) =>
    rules.push({
      id: seedUuid(`rule:${unitId}:${weekday}:${startTime}`),
      unitId,
      weekday,
      startTime,
      endTime,
      slotMinutes: 30,
      capacity,
    });
  for (let weekday = 1; weekday <= 5; weekday++) {
    add(SEED_IDS.units.centro, weekday, '08:00', '12:00', 3);
    add(SEED_IDS.units.centro, weekday, '13:00', '17:00', 3);
    add(SEED_IDS.units.norte, weekday, '07:30', '13:30', 2);
  }
  add(SEED_IDS.units.centro, 6, '08:00', '12:00', 2);
  add(SEED_IDS.units.campus, 2, '09:00', '16:00', 2);
  add(SEED_IDS.units.campus, 4, '09:00', '16:00', 2);
  return rules;
}

/** Horários de início (HH:mm) de uma unidade num dia da semana. */
function slotTimes(rules: SeedScheduleRule[], unitId: string, weekday: number): string[] {
  const times: string[] = [];
  for (const rule of rules.filter((r) => r.unitId === unitId && r.weekday === weekday)) {
    let cursor = DateTime.fromFormat(rule.startTime, 'HH:mm');
    const end = DateTime.fromFormat(rule.endTime, 'HH:mm');
    while (cursor.plus({ minutes: rule.slotMinutes }) <= end) {
      times.push(cursor.toFormat('HH:mm'));
      cursor = cursor.plus({ minutes: rule.slotMinutes });
    }
  }
  return times;
}

function localDateTime(date: string, time: string): DateTime {
  return DateTime.fromISO(`${date}T${time}`, { zone: ZONE });
}

export function buildSeedDataset(today: string = todayLocal()): SeedDataset {
  const random = createRandom(20261019);
  const todayDate = DateTime.fromISO(today, { zone: ZONE });
  const iso = (value: DateTime) => value.toUTC().toISO()!;
  const rules = buildScheduleRules();

  // --- Campanhas -----------------------------------------------------------
  const year = todayDate.month > 6 ? todayDate.year : todayDate.year - 1;
  const campaigns: SeedCampaign[] = [
    {
      id: SEED_IDS.campaigns.junho,
      title: 'Junho Vermelho',
      description:
        'Mês de incentivo à doação regular de sangue. Campanha fictícia de demonstração.',
      bloodTypes: [],
      unitId: null,
      startsAt: `${year}-06-01`,
      endsAt: `${year}-06-30`,
    },
    {
      id: SEED_IDS.campaigns.estoque,
      title: 'Reforço para O− e A−',
      description:
        'O estoque fictício destes tipos está abaixo do ideal. Agende pela campanha e ajude a recompor.',
      bloodTypes: ['O_NEG', 'A_NEG'],
      unitId: null,
      startsAt: todayDate.minus({ days: 10 }).toISODate()!,
      endsAt: todayDate.plus({ days: 20 }).toISODate()!,
    },
    {
      id: SEED_IDS.campaigns.campus,
      title: 'Semana do Doador Universitário',
      description: 'Ação no posto do campus para estudantes, professores e funcionários.',
      bloodTypes: [],
      unitId: SEED_IDS.units.campus,
      startsAt: todayDate.minus({ days: 3 }).toISODate()!,
      endsAt: todayDate.plus({ days: 4 }).toISODate()!,
    },
  ];

  const institutions: SeedInstitution[] = [
    {
      id: SEED_IDS.institutions.faculdade,
      name: 'Faculdade Exemplo de Ciências da Saúde',
      hoursPerDonation: 4,
    },
    {
      id: SEED_IDS.institutions.centroUniversitario,
      name: 'Centro Universitário Modelo',
      hoursPerDonation: 2,
    },
  ];

  // --- Pessoas -------------------------------------------------------------
  const staffCreatedAt = iso(todayDate.minus({ days: 420 }).set({ hour: 9 }));
  const users: SeedUser[] = [
    {
      id: SEED_IDS.users.admin,
      name: 'Ana Paula Ribeiro',
      email: 'admin@demo.com',
      role: 'ADMIN',
      unitIds: [],
      registryNumber: null,
      createdAt: staffCreatedAt,
      donor: null,
    },
    {
      id: SEED_IDS.users.nurse,
      name: 'Carlos Henrique Lima',
      email: 'enfermeiro@demo.com',
      role: 'NURSE',
      unitIds: [SEED_IDS.units.centro, SEED_IDS.units.campus],
      registryNumber: 'COREN-SP 000.001 (fictício)',
      createdAt: staffCreatedAt,
      donor: null,
    },
    {
      id: SEED_IDS.users.nurseNorte,
      name: 'Fernanda Duarte',
      email: 'enfermeira.norte@exemplo.test',
      role: 'NURSE',
      unitIds: [SEED_IDS.units.norte],
      registryNumber: 'COREN-SP 000.002 (fictício)',
      createdAt: staffCreatedAt,
      donor: null,
    },
    {
      id: SEED_IDS.users.collaborator,
      name: 'Juliana Costa',
      email: 'colaborador@demo.com',
      role: 'COLLABORATOR',
      unitIds: [SEED_IDS.units.centro],
      registryNumber: null,
      createdAt: staffCreatedAt,
      donor: null,
    },
    {
      id: SEED_IDS.users.donor,
      name: 'Mariana Alves Souza',
      email: 'doador@demo.com',
      role: 'DONOR',
      unitIds: [],
      registryNumber: null,
      createdAt: iso(todayDate.minus({ days: 200 }).set({ hour: 19, minute: 12 })),
      donor: {
        donorCode: 'PUL-M4R1AN',
        birthDate: '1998-04-12',
        phone: '(11) 90000-0001',
        bloodType: 'O_POS',
        city: 'São Paulo',
      },
    },
  ];

  const usedEmails = new Set(users.map((user) => user.email));
  for (let index = 1; index <= 70; index++) {
    const first = random.pick(FIRST_NAMES);
    const last = `${random.pick(LAST_NAMES)} ${random.pick(LAST_NAMES)}`;
    let email = `${slug(first)}.${slug(last.split(' ')[1])}@exemplo.test`;
    if (usedEmails.has(email)) email = email.replace('@', `${index}@`);
    usedEmails.add(email);
    const birthYear = todayDate.year - random.int(19, 58);
    users.push({
      id: seedUuid(`donor:${index}`),
      name: `${first} ${last}`,
      email,
      role: 'DONOR',
      unitIds: [],
      registryNumber: null,
      createdAt: iso(
        todayDate.minus({ days: random.int(30, 400) }).set({ hour: random.int(8, 21) }),
      ),
      donor: {
        donorCode: random.code('PUL'),
        birthDate: `${birthYear}-${String(random.int(1, 12)).padStart(2, '0')}-${String(random.int(1, 28)).padStart(2, '0')}`,
        phone: random.chance(0.7) ? `(11) 90000-${String(1000 + index).padStart(4, '0')}` : null,
        bloodType: weightedBloodType(random),
        city: 'São Paulo',
      },
    });
  }
  const donors = users.filter((user) => user.role === 'DONOR');

  // --- Histórico: agendamentos e atendimentos ------------------------------
  const appointments: SeedAppointment[] = [];
  const attendances: SeedAttendance[] = [];
  const professionalFor = (unitId: string) =>
    unitId === SEED_IDS.units.norte ? SEED_IDS.users.nurseNorte : SEED_IDS.users.nurse;
  const campaignFor = (unitId: string, date: string): string | null => {
    const active = campaigns.filter(
      (c) => (c.unitId === null || c.unitId === unitId) && c.startsAt <= date && date <= c.endsAt,
    );
    return active.length > 0 && random.chance(0.45) ? random.pick(active).id : null;
  };

  /** Próximo dia (a partir de `from`) em que a unidade atende. */
  const nextServiceDay = (unitId: string, from: DateTime): DateTime => {
    let day: DateTime = from;
    for (let i = 0; i < 7; i++) {
      if (slotTimes(rules, unitId, day.weekday).length > 0) return day;
      day = day.plus({ days: 1 });
    }
    return day;
  };

  const pushAppointment = (
    key: string,
    donorId: string,
    unitId: string,
    startsAt: DateTime,
    status: AppointmentStatus,
    campaignId: string | null,
  ): SeedAppointment => {
    const appointment: SeedAppointment = {
      id: seedUuid(`appointment:${key}`),
      code: random.code('AG'),
      donorId,
      unitId,
      startsAt: iso(startsAt),
      endsAt: iso(startsAt.plus({ minutes: 30 })),
      status,
      campaignId,
      createdAt: iso(startsAt.minus({ days: random.int(2, 12) }).set({ hour: random.int(8, 22) })),
      cancelledAt: null,
      cancelledBy: null,
      checkedInAt: null,
      completedAt: null,
    };
    appointments.push(appointment);
    return appointment;
  };

  const lastAttendanceByDonor = new Map<string, DateTime>();
  for (const donor of donors) {
    const isDemo = donor.id === SEED_IDS.users.donor;
    const preferredUnit = isDemo ? SEED_IDS.units.centro : random.pick(SEED_UNITS).id;
    const registeredAt = DateTime.fromISO(donor.createdAt).setZone(ZONE);
    const roll = random.next();
    const count = isDemo
      ? 1
      : roll < 0.2
        ? 0
        : roll < 0.55
          ? 1
          : roll < 0.8
            ? 2
            : roll < 0.92
              ? 3
              : 4;
    let cursor: DateTime = isDemo
      ? todayDate.minus({ days: 120 })
      : registeredAt.plus({ days: random.int(1, 20) });

    for (let n = 0; n < count; n++) {
      const unitId = random.chance(0.8) ? preferredUnit : random.pick(SEED_UNITS).id;
      const day = nextServiceDay(unitId, cursor.startOf('day'));
      if (day >= todayDate.minus({ days: 1 })) break;
      const date = day.toISODate()!;
      const startsAt = localDateTime(date, random.pick(slotTimes(rules, unitId, day.weekday)));
      const campaignId = isDemo ? null : campaignFor(unitId, date);
      const key = `${donor.id}:${n}`;
      const appointment = pushAppointment(key, donor.id, unitId, startsAt, 'COMPLETED', campaignId);
      const attendedAt = startsAt.plus({ minutes: 10 });
      appointment.checkedInAt = iso(startsAt.minus({ minutes: 5 }));

      const resultRoll = isDemo ? 0 : random.next();
      const screeningResult: ScreeningResult =
        resultRoll < 0.88 ? 'FIT' : resultRoll < 0.95 ? 'NEEDS_EVALUATION' : 'UNFIT';
      const donationStatus: DonationStatus | null =
        screeningResult === 'FIT'
          ? isDemo || random.chance(0.95)
            ? 'COMPLETED'
            : 'NOT_COMPLETED'
          : null;
      const donationAt = attendedAt.plus({ minutes: 35 });
      attendances.push({
        id: seedUuid(`attendance:${key}`),
        appointmentId: appointment.id,
        donorId: donor.id,
        unitId,
        campaignId,
        professionalId: professionalFor(unitId),
        attendedAt: iso(attendedAt),
        screeningResult,
        donation: donationStatus
          ? {
              id: seedUuid(`donation:${key}`),
              code: random.code('DO'),
              status: donationStatus,
              bloodType: donor.donor!.bloodType,
              volumeMl: donationStatus === 'COMPLETED' ? 450 : random.int(80, 300),
              occurredAt: iso(donationAt),
            }
          : null,
      });
      appointment.completedAt = iso(donationStatus ? donationAt : attendedAt.plus({ minutes: 15 }));
      lastAttendanceByDonor.set(donor.id, day);
      cursor = day.plus({ days: random.int(95, 150) });
    }
  }

  // Cancelamentos e faltas no passado (não geram atendimento).
  const pastPool = donors.filter((donor) => donor.id !== SEED_IDS.users.donor);
  for (let index = 0; index < 24; index++) {
    const donor = random.pick(pastPool);
    const unitId = random.pick(SEED_UNITS).id;
    const day = nextServiceDay(unitId, todayDate.minus({ days: random.int(3, 300) }));
    if (day >= todayDate) continue;
    const startsAt = localDateTime(
      day.toISODate()!,
      random.pick(slotTimes(rules, unitId, day.weekday)),
    );
    const noShow = index % 3 === 0;
    const appointment = pushAppointment(
      `past-${index}`,
      donor.id,
      unitId,
      startsAt,
      noShow ? 'NO_SHOW' : 'CANCELLED',
      null,
    );
    if (!noShow) {
      appointment.cancelledAt = iso(startsAt.minus({ hours: random.int(3, 72) }));
      appointment.cancelledBy = random.chance(0.85) ? 'DONOR' : 'STAFF';
    }
  }

  // Agenda de hoje na Unidade Centro e próximos dias (1 agendamento ativo por doador).
  const eligible = pastPool.filter((donor) => {
    const last = lastAttendanceByDonor.get(donor.id);
    return !last || todayDate.diff(last, 'days').days > 100;
  });
  const todayTimes = ['08:30', '09:00', '09:30', '10:30', '11:00', '14:00', '15:00', '16:00'];
  todayTimes.forEach((time, index) => {
    const donor = eligible[index];
    if (!donor) return;
    pushAppointment(
      `today-${index}`,
      donor.id,
      SEED_IDS.units.centro,
      localDateTime(today, time),
      index % 4 === 1 ? 'CONFIRMED' : 'BOOKED',
      index === 2 ? SEED_IDS.campaigns.estoque : null,
    );
  });
  eligible.slice(todayTimes.length, todayTimes.length + 14).forEach((donor, index) => {
    const unitId = random.pick(SEED_UNITS).id;
    const day = nextServiceDay(unitId, todayDate.plus({ days: random.int(1, 14) }));
    const startsAt = localDateTime(
      day.toISODate()!,
      random.pick(slotTimes(rules, unitId, day.weekday)),
    );
    pushAppointment(`upcoming-${index}`, donor.id, unitId, startsAt, 'BOOKED', null);
  });

  // --- Estoque (central, D6) e movimentações dos últimos 90 dias -----------
  const stockTargets: SeedStock[] = [
    { bloodType: 'A_POS', quantity: 182, minimum: 80, ideal: 150 },
    { bloodType: 'A_NEG', quantity: 34, minimum: 20, ideal: 50 },
    { bloodType: 'B_POS', quantity: 58, minimum: 40, ideal: 80 },
    { bloodType: 'B_NEG', quantity: 19, minimum: 12, ideal: 30 },
    { bloodType: 'AB_POS', quantity: 35, minimum: 15, ideal: 30 },
    { bloodType: 'AB_NEG', quantity: 6, minimum: 8, ideal: 15 },
    { bloodType: 'O_POS', quantity: 240, minimum: 120, ideal: 220 },
    { bloodType: 'O_NEG', quantity: 31, minimum: 40, ideal: 80 },
  ];
  const movements: SeedMovement[] = [];
  const stock: SeedStock[] = [];
  const falling = new Set<BloodType>(['O_NEG', 'AB_NEG', 'A_NEG']);
  for (const target of stockTargets) {
    const daily: Array<{ day: DateTime; inQty: number; outQty: number }> = [];
    const base = Math.max(2, Math.round(target.ideal * 0.05));
    for (let offset = 89; offset >= 0; offset--) {
      const day = todayDate.minus({ days: offset });
      const recent = offset < 14;
      const inQty = random.chance(0.75) ? random.int(1, base) : 0;
      let outQty = random.chance(0.7) ? random.int(1, base) : 0;
      if (recent && falling.has(target.bloodType)) outQty += random.int(0, Math.ceil(base / 2));
      daily.push({ day, inQty, outQty });
    }
    const net = daily.reduce((sum, d) => sum + d.inQty - d.outQty, 0);
    let balance = Math.max(target.minimum, target.quantity - net);
    daily.forEach(({ day, inQty, outQty }, index) => {
      const add = (type: MovementType, quantity: number, reason: MovementReason, hour: number) => {
        if (quantity <= 0) return;
        balance += type === 'IN' ? quantity : -quantity;
        movements.push({
          id: seedUuid(`movement:${target.bloodType}:${index}:${type}`),
          bloodType: target.bloodType,
          type,
          quantity,
          reason,
          occurredAt: iso(day.set({ hour, minute: random.int(0, 59) })),
          balanceAfter: balance,
        });
      };
      add('IN', inQty, random.chance(0.85) ? 'PROCESSED_COLLECTION' : 'TRANSFER_IN', 9);
      const safeOut = Math.min(outQty, balance);
      add('OUT', safeOut, random.chance(0.9) ? 'HOSPITAL_DISTRIBUTION' : 'EXPIRED_DISCARD', 15);
    });
    stock.push({ ...target, quantity: balance });
  }

  // --- Engajamento ----------------------------------------------------------
  const donorInstitutions: Record<string, string> = {
    [SEED_IDS.users.donor]: SEED_IDS.institutions.faculdade,
  };
  const rankingOptIns: Array<{ donorId: string; nickname: string }> = [
    { donorId: SEED_IDS.users.donor, nickname: 'Mari Doadora' },
  ];
  pastPool.forEach((donor, index) => {
    if (random.chance(0.3)) donorInstitutions[donor.id] = random.pick(institutions).id;
    if (random.chance(0.45)) {
      rankingOptIns.push({
        donorId: donor.id,
        nickname: `${NICKNAMES[index % NICKNAMES.length]} ${index + 1}`,
      });
    }
  });

  return {
    today,
    units: SEED_UNITS,
    scheduleRules: rules,
    users,
    campaigns,
    appointments: appointments.sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    attendances: attendances.sort((a, b) => a.attendedAt.localeCompare(b.attendedAt)),
    stock,
    movements: movements.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)),
    institutions,
    donorInstitutions,
    rankingOptIns,
  };
}

/** Garante que o dataset cobre os 8 tipos sanguíneos (usado em testes). */
export const SEED_BLOOD_TYPES = BLOOD_TYPES;
