import { randomUUID } from 'node:crypto';
import { AppException } from '@pulso/common';
import { Prisma } from '../../generated/prisma';
import type { GeneratedSlot } from '../domain/schedule';

/**
 * Reserva uma vaga de forma atômica (RN01). A vaga é materializada na primeira
 * reserva; o UPDATE condicional só incrementa se ainda houver lugar. Com
 * reservas simultâneas, o PostgreSQL serializa no bloqueio da linha e reavalia
 * a condição, então a capacidade nunca é ultrapassada (o CHECK da tabela é a
 * última barreira).
 */
export async function reserveSlot(
  tx: Prisma.TransactionClient,
  unitId: string,
  slot: GeneratedSlot,
): Promise<string> {
  await tx.$executeRawUnsafe(
    `INSERT INTO "slots" ("id", "unitId", "startsAt", "endsAt", "capacity", "bookedCount")
     VALUES ($1::uuid, $2::uuid, $3::timestamptz, $4::timestamptz, $5, 0)
     ON CONFLICT ("unitId", "startsAt") DO NOTHING`,
    randomUUID(),
    unitId,
    slot.startsAt.toISOString(),
    slot.endsAt.toISOString(),
    slot.capacity,
  );
  const reserved = await tx.$queryRawUnsafe<Array<{ id: string }>>(
    `UPDATE "slots" SET "bookedCount" = "bookedCount" + 1
      WHERE "unitId" = $1::uuid AND "startsAt" = $2::timestamptz AND "bookedCount" < "capacity"
      RETURNING "id"`,
    unitId,
    slot.startsAt.toISOString(),
  );
  if (reserved.length === 0) {
    throw new AppException(409, 'SLOT_FULL', 'Este horário acabou de lotar. Escolha outro.');
  }
  return reserved[0].id;
}

/** Devolve o lugar de uma vaga (cancelamento ou reagendamento). */
export async function releaseSlot(tx: Prisma.TransactionClient, slotId: string): Promise<void> {
  await tx.$executeRawUnsafe(
    `UPDATE "slots" SET "bookedCount" = "bookedCount" - 1 WHERE "id" = $1::uuid AND "bookedCount" > 0`,
    slotId,
  );
}

/** Violação de unicidade, exceto no código do agendamento (gerado e conferido antes). */
export function isActiveAppointmentConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }
  const target = error.meta?.target;
  const fields = Array.isArray(target) ? target.join(',') : String(target ?? '');
  return !fields.includes('code');
}

/** Conflito transitório entre transações (deadlock ou serialização): vale tentar de novo. */
export function isTransientConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === 'P2034') return true;
  const dbCode = (error.meta as { code?: string } | undefined)?.code;
  return error.code === 'P2010' && (dbCode === '40P01' || dbCode === '40001');
}
