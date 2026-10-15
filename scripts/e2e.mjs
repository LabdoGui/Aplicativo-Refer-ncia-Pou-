/**
 * Teste de ponta a ponta no navegador (Chromium via playwright-core).
 * Fluxo: nova partida → cliques → melhoria → negócio → ação → recarrega a página
 * → confere que saldo, negócio e carteira foram preservados. Falha em qualquer erro de console.
 *
 * Uso: npm run build && npm run e2e
 * Variável CHROMIUM_PATH aponta para o executável (padrão: /opt/pw-browsers/chromium).
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const PORT = 4179;
const URL = `http://localhost:${PORT}/`;
const shotsDir = 'test-results';
mkdirSync(shotsDir, { recursive: true });

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = '/opt/pw-browsers';
  if (existsSync(join(base, 'chromium'))) {
    const p = join(base, 'chromium');
    if (!p.endsWith('/')) {
      // pode ser diretório (chromium-XXXX/chrome-linux/chrome) ou binário
      try {
        readdirSync(p);
      } catch {
        return p;
      }
    }
  }
  for (const d of existsSync(base) ? readdirSync(base) : []) {
    const c = join(base, d, 'chrome-linux', 'chrome');
    if (d.startsWith('chromium') && existsSync(c)) return c;
  }
  return undefined;
}

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe', detached: true });
const stopServer = () => {
  try {
    process.kill(-server.pid, 'SIGTERM'); // encerra o grupo inteiro (npx + vite)
  } catch {
    /* já encerrado */
  }
};
await new Promise((resolve, reject) => {
  const t = setTimeout(() => {
    stopServer();
    reject(new Error('preview não iniciou'));
  }, 20000);
  server.stdout.on('data', (d) => {
    if (String(d).includes(String(PORT))) {
      clearTimeout(t);
      resolve();
    }
  });
});

