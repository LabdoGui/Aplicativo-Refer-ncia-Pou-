/**
 * Privacidade (espelho de privacy/user-deleted.handler.ts): conta excluída →
 * respostas e orientações da pré-triagem apagadas (fica só o resultado, para as
 * estatísticas) e PDFs emitidos descartados; o código de verificação continua
 * válido e mostra só as iniciais. Triagem e doação ficam pseudonimizadas (só o id).
 */
import { EVENTS, type UserDeletedData } from '@pulso/contracts';
import { subscribe } from '../../core/events';
import { clinical } from './state';

export function registerPrivacy(): void {
  subscribe<UserDeletedData>(EVENTS.USER_DELETED, 'clinical.erase-donor-data', (data) => {
    const state = clinical();
    if (!state.deletedUsers.includes(data.userId)) state.deletedUsers.push(data.userId);
    for (const record of state.preScreenings) {
      if (record.donorId !== data.userId) continue;
      record.answers = null;
      record.sharedWithStaff = false;
      record.guidance = [];
    }
    for (const document of state.documents) {
      if (document.donorId === data.userId) document.pdfBase64 = '';
    }
  });
}
