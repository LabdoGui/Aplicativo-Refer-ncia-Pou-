# 08 — Stack tecnológica

> Critérios de escolha, em ordem de peso: **(1) o que a equipe já domina**, (2) suporte maduro a microsserviços e segurança, (3) documentação e comunidade, (4) custo zero, (5) clareza na apresentação acadêmica.
> **Regra de ouro:** se a equipe já domina TypeScript e não domina Java, troque o back-end por NestJS. A arquitetura não muda.

## 9.1 Front-end

| Opção | Prós | Contras | Veredito |
|---|---|---|---|
| **React + Vite + TypeScript (SPA/PWA)** | Simples, rápido, enorme ecossistema; uma base para os 3 perfis; PWA permite instalar e receber web push | SEO limitado nas páginas públicas | ✅ **Escolhido** |
| Next.js | SSR/SEO para as páginas de descoberta | Mais conceitos (server components, rotas de servidor) que se sobrepõem ao back-end próprio | Alternativa, se SEO virar meta |
| React Native | App nativo | Segunda base de código para o admin e o profissional (que usam desktop/tablet); publicação em loja | ❌ no MVP |
| Flutter | Multiplataforma com UI consistente | Dart (nova linguagem para a equipe); web menos madura para dashboards densos | ❌ |

**Por que web/PWA e não app nativo:** o doador usa o sistema poucas vezes por ano (o intervalo entre doações é de meses). **Exigir instalação de app é uma barreira** justamente no público que queremos atrair [HIPÓTESE, validar na pesquisa]. A PWA pode ser "adicionada à tela inicial" e recebe notificações push quando o navegador suporta.

**Bibliotecas propostas:**

| Necessidade | Biblioteca |
|---|---|
| Roteamento | React Router |
| Dados do servidor e cache | TanStack Query |
| Formulários e validação | React Hook Form + Zod |
| Componentes acessíveis | shadcn/ui (sobre Radix UI) + Tailwind CSS |
| Gráficos (painel de estoque) | Recharts |
| Ícones | Lucide |
| PWA | vite-plugin-pwa (Workbox) |
| Testes | Vitest + Testing Library; Playwright (E2E, com o Chromium já disponível) |
| Cliente da API | Gerado a partir do OpenAPI (openapi-typescript), o que evita divergência de contrato |

## 9.2 Back-end

| Critério | Java + Spring Boot | Node.js + NestJS | Python + FastAPI |
|---|---|---|---|
| Microsserviços (gateway, resiliência, mensageria) | ⭐⭐⭐ Spring Cloud Gateway, Resilience4j, Spring AMQP | ⭐⭐ módulos de microsserviços, mas gateway e resiliência dependem de terceiros | ⭐⭐ montagem manual |
| API REST + OpenAPI | ⭐⭐⭐ springdoc gera o OpenAPI do código | ⭐⭐⭐ @nestjs/swagger | ⭐⭐⭐ OpenAPI nativo (ponto forte) |
| Segurança (JWT, RBAC, método) | ⭐⭐⭐ Spring Security (resource server, `@PreAuthorize`) | ⭐⭐ Passport + guards | ⭐⭐ dependências manuais |
| Persistência e migrações | ⭐⭐⭐ JPA/Hibernate + Flyway | ⭐⭐ TypeORM ou Prisma | ⭐⭐ SQLAlchemy + Alembic |
| Testes de integração | ⭐⭐⭐ Testcontainers + JUnit 5 | ⭐⭐ Testcontainers (Node) | ⭐⭐ Testcontainers (Python) |
| Curva de aprendizado | ⭐ mais verboso e com mais conceitos | ⭐⭐ média, mesma linguagem do front | ⭐⭐⭐ mais baixa |
| Consumo de memória (7 processos no notebook) | ⭐ ~250 a 350 MB por serviço | ⭐⭐⭐ ~60 a 120 MB | ⭐⭐⭐ ~60 a 120 MB |
| Aceitação em contexto acadêmico e mercado BR | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ |

**Escolha: Java (LTS 21 ou 25) + Spring Boot**, na versão estável mais recente que o Spring Initializr oferecer e que o springdoc suporte.

- **Por quê:** é o ecossistema mais completo e coeso para *exatamente* os requisitos obrigatórios (gateway, segurança, mensageria, resiliência, OpenAPI). Isso reduz o código de infraestrutura que a equipe teria de escrever.
- **Custo assumido:** verbosidade e memória (ver o risco R-T2). Mitigação: `-Xmx256m`, `-XX:+UseSerialGC`, `spring.main.lazy-initialization=true` no perfil de desenvolvimento, e subir só os serviços necessários em cada tarefa.

**Bibliotecas do back-end:**

