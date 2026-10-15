import { useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import type { Quantity } from '../../engine/actions';
import { BALANCE } from '../../engine/config/balance';
import { EVENT_BY_ID } from '../../engine/config/events';
import { UPGRADES } from '../../engine/config/upgrades';
import { clickValue, incomeBreakdown, isBoostActive, netWorth, upgradeCost, upgradeLevel } from '../../engine/economy';
import { formatDuration, formatMoney, formatRate, maxAffordable, toCents } from '../../engine/money';
import { currentTutorialMission, missionProgress } from '../../engine/progress';
import { Money, Progress, QtySelector, Section } from '../components/common';
import { useGame, useNav } from '../context';
import { playSound } from '../sound';

interface Floater {
  id: number;
  x: number;
  y: number;
  text: string;
}

const TIERS: [bigint, string][] = [
  [100_000_000_000_000n, 'BLACK'],
  [100_000_000_000n, 'PLATINUM'],
  [100_000_000n, 'GOLD'],
  [0n, 'CLASSIC'],
];

export function HomeTab() {
  const { s, dispatch, store } = useGame();
  const nav = useNav();
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const seq = useRef(0);
  const [qty, setQty] = useState<Quantity>(1);

  const income = incomeBreakdown(s);
  const click = clickValue(s, income.passiveNet);
  const nw = netWorth(s);
  const tier = TIERS.find(([min]) => nw.total >= min)![1];
  const boostActive = isBoostActive(s);
  const boostReady = s.gameTime >= s.boost.cooldownUntil;
  const tutorial = currentTutorialMission(s);

  // Toque/mouse usam pointerdown (resposta imediata, multitoque). Teclado (Enter/Espaço) gera click com detail 0.
  const onKeyboardTap = (e: MouseEvent<HTMLElement>) => {
    if (e.detail !== 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    onTap({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
  };

  const onTap = (e: Pick<PointerEvent<HTMLElement>, 'clientX' | 'clientY'>) => {
    const res = dispatch({ type: 'click' });
    if (!res.ok) return;
    playSound(s.settings, 'click');
    if (s.settings.animations && !s.settings.reduceMotion) {
      const id = ++seq.current;
      const text = `+${formatMoney(toCents(click, 'floor'), { compact: true })}`;
      setFloaters((f) => [...f.slice(-10), { id, x: e.clientX, y: e.clientY, text }]);
      setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 900);
    }
  };

  const cardDigits = String(Math.abs(s.createdAt) % 10_000).padStart(4, '0');
  const events = [...s.events.active, ...(s.events.upcoming ? [s.events.upcoming] : [])];

  return (
    <div>
      <div className="hero">
        <button className={`bank-card ${boostActive ? 'boost' : ''}`} onPointerDown={onTap} onClick={onKeyboardTap} aria-label={`Cartão: toque para ganhar ${formatMoney(toCents(click, 'floor'))}`}>
          <div className="top">
            <div>
              <div className="bank-name">TYCOON BANK</div>
              <div className="tier">{tier}</div>
            </div>
            <div className="chip-ic" aria-hidden="true" />
          </div>
          <div>
            <div className="balance-label">Saldo disponível</div>
            <div className="balance num">{formatMoney(s.balance, { compact: s.balance >= 100_000_000n })}</div>
            {s.debt > 0n && <div className="debt-pill num">Dívida operacional: {formatMoney(s.debt, { compact: true })}</div>}
          </div>
          <div className="bottom">
            <span className="card-num">•••• •••• •••• {cardDigits}</span>
            <span className="num">{formatRate(income.net)}</span>
          </div>
        </button>

        <div className="tap-wrap">
          <button className="tap-btn" onPointerDown={onTap} onClick={onKeyboardTap} aria-label="Ganhar dinheiro">
            <span>GANHAR</span>
            <span className="tap-value num">+{formatMoney(toCents(click, 'floor'), { compact: true })}</span>
          </button>
        </div>

        <div className="hero-stats">
          <div className="stat">
            <div className="label">Renda líquida</div>
            <div className={`value num ${income.net < 0 ? 'neg' : 'pos'}`}>{formatRate(income.net)}</div>
          </div>
          <div className="stat">
            <div className="label">Patrimônio</div>
            <div className="value num">{formatMoney(nw.total, { compact: true })}</div>
          </div>
          <div className="stat">
            <div className="label">Por clique</div>
            <div className="value num">{formatMoney(toCents(click, 'floor'), { compact: true })}</div>
          </div>
        </div>

        <button
          className="btn"
          disabled={!boostReady}
          onClick={() => dispatch({ type: 'activateBoost' })}
          title="Multiplica o valor do clique temporariamente. Gratuito, sem anúncios."
        >
          {boostActive
            ? `🔥 Hora do Rush ativa: clique ×${BALANCE.boost.multiplier} · ${formatDuration((s.boost.activeUntil - s.gameTime) / 1000)}`
            : boostReady
              ? `🔥 Ativar Hora do Rush (clique ×${BALANCE.boost.multiplier} por ${BALANCE.boost.durationMs / 1000}s)`
              : `🔥 Hora do Rush recarrega em ${formatDuration((s.boost.cooldownUntil - s.gameTime) / 1000)}`}
        </button>
      </div>

      {tutorial && <TutorialCard />}

      {events.length > 0 && (
        <Section title="Economia agora" hint={<button className="btn ghost small" onClick={() => nav('patrimonio')}>Detalhes</button>}>
          <div className="list">
            {events.map((ev) => {
              const def = EVENT_BY_ID[ev.defId];
              const upcoming = ev.startsAt > s.gameTime;
              return (
                <div key={ev.defId + ev.startsAt} className="card">
                  <div className="row">
                    <div className="item-icon">{def.icon}</div>
                    <div className="grow">
                      <div className="row between">
                        <span className="item-title">{def.name}</span>
                        <span className={`chip ${upcoming ? 'info' : def.tone === 'good' ? 'good' : def.tone === 'bad' ? 'bad' : 'gold'}`}>
                          {upcoming ? `em ${formatDuration((ev.startsAt - s.gameTime) / 1000)}` : `${formatDuration((ev.endsAt - s.gameTime) / 1000)} restantes`}
                        </span>
                      </div>
                      <div className="small muted">{upcoming ? def.advice : def.description}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      <Section title="Melhorias" right={<QtySelector value={qty} onChange={setQty} />}>
        <div className="list">
          {UPGRADES.map((u) => {
            const lvl = upgradeLevel(s, u.id);
            const unlocked = lvl > 0 || nw.total >= BigInt(u.unlockNetWorth);
            const maxed = lvl >= u.maxLevel;
            if (!unlocked) {
              return (
                <div key={u.id} className="card locked">
                  <div className="row">
                    <div className="item-icon">🔒</div>
                    <div className="grow">
                      <div className="item-title">{u.name}</div>
                      <div className="small muted">Libera com patrimônio de {formatMoney(BigInt(u.unlockNetWorth), { compact: true })}</div>
                    </div>
                  </div>
                </div>
              );
            }
            const room = u.maxLevel - lvl;
            const n = maxed ? 0 : qty === 'max' ? Math.max(1, maxAffordable(u.baseCost * BALANCE.costMultiplier, u.growth, lvl, s.balance, room)) : Math.min(qty, room);
            const cost = maxed ? 0n : upgradeCost(s, u.id, n);
            return (
              <div key={u.id} className="card">
                <div className="row">
                  <div className="item-icon">{u.icon}</div>
                  <div className="grow">
                    <div className="row between">
                      <span className="item-title">{u.name}</span>
                      <span className="chip">
                        Nv {lvl}
                        {u.maxLevel < 1000 && `/${u.maxLevel}`}
                      </span>
                    </div>
                    <div className="small muted">{u.description}</div>
                  </div>
                </div>
                <div className="actions">
                  <button
                    className="btn primary btn-col"
                    style={{ flex: 1 }}
                    disabled={maxed || cost > s.balance}
                    onClick={() => dispatch({ type: 'buyUpgrade', id: u.id, qty: n })}
                  >
                    {maxed ? (
                      'Nível máximo'
                    ) : (
                      <>
                        <span>Comprar {n > 1 ? `×${n}` : ''}</span>
                        <span className="sub num">{formatMoney(cost, { compact: true })}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <p className="tiny muted" style={{ textAlign: 'center', marginTop: 24 }}>
        {store.saveStatus.error ? (
          <span className="neg">⚠ Falha ao salvar: {store.saveStatus.error}</span>
        ) : (
          <>Salvo automaticamente {store.saveStatus.at ? `às ${new Date(store.saveStatus.at).toLocaleTimeString('pt-BR')}` : ''}</>
        )}
      </p>

      {floaters.map((f) => (
        <div key={f.id} className="floater num" style={{ left: f.x, top: f.y - 20 }}>
          {f.text}
        </div>
      ))}
    </div>
  );
}

function TutorialCard() {
  const { s, dispatch } = useGame();
  const nav = useNav();
  const m = currentTutorialMission(s)!;
  const p = missionProgress(s, m);
  const index = ['t1', 't2', 't3', 't4', 't5', 't6'].indexOf(m.id) + 1;
  return (
    <div className="card guide" style={{ marginTop: 20 }}>
      <div className="step">Tutorial · passo {index} de 6</div>
      <div className="item-title" style={{ marginTop: 4 }}>
        {m.title}
      </div>
      <div className="small muted" style={{ margin: '2px 0 10px' }}>
        {m.description}
      </div>
      <Progress value={p.cur} max={p.target} />
      <div className="actions">
        {p.done ? (
          <button className="btn primary" onClick={() => dispatch({ type: 'claimMission', id: m.id })}>
            Resgatar <Money value={BigInt(m.reward)} />
          </button>
        ) : (
          m.tab !== 'inicio' && (
            <button className="btn" onClick={() => nav(m.tab)}>
              Ir para {m.tab === 'negocios' ? 'Negócios' : m.tab === 'bolsa' ? 'Bolsa' : m.tab === 'patrimonio' ? 'Patrimônio' : m.tab}
            </button>
          )
        )}
        <span className="small muted" style={{ alignSelf: 'center' }}>
          Recompensa: <Money value={BigInt(m.reward)} />
        </span>
      </div>
    </div>
  );
}
