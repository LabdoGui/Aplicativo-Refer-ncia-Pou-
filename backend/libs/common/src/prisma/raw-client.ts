/**
 * Parte do cliente Prisma usada pela infraestrutura comum (outbox, consumidor
 * de eventos, auditoria). Cada serviço tem o próprio cliente gerado; o SQL
 * cru sobre tabelas de mesmo nome em todos os schemas evita depender dos tipos
 * gerados de um serviço específico.
 */
export interface RawSqlExecutor {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}

/** Cliente completo: SQL cru + transação interativa. */
export interface TransactionalClient extends RawSqlExecutor {
  $transaction<R>(
    fn: (tx: never) => Promise<R>,
    options?: { maxWait?: number; timeout?: number },
  ): Promise<R>;
}