const errors = [];
const browser = await chromium.launch({ executablePath: findChromium() });
let failed = false;
const check = (cond, msg) => {
  console.log(`${cond ? '✔' : '✘'} ${msg}`);
  if (!cond) failed = true;
};

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(URL);
  await page.waitForSelector('.bank-card');
  await page.screenshot({ path: `${shotsDir}/01-inicio-celular.png` });

  const balanceText = () => page.locator('.bank-card .balance').innerText();
  check((await balanceText()).includes('10,00'), 'saldo inicial R$ 10,00');

  for (let i = 0; i < 15; i++) await page.locator('.tap-btn').click();
  check((await balanceText()).includes('25,00'), `15 cliques → R$ 25,00 (${await balanceText()})`);

  // Tutorial passo 1 → resgatar
  await page.getByRole('button', { name: /Resgatar/ }).first().click();
  check((await balanceText()).includes('30,00'), `recompensa do tutorial creditada (${await balanceText()})`);

  // Comprar melhoria "Clique aprimorado"
  await page.locator('.card', { hasText: 'Clique aprimorado' }).getByRole('button', { name: /Comprar/ }).click();
  check((await balanceText()).includes('15,00'), `melhoria comprada por R$ 15,00 (${await balanceText()})`);
  await page.locator('.tap-btn').click();
  check((await balanceText()).includes('17,00'), 'clique agora vale R$ 2,00');

  // Juntar dinheiro e abrir a Loja virtual
  for (let i = 0; i < 20; i++) await page.locator('.tap-btn').click();
  await page.getByRole('button', { name: 'Negócios' }).click();
  await page.getByRole('button', { name: /Abrir por R\$ 50,00/ }).click();
  await page.waitForSelector('text=Suas empresas');
  check(await page.locator('.card', { hasText: 'Loja virtual' }).locator('text=Nv 1').isVisible(), 'Loja virtual nível 1');
  await page.screenshot({ path: `${shotsDir}/02-negocios.png`, fullPage: false });

  // Investir na bolsa
  await page.getByRole('button', { name: 'Início' }).click();
  for (let i = 0; i < 40; i++) await page.locator('.tap-btn').click();
  await page.getByRole('button', { name: 'Bolsa' }).click();
  await page.locator('#qty-vrd').fill('1');
  await page.getByRole('button', { name: /^Comprar/ }).click();
  await page.waitForTimeout(300);
  check(await page.locator('.kv', { hasText: 'Preço médio' }).isVisible(), 'posição em VRDE3 aberta');
  await page.screenshot({ path: `${shotsDir}/03-bolsa.png` });

  // Patrimônio
  await page.getByRole('button', { name: 'Patrimônio' }).click();
  await page.waitForSelector('text=Histórico financeiro');
  check((await page.locator('.ledger-row').count()) >= 3, 'histórico financeiro registra as operações');
  await page.screenshot({ path: `${shotsDir}/04-patrimonio.png`, fullPage: true });

  // Captura o estado e "fecha" o jogo
  await page.getByRole('button', { name: 'Início' }).click();
  await page.waitForTimeout(400);
  const before = await balanceText();
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForTimeout(800);
  await page.close();

  const page2 = await context.newPage();
  page2.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page2.on('pageerror', (e) => errors.push(String(e)));
  await page2.goto(URL);
  await page2.waitForSelector('.bank-card');
  const after = await page2.locator('.bank-card .balance').innerText();
  const num = (t) => Number(t.replace(/[^\d,]/g, '').replace(',', '.'));
  check(num(after) >= num(before) && num(after) < num(before) + 5, `saldo preservado após reabrir (${before} → ${after})`);
  await page2.getByRole('button', { name: 'Negócios' }).click();
  check(await page2.locator('.card', { hasText: 'Loja virtual' }).locator('text=Nv 1').isVisible(), 'negócio preservado após reabrir');
  await page2.getByRole('button', { name: 'Bolsa' }).click();
  check(await page2.locator('text=1 em carteira').isVisible(), 'ação preservada após reabrir');

  // Segunda aba bloqueada
  const page3 = await context.newPage();
  await page3.goto(URL);
  await page3.waitForTimeout(800);
  check(await page3.locator('text=já está aberto em outra aba').isVisible(), 'segunda aba é bloqueada (protege o save)');
  await page3.close();

  // Desktop
  const desk = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  await page2.close();
  await desk.goto(URL);
  await desk.waitForSelector('.bank-card');
  await desk.screenshot({ path: `${shotsDir}/05-desktop.png` });
  await desk.goto(`${URL}#negocios`);
  await desk.waitForTimeout(300);
  await desk.screenshot({ path: `${shotsDir}/06-desktop-negocios.png` });

  // Overflow horizontal no celular
  const p4 = await context.newPage();
  await desk.close();
  for (const tab of ['inicio', 'negocios', 'bolsa', 'cripto', 'imoveis', 'patrimonio', 'missoes', 'conquistas']) {
    await p4.goto(`${URL}#${tab}`);
    await p4.waitForSelector('main');
    await p4.waitForTimeout(150);
    const overflow = await p4.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(overflow <= 0, `sem rolagem horizontal em #${tab} (${overflow}px)`);
  }
  await p4.goto(`${URL}#cripto`);
  await p4.waitForTimeout(300);
  await p4.screenshot({ path: `${shotsDir}/07-cripto.png` });
  await p4.goto(`${URL}#imoveis`);
  await p4.waitForTimeout(300);
  await p4.screenshot({ path: `${shotsDir}/08-imoveis.png` });

  // PWA: manifesto válido, service worker ativo e jogo abrindo SEM internet com o progresso salvo.
  const pwaCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pw = await pwaCtx.newPage();
  await pw.goto(URL);
  await pw.waitForSelector('.bank-card');
  const manifest = await pw.evaluate(async () => (await fetch(document.querySelector('link[rel=manifest]').href)).json());
  check(manifest.display === 'standalone' && manifest.icons.length >= 2, 'manifesto do app válido (tela cheia, ícones)');
  await pw.evaluate(() => navigator.serviceWorker.ready);
  await pw.reload();
  await pw.waitForSelector('.bank-card');
  check(await pw.evaluate(() => !!navigator.serviceWorker.controller), 'service worker ativo');
  for (let i = 0; i < 7; i++) await pw.locator('.tap-btn').click();
  await pw.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await pw.waitForTimeout(600);
  const onlineBal = await pw.locator('.bank-card .balance').innerText();
  await pwaCtx.setOffline(true);
  await pw.reload();
  await pw.waitForSelector('.bank-card', { timeout: 8000 });
  const offlineBal = await pw.locator('.bank-card .balance').innerText();
  check(offlineBal === onlineBal, `abre sem internet com o progresso salvo (${onlineBal} → ${offlineBal})`);
  await pwaCtx.close();

  check(errors.length === 0, `sem erros de console${errors.length ? ': ' + errors.join(' | ') : ''}`);
} catch (e) {
  console.error(e);
  failed = true;
} finally {
  await browser.close();
  stopServer();
}
process.exit(failed ? 1 : 0);
