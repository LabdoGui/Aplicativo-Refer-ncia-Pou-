/**
 * Registro dos serviços do back-end. Fonte única de nomes, portas padrão e
 * prefixos de rota que o gateway encaminha para cada serviço.
 */
export const SERVICE_NAMES = [
  'identity',
  'scheduling',
  'clinical',
  'inventory',
  'engagement',
  'notification',
] as const;
export type ServiceName = (typeof SERVICE_NAMES)[number];

export interface ServiceDescriptor {
  name: ServiceName;
  title: string;
  defaultPort: number;
  /** Prefixos (após /api/v1) roteados pelo gateway para este serviço. */
  routePrefixes: readonly string[];
}

export const API_PREFIX = 'api/v1';

export const SERVICES: Record<ServiceName, ServiceDescriptor> = {
  identity: {
    name: 'identity',
    title: 'Identidade e acesso',
    defaultPort: 3001,
    routePrefixes: ['auth', 'users', 'consents', 'admin/users', '.well-known'],
  },
  scheduling: {
    name: 'scheduling',
    title: 'Agendamento',
    defaultPort: 3002,
    routePrefixes: ['units', 'appointments', 'agenda', 'campaigns', 'admin/appointments'],
  },
  clinical: {
    name: 'clinical',
    title: 'Triagem, doação e documentos',
    defaultPort: 3003,
    routePrefixes: [
      'screenings',
      'attendances',
      'donations',
      'documents',
      'clinical-settings',
      'screening-config',
      'admin/donations',
    ],
  },
  inventory: {
    name: 'inventory',
    title: 'Banco de sangue',
    defaultPort: 3004,
    routePrefixes: ['blood-inventory'],
  },
  engagement: {
    name: 'engagement',
    title: 'Gamificação e horas complementares',
    defaultPort: 3005,
    routePrefixes: [
      'gamification',
      'complementary-hours',
      'institutions',
      'admin/complementary-hours',
      'admin/achievements',
      'admin/gamification',
      'admin/institutions',
    ],
  },
  notification: {
    name: 'notification',
    title: 'Notificações',
    defaultPort: 3006,
    routePrefixes: ['notifications'],
  },
};

export const GATEWAY_DEFAULT_PORT = 3000;
