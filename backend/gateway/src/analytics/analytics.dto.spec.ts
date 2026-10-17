import type { ArgumentMetadata } from '@nestjs/common';
import { createValidationPipe } from '@pulso/common';
import { AuditLogsQueryDto, DashboardQueryDto } from './analytics.dto';

const pipe = createValidationPipe();
const validate = (metatype: ArgumentMetadata['metatype'], value: Record<string, unknown>) =>
  pipe.transform(value, { type: 'query', metatype });

async function fieldsWithErrors(promise: Promise<unknown>): Promise<string[]> {
  try {
    await promise;
    return [];
  } catch (error) {
    const body = (error as { getResponse(): { errors: Array<{ field: string }> } }).getResponse();
    return body.errors.map((item) => item.field);
  }
}

describe('DashboardQueryDto', () => {
  it('aceita período em datas locais com unidade e tipo sanguíneo', async () => {
    await expect(
      validate(DashboardQueryDto, {
        from: '2026-09-17',
        to: '2026-10-17',
        unitId: '3c9911a0-c648-4537-a512-c12172bc808a',
        bloodType: 'O_NEG',
      }),
    ).resolves.toBeInstanceOf(DashboardQueryDto);
  });

  it('exige datas AAAA-MM-DD (sem horário) e valida unidade e tipo', async () => {
    const fields = await fieldsWithErrors(
      validate(DashboardQueryDto, {
        from: '2026-09-17T10:00:00Z',
        unitId: 'unidade-1',
        bloodType: 'Z_POS',
      }),
    );
    expect(fields).toEqual(expect.arrayContaining(['from', 'to', 'unitId', 'bloodType']));
  });
});

describe('AuditLogsQueryDto', () => {
  it('converte o limite e aceita os serviços auditados', async () => {
    const result = (await validate(AuditLogsQueryDto, {
      service: 'clinical',
      limit: '50',
    })) as AuditLogsQueryDto;
    expect(result.limit).toBe(50);
  });

  it('recusa serviço sem trilha, limite fora da faixa e campos desconhecidos', async () => {
    const fields = await fieldsWithErrors(
      validate(AuditLogsQueryDto, { service: 'notification', limit: '501', extra: '1' }),
    );
    expect(fields).toEqual(expect.arrayContaining(['service', 'limit', 'extra']));
  });
});
