import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, FieldEncryption } from '@pulso/common';
import type { IdentityEnv } from '../config';

@Global()
@Module({
  providers: [
    {
      provide: FieldEncryption,
      useFactory: (config: IdentityEnv) => new FieldEncryption(config.FIELD_ENCRYPTION_KEY),
      inject: [APP_CONFIG],
    },
  ],
  exports: [FieldEncryption],
})
export class CryptoModule {}
