import { CalendarClock, CircleCheck, Info, MessageCircle, type LucideIcon } from 'lucide-react';
import type { PreScreeningResult, PreScreeningResultView, RuleSeverity } from '@pulso/contracts';

interface TonePresentation {
  icon: LucideIcon;
  /** Cor do ícone/texto de destaque. */
  text: string;
  /** Fundo suave do selo do ícone. */
  soft: string;
}

/**
 * Tom de cada resultado (RN07: sempre informativo). "Aguarde" é informação
 * (petróleo), não erro; a palavra "inapto" nunca aparece para o doador.
 */
export const RESULT_PRESENTATION: Record<PreScreeningResult, TonePresentation> = {
  FAVORABLE: { icon: CircleCheck, text: 'text-ok-strong', soft: 'bg-ok-soft' },
  TALK_TO_UNIT: { icon: MessageCircle, text: 'text-warn-strong', soft: 'bg-warn-soft' },
  WAIT_UNTIL: { icon: CalendarClock, text: 'text-petroleo-700', soft: 'bg-petroleo-50' },
};

export const GUIDANCE_ICON: Record<RuleSeverity, LucideIcon> = {
  INFO: Info,
  TALK_TO_UNIT: MessageCircle,
  WAIT_UNTIL: CalendarClock,
};

/** Há uma pré-triagem dentro da validade. */
export function isPreScreeningValid(
  latest: PreScreeningResultView | null | undefined,
): latest is PreScreeningResultView {
  return Boolean(latest && !latest.expired);
}
