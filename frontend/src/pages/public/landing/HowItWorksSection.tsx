import { Card } from '@/components/ui';
import { SectionHeading } from './SectionHeading';

const STEPS = [
  {
    title: 'Crie sua conta',
    text: 'Cadastro simples, só com o necessário. Não pedimos CPF.',
  },
  {
    title: 'Faça a pré-triagem informativa',
    text: 'Responda algumas perguntas e receba orientações antes de sair de casa. O resultado não é um diagnóstico.',
  },
  {
    title: 'Agende local, data e horário',
    text: 'Escolha a unidade de coleta e um horário disponível, e acompanhe seu agendamento.',
  },
  {
    title: 'Seja atendido pela equipe de saúde',
    text: 'Na unidade, profissionais de saúde fazem a triagem presencial e conduzem a doação.',
  },
];

export function HowItWorksSection() {
  return (
    <section id="como-funciona" aria-labelledby="como-funciona-titulo" className="scroll-mt-20">
      <div className="mx-auto max-w-page px-4 py-16 sm:px-6 lg:py-20">
        <SectionHeading
          id="como-funciona-titulo"
          eyebrow="Como funciona"
          title="Da decisão à doação, em quatro passos"
        />
        <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ title, text }, index) => (
            <Card as="li" key={title}>
              <span
                aria-hidden="true"
                className="grid size-10 place-items-center rounded-full bg-petroleo-700 font-display text-base font-bold text-white"
              >
                {index + 1}
              </span>
              <h3 className="mt-4 text-lg font-bold text-ink">{title}</h3>
              <p className="mt-2 text-ink-muted">{text}</p>
            </Card>
          ))}
        </ol>
      </div>
    </section>
  );
}
