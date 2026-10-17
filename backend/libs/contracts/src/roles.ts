/**
 * Papéis e permissões do Pulso.
 *
 * Os quatro papéis são fixos, por isso ficam em código (versionado e testado)
 * em vez de tabelas `roles`/`permissions` (ver docs/16, decisão D5).
 */
export const ROLES = ['DONOR', 'COLLABORATOR', 'NURSE', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  DONOR: 'Doador',
  COLLABORATOR: 'Colaborador',
  NURSE: 'Enfermeiro',
  ADMIN: 'Administrador',
};

export const PERMISSIONS = [
  // Doador: apenas os próprios recursos
  'self:profile',
  'self:prescreening',
  'self:appointments',
  'self:donations',
  'self:gamification',
  'self:documents',
  // Equipe da unidade
  'agenda:read',
  'appointment:check-in',
  'donor:read-summary',
  'prescreening:read-shared',
  'screening:perform',
  'donation:record',
  // Administração
  'unit:manage',
  'schedule:manage',
  'campaign:manage',
  'appointment:manage',
  'user:manage',
  'donation:read-all',
  'inventory:read',
  'inventory:move',
  'gamification:manage',
  'hours:review',
  'settings:manage',
  'analytics:read',
  'audit:read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const COLLABORATOR_PERMISSIONS: Permission[] = [
  'agenda:read',
  'appointment:check-in',
  'donor:read-summary',
];

/** Permissões de equipe que o administrador também tem (consulta, sem atendimento). */
const ADMIN_STAFF_PERMISSIONS: Permission[] = ['agenda:read', 'donor:read-summary'];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  DONOR: [
    'self:profile',
    'self:prescreening',
    'self:appointments',
    'self:donations',
    'self:gamification',
    'self:documents',
  ],
  COLLABORATOR: COLLABORATOR_PERMISSIONS,
  NURSE: [
    ...COLLABORATOR_PERMISSIONS,
    'prescreening:read-shared',
    'screening:perform',
    'donation:record',
  ],
  // O administrador NÃO faz check-in, triagem nem lê dados clínicos (segregação de funções):
  // check-in e falta são trabalho da equipe da unidade (docs/16, seção 4).
  ADMIN: [
    ...ADMIN_STAFF_PERMISSIONS,
    'unit:manage',
    'schedule:manage',
    'campaign:manage',
    'appointment:manage',
    'user:manage',
    'donation:read-all',
    'inventory:read',
    'inventory:move',
    'gamification:manage',
    'hours:review',
    'settings:manage',
    'analytics:read',
    'audit:read',
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Área inicial de cada papel no frontend após o login. */
export const ROLE_HOME: Record<Role, string> = {
  DONOR: '/app',
  COLLABORATOR: '/equipe',
  NURSE: '/equipe',
  ADMIN: '/admin',
};
