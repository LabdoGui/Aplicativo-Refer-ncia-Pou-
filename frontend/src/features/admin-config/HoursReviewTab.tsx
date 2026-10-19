import { useState } from 'react';
import { GraduationCap } from 'lucide-react';
import {
  HOURS_STATUSES,
  HOURS_STATUS_LABELS,
  type AdminHoursItem,
  type HoursStatus,
} from '@pulso/contracts';
import { SelectField, TextAreaField } from '@/components/form';
import {
  Alert,
  Badge,
  type BadgeTone,
  Button,
  Dialog,
  EmptyState,
  Pagination,
  ProblemAlert,
  QueryState,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useAdminHours, useReviewHours } from './api';

const TONE: Record<HoursStatus, BadgeTone> = {
  PENDING: 'warn',
  APPROVED: 'ok',
  REJECTED: 'neutral',
};

/** Fila de horas complementares para validar em nome da instituição parceira (D9, RN15). */
export function HoursReviewTab() {
  const [status, setStatus] = useState<string>('PENDING');
  const [page, setPage] = useState(1);
  const hours = useAdminHours(status, page);
  const [review, setReview] = useState<{
    item: AdminHoursItem;
    decision: 'APPROVED' | 'REJECTED';
  } | null>(null);
  return (
    <div className="space-y-4">
      <Alert tone="info">
        A administração valida as horas em nome da instituição de ensino parceira (fictícia). Elas
        só contam depois de aprovadas; o sistema nunca aprova sozinho.
      </Alert>
      <SelectField
        label="Situação"
        className="w-60"
        placeholder="Todas"
        value={status}
        options={HOURS_STATUSES.map((s) => ({ value: s, label: HOURS_STATUS_LABELS[s] }))}
        onChange={(e) => {
          setStatus(e.target.value);
          setPage(1);
        }}
      />
      <QueryState isLoading={hours.isLoading} error={hours.error} onRetry={() => hours.refetch()}>
        {hours.data && hours.data.items.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="Nada para mostrar"
            description={
              status === 'PENDING' ? 'Nenhum pedido aguardando validação.' : 'Ajuste o filtro.'
            }
          />
        ) : (
          hours.data && (
            <>
              <Table caption="Horas complementares">
                <THead>
                  <Tr>
                    <Th>Doador</Th>
                    <Th>Instituição</Th>
                    <Th className="text-right">Horas</Th>
                    <Th>Doação</Th>
                    <Th>Situação</Th>
                    <Th className="text-right">Ações</Th>
                  </Tr>
                </THead>
                <TBody>
                  {hours.data.items.map((item) => (
                    <Tr key={item.id}>
                      <Td>
                        <span className="block font-semibold">{item.donor.name}</span>
                        <span className="text-xs text-ink-muted">
                          {item.donor.donorCode ?? '—'}
                        </span>
                      </Td>
                      <Td>{item.institution.name}</Td>
                      <Td className="text-right tabular-nums">{item.hours} h</Td>
                      <Td>{formatDate(item.donatedAt)}</Td>
                      <Td>
                        <Badge tone={TONE[item.status]}>{HOURS_STATUS_LABELS[item.status]}</Badge>
                        {item.reviewNote && (
                          <span className="mt-1 block text-xs text-ink-muted">
                            {item.reviewNote}
                          </span>
                        )}
                      </Td>
                      <Td>
                        {item.status === 'PENDING' && (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setReview({ item, decision: 'APPROVED' })}
                            >
                              Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setReview({ item, decision: 'REJECTED' })}
                            >
                              Recusar
                            </Button>
                          </div>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
              <Pagination
                page={page}
                pageSize={hours.data.pageSize}
                total={hours.data.total}
                onPageChange={setPage}
              />
            </>
          )
        )}
      </QueryState>
      <ReviewDialog review={review} onClose={() => setReview(null)} />
    </div>
  );
}

function ReviewDialog({
  review,
  onClose,
}: {
  review: { item: AdminHoursItem; decision: 'APPROVED' | 'REJECTED' } | null;
  onClose: () => void;
}) {
  const mutation = useReviewHours();
  const [note, setNote] = useState('');
  const approve = review?.decision === 'APPROVED';
  const close = () => {
    setNote('');
    mutation.reset();
    onClose();
  };
  return (
    <Dialog
      open={review !== null}
      onClose={close}
      title={approve ? 'Aprovar horas?' : 'Recusar horas?'}
      description={
        review &&
        `${review.item.hours} h para ${review.item.donor.name} (${review.item.institution.name}). O doador será avisado.`
      }
      actions={
        <>
          <Button variant="ghost" onClick={close}>
            Voltar
          </Button>
          <Button
            variant={approve ? 'secondary' : 'danger'}
            loading={mutation.isPending}
            onClick={() =>
              review &&
              mutation.mutate(
                { id: review.item.id, status: review.decision, note: note.trim() || undefined },
                { onSuccess: close },
              )
            }
          >
            {approve ? 'Aprovar' : 'Recusar'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <TextAreaField
          label="Observação para o doador (opcional)"
          maxLength={300}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <ProblemAlert error={mutation.error} />
      </div>
    </Dialog>
  );
}
