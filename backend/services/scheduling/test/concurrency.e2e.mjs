#!/usr/bin/env node
/**
 * Teste de concorrência do agendamento (Fase 5: "sem sobrealocação").
 *
 * Cadastra N doadores descartáveis, escolhe uma vaga ainda vazia e dispara N
 * reservas SIMULTÂNEAS nela. Passa se exatamente `capacidade` reservas forem
 * aceitas (201) e as demais recusadas com 409 SLOT_FULL, e se a vaga terminar
 * com 0 lugares. No fim, cancela as reservas e exclui as contas descartáveis.
 *
 * Uso (serviços acessados diretamente, sem o gateway, para não esbarrar no
 * rate limit das rotas de autenticação):
 *
 *   node backend/services/scheduling/test/concurrency.e2e.mjs
 *
 * Variáveis (opcionais):
 *   SCHEDULING_URL  padrão http://127.0.0.1:3002   (serviço local: http://127.0.0.1:4002)
 *   IDENTITY_URL    padrão http://127.0.0.1:3001
 *   PARALLEL        padrão 12 (reservas simultâneas)
 *   UNIT_NAME       trecho do nome da unidade (padrão: "Centro")
 */
const SCHEDULING_URL = process.env.SCHEDULING_URL ?? 'http://127.0.0.1:3002';
const IDENTITY_URL = process.env.IDENTITY_URL ?? 'http://127.0.0.1:3001';
const PARALLEL = Number(process.env.PARALLEL ?? 12);
const UNIT_NAME = process.env.UNIT_NAME ?? 'Centro';
const PASSWORD = 'Senha1234';

async function call(base, path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${base}/api/v1${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

function localDate(offsetDays) {
  const date = new Date(Date.now() + offsetDays * 86_400_000);
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

async function main() {
  const units = await call(SCHEDULING_URL, '/units');
  const unit = units.body.find((u) => u.name.includes(UNIT_NAME)) ?? units.body[0];
  if (!unit) throw new Error('Nenhuma unidade ativa encontrada');

  const availability = await call(
    SCHEDULING_URL,
    `/appointments/availability?unitId=${unit.id}&from=${localDate(1)}&to=${localDate(14)}`,
  );
  const slot = availability.body.days
    .flatMap((day) => day.slots)
    .find((s) => s.remaining === s.capacity && s.capacity < PARALLEL);
  if (!slot)
    throw new Error('Nenhuma vaga vazia com capacidade menor que PARALLEL nos próximos 14 dias');
  console.log(
    `Unidade: ${unit.name} | vaga ${slot.startsAt} | capacidade ${slot.capacity} | ${PARALLEL} reservas simultâneas`,
  );

  const stamp = Date.now();
  const donors = await Promise.all(
    Array.from({ length: PARALLEL }, async (_, index) => {
      const registered = await call(IDENTITY_URL, '/auth/register', {
        method: 'POST',
        body: {
          name: 'Doador Teste Concorrencia',
          email: `concorrencia.${stamp}.${index}@exemplo.test`,
          password: PASSWORD,
          birthDate: '1990-01-01',
          acceptTerms: true,
        },
      });
      if (registered.status !== 201)
        throw new Error(`Cadastro falhou: ${JSON.stringify(registered.body)}`);
      return registered.body.accessToken;
    }),
  );

  // Todas as reservas partem juntas.
  const results = await Promise.all(
    donors.map((token) =>
      call(SCHEDULING_URL, '/appointments', {
        method: 'POST',
        token,
        body: { unitId: unit.id, startsAt: slot.startsAt },
      }).then((result) => ({ ...result, token })),
    ),
  );
  const accepted = results.filter((r) => r.status === 201);
  const full = results.filter((r) => r.status === 409 && r.body?.code === 'SLOT_FULL');
  const other = results.filter(
    (r) => r.status !== 201 && !(r.status === 409 && r.body?.code === 'SLOT_FULL'),
  );

  const after = await call(
    SCHEDULING_URL,
    `/appointments/availability?unitId=${unit.id}&from=${slot.startsAt.slice(0, 10)}&to=${slot.startsAt.slice(0, 10)}`,
  );
  const remaining = after.body.days
    .flatMap((day) => day.slots)
    .find((s) => s.startsAt === slot.startsAt)?.remaining;

  console.log(
    `Aceitas: ${accepted.length} | lotado (409 SLOT_FULL): ${full.length} | outras: ${other.length} | restantes: ${remaining}`,
  );
  for (const r of other) console.log('  resposta inesperada:', r.status, JSON.stringify(r.body));

  // Limpeza: devolve a vaga e anonimiza as contas descartáveis.
  await Promise.all(
    accepted.map((r) =>
      call(SCHEDULING_URL, `/appointments/${r.body.id}/cancel`, {
        method: 'PATCH',
        token: r.token,
        body: {},
      }),
    ),
  );
  await Promise.all(
    donors.map((token) =>
      call(IDENTITY_URL, '/users/me', { method: 'DELETE', token, body: { password: PASSWORD } }),
    ),
  );

  const ok =
    accepted.length === slot.capacity &&
    full.length === PARALLEL - slot.capacity &&
    remaining === 0;
  console.log(
    ok ? 'OK: nenhuma sobrealocação.' : 'FALHOU: a capacidade da vaga não foi respeitada.',
  );
  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
