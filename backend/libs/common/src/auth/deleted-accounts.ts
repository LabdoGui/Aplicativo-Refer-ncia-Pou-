import { DynamicModule, Global, Inject, Injectable, Module } from '@nestjs/common';
import type { RawSqlExecutor } from '../prisma/raw-client';
import { PRISMA_CLIENT } from '../tokens';

/** Token do registro local de contas excluídas (opcional por serviço). */
export const DELETED_ACCOUNTS = Symbol('DELETED_ACCOUNTS');

export interface DeletedAccounts {
  isDeleted(userId: string): Promise<boolean>;
}

/**
 * Grava a conta como excluída na tabela local `deleted_users`, dentro da
 * transação do handler de identity.user.deleted. Idempotente.
 */
export async function recordDeletedAccount(tx: RawSqlExecutor, userId: string): Promise<void> {
  await tx.$executeRawUnsafe(
    `INSERT INTO "deleted_users" ("userId", "deletedAt") VALUES ($1::uuid, now())
     ON CONFLICT ("userId") DO NOTHING`,
    userId,
  );
}

/** Lista de IDs (entre os informados) de contas já excluídas. */
export async function deletedAmong(tx: RawSqlExecutor, userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const rows = await tx.$queryRawUnsafe<Array<{ userId: string }>>(
    `SELECT "userId"::text AS "userId" FROM "deleted_users" WHERE "userId" = ANY($1::uuid[])`,
    userIds,
  );
  return new Set(rows.map((row) => row.userId));
}

@Injectable()
class PrismaDeletedAccounts implements DeletedAccounts {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: RawSqlExecutor) {}

  async isDeleted(userId: string): Promise<boolean> {
    return (await deletedAmong(this.prisma, [userId])).size > 0;
  }
}

/**
 * Conta excluída com um access token ainda válido (até 15 min) não pode mais
 * gravar nada no serviço: o AuthGuard consulta este registro, alimentado pelo
 * evento identity.user.deleted, em toda requisição de escrita.
 */
@Global()
@Module({})
export class DeletedAccountsModule {
  static forRoot(): DynamicModule {
    return {
      module: DeletedAccountsModule,
      providers: [{ provide: DELETED_ACCOUNTS, useClass: PrismaDeletedAccounts }],
      exports: [DELETED_ACCOUNTS],
    };
  }
}
