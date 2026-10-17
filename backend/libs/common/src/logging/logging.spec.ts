import type { IncomingMessage, ServerResponse } from 'node:http';
import { HEADERS, REQUEST_ID_PATTERN } from '@pulso/contracts';
import { buildLoggerParams } from './logging';

type GenReqId = (request: IncomingMessage, response: ServerResponse) => string;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function genReqId(incoming: string | string[] | undefined) {
  const { pinoHttp } = buildLoggerParams('servico-teste', 'info', false);
  const generate = (pinoHttp as { genReqId: GenReqId }).genReqId;
  const setHeader = jest.fn();
  const request = { headers: { [HEADERS.requestId]: incoming } } as unknown as IncomingMessage;
  const id = generate(request, { setHeader } as unknown as ServerResponse);
  return { id, setHeader };
}

describe('buildLoggerParams › genReqId', () => {
  it.each(['req-12345678', 'abc.DEF_123:xyz-9', 'a'.repeat(128)])(
    'reaproveita x-request-id válido (%s) e o devolve na resposta',
    (incoming) => {
      const { id, setHeader } = genReqId(incoming);

      expect(id).toBe(incoming);
      expect(setHeader).toHaveBeenCalledWith(HEADERS.requestId, incoming);
    },
  );

  it.each([
    ['vazio', ''],
    ['curto demais', 'abc1234'],
    ['longo demais', 'a'.repeat(129)],
    ['com espaço', 'req 12345678'],
    ['com caracteres de controle', 'req-1234\r\nx: y'],
    ['com aspas', 'req-"12345678"'],
    ['repetido (array)', ['req-12345678', 'req-87654321']],
    ['ausente', undefined],
  ])('gera um UUID quando o x-request-id é %s', (_label, incoming) => {
    const { id, setHeader } = genReqId(incoming);

    expect(id).toMatch(UUID);
    expect(id).toMatch(REQUEST_ID_PATTERN);
    expect(setHeader).toHaveBeenCalledWith(HEADERS.requestId, id);
  });
});
