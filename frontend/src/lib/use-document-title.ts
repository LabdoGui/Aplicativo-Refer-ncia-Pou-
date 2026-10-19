import { useEffect } from 'react';

export const APP_TITLE = 'Pulso — Doe sangue. Mantenha a vida pulsando.';

/** Define o título da aba do navegador ("Página · Pulso"); sem título, usa o padrão. */
export function useDocumentTitle(title?: string): void {
  useEffect(() => {
    document.title = title ? `${title} · Pulso` : APP_TITLE;
  }, [title]);
}
