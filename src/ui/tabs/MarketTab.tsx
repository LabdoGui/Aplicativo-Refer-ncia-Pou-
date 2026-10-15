import { useState } from 'react';
import { ASSETS, ASSET_BY_ID, type AssetKind } from '../../engine/config/assets';
import { BALANCE } from '../../engine/config/balance';
import { netWorth } from '../../engine/economy';
import { averagePrice, feeRate, maxBuyQty, quoteBuy, quoteSell, regimeLabel, unrealizedPnL } from '../../engine/market';
import { formatMoney, formatPercent, toCents } from '../../engine/money';
import { LineChart, Sparkline } from '../components/charts';
import { Money, Section } from '../components/common';
import { useGame } from '../context';

const RISK_CHIP = { baixo: 'good', médio: 'gold', alto: 'bad', extremo: 'bad' } as const;

export function MarketTab({ kind }: { kind: AssetKind }) {
  const { s } = useGame();
  const nw = netWorth(s).total;
  const list = ASSETS.filter((a) => a.kind === kind);
  const [selected, setSelected] = useState<string>(list[0].id);
  const regime = s.market.regime.kind;

  let invested = 0n;
  let value = 0n;
  for (const a of list) {
    const h = s.portfolio[a.id];
    if (!h) continue;
    invested += h.costBasis;
    value += s.market.assets[a.id].price * BigInt(h.qty);
  }
  const realized = kind === 'crypto' ? s.realizedPnL.crypto : s.realizedPnL.stock;
  const news = s.market.news.filter((n) => !n.assetId || ASSET_BY_ID[n.assetId]?.kind === kind).slice(0, 8);

  return (
    <div>
      <h1 className="page-title">{kind === 'stock' ? 'Bolsa de valores' : 'Criptomoedas'}</h1>
      <p className="page-sub">
        {kind === 'stock'
          ? 'Preços seguem tendência, resultados trimestrais, clima do mercado e eventos do setor. Algumas ações pagam dividendos.'
          : 'Alta volatilidade e nenhum lucro garantido. Taxa de 0,5% por operação. Diversifique e controle o risco.'}
      </p>

      <div className="grid-2">
        <div className="stat">
          <div className="label">Carteira</div>
          <div className="value num">{formatMoney(value, { compact: true })}</div>
        </div>
        <div className="stat">
          <div className="label">Não realizado</div>
          <div className={`value num ${value - invested >= 0n ? 'pos' : 'neg'}`}>{formatMoney(value - invested, { compact: true, sign: true })}</div>
        </div>
        <div className="stat">
          <div className="label">Realizado</div>
          <div className={`value num ${realized >= 0n ? 'pos' : 'neg'}`}>{formatMoney(realized, { compact: true, sign: true })}</div>
        </div>
        <div className="stat">
          <div className="label">Clima</div>
          <div className={`value ${regime === 'alta' ? 'pos' : regime === 'baixa' ? 'neg' : ''}`} style={{ fontSize: 14 }}>
            {regimeLabel(regime)}
          </div>
        </div>
      </div>

      <AssetDetail id={selected} />

      <Section title="Ativos" hint="Toque para ver o gráfico e negociar">
        <div className="list">
          {list.map((a) => {
            const st = s.market.assets[a.id];
            const unlocked = s.portfolio[a.id] || nw >= BigInt(a.unlockNetWorth);
            const change = st.openPrice ? Number(st.price) / st.openPrice - 1 : 0;
            const h = s.portfolio[a.id];
            if (!unlocked) {
              return (
                <div key={a.id} className="card locked">
                  <div className="row">
                    <div className="item-icon">🔒</div>
                    <div className="grow">
                      <div className="item-title">{a.name}</div>
                      <div className="small muted">Libera com patrimônio de {formatMoney(BigInt(a.unlockNetWorth), { compact: true })}</div>
                    </div>
                  </div>
                </div>
              );
            }
            return (
              <button key={a.id} className="card asset-row" aria-pressed={selected === a.id} onClick={() => setSelected(a.id)}>
                <div className="row">
                  <div className="grow">
                    <div className="row" style={{ gap: 8 }}>
                      <span className="item-title">{a.ticker}</span>
                      <span className={`chip ${RISK_CHIP[a.risk]}`}>{a.risk}</span>
                      {a.dividendYield > 0 && <span className="chip info">div. {formatPercent(a.dividendYield, 1)}</span>}
                    </div>
                    <div className="small muted ellipsis">
                      {a.name}
                      {h ? ` · ${h.qty.toLocaleString('pt-BR')} em carteira` : ''}
                    </div>
                  </div>
                  <Sparkline values={st.history.slice(-60)} />
                  <div style={{ textAlign: 'right', minWidth: 88 }}>
                    <div className="num" style={{ fontWeight: 650 }}>
                      {formatMoney(st.price, { compact: true })}
                    </div>
                    <div className={`small num ${change >= 0 ? 'pos' : 'neg'}`}>{formatPercent(change, 2, true)}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Notícias do mercado" hint="Explicam os movimentos de preço">
        <div className="card">
          {news.length === 0 && <div className="empty">Sem notícias ainda. Resultados trimestrais saem a cada {(BALANCE.market.stepMs * BALANCE.market.earningsEverySteps) / 60_000} min.</div>}
          {news.map((n) => (
            <div key={n.id} className="ledger-row">
              <div>
                <div style={{ fontWeight: 600 }} className={n.tone === 'good' ? 'pos' : n.tone === 'bad' ? 'neg' : ''}>
                  {n.title}
                </div>
                <div className="small muted">{n.detail}</div>
              </div>
              <div className="tiny muted num">{ago(s.gameTime - n.at)}</div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function ago(ms: number): string {
  const m = Math.floor(ms / 60_000);
  return m < 1 ? 'agora' : `${m} min`;
}

function AssetDetail({ id }: { id: string }) {
  const { s, dispatch } = useGame();
  const def = ASSET_BY_ID[id];
  const st = s.market.assets[id];
  const h = s.portfolio[id];
  const [qtyText, setQtyText] = useState('1');
  const qty = Math.max(0, Math.floor(Number(qtyText.replace(/\D/g, '')) || 0));
  const maxQ = maxBuyQty(s, id);
  const buy = qty > 0 ? quoteBuy(s, id, qty) : null;
  const sell = qty > 0 && h && qty <= h.qty ? quoteSell(s, id, qty) : null;
  const stepSec = BALANCE.market.stepMs / 1000;
  const n = st.history.length - 1;

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="row between">
        <div>
          <div className="item-title">
            {def.ticker} · {def.name}
          </div>
          <div className="small muted">{def.description}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="num" style={{ fontSize: 20, fontWeight: 700, whiteSpace: 'nowrap' }}>
            {formatMoney(st.price, { compact: true })}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <LineChart
          values={st.history}
          ariaLabel={`Histórico de preço de ${def.ticker}`}
          format={(v) => formatMoney(toCents(v), { compact: true })}
          xLabel={(i) => {
            const sec = (n - i) * stepSec;
            return sec === 0 ? 'agora' : sec < 60 ? `-${sec}s` : `-${Math.round(sec / 60)} min`;
          }}
        />
      </div>

      {h && (
        <div className="kv">
          <div>
            <div className="k">Quantidade</div>
            <div className="v num">{h.qty.toLocaleString('pt-BR')}</div>
          </div>
          <div>
            <div className="k">Preço médio</div>
            <div className="v num">{formatMoney(averagePrice(s, id), { compact: true })}</div>
          </div>
          <div>
            <div className="k">Resultado não realizado</div>
            <div className="v">
              <Money value={unrealizedPnL(s, id)} sign colored />
            </div>
          </div>
        </div>
      )}

      <div className="row" style={{ marginTop: 14, gap: 8, flexWrap: 'wrap' }}>
        <label className="small muted" htmlFor={`qty-${id}`} style={{ width: '100%' }}>
          Quantidade · taxa de corretagem {formatPercent(feeRate(def), 2)} por operação
        </label>
        <input
          id={`qty-${id}`}
          type="text"
          inputMode="numeric"
          value={qtyText}
          onChange={(e) => setQtyText(e.target.value.replace(/\D/g, '').slice(0, 10))}
          style={{ flex: '1 1 100%', minWidth: 0 }}
        />
        <button className="btn" onClick={() => setQtyText(String(Math.max(1, Math.floor(maxQ / 2))))}>
          50%
        </button>
        <button className="btn" onClick={() => setQtyText(String(Math.max(1, maxQ)))}>
          Máx
        </button>
        {h && (
          <button className="btn" onClick={() => setQtyText(String(h.qty))}>
            Tudo que tenho
          </button>
        )}
      </div>
      <div className="actions">
        <button
          className="btn primary btn-col"
          style={{ flex: 1 }}
          disabled={!buy || buy.total > s.balance}
          onClick={() => dispatch({ type: 'buyAsset', id, qty })}
        >
          <span>Comprar</span>
          <span className="sub num">{buy ? `${formatMoney(buy.total, { compact: true })} (taxa ${formatMoney(buy.fee)})` : '—'}</span>
        </button>
        <button className="btn danger btn-col" style={{ flex: 1 }} disabled={!sell} onClick={() => dispatch({ type: 'sellAsset', id, qty })}>
          <span>Vender</span>
          <span className="sub num">{sell ? `recebe ${formatMoney(sell.total, { compact: true })}` : h ? 'quantidade > carteira' : 'sem posição'}</span>
        </button>
      </div>
    </div>
  );
}
