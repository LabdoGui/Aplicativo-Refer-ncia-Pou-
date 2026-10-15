/** Gera os ícones PNG do app a partir de scripts/icon.svg (usa o Chromium do playwright-core). */
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const svg = readFileSync('scripts/icon.svg', 'utf8');
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage();
// [arquivo, tamanho, escala do desenho] — "maskable" encolhe o desenho para caber na área segura (80%).
for (const [file, size, scale] of [
  ['apple-touch-icon.png', 180, 1],
  ['icon-192.png', 192, 1],
  ['icon-512.png', 512, 1],
  ['icon-maskable-512.png', 512, 0.8],
]) {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(
    `<html><body style="margin:0;background:#0a0d12;display:grid;place-items:center;width:${size}px;height:${size}px">` +
      `<div style="width:${size * scale}px;height:${size * scale}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body></html>`,
  );
  await p.screenshot({ path: `public/icons/${file}`, omitBackground: false });
}
await b.close();
console.log('ícones gerados em public/icons/');
