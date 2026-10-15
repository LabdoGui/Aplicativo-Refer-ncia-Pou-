import { ACHIEVEMENTS, MISSIONS, type MissionDef, type ProgressContext } from './config/missions';
import { incomeBreakdown, netWorth } from './economy';
import { notify } from './ledger';
import type { GameState } from './types';

export function progressContext(s: GameState): ProgressContext {
  return { netWorth: netWorth(s).total, passiveNet: incomeBreakdown(s).passiveNet };
}

export function missionProgress(s: GameState, m: MissionDef, c: ProgressContext = progressContext(s)) {
  const [cur, target] = m.progress(s, c);
  return { cur, target, done: cur >= target, claimed: s.missions.claimed.includes(m.id) };
}

/** Próxima missão do tutorial ainda não resgatada (ou null quando o tutorial terminou). */
export function currentTutorialMission(s: GameState): MissionDef | null {
  return MISSIONS.find((m) => m.tier === 'tutorial' && !s.missions.claimed.includes(m.id)) ?? null;
}

/** Desbloqueia conquistas e atualiza o pico de patrimônio. Chamado após cada avanço/ação. */
export function updateProgress(s: GameState, c: ProgressContext = progressContext(s)): void {
  if (c.netWorth > s.stats.peakNetWorth) s.stats.peakNetWorth = c.netWorth;
  for (const a of ACHIEVEMENTS) {
    if (s.achievements.includes(a.id)) continue;
    if (a.check(s, c)) {
      s.achievements.push(a.id);
      notify(s, { kind: 'achievement', title: `${a.icon} Conquista: ${a.name}`, detail: `${a.description} (+1% de renda permanente)` });
    }
  }
  if (!s.tutorialDone && !currentTutorialMission(s)) s.tutorialDone = true;
}
