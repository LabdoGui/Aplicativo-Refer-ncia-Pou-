-- O resultado da pré-triagem (dado de saúde) não pertence à trilha de auditoria,
-- que o administrador lê: remove-o dos registros já gravados.
UPDATE "audit_logs"
   SET "metadata" = "metadata" - 'result'
 WHERE "action" = 'prescreening.submitted' AND "metadata" ? 'result';
