import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import type { z } from 'zod';
import { AuthGuard } from './auth/auth.guard';
import { RemoteJwksTokenVerifier } from './auth/token-verifier';
import { loadEnv, type BaseEnv } from './config/env';
import { ProblemDetailsFilter } from './errors/problem-details.filter';
import { InternalHttpClient } from './http/internal-http.client';
import { buildLoggerParams } from './logging/logging';
import { APP_CONFIG, SERVICE_NAME, TOKEN_VERIFIER } from './tokens';

export interface CoreModuleOptions<S extends z.ZodTypeAny> {
  /** Nome do serviço (aparece nos logs, eventos e health check). */
  serviceName: string;
  /** Schema Zod das variáveis de ambiente (deve estender baseEnvSchema). */
  envSchema: S;
  /** Substitui o verificador de JWT padrão (JWKS remoto). Usado pelo identity-service. */
  tokenVerifier?: Omit<Provider, 'provide'> & Record<string, unknown>;
  /** Desliga o guard global de autenticação (o gateway valida via middleware). */
  disableAuthGuard?: boolean;
}

/**
 * Módulo base de todo processo do back-end: configuração validada, logs
 * estruturados, filtro de erros (Problem Details), guard de autenticação
 * e cliente HTTP interno.
 */
@Global()
@Module({})
export class CoreModule {
  static forRoot<S extends z.ZodTypeAny>(options: CoreModuleOptions<S>): DynamicModule {
    const config = loadEnv(options.envSchema) as BaseEnv;

    const verifierProvider: Provider = options.tokenVerifier
      ? ({ ...options.tokenVerifier, provide: TOKEN_VERIFIER } as Provider)
      : { provide: TOKEN_VERIFIER, useFactory: () => new RemoteJwksTokenVerifier(config.JWKS_URL) };

    const providers: Provider[] = [
      { provide: APP_CONFIG, useValue: config },
      { provide: SERVICE_NAME, useValue: options.serviceName },
      verifierProvider,
      { provide: APP_FILTER, useClass: ProblemDetailsFilter },
      InternalHttpClient,
    ];
    if (!options.disableAuthGuard) {
      providers.push({ provide: APP_GUARD, useClass: AuthGuard });
    }

    return {
      module: CoreModule,
      imports: [
        LoggerModule.forRoot(buildLoggerParams(options.serviceName, config.LOG_LEVEL, config.LOG_PRETTY)),
      ],
      providers,
      exports: [APP_CONFIG, SERVICE_NAME, TOKEN_VERIFIER, InternalHttpClient],
    };
  }
}
