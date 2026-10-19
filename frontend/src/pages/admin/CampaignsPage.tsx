import { useEffect, useState } from 'react';
import { Megaphone, Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import {
  BLOOD_TYPES,
  BLOOD_TYPE_LABELS,
  type BloodType,
  type CampaignView,
} from '@pulso/contracts';
import {
  applyApiFieldErrors,
  CheckboxField,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/form';
import {
  Badge,
  type BadgeTone,
  Button,
  Dialog,
  EmptyState,
  PageHeader,
  ProblemAlert,
  QueryState,
} from '@/components/ui';
import { unitOptions, useAllUnits } from '@/features/admin/units';
import { useAllCampaigns, useSaveCampaign } from '@/features/admin-ops/api';
import { formatDate, todayIso } from '@/lib/format';
import { useDocumentTitle } from '@/lib/use-document-title';

function situation(campaign: CampaignView): { label: string; tone: BadgeTone } {
  const today = todayIso();
  if (!campaign.active) return { label: 'Inativa', tone: 'neutral' };
  if (campaign.endsAt < today) return { label: 'Encerrada', tone: 'neutral' };
  if (campaign.startsAt > today) return { label: 'Agendada', tone: 'info' };
  return { label: 'Ativa', tone: 'ok' };
}

/** Campanhas de doação: período, unidade e tipos sanguíneos em destaque. */
export function CampaignsPage() {
  useDocumentTitle('Campanhas');
  const campaigns = useAllCampaigns();
  const [dialog, setDialog] = useState<{ open: boolean; campaign: CampaignView | null }>({
    open: false,
    campaign: null,
  });
  return (
    <>
      <PageHeader
        title="Campanhas"
        description="Aparecem para o doador na tela inicial e no agendamento durante o período."
        actions={
          <Button onClick={() => setDialog({ open: true, campaign: null })}>
            <Plus aria-hidden="true" className="size-4" /> Nova campanha
          </Button>
        }
      />
      <QueryState
        isLoading={campaigns.isLoading}
        error={campaigns.error}
        onRetry={() => campaigns.refetch()}
      >
        {campaigns.data && campaigns.data.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="Nenhuma campanha"
            description="Crie a primeira campanha para incentivar doações."
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {campaigns.data?.map((campaign) => {
              const status = situation(campaign);
              return (
                <li
                  key={campaign.id}
                  className="flex flex-col rounded-card border border-line bg-surface p-5 shadow-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-bold text-ink">{campaign.title}</h2>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-ink-muted">{campaign.description}</p>
                  <p className="mt-3 text-sm text-ink">
                    {formatDate(campaign.startsAt)} a {formatDate(campaign.endsAt)} ·{' '}
                    {campaign.unit?.name ?? 'Todas as unidades'}
                  </p>
                  {campaign.bloodTypes.length > 0 && (
                    <p className="mt-2 flex flex-wrap gap-1">
                      {campaign.bloodTypes.map((type) => (
                        <Badge key={type} tone="brand">
                          {BLOOD_TYPE_LABELS[type]}
                        </Badge>
                      ))}
                    </p>
                  )}
                  <div className="mt-auto pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDialog({ open: true, campaign })}
                    >
                      Editar
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </QueryState>
      <CampaignDialog
        open={dialog.open}
        campaign={dialog.campaign}
        onClose={() => setDialog({ open: false, campaign: null })}
      />
    </>
  );
}

type FormValues = {
  title: string;
  description: string;
  bloodTypes: BloodType[];
  unitId: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
};

function CampaignDialog({
  open,
  campaign,
  onClose,
}: {
  open: boolean;
  campaign: CampaignView | null;
  onClose: () => void;
}) {
  const units = useAllUnits();
  const save = useSaveCampaign();
  const {
    register,
    handleSubmit,
    reset,
    getValues,
    setError,
    formState: { errors },
  } = useForm<FormValues>();

  useEffect(() => {
    if (!open) return;
    save.reset();
    reset({
      title: campaign?.title ?? '',
      description: campaign?.description ?? '',
      bloodTypes: campaign?.bloodTypes ?? [],
      unitId: campaign?.unit?.id ?? '',
      startsAt: campaign?.startsAt ?? todayIso(),
      endsAt: campaign?.endsAt ?? '',
      active: campaign?.active ?? true,
    });
  }, [open]);

  const onSubmit = handleSubmit(async (form) => {
    try {
      await save.mutateAsync({
        id: campaign?.id,
        title: form.title.trim(),
        description: form.description.trim(),
        bloodTypes: form.bloodTypes,
        unitId: form.unitId || null,
        startsAt: form.startsAt,
        endsAt: form.endsAt,
        active: form.active,
      });
      onClose();
    } catch (error) {
      applyApiFieldErrors(error, setError, [
        'title',
        'description',
        'bloodTypes',
        'unitId',
        'startsAt',
        'endsAt',
      ]);
    }
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={campaign ? 'Editar campanha' : 'Nova campanha'}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="campaign-form" loading={save.isPending}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="campaign-form" onSubmit={onSubmit} noValidate className="space-y-4">
        <TextField
          label="Título"
          required
          maxLength={120}
          error={errors.title?.message}
          {...register('title', { required: 'Informe o título.' })}
        />
        <TextAreaField
          label="Descrição"
          required
          maxLength={500}
          error={errors.description?.message}
          {...register('description', { required: 'Descreva a campanha.' })}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Início"
            type="date"
            required
            error={errors.startsAt?.message}
            {...register('startsAt', { required: 'Informe o início.' })}
          />
          <TextField
            label="Fim"
            type="date"
            required
            error={errors.endsAt?.message}
            {...register('endsAt', {
              required: 'Informe o fim.',
              validate: (v) => v >= getValues('startsAt') || 'O fim não pode ser antes do início.',
            })}
          />
        </div>
        <SelectField
          label="Unidade"
          placeholder="Todas as unidades"
          options={unitOptions(units.data)}
          {...register('unitId')}
        />
        <fieldset>
          <legend className="text-sm font-semibold text-ink">
            Tipos sanguíneos em destaque (opcional)
          </legend>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {BLOOD_TYPES.map((type) => (
              <CheckboxField
                key={type}
                label={BLOOD_TYPE_LABELS[type]}
                value={type}
                {...register('bloodTypes')}
              />
            ))}
          </div>
        </fieldset>
        <CheckboxField label="Campanha ativa" {...register('active')} />
        <ProblemAlert error={save.error && !Object.keys(errors).length ? save.error : null} />
      </form>
    </Dialog>
  );
}
