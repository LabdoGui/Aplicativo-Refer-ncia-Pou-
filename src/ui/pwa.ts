/** Recursos de app instalável (PWA): funcionamento offline, armazenamento persistente e detecção do iPhone. */

function isEmbedded(): boolean {
  try {
    return window.top !== window.self;
  } catch {
    return true;
  }
}

/** Registra o service worker só no app hospedado (não em arquivo local nem dentro de outra página). */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || isEmbedded()) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* sem service worker o jogo continua funcionando online */
    });
  });
}

/** Pede ao navegador para não apagar o save quando faltar espaço. */
export function requestPersistentStorage(): void {
  try {
    void navigator.storage?.persist?.();
  } catch {
    /* não suportado */
  }
}

/** Rodando como app instalado (aberto pelo ícone da Tela de Início)? */
export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

/** Mostrar a dica "Adicionar à Tela de Início"? Só no iPhone/iPad, no navegador, fora de páginas incorporadas. */
export function shouldShowInstallHint(): boolean {
  if (!isIOS() || isStandalone() || isEmbedded()) return false;
  try {
    return localStorage.getItem('tycoon-empire:install-hint-dismissed') !== '1';
  } catch {
    return true;
  }
}

export function dismissInstallHint(): void {
  try {
    localStorage.setItem('tycoon-empire:install-hint-dismissed', '1');
  } catch {
    /* sem armazenamento: some só nesta sessão */
  }
}
