import { Alert } from '@/components/ui';

const SERVICE_LABELS: Record<string, string> = {
  identity: 'contas e doadores',
  scheduling: 'agendamentos',
  clinical: 'triagens e doações',
  inventory: 'estoque',
  engagement: 'gamificação',
};

/** Degradação parcial: o painel mostra o que respondeu e diz o que faltou. */
export function UnavailableAlert({ services }: { services: string[] }) {
  if (services.length === 0) return null;
  const names = services.map((service) => SERVICE_LABELS[service] ?? service).join(', ');
  return (
    <Alert tone="warn" title="Alguns dados não carregaram">
      Os serviços de {names} não responderam agora. Os demais números estão atualizados; tente de
      novo em instantes.
    </Alert>
  );
}
