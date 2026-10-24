import { useState } from 'react';
import { Search, UserSearch } from 'lucide-react';
import { USER_STATUSES, type AdminUserView, type UserStatus } from '@pulso/contracts';
import { SelectField, TextField } from '@/components/form';
import {
  Badge,
  Button,
  Dialog,
  EmptyState,
  PageHeader,
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
import { FilterBar } from '@/features/admin/FilterBar';
import { useAdminUsers, useUpdateUser } from '@/features/admin-ops/api';
import { formatDate, formatDateTime } from '@/lib/format';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useDocumentTitle } from '@/lib/use-document-title';

const STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: 'Ativa',
  DISABLED: 'Desativada',
  ANONYMIZED: 'Excluída',
};

/** Doadores cadastrados (dados mínimos para suporte) e ativação/desativação de contas. */
export function DonorsPage() {
  useDocumentTitle('Doadores');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search.trim());
  const donors = useAdminUsers({
    role: 'DONOR',
    search: debounced || undefined,
    status: status || undefined,
    page,
  });
  const [target, setTarget] = useState<AdminUserView | null>(null);

  return (
    <>
      <PageHeader
        title="Doadores"
        description="Só os dados necessários para o suporte. Dados de saúde ficam fora desta tela."
      />
      <FilterBar>
        <TextField
          label="Buscar"
          type="search"
          className="w-72"
          placeholder="Nome, e-mail ou código"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <SelectField
          label="Situação da conta"
          className="w-48"
          placeholder="Ativas e desativadas"
          options={USER_STATUSES.filter((s) => s !== 'ANONYMIZED').map((s) => ({
            value: s,
            label: STATUS_LABELS[s],
          }))}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        />
      </FilterBar>
      <QueryState
        isLoading={donors.isLoading}
        error={donors.error}
        onRetry={() => donors.refetch()}
      >
        {donors.data && donors.data.items.length === 0 ? (
          <EmptyState
            icon={debounced ? Search : UserSearch}
            title="Nenhum doador encontrado"
            description="Confira a busca ou os filtros."
          />
        ) : (
          donors.data && (
            <>
              <Table caption="Doadores">
                <THead>
                  <Tr>
                    <Th>Nome</Th>
                    <Th>Código</Th>
                    <Th>E-mail</Th>
                    <Th>Cadastro</Th>
                    <Th>Último acesso</Th>
                    <Th>Conta</Th>
                    <Th className="text-right">Ação</Th>
                  </Tr>
                </THead>
                <TBody>
                  {donors.data.items.map((donor) => (
                    <Tr key={donor.id}>
                      <Td className="font-semibold">{donor.name}</Td>
                      <Td className="font-mono text-xs">{donor.donorCode ?? '—'}</Td>
                      <Td className="break-all">{donor.email}</Td>
                      <Td>{formatDate(donor.createdAt)}</Td>
                      <Td>{donor.lastLoginAt ? formatDateTime(donor.lastLoginAt) : 'Nunca'}</Td>
                      <Td>
                        <Badge tone={donor.status === 'ACTIVE' ? 'ok' : 'neutral'}>
                          {STATUS_LABELS[donor.status]}
                        </Badge>
                      </Td>
                      <Td className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => setTarget(donor)}>
                          {donor.status === 'ACTIVE' ? 'Desativar' : 'Reativar'}
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
              <Pagination
                page={page}
                pageSize={donors.data.pageSize}
                total={donors.data.total}
                onPageChange={setPage}
              />
            </>
          )
        )}
      </QueryState>
      <ToggleStatusDialog user={target} onClose={() => setTarget(null)} />
    </>
  );
}

export function ToggleStatusDialog({
  user,
  onClose,
}: {
  user: AdminUserView | null;
  onClose: () => void;
}) {
  const update = useUpdateUser();
  const disabling = user?.status === 'ACTIVE';
  const close = () => {
    update.reset();
    onClose();
  };
  return (
    <Dialog
      open={user !== null}
      onClose={close}
      title={disabling ? 'Desativar conta?' : 'Reativar conta?'}
      description={
        user &&
        (disabling
          ? `${user.name} não conseguirá entrar no SangueConecta, e as sessões abertas serão encerradas. Os registros ficam guardados.`
          : `${user.name} poderá entrar no SangueConecta de novo.`)
      }
      actions={
        <>
          <Button variant="ghost" onClick={close}>
            Voltar
          </Button>
          <Button
            variant={disabling ? 'danger' : 'secondary'}
            loading={update.isPending}
            onClick={() =>
              user &&
              update.mutate(
                { id: user.id, status: disabling ? 'DISABLED' : 'ACTIVE' },
                { onSuccess: close },
              )
            }
          >
            {disabling ? 'Desativar' : 'Reativar'}
          </Button>
        </>
      }
    >
      <ProblemAlert error={update.error} />
    </Dialog>
  );
}
