import { BALANCE } from '../../engine/config/balance';
import { ACHIEVEMENTS, MISSIONS, type MissionTier } from '../../engine/config/missions';
import { achievementMultiplier } from '../../engine/economy';
import { formatMoney } from '../../engine/money';
import { missionProgress, progressContext } from '../../engine/progress';
import { Money, Progress, Section } from '../components/common';
import { useGame, useNav } from '../context';

const TIERS: { id: MissionTier; title: string; hint: string }[] = [
  { id: 'tutorial', title: 'Primeiros passos', hint: 'Ensina as mecânicas' },
  { id: 'curto', title: 'Curto prazo', hint: 'Minutos' },
  { id: 'medio', title: 'Médio prazo', hint: 'Horas' },
  { id: 'longo', title: 'Longo prazo', hint: 'Dias' },
];

function fmtProgress(cur: number, target: number): string {
  if (target >= 1000) {
    return `${formatMoney(BigInt(Math.floor(cur * 100)), { compact: true })} / ${formatMoney(BigInt(Math.floor(target * 100)), { compact: true })}`;
  }
  return `${Math.floor(cur * 100) / 100} / ${target}`.replace(/\./g, ',');
}

export function MissionsTab() {
  const { s, dispatch } = useGame();
  const nav = useNav();
  const ctx = progressContext(s);
  return (
    <div>
      <h1 className="page-title">Missões</h1>
      <p className="page-sub">Objetivos que ensinam o jogo e aceleram a descoberta de mecânicas. Recompensas não quebram a economia.</p>
      {TIERS.map((tier) => (
        <Section key={tier.id} title={tier.title} hint={tier.hint}>
          <div className="list">
            {MISSIONS.filter((m) => m.tier === tier.id).map((m) => {
              const p = missionProgress(s, m, ctx);
              return (
                <div key={m.id} className={`card ${p.claimed ? 'locked' : ''}`}>
                  <div className="row between">
                    <span className="item-title">
                      {p.claimed ? '✅ ' : ''}
                      {m.title}
                    </span>
                    {m.reward > 0 && (
                      <span className="chip gold">
                        <Money value={BigInt(m.reward)} />
                      </span>
                    )}
                  </div>
                  <div className="small muted" style={{ margin: '2px 0 8px' }}>
                    {m.description}
                  </div>
                  {!p.claimed && (
                    <>
                      <Progress value={p.cur} max={p.target} />
                      <div className="row between" style={{ marginTop: 8 }}>
                        <span className="tiny muted num">{fmtProgress(p.cur, p.target)}</span>
                        {p.done ? (
                          <button className="btn primary" onClick={() => dispatch({ type: 'claimMission', id: m.id })}>
                            Resgatar
                          </button>
                        ) : (
                          <button className="btn ghost" onClick={() => nav(m.tab)}>
                            Ir
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      ))}
    </div>
  );
}

export function AchievementsTab() {
  const { s } = useGame();
  const got = new Set(s.achievements);
  return (
    <div>
      <h1 className="page-title">Conquistas</h1>
      <p className="page-sub">
        {got.size} de {ACHIEVEMENTS.length} desbloqueadas. Cada conquista dá +{BALANCE.achievementBonus * 100}% de renda permanente (atual: ×
        {achievementMultiplier(s).toFixed(2)}), mantida no Legado.
      </p>
      <div className="grid-auto list">
        {ACHIEVEMENTS.map((a) => (
          <div key={a.id} className={`card ${got.has(a.id) ? '' : 'locked'}`} style={{ marginTop: 0 }}>
            <div className="row">
              <div className="item-icon">{got.has(a.id) ? a.icon : '🔒'}</div>
              <div className="grow">
                <div className="row between">
                  <span className="item-title">{a.name}</span>
                  {a.rare && <span className="chip gold">rara</span>}
                </div>
                <div className="small muted">{a.description}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
