import { classifyRateLimit, FixedWindowRateLimiter } from './rate-limiter';

function createLimiter(max: number, windowMs = 60_000) {
  const clock = { now: 1_000_000 };
  const limiter = new FixedWindowRateLimiter({ windowMs, max }, () => clock.now);
  return { limiter, clock };
}

describe('FixedWindowRateLimiter', () => {
  it('permite até o limite e bloqueia a partir daí', () => {
    const { limiter } = createLimiter(3);
    expect(limiter.hit('1.1.1.1')).toMatchObject({ allowed: true, remaining: 2, limit: 3 });
    expect(limiter.hit('1.1.1.1')).toMatchObject({ allowed: true, remaining: 1 });
    expect(limiter.hit('1.1.1.1')).toMatchObject({ allowed: true, remaining: 0 });
    expect(limiter.hit('1.1.1.1')).toMatchObject({ allowed: false, remaining: 0 });
    expect(limiter.hit('1.1.1.1')).toMatchObject({ allowed: false, remaining: 0 });
  });

  it('conta cada chave separadamente', () => {
    const { limiter } = createLimiter(1);
    expect(limiter.hit('a').allowed).toBe(true);
    expect(limiter.hit('b').allowed).toBe(true);
    expect(limiter.hit('a').allowed).toBe(false);
  });

  it('informa os segundos restantes da janela (arredondados para cima, mínimo 1)', () => {
    const { limiter, clock } = createLimiter(1, 60_000);
    limiter.hit('a');
    clock.now += 15_500;
    expect(limiter.hit('a')).toMatchObject({ allowed: false, resetSeconds: 45 });
    clock.now += 44_000; // faltam 500 ms
    expect(limiter.hit('a')).toMatchObject({ allowed: false, resetSeconds: 1 });
  });

  it('libera de novo quando a janela termina', () => {
    const { limiter, clock } = createLimiter(2, 1_000);
    limiter.hit('a');
    limiter.hit('a');
    expect(limiter.hit('a').allowed).toBe(false);
    clock.now += 1_000;
    expect(limiter.hit('a')).toMatchObject({ allowed: true, remaining: 1 });
  });

  it('a janela começa no primeiro acesso de cada chave', () => {
    const { limiter, clock } = createLimiter(1, 1_000);
    limiter.hit('a');
    clock.now += 600;
    limiter.hit('b');
    clock.now += 500; // a: janela encerrada; b: ainda dentro
    expect(limiter.hit('a').allowed).toBe(true);
    expect(limiter.hit('b').allowed).toBe(false);
  });

  it('remove apenas janelas encerradas na limpeza periódica', () => {
    const { limiter, clock } = createLimiter(5, 1_000);
    limiter.hit('antigo');
    clock.now += 700;
    limiter.hit('recente');
    clock.now += 300;
    expect(limiter.purgeExpired()).toBe(1);
    expect(limiter.size).toBe(1);
    clock.now += 700;
    expect(limiter.purgeExpired()).toBe(1);
    expect(limiter.size).toBe(0);
  });
});

describe('classifyRateLimit', () => {
  it.each([
    ['POST', '/api/v1/auth/login'],
    ['POST', '/api/v1/auth/register'],
    ['POST', '/api/v1/auth/refresh'],
    ['post', '/api/v1/auth/login/'],
    ['POST', '/API/V1/Auth//Login'],
    ['PATCH', '/api/v1/users/me/password'],
    ['DELETE', '/api/v1/users/me'],
  ])('%s %s → auth', (method, path) => {
    expect(classifyRateLimit(method, path)).toBe('auth');
  });

  it.each([
    ['GET', '/api/v1/auth/login'],
    ['POST', '/api/v1/auth/logout'],
    ['POST', '/api/v1/appointments'],
    ['GET', '/api/v1/health/services'],
    ['GET', '/api/docs'],
    ['GET', '/api/v1/users/%E0%A4%A'],
    ['GET', '/api/v1/users/me'],
    ['PATCH', '/api/v1/users/me'],
  ])('%s %s → default', (method, path) => {
    expect(classifyRateLimit(method, path)).toBe('default');
  });

  it('não limita o health check do próprio gateway', () => {
    expect(classifyRateLimit('GET', '/health')).toBe('exempt');
    expect(classifyRateLimit('HEAD', '/health')).toBe('exempt');
  });
});