| Necessidade | Biblioteca |
|---|---|
| Web e validação | Spring Web, Jakarta Bean Validation |
| Segurança | Spring Security, OAuth2 Resource Server (validação de JWT/JWKS); Nimbus JOSE (emissão no identity) |
| Senhas | Argon2 (`Argon2PasswordEncoder`) ou BCrypt |
| Persistência | Spring Data JPA, PostgreSQL driver, Flyway |
| Mensageria | Spring AMQP (RabbitMQ) |
| Resiliência | Resilience4j (circuit breaker, retry, timeout) |
| Documentação | springdoc-openapi (Swagger UI em `/swagger-ui.html` por serviço) |
| PDF e QR | Thymeleaf + OpenHTMLtoPDF (HTML → PDF); ZXing (QR Code) |
| Observabilidade | Spring Boot Actuator, Micrometer, logstash-logback-encoder |
| Testes | JUnit 5, AssertJ, Mockito, Testcontainers, (opcional) ArchUnit para garantir as camadas |
| Carga | k6 (prova de que não há sobrealocação de vagas, RNF15) |

**Organização interna de cada serviço** (arquitetura hexagonal "leve"):

```
br.edu.pulso.scheduling
 ├─ api/            controllers REST, DTOs, mapeadores, tratamento de erro (Problem Details)
 ├─ application/    casos de uso (BookAppointment, CancelAppointment…)
 ├─ domain/         entidades, regras (RN01..RN06), portas
 └─ infrastructure/ JPA, RabbitMQ (outbox relay, consumers), clientes REST, config
```

## 9.3 Banco e mensageria

| Componente | Escolha | Papel |
|---|---|---|
| Banco relacional | **PostgreSQL 16+** | Fonte da verdade de todos os serviços (schema por serviço). Ver [07-banco-de-dados](07-banco-de-dados.md). |
| Broker | **RabbitMQ** (com management UI) | Eventos de domínio, retry e DLQ. |
| Cache / rate limit | **Redis** (opcional) | Necessário se usarmos o `RequestRateLimiter` nativo do Spring Cloud Gateway. É leve (~10 MB). Sem Redis, usar Bucket4j em memória. |
| Arquivos (PDF) | Volume Docker no MVP; MinIO (compatível com S3) na V2 | Comprovantes. |
| MongoDB | **Não usar** | Não há caso que o PostgreSQL com JSONB não atenda (ver 8.1). |

## 9.4 Infraestrutura e processo

| Item | Proposta |
|---|---|
| Contêineres | **Docker** + **Docker Compose** (perfis `core` e `full`). Um comando sobe tudo. |
| Ambiente local de e-mail | **Mailpit**: servidor SMTP falso com interface web. Mostra os e-mails na demonstração sem enviar nada real. |
| Versionamento | Git + GitHub, **monorepo** (um repositório só, mais simples para a equipe e para o professor avaliar) |
| Fluxo de trabalho | GitHub Flow: `main` protegida; branches `feat/…`, `fix/…`; PR com 1 revisão; Conventional Commits |
| Gestão | GitHub Projects (kanban), issues ligadas aos RF |
| CI | GitHub Actions: por serviço alterado → build, testes (Testcontainers), lint, varredura de dependências e imagens (Trivy), varredura de segredos (gitleaks); front-end → lint, testes, build |
| CD (opcional) | Publicar as imagens no GitHub Container Registry; deploy por SSH numa VM com `docker compose pull && up -d` |
| Hospedagem da demonstração | **1 VM** (4 vCPU / 8 GB) com Docker Compose + **Caddy** como proxy reverso (HTTPS automático via Let's Encrypt). Verificar créditos acadêmicos de provedores de nuvem; as ofertas mudam com frequência. **Plano B:** demonstração local + vídeo gravado |
| Kubernetes | **Não** no escopo: complexidade operacional sem ganho para a avaliação |
| Coleções de API | Bruno ou Postman versionados em `/infra/api-collections` |
| Prototipação | Figma (wireframes → alta fidelidade) |

### Estimativa de memória do ambiente completo (desenvolvimento)

| Componente | RAM aproximada |
|---|---|
| 7 processos Spring Boot (gateway + 6) com `-Xmx256m` | 2,0 a 2,5 GB |
| PostgreSQL | 150 a 300 MB |
| RabbitMQ | 150 a 200 MB |
| Redis + Mailpit | ~50 MB |
| Vite dev server + navegador | 0,5 a 1 GB |
| **Total** | **~3 a 4 GB**: viável em 8 GB, apertado em máquinas com menos |

> Os valores são estimativas de ordem de grandeza [HIPÓTESE]. Medir com `docker stats` na Sprint 1.

## 9.5 API

| Item | Padrão |
|---|---|
| Estilo | REST, recursos no plural, JSON, `/api/v1` |
| Contrato | **OpenAPI 3** gerado do código; Swagger UI por serviço; o gateway agrega os links |
| Erros | **RFC 9457 – Problem Details** (`application/problem+json`) com `type`, `title`, `status`, `detail`, `instance`, `code`, `errors[]` |
| Autenticação | JWT (RFC 7519) Bearer; refresh por cookie HttpOnly. Sem OAuth2 completo no MVP; com um IdP (Keycloak / gov.br), passa a ser OIDC |
| Idempotência | Cabeçalho `Idempotency-Key` nos POST críticos (agendamento, movimentação) |
| Paginação | `?page=&size=&sort=`, com resposta `{ content, page, size, totalElements }` |
| Datas | ISO 8601 com fuso (`2026-11-14T09:00:00-03:00`); armazenamento em UTC |
| Versionamento | Mudança incompatível → `/api/v2`; mudança compatível → mesma versão |
