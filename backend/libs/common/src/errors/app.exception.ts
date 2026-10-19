import { HttpException } from '@nestjs/common';

/**
 * Erro de negócio com código estável e mensagem amigável ao usuário final.
 *
 * Exemplo:
 *   throw new AppException(409, 'SLOT_FULL', 'Este horário acabou de lotar. Escolha outro horário.');
 */
export class AppException extends HttpException {
  constructor(
    status: number,
    public readonly code: string,
    detail: string,
    public readonly title?: string,
    public readonly fieldErrors?: Array<{ field: string; message: string }>,
  ) {
    super({ code, message: detail, title, errors: fieldErrors }, status);
  }
}
