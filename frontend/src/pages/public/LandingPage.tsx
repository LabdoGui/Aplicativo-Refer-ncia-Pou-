import { useDocumentTitle } from '@/lib/use-document-title';
import { BeforeDonatingSection } from './landing/BeforeDonatingSection';
import { ClosingCta } from './landing/ClosingCta';
import { HeroSection } from './landing/HeroSection';
import { HowItWorksSection } from './landing/HowItWorksSection';
import { WhyDonateSection } from './landing/WhyDonateSection';

/**
 * Página pública inicial. Indicadores e campanhas NÃO aparecem aqui ainda: virão do
 * banco de dados em fases futuras (sem números fictícios fixos no código).
 */
export function LandingPage() {
  useDocumentTitle();
  return (
    <>
      <HeroSection />
      <WhyDonateSection />
      <HowItWorksSection />
      <BeforeDonatingSection />
      <ClosingCta />
    </>
  );
}
