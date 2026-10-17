import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { APP_CONFIG, buildSeedDataset, FieldEncryption, SEED_PASSWORD } from '@pulso/common';
import { TERMS_VERSION } from '@pulso/contracts';
import type { IdentityEnv } from '../config';
import { PasswordService } from '../auth/password.service';
import { PrismaService } from '../prisma/prisma.service';

/** Grava as contas fictícias de demonstração quando o banco está vazio (SEED_DEMO_DATA=true). */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly encryption: FieldEncryption,
    @Inject(APP_CONFIG) private readonly config: IdentityEnv,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.SEED_DEMO_DATA) return;
    if ((await this.prisma.user.count()) > 0) return;
    const dataset = buildSeedDataset();
    // Mesmo hash para todas as contas de demonstração (mesma senha, documentada no README).
    const passwordHash = await this.passwords.hash(SEED_PASSWORD);

    await this.prisma.$transaction(
      async (tx) => {
        for (const [index, user] of dataset.users.entries()) {
          const createdAt = new Date(user.createdAt);
          await tx.user.create({
            data: {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
              passwordHash,
              createdAt,
              donorProfile: user.donor
                ? {
                    create: {
                      donorCode: user.donor.donorCode,
                      birthDate: new Date(`${user.donor.birthDate}T00:00:00Z`),
                      phoneEncrypted: user.donor.phone
                        ? this.encryption.encrypt(user.donor.phone)
                        : null,
                      declaredBloodType: index % 3 === 0 ? null : user.donor.bloodType,
                      city: user.donor.city,
                    },
                  }
                : undefined,
              professionalProfile:
                user.role !== 'DONOR'
                  ? { create: { unitIds: user.unitIds, registryNumber: user.registryNumber } }
                  : undefined,
              consents: {
                create: [
                  {
                    purpose: 'TERMS_PRIVACY',
                    granted: true,
                    version: TERMS_VERSION,
                    grantedAt: createdAt,
                  },
                  {
                    purpose: 'COMMUNICATIONS',
                    granted: index % 5 !== 0,
                    version: TERMS_VERSION,
                    grantedAt: index % 5 !== 0 ? createdAt : null,
                  },
                ],
              },
            },
          });
        }
      },
      { timeout: 60_000 },
    );
    this.logger.log({ users: dataset.users.length }, 'Dados fictícios de demonstração gravados');
  }
}
