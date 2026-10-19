#!/usr/bin/env node
/**
 * Jornada de ponta a ponta do Pulso pelo NAVEGADOR (Playwright): os mesmos 22
 * passos do critério de aceite de scripts/e2e-journey.mjs, mas clicando nas
 * telas como uma pessoa faria. Confere também que nenhuma tela registra erro
 * no console e que a verificação pública do documento não expõe o nome.
 *
 * Pré-requisitos: a pilha no ar (docker compose up) com os dados de
 * demonstração e DEMO_EARLY_CHECK_IN=true (padrão), e o Chromium do Playwright
 * instalado uma vez: npx playwright install chromium
 *
 * Uso:
 *   npm run e2e:ui                                   # http://localhost:8080
 *   BASE_URL=http://localhost:5173 npm run e2e:ui    # frontend do Vite
 *   E2E_SCREENSHOTS=./capturas npm run e2e:ui        # uma captura por passo
 *   E2E_HEADED=1 npm run e2e:ui                      # com a janela visível
 *
 * Variáveis: PLAYWRIGHT_CHROMIUM_PATH aponta um Chromium já instalado.
 * Sai com código 1 no primeiro passo que falhar (com captura da tela).
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:8080').replace(/\/$/, '');
const SHOTS = process.env.E2E_SCREENSHOTS;
const DEMO_PASSWORD = 'Pulso@2026';
const DONOR_PASSWORD = 'Senha1234';
const CENTRO_UNIT_NAME = 'Pulso Unidade Centro';

if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
  headless: !process.env.E2E_HEADED,
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 860 },
  locale: 'pt-BR',
  timezoneId: 'America/Sao_Paulo',
  acceptDownloads: true,
});
const page = await context.newPage();
page.setDefaultTimeout(15_000);

const consoleErrors = [];
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(`${page.url()} :: ${message.text()}`);
});
page.on('pageerror', (error) => consoleErrors.push(`${page.url()} :: ${error.message}`));

let stepNumber = 0;
async function check(label, fn) {
  stepNumber += 1;
  const prefix = String(stepNumber).padStart(2);
  try {
    const detail = await fn();
    console.log(`  ✔ ${prefix}. ${label}${detail ? ` — ${detail}` : ''}`);
    if (SHOTS)
      await page.screenshot({ path: join(SHOTS, `${String(stepNumber).padStart(2, '0')}.png`) });
  } catch (error) {
    console.log(`  ✘ ${prefix}. ${label}\n      ${error.message.split('\n')[0]}`);
    if (SHOTS)
      await page.screenshot({ path: join(SHOTS, `falha-${stepNumber}.png`), fullPage: true });
    await browser.close();
    process.exit(1);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function login(email, password = DEMO_PASSWORD) {
  await page.goto(`${BASE_URL}/entrar`);
  await page.getByLabel('E-mail').fill(email);
  await page.locator('input[name=password]').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/entrar'));
}

/** Sai como faria outra pessoa no mesmo navegador: sem cookies de sessão. */
async function logout() {
  await context.clearCookies();
  await page.goto(`${BASE_URL}/`);
}

/** Dia e horário são blocos: o rádio fica oculto e a pessoa clica no bloco. */
const pickTile = (radio) => radio.locator('xpath=ancestor::label[1]').click();

/** Nome só com letras (regra do cadastro), diferente a cada execução. */
const suffix = [...String(Date.now() % 100000)].map((digit) => 'abcdefghij'[digit]).join('');
const donorName = `Teste Navegador ${suffix[0].toUpperCase()}${suffix.slice(1)}`;
const email = `e2e.ui.${Date.now()}@exemplo.test`;
const ctx = {};

console.log(`Jornada E2E pelo navegador em ${BASE_URL}\n`);

