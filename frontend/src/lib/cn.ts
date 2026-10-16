import { clsx, type ClassValue } from 'clsx';

/**
 * Junta classes CSS condicionais.
 * Observação: não há "tailwind-merge" no projeto; evite passar classes que conflitem
 * com as do componente (ex.: dois paddings) — prefira as props de variação.
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
