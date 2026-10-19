import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import {
  ageOn,
  APP_CONFIG,
  AppException,
  AuditService,
  FieldEncryption,
  humanCode,
  OutboxService,
  todayLocal,
} from '@pulso/common';
import {
  EVENTS,
  MIN_DONOR_AGE,
  TERMS_VERSION,
  type AuthSession,
  type SessionUser,
} from '@pulso/contracts';
import type { IdentityEnv } from '../config';
import { Prisma, type User } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import type { LoginDto, RegisterDto } from './dto/auth.dto';
import { PasswordService } from './password.service';
import { hashRefreshToken, TokenService } from './token.service';

/** Tentativas de senha erradas antes do bloqueio temporário da conta. */
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;
/** Novas tentativas de reserva quando o limite está tomado por conferências em andamento. */
export const RESERVE_RETRIES = 3;
export const RESERVE_RETRY_MS = 150;
/** Reserva mais antiga que isso nunca foi concluída (a conferência leva menos de 1 s). */
export const UNSETTLED_ATTEMPT_SECONDS = 60;
/** Reuso de um refresh token dentro deste prazo é tratado como corrida entre abas, não ataque. */
export const REFRESH_REUSE_GRACE_MS = 10_000;

export interface IssuedSession {
  session: AuthSession;
  refreshToken: string;
}

function lockedException(remainingMs: number): AppException {
  const minutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  return new AppException(
    429,
    'ACCOUNT_LOCKED',
    remainingMs > 0
      ? `Muitas tentativas com senha incorreta. Tente novamente em ${minutes} minuto(s).`
      : 'Muitas tentativas ao mesmo tempo. Aguarde alguns instantes e tente novamente.',
  );
}

interface ClientContext {
  userAgent?: string;
  requestId?: string;
}

type UserWithProfile = User & { professionalProfile: { unitIds: string[] } | null };

