import { IdCard, Utensils, type LucideIcon } from 'lucide-react';
import { Alert, Card } from '@/components/ui';
import { SectionHeading } from './SectionHeading';

const TIPS: Array<{ icon: LucideIcon; title: string; text: string }> = [
  {
    icon: IdCard,
    title: 'Leve um documento oficial com foto',
    text: 'Ele é necessário para a sua identificação na unidade de coleta.',
  },
  {
    icon: Utensils,
    title: 'Venha descansado e alimentado',
    text: 'Uma boa noite de sono e uma refeição leve ajudam você a se sentir bem durante a doação.',
  },
];

export function BeforeDonatingSection() {
  return (
    <section aria-labelledby="antes-de-doar" className="border-y border-line bg-surface">
      <div className="mx-auto max-w-page px-4 py-16 sm:px-6 lg:py-20">
        <SectionHeading id="antes-de-doar" eyebrow="Preparação" title="Antes de doar" />
        <ul className="mt-10 grid gap-5 md:grid-cols-2">
          {TIPS.map(({ icon: Icon, title, text }) => (
            <Card as="li" key={title} variant="muted" className="flex gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-petroleo-50 text-petroleo-700">
                <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
              </span>
              <div>
                <h3 className="text-lg font-bold text-ink">{title}</h3>
                <p className="mt-1 text-ink-muted">{text}</p>
              </div>
            </Card>
          ))}
        </ul>
        <Alert tone="info" title="Confirme os critérios com a unidade de coleta" className="mt-6">
          <p>
            Os critérios de idade, peso e intervalo entre doações são definidos pelo Ministério da
            Saúde e foram atualizados em 2026. Confirme sempre as regras vigentes com a unidade
            antes de ir.
          </p>
          <p className="mt-2">
            A pré-triagem do SangueConecta é apenas informativa: quem avalia se você pode doar é a
            equipe de saúde, na triagem presencial.
          </p>
        </Alert>
      </div>
    </section>
  );
}
