import { useEffect } from 'react';

export const APP_TITLE = 'SangueConecta — Conectando doadores a vidas que precisam de ajuda.';

/** Define o título da aba do navegador ("Página · SangueConecta"); sem título, usa o padrão. */
export function useDocumentTitle(title?: string): void {
  useEffect(() => {
    document.title = title ? `${title} · SangueConecta` : APP_TITLE;
  }, [title]);
}
