import { useQuery } from '@tanstack/react-query';
import type { DocumentVerification, PublicStats } from '@pulso/contracts';
import { apiGet } from '@/lib/api';

export const publicFeatureKeys = {
  stats: ['public', 'stats'] as const,
  verification: (code: string) => ['public', 'document-verification', code] as const,
};

/** Números públicos da página inicial (sem token; cada parte pode vir null). */
export const usePublicStats = () =>
  useQuery({
    queryKey: publicFeatureKeys.stats,
    queryFn: ({ signal }) => apiGet<PublicStats>('/dashboard/public-stats', { signal }),
    staleTime: 60_000,
  });

/** Verificação pública de um documento pelo código (sem token). */
export const useDocumentVerification = (code: string | undefined) =>
  useQuery({
    queryKey: publicFeatureKeys.verification(code ?? ''),
    queryFn: ({ signal }) =>
      apiGet<DocumentVerification>(`/documents/verify/${encodeURIComponent(code ?? '')}`, {
        signal,
      }),
    enabled: Boolean(code),
    staleTime: 5 * 60_000,
  });
