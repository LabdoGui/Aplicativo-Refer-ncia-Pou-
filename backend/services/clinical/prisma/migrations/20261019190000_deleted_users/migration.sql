-- Contas excluídas (evento identity.user.deleted): o serviço recusa escritas
-- de um token ainda válido e não grava dados novos para elas.
CREATE TABLE "deleted_users" (
    "userId" UUID NOT NULL,
    "deletedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deleted_users_pkey" PRIMARY KEY ("userId")
);
