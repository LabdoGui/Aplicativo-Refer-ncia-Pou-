import { PageHeader } from '@/components/ui';
import { useSession } from '@/features/auth/use-auth';
import { activeAppointment, useMyAppointments } from '@/features/donor/api';
import { CampaignsSection } from '@/features/donor/home/CampaignsSection';
import { NextStepCard } from '@/features/donor/home/NextStepCard';
import { StockNeedsSection } from '@/features/donor/home/StockNeedsSection';
import { SummaryLinks } from '@/features/donor/home/SummaryLinks';
import { WelcomeAlert } from '@/features/donor/home/WelcomeAlert';
import { firstName } from '@/lib/format';
import { useDocumentTitle } from '@/lib/use-document-title';

/** "Minha jornada": próximo passo, resumo, campanhas e tipos que mais precisam. */
export function DonorHomePage() {
  useDocumentTitle('Minha jornada');
  const { user } = useSession();
  const appointments = useMyAppointments();
  // Sem agendamento ativo conhecido, os atalhos de campanha levam ao agendamento.
  const canBook = appointments.isSuccess && !activeAppointment(appointments.data);

  return (
    <>
      <PageHeader
        eyebrow="Minha jornada"
        title={user ? `Olá, ${firstName(user.name)}` : 'Olá'}
        className="mb-6"
      />
      <WelcomeAlert />
      <div className="space-y-6">
        <NextStepCard />
        <SummaryLinks />
        <CampaignsSection canBook={canBook} />
        <StockNeedsSection />
      </div>
    </>
  );
}
