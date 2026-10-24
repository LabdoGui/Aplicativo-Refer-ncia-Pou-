import { ArrowRight, HeartPulse } from 'lucide-react';
import { Badge, ButtonLink } from '@/components/ui';
import { HeroArt } from './HeroArt';

export function HeroSection() {
  return (
    <section aria-labelledby="hero-title">
      <div className="mx-auto grid max-w-page items-center gap-12 px-4 py-14 sm:px-6 md:grid-cols-[1.15fr_0.85fr] lg:py-24">
        <div>
          <Badge tone="info" icon={<HeartPulse aria-hidden="true" className="size-3.5" />}>
            Projeto acadêmico · ODS 3
          </Badge>
          <h1
            id="hero-title"
            className="mt-5 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl lg:text-5xl"
          >
            Conectando doadores{' '}
            <span className="text-carmim-700">a vidas que precisam de ajuda.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-ink-muted">
            Prepare-se, agende e acompanhe sua doação em um só lugar, com orientações claras e
            respeito à sua privacidade.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink to="/cadastro" size="lg">
              Quero doar
              <ArrowRight aria-hidden="true" className="size-5" />
            </ButtonLink>
            <ButtonLink to="/entrar" size="lg" variant="outline">
              Já tenho conta
            </ButtonLink>
          </div>
        </div>
        <HeroArt className="hidden md:block" />
      </div>
    </section>
  );
}
