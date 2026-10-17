import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PASSWORD_POLICY, type LoginRequest, type RegisterRequest } from '@pulso/contracts';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/** Nome com letras (inclusive acentuadas), espaços, apóstrofo e hífen. */
export const PERSON_NAME = /^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/;
/** Telefone brasileiro: (11) 91234-5678, 11912345678, +55 11 91234-5678… */
export const PHONE = /^\+?[\d\s().-]{10,20}$/;

export class RegisterDto implements RegisterRequest {
  @ApiProperty({ example: 'Maria da Silva' })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  @Matches(PERSON_NAME, { message: 'Use apenas letras, espaços, apóstrofo e hífen.' })
  name: string;

  @ApiProperty({ example: 'maria@exemplo.test' })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(160)
  email: string;

  @ApiProperty({ minLength: PASSWORD_POLICY.minLength })
  @IsString()
  @MinLength(PASSWORD_POLICY.minLength, { message: PASSWORD_POLICY.message })
  @MaxLength(PASSWORD_POLICY.maxLength)
  @Matches(PASSWORD_POLICY.pattern, { message: PASSWORD_POLICY.message })
  password: string;

  @ApiProperty({ example: '1998-04-12', description: 'AAAA-MM-DD' })
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Informe a data no formato AAAA-MM-DD.' })
  birthDate: string;

  @ApiPropertyOptional({ example: '(11) 91234-5678' })
  @IsOptional()
  @Transform(trim)
  @Matches(PHONE, { message: 'Informe um telefone válido com DDD.' })
  phone?: string;

  @ApiProperty({ description: 'Aceite dos Termos de Uso e da Política de Privacidade' })
  @IsBoolean()
  @Equals(true, { message: 'É preciso aceitar os Termos de Uso e a Política de Privacidade.' })
  acceptTerms: boolean;

  @ApiPropertyOptional({ description: 'Aceita receber lembretes e comunicações' })
  @IsOptional()
  @IsBoolean()
  acceptCommunications?: boolean;
}

export class LoginDto implements LoginRequest {
  @ApiProperty({ example: 'doador@demo.com' })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(160)
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(PASSWORD_POLICY.maxLength)
  password: string;
}
