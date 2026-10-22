/**
 * Leitura de agendamentos no scheduling (espelho de scheduling/scheduling.client.ts
 * + InternalHttpClient): 404 vira APPOINTMENT_NOT_FOUND; serviço fora do ar ou
 * com erro vira 503, como a chamada HTTP interna do back-end.
 */
import type { InternalAppointmentView } from '@pulso/contracts';
import { DemoHttpError, fail } from '../../core/http';
import { internal } from '../../core/internal';

const UNAVAILABLE_TITLE = 'Serviço indisponível';

export function schedulingAppointment(id: string): InternalAppointmentView {
  try {
    return internal.scheduling.appointment(id);
  } catch (error) {
    if (error instanceof DemoHttpError) {
      if (error.status === 404) fail(404, 'APPOINTMENT_NOT_FOUND', 'Agendamento não encontrado.');
      fail(
        503,
        'UPSTREAM_ERROR',
        'Um serviço necessário respondeu com erro. Tente novamente em instantes.',
        UNAVAILABLE_TITLE,
      );
    }
    // Função interna ainda não registrada: equivale ao serviço fora do ar.
    fail(
      503,
      'UPSTREAM_UNAVAILABLE',
      'Um serviço necessário está temporariamente indisponível. Tente novamente em instantes.',
      UNAVAILABLE_TITLE,
    );
  }
}
