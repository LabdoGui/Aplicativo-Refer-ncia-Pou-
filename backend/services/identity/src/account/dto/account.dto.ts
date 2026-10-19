import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  BLOOD_TYPES,
  CONSENT_PURPOSES,
  PASSWORD_POLICY,
  type BloodType,
  type ChangePasswordRequest,
  type ConsentPurpose,
  type DeleteAccountRequest,
  type UpdateConsentsRequest,
  type UpdateMeRequest,
} from '@pulso/contracts';
import { PERSON_NAME, PHONE } from '../../auth/dto/auth.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class UpdateMeDto implements UpdateMeRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  @Matches(PERSON_NAME, { message: 'Use apenas letras, espaços, apóstrofo e hífen.' })
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trim)
  @ValidateIf((_, value) => value !== null)
  @Matches(PHONE, { message: 'Informe um telefone válido com DDD.' })
  phone?: string | null;

  @ApiPropertyOptional({ enum: BLOOD_TYPES, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(BLOOD_TYPES)
  declaredBloodType?: BloodType | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trim)
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(80)
  city?: string | null;
}

export class ChangePasswordDto implements ChangePasswordRequest {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(PASSWORD_POLICY.maxLength)
  currentPassword: string;

  @ApiProperty()
  @IsString()
  @MinLength(PASSWORD_POLICY.minLength, { message: PASSWORD_POLICY.message })
  @MaxLength(PASSWORD_POLICY.maxLength)
  @Matches(PASSWORD_POLICY.pattern, { message: PASSWORD_POLICY.message })
  newPassword: string;
}

export class DeleteAccountDto implements DeleteAccountRequest {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(PASSWORD_POLICY.maxLength)
  password: string;
}

class ConsentChoiceDto {
  @ApiProperty({ enum: CONSENT_PURPOSES })
  @IsIn(CONSENT_PURPOSES)
  purpose: ConsentPurpose;

  @ApiProperty()
  @IsBoolean()
  granted: boolean;
}

export class UpdateConsentsDto implements UpdateConsentsRequest {
  @ApiProperty({ type: [ConsentChoiceDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(CONSENT_PURPOSES.length)
  @ValidateNested({ each: true })
  @Type(() => ConsentChoiceDto)
  consents: ConsentChoiceDto[];
}
