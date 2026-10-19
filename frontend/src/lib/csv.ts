/**
 * CSV para o Excel em português: separador ";", BOM UTF-8 e campos entre aspas
 * quando necessário. Valores começando com = + - @ ganham um apóstrofo para não
 * virarem fórmula (CSV injection).
 */
function cell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: readonly string[], rows: ReadonlyArray<readonly unknown[]>): string {
  return [headers, ...rows].map((row) => row.map(cell).join(';')).join('\r\n');
}

/** Gera o download de um arquivo no navegador. */
export function downloadFile(filename: string, content: BlobPart, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function downloadCsv(
  filename: string,
  headers: readonly string[],
  rows: ReadonlyArray<readonly unknown[]>,
) {
  downloadFile(filename, `﻿${toCsv(headers, rows)}`, 'text/csv;charset=utf-8');
}
