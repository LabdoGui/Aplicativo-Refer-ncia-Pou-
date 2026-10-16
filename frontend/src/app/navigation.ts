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
  LogIn,
  Medal,
  Megaphone,
  ScrollText,
  Settings,
  Stethoscope,
  Trophy,
  UserPlus,
  UserRound,
  Users,
} from 'lucide-react';
import type { NavItem } from '@/components/navigation/types';

/*
 * Fonte única das áreas do app: alimenta a navegação dos layouts e as rotas.
 * `phase` indica em que fase do roadmap (docs/16, seção 8) cada tela será entregue;
 * até lá, a rota mostra o PhasePlaceholder ("Em construção").
 */

export const PUBLIC_PLACEHOLDERS: readonly NavItem[] = [
  { label: 'Entrar', to: '/entrar', icon: LogIn, phase: 2 },
  { label: 'Criar conta', to: '/cadastro', icon: UserPlus, phase: 3 },
];

export const DONOR_NAV: readonly NavItem[] = [
  { label: 'Início', to: '/app', icon: House, phase: 3, pageTitle: 'Minha jornada', end: true },
  {
    label: 'Agendar',
    to: '/app/agendar',
    icon: CalendarPlus,
    phase: 5,
    pageTitle: 'Agendar doação',
  },
  { label: 'Doações', to: '/app/doacoes', icon: Droplet, phase: 7, pageTitle: 'Minhas doações' },
  { label: 'Conquistas', to: '/app/conquistas', icon: Trophy, phase: 8 },
  { label: 'Perfil', to: '/app/perfil', icon: UserRound, phase: 3, pageTitle: 'Meu perfil' },
];

/** Destino do sino de notificações do doador (fora da navegação principal). */
export const DONOR_NOTIFICATIONS: NavItem = {
  label: 'Notificações',
  to: '/app/notificacoes',
  icon: Bell,
  phase: 12,
};

export const STAFF_NAV: readonly NavItem[] = [
  { label: 'Atendimentos de hoje', to: '/equipe', icon: ClipboardList, phase: 6, end: true },
];

export const ADMIN_NAV: readonly NavItem[] = [
  { label: 'Dashboard', to: '/admin', icon: LayoutDashboard, phase: 10, end: true },
  { label: 'Agendamentos', to: '/admin/agendamentos', icon: CalendarDays, phase: 5 },
  { label: 'Doadores', to: '/admin/doadores', icon: Users, phase: 3 },
  { label: 'Profissionais', to: '/admin/profissionais', icon: Stethoscope, phase: 6 },
  { label: 'Unidades', to: '/admin/unidades', icon: Building2, phase: 5 },
  {
    label: 'Estoque',
    to: '/admin/estoque',
    icon: Droplets,
    phase: 11,
    pageTitle: 'Pulso do Estoque',
  },
  { label: 'Campanhas', to: '/admin/campanhas', icon: Megaphone, phase: 5 },
  { label: 'Gamificação', to: '/admin/gamificacao', icon: Medal, phase: 8 },
  { label: 'Relatórios', to: '/admin/relatorios', icon: FileChartColumn, phase: 10 },
  { label: 'Configurações', to: '/admin/configuracoes', icon: Settings, phase: 4 },
  { label: 'Auditoria', to: '/admin/auditoria', icon: ScrollText, phase: 10 },
];
