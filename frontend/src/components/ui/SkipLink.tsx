import type { MouseEvent } from 'react';

/** id do <main> de todos os layouts (alvo do link "Pular para o conteúdo"). */
export const MAIN_CONTENT_ID = 'conteudo';

/** Primeiro elemento focável da página: leva o foco direto ao conteúdo principal. */
export function SkipLink() {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    const main = document.getElementById(MAIN_CONTENT_ID);
    if (!main) return;
    // Evita alterar a URL (#conteudo) e move o foco de forma confiável em todos os navegadores.
    event.preventDefault();
    main.focus();
    main.scrollIntoView();
  }

  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      onClick={handleClick}
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-control focus:bg-surface focus:px-4 focus:py-3 focus:font-semibold focus:text-petroleo-800 focus:shadow-raised"
    >
      Pular para o conteúdo principal
    </a>
  );
}
