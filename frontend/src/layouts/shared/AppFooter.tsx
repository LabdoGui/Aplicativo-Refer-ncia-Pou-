import { ACADEMIC_NOTICE } from './notices';

/** Rodapé discreto das áreas logadas (doador, equipe e administração). */
export function AppFooter() {
  return (
    <footer className="border-t border-line px-4 py-5 text-xs text-ink-muted sm:px-6 lg:px-8">
      {ACADEMIC_NOTICE}
    </footer>
  );
}
