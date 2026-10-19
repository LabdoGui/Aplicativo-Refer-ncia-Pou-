import { useState } from 'react';
import type { AppointmentView } from '@pulso/contracts';
import { TextAreaField } from '@/components/form';
import { Button, Dialog } from '@/components/ui';
import { useCancelAppointment } from '@/features/donor/api';
import { errorCode, ProblemAlert } from '@/components/ui/ProblemAlert';

interface CancelAppointmentDialogProps {
  appointment: AppointmentView;
  open: boolean;
  onClose: () => void;
  onCancelled: (appointment: AppointmentView) => void;
  /** Recarrega o agendamento quando o servidor diz que ele mudou de situação. */
  onStale: () => void;
}

const REASON_MAX = 200;

/** Confirmação do cancelamento, com motivo opcional. */
export function CancelAppointmentDialog({
  appointment,
  open,
  onClose,
  onCancelled,
  onStale,
}: CancelAppointmentDialogProps) {
  const cancel = useCancelAppointment();
  const [reason, setReason] = useState('');

  function close() {
    if (cancel.isPending) return;
    cancel.reset();
    onClose();
  }

  function confirm() {
    if (cancel.isPending) return;
    cancel.mutate(
      { id: appointment.id, reason: reason.trim() || undefined },
      {
        onSuccess: (updated) => {
          setReason('');
          onCancelled(updated);
        },
        onError: (error) => {
          const code = errorCode(error);
          if (code === 'CHANGE_WINDOW_CLOSED' || code === 'INVALID_STATUS') onStale();
        },
      },
    );
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Cancelar agendamento?"
      description="O horário fica livre para outra pessoa. Você pode agendar de novo quando quiser."
      actions={
        <>
          <Button variant="ghost" onClick={close} disabled={cancel.isPending}>
            Voltar
          </Button>
          <Button variant="danger" loading={cancel.isPending} onClick={confirm}>
            Cancelar agendamento
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextAreaField
          label="Motivo (opcional)"
          hint={`Ajuda a unidade a organizar a agenda. Até ${REASON_MAX} caracteres.`}
          maxLength={REASON_MAX}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        <ProblemAlert error={cancel.error} title="Não foi possível cancelar" />
      </div>
    </Dialog>
  );
}
