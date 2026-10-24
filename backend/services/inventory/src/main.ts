import 'reflect-metadata';
import { bootstrapService } from '@pulso/common';
import { AppModule } from './app.module';

void bootstrapService({
  module: AppModule,
  swagger: {
    title: 'SangueConecta — inventory-service',
    description:
      'Banco de sangue (simulação acadêmica): níveis do estoque central por tipo sanguíneo, movimentações de entrada e saída, limites mínimo e ideal, histórico e indicadores públicos de nível.',
  },
});
