import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, AppException, InternalHttpClient } from '@pulso/common';
import { API_PREFIX, type InternalAppointmentView } from '@pulso/contracts';
import type { ClinicalEnv } from '../config';

/** Leitura de agendamentos no scheduling-service (rota interna, token de serviço). */
@Injectable()
export class SchedulingClient {
  constructor(
    private readonly http: InternalHttpClient,
    @Inject(APP_CONFIG) private readonly config: ClinicalEnv,
  ) {}

  async appointment(id: string, requestId?: string): Promise<InternalAppointmentView> {
    try {
      return await this.http.get<InternalAppointmentView>(
        this.config.SCHEDULING_URL,
        `/${API_PREFIX}/internal/appointments/${encodeURIComponent(id)}`,
        { requestId },
      );
    } catch (error) {
      if (error instanceof AppException && error.getStatus() === 404) {
        throw new AppException(404, 'APPOINTMENT_NOT_FOUND', 'Agendamento não encontrado.');
      }
      throw error;
    }
  }
}
