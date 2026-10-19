import type { ReactNode } from 'react';

interface SectionHeadingProps {
  id: string;
  eyebrow: string;
  title: string;
  description?: ReactNode;
}

/** Cabeçalho padrão das seções da landing (o id é usado no aria-labelledby da seção). */
export function SectionHeading({ id, eyebrow, title, description }: SectionHeadingProps) {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-semibold tracking-wide text-petroleo-700 uppercase">{eyebrow}</p>
      <h2 id={id} className="mt-2 text-2xl font-bold text-ink sm:text-3xl">
        {title}
      </h2>
      {description && <p className="mt-3 text-base text-ink-muted sm:text-lg">{description}</p>}
    </div>
  );
}
