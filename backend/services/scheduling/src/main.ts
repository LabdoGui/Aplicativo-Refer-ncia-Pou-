import 'reflect-metadata';
import { bootstrapService } from '@pulso/common';
import { AppModule } from './app.module';

void bootstrapService({
  module: AppModule,
  swagger: {
    title: 'Pulso — scheduling-service',
    description:
      'Unidades de saúde, grade de horários e vagas, agendamento, cancelamento e reagendamento de doações, agenda do dia da equipe com check-in e falta, e campanhas de doação.',
  },
});
