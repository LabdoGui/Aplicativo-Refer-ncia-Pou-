import { Card } from '@/components/ui';

// RN10: a doação concluída não entra direto no estoque; a bolsa passa por processamento e liberação.
const STEPS = [
  {
    title: 'Processamento',
    text: 'A bolsa coletada segue para o processamento no hemocentro.',
  },
  {
    title: 'Liberação',
    text: 'Ela só é liberada depois de processada. Por isso o estoque não muda no mesmo dia da doação.',
  },
  {
    title: 'Estoque',
    text: 'Liberada, a bolsa entra no estoque e pode ser enviada aos hospitais conforme a necessidade.',
  },
];

/** "O que acontece agora": o caminho da bolsa depois da doação, em linguagem simples. */
export function AfterDonationSteps() {
  return (
    <Card as="section" aria-labelledby="o-que-acontece">
      <h2 id="o-que-acontece" className="text-lg font-bold text-ink">
        O que acontece agora
      </h2>
      <ol className="mt-4 space-y-4">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-3">
            <span
              aria-hidden="true"
              className="grid size-8 shrink-0 place-items-center rounded-full bg-petroleo-700 text-sm font-bold text-white"
            >
              {index + 1}
            </span>
            <div>
              <h3 className="font-sans text-base font-semibold text-ink">{step.title}</h3>
              <p className="text-sm text-ink-muted">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
