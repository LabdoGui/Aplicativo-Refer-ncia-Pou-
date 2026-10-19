import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import {
  PASSWORD_POLICY,
  ROLE_LABELS,
  type AdminUserView,
  type StaffRole,
  type UnitView,
} from '@pulso/contracts';
import {
  applyApiFieldErrors,
  CheckboxField,
  PasswordField,
  SelectField,
  TextField,
} from '@/components/form';
import { Button, Dialog, ProblemAlert } from '@/components/ui';
import { useCreateStaff, useUpdateUser } from './api';

type FormValues = {
  name: string;
  email: string;
  password: string;
  role: StaffRole;
  unitIds: string[];
  registryNumber: string;
  status: 'ACTIVE' | 'DISABLED';
};

const STAFF_ROLES: StaffRole[] = ['NURSE', 'COLLABORATOR', 'ADMIN'];

interface StaffDialogProps {
  open: boolean;
  /** Conta em edição; sem ela, cria uma nova. */
  user: AdminUserView | null;
  defaultRole: StaffRole;
  units: UnitView[];
  onClose: () => void;
}

/** Cria ou edita uma conta da equipe: papel, unidades e situação. */
export function StaffDialog({ open, user, defaultRole, units, onClose }: StaffDialogProps) {
  const create = useCreateStaff();
  const update = useUpdateUser();
  const mutation = user ? update : create;
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors },
  } = useForm<FormValues>();
  const role = watch('role');

  useEffect(() => {
    if (!open) return;
    create.reset();
    update.reset();
    reset({
      name: user?.name ?? '',
      email: user?.email ?? '',
      password: '',
      role: (user?.role as StaffRole) ?? defaultRole,
      unitIds: user?.unitIds ?? [],
      registryNumber: user?.registryNumber ?? '',
      status: user?.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE',
    });
    // Só ao abrir o diálogo.
  }, [open]);

  const onSubmit = handleSubmit(async (form) => {
    const unitIds = form.role === 'ADMIN' ? [] : form.unitIds;
    try {
      if (user) {
        await update.mutateAsync({
          id: user.id,
          name: form.name.trim(),
          role: form.role,
          unitIds,
          registryNumber: form.registryNumber.trim() || null,
          status: form.status,
        });
      } else {
        await create.mutateAsync({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
          unitIds,
          registryNumber: form.registryNumber.trim() || undefined,
        });
      }
      onClose();
    } catch (error) {
      applyApiFieldErrors(error, setError, [
        'name',
        'email',
        'password',
        'role',
        'unitIds',
        'registryNumber',
        'status',
      ]);
    }
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={user ? `Editar ${user.name}` : 'Novo profissional'}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="staff-form" loading={mutation.isPending}>
            {user ? 'Salvar' : 'Criar conta'}
          </Button>
        </>
      }
    >
      <form id="staff-form" onSubmit={onSubmit} noValidate className="space-y-4">
        <TextField
          label="Nome completo"
          required
          error={errors.name?.message}
          {...register('name', {
            required: 'Informe o nome.',
            minLength: { value: 3, message: 'Informe o nome completo.' },
          })}
        />
        {!user && (
          <>
            <TextField
              label="E-mail"
              type="email"
              required
              error={errors.email?.message}
              {...register('email', { required: 'Informe o e-mail.' })}
            />
            <PasswordField
              label="Senha inicial"
              required
              autoComplete="new-password"
              hint={`${PASSWORD_POLICY.message} Entregue à pessoa por um canal seguro.`}
              error={errors.password?.message}
              {...register('password', {
                required: 'Defina uma senha inicial.',
                minLength: { value: PASSWORD_POLICY.minLength, message: PASSWORD_POLICY.message },
                pattern: { value: PASSWORD_POLICY.pattern, message: PASSWORD_POLICY.message },
              })}
            />
          </>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Papel"
            options={STAFF_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
            error={errors.role?.message}
            {...register('role')}
          />
          <TextField
            label="Registro profissional (opcional)"
            placeholder="Ex.: COREN-SP 000000"
            error={errors.registryNumber?.message}
            {...register('registryNumber')}
          />
        </div>
        {role !== 'ADMIN' && (
          <fieldset>
            <legend className="text-sm font-semibold text-ink">
              Unidades{' '}
              <span className="text-critical-strong" aria-hidden="true">
                *
              </span>
            </legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {units.map((unit) => (
                <CheckboxField
                  key={unit.id}
                  label={unit.name}
                  value={unit.id}
                  {...register('unitIds', {
                    validate: (v) => (v?.length ?? 0) > 0 || 'Selecione pelo menos uma unidade.',
                  })}
                />
              ))}
            </div>
            {errors.unitIds && (
              <p className="mt-1 text-sm font-medium text-critical-strong">
                {errors.unitIds.message}
              </p>
            )}
          </fieldset>
        )}
        {user && (
          <SelectField
            label="Situação da conta"
            options={[
              { value: 'ACTIVE', label: 'Ativa' },
              { value: 'DISABLED', label: 'Desativada' },
            ]}
            {...register('status')}
          />
        )}
        <ProblemAlert
          error={mutation.error && !Object.keys(errors).length ? mutation.error : null}
        />
      </form>
    </Dialog>
  );
}
