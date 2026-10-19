import type { ComponentType } from 'react';
import type { RouteObject } from 'react-router-dom';
import { RequireRole } from '@/features/auth/RequireRole';
import { AdminLayout } from '@/layouts/AdminLayout';
import { DonorLayout } from '@/layouts/DonorLayout';
import { PublicContainer } from '@/layouts/public/PublicContainer';
import { PublicLayout } from '@/layouts/PublicLayout';
import { StaffLayout } from '@/layouts/StaffLayout';
import { LandingPage } from '@/pages/public/LandingPage';
import { NotFoundPage } from '@/pages/public/NotFoundPage';
import { RouteErrorPage } from '@/pages/RouteErrorPage';
import { RootRoute } from './RootRoute';

/** Carrega a página sob demanda (cada área vira um pedaço separado do bundle). */
function page<M>(load: () => Promise<M>, pick: (module: M) => ComponentType): RouteObject['lazy'] {
  return async () => ({ Component: pick(await load()) });
}

const notifications = page(
  () => import('@/pages/shared/NotificationsPage'),
  (m) => m.NotificationsPage,
);
const notFoundInArea: RouteObject = { path: '*', element: <NotFoundPage /> };

/** Árvore de rotas (separada do router para permitir renderização em testes). */
export const routes: RouteObject[] = [
  {
    element: <RootRoute />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          { index: true, element: <LandingPage /> },
          {
            path: 'privacidade',
            lazy: page(
              () => import('@/pages/public/PrivacyPage'),
              (m) => m.PrivacyPage,
            ),
          },
          {
            path: 'status',
            lazy: page(
              () => import('@/pages/public/StatusPage'),
              (m) => m.StatusPage,
            ),
          },
          {
            path: 'entrar',
            lazy: page(
              () => import('@/pages/auth/LoginPage'),
              (m) => m.LoginPage,
            ),
          },
          {
            path: 'cadastro',
            lazy: page(
              () => import('@/pages/auth/RegisterPage'),
              (m) => m.RegisterPage,
            ),
          },
          {
            path: 'verificar/:code?',
            lazy: page(
              () => import('@/pages/public/VerifyDocumentPage'),
              (m) => m.VerifyDocumentPage,
            ),
          },
          {
            path: '*',
            element: (
              <PublicContainer>
                <NotFoundPage />
              </PublicContainer>
            ),
          },
        ],
      },
      {
        path: 'app',
        element: (
          <RequireRole roles={['DONOR']}>
            <DonorLayout />
          </RequireRole>
        ),
        children: [
          {
            index: true,
            lazy: page(
              () => import('@/pages/donor/DonorHomePage'),
              (m) => m.DonorHomePage,
            ),
          },
          {
            path: 'pre-triagem',
            lazy: page(
              () => import('@/pages/donor/PreScreeningPage'),
              (m) => m.PreScreeningPage,
            ),
          },
          {
            path: 'agendar',
            lazy: page(
              () => import('@/pages/donor/BookingPage'),
              (m) => m.BookingPage,
            ),
          },
          {
            path: 'agendamentos/:id',
            lazy: page(
              () => import('@/pages/donor/AppointmentDetailPage'),
              (m) => m.AppointmentDetailPage,
            ),
          },
          {
            path: 'doacoes',
            lazy: page(
              () => import('@/pages/donor/DonationsPage'),
              (m) => m.DonationsPage,
            ),
          },
          {
            path: 'doacoes/:attendanceId',
            lazy: page(
              () => import('@/pages/donor/AttendanceDetailPage'),
              (m) => m.AttendanceDetailPage,
            ),
          },
          {
            path: 'doacoes/:attendanceId/obrigado',
            lazy: page(
              () => import('@/pages/donor/ThankYouPage'),
              (m) => m.ThankYouPage,
            ),
          },
          {
            path: 'conquistas',
            lazy: page(
              () => import('@/pages/donor/AchievementsPage'),
              (m) => m.AchievementsPage,
            ),
          },
          {
            path: 'horas',
            lazy: page(
              () => import('@/pages/donor/HoursPage'),
              (m) => m.HoursPage,
            ),
          },
          {
            path: 'documentos',
            lazy: page(
              () => import('@/pages/donor/DocumentsPage'),
              (m) => m.DocumentsPage,
            ),
          },
          { path: 'notificacoes', lazy: notifications },
          {
            path: 'perfil',
            lazy: page(
              () => import('@/pages/donor/ProfilePage'),
              (m) => m.ProfilePage,
            ),
          },
          {
            path: 'privacidade',
            lazy: page(
              () => import('@/pages/donor/PrivacyCenterPage'),
              (m) => m.PrivacyCenterPage,
            ),
          },
          notFoundInArea,
        ],
      },
      {
        path: 'equipe',
        element: (
          <RequireRole roles={['COLLABORATOR', 'NURSE']}>
            <StaffLayout />
          </RequireRole>
        ),
        children: [
          {
            index: true,
            lazy: page(
              () => import('@/pages/staff/AgendaPage'),
              (m) => m.AgendaPage,
            ),
          },
          {
            path: 'atendimentos/:appointmentId',
            lazy: page(
              () => import('@/pages/staff/AttendancePage'),
              (m) => m.AttendancePage,
            ),
          },
          { path: 'notificacoes', lazy: notifications },
          notFoundInArea,
        ],
      },
      {
        path: 'admin',
        element: (
          <RequireRole roles={['ADMIN']}>
            <AdminLayout />
          </RequireRole>
        ),
        children: [
          {
            index: true,
            lazy: page(
              () => import('@/pages/admin/DashboardPage'),
              (m) => m.DashboardPage,
            ),
          },
          {
            path: 'agendamentos',
            lazy: page(
              () => import('@/pages/admin/AppointmentsPage'),
              (m) => m.AppointmentsPage,
            ),
          },
          {
            path: 'doadores',
            lazy: page(
              () => import('@/pages/admin/DonorsPage'),
              (m) => m.DonorsPage,
            ),
          },
          {
            path: 'profissionais',
            lazy: page(
              () => import('@/pages/admin/StaffPage'),
              (m) => m.StaffPage,
            ),
          },
          {
            path: 'unidades',
            lazy: page(
              () => import('@/pages/admin/UnitsPage'),
              (m) => m.UnitsPage,
            ),
          },
          {
            path: 'unidades/:unitId',
            lazy: page(
              () => import('@/pages/admin/UnitDetailPage'),
              (m) => m.UnitDetailPage,
            ),
          },
          {
            path: 'estoque',
            lazy: page(
              () => import('@/pages/admin/StockPage'),
              (m) => m.StockPage,
            ),
          },
          {
            path: 'campanhas',
            lazy: page(
              () => import('@/pages/admin/CampaignsPage'),
              (m) => m.CampaignsPage,
            ),
          },
          {
            path: 'gamificacao',
            lazy: page(
              () => import('@/pages/admin/GamificationPage'),
              (m) => m.GamificationPage,
            ),
          },
          {
            path: 'relatorios',
            lazy: page(
              () => import('@/pages/admin/ReportsPage'),
              (m) => m.ReportsPage,
            ),
          },
          {
            path: 'configuracoes',
            lazy: page(
              () => import('@/pages/admin/SettingsPage'),
              (m) => m.SettingsPage,
            ),
          },
          {
            path: 'auditoria',
            lazy: page(
              () => import('@/pages/admin/AuditPage'),
              (m) => m.AuditPage,
            ),
          },
          { path: 'notificacoes', lazy: notifications },
          notFoundInArea,
        ],
      },
    ],
  },
];
