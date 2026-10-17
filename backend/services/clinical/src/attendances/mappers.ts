import type { AttendanceStaffView, QuestionOption, ScreeningFieldView } from '@pulso/contracts';
import type {
  Donation,
  ProfessionalScreening,
  ProfessionalScreeningField,
} from '../../generated/prisma';
import type { FieldDefinition } from './field-validation';

export function fieldOptions(value: unknown): QuestionOption[] | null {
  return Array.isArray(value) ? (value as QuestionOption[]) : null;
}

export function toFieldView(field: ProfessionalScreeningField): ScreeningFieldView {
  return {
    id: field.id,
    code: field.code,
    label: field.label,
    type: field.type,
    unit: field.unit,
    options: fieldOptions(field.options),
    helpText: field.helpText,
    required: field.required,
    min: field.min,
    max: field.max,
    order: field.order,
    active: field.active,
  };
}

export function toFieldDefinition(field: ProfessionalScreeningField): FieldDefinition {
  return {
    code: field.code,
    label: field.label,
    type: field.type,
    options: fieldOptions(field.options),
    required: field.required,
    min: field.min,
    max: field.max,
  };
}

export function toAttendanceStaffView(
  attendance: ProfessionalScreening & {
    donation: Pick<Donation, 'id' | 'code' | 'status'> | null;
  },
): AttendanceStaffView {
  return {
    id: attendance.id,
    appointmentId: attendance.appointmentId,
    donorId: attendance.donorId,
    unitId: attendance.unitId,
    result: attendance.result,
    professionalName: attendance.professionalName,
    createdAt: attendance.createdAt.toISOString(),
    donation: attendance.donation
      ? {
          id: attendance.donation.id,
          code: attendance.donation.code,
          status: attendance.donation.status,
        }
      : null,
    completed: attendance.completedAt !== null,
  };
}
