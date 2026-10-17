import { SERVICES, type ServiceDescriptor } from '@pulso/contracts';
import { createRouteResolver, resolveRoute } from './route-resolver';

describe('resolveRoute (registro oficial de serviços)', () => {
  it.each([
    ['/api/v1/auth/login', 'identity', 'auth'],
    ['/api/v1/users/me', 'identity', 'users'],
    ['/api/v1/.well-known/jwks.json', 'identity', '.well-known'],
    ['/api/v1/admin/users', 'identity', 'admin/users'],
    ['/api/v1/admin/users/123', 'identity', 'admin/users'],
    ['/api/v1/admin/appointments', 'scheduling', 'admin/appointments'],
    ['/api/v1/admin/donations/9', 'clinical', 'admin/donations'],
    ['/api/v1/admin/gamification/settings', 'engagement', 'admin/gamification'],
    ['/api/v1/units', 'scheduling', 'units'],
    ['/api/v1/blood-inventory/public', 'inventory', 'blood-inventory'],
    ['/api/v1/notifications/unread-count', 'notification', 'notifications'],
    ['/api/v1/attendances/fields', 'clinical', 'attendances'],
  ])('%s → %s', (path, service, prefix) => {
    expect(resolveRoute(path)).toEqual({ kind: 'proxy', service, prefix });
  });

  it('encaminha todos os prefixos declarados em SERVICES', () => {
    for (const descriptor of Object.values(SERVICES)) {
      for (const prefix of descriptor.routePrefixes) {
        expect(resolveRoute(`/api/v1/${prefix}`)).toMatchObject({ service: descriptor.name });
        expect(resolveRoute(`/api/v1/${prefix}/qualquer/coisa`)).toMatchObject({
          service: descriptor.name,
        });
      }
    }
  });

  it('não confunde prefixo com início de palavra', () => {
    expect(resolveRoute('/api/v1/usersx')).toEqual({ kind: 'local' });
    expect(resolveRoute('/api/v1/authentication')).toEqual({ kind: 'local' });
  });

  it('ignora maiúsculas, barras repetidas e barra final, como o Express', () => {
    expect(resolveRoute('/API/V1/Users/me')).toMatchObject({ service: 'identity' });
    expect(resolveRoute('/api/v1//users/')).toMatchObject({ service: 'identity' });
  });

  it('bloqueia rotas internas em qualquer grafia', () => {
    expect(resolveRoute('/api/v1/internal')).toEqual({ kind: 'blocked' });
    expect(resolveRoute('/api/v1/internal/stats')).toEqual({ kind: 'blocked' });
    expect(resolveRoute('/api/v1/INTERNAL/stats')).toEqual({ kind: 'blocked' });
    expect(resolveRoute('/api/v1//internal/stats')).toEqual({ kind: 'blocked' });
    expect(resolveRoute('/api/v1/%69nternal/stats')).toEqual({ kind: 'blocked' });
  });

  it('rejeita travessia de diretório e barras codificadas', () => {
    expect(resolveRoute('/api/v1/users/../internal/stats')).toEqual({ kind: 'invalid' });
    expect(resolveRoute('/api/v1/users/%2e%2e/internal/stats')).toEqual({ kind: 'invalid' });
    expect(resolveRoute('/api/v1/users/.')).toEqual({ kind: 'invalid' });
    expect(resolveRoute('/api/v1/users%2Finternal')).toEqual({ kind: 'invalid' });
    expect(resolveRoute('/api/v1/users%5Cinternal')).toEqual({ kind: 'invalid' });
    expect(resolveRoute('/api/v1/users/%E0%A4%A')).toEqual({ kind: 'invalid' });
  });

  it('deixa para o próprio gateway o que não é rota de serviço', () => {
    expect(resolveRoute('/health')).toEqual({ kind: 'local' });
    expect(resolveRoute('/api/v1/health/services')).toEqual({ kind: 'local' });
    expect(resolveRoute('/api/docs')).toEqual({ kind: 'local' });
    expect(resolveRoute('/api/docs-json')).toEqual({ kind: 'local' });
    expect(resolveRoute('/api/v1')).toEqual({ kind: 'local' });
    expect(resolveRoute('/api/v2/users/me')).toEqual({ kind: 'local' });
    expect(resolveRoute('/')).toEqual({ kind: 'local' });
  });
});

describe('createRouteResolver', () => {
  const service = (
    name: ServiceDescriptor['name'],
    routePrefixes: string[],
  ): ServiceDescriptor => ({ name, title: name, defaultPort: 1, routePrefixes });

  it('o prefixo mais longo vence, independentemente da ordem de declaração', () => {
    const resolve = createRouteResolver([
      service('scheduling', ['admin']),
      service('identity', ['admin/users']),
    ]);
    expect(resolve('/api/v1/admin/users/1')).toMatchObject({ service: 'identity' });
    expect(resolve('/api/v1/admin/units')).toMatchObject({ service: 'scheduling' });
  });

  it('falha cedo com prefixo duplicado entre serviços', () => {
    expect(() =>
      createRouteResolver([service('identity', ['users']), service('scheduling', ['users'])]),
    ).toThrow(/declarado por identity e scheduling/);
  });

  it('falha cedo se um serviço tentar expor rotas internas', () => {
    expect(() => createRouteResolver([service('identity', ['internal/stats'])])).toThrow(
      /rotas internas/,
    );
  });
});
