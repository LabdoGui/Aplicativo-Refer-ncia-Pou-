import { CalendarDays, Clock, History, MapPin } from 'lucide-react';
import type {
  AppointmentView,
  AvailabilitySlot,
  CampaignView,
  EligibilityView,
  UnitView,
} from '@pulso/contracts';
import { SelectField } from '@/components/form';
import { Alert } from '@/components/ui';
import { isBeforeNextEligible, eligibilitySource } from '@/features/donor/home/EligibilityNote';
import { formatDate, formatTime } from '@/lib/format';
import { DetailItem } from './AppointmentSummary';
import { longDate, timeRange } from './format';

interface ConfirmStepProps {
  unit: UnitView;
  date: string;
  slot: AvailabilitySlot;
  /** Agendamento que será substituído (reagendamento). */
  current?: AppointmentView;
  /** Campanhas que valem para a unidade e a data (só no agendamento novo). */
  campaigns: CampaignView[];
  campaignId: string;
  onCampaignChange: (campaignId: string) => void;
  /** Aviso sobre a campanha pedida que não vale para a escolha. */
  campaignNotice?: string;
  eligibility: EligibilityView | undefined;
}

/** Resumo para conferir antes de confirmar, com os avisos informativos (RN04). */
export function ConfirmStep({
  unit,
  date,
  slot,
  current,
  campaigns,
  campaignId,
  onCampaignChange,
  campaignNotice,
  eligibility,
}: ConfirmStepProps) {
  return (
    <div className="space-y-5">
      <dl className="space-y-4 rounded-card bg-canvas p-4">
        <DetailItem icon={MapPin} label="Unidade">
          <p className="font-semibold text-ink">{unit.name}</p>
          <p className="text-sm text-ink-muted">
            {unit.address} · {unit.district}, {unit.city}
          </p>
        </DetailItem>
        <DetailItem icon={CalendarDays} label="Data">
          <p className="font-semibold text-ink">{longDate(date)}</p>
          <p className="text-sm text-ink-muted">{formatDate(date)}</p>
        </DetailItem>
        <DetailItem icon={Clock} label="Horário">
          <p className="font-semibold text-ink">{timeRange(slot.startsAt, slot.endsAt)}</p>
        </DetailItem>
        {current && (
          <DetailItem icon={History} label="Agendamento atual, que será substituído">
            <p className="text-sm text-ink-muted">
              Substitui o agendamento de {formatDate(current.startsAt)} às{' '}
              {formatTime(current.startsAt)} ({current.unit.name}).
              {current.campaign &&
                ` A campanha "${current.campaign.title}" continua vinculada se valer para a nova data e unidade.`}
            </p>
          </DetailItem>
        )}
      </dl>

      {!current && campaigns.length > 0 && (
        <SelectField
          label="Campanha (opcional)"
          placeholder="Sem campanha"
          options={campaigns.map((campaign) => ({ value: campaign.id, label: campaign.title }))}
          value={campaignId}
          onChange={(event) => onCampaignChange(event.target.value)}
          hint="Vincular o agendamento a uma campanha ajuda a unidade a acompanhar a ação."
        />
      )}
      {campaignNotice && <Alert tone="info">{campaignNotice}</Alert>}

      {isBeforeNextEligible(eligibility, date) && (
        <Alert tone="warn" title="Antes da data informativa">
          <p>
            A data informativa para a sua próxima doação é{' '}
            <strong>{formatDate(eligibility.nextEligibleAt)}</strong>. Você pode manter este dia.
          </p>
          <p className="mt-1 text-ink-muted">{eligibilitySource(eligibility)}</p>
        </Alert>
      )}
    </div>
  );
}
