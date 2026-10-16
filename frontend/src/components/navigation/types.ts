import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  /** Rótulo curto exibido na navegação. */
  label: string;
  to: string;
  icon: LucideIcon;
  /** Fase do roadmap (docs/16) em que a funcionalidade será entregue. */
  phase: number;
  /** Título da página, quando diferente do rótulo da navegação. */
  pageTitle?: string;
  /** Item raiz da área (ex.: /app): só fica ativo na URL exata. */
  end?: boolean;
}
