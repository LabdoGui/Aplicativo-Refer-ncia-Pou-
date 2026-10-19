import { useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Megaphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { AppointmentView, CampaignView } from '@pulso/contracts';
import { Alert, Button, Spinner } from '@/components/ui';
import {
  donorKeys,
  useAvailability,
  useCampaigns,
  useCreateAppointment,
  useEligibility,
  useRescheduleAppointment,
  useUnits,
} from '@/features/donor/api';
import { formatDate, todayIso } from '@/lib/format';
import {
  availabilityRange,
  BOOKING_STEPS,
  campaignAppliesTo,
  daysWithSlots,
  PICK_ANOTHER_TIME,
  type BookingStep,
} from './booking-logic';
import { ConfirmStep } from './ConfirmStep';
import { DateStep } from './DateStep';
import { longDate } from './format';
import { errorCode, ProblemAlert } from '@/components/ui/ProblemAlert';
import { StepShell } from './StepShell';
import { Stepper } from './Stepper';
import { TimeStep } from './TimeStep';
import { UnitStep } from './UnitStep';

interface BookingFlowProps {
  /** Agendamento a reagendar; sem ele, é um agendamento novo. */
  current?: AppointmentView;
  /** Campanha pedida pela URL (?campanha=). */
  campaignParam?: string | null;
}

/** Fluxo em 4 etapas: unidade → data → horário → confirmação. */
export function BookingFlow({ current, campaignParam }: BookingFlowProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const units = useUnits();
  const campaigns = useCampaigns();
  const eligibility = useEligibility();
  const create = useCreateAppointment();
  const reschedule = useRescheduleAppointment();
  const mutation = current ? reschedule : create;

  const requestedCampaign = useMemo(
    () => campaigns.data?.find((c) => c.id === campaignParam && c.active),
    [campaigns.data, campaignParam],
  );

  const [step, setStep] = useState<BookingStep>('unit');
  const [unitChoice, setUnitChoice] = useState<string | undefined>(current?.unit.id);
  const [date, setDate] = useState<string>();
  const [startsAt, setStartsAt] = useState<string>();
  const [campaignChoice, setCampaignChoice] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string>();
  const [timeProblem, setTimeProblem] = useState<unknown>(null);
  const [submitError, setSubmitError] = useState<unknown>(null);
  // Depois da primeira troca de etapa, o foco vai para o título da etapa nova.
  const [navigated, setNavigated] = useState(false);

  // A unidade da campanha vem pré-selecionada até o doador escolher outra.
  const unitId = unitChoice ?? requestedCampaign?.unit?.id;
  const today = todayIso();
  const range = availabilityRange(today);
  const availability = useAvailability(unitId, range.from, range.to);
  const days = daysWithSlots(availability.data?.days ?? []);
  const day = days.find((d) => d.date === date);
  const slot = day?.slots.find((s) => s.startsAt === startsAt);
  const unit = units.data?.find((u) => u.id === unitId);

  const eligibleCampaigns: CampaignView[] =
    unitId && date ? (campaigns.data ?? []).filter((c) => campaignAppliesTo(c, unitId, date)) : [];
  const defaultCampaign =
    requestedCampaign && eligibleCampaigns.some((c) => c.id === requestedCampaign.id)
      ? requestedCampaign.id
      : '';
  const campaignId = campaignChoice ?? defaultCampaign;
  const campaignNotice =
    !current && requestedCampaign && unitId && date && !defaultCampaign
      ? `A campanha "${requestedCampaign.title}" não vale para esta unidade ou data. O agendamento será feito sem campanha.`
      : undefined;

  function goTo(next: BookingStep) {
    setNavigated(true);
    setStepError(undefined);
    setStep(next);
  }

  function next(from: BookingStep) {
    if (from === 'unit' && !unitId) return setStepError('Escolha uma unidade para continuar.');
    if (from === 'date' && !day) return setStepError('Escolha um dia para continuar.');
    if (from === 'time' && !slot) return setStepError('Escolha um horário para continuar.');
    if (from === 'time') setTimeProblem(null);
    const index = BOOKING_STEPS.findIndex((s) => s.key === from);
    goTo(BOOKING_STEPS[index + 1].key);
  }

  function back(from: BookingStep) {
    const index = BOOKING_STEPS.findIndex((s) => s.key === from);
    if (index > 0) goTo(BOOKING_STEPS[index - 1].key);
  }

  async function confirm() {
    if (mutation.isPending || !unitId || !slot) return;
    setSubmitError(null);
    try {
      const appointment = current
        ? await reschedule.mutateAsync({ id: current.id, unitId, startsAt: slot.startsAt })
        : await create.mutateAsync({
            unitId,
            startsAt: slot.startsAt,
            campaignId: campaignId || null,
          });
      // O agendamento substituído agora está cancelado: a cópia em cache fica velha.
      if (current)
        void queryClient.invalidateQueries({ queryKey: donorKeys.appointment(current.id) });
      const query = current ? '?novo=1&reagendado=1' : '?novo=1';
      navigate(`/app/agendamentos/${appointment.id}${query}`, { replace: true });
    } catch (error) {
      const code = errorCode(error);
      if (code && PICK_ANOTHER_TIME.has(code)) {
        // A vaga deixou de existir: recarrega a agenda e volta para a escolha do horário.
        await queryClient.invalidateQueries({ queryKey: ['public', 'availability'] });
        setStartsAt(undefined);
        setTimeProblem(error);
        goTo('time');
        return;
      }
      if (code === 'INVALID_CAMPAIGN') setCampaignChoice('');
      if (code === 'ACTIVE_APPOINTMENT_EXISTS') {
        void queryClient.invalidateQueries({ queryKey: donorKeys.appointments });
      }
      setSubmitError(error);
    }
  }

  const autoFocus = navigated;
  const backButton = (from: BookingStep) => (
    <Button variant="ghost" onClick={() => back(from)} disabled={mutation.isPending}>
      <ArrowLeft aria-hidden="true" className="size-4" />
      Voltar
    </Button>
  );
  const nextButton = (from: BookingStep) => (
    <Button variant="secondary" size="lg" className="sm:ml-auto" onClick={() => next(from)}>
      Continuar
      <ArrowRight aria-hidden="true" className="size-4" />
    </Button>
  );

  let body: ReactNode;
  if (step === 'unit') {
    body = (
      <StepShell
        key="unit"
        title="Escolha a unidade"
        description="Escolha onde você prefere doar."
        autoFocus={autoFocus}
        footer={nextButton('unit')}
      >
        {units.isLoading ? (
          <Spinner label="Carregando unidades…" className="text-ink-muted" />
        ) : units.error ? (
          <ProblemAlert
            error={units.error}
            actions={
              <Button variant="outline" size="sm" onClick={() => units.refetch()}>
                Tentar novamente
              </Button>
            }
          />
        ) : (
          <UnitStep
            units={(units.data ?? []).filter((u) => u.status === 'ACTIVE')}
            value={unitId}
            onChange={(id) => {
              setUnitChoice(id);
              setDate(undefined);
              setStartsAt(undefined);
              setStepError(undefined);
            }}
            error={stepError}
            campaignUnitId={requestedCampaign?.unit?.id}
            currentUnitId={current?.unit.id}
          />
        )}
      </StepShell>
    );
  } else if (step === 'date') {
    body = (
      <StepShell
        key="date"
        title="Escolha o dia"
        description={unit ? `${unit.name} · próximas 4 semanas` : undefined}
        autoFocus={autoFocus}
        footer={
          <>
            {backButton('date')}
            {days.length > 0 && nextButton('date')}
          </>
        }
      >
        {availability.isLoading ? (
          <Spinner label="Carregando os dias disponíveis…" className="text-ink-muted" />
        ) : availability.error ? (
          <ProblemAlert
            error={availability.error}
            actions={
              <Button variant="outline" size="sm" onClick={() => availability.refetch()}>
                Tentar novamente
              </Button>
            }
          />
        ) : days.length === 0 ? (
          <Alert
            tone="info"
            title="Sem horários nas próximas 4 semanas"
            actions={
              <Button variant="outline" size="sm" onClick={() => goTo('unit')}>
                Escolher outra unidade
              </Button>
            }
          >
            Esta unidade não tem horários abertos no período. Tente outra unidade.
          </Alert>
        ) : (
          <DateStep
            days={days}
            value={date}
            onChange={(value) => {
              setDate(value);
              setStartsAt(undefined);
              setStepError(undefined);
            }}
            error={stepError}
          />
        )}
      </StepShell>
    );
  } else if (step === 'time') {
    body = (
      <StepShell
        key="time"
        title="Escolha o horário"
        description={date ? longDate(date) : undefined}
        autoFocus={autoFocus}
        footer={
          <>
            {backButton('time')}
            {day && nextButton('time')}
          </>
        }
      >
        {timeProblem ? (
          <ProblemAlert
            error={timeProblem}
            tone="warn"
            title="Escolha outro horário"
            className="mb-4"
          />
        ) : null}
        {availability.isFetching && !day ? (
          <Spinner label="Atualizando os horários…" className="text-ink-muted" />
        ) : day ? (
          <TimeStep
            slots={day.slots}
            value={startsAt}
            onChange={(value) => {
              setStartsAt(value);
              setStepError(undefined);
            }}
            error={stepError}
            currentStartsAt={current?.unit.id === unitId ? current?.startsAt : undefined}
          />
        ) : (
          <Alert
            tone="info"
            actions={
              <Button variant="outline" size="sm" onClick={() => goTo('date')}>
                Escolher outro dia
              </Button>
            }
          >
            Este dia não tem mais horários disponíveis.
          </Alert>
        )}
      </StepShell>
    );
  } else if (unit && date && slot) {
    body = (
      <StepShell
        key="confirm"
        title={current ? 'Confira o novo horário' : 'Confira e confirme'}
        autoFocus={autoFocus}
        footer={
          <>
            {backButton('confirm')}
            <Button
              size="lg"
              className="sm:ml-auto"
              loading={mutation.isPending}
              onClick={() => void confirm()}
            >
              {current ? 'Confirmar reagendamento' : 'Confirmar agendamento'}
            </Button>
          </>
        }
      >
        <ConfirmStep
          unit={unit}
          date={date}
          slot={slot}
          current={current}
          campaigns={eligibleCampaigns}
          campaignId={campaignId}
          onCampaignChange={setCampaignChoice}
          campaignNotice={campaignNotice}
          eligibility={eligibility.data}
        />
        {submitError ? (
          <ProblemAlert error={submitError} title="Não foi possível confirmar" className="mt-5" />
        ) : null}
      </StepShell>
    );
  } else {
    // A vaga sumiu da agenda recarregada: volta à escolha do horário.
    body = (
      <Alert
        tone="info"
        actions={
          <Button variant="outline" size="sm" onClick={() => goTo('time')}>
            Escolher horário
          </Button>
        }
      >
        O horário escolhido não está mais disponível.
      </Alert>
    );
  }

  return (
    <>
      {requestedCampaign && !current && (
        <Alert
          tone="info"
          title={`Agendando pela campanha "${requestedCampaign.title}"`}
          className="mb-6"
        >
          Vale de {formatDate(requestedCampaign.startsAt)} a {formatDate(requestedCampaign.endsAt)}{' '}
          · {requestedCampaign.unit?.name ?? 'Todas as unidades'}
        </Alert>
      )}
      {campaignParam && !current && campaigns.isSuccess && !requestedCampaign && (
        <Alert tone="info" className="mb-6">
          <span className="inline-flex items-center gap-1.5">
            <Megaphone aria-hidden="true" className="size-4" />
            Esta campanha não está mais ativa. Você pode agendar normalmente.
          </span>
        </Alert>
      )}
      <Stepper current={step} onSelect={goTo} />
      {body}
    </>
  );
}
