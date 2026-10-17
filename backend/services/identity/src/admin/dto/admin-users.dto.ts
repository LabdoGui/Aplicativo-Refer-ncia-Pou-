import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  PASSWORD_POLICY,
  ROLES,
  USER_STATUSES,
  type CreateStaffUserRequest,
  type Role,
  type StaffRole,
  type UpdateUserRequest,
  type UserStatus,
} from '@pulso/contracts';
import { PaginationQueryDto } from '@pulso/common';
import { PERSON_NAME } from '../../auth/dto/auth.dto';

const STAFF_ROLES: StaffRole[] = ['COLLABORATOR', 'NURSE', 'ADMIN'];
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class AdminUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ROLES })
  @IsOptional()
  @IsIn(ROLES)
  role?: Role;

  @ApiPropertyOptional({ enum: USER_STATUSES })
  @IsOptional()
  @IsIn(USER_STATUSES)
  status?: UserStatus;

  @ApiPropertyOptional({ description: 'Busca por nome, e-mail ou código de doador' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  search?: string;
}

export class CreateStaffUserDto implements CreateStaffUserRequest {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  @Matches(PERSON_NAME, { message: 'Use apenas letras, espaços, apóstrofo e hífen.' })
  name: string;

  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(160)
  email: string;

  @ApiProperty({ description: 'Senha inicial (a pessoa deve trocá-la no primeiro acesso)' })
  @IsString()
  @MinLength(PASSWORD_POLICY.minLength, { message: PASSWORD_POLICY.message })
  @MaxLength(PASSWORD_POLICY.maxLength)
  @Matches(PASSWORD_POLICY.pattern, { message: PASSWORD_POLICY.message })
  password: string;

  @ApiProperty({ enum: STAFF_ROLES })
  @IsIn(STAFF_ROLES)
  role: StaffRole;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  unitIds: string[];

  @ApiPropertyOptional({ example: 'COREN-SP 000000' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(40)
  registryNumber?: string;
}

export class UpdateUserDto implements UpdateUserRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  @Matches(PERSON_NAME, { message: 'Use apenas letras, espaços, apóstrofo e hífen.' })
  name?: string;

  @ApiPropertyOptional({ enum: STAFF_ROLES })
  @IsOptional()
  @IsIn(STAFF_ROLES)
  role?: StaffRole;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'DISABLED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'DISABLED'])
  status?: 'ACTIVE' | 'DISABLED';

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  unitIds?: string[];

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trim)
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(40)
  registryNumber?: string | null;
}
