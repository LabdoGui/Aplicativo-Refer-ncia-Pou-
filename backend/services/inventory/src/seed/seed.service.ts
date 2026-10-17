import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { APP_CONFIG, buildSeedDataset, SEED_IDS } from '@pulso/common';
import type { InventoryEnv } from '../config';
import { PrismaService } from '../prisma/prisma.service';

/** Nome do administrador fictício que registrou o histórico de demonstração. */
const SEED_RESPONSIBLE_NAME = 'Ana Paula Ribeiro';

/** Grava o estoque fictício e 90 dias de movimentações quando o banco está vazio (SEED_DEMO_DATA=true). */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: InventoryEnv,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.SEED_DEMO_DATA) return;
    if ((await this.prisma.bloodStock.count()) > 0) return;
    const dataset = buildSeedDataset();
    const { movements } = dataset;

    await this.prisma.$transaction(
      async (tx) => {
        await tx.bloodStock.createMany({
          data: dataset.stock.map((item) => ({
            bloodType: item.bloodType,
            quantity: item.quantity,
            minimum: item.minimum,
            ideal: item.ideal,
          })),
        });
        await tx.stockMovement.createMany({
          data: movements.map((movement) => ({
            id: movement.id,
            bloodType: movement.bloodType,
            type: movement.type,
            quantity: movement.quantity,
            reason: movement.reason,
            notes: null,
            occurredAt: new Date(movement.occurredAt),
            responsibleId: SEED_IDS.users.admin,
            responsibleName: SEED_RESPONSIBLE_NAME,
            balanceAfter: movement.balanceAfter,
            createdAt: new Date(movement.occurredAt),
          })),
        });
      },
      { timeout: 60_000 },
    );
    this.logger.log(
      { stock: dataset.stock.length, movements: movements.length },
      'Estoque fictício de demonstração gravado',
    );
  }
}
