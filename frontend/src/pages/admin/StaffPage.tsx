import { useState } from 'react';
import { Plus, Stethoscope } from 'lucide-react';
import { ROLE_LABELS, type AdminUserView, type StaffRole } from '@pulso/contracts';
import {
  Badge,
  Button,
  EmptyState,
  PageHeader,
  Pagination,
  QueryState,
  SegmentedControl,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '@/components/ui';
import { useAllUnits } from '@/features/admin/units';
import { useAdminUsers } from '@/features/admin-ops/api';
import { StaffDialog } from '@/features/admin-ops/StaffDialog';
import { formatDateTime } from '@/lib/format';
import { useDocumentTitle } from '@/lib/use-document-title';

const TABS: Array<{ value: StaffRole; label: string }> = [
  { value: 'NURSE', label: 'Enfermagem' },
  { value: 'COLLABORATOR', label: 'Colaboradores' },
  { value: 'ADMIN', label: 'Administradores' },
];

/** Contas da equipe: papel, unidades vinculadas e situação. */
export function StaffPage() {
  useDocumentTitle('Profissionais');
  const [role, setRole] = useState<StaffRole>('NURSE');
  const [page, setPage] = useState(1);
  const users = useAdminUsers({ role, page });
  const units = useAllUnits();
  const unitName = new Map((units.data ?? []).map((unit) => [unit.id, unit.name]));
  const [dialog, setDialog] = useState<{ open: boolean; user: AdminUserView | null }>({
    open: false,
    user: null,
  });

  return (
    <>
      <PageHeader
        title="Profissionais"
        description="Colaboradores fazem agenda e check-in; a enfermagem também faz triagem e registra a doação."
        actions={
          <Button onClick={() => setDialog({ open: true, user: null })}>
            <Plus aria-hidden="true" className="size-4" /> Novo profissional
          </Button>
        }
      />
      <div className="mb-4">
        <SegmentedControl
          label="Papel"
          value={role}
          options={TABS}
          onChange={(value) => {
            setRole(value);
            setPage(1);
          }}
        />
      </div>
      <QueryState isLoading={users.isLoading} error={users.error} onRetry={() => users.refetch()}>
        {users.data && users.data.items.length === 0 ? (
          <EmptyState icon={Stethoscope} title="Nenhuma conta com este papel" />
        ) : (
          users.data && (
            <>
              <Table caption={`Profissionais: ${ROLE_LABELS[role]}`}>
                <THead>
                  <Tr>
                    <Th>Nome</Th>
                    <Th>E-mail</Th>
                    <Th>Unidades</Th>
                    <Th>Registro</Th>
                    <Th>Último acesso</Th>
                    <Th>Conta</Th>
                    <Th className="text-right">Ação</Th>
                  </Tr>
                </THead>
                <TBody>
                  {users.data.items.map((user) => (
                    <Tr key={user.id}>
                      <Td className="font-semibold">{user.name}</Td>
                      <Td className="break-all">{user.email}</Td>
                      <Td>
                        {user.role === 'ADMIN'
                          ? 'Todas'
                          : user.unitIds
                              .map((id) => unitName.get(id) ?? 'Unidade removida')
                              .join(', ') || '—'}
                      </Td>
                      <Td>{user.registryNumber ?? '—'}</Td>
                      <Td>{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Nunca'}</Td>
                      <Td>
                        <Badge tone={user.status === 'ACTIVE' ? 'ok' : 'neutral'}>
                          {user.status === 'ACTIVE' ? 'Ativa' : 'Desativada'}
                        </Badge>
                      </Td>
                      <Td className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDialog({ open: true, user })}
                          aria-label={`Editar ${user.name}`}
                        >
                          Editar
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
              <Pagination
                page={page}
                pageSize={users.data.pageSize}
                total={users.data.total}
                onPageChange={setPage}
              />
            </>
          )
        )}
      </QueryState>
      <StaffDialog
        open={dialog.open}
        user={dialog.user}
        defaultRole={role}
        units={(units.data ?? []).filter(
          (unit) => unit.status === 'ACTIVE' || dialog.user?.unitIds.includes(unit.id),
        )}
        onClose={() => setDialog({ open: false, user: null })}
      />
    </>
  );
}
