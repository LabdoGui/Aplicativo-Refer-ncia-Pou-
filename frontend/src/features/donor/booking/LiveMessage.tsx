import { useEffect, useState, type ReactNode } from 'react';

/**
 * Região aria-live que já existe no DOM antes da mensagem: o conteúdo entra logo
 * depois da montagem, então leitores de tela anunciam mesmo quando a mensagem
 * chega junto com a página (ex.: "Agendamento confirmado" após o redirecionamento).
 */
export function LiveMessage({ children, className }: { children: ReactNode; className?: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 50);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div aria-live="polite" className={className}>
      {ready ? children : null}
    </div>
  );
}
