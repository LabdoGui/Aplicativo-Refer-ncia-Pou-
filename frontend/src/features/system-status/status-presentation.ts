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

const OVERALL_SUMMARY: Record<HealthStatus, string> = {
  up: 'Todos os serviços estão funcionando normalmente.',
  degraded: 'Alguns serviços estão instáveis. Parte das funcionalidades pode falhar.',
  down: 'Serviços indisponíveis no momento. Estamos aguardando o retorno.',
};

/** Estado geral quando a última consulta falhou: os dados exibidos são antigos. */
export const STALE_OVERALL_STATUS: StatusPresentation = {
  tone: 'unknown',
  label: 'Situação atual desconhecida',
};

/** Resumo no passado, para não apresentar dados antigos como se fossem a situação atual. */
const STALE_OVERALL_SUMMARY: Record<HealthStatus, string> = {
  up: 'Na última consulta bem-sucedida, todos os serviços estavam funcionando normalmente.',
  degraded: 'Na última consulta bem-sucedida, alguns serviços estavam instáveis.',
  down: 'Na última consulta bem-sucedida, os serviços estavam indisponíveis.',
};

export function overallSummary(status: string, stale = false): string {
  const summaries = stale ? STALE_OVERALL_SUMMARY : OVERALL_SUMMARY;
  return summaries[status as HealthStatus] ?? 'Não foi possível interpretar o estado geral.';
}

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
