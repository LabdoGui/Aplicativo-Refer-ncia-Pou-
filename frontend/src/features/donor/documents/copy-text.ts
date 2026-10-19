/**
 * Copia um texto para a área de transferência. Usa a Clipboard API e, se ela não estiver
 * disponível (http sem TLS, permissões), recorre a um campo temporário selecionado.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Segue para o método alternativo.
  }
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.appendChild(field);
  field.select();
  try {
    // Método legado, mantido só como alternativa à Clipboard API.
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    field.remove();
  }
}