// --- Doador ----------------------------------------------------------------
await check('cadastrar um doador', async () => {
  // A página inicial mostra a situação pública dos estoques (sem login).
  await page.goto(`${BASE_URL}/`);
  await page.getByText('Como está o estoque de sangue').waitFor();
  await page.getByText(/Carregando a situação dos estoques/).waitFor({ state: 'hidden' });
  await page.getByRole('link', { name: 'Quero doar' }).first().click();
  await page.waitForURL(/\/cadastro/);
  await page.getByLabel('Nome completo').fill(donorName);
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Data de nascimento').fill('1992-05-20');
  await page.locator('input[name=password]').fill(DONOR_PASSWORD);
  await page.locator('input[name=confirmPassword]').fill(DONOR_PASSWORD);
  await page.locator('input[name=acceptTerms]').check();
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await page.waitForURL(/\/app/);
  await page.getByRole('heading', { name: /^Olá, / }).waitFor();
  return email;
});

await check('fazer login', async () => {
  await logout();
  await login(email, DONOR_PASSWORD);
  await page.getByRole('heading', { name: /^Olá, / }).waitFor();
  return new URL(page.url()).pathname;
});

await check('responder a pré-triagem', async () => {
  await page.goto(`${BASE_URL}/app/pre-triagem`);
  // Respostas que não disparam regras (doador sem impedimentos declarados).
  const answerYes = /pesa 50|sentindo bem|dormiu|alimentou/i;
  for (let index = 1; index <= 6; index++) {
    const region = page.getByRole('region', { name: new RegExp(`^Etapa ${index} de 6`) });
    await region.waitFor();
    const groups = region.getByRole('group');
    for (let g = 0; g < (await groups.count()); g++) {
      const group = groups.nth(g);
      if ((await group.getByRole('radio').count()) === 0) continue;
      const question = (await group.textContent()) ?? '';
      const answer = answerYes.test(question) ? 'Sim' : 'Não';
      await group.getByRole('radio', { name: answer, exact: true }).check();
    }
    if (index < 6) await region.getByRole('button', { name: 'Próxima' }).click();
  }
  await page.getByLabel('Compartilhar minhas respostas com a equipe da unidade').check();
  await page.getByRole('button', { name: 'Ver resultado' }).click();
  await page.getByText('Pode seguir para o agendamento').waitFor();
  await page
    .getByText(/Esta avaliação é apenas informativa/)
    .first()
    .waitFor();
  return 'resultado informativo favorável, compartilhado com a equipe';
});

await check('escolher uma unidade', async () => {
  await page.goto(`${BASE_URL}/app/agendar`);
  await page.getByRole('radio', { name: new RegExp(`^${CENTRO_UNIT_NAME}`) }).check();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('region', { name: 'Escolha o dia' }).waitFor();
  return CENTRO_UNIT_NAME;
});

await check('escolher a data', async () => {
  const day = page
    .getByRole('group', { name: 'Dias disponíveis' })
    .locator('input[type=radio]:not([disabled])')
    .first();
  ctx.date = await day.getAttribute('value');
  const label = await day.getAttribute('aria-label');
  await pickTile(day);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('region', { name: 'Escolha o horário' }).waitFor();
  return label;
});

await check('escolher o horário', async () => {
  const slot = page
    .getByRole('group', { name: 'Horários disponíveis' })
    .locator('input[type=radio]:not([disabled])')
    .first();
  const label = await slot.getAttribute('aria-label');
  await pickTile(slot);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('region', { name: 'Confira e confirme' }).waitFor();
  return label;
});

await check('confirmar o agendamento', async () => {
  await page.getByRole('button', { name: 'Confirmar agendamento' }).click();
  await page.waitForURL((url) => /^\/app\/agendamentos\/[0-9a-f-]+$/.test(url.pathname));
  await page
    .getByText(/AG-[A-Z0-9]{6}/)
    .first()
    .waitFor();
  ctx.code = (await page.locator('main').innerText()).match(/AG-[A-Z0-9]{6}/)[0];
  return `código ${ctx.code}`;
});

