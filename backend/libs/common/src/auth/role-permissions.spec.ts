import {
  hasPermission,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLES,
  type Permission,
  type Role,
} from '@pulso/contracts';

/**
 * Matriz papel × permissão fixada (docs/16, seções 4 e 5). Mudou o mapa em
 * @pulso/contracts? Atualize aqui de propósito, conferindo com a especificação.
 */
const EXPECTED: Record<Role, Permission[]> = {
  DONOR: [
    'self:profile',
    'self:prescreening',
    'self:appointments',
    'self:donations',
    'self:gamification',
    'self:documents',
  ],
  COLLABORATOR: ['agenda:read', 'appointment:check-in', 'donor:read-summary'],
  NURSE: [
    'agenda:read',
    'appointment:check-in',
    'donor:read-summary',
    'prescreening:read-shared',
    'screening:perform',
    'donation:record',
  ],
  ADMIN: [
    'agenda:read',
    'donor:read-summary',
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

describe('ROLE_PERMISSIONS (@pulso/contracts)', () => {
  it('define exatamente os quatro papéis', () => {
    expect(Object.keys(ROLE_PERMISSIONS).sort()).toEqual([...ROLES].sort());
  });

  it.each(ROLES)('%s tem exatamente as permissões esperadas, sem repetição', (role) => {
    const granted = ROLE_PERMISSIONS[role];

    expect(new Set(granted).size).toBe(granted.length);
    expect([...granted].sort()).toEqual([...EXPECTED[role]].sort());
  });

  it('confere a matriz completa com hasPermission', () => {
    for (const role of ROLES) {
      for (const permission of PERMISSIONS) {
        expect([role, permission, hasPermission(role, permission)]).toEqual([
          role,
          permission,
          EXPECTED[role].includes(permission),
        ]);
      }
    }
  });

  it('toda permissão declarada pertence a algum papel', () => {
    const granted = new Set(ROLES.flatMap((role) => ROLE_PERMISSIONS[role]));

    expect(PERMISSIONS.filter((permission) => !granted.has(permission))).toEqual([]);
  });

  it('segregação de funções: ADMIN não faz check-in, triagem nem registra doação', () => {
    for (const permission of [
      'appointment:check-in',
      'prescreening:read-shared',
      'screening:perform',
      'donation:record',
    ] as const) {
      expect(hasPermission('ADMIN', permission)).toBe(false);
    }
    expect(hasPermission('ADMIN', 'agenda:read')).toBe(true);
    expect(hasPermission('ADMIN', 'donor:read-summary')).toBe(true);
  });

  it('doador só tem permissões sobre os próprios recursos', () => {
    expect(ROLE_PERMISSIONS.DONOR.every((permission) => permission.startsWith('self:'))).toBe(true);
    expect(
      ROLES.filter((role) => role !== 'DONOR').some((role) =>
        ROLE_PERMISSIONS[role].some((permission) => permission.startsWith('self:')),
      ),
    ).toBe(false);
  });
});
