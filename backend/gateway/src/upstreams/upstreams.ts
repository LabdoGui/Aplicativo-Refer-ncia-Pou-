import { SERVICE_NAMES, SERVICES, type ServiceName } from '@pulso/contracts';
import type { GatewayEnv } from '../config';

/** Token de injeção da lista de serviços de destino do gateway. */
export const UPSTREAMS = Symbol('UPSTREAMS');

/** Serviço de destino: nome, título amigável e URL base interna (nunca exposta ao cliente). */
export interface Upstream {
  name: ServiceName;
  title: string;
  url: string;
}

const URL_VARIABLES: Record<ServiceName, keyof GatewayEnv> = {
  identity: 'IDENTITY_URL',
  scheduling: 'SCHEDULING_URL',
  clinical: 'CLINICAL_URL',
  inventory: 'INVENTORY_URL',
  engagement: 'ENGAGEMENT_URL',
  notification: 'NOTIFICATION_URL',
};

/** Monta a lista de serviços (na ordem do registro de @pulso/contracts) a partir do ambiente. */
export function buildUpstreams(config: GatewayEnv): Upstream[] {
  return SERVICE_NAMES.map((name) => ({
    name,
    title: SERVICES[name].title,
    url: String(config[URL_VARIABLES[name]]).replace(/\/+$/, ''),
  }));
}
