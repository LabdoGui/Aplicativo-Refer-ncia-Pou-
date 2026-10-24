import type { OpenAPIObject } from '@nestjs/swagger';
import { mergeOpenApiDocuments, type OpenApiSource } from './openapi-merge';

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

function doc(partial: Partial<OpenAPIObject>): OpenAPIObject {
  return { openapi: '3.0.0', info: { title: 't', version: '1' }, paths: {}, ...partial };
}

const gateway = doc({
  paths: {
    '/health': { get: { operationId: 'HealthController_check', responses: {} } },
    '/api/v1/health/services': {
      get: {
        operationId: 'ServicesHealthController_services',
        tags: ['Saúde'],
        responses: {
          '200': {
            description: 'ok',
            content: { 'application/json': { schema: ref('ServicesHealthDto') } },
          },
        },
      },
    },
  },
  components: {
    schemas: { ServicesHealthDto: { type: 'object' } },
    securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
  },
  tags: [{ name: 'Saúde', description: 'Disponibilidade' }],
});

const identity = doc({
  paths: {
    '/health': { get: { operationId: 'HealthController_check', tags: ['Saúde'], responses: {} } },
    '/api/v1/users/me': {
      get: {
        operationId: 'UsersController_me',
        tags: ['Usuários'],
        security: [{ bearer: [] }],
        responses: {
          '200': { description: 'ok', content: { 'application/json': { schema: ref('UserDto') } } },
        },
      },
    },
    '/api/v1/internal/stats': { get: { operationId: 'InternalController_stats', responses: {} } },
    '/api/v1/units': { get: { operationId: 'Intruso_units', responses: {} } },
  },
  components: {
    schemas: {
      UserDto: { type: 'object', properties: { id: { type: 'string' }, page: ref('PageMeta') } },
      PageMeta: { type: 'object', properties: { total: { type: 'number' } } },
      ProblemDto: {
        type: 'object',
        properties: { code: { type: 'string' }, status: { type: 'number' } },
      },
      Wrapper: { type: 'object', properties: { meta: ref('PageMeta') } },
    },
    securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
  },
  tags: [{ name: 'Usuários', description: 'Contas' }],
});

