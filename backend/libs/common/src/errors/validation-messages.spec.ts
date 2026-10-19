import { IsEmail, IsEnum, IsInt, IsString, Max, MinLength, validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { translateConstraint } from './validation-messages';

enum Color {
  RED = 'RED',
  BLUE = 'BLUE',
}

class SampleDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsInt()
  @Max(10)
  quantity!: number;

  @IsEnum(Color)
  color!: Color;

  @IsString({ message: 'Informe o nome completo.' })
  name!: string;
}

/** Valida o objeto e devolve campo → mensagens traduzidas. */
function translatedErrors(input: object): Record<string, string[]> {
  const errors = validateSync(plainToInstance(SampleDto, input));
  return Object.fromEntries(
    errors.map((error) => [
      error.property,
      Object.entries(error.constraints ?? {}).map(([constraint, message]) =>
        translateConstraint(error.property, constraint, message),
      ),
    ]),
  );
}

describe('translateConstraint', () => {
  it('traduz as mensagens padrão do class-validator, inclusive com parâmetros', () => {
    const errors = translatedErrors({
      email: 'nao-e-email',
      password: 'curta',
      quantity: 11,
      color: 'GREEN',
      name: 'Ana',
    });

    expect(errors.email).toEqual(['Informe um e-mail válido.']);
    expect(errors.password).toEqual(['Deve ter ao menos 8 caracteres.']);
    expect(errors.quantity).toEqual(['Deve ser menor ou igual a 10.']);
    expect(errors.color).toEqual(['Deve ser um destes valores: RED, BLUE.']);
  });

  it('mantém mensagens personalizadas definidas no DTO', () => {
    const errors = translatedErrors({
      email: 'a@b.com',
      password: '12345678',
      quantity: 1,
      color: 'RED',
      name: 42,
    });

    expect(errors.name).toEqual(['Informe o nome completo.']);
  });

  it('traduz campos não permitidos e usa mensagem genérica para regras desconhecidas', () => {
    expect(
      translateConstraint('extra', 'whitelistValidation', 'property extra should not exist'),
    ).toBe('Campo não permitido.');
    expect(translateConstraint('cpf', 'isTaxId', 'cpf must be a tax id')).toBe('Valor inválido.');
  });
});