// --- Enfermagem ------------------------------------------------------------
await check('entrar como enfermeiro', async () => {
  await logout();
  await login('enfermeiro@demo.com');
  await page.waitForURL(/\/equipe/);
  return 'enfermeiro@demo.com';
});

await check('visualizar o agendamento na agenda da unidade', async () => {
  await page.getByLabel('Unidade').selectOption({ label: CENTRO_UNIT_NAME });
  await page.getByLabel('Dia').fill(ctx.date);
  await page.getByRole('row', { name: new RegExp(donorName) }).waitFor();
  return `${donorName} em ${ctx.date}`;
});

await check('realizar a triagem', async () => {
  await page.getByRole('button', { name: `Fazer check-in de ${donorName}` }).click();
  await page.getByText(`Check-in de ${donorName} registrado.`).waitFor();
  await page.getByRole('link', { name: `Abrir atendimento de ${donorName}` }).click();
  await page.getByRole('heading', { name: 'Pré-triagem do doador' }).waitFor();
  await page.getByText(/Respondida em/).waitFor();
  await page.getByLabel(/^Peso/).fill('72');
  await page.getByLabel(/^Pressão arterial/).fill('120/80');
  await page.getByLabel(/^Frequência cardíaca/).fill('70');
  await page.getByLabel(/^Temperatura/).fill('36,5');
  await page.getByLabel(/^Hemoglobina/).fill('14');
  await page.getByRole('radio', { name: 'Apto', exact: true }).check();
  await page.getByRole('button', { name: 'Registrar triagem' }).click();
  await page.getByRole('heading', { name: 'Registrar doação' }).waitFor();
  return 'check-in, pré-triagem compartilhada à vista e resultado apto';
});

await check('registrar a doação', async () => {
  await page.getByLabel('Tipo sanguíneo').selectOption('O_NEG');
  await page.getByLabel('Volume coletado (mL)').fill('450');
  await page.getByRole('button', { name: 'Registrar doação' }).click();
  await page.getByRole('heading', { name: 'Atendimento finalizado' }).waitFor();
  return 'atendimento finalizado';
});

// --- Doador de novo ---------------------------------------------------------
await check('entrar novamente como doador', async () => {
  await logout();
  await login(email, DONOR_PASSWORD);
  await page.getByRole('heading', { name: /^Olá, / }).waitFor();
  return email;
});

await check('visualizar a doação no histórico', async () => {
  await page.goto(`${BASE_URL}/app/doacoes`);
  await page.getByRole('region', { name: 'Histórico' }).getByRole('link').first().click();
  await page.waitForURL((url) => /^\/app\/doacoes\/[0-9a-f-]+$/.test(url.pathname));
  ctx.donationUrl = page.url();
  await page.getByText('450 mL').waitFor();
  const code = (await page.locator('main').innerText()).match(/DO-[A-Z0-9]{6}/)?.[0];
  assert(code, 'código da doação não exibido');
  return `doação ${code}, 450 mL`;
});

await check('receber pontos', async () => {
  await page.goto(`${BASE_URL}/app/conquistas`);
  const level = page.getByRole('region', { name: 'Seu nível' });
  await level.getByText('100', { exact: true }).waitFor();
  await level.getByText('Doador', { exact: true }).first().waitFor();
  return '100 pontos, nível Doador';
});

await check('desbloquear conquista', async () => {
  const badge = page
    .getByRole('region', { name: 'Suas conquistas' })
    .getByRole('listitem')
    .filter({ hasText: 'Primeira Doação' });
  await badge.getByText(/Conquistada em/).waitFor();
  return 'Primeira Doação';
});

