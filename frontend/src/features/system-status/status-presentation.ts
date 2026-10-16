import type { StatusTone } from '@/components/ui';
import type { CheckStatus, HealthStatus } from './types';

interface StatusPresentation {
  tone: StatusTone;
  label: string;
}

export const SERVICE_STATUS: Record<HealthStatus, StatusPresentation> = {
  up: { tone: 'ok', label: 'Operacional' },
  degraded: { tone: 'warn', label: 'Instável' },
  down: { tone: 'critical', label: 'Fora do ar' },
};

export const OVERALL_SUMMARY: Record<HealthStatus, string> = {
  up: 'Todos os serviços estão funcionando normalmente.',
  degraded: 'Alguns serviços estão instáveis. Parte das funcionalidades pode falhar.',
  down: 'Serviços indisponíveis no momento. Estamos aguardando o retorno.',
};

export const CHECK_STATUS: Record<CheckStatus, StatusPresentation> = {
  up: { tone: 'ok', label: 'Conectado' },
  down: { tone: 'critical', label: 'Sem conexão' },
};

const CHECK_LABELS: Record<string, string> = {
  database: 'Banco de dados',
  broker: 'Mensageria',
};

export function checkLabel(name: string): string {
  return CHECK_LABELS[name] ?? name;
}

/** Protege a interface contra valores inesperados vindos da API. */
export function presentServiceStatus(status: string): StatusPresentation {
  return SERVICE_STATUS[status as HealthStatus] ?? { tone: 'unknown', label: 'Desconhecido' };
}

export function presentCheckStatus(status: string): StatusPresentation {
  return CHECK_STATUS[status as CheckStatus] ?? { tone: 'unknown', label: 'Desconhecido' };
}
