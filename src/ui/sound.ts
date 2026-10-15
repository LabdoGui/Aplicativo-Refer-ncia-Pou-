import type { Settings } from '../engine/types';

type SoundKind = 'click' | 'buy' | 'error' | 'achievement';

let ctx: AudioContext | null = null;

const TONES: Record<SoundKind, [number, number, number][]> = {
  // [frequência Hz, início s, duração s]
  click: [[880, 0, 0.04]],
  buy: [[660, 0, 0.06], [990, 0.06, 0.08]],
  error: [[220, 0, 0.12]],
  achievement: [[660, 0, 0.1], [880, 0.1, 0.1], [1320, 0.2, 0.18]],
};

/** Sons sintetizados curtos (sem arquivos de áudio). Desligados por padrão. */
export function playSound(settings: Settings, kind: SoundKind): void {
  if (!settings.sound) return;
  try {
    ctx ??= new AudioContext();
    const t0 = ctx.currentTime;
    for (const [freq, start, dur] of TONES[kind]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0 + start);
      gain.gain.exponentialRampToValueAtTime(0.08, t0 + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + start);
      osc.stop(t0 + start + dur + 0.02);
    }
  } catch {
    /* áudio indisponível */
  }
}