const scheduling = doc({
  paths: {
    '/health': { get: { operationId: 'HealthController_check', responses: {} } },
    '/api/v1/units': {
      get: {
        operationId: 'UsersController_me', // colisão proposital de operationId
        responses: {
          '200': { description: 'ok', content: { 'application/json': { schema: ref('UserDto') } } },
        },
      },
    },
    '/api/v1/appointments': {
      get: {
        operationId: 'AppointmentsController_list',
        tags: ['Agendamentos'],
        responses: {
          '200': {
            description: 'ok',
            content: { 'application/json': { schema: ref('PageOfAppointments') } },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      // Mesmo nome, conteúdo diferente → colisão.
      UserDto: { type: 'object', properties: { donorCode: { type: 'string' } } },
      // Mesmo conteúdo (chaves em outra ordem) → compartilhado, sem prefixo.
      ProblemDto: {
        properties: { status: { type: 'number' }, code: { type: 'string' } },
        type: 'object',
      },
      PageMeta: { type: 'object', properties: { pages: { type: 'number' } } },
      // Mesmo texto do identity, mas aponta para um PageMeta diferente → também colide.
      Wrapper: { type: 'object', properties: { meta: ref('PageMeta') } },
      PageOfAppointments: { type: 'object', properties: { meta: ref('PageMeta') } },
    },
  },
});

function merge(services: OpenApiSource[]) {
  return mergeOpenApiDocuments({
    title: 'SangueConecta — API',
    version: '0.1.0',
    description: 'Introdução.',
    gateway,
    services,
  });
}

describe('mergeOpenApiDocuments', () => {
  const all: OpenApiSource[] = [
    { name: 'identity', title: 'Identidade e acesso', document: identity },
    { name: 'scheduling', title: 'Agendamento', document: scheduling },
    { name: 'clinical', title: 'Triagem, doação e documentos', document: null },
  ];
  const merged = merge(all);
  const schemas = merged.components!.schemas!;

  it('junta as rotas, sem o /health de cada processo', () => {
    expect(Object.keys(merged.paths).sort()).toEqual([
      '/api/v1/appointments',
      '/api/v1/health/services',
      '/api/v1/units',
      '/api/v1/users/me',
    ]);
  });

  it('não publica rotas internas nem rotas que o gateway encaminha a outro serviço', () => {
    expect(merged.paths['/api/v1/internal/stats']).toBeUndefined();
    expect(merged.paths['/api/v1/units'].get!.operationId).not.toBe('Intruso_units');
  });

  it('prefixa com o nome do serviço apenas os componentes em colisão', () => {
    expect(schemas['identity.UserDto']).toMatchObject({ properties: { id: { type: 'string' } } });
    expect(schemas['scheduling.UserDto']).toMatchObject({
      properties: { donorCode: { type: 'string' } },
    });
    expect(schemas.UserDto).toBeUndefined();
    expect(schemas.ProblemDto).toBeDefined();
    expect(schemas['identity.ProblemDto']).toBeUndefined();
    expect(schemas.ServicesHealthDto).toBeDefined();
    // Definido por um só serviço: mantém o nome original.
    expect(schemas.PageOfAppointments).toBeDefined();
    expect(schemas['scheduling.PageOfAppointments']).toBeUndefined();
  });

  it('reescreve os $ref de cada serviço para os nomes finais', () => {
    const identityOk = merged.paths['/api/v1/users/me'].get!.responses['200'] as any;
    const schedulingOk = merged.paths['/api/v1/units'].get!.responses['200'] as any;
    expect(identityOk.content['application/json'].schema).toEqual(ref('identity.UserDto'));
    expect(schedulingOk.content['application/json'].schema).toEqual(ref('scheduling.UserDto'));
    expect((schemas['identity.UserDto'] as any).properties.page).toEqual(ref('identity.PageMeta'));
  });

  it('detecta colisões indiretas (mesmo texto apontando para componentes diferentes)', () => {
    expect(schemas.Wrapper).toBeUndefined();
    expect(schemas['identity.Wrapper']).toEqual({
      type: 'object',
      properties: { meta: ref('identity.PageMeta') },
    });
    expect(schemas['scheduling.Wrapper']).toEqual({
      type: 'object',
      properties: { meta: ref('scheduling.PageMeta') },
    });
    expect(schemas.PageOfAppointments).toEqual({
      type: 'object',
      properties: { meta: ref('scheduling.PageMeta') },
    });
  });

  it('evita operationId duplicado prefixando com o serviço', () => {
    expect(merged.paths['/api/v1/users/me'].get!.operationId).toBe('UsersController_me');
    expect(merged.paths['/api/v1/units'].get!.operationId).toBe('scheduling_UsersController_me');
  });

  it('agrupa operações sem tag sob o nome do serviço e lista só tags usadas', () => {
    expect(merged.paths['/api/v1/units'].get!.tags).toEqual(['Agendamento']);
    expect(merged.tags!.map((tag) => tag.name)).toEqual([
      'Saúde',
      'Usuários',
      'Agendamento',
      'Agendamentos',
    ]);
    expect(merged.tags![0]).toEqual({ name: 'Saúde', description: 'Disponibilidade' });
  });

  it('inclui o esquema de segurança Bearer', () => {
    expect(merged.components!.securitySchemes!.bearer).toEqual({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    });
  });

  it('lista os serviços indisponíveis na descrição', () => {
    expect(merged.info.description).toContain('Introdução.');
    expect(merged.info.description).toContain(
      'Identidade e acesso (`identity`), Agendamento (`scheduling`)',
    );
    expect(merged.info.description).toMatch(
      /indisponíveis[^\n]*Triagem, doação e documentos \(`clinical`\)/,
    );
    expect((merged as any)['x-pulso-services']).toContainEqual({
      name: 'clinical',
      title: 'Triagem, doação e documentos',
      available: false,
    });
  });

  it('funciona com todos os serviços fora do ar (só as rotas do gateway)', () => {
    const onlyGateway = merge([{ name: 'identity', title: 'Identidade e acesso', document: null }]);
    expect(Object.keys(onlyGateway.paths)).toEqual(['/api/v1/health/services']);
    expect(onlyGateway.info.description).toContain('**Serviços incluídos:** nenhum.');
    expect(onlyGateway.components!.securitySchemes!.bearer).toBeDefined();
  });

  it('não altera os documentos de origem', () => {
    expect(identity.components!.schemas!.UserDto).toEqual({
      type: 'object',
      properties: { id: { type: 'string' }, page: ref('PageMeta') },
    });
    expect(scheduling.paths['/api/v1/units'].get!.operationId).toBe('UsersController_me');
  });
});
