import 'reflect-metadata';
import { bootstrapService } from '@pulso/common';
import { AppModule } from './app.module';

void bootstrapService({
  module: AppModule,
  swagger: {
    title: 'Pulso — clinical-service',
    description:
      'Pré-triagem informativa, triagem presencial configurável, registro de doações e emissão e verificação pública de documentos. Concentra os dados de saúde, cifrados e auditados. No ambiente acadêmico, a triagem é simulação e as regras aguardam validação profissional.',
  },
});
