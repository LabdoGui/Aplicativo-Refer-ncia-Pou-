import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Share2, Trash2 } from 'lucide-react';
import type { ConsentView, PreScreeningResultView } from '@pulso/contracts';
import { FormErrorAlert, PasswordField } from '@/components/form';
import { Alert, Badge, Button, Card, Dialog, PageHeader, QueryState } from '@/components/ui';
import {
  deleteAccount,
  exportPersonalData,
  useConsents,
  useUpdateConsents,
} from '@/features/account/api';
import { clearSession } from '@/features/auth/session-store';
import { apiGet, apiPatch } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
import { useDocumentTitle } from '@/lib/use-document-title';

export function PrivacyCenterPage() {
  useDocumentTitle('Privacidade e dados');
  return (
    <>
      <PageHeader
        title="Privacidade e dados"
        description="Você decide como seus dados são usados. Tudo aqui vale imediatamente."
      />
      <div className="space-y-6">
        <ConsentsCard />
        <PreScreeningSharingCard />
        <ExportCard />
        <DeleteAccountCard />
      </div>
    </>
  );
}

function ConsentsCard() {
  const consents = useConsents();
  const update = useUpdateConsents();
  return (
    <Card as="section" aria-labelledby="consentimentos">
      <h2 id="consentimentos" className="text-lg font-bold text-ink">
        Consentimentos
      </h2>
      <QueryState
        isLoading={consents.isLoading}
        error={consents.error}
        onRetry={() => consents.refetch()}
      >
        <ul className="mt-4 divide-y divide-line">
          {consents.data?.map((consent) => (
            <ConsentRow
              key={consent.purpose}
              consent={consent}
              pending={
                update.isPending && update.variables?.consents[0]?.purpose === consent.purpose
              }
              onToggle={(granted) =>
                update.mutate({ consents: [{ purpose: consent.purpose, granted }] })
              }
            />
          ))}
        </ul>
        {update.error ? <FormErrorAlert error={update.error} /> : null}
      </QueryState>
    </Card>
  );
}

function ConsentRow({
  consent,
  pending,
  onToggle,
}: {
  consent: ConsentView;
  pending: boolean;
  onToggle: (granted: boolean) => void;
}) {
  const since = consent.granted ? consent.grantedAt : consent.revokedAt;
  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-xl">
        <p className="font-semibold text-ink">
          {consent.title} {consent.required && <Badge tone="info">Obrigatório</Badge>}
        </p>
        <p className="text-sm text-ink-muted">{consent.description}</p>
        {since && (
          <p className="mt-1 text-xs text-ink-muted">
            {consent.granted ? 'Aceito' : 'Recusado'} em {formatDateTime(since)}
            {consent.version && ` · versão ${consent.version}`}
          </p>
        )}
      </div>
      {consent.required ? (
        <Badge tone="ok">Aceito</Badge>
      ) : (
        <Button
          variant={consent.granted ? 'outline' : 'secondary'}
          size="sm"
          loading={pending}
          // Ação (não interruptor): o estado atual já está no texto "Aceito/Recusado em".
          aria-label={`${consent.granted ? 'Desativar' : 'Ativar'}: ${consent.title}`}
          onClick={() => onToggle(!consent.granted)}
        >
          {consent.granted ? 'Desativar' : 'Ativar'}
        </Button>
      )}
    </li>
  );
}

const latestKey = ['prescreening', 'latest'] as const;

function PreScreeningSharingCard() {
  const queryClient = useQueryClient();
  const latest = useQuery({
    queryKey: latestKey,
    queryFn: ({ signal }) =>
      apiGet<PreScreeningResultView | undefined>('/screenings/pre-check/me/latest', {
        signal,
      }).then((data) => data ?? null),
  });
  const revoke = useMutation({
    mutationFn: (id: string) =>
      apiPatch<PreScreeningResultView>(`/screenings/pre-check/${id}/sharing`, { shared: false }),
    onSuccess: (data) => queryClient.setQueryData(latestKey, data),
  });
  const data = latest.data;
  return (
    <Card as="section" aria-labelledby="compartilhamento">
      <div className="flex gap-3">
        <Share2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-petroleo-700" />
        <div className="min-w-0 flex-1">
          <h2 id="compartilhamento" className="text-lg font-bold text-ink">
            Compartilhamento da pré-triagem
          </h2>
          <p className="text-sm text-ink-muted">
            Ao responder a pré-triagem, você escolhe se a equipe da unidade pode ver suas respostas
            no atendimento. Sem compartilhamento, guardamos apenas o resultado informativo.
          </p>
          <QueryState
            isLoading={latest.isLoading}
            error={latest.error}
            onRetry={() => latest.refetch()}
          >
            <div className="mt-4">
              {!data ? (
                <p className="text-sm text-ink-muted">Você ainda não respondeu a pré-triagem.</p>
              ) : data.sharedWithStaff ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-ink">
                    Respostas de {formatDate(data.createdAt)} <strong>compartilhadas</strong> com a
                    equipe.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    loading={revoke.isPending}
                    onClick={() => revoke.mutate(data.id)}
                  >
                    Parar de compartilhar
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-ink">
                  Respostas de {formatDate(data.createdAt)} <strong>não compartilhadas</strong>.
                </p>
              )}
              {revoke.error ? <FormErrorAlert error={revoke.error} /> : null}
            </div>
          </QueryState>
        </div>
      </div>
    </Card>
  );
}

function ExportCard() {
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      const data = await exportPersonalData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sangueconecta-meus-dados-${data.generatedAt.slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card as="section" aria-labelledby="exportar" className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <Download aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-petroleo-700" />
          <div>
            <h2 id="exportar" className="text-lg font-bold text-ink">
              Baixar meus dados
            </h2>
            <p className="text-sm text-ink-muted">
              Arquivo com seus dados de cadastro e consentimentos (LGPD, art. 18).
            </p>
          </div>
        </div>
        <Button variant="outline" loading={busy} onClick={handleExport}>
          Baixar arquivo
        </Button>
      </div>
      <FormErrorAlert error={error} />
    </Card>
  );
}

function DeleteAccountCard() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const remove = useMutation({
    mutationFn: () => deleteAccount(password),
    // A proteção da rota leva ao aviso de conta excluída (/?conta-excluida=1).
    onSuccess: () => clearSession('account-deleted'),
  });
  return (
    <Card as="section" aria-labelledby="excluir" className="border-critical/30">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <Trash2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-critical-strong" />
          <div>
            <h2 id="excluir" className="text-lg font-bold text-ink">
              Excluir minha conta
            </h2>
            <p className="text-sm text-ink-muted">
              Apagamos seus dados de identificação. Registros de atendimento ficam guardados sem seu
              nome, como exige a guarda de prontuários.
            </p>
          </div>
        </div>
        <Button variant="danger" onClick={() => setOpen(true)}>
          Excluir conta
        </Button>
      </div>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Excluir conta?"
        description="Esta ação não pode ser desfeita. Se você tiver um agendamento ativo, cancele antes para liberar a vaga."
        actions={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Voltar
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              disabled={!password}
              onClick={() => remove.mutate()}
            >
              Excluir definitivamente
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <PasswordField
            label="Confirme com sua senha"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {remove.error ? <FormErrorAlert error={remove.error} /> : null}
          <Alert tone="warn">Você sairá do app imediatamente.</Alert>
        </div>
      </Dialog>
    </Card>
  );
}
