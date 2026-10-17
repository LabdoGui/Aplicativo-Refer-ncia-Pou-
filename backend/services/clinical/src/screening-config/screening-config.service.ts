import { Injectable } from '@nestjs/common';
import { AppException, AuditService } from '@pulso/common';
import type {
  AuthUser,
  ScreeningConfigView,
  ScreeningFieldView,
  ScreeningRuleView,
} from '@pulso/contracts';
import { Prisma } from '../../generated/prisma';
import { fieldOptions, toFieldView } from '../attendances/mappers';
import { toQuestionView, toRuleView } from '../pre-screening/mappers';
import { sortQuestions } from '../pre-screening/rule-engine';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateFieldDto,
  UpdateFieldDto,
  UpdateQuestionDto,
  UpdateRuleDto,
} from './dto/screening-config.dto';

@Injectable()
export class ScreeningConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async view(): Promise<ScreeningConfigView> {
    const ruleSet = await this.prisma.screeningRuleSet.findFirst({
      where: { status: 'ACTIVE' },
      include: {
        questions: true,
        rules: {
          include: { question: { select: { code: true, text: true, step: true, order: true } } },
        },
      },
    });
    if (!ruleSet) {
      throw new AppException(404, 'RULE_SET_NOT_FOUND', 'Nenhum conjunto de regras vigente.');
    }
    const rules = [...ruleSet.rules].sort(
      (a, b) =>
        a.question.step - b.question.step ||
        a.question.order - b.question.order ||
        a.order - b.order,
    );
    return {
      ruleSet: {
        id: ruleSet.id,
        version: ruleSet.version,
        validationStatus: ruleSet.validationStatus,
        normativeReference: ruleSet.normativeReference,
        publishedAt: ruleSet.publishedAt?.toISOString() ?? null,
      },
      questions: sortQuestions(ruleSet.questions).map((question) => ({
        ...toQuestionView(question),
        active: question.active,
      })),
      rules: rules.map(toRuleView),
    };
  }

  async updateQuestion(actor: AuthUser, id: string, dto: UpdateQuestionDto, requestId?: string) {
    const question = await this.prisma.screeningQuestion.findUnique({ where: { id } });
    if (!question) throw new AppException(404, 'QUESTION_NOT_FOUND', 'Pergunta não encontrada.');
    await this.prisma.$transaction(async (tx) => {
      await tx.screeningQuestion.update({
        where: { id },
        data: {
          ...(dto.text !== undefined ? { text: dto.text } : {}),
          ...(dto.helpText !== undefined ? { helpText: dto.helpText || null } : {}),
          ...(dto.active !== undefined ? { active: dto.active } : {}),
        },
      });
      await this.audit.record(
        {
          actor,
          action: 'screening_config.question_updated',
          entity: 'screening_question',
          entityId: id,
          metadata: { code: question.code, fields: Object.keys(dto) },
          requestId,
        },
        tx,
      );
    });
    return this.view();
  }

  async updateRule(
    actor: AuthUser,
    id: string,
    dto: UpdateRuleDto,
    requestId?: string,
  ): Promise<ScreeningRuleView> {
    const rule = await this.prisma.screeningRule.findUnique({ where: { id } });
    if (!rule) throw new AppException(404, 'RULE_NOT_FOUND', 'Regra não encontrada.');
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.screeningRule.update({
        where: { id },
        data: {
          ...(dto.message !== undefined ? { message: dto.message } : {}),
          ...(dto.active !== undefined ? { active: dto.active } : {}),
        },
        include: { question: { select: { code: true, text: true } } },
      });
      await this.audit.record(
        {
          actor,
          action: 'screening_config.rule_updated',
          entity: 'screening_rule',
          entityId: id,
          metadata: { fields: Object.keys(dto) },
          requestId,
        },
        tx,
      );
      return row;
    });
    return toRuleView(updated);
  }

  async fields(): Promise<ScreeningFieldView[]> {
    const fields = await this.prisma.professionalScreeningField.findMany({
      orderBy: [{ order: 'asc' }, { label: 'asc' }],
    });
    return fields.map(toFieldView);
  }

  async createField(
    actor: AuthUser,
    dto: CreateFieldDto,
    requestId?: string,
  ): Promise<ScreeningFieldView> {
    this.assertFieldShape(dto.type, dto.options ?? null, dto.min ?? null, dto.max ?? null);
    try {
      const field = await this.prisma.$transaction(async (tx) => {
        const created = await tx.professionalScreeningField.create({
          data: {
            code: dto.code,
            label: dto.label,
            type: dto.type,
            unit: dto.unit ?? null,
            options: dto.type === 'SELECT' && dto.options ? toJson(dto.options) : Prisma.DbNull,
            helpText: dto.helpText ?? null,
            required: dto.required ?? false,
            min: dto.type === 'NUMBER' ? (dto.min ?? null) : null,
            max: dto.type === 'NUMBER' ? (dto.max ?? null) : null,
            order: dto.order ?? 0,
            active: dto.active ?? true,
          },
        });
        await this.audit.record(
          {
            actor,
            action: 'screening_config.field_created',
            entity: 'screening_field',
            entityId: created.id,
            metadata: { code: created.code, type: created.type },
            requestId,
          },
          tx,
        );
        return created;
      });
      return toFieldView(field);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppException(
          409,
          'FIELD_CODE_TAKEN',
          'Já existe um campo com este código.',
          undefined,
          [{ field: 'code', message: 'Já existe um campo com este código.' }],
        );
      }
      throw error;
    }
  }

  async updateField(
    actor: AuthUser,
    id: string,
    dto: UpdateFieldDto,
    requestId?: string,
  ): Promise<ScreeningFieldView> {
    const field = await this.prisma.professionalScreeningField.findUnique({ where: { id } });
    if (!field) throw new AppException(404, 'FIELD_NOT_FOUND', 'Campo não encontrado.');
    const options = dto.options !== undefined ? dto.options : fieldOptions(field.options);
    const min = dto.min !== undefined ? dto.min : field.min;
    const max = dto.max !== undefined ? dto.max : field.max;
    this.assertFieldShape(field.type, options, min, max);
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.professionalScreeningField.update({
        where: { id },
        data: {
          ...(dto.label !== undefined ? { label: dto.label } : {}),
          ...(dto.unit !== undefined ? { unit: dto.unit || null } : {}),
          ...(dto.options !== undefined && field.type === 'SELECT'
            ? { options: dto.options ? toJson(dto.options) : Prisma.DbNull }
            : {}),
          ...(dto.helpText !== undefined ? { helpText: dto.helpText || null } : {}),
          ...(dto.required !== undefined ? { required: dto.required } : {}),
          ...(field.type === 'NUMBER' && dto.min !== undefined ? { min: dto.min } : {}),
          ...(field.type === 'NUMBER' && dto.max !== undefined ? { max: dto.max } : {}),
          ...(dto.order !== undefined ? { order: dto.order } : {}),
          ...(dto.active !== undefined ? { active: dto.active } : {}),
        },
      });
      await this.audit.record(
        {
          actor,
          action: 'screening_config.field_updated',
          entity: 'screening_field',
          entityId: id,
          metadata: { code: field.code, fields: Object.keys(dto) },
          requestId,
        },
        tx,
      );
      return row;
    });
    return toFieldView(updated);
  }

  private assertFieldShape(
    type: string,
    options: Array<{ value: string; label: string }> | null,
    min: number | null,
    max: number | null,
  ): void {
    if (type === 'SELECT' && (!options || options.length === 0)) {
      throw new AppException(
        422,
        'FIELD_OPTIONS_REQUIRED',
        'Campos de seleção precisam de opções.',
        undefined,
        [{ field: 'options', message: 'Informe ao menos uma opção.' }],
      );
    }
    if (options && new Set(options.map((o) => o.value)).size !== options.length) {
      throw new AppException(
        422,
        'FIELD_OPTIONS_DUPLICATED',
        'As opções precisam ter valores diferentes.',
      );
    }
    if (min !== null && max !== null && min > max) {
      throw new AppException(
        422,
        'FIELD_RANGE_INVALID',
        'O mínimo não pode ser maior que o máximo.',
        undefined,
        [{ field: 'min', message: 'O mínimo não pode ser maior que o máximo.' }],
      );
    }
  }
}

function toJson(options: Array<{ value: string; label: string }>): Prisma.InputJsonValue {
  return options.map((option) => ({ value: option.value, label: option.label }));
}
