import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { APP_CONFIG, buildSeedDataset, seedUuid } from '@pulso/common';
import type { AppointmentStatus } from '@pulso/contracts';
import { dateOnly } from '../campaigns/campaigns.service';
import type { SchedulingEnv } from '../config';
import { findSlotForStart } from '../domain/schedule';
import { PrismaService } from '../prisma/prisma.service';

/** Situações que ocupam o lugar da vaga (a falta não devolve a vaga, como no uso real). */
const OCCUPYING: AppointmentStatus[] = [
  'BOOKED',
  'CONFIRMED',
  'CHECKED_IN',
  'COMPLETED',
  'NO_SHOW',
];
/** Capacidade usada quando um agendamento fictício cai fora da grade (ex.: agenda de hoje num domingo). */
const FALLBACK_CAPACITY = 3;

/**
 * Grava unidades, grade, campanhas, agendamentos e vagas fictícios quando o
 * banco está vazio (SEED_DEMO_DATA=true). Mesmos IDs dos outros serviços.
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: SchedulingEnv,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.SEED_DEMO_DATA) return;
    if ((await this.prisma.healthUnit.count()) > 0) return;
    const dataset = buildSeedDataset();

    // Vagas agregadas por (unidade, início): toda reserva aponta para uma vaga.
    const slots = new Map<
      string,
      {
        id: string;
        unitId: string;
        startsAt: Date;
        endsAt: Date;
        capacity: number;
        bookedCount: number;
      }
    >();
    for (const appointment of dataset.appointments) {
      const key = `${appointment.unitId}|${appointment.startsAt}`;
      let slot = slots.get(key);
      if (!slot) {
        const rules = dataset.scheduleRules
          .filter((rule) => rule.unitId === appointment.unitId)
          .map((rule) => ({ ...rule, active: true }));
        const startsAt = new Date(appointment.startsAt);
        const generated = findSlotForStart(rules, startsAt, 'America/Sao_Paulo');
        slot = {
          id: seedUuid(`slot:${key}`),
          unitId: appointment.unitId,
          startsAt,
          endsAt: new Date(appointment.endsAt),
          capacity: generated?.capacity ?? FALLBACK_CAPACITY,
          bookedCount: 0,
        };
        slots.set(key, slot);
      }
      if (OCCUPYING.includes(appointment.status)) slot.bookedCount += 1;
    }
    for (const slot of slots.values()) slot.capacity = Math.max(slot.capacity, slot.bookedCount, 1);

    await this.prisma.$transaction(
      async (tx) => {
        await tx.healthUnit.createMany({
          data: dataset.units.map((unit) => ({ ...unit, status: 'ACTIVE' })),
        });
        await tx.scheduleRule.createMany({
          data: dataset.scheduleRules.map((rule) => ({ ...rule, active: true })),
        });
        await tx.campaign.createMany({
          data: dataset.campaigns.map((campaign) => ({
            ...campaign,
            startsAt: dateOnly(campaign.startsAt),
            endsAt: dateOnly(campaign.endsAt),
            active: true,
          })),
        });
        await tx.slot.createMany({ data: [...slots.values()] });
        await tx.appointment.createMany({
          data: dataset.appointments.map((appointment) => ({
            id: appointment.id,
            code: appointment.code,
            donorId: appointment.donorId,
            unitId: appointment.unitId,
            slotId: slots.get(`${appointment.unitId}|${appointment.startsAt}`)!.id,
            startsAt: new Date(appointment.startsAt),
            endsAt: new Date(appointment.endsAt),
            status: appointment.status,
            campaignId: appointment.campaignId,
            createdAt: new Date(appointment.createdAt),
            cancelledAt: appointment.cancelledAt ? new Date(appointment.cancelledAt) : null,
            cancelledBy: appointment.cancelledBy,
            cancelReason: appointment.cancelledBy ? 'Cancelamento fictício de demonstração' : null,
            checkedInAt: appointment.checkedInAt ? new Date(appointment.checkedInAt) : null,
            completedAt: appointment.completedAt ? new Date(appointment.completedAt) : null,
            noShowAt: appointment.status === 'NO_SHOW' ? new Date(appointment.endsAt) : null,
          })),
        });
      },
      { timeout: 60_000 },
    );
    this.logger.log(
      { units: dataset.units.length, appointments: dataset.appointments.length, slots: slots.size },
      'Dados fictícios de demonstração gravados',
    );
  }
}
