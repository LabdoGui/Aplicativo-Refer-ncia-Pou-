import 'reflect-metadata';
import { bootstrapService } from '@pulso/common';
import { AppModule } from './app.module';

void bootstrapService({
  module: AppModule,
  swagger: {
    title: 'Pulso — notification-service',
    description:
      'Central de notificações: consome os eventos da plataforma (cadastro, agendamento, doação, conquistas, estoque) e entrega avisos in-app, com contagem de não lidas e marcação de leitura.',
  },
});
