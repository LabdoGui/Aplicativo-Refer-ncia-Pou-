import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGetBlob } from '@/lib/api';

type PdfState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; url: string; popupBlocked: boolean }
  | { status: 'error'; error: unknown };

/**
 * Baixa o PDF autenticado (o token não vai na URL), cria um endereço local (blob:) e o
 * abre em nova aba. Se o navegador bloquear a aba, o endereço continua disponível para
 * os links "Abrir PDF" e "Baixar PDF". O endereço é liberado ao sair da tela.
 */
export function useDocumentPdf(documentId: string) {
  const [state, setState] = useState<PdfState>({ status: 'idle' });
  const urlRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  const openTab = (url: string): boolean => {
    const tab = window.open(url, '_blank');
    if (!tab) return false;
    tab.opener = null;
    return true;
  };

  const view = useCallback(async () => {
    if (urlRef.current) {
      setState({ status: 'ready', url: urlRef.current, popupBlocked: !openTab(urlRef.current) });
      return;
    }
    setState({ status: 'loading' });
    try {
      const blob = await apiGetBlob(`/documents/${documentId}/file`);
      const pdf =
        blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
      const url = URL.createObjectURL(pdf);
      urlRef.current = url;
      setState({ status: 'ready', url, popupBlocked: !openTab(url) });
    } catch (error) {
      setState({ status: 'error', error });
    }
  }, [documentId]);

  return { state, view };
}
