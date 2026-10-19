import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  /** Rótulo curto exibido na navegação. */
  label: string;
  to: string;
  icon: LucideIcon;
  /** Item raiz da área (ex.: /app): só fica ativo na URL exata. */
  end?: boolean;
}
