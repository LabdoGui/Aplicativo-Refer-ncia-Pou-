import { Clock, IdCard, Phone } from 'lucide-react';
import { Card } from '@/components/ui';
import { telHref } from './phone';

/** Orientações gerais e não clínicas para o dia (as instruções da equipe prevalecem). */
export function PreparationGuidance({ phone }: { phone: string | null }) {
  return (
    <Card as="section" aria-labelledby="orientacoes">
      <h2 id="orientacoes" className="text-lg font-bold text-ink">
        Para o dia da doação
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Orientações gerais. Elas não substituem as instruções da equipe da unidade.
      </p>
      <ul className="mt-4 space-y-3">
        <li className="flex gap-3">
          <IdCard aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-petroleo-700" />
          <span>Leve um documento oficial com foto.</span>
        </li>
        <li className="flex gap-3">
          <Clock aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-petroleo-700" />
          <span>Chegue alguns minutos antes do horário marcado.</span>
        </li>
        <li className="flex gap-3">
          <Phone aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-petroleo-700" />
          <span>
            Ficou com alguma dúvida? Fale com a unidade
            {phone ? (
              <>
                {' '}
                pelo telefone{' '}
                <a
                  href={telHref(phone)}
                  className="font-semibold text-petroleo-700 underline underline-offset-2"
                >
                  {phone}
                </a>
                .
              </>
            ) : (
              '.'
            )}
          </span>
        </li>
      </ul>
    </Card>
  );
}
