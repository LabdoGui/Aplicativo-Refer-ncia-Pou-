import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  /** Botões do rodapé. */
  actions?: ReactNode;
}

/**
 * Diálogo modal sobre o <dialog> nativo: foco preso, Esc e fundo inerte ficam
 * por conta do navegador; o foco volta ao elemento que abriu o diálogo.
 */
export function Dialog({ open, onClose, title, description, children, actions }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && onClose()}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-card border border-line bg-surface p-0 text-ink shadow-raised backdrop:bg-petroleo-950/50"
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-xl font-bold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="-m-2 grid size-11 shrink-0 place-items-center rounded-control text-ink-muted hover:bg-surface-muted"
          >
            <X aria-hidden="true" className="size-5" />
            <span className="sr-only">Fechar</span>
          </button>
        </div>
        {description && (
          <div id={descriptionId} className="mt-2 text-ink-muted">
            {description}
          </div>
        )}
        {children && <div className="mt-4">{children}</div>}
        {actions && <div className="mt-6 flex flex-wrap justify-end gap-3">{actions}</div>}
      </div>
    </dialog>
  );
}
