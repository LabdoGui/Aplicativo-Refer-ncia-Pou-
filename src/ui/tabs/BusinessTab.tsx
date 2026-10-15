import { useState } from 'react';
import type { Quantity } from '../../engine/actions';
import { BALANCE } from '../../engine/config/balance';
import { BUSINESSES, BUSINESS_RULES, type BusinessDef } from '../../engine/config/businesses';
import {
  branchCost,
  businessFinancials,
  businessLevelCost,
  businessRequirementMissing,
  businessValue,
  competitorCost,
  incomeBreakdown,
  managerHireCost,
  managerSalary,
  marketingCost,
  netWorth,
  nextMilestone,
  paybackSeconds,
} from '../../engine/economy';
import { formatDuration, formatMoney, formatPercent, formatRate, maxAffordable } from '../../engine/money';
import type { GameState } from '../../engine/types';
import { Modal, QtySelector } from '../components/common';
import { useGame } from '../context';

const RISK_CHIP = { baixo: 'good', médio: 'gold', alto: 'bad', extremo: 'bad' } as const;

export function BusinessTab() {
  const { s } = useGame();
  const [qty, setQty] = useState<Quantity>(1);
  const nw = netWorth(s).total;
  const income = incomeBreakdown(s);
  const owned = BUSINESSES.filter((b) => (s.businesses[b.id]?.level ?? 0) > 0);
  const nextLocked = BUSINESSES.filter((b) => !(s.businesses[b.id]?.level)).slice(0, 4);
  const revenue = owned.reduce((a, b) => a + businessFinancials(s, b.id).revenue, 0);
  const expenses = owned.reduce((a, b) => a + businessFinancials(s, b.id).expenses, 0);

  return (
    <div>
      <h1 className="page-title">Negócios</h1>
      <p className="page-sub">Cada empresa tem margens, riscos e reações a eventos diferentes. Diversifique.</p>
      {owned.length > 0 && (
        <div className="grid-2" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
          <div className="stat">
            <div className="label">Receita</div>
            <div className="value num pos">{formatRate(revenue)}</div>
          </div>
          <div className="stat">
            <div className="label">Despesas</div>
            <div className="value num neg">{formatRate(expenses)}</div>
          </div>
          <div className="stat">
            <div className="label">Lucro</div>
            <div className={`value num ${revenue - expenses >= 0 ? 'pos' : 'neg'}`}>{formatRate(revenue - expenses)}</div>
          </div>
        </div>
      )}
      <div className="section-head" style={{ marginTop: 16 }}>
        <h2>{owned.length ? 'Suas empresas' : 'Abra sua primeira empresa'}</h2>
        <QtySelector value={qty} onChange={setQty} />
      </div>
      <div className="list">
        {owned.map((def) => (
          <BusinessCard key={def.id} def={def} qty={qty} />
        ))}
        {nextLocked.map((def) => (
          <AvailableCard key={def.id} def={def} s={s} nw={nw} />
        ))}
      </div>
      {income.passiveNet < 0 && (
        <p className="small neg" style={{ marginTop: 12 }}>
          Suas despesas estão maiores que as receitas. Venda ou melhore negócios deficitários; despesas não cobertas viram dívida operacional,
          paga automaticamente com a renda futura.
        </p>
      )}
    </div>
  );
}

function AvailableCard({ def, s, nw }: { def: BusinessDef; s: GameState; nw: bigint }) {
  const { dispatch } = useGame();
  const missing = businessRequirementMissing(s, def);
  const unlocked = nw >= BigInt(def.unlockNetWorth) && !missing;
  const cost = businessLevelCost(s, def.id, 1);
  const f = businessFinancials(s, def.id, { level: 1 });
  return (
    <div className={`card ${unlocked ? '' : 'locked'}`}>
      <div className="row">
        <div className="item-icon">{unlocked ? def.icon : '🔒'}</div>
        <div className="grow">
          <div className="row between">
            <span className="item-title">{def.name}</span>
            <span className={`chip ${RISK_CHIP[def.risk]}`}>risco {def.risk}</span>
          </div>
          <div className="small muted">{def.description}</div>
        </div>
      </div>
      <div className="small" style={{ marginTop: 8, color: 'var(--text-2)' }}>
        {def.trait}
      </div>
      <div className="kv">
        <div>
          <div className="k">Preço</div>
          <div className="v num">{formatMoney(cost, { compact: true })}</div>
        </div>
        <div>
          <div className="k">Lucro inicial (sem gerente)</div>
          <div className="v num">{formatRate(f.profit)}</div>
        </div>
        <div>
          <div className="k">Retorno estimado</div>
          <div className="v num">{formatDuration(paybackSeconds(cost, f.profit))}</div>
        </div>
      </div>
      <div className="actions">
        {unlocked ? (
          <button className="btn primary" disabled={cost > s.balance} onClick={() => dispatch({ type: 'buyBusiness', id: def.id, qty: 1 })}>
            Abrir por {formatMoney(cost, { compact: true })}
          </button>
        ) : (
          <span className="small muted">{missing ?? `Libera com patrimônio de ${formatMoney(BigInt(def.unlockNetWorth), { compact: true })}`}</span>
        )}
      </div>
    </div>
  );
}

