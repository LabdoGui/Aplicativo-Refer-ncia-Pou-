import { useState } from 'react';
import {
  RULE_SEVERITIES,
  VALIDATION_STATUS_LABELS,
  type RuleSeverity,
  type ScreeningConfigView,
  type ScreeningRuleView,
} from '@pulso/contracts';
import { TextAreaField, TextField } from '@/components/form';
import {
  Alert,
  Badge,
  type BadgeTone,
  Button,
  Card,
  Dialog,
  ProblemAlert,
  QueryState,
} from '@/components/ui';
import { useScreeningConfig, useUpdateQuestion, useUpdateRule } from './api';

const SEVERITY: Record<RuleSeverity, { label: string; tone: BadgeTone }> = {
  INFO: { label: 'Orientação', tone: 'info' },
  TALK_TO_UNIT: { label: 'Converse com a unidade', tone: 'warn' },
  WAIT_UNTIL: { label: 'Data informativa', tone: 'info' },
};
const OPERATORS: Record<string, string> = {
  EQUALS: '=',
  NOT_EQUALS: '≠',
  LT: '<',
  LTE: '≤',
  GT: '>',
  GTE: '≥',
  WITHIN_DAYS: 'nos últimos',
};

function ruleCondition(rule: ScreeningRuleView): string {
  if (rule.operator === 'WITHIN_DAYS')
    return `data ${OPERATORS.WITHIN_DAYS} ${rule.settingKey ? `“${rule.settingKey}”` : `${rule.value}`} dias`;
  const value = typeof rule.value === 'boolean' ? (rule.value ? 'Sim' : 'Não') : String(rule.value);
  return `resposta ${OPERATORS[rule.operator] ?? rule.operator} ${value}`;
}

type QuestionItem = ScreeningConfigView['questions'][number];

