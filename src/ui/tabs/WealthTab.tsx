import { useRef, useState } from 'react';
import { BALANCE } from '../../engine/config/balance';
import { EVENTS, EVENT_BY_ID } from '../../engine/config/events';
import {
  explainPassiveMultiplier,
  incomeBreakdown,
  netWorth,
  prestigeMultiplier,
  prestigePointsAvailable,
} from '../../engine/economy';
import { formatDuration, formatMoney, formatRate, toCents } from '../../engine/money';
import { newGame } from '../../engine/simulation';
import type { LedgerCategory } from '../../engine/types';
import { FlowBars, StackBar } from '../components/charts';
import { Modal, Money, Section } from '../components/common';
import { useGame } from '../context';

const CAT_LABEL: Record<LedgerCategory, string> = {
  clique: 'Cliques',
  renda: 'Renda',
  despesa: 'Despesa',
  melhoria: 'Melhoria',
  negocio: 'Negócio',
  acao: 'Ação',
  cripto: 'Cripto',
  imovel: 'Imóvel',
  dividendo: 'Dividendo',
  taxa: 'Taxa',
  recompensa: 'Recompensa',
  offline: 'Offline',
  divida: 'Dívida',
  sistema: 'Sistema',
};

const FILTERS: { id: string; label: string; cats: LedgerCategory[] | null }[] = [
  { id: 'all', label: 'Tudo', cats: null },
  { id: 'renda', label: 'Renda', cats: ['renda', 'despesa', 'clique', 'offline', 'dividendo', 'recompensa'] },
  { id: 'compras', label: 'Compras', cats: ['melhoria', 'negocio', 'imovel'] },
  { id: 'mercado', label: 'Mercado', cats: ['acao', 'cripto', 'dividendo'] },
  { id: 'taxas', label: 'Taxas', cats: ['taxa'] },
];

