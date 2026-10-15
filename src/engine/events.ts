/**
 * Eventos econômicos dinâmicos. Cada evento é ANUNCIADO com antecedência
 * (BALANCE.events.warningMs) para que o jogador possa se preparar, dura um tempo
 * definido e tem efeitos declarados em config/events.ts — nada é escondido.
 */
import { BALANCE } from './config/balance';
import { EVENTS, EVENT_BY_ID } from './config/events';
import { notify } from './ledger';
import { nextRandom, pickWeighted, randomRange } from './rng';
import type { GameState } from './types';

/** Eventos só começam depois que o jogador tem algo a ser afetado. */
function eventsEnabled(s: GameState): boolean {
  return Object.values(s.businesses).some((b) => b.level > 0) || Object.keys(s.portfolio).length > 0;
}

export function stepEvents(s: GameState): void {
  const now = s.gameTime;

  // Encerra eventos expirados.
  if (s.events.active.length) {
    const still = [];
    for (const ev of s.events.active) {
      if (now >= ev.endsAt) {
        const def = EVENT_BY_ID[ev.defId];
        if (def?.isCrisis) s.stats.crisesSurvived++;
        notify(s, { kind: 'info', title: `${def?.icon ?? ''} Fim: ${def?.name ?? ev.defId}`, detail: 'Os efeitos do evento terminaram.' });
      } else still.push(ev);
    }
    s.events.active = still;
  }

  // Inicia evento anunciado.
  const up = s.events.upcoming;
  if (up && now >= up.startsAt) {
    s.events.active.push(up);
    s.events.upcoming = null;
    const def = EVENT_BY_ID[up.defId];
    notify(s, { kind: def.tone === 'bad' ? 'warning' : 'info', title: `${def.icon} Começou: ${def.name}`, detail: def.description });
    s.events.nextAt = up.endsAt + randomRange(s.rng, BALANCE.events.minGapMs, BALANCE.events.maxGapMs);
  }

  // Anuncia o próximo evento.
  if (!s.events.upcoming && now >= s.events.nextAt - BALANCE.events.warningMs) {
    if (!eventsEnabled(s)) {
      s.events.nextAt = now + BALANCE.events.minGapMs;
      return;
    }
    const activeIds = new Set(s.events.active.map((e) => e.defId));
    const last = s.events.history[s.events.history.length - 1];
    const pool = EVENTS.filter((e) => !activeIds.has(e.id) && e.id !== last);
    if (!pool.length) return;
    const def = pickWeighted(s.rng, pool);
    const startsAt = Math.max(now, s.events.nextAt - BALANCE.events.warningMs) + BALANCE.events.warningMs;
    // Pequena variação de duração (±20%), sempre informada ao jogador.
    const duration = Math.round(def.durationMs * (0.8 + 0.4 * nextRandom(s.rng)));
    s.events.upcoming = { defId: def.id, startsAt, endsAt: startsAt + duration };
    s.events.history.push(def.id);
    if (s.events.history.length > 30) s.events.history.shift();
    notify(s, {
      kind: 'info',
      title: `Previsão: ${def.icon} ${def.name}`,
      detail: `Começa em ${Math.round(BALANCE.events.warningMs / 1000)}s. ${def.advice}`,
    });
  }
}
