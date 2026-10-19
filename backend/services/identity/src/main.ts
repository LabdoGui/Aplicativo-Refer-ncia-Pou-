import 'reflect-metadata';
import { bootstrapService } from '@pulso/common';
import { AppModule } from './app.module';

void bootstrapService({
  module: AppModule,
  swagger: {
    title: 'Pulso — identity-service',
    description: 'Autenticação, contas, perfis de doador e de profissional, consentimentos (LGPD).',
  },
});
