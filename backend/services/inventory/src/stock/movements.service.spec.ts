import { AppException } from '@pulso/common';
import { MovementsService } from './movements.service';

type Mock = jest.Mock;

const actor = {
  id: '3f0c9a8e-1b2d-4c5e-8f9a-0b1c2d3e4f50',
  role: 'ADMIN' as const,
  name: 'Ana',
  unitIds: [],
};

function makeService(stock: { quantity: number; minimum: number; ideal: number } | null) {
  const tx = {
    $queryRaw: jest.fn(async () => (stock ? [{ bloodType: 'O_NEG', ...stock }] : [])) as Mock,
    bloodStock: { update: jest.fn(async () => ({})) as Mock },
    stockMovement: {
      findMany: jest.fn(async () => []) as Mock,
      updateMany: jest.fn(async () => ({ count: 0 })) as Mock,
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'mov-1',
        createdAt: new Date('2026-10-17T12:00:00Z'),
        ...data,
      })) as Mock,
    },
  };
  const prisma = { $transaction: jest.fn(async (fn: (client: unknown) => unknown) => fn(tx)) };
  const outbox = { enqueue: jest.fn(async () => ({})) as Mock };
  const audit = { record: jest.fn(async () => undefined) as Mock };
  const service = new MovementsService(prisma as never, outbox as never, audit as never);
  return { service, tx, outbox, audit };
}

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(AppException);
  await promise.catch((error: AppException) => expect(error.code).toBe(code));
}

describe('MovementsService.create', () => {
  it('recusa saída maior que o estoque atual (422) sem alterar nada', async () => {
    const { service, tx } = makeService({ quantity: 5, minimum: 10, ideal: 20 });
    await expectCode(
      service.create(actor, {
        bloodType: 'O_NEG',
        type: 'OUT',
        quantity: 6,
        reason: 'HOSPITAL_DISTRIBUTION',
      }),
      'INSUFFICIENT_STOCK',
    );
    expect(tx.bloodStock.update).not.toHaveBeenCalled();
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });

  it('recusa motivo que não corresponde ao tipo', async () => {
    const { service } = makeService({ quantity: 5, minimum: 10, ideal: 20 });
    await expectCode(
      service.create(actor, {
        bloodType: 'O_NEG',
        type: 'IN',
        quantity: 1,
        reason: 'EXPIRED_DISCARD',
      }),
      'REASON_TYPE_MISMATCH',
    );
  });

  it('recusa data futura e data antiga demais', async () => {
    const { service } = makeService({ quantity: 5, minimum: 10, ideal: 20 });
    const base = {
      bloodType: 'O_NEG' as const,
      type: 'IN' as const,
      quantity: 1,
      reason: 'TRANSFER_IN' as const,
    };
    await expectCode(
      service.create(actor, {
        ...base,
        occurredAt: new Date(Date.now() + 3_600_000).toISOString(),
      }),
      'INVALID_OCCURRED_AT',
    );
    await expectCode(
      service.create(actor, {
        ...base,
        occurredAt: new Date(Date.now() - 31 * 86_400_000).toISOString(),
      }),
      'INVALID_OCCURRED_AT',
    );
  });

  it('entrada atualiza o saldo, grava balanceAfter e publica mudança de status', async () => {
    const { service, tx, outbox, audit } = makeService({ quantity: 8, minimum: 10, ideal: 20 });
    const view = await service.create(actor, {
      bloodType: 'O_NEG',
      type: 'IN',
      quantity: 4,
      reason: 'PROCESSED_COLLECTION',
      notes: '  lote 12  ',
    });
    expect(tx.bloodStock.update).toHaveBeenCalledWith({
      where: { bloodType: 'O_NEG' },
      data: { quantity: 12 },
    });
    expect(view.balanceAfter).toBe(12);
    expect(view.responsibleName).toBe('Ana');
    expect(outbox.enqueue).toHaveBeenCalledWith(
      tx,
      'inventory.stock.level_changed',
      { bloodType: 'O_NEG', previousStatus: 'CRITICAL', status: 'ATTENTION', quantity: 12 },
      undefined,
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'stock.movement_created' }),
      tx,
    );
  });

  it('não publica evento quando o status continua o mesmo', async () => {
    const { service, outbox } = makeService({ quantity: 50, minimum: 10, ideal: 20 });
    await service.create(actor, {
      bloodType: 'O_NEG',
      type: 'OUT',
      quantity: 5,
      reason: 'HOSPITAL_DISTRIBUTION',
    });
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('saída retroativa não pode deixar o saldo negativo no período', async () => {
    const { service, tx } = makeService({ quantity: 10, minimum: 1, ideal: 2 });
    // Depois da data informada entrou uma remessa de 10: antes dela, o saldo era 0.
    tx.stockMovement.findMany.mockResolvedValueOnce([{ type: 'IN', quantity: 10 }]);
    await expectCode(
      service.create(actor, {
        bloodType: 'O_NEG',
        type: 'OUT',
        quantity: 3,
        reason: 'HOSPITAL_DISTRIBUTION',
        occurredAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      }),
      'INSUFFICIENT_STOCK',
    );
  });

  it('entrada retroativa: saldo da data informada e posteriores ajustadas', async () => {
    const { service, tx } = makeService({ quantity: 20, minimum: 1, ideal: 2 });
    // Depois da data informada: entrada de 8 e saída de 3 (efeito líquido +5).
    tx.stockMovement.findMany.mockResolvedValueOnce([
      { type: 'OUT', quantity: 3 },
      { type: 'IN', quantity: 8 },
    ]);
    const occurredAt = new Date(Date.now() - 2 * 86_400_000).toISOString();
    const view = await service.create(actor, {
      bloodType: 'O_NEG',
      type: 'IN',
      quantity: 4,
      reason: 'PROCESSED_COLLECTION',
      occurredAt,
    });
    // Na data, o saldo era 20 − 5 = 15; com a entrada, 19.
    expect(view.balanceAfter).toBe(19);
    expect(tx.bloodStock.update).toHaveBeenCalledWith({
      where: { bloodType: 'O_NEG' },
      data: { quantity: 24 },
    });
    expect(tx.stockMovement.updateMany).toHaveBeenCalledWith({
      where: { bloodType: 'O_NEG', occurredAt: { gt: new Date(occurredAt) } },
      data: { balanceAfter: { increment: 4 } },
    });
  });

  it('sem movimentações posteriores, nada é ajustado', async () => {
    const { service, tx } = makeService({ quantity: 20, minimum: 1, ideal: 2 });
    await service.create(actor, {
      bloodType: 'O_NEG',
      type: 'OUT',
      quantity: 2,
      reason: 'HOSPITAL_DISTRIBUTION',
    });
    expect(tx.stockMovement.updateMany).not.toHaveBeenCalled();
  });
});