export function WealthTab() {
  const { s } = useGame();
  const nw = netWorth(s);
  const inc = incomeBreakdown(s);
  const [filter, setFilter] = useState('all');
  const [showAll, setShowAll] = useState(false);
  const cats = FILTERS.find((f) => f.id === filter)!.cats;
  const ledger = s.ledger.filter((e) => !cats || cats.includes(e.category)).slice().reverse();
  const flows = s.flow.history.slice(-30);
  const mults = explainPassiveMultiplier(s);

  return (
    <div>
      <h1 className="page-title">Patrimônio</h1>
      <p className="page-sub">Tudo o que você tem, de onde vem cada real e para onde ele vai.</p>

      <div className="card">
        <div className="small muted">Patrimônio líquido</div>
        <div className="num" style={{ fontSize: 28, fontWeight: 800 }}>
          {formatMoney(nw.total, { compact: true })}
        </div>
        <div className="small muted" style={{ marginBottom: 12 }}>
          Pico nesta partida: {formatMoney(s.stats.peakNetWorth, { compact: true })}
        </div>
        <StackBar
          parts={[
            { label: 'Caixa', value: Number(nw.cash), color: 'var(--series-1)', display: formatMoney(nw.cash, { compact: true }) },
            { label: 'Negócios (valor de revenda)', value: Number(nw.businesses), color: 'var(--series-2)', display: formatMoney(nw.businesses, { compact: true }) },
            { label: 'Ações', value: Number(nw.stocks), color: 'var(--series-3)', display: formatMoney(nw.stocks, { compact: true }) },
            { label: 'Imóveis', value: Number(nw.realEstate), color: 'var(--series-4)', display: formatMoney(nw.realEstate, { compact: true }) },
            { label: 'Criptomoedas', value: Number(nw.crypto), color: 'var(--series-5)', display: formatMoney(nw.crypto, { compact: true }) },
          ]}
        />
        {nw.debt > 0n && (
          <div className="row between small" style={{ marginTop: 8 }}>
            <span className="neg">Dívida operacional (descontada)</span>
            <span className="num neg">-{formatMoney(nw.debt, { compact: true })}</span>
          </div>
        )}
      </div>

      <Section title="Fluxo de caixa" hint="Resultado líquido por minuto">
        <div className="card">
          <FlowBars
            values={flows.map((f) => Number(f.credited))}
            labels={flows.map((f) => `${Math.round((s.gameTime - f.end) / 60_000)} min atrás`)}
            format={(v) => formatMoney(toCents(v), { compact: true, sign: true })}
          />
          <div className="grid-2" style={{ marginTop: 12 }}>
            <div>
              <div className="small muted">Entradas por segundo</div>
              <div className="num pos" style={{ fontWeight: 700 }}>
                {formatRate(inc.income)}
              </div>
            </div>
            <div>
              <div className="small muted">Saídas por segundo</div>
              <div className="num neg" style={{ fontWeight: 700 }}>
                {formatRate(inc.expenses)}
              </div>
            </div>
          </div>
          <details>
            <summary>Ver cada fonte de receita e despesa</summary>
            <div style={{ marginTop: 8 }}>
              {Object.entries(inc.sources)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => (
                  <div key={k} className="row between small" style={{ padding: '4px 0' }}>
                    <span>{k}</span>
                    <span className="num pos">{formatRate(v)}</span>
                  </div>
                ))}
              {Object.entries(inc.costs)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => (
                  <div key={k} className="row between small" style={{ padding: '4px 0' }}>
                    <span>{k}</span>
                    <span className="num neg">-{formatRate(v)}</span>
                  </div>
                ))}
              {mults.length > 0 && (
                <p className="tiny muted">Multiplicadores aplicados à renda passiva: {mults.map((m) => `${m.label} ${m.value}`).join(' · ')}</p>
              )}
              <p className="tiny muted">
                Não existem impostos ocultos: as únicas saídas são despesas operacionais, salários de gerentes, manutenção de imóveis e as
                taxas de negociação mostradas antes de cada operação.
              </p>
            </div>
          </details>
        </div>
      </Section>

      <EventsSection />

      <Section title="Histórico financeiro" hint={`${s.ledger.length} registros`}>
        <div className="seg" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => (
            <button key={f.id} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="card">
          {ledger.length === 0 && <div className="empty">Nenhuma transação ainda.</div>}
          {(showAll ? ledger : ledger.slice(0, 25)).map((e) => (
            <div key={e.id} className="ledger-row">
              <div style={{ minWidth: 0 }}>
                <div className="ellipsis">{e.description}</div>
                <div className="tiny muted">
                  {CAT_LABEL[e.category]} · {new Date(e.realAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                </div>
                {e.breakdown && (
                  <details>
                    <summary className="tiny">detalhes</summary>
                    {Object.entries(e.breakdown).map(([k, v]) => (
                      <div key={k} className="row between tiny">
                        <span>{k}</span>
                        <Money value={v} sign colored />
                      </div>
                    ))}
                  </details>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <Money value={e.amount} sign colored />
                <div className="tiny muted num">saldo {formatMoney(e.balanceAfter, { compact: true })}</div>
              </div>
            </div>
          ))}
          {!showAll && ledger.length > 25 && (
            <button className="btn ghost block" onClick={() => setShowAll(true)}>
              Mostrar todos ({ledger.length})
            </button>
          )}
        </div>
      </Section>

      <PrestigeSection />
      <StatsSection />
      <SettingsSection />
    </div>
  );
}

function EventsSection() {
  const { s } = useGame();
  const list = [...s.events.active, ...(s.events.upcoming ? [s.events.upcoming] : [])];
  return (
    <Section title="Eventos econômicos" hint="Anunciados 1 min antes">
      <div className="card">
        {list.length === 0 && (
          <div className="small muted">
            Nenhum evento ativo.{' '}
            {Object.keys(s.businesses).length === 0 && Object.keys(s.portfolio).length === 0
              ? 'Eventos começam depois que você tiver um negócio ou investimento.'
              : `Próxima previsão em cerca de ${formatDuration(Math.max(0, s.events.nextAt - BALANCE.events.warningMs - s.gameTime) / 1000)}.`}
          </div>
        )}
        {list.map((ev) => {
          const def = EVENT_BY_ID[ev.defId];
          const upcoming = ev.startsAt > s.gameTime;
          return (
            <div key={ev.defId + ev.startsAt} className="ledger-row" style={{ gridTemplateColumns: '1fr' }}>
              <div>
                <div className="row between">
                  <strong>
                    {def.icon} {def.name}
                  </strong>
                  <span className="chip">
                    {upcoming ? `começa em ${formatDuration((ev.startsAt - s.gameTime) / 1000)}` : `termina em ${formatDuration((ev.endsAt - s.gameTime) / 1000)}`}
                  </span>
                </div>
                <div className="small muted">{def.description}</div>
                <div className="small" style={{ marginTop: 4 }}>
                  💡 {def.advice}
                </div>
                <div className="tiny muted" style={{ marginTop: 4 }}>
                  Efeitos:{' '}
                  {[
                    ...Object.entries(def.effects.businessRevenue ?? {}).map(([k, v]) => `receita ${k} ${v > 1 ? '+' : ''}${Math.round((v - 1) * 100)}%`),
                    ...Object.entries(def.effects.businessExpense ?? {}).slice(0, 3).map(([k, v]) => `despesas ${k} +${Math.round((v - 1) * 100)}%`),
                    def.effects.rentMultiplier ? `aluguéis +${Math.round((def.effects.rentMultiplier - 1) * 100)}%` : null,
                    def.effects.regionDrift ? 'preços de imóveis ' + (Object.values(def.effects.regionDrift)[0] > 0 ? 'em alta' : 'em baixa') : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
            </div>
          );
        })}
        <details>
          <summary>Todos os eventos possíveis ({EVENTS.length})</summary>
          {EVENTS.map((e) => (
            <div key={e.id} className="small" style={{ padding: '6px 0' }}>
              <strong>
                {e.icon} {e.name}
              </strong>{' '}
              <span className="muted">— {e.description}</span>
            </div>
          ))}
        </details>
      </div>
    </Section>
  );
}

function PrestigeSection() {
  const { s, dispatch, store } = useGame();
  const [confirm, setConfirm] = useState(false);
  const pts = prestigePointsAvailable(s);
  const next = 1 + (s.prestige.points + pts) * BALANCE.prestige.bonusPerPoint;
  return (
    <Section title="Legado (prestígio opcional)">
      <div className="card">
        <p className="small" style={{ marginTop: 0 }}>
          Reinicie a partida em troca de pontos de Legado: cada ponto dá <strong>+{BALANCE.prestige.bonusPerPoint * 100}%</strong> em toda renda,
          para sempre. Conquistas, missões resgatadas e configurações são mantidas.
        </p>
        <div className="kv">
          <div>
            <div className="k">Pontos atuais</div>
            <div className="v num">{s.prestige.points}</div>
          </div>
          <div>
            <div className="k">Bônus atual</div>
            <div className="v num">×{prestigeMultiplier(s).toFixed(2)}</div>
          </div>
          <div>
            <div className="k">Ganharia agora</div>
            <div className="v num gold">+{pts}</div>
          </div>
        </div>
        <p className="tiny muted">
          Pontos = √(todo o dinheiro já ganho ÷ {formatMoney(BigInt(BALANCE.prestige.unit), { compact: true })}) − pontos já recebidos. Exige
          patrimônio de {formatMoney(BigInt(BALANCE.prestige.minNetWorth), { compact: true })} nesta partida.
        </p>
        <button className="btn" disabled={pts <= 0} onClick={() => setConfirm(true)}>
          Reiniciar com Legado
        </button>
      </div>
      {confirm && (
        <Modal label="Confirmar Legado" onClose={() => setConfirm(false)}>
          <h2>Iniciar novo Legado?</h2>
          <p className="small muted">
            Você perderá caixa, negócios, investimentos e imóveis desta partida e receberá <strong className="gold">+{pts} pontos</strong>. Toda
            renda passará a ×{next.toFixed(2)}. Uma cópia do save atual é guardada antes.
          </p>
          <div className="actions">
            <button className="btn ghost" onClick={() => setConfirm(false)}>
              Cancelar
            </button>
            <button
              className="btn primary"
              onClick={async () => {
                setConfirm(false);
                await store.saves.snapshot('pre-prestige');
                dispatch({ type: 'prestige' });
              }}
            >
              Confirmar
            </button>
          </div>
        </Modal>
      )}
    </Section>
  );
}

function StatsSection() {
  const { s } = useGame();
  return (
    <Section title="Estatísticas">
      <div className="card kv" style={{ marginTop: 0 }}>
        <div>
          <div className="k">Cliques</div>
          <div className="v num">{s.stats.clicks.toLocaleString('pt-BR')}</div>
        </div>
        <div>
          <div className="k">Ganho com cliques</div>
          <div className="v num">{formatMoney(s.stats.clickEarned, { compact: true })}</div>
        </div>
        <div>
          <div className="k">Total ganho (partida)</div>
          <div className="v num">{formatMoney(s.stats.totalEarned, { compact: true })}</div>
        </div>
        <div>
          <div className="k">Total ganho (histórico)</div>
          <div className="v num">{formatMoney(s.stats.lifetimeEarned, { compact: true })}</div>
        </div>
        <div>
          <div className="k">Total gasto</div>
          <div className="v num">{formatMoney(s.stats.totalSpent, { compact: true })}</div>
        </div>
        <div>
          <div className="k">Dividendos</div>
          <div className="v num">{formatMoney(s.dividendsReceived, { compact: true })}</div>
        </div>
        <div>
          <div className="k">Operações lucrativas</div>
          <div className="v num">{s.stats.profitableTrades}</div>
        </div>
        <div>
          <div className="k">Crises superadas</div>
          <div className="v num">{s.stats.crisesSurvived}</div>
        </div>
        <div>
          <div className="k">Tempo de jogo</div>
          <div className="v num">{formatDuration(s.gameTime / 1000)}</div>
        </div>
      </div>
    </Section>
  );
}

function SettingsSection() {
  const { s, dispatch, store } = useGame();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importText, setImportText] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const toggle = (key: 'animations' | 'sound' | 'reduceMotion') => dispatch({ type: 'updateSettings', patch: { [key]: !s.settings[key] } });

  const doExport = () => {
    const text = store.saves.exportSave(s);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tycoon-empire-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const [exported, setExported] = useState<string | null>(null);
  const doCopy = async () => {
    const text = store.saves.exportSave(s);
    try {
      await navigator.clipboard.writeText(text);
      store.pushToast({ kind: 'success', title: 'Save copiado', detail: 'Cole em um lugar seguro (notas, e-mail) para restaurar depois.' });
    } catch {
      setExported(text); // sem acesso à área de transferência: mostra o texto para copiar manualmente
    }
  };

  const doImport = async (text: string) => {
    try {
      const next = await store.saves.importSave(text);
      await store.replaceState(next);
      store.pushToast({ kind: 'success', title: 'Save importado com sucesso' });
      setImportText('');
    } catch (e) {
      store.pushToast({ kind: 'error', title: 'Importação recusada', detail: (e as Error).message });
    }
  };

  return (
    <Section title="Configurações e salvamento">
      <div className="card list">
        <Toggle label="Animações" detail="Dinheiro flutuante ao clicar." on={s.settings.animations} onClick={() => toggle('animations')} />
        <Toggle label="Reduzir movimento" detail="Remove animações e transições." on={s.settings.reduceMotion} onClick={() => toggle('reduceMotion')} />
        <Toggle label="Sons" detail="Efeitos sonoros curtos." on={s.settings.sound} onClick={() => toggle('sound')} />
        <hr style={{ border: 0, borderTop: '1px solid var(--border)', width: '100%' }} />
        <div className="small muted">
          Salvamento automático a cada 10 s e a cada compra ({store.saves.storage.kind}), com backup rotativo. Progresso offline limitado a{' '}
          {formatDuration(BALANCE.offline.capMs / 1000)}.
        </div>
        <div className="actions" style={{ marginTop: 0 }}>
          <button className="btn" onClick={() => void store.save().then(() => store.pushToast({ kind: 'success', title: 'Jogo salvo' }))}>
            Salvar agora
          </button>
          <button className="btn" onClick={doCopy}>
            Copiar save
          </button>
          <button className="btn" onClick={doExport}>
            Baixar arquivo
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Importar arquivo
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json,.txt"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) await doImport(await f.text());
              e.target.value = '';
            }}
          />
        </div>
        {exported && (
          <div>
            <label className="small muted" htmlFor="export-text">
              Selecione e copie o texto abaixo:
            </label>
            <textarea id="export-text" readOnly value={exported} onFocus={(e) => e.currentTarget.select()} />
          </div>
        )}
        <details>
          <summary>Colar save como texto</summary>
          <textarea id="import-text" value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="Cole aqui o conteúdo exportado" />
          <button className="btn" style={{ marginTop: 8 }} disabled={!importText.trim()} onClick={() => doImport(importText)}>
            Importar texto
          </button>
        </details>
        <button className="btn danger" onClick={() => setConfirmReset(true)}>
          Começar do zero
        </button>
      </div>
      {confirmReset && (
        <Modal label="Confirmar novo jogo" onClose={() => setConfirmReset(false)}>
          <h2>Apagar a partida e recomeçar?</h2>
          <p className="small muted">Tudo será zerado, inclusive Legado e conquistas. Uma cópia do save atual fica guardada internamente antes.</p>
          <div className="actions">
            <button className="btn ghost" onClick={() => setConfirmReset(false)}>
              Cancelar
            </button>
            <button
              className="btn danger"
              onClick={async () => {
                setConfirmReset(false);
                await store.replaceState(newGame());
              }}
            >
              Apagar e recomeçar
            </button>
          </div>
        </Modal>
      )}
    </Section>
  );
}

function Toggle({ label, detail, on, onClick }: { label: string; detail: string; on: boolean; onClick: () => void }) {
  return (
    <div className="row">
      <div className="grow">
        <div style={{ fontWeight: 600 }}>{label}</div>
        <div className="tiny muted">{detail}</div>
      </div>
      <button className={`btn ${on ? 'primary' : ''}`} role="switch" aria-checked={on} aria-label={label} onClick={onClick} style={{ minWidth: 70 }}>
        {on ? 'Ligado' : 'Desligado'}
      </button>
    </div>
  );
}
