import { useDocumentTitle } from '@/lib/use-document-title';
import { AccountDeletedNotice } from './landing/AccountDeletedNotice';
import { BeforeDonatingSection } from './landing/BeforeDonatingSection';
import { ClosingCta } from './landing/ClosingCta';
import { HeroSection } from './landing/HeroSection';
import { HowItWorksSection } from './landing/HowItWorksSection';
import { PublicStatsSection } from './landing/PublicStatsSection';
import { WhyDonateSection } from './landing/WhyDonateSection';

/**
 * Página pública inicial. Os números e a situação dos estoques vêm da API
 * (/dashboard/public-stats), sempre marcados como dados fictícios de demonstração.
 */
export function LandingPage() {
  useDocumentTitle();
  return (
    <>
      <AccountDeletedNotice />
      <HeroSection />
      <PublicStatsSection />
      <WhyDonateSection />
      <HowItWorksSection />
      <BeforeDonatingSection />
      <ClosingCta />
    </>
  );
}