const INVALID_CREDENTIALS = () =>
  new AppException(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.');

const SESSION_EXPIRED = () =>
  new AppException(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.');

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly encryption: FieldEncryption,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: IdentityEnv,
  ) {}

  /** Cadastro de doador (RN18: maiores de 18 anos), com login automático. */
  async register(dto: RegisterDto, context: ClientContext): Promise<IssuedSession> {
    const today = todayLocal();
    if (dto.birthDate > today) {
      throw new AppException(
        400,
        'INVALID_BIRTH_DATE',
        'A data de nascimento não pode ser futura.',
        undefined,
        [{ field: 'birthDate', message: 'A data de nascimento não pode ser futura.' }],
      );
    }
    const age = ageOn(dto.birthDate, today);
    if (age > 120) {
      throw new AppException(
        400,
        'INVALID_BIRTH_DATE',
        'Confira a data de nascimento.',
        undefined,
        [{ field: 'birthDate', message: 'Confira a data de nascimento.' }],
      );
    }
    if (age < MIN_DONOR_AGE) {
      throw new AppException(
        422,
        'AGE_RESTRICTION',
        'O cadastro no Pulso é para maiores de 18 anos. Se você tem 16 ou 17 anos, procure diretamente uma unidade de coleta.',
      );
    }

    const passwordHash = await this.passwords.hash(dto.password);
    const now = new Date();
    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: dto.email,
            passwordHash,
            name: dto.name,
            role: 'DONOR',
            donorProfile: {
              create: {
                donorCode: await this.uniqueDonorCode(tx),
                birthDate: new Date(`${dto.birthDate}T00:00:00Z`),
                phoneEncrypted: dto.phone ? this.encryption.encrypt(dto.phone) : null,
              },
            },
            consents: {
              create: [
                { purpose: 'TERMS_PRIVACY', granted: true, version: TERMS_VERSION, grantedAt: now },
                {
                  purpose: 'COMMUNICATIONS',
                  granted: dto.acceptCommunications === true,
                  version: TERMS_VERSION,
                  grantedAt: dto.acceptCommunications ? now : null,
                },
              ],
            },
          },
          include: { professionalProfile: { select: { unitIds: true } } },
        });
        await this.outbox.enqueue(
          tx,
          EVENTS.USER_REGISTERED,
          {
            userId: created.id,
            name: created.name,
            role: created.role,
          },
          context.requestId,
        );
        await this.audit.record(
          {
            actor: { id: created.id, role: created.role },
            action: 'user.registered',
            entity: 'user',
            entityId: created.id,
            metadata: {
              communications: dto.acceptCommunications === true,
              termsVersion: TERMS_VERSION,
            },
            requestId: context.requestId,
          },
          tx,
        );
        return created;
      });
      return this.issueSession(user, randomUUID(), context);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppException(
          409,
          'EMAIL_TAKEN',
          'Este e-mail já está cadastrado. Entre com sua senha.',
          undefined,
          [{ field: 'email', message: 'Este e-mail já está cadastrado.' }],
        );
      }
      throw error;
    }
  }

  async login(dto: LoginDto, context: ClientContext): Promise<IssuedSession> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { professionalProfile: { select: { unitIds: true } } },
    });
    if (!user || user.status === 'ANONYMIZED') {
      await this.passwords.verifyDummy(dto.password);
      throw INVALID_CREDENTIALS();
    }

    await this.reservePasswordAttempt(user.id);
    if (!(await this.passwords.verify(user.passwordHash, dto.password))) {
      await this.registerFailedPassword(user.id, 'auth.login_failed', context.requestId);
      throw INVALID_CREDENTIALS();
    }
    await this.confirmPasswordAttempt(user.id);

    if (user.status === 'DISABLED') {
      throw new AppException(
        403,
        'ACCOUNT_DISABLED',
        'Esta conta está desativada. Fale com a administração.',
      );
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.audit.record({
      actor: { id: user.id, role: user.role },
      action: 'auth.login',
      entity: 'user',
      entityId: user.id,
      requestId: context.requestId,
    });
    return this.issueSession(user, randomUUID(), context);
  }

  /**
   * Troca o refresh token por um novo par (rotação). Reapresentar um token já
   * trocado (fora da janela de corrida entre abas) revoga a família inteira.
   */
  async refresh(refreshToken: string | undefined, context: ClientContext): Promise<IssuedSession> {
    if (!refreshToken) throw SESSION_EXPIRED();
    const tokenHash = hashRefreshToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { professionalProfile: { select: { unitIds: true } } } } },
    });
    if (!stored) throw SESSION_EXPIRED();

    const now = new Date();
    if (stored.revokedAt) throw SESSION_EXPIRED();
    if (stored.rotatedAt) {
      if (now.getTime() - stored.rotatedAt.getTime() <= REFRESH_REUSE_GRACE_MS) {
        throw new AppException(
          401,
          'REFRESH_RACE',
          'Sua sessão foi renovada em outra aba. Tente novamente.',
        );
      }
      await this.revokeFamily(stored.familyId);
      await this.audit.record({
        actor: { id: stored.userId, role: stored.user.role },
        action: 'auth.refresh_reuse_detected',
        entity: 'session',
        entityId: stored.familyId,
        requestId: context.requestId,
      });
      this.logger.warn(
        { userId: stored.userId, familyId: stored.familyId },
        'Reuso de refresh token: sessão revogada',
      );
      throw SESSION_EXPIRED();
    }
    if (stored.expiresAt <= now || stored.user.status !== 'ACTIVE') throw SESSION_EXPIRED();

    // Marca como trocado só se ninguém trocou antes (duas renovações simultâneas).
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, rotatedAt: null, revokedAt: null },
      data: { rotatedAt: now },
    });
    if (count === 0) {
      throw new AppException(
        401,
        'REFRESH_RACE',
        'Sua sessão foi renovada em outra aba. Tente novamente.',
      );
    }
    return this.issueSession(stored.user, stored.familyId, context);
  }

  /** Encerra a sessão do dispositivo (revoga a família do refresh token). */
  async logout(refreshToken: string | undefined, context: ClientContext): Promise<void> {
    if (!refreshToken) return;
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(refreshToken) },
      include: { user: { select: { role: true } } },
    });
    if (!stored) return;
    await this.revokeFamily(stored.familyId);
    await this.audit.record({
      actor: { id: stored.userId, role: stored.user.role },
      action: 'auth.logout',
      entity: 'session',
      entityId: stored.familyId,
      requestId: context.requestId,
    });
  }

  /**
   * Reserva uma tentativa de senha ANTES de conferi-la (login, troca de senha e
   * exclusão da conta). Numa única instrução, só incrementa se a conta não está
   * bloqueada e se ainda há tentativas: requisições simultâneas também param no
   * limite, em vez de cada uma conferir a senha com uma leitura antiga.
   *
   * Sem tentativas livres e sem bloqueio, o limite está tomado por conferências
   * em andamento: espera um pouco e tenta de novo (logins simultâneos com a senha
   * certa liberam a vaga em instantes). Se a última reserva é antiga, ela nunca
   * foi concluída (queda no meio da conferência) e o contador cheio vira um
   * bloqueio comum, que expira, em vez de travar a conta para sempre.
   */
  async reservePasswordAttempt(userId: string): Promise<void> {
    for (let retry = 0; ; retry += 1) {
      const reserved = await this.prisma.$queryRaw<Array<{ failedLoginAttempts: number }>>`
        UPDATE "users"
           SET "failedLoginAttempts" = "failedLoginAttempts" + 1, "passwordAttemptAt" = now()
         WHERE "id" = ${userId}::uuid
           AND ("lockedUntil" IS NULL OR "lockedUntil" <= now())
           AND "failedLoginAttempts" < ${MAX_FAILED_LOGINS}
         RETURNING "failedLoginAttempts"`;
      if (reserved.length > 0) return;

      const unsettled = await this.prisma.$queryRaw<Array<{ id: string }>>`
        UPDATE "users"
           SET "failedLoginAttempts" = 0, "passwordAttemptAt" = NULL,
               "lockedUntil" = now() + ${LOCK_MINUTES}::int * interval '1 minute'
         WHERE "id" = ${userId}::uuid
           AND ("lockedUntil" IS NULL OR "lockedUntil" <= now())
           AND "failedLoginAttempts" >= ${MAX_FAILED_LOGINS}
           AND ("passwordAttemptAt" IS NULL
                OR "passwordAttemptAt" < now() - ${UNSETTLED_ATTEMPT_SECONDS}::int * interval '1 second')
         RETURNING "id"`;
      if (unsettled.length > 0) {
        await this.audit.record({
          actor: null,
          action: 'auth.account_locked',
          entity: 'user',
          entityId: userId,
          metadata: { reason: 'unsettled_attempts' },
        });
        throw await this.lockedError(userId);
      }

      const remainingMs = await this.lockRemainingMs(userId);
      if (remainingMs > 0 || retry >= RESERVE_RETRIES) throw lockedException(remainingMs);
      await sleep(RESERVE_RETRY_MS);
    }
  }

  /**
   * Senha certa: zera o contador, desde que nenhuma tentativa simultânea tenha
   * bloqueado a conta nesse meio-tempo (nesse caso, nada de sessão).
   */
  async confirmPasswordAttempt(userId: string): Promise<void> {
    const { count } = await this.prisma.user.updateMany({
      where: { id: userId, OR: [{ lockedUntil: null }, { lockedUntil: { lte: new Date() } }] },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
    if (count === 0) throw await this.lockedError(userId);
  }

  /**
   * Senha errada (a tentativa já foi contada na reserva): se o limite foi
   * atingido, bloqueia a conta (antes da auditoria, para uma falha ao gravar o
   * registro não deixar o contador cheio sem bloqueio) e registra a falha. Só
   * uma das tentativas simultâneas bloqueia e registra o bloqueio.
   */
  async registerFailedPassword(userId: string, action: string, requestId?: string): Promise<void> {
    const { count } = await this.prisma.user.updateMany({
      where: {
        id: userId,
        failedLoginAttempts: { gte: MAX_FAILED_LOGINS },
        OR: [{ lockedUntil: null }, { lockedUntil: { lte: new Date() } }],
      },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000),
      },
    });
    await this.audit.record({ actor: null, action, entity: 'user', entityId: userId, requestId });
    if (count === 0) return;
    await this.audit.record({
      actor: null,
      action: 'auth.account_locked',
      entity: 'user',
      entityId: userId,
      requestId,
    });
  }

  private async lockRemainingMs(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { lockedUntil: true },
    });
    return (user?.lockedUntil?.getTime() ?? 0) - Date.now();
  }

  private async lockedError(userId: string): Promise<AppException> {
    return lockedException(await this.lockRemainingMs(userId));
  }

  /** Revoga todas as sessões do usuário, menos (opcionalmente) a família informada. */
  async revokeAllSessions(userId: string, exceptFamilyId?: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptFamilyId ? { familyId: { not: exceptFamilyId } } : {}),
      },
      data: { revokedAt: new Date() },
    });
  }

  async familyOf(refreshToken: string | undefined): Promise<string | undefined> {
    if (!refreshToken) return undefined;
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(refreshToken) },
      select: { familyId: true },
    });
    return stored?.familyId;
  }

  get cookieSecure(): boolean {
    return this.config.COOKIE_SECURE;
  }

  get refreshTokenTtlMs(): number {
    return this.tokens.refreshTokenTtlMs;
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueSession(
    user: UserWithProfile,
    familyId: string,
    context: ClientContext,
  ): Promise<IssuedSession> {
    const sessionUser: SessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      unitIds: user.professionalProfile?.unitIds ?? [],
    };
    const { token, tokenHash } = this.tokens.newRefreshToken();
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        familyId,
        tokenHash,
        expiresAt: new Date(Date.now() + this.tokens.refreshTokenTtlMs),
        userAgent: context.userAgent?.slice(0, 300),
      },
    });
    return {
      session: {
        accessToken: await this.tokens.signAccessToken(sessionUser, familyId),
        expiresIn: this.tokens.accessTokenTtlSeconds,
        user: sessionUser,
      },
      refreshToken: token,
    };
  }

  private async uniqueDonorCode(tx: Prisma.TransactionClient): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = humanCode('PUL');
      const taken = await tx.donorProfile.findUnique({
        where: { donorCode: code },
        select: { userId: true },
      });
      if (!taken) return code;
    }
    throw new Error('Não foi possível gerar um código de doador único');
  }
}