await check('gerar documento', async () => {
  await page.goto(ctx.donationUrl);
  const item = page.getByRole('listitem').filter({ hasText: 'Declaração de doação' });
  await item.getByRole('button', { name: 'Gerar documento' }).click();
  await item.getByRole('button', { name: 'Visualizar PDF' }).waitFor();
  const code = (await item.innerText()).match(/PUL-[A-Z0-9]{5}-[A-Z0-9]{5}/)?.[0];
  assert(code, 'código de verificação não exibido');
  const popup = page.waitForEvent('popup');
  await item.getByRole('button', { name: 'Visualizar PDF' }).click();
  // O PDF abre numa nova aba (blob gerado a partir da resposta autenticada; sem
  // visualizador de PDF, o Chromium headless o trata como download).
  const viewer = await popup;
  await viewer.close();
  // Verificação pública, sem login: confirma o documento só com as iniciais.
  const verify = await context.newPage();
  await verify.goto(`${BASE_URL}/verificar/${code}`);
  await verify
    .getByText(/autêntic/i)
    .first()
    .waitFor();
  const text = await verify.locator('main').innerText();
  await verify.close();
  assert(!text.includes(donorName), 'a verificação pública expõe o nome completo');
  return `PDF aberto; código ${code} verificado sem expor o nome`;
});

// --- Administração -----------------------------------------------------------
await check('entrar como administrador', async () => {
  await logout();
  await login('admin@demo.com');
  await page.waitForURL(/\/admin$/);
  return 'admin@demo.com';
});

await check('visualizar o dashboard', async () => {
  await page.getByText('Doadores cadastrados').waitFor();
  return 'indicadores do período';
});

await check('visualizar o estoque', async () => {
  await page.goto(`${BASE_URL}/admin/estoque`);
  await page.getByRole('heading', { name: 'Níveis por tipo' }).waitFor();
  return 'níveis por tipo sanguíneo';
});

await check('adicionar e remover estoque', async () => {
  const dialog = page.getByRole('dialog');
  const register = async (kind, quantity, reason) => {
    await page.getByRole('button', { name: 'Registrar movimentação' }).first().click();
    await dialog.getByRole('button', { name: kind, exact: true }).click();
    await dialog.getByLabel('Tipo sanguíneo').selectOption('O_NEG');
    await dialog.getByLabel('Quantidade (bolsas)').fill(String(quantity));
    await dialog.getByLabel('Motivo').selectOption(reason);
    await dialog.getByRole('button', { name: `Registrar ${kind.toLowerCase()}` }).click();
    await dialog.waitFor({ state: 'hidden' });
    return page
      .getByText(/registrada\. Saldo atual: \d+/)
      .last()
      .innerText();
  };
  const entry = await register('Entrada', 5, 'PROCESSED_COLLECTION');
  const exit = await register('Saída', 2, 'HOSPITAL_DISTRIBUTION');
  const balance = (message) => Number(message.match(/Saldo atual: (\d+)/)[1]);
  assert(balance(exit) === balance(entry) - 2, `saldos inconsistentes: ${entry} / ${exit}`);
  return `O−: ${balance(entry) - 5} → ${balance(entry)} → ${balance(exit)}`;
});

await check('visualizar os gráficos', async () => {
  await page.goto(`${BASE_URL}/admin`);
  const charts = page.locator('.recharts-surface');
  await charts.first().waitFor();
  return `${await charts.count()} gráficos no dashboard`;
});

await check('visualizar o histórico', async () => {
  await page.goto(`${BASE_URL}/admin/estoque`);
  const movements = page.getByRole('table').last();
  await movements.getByRole('row').nth(1).waitFor();
  await page.goto(`${BASE_URL}/admin/auditoria`);
  await page.getByRole('table').getByRole('row').nth(1).waitFor();
  return 'movimentações do estoque e trilha de auditoria';
});

await browser.close();

if (consoleErrors.length > 0) {
  console.log('\nErros no console do navegador:');
  for (const error of consoleErrors) console.log(`  - ${error}`);
  process.exit(1);
}
console.log(
  `\n${stepNumber}/22 passos concluídos pelo navegador, sem erros no console (${BASE_URL}).`,
);
