import { z } from 'zod';

/** Mesmas regras do servidor: 3 a 24 caracteres; letras, números, espaço, ponto, _ e -. */
export const nicknameSchema = z.object({
  nickname: z
    .string()
    .trim()
    .min(3, 'Use pelo menos 3 caracteres.')
    .max(24, 'Use no máximo 24 caracteres.')
    .regex(
      /^[A-Za-zÀ-ÖØ-öø-ÿ0-9 ._-]+$/,
      'Use letras, números, espaços, ponto, hífen ou sublinhado.',
    ),
});

export type NicknameValues = z.infer<typeof nicknameSchema>;

/** Espaços repetidos viram um só (o servidor faz o mesmo). */
export const normalizeNickname = (value: string): string => value.trim().replace(/\s+/g, ' ');