function BusinessCard({ def, qty }: { def: BusinessDef; qty: Quantity }) {
  const { s, dispatch } = useGame();
  const [confirmSell, setConfirmSell] = useState(false);
  const b = s.businesses[def.id];
  const f = businessFinancials(s, def.id);
  const room = def.maxLevel - b.level;
  const n =
    room <= 0 ? 0 : qty === 'max' ? Math.max(1, maxAffordable(def.baseCost * BALANCE.costMultiplier, def.growth, b.level, s.balance, room)) : Math.min(qty, room);
  const levelCost = n > 0 ? businessLevelCost(s, def.id, n) : 0n;
  const after = businessFinancials(s, def.id, { level: b.level + n });
  const gain = after.profit - f.profit;
  const ms = nextMilestone(b.level);
  const margin = f.revenue > 0 ? f.profit / f.revenue : 0;

  const mgrCost = managerHireCost(def);
  const withMgr = businessFinancials(s, def.id, { manager: true });
  const mktCost = marketingCost(def, b.marketing);
  const brCost = branchCost(def, b.branches);
  const brNeed = BUSINESS_RULES.branchLevelStep * (b.branches + 1);
  const compCost = competitorCost(def);

  return (
    <div className="card">
      <div className="row">
        <div className="item-icon">{def.icon}</div>
        <div className="grow">
          <div className="row between">
            <span className="item-title ellipsis">{def.name}</span>
            <span className="chip">Nv {b.level}</span>
          </div>
          <div className="row small" style={{ gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
            <span className={`chip ${RISK_CHIP[def.risk]}`}>risco {def.risk}</span>
            {b.manager ? <span className="chip good">gerente</span> : <span className="chip bad">sem gerente (60%)</span>}
            {b.branches > 0 && <span className="chip info">{b.branches} filial(is)</span>}
            {b.acquiredCompetitor && <span className="chip gold">+concorrente</span>}
            {f.eventRevenueMult !== 1 && (
              <span className={`chip ${f.eventRevenueMult > 1 ? 'good' : 'bad'}`}>evento {formatPercent(f.eventRevenueMult - 1, 0, true)}</span>
            )}
          </div>
        </div>
      </div>

      <div className="kv">
        <div>
          <div className="k">Receita</div>
          <div className="v num pos">{formatRate(f.revenue)}</div>
        </div>
        <div>
          <div className="k">Despesas</div>
          <div className="v num neg">{formatRate(f.expenses)}</div>
        </div>
        <div>
          <div className="k">Lucro líquido</div>
          <div className={`v num ${f.profit >= 0 ? 'pos' : 'neg'}`}>{formatRate(f.profit)}</div>
        </div>
        <div>
          <div className="k">Margem</div>
          <div className="v num">{formatPercent(margin)}</div>
        </div>
        <div>
          <div className="k">Funcionários</div>
          <div className="v num">{f.staff.toLocaleString('pt-BR')}</div>
        </div>
        <div>
          <div className="k">Próximo marco</div>
          <div className="v num">{ms ? `Nv ${ms} (receita ×2)` : '—'}</div>
        </div>
      </div>

      <div className="actions">
        <button className="btn primary btn-col" style={{ flex: '1 1 160px' }} disabled={n <= 0 || levelCost > s.balance} onClick={() => dispatch({ type: 'buyBusiness', id: def.id, qty: n })}>
          {n <= 0 ? (
            'Nível máximo'
          ) : (
            <>
              <span>
                Expandir {n > 1 ? `×${n}` : ''} · {formatMoney(levelCost, { compact: true })}
              </span>
              <span className="sub num">
                +{formatRate(gain)} · retorno {formatDuration(paybackSeconds(levelCost, gain))}
              </span>
            </>
          )}
        </button>
      </div>

      <details>
        <summary>Gestão e expansão</summary>
        <div className="list" style={{ marginTop: 10 }}>
          {!b.manager && (
            <ManageRow
              title="Contratar gerente"
              detail={`Operação a 100%. Salário: ${formatRate(managerSalary(def, b.branches))}. Lucro passa a ${formatRate(withMgr.profit)}.`}
              cost={mgrCost}
              onClick={() => dispatch({ type: 'hireManager', id: def.id })}
              disabled={mgrCost > s.balance}
            />
          )}
          <ManageRow
            title={`Marketing (${b.marketing}/${BUSINESS_RULES.maxMarketing})`}
            detail={`+${BUSINESS_RULES.marketingBonus * 100}% de receita por nível.`}
            cost={b.marketing < BUSINESS_RULES.maxMarketing ? mktCost : null}
            onClick={() => dispatch({ type: 'buyMarketing', id: def.id })}
            disabled={mktCost > s.balance}
          />
          <ManageRow
            title={`Nova filial (${b.branches}/${BUSINESS_RULES.maxBranches})`}
            detail={`Cada filial soma uma operação inteira. Exige nível ${brNeed} e gerente; aumenta o salário do gerente.`}
            cost={b.branches < BUSINESS_RULES.maxBranches ? brCost : null}
            onClick={() => dispatch({ type: 'openBranch', id: def.id })}
            disabled={brCost > s.balance || b.level < brNeed || !b.manager}
            blocked={b.level < brNeed ? `Exige nível ${brNeed}` : !b.manager ? 'Exige gerente' : undefined}
          />
          <ManageRow
            title="Adquirir concorrente"
            detail={`Compra uma concorrente fictícia: +${BUSINESS_RULES.competitorBonus * 100}% de receita permanente. Exige nível ${BUSINESS_RULES.competitorLevel}.`}
            cost={b.acquiredCompetitor ? null : compCost}
            onClick={() => dispatch({ type: 'acquireCompetitor', id: def.id })}
            disabled={compCost > s.balance || b.level < BUSINESS_RULES.competitorLevel}
            blocked={b.level < BUSINESS_RULES.competitorLevel ? `Exige nível ${BUSINESS_RULES.competitorLevel}` : undefined}
          />
          <p className="small muted" style={{ margin: 0 }}>
            {def.trait}
          </p>
          <button className="btn danger" onClick={() => setConfirmSell(true)}>
            Vender empresa por {formatMoney(businessValue(s, def.id), { compact: true })}
          </button>
        </div>
      </details>

      {confirmSell && (
        <Modal label="Confirmar venda" onClose={() => setConfirmSell(false)}>
          <h2>Vender {def.name}?</h2>
          <p className="small muted">
            Você recebe {Math.round(BALANCE.businessResaleRatio * 100)}% do total investido ({formatMoney(b.invested, { compact: true })}):{' '}
            <strong className="num">{formatMoney(businessValue(s, def.id), { compact: true })}</strong>. O nível, gerente, marketing e filiais
            são perdidos.
          </p>
          <div className="actions">
            <button className="btn ghost" onClick={() => setConfirmSell(false)}>
              Cancelar
            </button>
            <button
              className="btn danger"
              onClick={() => {
                dispatch({ type: 'sellBusiness', id: def.id });
                setConfirmSell(false);
              }}
            >
              Confirmar venda
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ManageRow({
  title,
  detail,
  cost,
  onClick,
  disabled,
  blocked,
}: {
  title: string;
  detail: string;
  cost: bigint | null;
  onClick: () => void;
  disabled: boolean;
  blocked?: string;
}) {
  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div className="grow">
        <div className="small" style={{ fontWeight: 600 }}>
          {title}
        </div>
        <div className="tiny muted">{detail}</div>
      </div>
      {cost === null ? (
        <span className="chip good">concluído</span>
      ) : (
        <button className="btn" disabled={disabled} onClick={onClick} title={blocked}>
          {blocked ?? formatMoney(cost, { compact: true })}
        </button>
      )}
    </div>
  );
}
