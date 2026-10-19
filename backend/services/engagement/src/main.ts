import 'reflect-metadata';
import { bootstrapService } from '@pulso/common';
import { AppModule } from './app.module';

void bootstrapService({
  module: AppModule,
  swagger: {
    title: 'Pulso — engagement-service',
    description:
      'Gamificação a partir de eventos de comparecimento e doação: pontos, níveis, conquistas e ranking opcional, além de horas complementares com instituições parceiras validadas pelo administrador.',
  },
});
