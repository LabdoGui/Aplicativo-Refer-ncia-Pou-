import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Anuncia o título da nova página para leitores de tela após cada navegação
 * (em SPAs a troca de página não é percebida sem isso).
 */
export function RouteAnnouncer() {
  const { pathname } = useLocation();
  const previousPathname = useRef(pathname);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    // As páginas definem document.title nos próprios efeitos (useDocumentTitle), e a ordem
    // dos efeitos entre componentes irmãos não é garantida para este caso. Por isso a leitura
    // fica para a próxima tarefa, quando todos os efeitos desta renderização já rodaram.
    // Limpar antes garante um novo anúncio mesmo se o título se repetir.
    setMessage('');
    const timer = window.setTimeout(() => setMessage(document.title), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return (
    <p aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </p>
  );
}
