import { Megaphone } from 'lucide-react';
import { BLOOD_TYPE_LABELS, type CampaignView } from '@pulso/contracts';
import { Alert, Badge, Button, ButtonLink, Card } from '@/components/ui';
import { useCampaigns } from '@/features/donor/api';
import { formatDate, todayIso } from '@/lib/format';

/** Campanhas vigentes, com atalho para agendar pela campanha. */
export function CampaignsSection({ canBook }: { canBook: boolean }) {
  const campaigns = useCampaigns();
  const today = todayIso();
  const current = (campaigns.data ?? []).filter((c) => c.active && c.endsAt >= today);

  if (campaigns.isLoading) return null;
  if (campaigns.error) {
    return (
      <Alert
        tone="info"
        title="Campanhas indisponíveis no momento"
        actions={
          <Button variant="outline" size="sm" onClick={() => campaigns.refetch()}>
            Tentar novamente
          </Button>
        }
      />
    );
  }
  if (current.length === 0) return null;

  return (
    <section aria-labelledby="campanhas">
      <h2 id="campanhas" className="text-lg font-bold text-ink">
        Campanhas ativas
      </h2>
      <ul className="mt-3 grid gap-3 md:grid-cols-2">
        {current.map((campaign) => (
          <CampaignCard key={campaign.id} campaign={campaign} canBook={canBook} today={today} />
        ))}
      </ul>
    </section>
  );
}

function CampaignCard({
  campaign,
  canBook,
  today,
}: {
  campaign: CampaignView;
  canBook: boolean;
  today: string;
}) {
  const period =
    campaign.startsAt > today
      ? `De ${formatDate(campaign.startsAt)} a ${formatDate(campaign.endsAt)}`
      : `Até ${formatDate(campaign.endsAt)}`;
  return (
    <Card as="li" className="flex flex-col gap-3">
      <div className="flex gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-carmim-50 text-carmim-700">
          <Megaphone aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0">
          <h3 className="font-bold text-ink">{campaign.title}</h3>
          <p className="text-sm text-ink-muted">
            {campaign.unit?.name ?? 'Todas as unidades'} · {period}
          </p>
        </div>
      </div>
      <p className="text-sm text-ink">{campaign.description}</p>
      <div>
        <p className="sr-only">Tipos sanguíneos:</p>
        <ul className="flex flex-wrap gap-1.5">
          {campaign.bloodTypes.length === 0 ? (
            <li>
              <Badge>Todos os tipos</Badge>
            </li>
          ) : (
            campaign.bloodTypes.map((type) => (
              <li key={type}>
                <Badge tone="brand">{BLOOD_TYPE_LABELS[type]}</Badge>
              </li>
            ))
          )}
        </ul>
      </div>
      {canBook && (
        <ButtonLink
          to={`/app/agendar?campanha=${campaign.id}`}
          variant="outline"
          size="sm"
          className="mt-auto self-start"
        >
          Agendar pela campanha
        </ButtonLink>
      )}
    </Card>
  );
}