/** Perguntas e regras da pré-triagem (versão vigente, pendente de validação). */
export function PreScreeningConfigTab() {
  const config = useScreeningConfig();
  const updateQuestion = useUpdateQuestion();
  const updateRule = useUpdateRule();
  const [editingQuestion, setEditingQuestion] = useState<QuestionItem | null>(null);
  const [editingRule, setEditingRule] = useState<ScreeningRuleView | null>(null);

  return (
    <QueryState isLoading={config.isLoading} error={config.error} onRetry={() => config.refetch()}>
      {config.data && (
        <div className="space-y-6">
          <Alert
            tone="warn"
            title={`Versão ${config.data.ruleSet.version} · ${VALIDATION_STATUS_LABELS[config.data.ruleSet.validationStatus]}`}
          >
            <p>{config.data.ruleSet.normativeReference}</p>
            <p className="mt-1">
              A pré-triagem só orienta: nunca libera nem impede a doação, e nunca diz “inapto”.
            </p>
          </Alert>
          <ProblemAlert error={updateQuestion.error ?? updateRule.error} />
          {[1, 2, 3, 4, 5, 6].map((step) => {
            const questions = config.data.questions
              .filter((q) => q.step === step)
              .sort((a, b) => a.order - b.order);
            if (questions.length === 0) return null;
            return (
              <Card as="section" key={step} aria-label={`Etapa ${step}`} className="space-y-3">
                <h3 className="text-sm font-semibold tracking-wide text-ink-muted uppercase">
                  Etapa {step}
                </h3>
                {questions.map((question) => {
                  const rules = config.data.rules.filter(
                    (rule) => rule.questionCode === question.code,
                  );
                  return (
                    <div key={question.id} className="rounded-card border border-line p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-ink">{question.text}</p>
                          {question.helpText && (
                            <p className="text-sm text-ink-muted">{question.helpText}</p>
                          )}
                          <p className="mt-1 font-mono text-xs text-ink-muted">
                            {question.code}
                            {question.showIf
                              ? ` · aparece se ${question.showIf.questionCode} = ${String(question.showIf.equals)}`
                              : ''}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge tone={question.active ? 'ok' : 'neutral'}>
                            {question.active ? 'Ativa' : 'Inativa'}
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingQuestion(question)}
                            aria-label={`Editar pergunta ${question.code}`}
                          >
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            loading={
                              updateQuestion.isPending &&
                              updateQuestion.variables?.id === question.id
                            }
                            onClick={() =>
                              updateQuestion.mutate({ id: question.id, active: !question.active })
                            }
                          >
                            {question.active ? 'Desativar' : 'Ativar'}
                          </Button>
                        </div>
                      </div>
                      {rules.map((rule) => (
                        <div
                          key={rule.id}
                          className="mt-3 flex flex-wrap items-start justify-between gap-3 border-t border-line pt-3 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-2">
                              <span className="text-ink-muted">Regra: {ruleCondition(rule)} →</span>
                              <Badge tone={SEVERITY[rule.severity].tone}>
                                {SEVERITY[rule.severity].label}
                              </Badge>
                              <Badge tone="warn">
                                {VALIDATION_STATUS_LABELS[rule.validationStatus]}
                              </Badge>
                            </p>
                            <p className="mt-1 text-ink">“{rule.message}”</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Button size="sm" variant="ghost" onClick={() => setEditingRule(rule)}>
                              Editar mensagem
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              loading={updateRule.isPending && updateRule.variables?.id === rule.id}
                              onClick={() =>
                                updateRule.mutate({ id: rule.id, active: !rule.active })
                              }
                            >
                              {rule.active ? 'Desativar' : 'Ativar'}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </Card>
            );
          })}
          <p className="text-xs text-ink-muted">
            Severidades possíveis: {RULE_SEVERITIES.map((s) => SEVERITY[s].label).join(', ')}.
          </p>
        </div>
      )}
      {editingQuestion && (
        <QuestionDialog question={editingQuestion} onClose={() => setEditingQuestion(null)} />
      )}
      {editingRule && <RuleDialog rule={editingRule} onClose={() => setEditingRule(null)} />}
    </QueryState>
  );
}

function QuestionDialog({ question, onClose }: { question: QuestionItem; onClose: () => void }) {
  const update = useUpdateQuestion();
  const [text, setText] = useState(question.text);
  const [helpText, setHelpText] = useState(question.helpText ?? '');
  return (
    <Dialog
      open
      onClose={onClose}
      title="Editar pergunta"
      description="Mudar o sentido da pergunta exige nova validação por profissional de saúde."
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={text.trim().length < 5}
            loading={update.isPending}
            onClick={() =>
              update.mutate(
                { id: question.id, text: text.trim(), helpText: helpText.trim() || null },
                { onSuccess: onClose },
              )
            }
          >
            Salvar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextAreaField
          label="Pergunta"
          value={text}
          maxLength={300}
          onChange={(e) => setText(e.target.value)}
        />
        <TextField
          label="Texto de ajuda (opcional)"
          value={helpText}
          onChange={(e) => setHelpText(e.target.value)}
        />
        <ProblemAlert error={update.error} />
      </div>
    </Dialog>
  );
}

function RuleDialog({ rule, onClose }: { rule: ScreeningRuleView; onClose: () => void }) {
  const update = useUpdateRule();
  const [message, setMessage] = useState(rule.message);
  return (
    <Dialog
      open
      onClose={onClose}
      title="Editar orientação da regra"
      description="Mensagem mostrada ao doador. Use {date} para a data informativa. Não use a palavra “inapto”."
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={message.trim().length < 5}
            loading={update.isPending}
            onClick={() =>
              update.mutate({ id: rule.id, message: message.trim() }, { onSuccess: onClose })
            }
          >
            Salvar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextAreaField
          label="Mensagem"
          value={message}
          maxLength={400}
          onChange={(e) => setMessage(e.target.value)}
        />
        <ProblemAlert error={update.error} />
      </div>
    </Dialog>
  );
}
