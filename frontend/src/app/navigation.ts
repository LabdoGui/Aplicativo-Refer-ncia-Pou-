import {
  Bell,
  Building2,
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  Droplet,
  Droplets,
  FileChartColumn,
  House,
  LayoutDashboard,
  Medal,
  Megaphone,
  ScrollText,
  Settings,
  Stethoscope,
  Trophy,
  UserRound,
  Users,
} from 'lucide-react';
import type { NavItem } from '@/components/navigation/types';

/** Fonte única dos itens de navegação de cada área (layouts do doador, da equipe e da administração). */

export const DONOR_NAV: readonly NavItem[] = [
  { label: 'Início', to: '/app', icon: House, end: true },
  {
    label: 'Agendar',
    to: '/app/agendar',
    icon: CalendarPlus,
  },
  { label: 'Doações', to: '/app/doacoes', icon: Droplet },
  { label: 'Conquistas', to: '/app/conquistas', icon: Trophy },
  { label: 'Perfil', to: '/app/perfil', icon: UserRound },
];

/** Destino do sino de notificações do doador (fora da navegação principal). */
export const DONOR_NOTIFICATIONS: NavItem = {
  label: 'Notificações',
  to: '/app/notificacoes',
  icon: Bell,
};

export const STAFF_NAV: readonly NavItem[] = [
  { label: 'Atendimentos do dia', to: '/equipe', icon: ClipboardList, end: true },
];

export const ADMIN_NAV: readonly NavItem[] = [
  { label: 'Dashboard', to: '/admin', icon: LayoutDashboard, end: true },
  { label: 'Agendamentos', to: '/admin/agendamentos', icon: CalendarDays },
  { label: 'Doadores', to: '/admin/doadores', icon: Users },
  { label: 'Profissionais', to: '/admin/profissionais', icon: Stethoscope },
  { label: 'Unidades', to: '/admin/unidades', icon: Building2 },
  {
    label: 'Estoque',
    to: '/admin/estoque',
    icon: Droplets,
  },
  { label: 'Campanhas', to: '/admin/campanhas', icon: Megaphone },
  { label: 'Gamificação', to: '/admin/gamificacao', icon: Medal },
  { label: 'Relatórios', to: '/admin/relatorios', icon: FileChartColumn },
  { label: 'Configurações', to: '/admin/configuracoes', icon: Settings },
  { label: 'Auditoria', to: '/admin/auditoria', icon: ScrollText },
];
