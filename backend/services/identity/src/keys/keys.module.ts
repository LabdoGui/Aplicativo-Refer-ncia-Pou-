import { Global, Module } from '@nestjs/common';
import { getKeyStore, KeyStore } from './key-store';
import { JwksController } from './jwks.controller';

@Global()
@Module({
  controllers: [JwksController],
  providers: [{ provide: KeyStore, useFactory: () => getKeyStore() }],
  exports: [KeyStore],
})
export class KeysModule {}
