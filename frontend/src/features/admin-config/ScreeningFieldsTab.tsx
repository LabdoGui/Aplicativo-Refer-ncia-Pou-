import { useState } from 'react';
import { Plus } from 'lucide-react';
import {
  SCREENING_FIELD_TYPES,
  type ScreeningFieldType,
  type ScreeningFieldView,
} from '@pulso/contracts';
import { CheckboxField, SelectField, TextAreaField, TextField } from '@/components/form';
import {
  Alert,
  Badge,
  Button,
  Dialog,
  ProblemAlert,
  QueryState,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '@/components/ui';
import { useSaveScreeningField, useScreeningFieldsAdmin } from './api';

const TYPE_LABELS: Record<ScreeningFieldType, string> = {
  NUMBER: 'Número',
  TEXT: 'Texto',
  BOOLEAN: 'Sim/Não',
  SELECT: 'Lista de opções',
};

/** Campos que a enfermagem preenche na triagem (sem limiares clínicos automáticos). */
export function ScreeningFieldsTab() {
  const fields = useScreeningFieldsAdmin();
  const [editing, setEditing] = useState<{ open: boolean; field: ScreeningFieldView | null }>({
    open: false,
    field: null,
  });
  return (
    <div className="space-y-4">
      <Alert tone="info">
        Mínimo e máximo servem só contra erros de digitação. O resultado da triagem (apto, inapto ou
        necessita avaliação) é sempre decisão do profissional.
      </Alert>
      <div className="flex justify-end">
        <Button onClick={() => setEditing({ open: true, field: null })}>
          <Plus aria-hidden="true" className="size-4" /> Novo campo
        </Button>
      </div>
      <QueryState
        isLoading={fields.isLoading}
        error={fields.error}
        onRetry={() => fields.refetch()}
      >
        <Table caption="Campos da triagem profissional">
          <THead>
            <Tr>
              <Th>Ordem</Th>
              <Th>Campo</Th>
              <Th>Tipo</Th>
              <Th>Limites</Th>
              <Th>Obrigatório</Th>
              <Th>Situação</Th>
              <Th className="text-right">Ação</Th>
            </Tr>
          </THead>
          <TBody>
            {fields.data?.map((field) => (
              <Tr key={field.id}>
                <Td className="tabular-nums">{field.order}</Td>
                <Td>
                  <span className="block font-semibold">
                    {field.label}
                    {field.unit ? ` (${field.unit})` : ''}
                  </span>
                  <span className="font-mono text-xs text-ink-muted">{field.code}</span>
                </Td>
                <Td>{TYPE_LABELS[field.type]}</Td>
                <Td>
                  {field.type === 'NUMBER' && (field.min !== null || field.max !== null)
                    ? `${field.min ?? '—'} a ${field.max ?? '—'}`
                    : '—'}
                </Td>
                <Td>{field.required ? 'Sim' : 'Não'}</Td>
                <Td>
                  <Badge tone={field.active ? 'ok' : 'neutral'}>
                    {field.active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </Td>
                <Td className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditing({ open: true, field })}
                    aria-label={`Editar ${field.label}`}
                  >
                    Editar
                  </Button>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </QueryState>
      {editing.open && (
        <FieldDialog
          field={editing.field}
          onClose={() => setEditing({ open: false, field: null })}
        />
      )}
    </div>
  );
}

const optionsToText = (field: ScreeningFieldView | null) =>
  (field?.options ?? []).map((o) => `${o.value}|${o.label}`).join('\n');
const textToOptions = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [value, ...rest] = line.split('|');
      return { value: value.trim(), label: (rest.join('|') || value).trim() };
    });

function FieldDialog({
  field,
  onClose,
}: {
  field: ScreeningFieldView | null;
  onClose: () => void;
}) {
  const save = useSaveScreeningField();
  const [form, setForm] = useState({
    code: field?.code ?? '',
    label: field?.label ?? '',
    type: (field?.type ?? 'NUMBER') as ScreeningFieldType,
    unit: field?.unit ?? '',
    options: optionsToText(field),
    helpText: field?.helpText ?? '',
    required: field?.required ?? false,
    min: field?.min?.toString() ?? '',
    max: field?.max?.toString() ?? '',
    order: String(field?.order ?? 10),
    active: field?.active ?? true,
  });
  const set = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));
  const num = (value: string) => (value.trim() === '' ? null : Number(value.replace(',', '.')));
  const codeOk = field !== null || /^[A-Z][A-Z0-9_]{1,39}$/.test(form.code);

  function submit() {
    save.mutate(
      {
        id: field?.id,
        ...(field ? {} : { code: form.code, type: form.type }),
        label: form.label.trim(),
        unit: form.unit.trim() || null,
        options: form.type === 'SELECT' ? textToOptions(form.options) : null,
        helpText: form.helpText.trim() || null,
        required: form.required,
        min: form.type === 'NUMBER' ? num(form.min) : null,
        max: form.type === 'NUMBER' ? num(form.max) : null,
        order: Number(form.order) || 0,
        active: form.active,
      },
      { onSuccess: onClose },
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={field ? `Editar campo ${field.label}` : 'Novo campo da triagem'}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!codeOk || form.label.trim().length < 2}
            loading={save.isPending}
            onClick={submit}
          >
            Salvar
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {!field && (
          <>
            <TextField
              label="Código"
              hint="Letras maiúsculas, números e _ (ex.: SATURACAO_O2)."
              value={form.code}
              error={
                form.code && !codeOk
                  ? 'Use de 2 a 40 caracteres: A–Z, 0–9 e _, começando por letra.'
                  : undefined
              }
              onChange={(e) => set({ code: e.target.value.toUpperCase() })}
            />
            <SelectField
              label="Tipo"
              value={form.type}
              options={SCREENING_FIELD_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] }))}
              onChange={(e) => set({ type: e.target.value as ScreeningFieldType })}
            />
          </>
        )}
        <TextField
          label="Rótulo"
          value={form.label}
          onChange={(e) => set({ label: e.target.value })}
        />
        <TextField
          label="Unidade de medida (opcional)"
          placeholder="kg, mmHg, °C…"
          value={form.unit}
          onChange={(e) => set({ unit: e.target.value })}
        />
        {form.type === 'NUMBER' && (
          <>
            <TextField
              label="Mínimo (contra erro de digitação)"
              inputMode="decimal"
              value={form.min}
              onChange={(e) => set({ min: e.target.value })}
            />
            <TextField
              label="Máximo (contra erro de digitação)"
              inputMode="decimal"
              value={form.max}
              onChange={(e) => set({ max: e.target.value })}
            />
          </>
        )}
        {form.type === 'SELECT' && (
          <TextAreaField
            label="Opções"
            className="sm:col-span-2"
            hint="Uma por linha, no formato valor|rótulo."
            value={form.options}
            onChange={(e) => set({ options: e.target.value })}
          />
        )}
        <TextField
          label="Texto de ajuda (opcional)"
          className="sm:col-span-2"
          value={form.helpText}
          onChange={(e) => set({ helpText: e.target.value })}
        />
        <TextField
          label="Ordem"
          inputMode="numeric"
          value={form.order}
          onChange={(e) => set({ order: e.target.value })}
        />
        <div className="flex flex-col gap-2 pt-6">
          <CheckboxField
            label="Obrigatório"
            checked={form.required}
            onChange={(e) => set({ required: e.target.checked })}
          />
          <CheckboxField
            label="Ativo"
            checked={form.active}
            onChange={(e) => set({ active: e.target.checked })}
          />
        </div>
        <div className="sm:col-span-2">
          <ProblemAlert error={save.error} />
        </div>
      </div>
    </Dialog>
  );
}
