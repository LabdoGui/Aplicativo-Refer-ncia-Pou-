import { BALANCE } from '../../engine/config/balance';
import { PROPERTIES, PROPERTY_BY_ID, REGIONS, REGION_BY_ID } from '../../engine/config/realestate';
import {
  netWorth,
  propertyBuyCost,
  propertyFinancials,
  propertyMarketValue,
  propertySaleValue,
  regionIndex,
  renovationCost,
} from '../../engine/economy';
import { formatDuration, formatMoney, formatPercent, formatRate, toCents } from '../../engine/money';
import { Sparkline } from '../components/charts';
import { Money, Section } from '../components/common';
import { useGame } from '../context';

export function RealEstateTab() {
  const { s, dispatch } = useGame();
  const nw = netWorth(s);
  let rent = 0;
  let maint = 0;
  for (const p of PROPERTIES) {
    const f = propertyFinancials(s, p.id);
    rent += f.rent;
    maint += f.maintenance;
  }

  return (
    <div>
      <h1 className="page-title">Imóveis</h1>
      <p className="page-sub">
        Aluguel constante, valorização por região e sinergias com seus negócios. Compra tem taxa de {BALANCE.realEstate.purchaseFeeRate * 100}%; venda,{' '}
        {BALANCE.realEstate.saleFeeRate * 100}%.
      </p>
      <div className="grid-2" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
        <div className="stat">
          <div className="label">Valor</div>
          <div className="value num">{formatMoney(nw.realEstate, { compact: true })}</div>
        </div>
        <div className="stat">
          <div className="label">Aluguéis</div>
          <div className="value num pos">{formatRate(rent)}</div>
        </div>
        <div className="stat">
          <div className="label">Manutenção</div>
          <div className="value num neg">{formatRate(maint)}</div>
        </div>
      </div>

      <Section title="Regiões" hint="Índice 1,00 = preço de referência">
        <div className="grid-2">
          {REGIONS.map((r) => {
            const st = s.realEstate.regions[r.id];
            const hist = st.history;
            const ch = hist.length > 1 ? st.index / hist[Math.max(0, hist.length - 11)] - 1 : 0;
            return (
              <div key={r.id} className="stat">
                <div className="label ellipsis">{r.name}</div>
                <div className="row between">
                  <span className="value num">{st.index.toFixed(2).replace('.', ',')}</span>
                  <Sparkline values={hist.slice(-40)} width={60} height={24} />
                </div>
                <div className={`tiny num ${ch >= 0 ? 'pos' : 'neg'}`}>{formatPercent(ch, 1, true)} em 10 min</div>
                <div className="tiny muted">{r.description}</div>
              </div>
            );
          })}
        </div>
      </Section>

      {s.realEstate.developments.length > 0 && (
        <Section title="Obras em andamento">
          <div className="list">
            {s.realEstate.developments.map((d) => (
              <div key={d.id} className="card row">
                <div className="item-icon">🏗️</div>
                <div className="grow">
                  <div className="item-title">{PROPERTY_BY_ID[d.toDefId].name}</div>
                  <div className="small muted">Pronto em {formatDuration((d.readyAt - s.gameTime) / 1000)}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Mercado imobiliário">
        <div className="list">
          {PROPERTIES.map((p) => {
            const h = s.realEstate.holdings[p.id];
            const unlocked = (h?.units ?? 0) > 0 || nw.total >= BigInt(p.unlockNetWorth);
            const region = REGION_BY_ID[p.region];
            if (!unlocked) {
              return (
                <div key={p.id} className="card locked">
                  <div className="row">
                    <div className="item-icon">🔒</div>
                    <div className="grow">
                      <div className="item-title">{p.name}</div>
                      <div className="small muted">Libera com patrimônio de {formatMoney(BigInt(p.unlockNetWorth), { compact: true })}</div>
                    </div>
                  </div>
                </div>
              );
            }
            const buy = propertyBuyCost(s, p.id);
            const f = propertyFinancials(s, p.id);
            const unitRent =
              p.baseRent * (1 + BALANCE.realEstate.renovationRentBonus * (h?.renovation ?? 0)) * region.rentMultiplier * Math.sqrt(regionIndex(s, p.region));
            const sale = propertySaleValue(s, p.id);
            const renov = h ? renovationCost(s, p.id) : 0n;
            const maxRenov = (h?.renovation ?? 0) >= BALANCE.realEstate.maxRenovation;
            const devCost = p.develop ? toCents(p.develop.cost * BALANCE.costMultiplier, 'ceil') : 0n;
            const pnl = h ? propertyMarketValue(s, p.id) - h.costBasis : 0n;
            return (
              <div key={p.id} className="card">
                <div className="row">
                  <div className="item-icon">{p.icon}</div>
                  <div className="grow">
                    <div className="row between">
                      <span className="item-title">{p.name}</span>
                      {h ? <span className="chip good">{h.units} un.</span> : <span className="chip">{p.type}</span>}
                    </div>
                    <div className="small muted">
                      {region.name} · {p.description}
                    </div>
                  </div>
                </div>
                <div className="kv">
                  <div>
                    <div className="k">Preço (+taxa)</div>
                    <div className="v num">{formatMoney(buy.total, { compact: true })}</div>
                  </div>
                  <div>
                    <div className="k">Aluguel por unidade</div>
                    <div className="v num">{p.baseRent ? formatRate(unitRent) : 'não aluga'}</div>
                  </div>
                  <div>
                    <div className="k">Manutenção / un.</div>
                    <div className="v num">{formatRate(p.maintenance)}</div>
                  </div>
                  {h && (
                    <>
                      <div>
                        <div className="k">Renda líquida</div>
                        <div className={`v num ${f.net >= 0 ? 'pos' : 'neg'}`}>{formatRate(f.net)}</div>
                      </div>
                      <div>
                        <div className="k">Valorização</div>
                        <div className="v">
                          <Money value={pnl} sign colored />
                        </div>
                      </div>
                      <div>
                        <div className="k">Reforma</div>
                        <div className="v num">
                          {h.renovation}/{BALANCE.realEstate.maxRenovation}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                {p.synergies.length > 0 && (
                  <div className="row small" style={{ flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                    {p.synergies.map((syn) => (
                      <span key={syn.text} className={`chip ${h ? 'gold' : 'info'}`}>
                        ✦ {syn.text}
                      </span>
                    ))}
                  </div>
                )}
                <div className="actions">
                  <button className="btn primary" disabled={buy.total > s.balance} onClick={() => dispatch({ type: 'buyProperty', id: p.id })}>
                    Comprar {formatMoney(buy.total, { compact: true })}
                  </button>
                  {h && (
                    <>
                      <button className="btn" disabled={maxRenov || renov > s.balance} onClick={() => dispatch({ type: 'renovateProperty', id: p.id })}>
                        {maxRenov ? 'Reformado' : `Reformar ${formatMoney(renov, { compact: true })}`}
                      </button>
                      {p.develop && (
                        <button
                          className="btn"
                          disabled={devCost > s.balance}
                          onClick={() => dispatch({ type: 'developProperty', id: p.id })}
                          title={`Transforma 1 terreno em ${PROPERTY_BY_ID[p.develop.toId].name} em ${formatDuration(p.develop.durationMs / 1000)}`}
                        >
                          Construir {PROPERTY_BY_ID[p.develop.toId].name} · {formatMoney(devCost, { compact: true })}
                        </button>
                      )}
                      <button className="btn danger" onClick={() => dispatch({ type: 'sellProperty', id: p.id })}>
                        Vender 1 · recebe {formatMoney(sale.net, { compact: true })}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
