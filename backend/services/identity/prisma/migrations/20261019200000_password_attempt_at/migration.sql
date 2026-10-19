-- Momento da última reserva de tentativa de senha: uma reserva que nunca foi
-- concluída (queda do processo no meio da conferência) vira um bloqueio comum,
-- que expira, em vez de travar a conta para sempre.
ALTER TABLE "users" ADD COLUMN "passwordAttemptAt" TIMESTAMPTZ(3);
