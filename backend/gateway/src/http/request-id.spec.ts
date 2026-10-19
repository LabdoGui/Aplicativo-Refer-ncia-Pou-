import type { Request, Response } from 'express';
import { ensureRequestId } from './request-id';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function call(options: { id?: unknown; header?: string | string[] } = {}) {
  const request = {
    id: options.id,
    headers: options.header === undefined ? {} : { 'x-request-id': options.header },
  } as unknown as Request;
  const setHeader = jest.fn();
  const response = { headersSent: false, setHeader } as unknown as Response;
  const id = ensureRequestId(request, response);
  return { id, request: request as Request & { id?: unknown }, setHeader };
}

describe('ensureRequestId', () => {
  it('usa o id já definido pelo pino-http', () => {
    const { id, setHeader } = call({ id: 'req-do-logger', header: 'req-do-cliente' });

    expect(id).toBe('req-do-logger');
    expect(setHeader).not.toHaveBeenCalled();
  });

  it('sem logger, reaproveita o x-request-id válido do cliente', () => {
    const { id, request, setHeader } = call({ header: 'req-cliente-123' });

    expect(id).toBe('req-cliente-123');
    expect(request.id).toBe('req-cliente-123');
    expect(setHeader).toHaveBeenCalledWith('x-request-id', 'req-cliente-123');
  });

  it.each([
    ['vazio', { header: '' }],
    ['fora do formato', { header: 'id com espaço' }],
    ['repetido', { header: ['req-cliente-123', 'req-cliente-456'] }],
    ['id do logger inválido', { id: '' }],
  ])('gera um UUID quando o id é %s', (_label, options) => {
    const { id, setHeader } = call(options);

    expect(id).toMatch(UUID);
    expect(setHeader).toHaveBeenCalledWith('x-request-id', id);
  });
});
