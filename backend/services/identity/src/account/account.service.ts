import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { AppException, AuditService, FieldEncryption, OutboxService } from '@pulso/common';
import {
  CONSENT_PURPOSES,
  EVENTS,
  TERMS_VERSION,
  type AuthUser,
  type ConsentView,
  type MeResponse,
  type PersonalDataExport,
} from '@pulso/contracts';
import type { Consent, DonorProfile, User } from '../../generated/prisma';
import { AuthService } from '../auth/auth.service';
import { PasswordService } from '../auth/password.service';
import { PrismaService } from '../prisma/prisma.service';
import { CONSENT_CATALOG } from './consent-catalog';
import type { ChangePasswordDto, UpdateConsentsDto, UpdateMeDto } from './dto/account.dto';

type FullUser = User & {
  donorProfile: DonorProfile | null;
  professionalProfile: { unitIds: string[] } | null;
};

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: FieldEncryption,
    private readonly passwords: PasswordService,
    private readonly auth: AuthService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  async me(userId: string): Promise<MeResponse> {
    return this.toMe(await this.load(userId));
  }

  async updateMe(actor: AuthUser, dto: UpdateMeDto, requestId?: string): Promise<MeResponse> {
    const user = await this.load(actor.id);
    const donorFields = ['phone', 'declaredBloodType', 'city'] as const;
    const touchesDonor = donorFields.some((field) => dto[field] !== undefined);
    if (touchesDonor && !user.donorProfile) {
      throw new AppException(422, 'NOT_A_DONOR', 'Esses dados existem apenas no perfil de doador.');
    }

    const changed = Object.keys(dto).filter((key) => dto[key as keyof UpdateMeDto] !== undefined);
    await this.prisma.$transaction(async (tx) => {
      if (dto.name !== undefined) {
        await tx.user.update({ where: { id: user.id }, data: { name: dto.name } });
      }
      if (touchesDonor) {
        await tx.donorProfile.update({
          where: { userId: user.id },
          data: {
            ...(dto.phone !== undefined
              ? { phoneEncrypted: dto.phone ? this.encryption.encrypt(dto.phone) : null }
              : {}),
            ...(dto.declaredBloodType !== undefined
              ? { declaredBloodType: dto.declaredBloodType }
              : {}),
            ...(dto.city !== undefined ? { city: dto.city || null } : {}),
          },
        });
      }
      // Só os nomes dos campos: os valores são dados pessoais.
      await this.audit.record(
        {
          actor,
          action: 'user.profile_updated',
          entity: 'user',
          entityId: user.id,
          metadata: { fields: changed },
          requestId,
        },
        tx,
      );
    });
    return this.me(user.id);
  }

  async changePassword(
    actor: AuthUser,
    dto: ChangePasswordDto,
    currentRefreshToken: string | undefined,
    requestId?: string,
  ): Promise<void> {
    const user = await this.load(actor.id);
    await this.auth.reservePasswordAttempt(user.id);
    if (!(await this.passwords.verify(user.passwordHash, dto.currentPassword))) {
      await this.auth.registerFailedPassword(user.id, 'user.password_check_failed', requestId);
      throw new AppException(422, 'WRONG_PASSWORD', 'A senha atual não confere.', undefined, [
        { field: 'currentPassword', message: 'A senha atual não confere.' },
      ]);
    }
    await this.auth.confirmPasswordAttempt(user.id);
    if (dto.currentPassword === dto.newPassword) {
      throw new AppException(
        422,
        'SAME_PASSWORD',
        'A nova senha precisa ser diferente da atual.',
        undefined,
        [{ field: 'newPassword', message: 'A nova senha precisa ser diferente da atual.' }],
      );
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await this.passwords.hash(dto.newPassword) },
    });
    // Outros dispositivos saem; o atual continua conectado. O cookie de refresh só
    // vai para /auth, então a sessão atual vem do access token (claim sid).
    const currentSession = actor.sessionId ?? (await this.auth.familyOf(currentRefreshToken));
    await this.auth.revokeAllSessions(user.id, currentSession);
    await this.audit.record({
      actor,
      action: 'user.password_changed',
      entity: 'user',
      entityId: user.id,
      requestId,
    });
  }

  async consents(userId: string): Promise<ConsentView[]> {
    const rows = await this.prisma.consent.findMany({ where: { userId } });
    return CONSENT_PURPOSES.map((purpose) =>
      this.toConsent(
        purpose,
        rows.find((row) => row.purpose === purpose),
      ),
    );
  }

  async updateConsents(
    actor: AuthUser,
    dto: UpdateConsentsDto,
    requestId?: string,
  ): Promise<ConsentView[]> {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      for (const choice of dto.consents) {
        if (CONSENT_CATALOG[choice.purpose].required && !choice.granted) {
          throw new AppException(
            422,
            'CONSENT_REQUIRED',
            'O aceite dos Termos de Uso é necessário para usar o Pulso. Para retirá-lo, exclua sua conta.',
          );
        }
        const current = await tx.consent.findUnique({
          where: { userId_purpose: { userId: actor.id, purpose: choice.purpose } },
        });
        if (current?.granted === choice.granted) continue;
        await tx.consent.upsert({
          where: { userId_purpose: { userId: actor.id, purpose: choice.purpose } },
          create: {
            userId: actor.id,
            purpose: choice.purpose,
            granted: choice.granted,
            version: TERMS_VERSION,
            grantedAt: choice.granted ? now : null,
            revokedAt: choice.granted ? null : now,
          },
          update: {
            granted: choice.granted,
            version: TERMS_VERSION,
            ...(choice.granted ? { grantedAt: now, revokedAt: null } : { revokedAt: now }),
          },
        });
        await this.audit.record(
          {
            actor,
            action: choice.granted ? 'consent.granted' : 'consent.revoked',
            entity: 'consent',
            entityId: actor.id,
            metadata: { purpose: choice.purpose, version: TERMS_VERSION },
            requestId,
          },
          tx,
        );
      }
    });
    return this.consents(actor.id);
  }

  async exportData(actor: AuthUser, requestId?: string): Promise<PersonalDataExport> {
    const [account, consents] = await Promise.all([this.me(actor.id), this.consents(actor.id)]);
    await this.audit.record({
      actor,
      action: 'user.data_exported',
      entity: 'user',
      entityId: actor.id,
      requestId,
    });
    return {
      generatedAt: new Date().toISOString(),
      account,
      consents,
      notice:
        'Cópia dos dados de cadastro guardados pelo Pulso (identidade e consentimentos). Agendamentos, atendimentos e conquistas aparecem nas respectivas telas do app.',
    };
  }

  /**
   * Exclusão da conta: os dados de identificação são apagados e a conta fica
   * anonimizada. O evento identity.user.deleted leva a exclusão aos outros
   * serviços: agendamentos em aberto são cancelados, respostas da pré-triagem,
   * notificações e presença no ranking são apagadas. Registros de atendimento e
   * doação ficam pseudonimizados, ligados apenas ao identificador, por
   * obrigação de guarda da instituição de saúde.
   */
  async deleteAccount(actor: AuthUser, password: string, requestId?: string): Promise<void> {
    const user = await this.load(actor.id);
    await this.auth.reservePasswordAttempt(user.id);
    if (!(await this.passwords.verify(user.passwordHash, password))) {
      await this.auth.registerFailedPassword(user.id, 'user.password_check_failed', requestId);
      throw new AppException(422, 'WRONG_PASSWORD', 'A senha não confere.', undefined, [
        { field: 'password', message: 'A senha não confere.' },
      ]);
    }
    await this.auth.confirmPasswordAttempt(user.id);
    if (user.role === 'ADMIN') {
      throw new AppException(
        422,
        'ADMIN_SELF_DELETE',
        'Contas de administração são removidas por outro administrador.',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.donorProfile.deleteMany({ where: { userId: user.id } });
      await tx.professionalProfile.deleteMany({ where: { userId: user.id } });
      await tx.consent.deleteMany({ where: { userId: user.id } });
      await tx.refreshToken.deleteMany({ where: { userId: user.id } });
      await tx.user.update({
        where: { id: user.id },
        data: {
          status: 'ANONYMIZED',
          name: 'Conta removida',
          email: `removido+${user.id}@pulso.invalid`,
          passwordHash: randomBytes(32).toString('hex'),
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
      // Os outros serviços apagam ou desvinculam o que guardam desta pessoa.
      await this.outbox.enqueue(
        tx,
        EVENTS.USER_DELETED,
        { userId: user.id, occurredAt: new Date().toISOString() },
        requestId,
      );
      await this.audit.record(
        { actor, action: 'user.account_deleted', entity: 'user', entityId: user.id, requestId },
        tx,
      );
    });
  }

  private async load(userId: string): Promise<FullUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { donorProfile: true, professionalProfile: { select: { unitIds: true } } },
    });
    if (!user || user.status === 'ANONYMIZED') {
      throw new AppException(404, 'USER_NOT_FOUND', 'Conta não encontrada.');
    }
    return user;
  }

  private toMe(user: FullUser): MeResponse {
    const donor = user.donorProfile;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      unitIds: user.professionalProfile?.unitIds ?? [],
      createdAt: user.createdAt.toISOString(),
      donor: donor
        ? {
            donorCode: donor.donorCode,
            birthDate: donor.birthDate.toISOString().slice(0, 10),
            phone: donor.phoneEncrypted ? this.encryption.decrypt(donor.phoneEncrypted) : null,
            declaredBloodType: donor.declaredBloodType,
            city: donor.city,
          }
        : null,
    };
  }

  private toConsent(purpose: (typeof CONSENT_PURPOSES)[number], row?: Consent): ConsentView {
    const catalog = CONSENT_CATALOG[purpose];
    return {
      purpose,
      title: catalog.title,
      description: catalog.description,
      required: catalog.required,
      granted: row?.granted ?? false,
      version: row?.version ?? null,
      grantedAt: row?.grantedAt?.toISOString() ?? null,
      revokedAt: row?.revokedAt?.toISOString() ?? null,
    };
  }
}
