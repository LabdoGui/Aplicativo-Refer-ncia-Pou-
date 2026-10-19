import { z } from 'zod';

/** Código como está impresso no documento (ex.: PUL-7K3M9-QX2TB); a API faz a conferência. */
export const verifySchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Informe o código de verificação.')
    .max(64, 'O código tem no máximo 64 caracteres.')
    .regex(/^[A-Za-z0-9\s-]+$/, 'Use só letras, números e hífen, como no documento.'),
});

export type VerifyValues = z.infer<typeof verifySchema>;

/** Forma exibida na URL: maiúsculas, sem espaços nas pontas. */
export const normalizeCode = (value: string): string => value.trim().toUpperCase();
