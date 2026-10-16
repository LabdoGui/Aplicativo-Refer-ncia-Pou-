import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface NavDrawerProps {
  id: string;
  open: boolean;
  onClose: () => void;
  /** Nome acessível do diálogo (ex.: "Menu da administração"). */
  label: string;
  children: ReactNode;
}

/**
 * Menu lateral (petróleo) para telas pequenas, baseado em <dialog> modal: o navegador
 * cuida do foco preso no menu, da tecla Esc e de deixar o restante da página inerte.
 */
export function NavDrawer({ id, open, onClose, label, children }: NavDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      id={id}
      aria-label={label}
      onClose={onClose}
      // Clique no fundo escurecido (fora do painel) fecha o menu.
      onClick={(event) => event.target === event.currentTarget && onClose()}
      className="on-dark fixed inset-y-0 right-auto left-0 m-0 h-dvh max-h-none w-80 max-w-[85vw] bg-petroleo-900 p-0 text-white shadow-raised backdrop:bg-petroleo-950/60"
    >
      <div className="flex h-full flex-col">
        <div className="flex justify-end p-2">
          <button
            type="button"
            onClick={onClose}
            className="grid size-11 place-items-center rounded-control text-petroleo-100 hover:bg-white/10 hover:text-white"
          >
            <X aria-hidden="true" className="size-5" />
            <span className="sr-only">Fechar menu</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-6">{children}</div>
      </div>
    </dialog>
  );
}
