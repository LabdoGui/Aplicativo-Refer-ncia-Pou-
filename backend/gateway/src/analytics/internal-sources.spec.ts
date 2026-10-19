import { AppException, type InternalHttpClient } from '@pulso/common';
import type { Upstream } from '../upstreams/upstreams';
import { COMPOSITION_TIMEOUT_MS, InternalSources, isObject, STATS_PATH } from './internal-sources';

const upstreams: Upstream[] = [
  { name: 'identity', title: 'Identidade', url: 'http://identity:3001' },
  { name: 'clinical', title: 'Clínico', url: 'http://clinical:3003' },
];

describe('InternalSources', () => {
  let get: jest.Mock;
  let sources: InternalSources;

  beforeEach(() => {
    get = jest.fn();
    sources = new InternalSources({ get } as unknown as InternalHttpClient, upstreams);
  });

  it('consulta o serviço com query, request-id e tempo limite da composição', async () => {
    get.mockResolvedValue({ donorsTotal: 3 });
    const result = await sources.get(
      'identity',
      STATS_PATH,
      { from: '2026-10-01' },
      isObject,
      'req-1234',
    );

    expect(result).toEqual({ service: 'identity', ok: true, value: { donorsTotal: 3 } });
    expect(get).toHaveBeenCalledWith('http://identity:3001', STATS_PATH, {
      query: { from: '2026-10-01' },
      requestId: 'req-1234',
      timeoutMs: COMPOSITION_TIMEOUT_MS,
    });
  });

  it('não lança: falha do serviço vira resultado com o código do erro', async () => {
    get.mockRejectedValue(new AppException(503, 'UPSTREAM_UNAVAILABLE', 'fora do ar'));
    await expect(sources.get('clinical', STATS_PATH, {}, isObject)).resolves.toEqual({
      service: 'clinical',
      ok: false,
      reason: 'UPSTREAM_UNAVAILABLE',
    });

    get.mockRejectedValue(new Error('inesperado'));
    await expect(sources.get('clinical', STATS_PATH, {}, isObject)).resolves.toMatchObject({
      ok: false,
      reason: 'UNEXPECTED_ERROR',
    });
  });

  it('recusa resposta fora do formato esperado', async () => {
    get.mockResolvedValue(['não', 'é', 'objeto']);
    await expect(sources.get('identity', STATS_PATH, {}, isObject)).resolves.toMatchObject({
      ok: false,
      reason: 'INVALID_RESPONSE',
    });
  });

  it('serviço sem URL configurada não é consultado', async () => {
    await expect(sources.get('inventory', STATS_PATH, {}, isObject)).resolves.toMatchObject({
      ok: false,
      reason: 'NOT_CONFIGURED',
    });
    expect(get).not.toHaveBeenCalled();
  });
});
