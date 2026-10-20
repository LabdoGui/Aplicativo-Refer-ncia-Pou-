/**
 * Aviso fixo da demonstração (fora do React, para não alterar as telas do app):
 * deixa claro que os dados são fictícios e permite recomeçar do zero.
 */
import { resetDemo } from '../index';

export function mountDemoBanner(): void {
  const bar = document.createElement('div');
  bar.setAttribute('role', 'note');
  bar.style.cssText = [
    'position:fixed',
    'left:50%',
    'transform:translateX(-50%)',
    'bottom:calc(76px + env(safe-area-inset-bottom))',
    'z-index:60',
    'display:flex',
    'align-items:center',
    'gap:8px',
    'max-width:calc(100vw - 24px)',
    'padding:6px 6px 6px 12px',
    'border-radius:999px',
    'background:rgba(28,25,23,.92)',
    'color:#fff',
    'font:500 12px/1.3 Inter Variable, system-ui, sans-serif',
    'box-shadow:0 4px 16px rgba(0,0,0,.18)',
  ].join(';');

  const text = document.createElement('span');
  text.textContent = 'Demonstração · dados fictícios, só neste aparelho';

  const reset = document.createElement('button');
  reset.type = 'button';
  reset.textContent = 'Recomeçar';
  reset.style.cssText =
    'border:0;border-radius:999px;padding:4px 10px;background:#fff;color:#1c1917;font:600 12px/1.3 inherit;cursor:pointer';
  reset.addEventListener('click', () => {
    if (window.confirm('Apagar tudo o que foi feito na demonstração e recomeçar?')) resetDemo();
  });

  const close = document.createElement('button');
  close.type = 'button';
  close.setAttribute('aria-label', 'Fechar aviso da demonstração');
  close.textContent = '×';
  close.style.cssText =
    'border:0;background:transparent;color:#fff;font:600 16px/1 inherit;padding:2px 6px;cursor:pointer';
  close.addEventListener('click', () => bar.remove());

  bar.append(text, reset, close);
  document.body.append(bar);
}
