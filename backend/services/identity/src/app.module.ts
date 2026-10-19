import { Module } from '@nestjs/common';
import {
  AuditModule,
  BrokerHealthIndicator,
  CoreModule,
  DatabaseHealthIndicator,
  HealthModule,
  LocalKeyTokenVerifier,
  MessagingModule,
} from '@pulso/common';
import { AccountModule } from './account/account.module';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { envSchema } from './config';
import { CryptoModule } from './crypto/crypto.module';
import { InternalController } from './internal/internal.controller';
import { getKeyStore } from './keys/key-store';
import { KeysModule } from './keys/keys.module';
import { PrismaModule } from './prisma/prisma.module';
import { SeedService } from './seed/seed.service';

@Module({
  imports: [
    CoreModule.forRoot({
      serviceName: 'identity-service',
      envSchema,
      // O identity valida os próprios tokens com a chave local (não depende do próprio JWKS por HTTP).
      tokenVerifier: {
        useFactory: () => new LocalKeyTokenVerifier(async () => (await getKeyStore()).publicKey),
      },
    }),
    PrismaModule,
    MessagingModule.forRoot(),
    AuditModule.forRoot(),
    HealthModule.forRoot([DatabaseHealthIndicator, BrokerHealthIndicator]),
    CryptoModule,
    KeysModule,
    AuthModule,
    AccountModule,
    AdminModule,
  ],
  controllers: [InternalController],
  providers: [SeedService],
})
export class AppModule {}
