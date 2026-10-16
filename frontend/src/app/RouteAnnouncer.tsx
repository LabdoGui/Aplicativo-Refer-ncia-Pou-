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
    // As páginas definem document.title em efeitos próprios, que rodam antes deste.
    setMessage(document.title);
  }, [pathname]);

  return (
    <p aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </p>
  );
}
