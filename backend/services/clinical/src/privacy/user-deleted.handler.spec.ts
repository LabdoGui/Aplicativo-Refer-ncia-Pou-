import { UserDeletedHandler } from './user-deleted.handler';

type Handler = (envelope: unknown, tx: unknown) => Promise<void>;

describe('UserDeletedHandler (clinical)', () => {
  it('apaga respostas e orientações da pré-triagem e os PDFs emitidos', async () => {
    let handler: Handler | undefined;
    const consumer = {
      on: jest.fn((_type: string, _name: string, fn: Handler) => {
        handler = fn;
      }),
    };
    const encryption = { encryptJson: jest.fn(() => 'cifrado:[]') };
    const tx = {
      preScreening: { updateMany: jest.fn(async () => ({ count: 2 })) },
      document: { updateMany: jest.fn(async () => ({ count: 1 })) },
    };
    new UserDeletedHandler(consumer as never, encryption as never).onModuleInit();
    await handler!({ id: 'e1', data: { userId: 'd1', occurredAt: '2026-10-19T12:00:00Z' } }, tx);
    expect(tx.preScreening.updateMany).toHaveBeenCalledWith({
      where: { donorId: 'd1' },
      data: { answersEncrypted: null, sharedWithStaff: false, guidanceEncrypted: 'cifrado:[]' },
    });
    expect(encryption.encryptJson).toHaveBeenCalledWith([]);
    expect(tx.document.updateMany).toHaveBeenCalledWith({
      where: { donorId: 'd1' },
      data: { pdf: new Uint8Array(0) },
    });
  });
});
