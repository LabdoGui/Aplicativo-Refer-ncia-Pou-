import { Droplets, HeartHandshake, Repeat, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui';
import { SectionHeading } from './SectionHeading';

interface Reason {
  icon: LucideIcon;
  title: string;
  text: string;
}

// Afirmações qualitativas, sem estatísticas: números entrarão só quando vierem de fontes/banco.
const REASONS: Reason[] = [
  {
    icon: HeartHandshake,
    title: 'Uma doação ajuda mais de uma pessoa',
    text: 'O sangue doado é separado em componentes, e cada um pode ser usado no tratamento de pacientes diferentes.',
  },
  {
    icon: Droplets,
    title: 'Sangue não se fabrica',
    text: 'Não existe substituto para o sangue humano: o atendimento depende de pessoas que decidem doar.',
  },
  {
    icon: Repeat,
    title: 'A regularidade faz diferença',
    text: 'Os estoques precisam de reposição contínua. Quem volta a doar ajuda a manter cirurgias, emergências e tratamentos.',
  },
];

export function WhyDonateSection() {
  return (
    <section aria-labelledby="por-que-doar" className="border-y border-line bg-surface">
      <div className="mx-auto max-w-page px-4 py-16 sm:px-6 lg:py-20">
        <SectionHeading
          id="por-que-doar"
          eyebrow="Por que doar"
          title="Um gesto simples, com impacto real"
          description="Doar sangue é um ato voluntário de cuidado com pessoas que você talvez nunca conheça."
        />
        <ul className="mt-10 grid gap-5 md:grid-cols-3">
          {REASONS.map(({ icon: Icon, title, text }) => (
            <Card as="li" key={title} variant="muted">
              <span className="grid size-11 place-items-center rounded-full bg-petroleo-50 text-petroleo-700">
                <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
              </span>
              <h3 className="mt-4 text-lg font-bold text-ink">{title}</h3>
              <p className="mt-2 text-ink-muted">{text}</p>
            </Card>
          ))}
        </ul>
      </div>
    </section>
  );
}
