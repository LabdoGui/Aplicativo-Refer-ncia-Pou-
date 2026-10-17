import { Controller, Get, Header } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@pulso/common';
import { KeyStore, type PublicJwks } from './key-store';

@ApiTags('Chaves públicas')
@Controller('.well-known')
export class JwksController {
  constructor(private readonly keys: KeyStore) {}

  @Public()
  @Get('jwks.json')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOperation({ summary: 'Chaves públicas (JWKS) para validar os access tokens' })
  @ApiOkResponse({ description: 'Conjunto de chaves no formato JWK' })
  jwks(): PublicJwks {
    return this.keys.jwks;
  }
}
