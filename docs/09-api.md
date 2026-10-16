# 09 — API REST v1

> Base: `https://{host}/api/v1`. Todas as rotas passam pelo gateway.
> Formato de erro: **RFC 9457 Problem Details**. Autenticação: `Authorization: Bearer <JWT>`, salvo indicação "Pública".

## 10.1 Formato padrão de erro

```http
HTTP/1.1 409 Conflict
Content-Type: application/problem+json

{
  "type": "https://pulso.example/errors/slot-full",
  "title": "Horário sem vagas",
  "status": 409,
  "detail": "O horário escolhido acabou de lotar. Veja as próximas opções.",
  "instance": "/api/v1/appointments",
  "code": "SLOT_FULL",
  "correlationId": "c0ffee-1234",
  "errors": []
}
```

| Código HTTP | Uso |
|---|---|
| 200 / 201 / 204 | Sucesso / criado / sem conteúdo |
| 400 | Requisição malformada ou validação de formato (`errors[]` lista os campos) |
| 401 | Sem token, token inválido ou expirado |
| 403 | Autenticado, mas sem permissão, fora do escopo da unidade ou sem posse do recurso |
| 404 | Recurso inexistente **ou** que o usuário não pode ver (não revela existência) |
| 409 | Conflito de estado (vaga lotada, agendamento ativo já existe, transição inválida) |
| 422 | Regra de negócio violada (janela de cancelamento, saldo insuficiente) |
| 429 | Rate limit, com `Retry-After` |
| 500 / 503 | Erro interno / dependência indisponível (sem detalhes técnicos na resposta) |

---

## 10.2 Endpoints solicitados no enunciado

### `POST /auth/login` — identity

| Item | Valor |
|---|---|
| Autenticação | Pública (rate limit: 5 tentativas/min por IP + e-mail) |
| Perfil | Qualquer |
| Request | `{ "email": "ana@exemplo.com", "password": "••••••••••" }` |
| Response 200 | `{ "accessToken": "eyJ…", "tokenType": "Bearer", "expiresIn": 900, "user": { "id": "…", "name": "Ana", "roles": ["DOADOR"] } }` + cookie `refresh_token` (HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth) |
| Erros | 400 campos inválidos · 401 `INVALID_CREDENTIALS` (mensagem genérica) · 403 `EMAIL_NOT_VERIFIED` · 423 `ACCOUNT_LOCKED` · 429 |

Complementares: `POST /auth/refresh` (cookie + cabeçalho anti-CSRF → novo access token; o refresh token é rotacionado), `POST /auth/logout` (204, revoga o refresh), `POST /auth/password-reset/request` e `/confirm`.

### `POST /donors` — identity (cadastro)

| Item | Valor |
|---|---|
| Autenticação | Pública (rate limit: 3/min por IP) |
| Perfil | Visitante |
| Request | `{ "fullName": "Ana Luísa Souza", "socialName": null, "email": "ana@exemplo.com", "birthDate": "2005-03-10", "phone": "+5511999990000", "password": "…", "acceptedPolicyVersion": "2026-10", "consents": { "marketing": false } }` |
| Response 201 | `{ "id": "…", "status": "PENDING_VERIFICATION" }` + `Location: /api/v1/donors/me` |
| Erros | 400 validação (senha fraca, e-mail inválido) · 422 `UNDERAGE` (RN18) · 202 genérico se o e-mail já existir (não revela contas) · 429 |

### `GET /donors/{id}` — identity

| Item | Valor |
|---|---|
| Autenticação | Bearer |
| Perfil | O próprio doador (use **`GET /donors/me`**); COLABORADOR / PROF_TRIAGEM **somente** se o doador tiver agendamento na unidade dele; ADMIN_SISTEMA (suporte, com auditoria) |
| Response 200 | `{ "id": "…", "fullName": "…", "socialName": null, "birthDate": "2005-03-10", "email": "…", "phone": "…" }`. Para profissionais, a resposta é **reduzida** (nome, nome social, data de nascimento) |
| Erros | 401 · 404 (inclusive quando não há vínculo, para não revelar existência) |

> **Recomendação:** o frontend do doador usa **apenas** `/donors/me`, `PATCH /donors/me` e `DELETE /donors/me`. Expor `/{id}` ao doador abre espaço para IDOR (OWASP API1:2023).

### `POST /screenings/pre-check` — clinical

| Item | Valor |
|---|---|
| Autenticação | Bearer |
| Perfil | DOADOR |
| Request | `{ "questionnaireVersion": 3, "answers": { "PESO_KG": 62, "TATUAGEM_RECENTE": false, "…": "…" }, "shareWithUnit": true }` |
| Response 200 | `{ "id": "…", "result": "PODE_PROSSEGUIR", "ruleSetVersion": 3, "messages": [ { "key": "pre_check.ok", "text": "Pelas suas respostas…" } ], "suggestedWaitUntil": null, "disclaimer": "Este resultado é informativo e não substitui a triagem realizada por profissional de saúde.", "expiresAt": "…" }` |
| Erros | 400 resposta ausente ou de tipo errado · 409 `QUESTIONNAIRE_OUTDATED` (versão diferente da vigente) · 503 `NO_PUBLISHED_RULESET` |

Complementar: `GET /screenings/pre-check/questionnaire` (versão vigente com perguntas e condições de exibição).

### `GET /appointments/available` — scheduling

| Item | Valor |
|---|---|
| Autenticação | Bearer (Pública se quisermos mostrar vagas antes do login; decisão de UX) |
| Perfil | DOADOR |
| Query | `unitId` (obrigatório), `from`, `to` (período máximo de 31 dias), `campaignCode` (opcional) |
| Response 200 | `{ "unitId": "…", "days": [ { "date": "2026-11-12", "slots": [ { "slotId": "…", "startsAt": "2026-11-12T08:00:00-03:00", "available": 3 } ] } ] }` |
| Erros | 400 período inválido · 404 unidade inexistente ou inativa |

### `POST /appointments` — scheduling

| Item | Valor |
|---|---|
| Autenticação | Bearer + cabeçalho `Idempotency-Key: <uuid>` |
| Perfil | DOADOR (o `donorId` vem do token, **nunca** do corpo) |
| Request | `{ "slotId": "…", "campaignCode": null }` |
| Response 201 | `{ "id": "…", "code": "PLS-7K3Q9", "status": "BOOKED", "unit": { "id": "…", "name": "Unidade Centro", "address": "…" }, "startsAt": "…", "cancellableUntil": "…", "eligibilityWarning": null }` |
| Erros | 409 `SLOT_FULL` · 409 `ACTIVE_APPOINTMENT_EXISTS` · 422 `SLOT_BLOCKED` / `SLOT_IN_PAST` / `OUTSIDE_BOOKING_WINDOW` · 422 `BEFORE_ELIGIBILITY_DATE` (se a unidade configurou bloqueio; senão vira aviso em `eligibilityWarning`) · 403 `EMAIL_NOT_VERIFIED` |

### `PATCH /appointments/{id}/cancel` — scheduling

| Item | Valor |
|---|---|
| Autenticação | Bearer |
| Perfil | DOADOR dono do agendamento (dentro da janela); ADMIN_UNIDADE/COLABORADOR da unidade (a qualquer momento antes do check-in) |
| Request | `{ "reason": "IMPREVISTO" }` (opcional; categorias fixas) |
| Response 200 | `{ "id": "…", "status": "CANCELLED", "cancelledAt": "…" }` |
| Erros | 404 · 409 `INVALID_STATE` (já cancelado, concluído ou com check-in) · 422 `CANCELLATION_WINDOW_CLOSED` |

Complementares: `PATCH /appointments/{id}/reschedule` `{ "newSlotId": "…" }` (troca atômica), `PATCH /appointments/{id}/confirm`, `GET /appointments/me`.

### `POST /donations` — clinical — [SIMULAÇÃO]

| Item | Valor |
|---|---|
| Autenticação | Bearer |
| Perfil | PROFISSIONAL_TRIAGEM com escopo na unidade da triagem |
| Request | `{ "screeningSessionId": "…", "outcome": "COMPLETED", "notCompletedReason": null, "collectionType": "WHOLE_BLOOD", "externalBagRef": "SIM-000123" }` |
| Response 201 | `{ "id": "…", "outcome": "COMPLETED", "occurredAt": "…", "nextEligibleDate": "2027-01-13", "eligibilityRuleSetVersion": 2 }` |
| Erros | 403 fora do escopo · 404 triagem inexistente · 409 `SCREENING_NOT_APTO` / `DONATION_ALREADY_RECORDED` · 400 `notCompletedReason` obrigatório se `NOT_COMPLETED` |
| Efeitos | Eventos `DonationCompleted` e `AttendanceFinished`. **Nenhuma alteração de estoque** (RN10) |

### `GET /blood-inventory` — inventory — [SIMULAÇÃO]

| Item | Valor |
|---|---|
| Autenticação | Bearer |
| Perfil | ADMIN_UNIDADE, GESTOR_ESTOQUE, ADMIN_SISTEMA (escopo na unidade) |
| Query | `unitId`, `component` (padrão `CONCENTRADO_HEMACIAS`) |
| Response 200 | `{ "unitId": "…", "updatedAt": "…", "dataNotice": "DADOS FICTÍCIOS", "items": [ { "id": "…", "bloodType": "O-", "quantity": 18, "min": 20, "ideal": 40, "status": "CRITICO", "delta24h": -3, "trend7d": [24,23,22,21,21,19,18] } ] }` |
| Erros | 403 · 404 unidade |

Complementares: `GET /blood-inventory/public?unitId=` (**pública**, só `bloodType` + `status`, com cache de 5 min) e `GET /blood-inventory/history?unitId&bloodType&from&to`.

### `PATCH /blood-inventory/{id}` → **substituído** — inventory

> **Mudança proposta:** um PATCH no saldo permitiria "editar" o estoque sem rastro. O saldo só muda por **movimentação** (ledger). O PATCH fica restrito aos **parâmetros** (mínimo e ideal).

**`POST /blood-inventory/movements`**

| Item | Valor |
|---|---|
| Autenticação | Bearer + `Idempotency-Key` |
| Perfil | GESTOR_ESTOQUE (escopo na unidade) |
| Request | `{ "levelId": "…", "type": "SAIDA", "quantity": 3, "reason": "Atendimento hospitalar (simulado)", "externalRef": null, "occurredAt": "…" }` |
| Response 201 | `{ "movementId": "…", "balanceAfter": 15, "status": "CRITICO", "statusChanged": true }` |
| Erros | 400 quantidade ≤ 0 ou ajuste sem justificativa · 403 · 404 · 422 `INSUFFICIENT_STOCK` |

**`PATCH /blood-inventory/{id}/thresholds`**: `{ "min": 20, "ideal": 40 }` → 200; 422 se `ideal < min`. Perfil: GESTOR_ESTOQUE.

### `GET /dashboard/statistics` → **dividido no MVP**

> Sem um serviço de relatórios no MVP, cada serviço expõe as estatísticas do próprio domínio e o frontend compõe o dashboard. Na V2, um `reporting-service` alimentado por eventos passa a oferecer `GET /dashboard/statistics` agregado (CQRS).

| Rota | Serviço | Response 200 (exemplo) |
|---|---|---|
| `GET /appointments/statistics?unitId&from&to` | scheduling | `{ "booked": 120, "completed": 81, "cancelled": 17, "noShow": 22, "noShowRate": 0.18, "byDay": [ … ] }` |
| `GET /donations/statistics?unitId&from&to` | clinical | `{ "attendances": 103, "donationsCompleted": 81, "firstTimeDonors": 34, "returningDonors": 47 }` (apenas agregados; contagens menores que 5 aparecem como "<5") |
| `GET /blood-inventory` | inventory | ver acima |

Perfil: ADMIN_UNIDADE, GESTOR_ESTOQUE, ADMIN_SISTEMA. Erros: 400 período inválido, 403.

### `POST /documents/donation-certificate` — clinical (módulo de documentos)

| Item | Valor |
|---|---|
| Autenticação | Bearer |
| Perfil | DOADOR dono do atendimento |
| Request | `{ "screeningSessionId": "…", "type": "COMPROVANTE_DOACAO", "sendToMyEmail": true }` |
| Response 201 | `{ "documentId": "…", "type": "COMPROVANTE_DOACAO", "issuedAt": "…", "downloadUrl": "/api/v1/documents/…/download", "verificationUrl": "https://pulso.example/v/9F3K-…" }` |
| Erros | 404 · 409 `ATTENDANCE_NOT_FINISHED` · 409 `TYPE_NOT_APPLICABLE` (doação não concluída → só comprovante de comparecimento) · 200 com o documento existente se já emitido |

Complementares: `GET /documents/{id}/download` (PDF, só o dono), `GET /documents/verify/{code}` (**pública**, rate limited; devolve `{ "valid": true, "type": "…", "issuedAt": "…", "unit": "…", "holderInitials": "A. L. S." }`), `POST /documents/{id}/share-links` (Could; link com expiração).

---

## 10.3 Endpoints adicionais necessários ao MVP

| Método | Rota | Serviço | Perfil | Finalidade |
|---|---|---|---|---|
| GET / PATCH / DELETE | `/donors/me` | identity | DOADOR | Perfil próprio; DELETE = pedido de exclusão (LGPD) |
| GET / PUT | `/donors/me/consents` | identity | DOADOR | Consultar e alterar consentimentos |
| POST | `/professionals` | identity | ADMIN_UNIDADE | Criar profissional e enviar convite |
| PUT | `/professionals/{id}/roles` | identity | ADMIN_UNIDADE | Atribuir papéis e unidades (com limites) |
| GET | `/.well-known/jwks.json` | identity | Pública | Chaves públicas para validar JWT |
| GET | `/units` | scheduling | Pública | Locais ativos |
| POST / PATCH | `/units`, `/units/{id}` | scheduling | ADMIN_UNIDADE / ADMIN_SISTEMA | Gerenciar unidades |
| PUT | `/units/{id}/schedule-rules` | scheduling | ADMIN_UNIDADE | Grade semanal (gera slots) |
| POST / DELETE | `/units/{id}/blocks` | scheduling | ADMIN_UNIDADE | Bloqueios |
| GET | `/units/{id}/agenda?date=` | scheduling | COLABORADOR, PROF_TRIAGEM, ADMIN | Agenda do dia |
| GET | `/appointments/me` | scheduling | DOADOR | Meus agendamentos |
| PATCH | `/appointments/{id}/check-in` | scheduling | COLABORADOR, PROF_TRIAGEM | Check-in |
| PATCH | `/appointments/{id}/no-show` | scheduling | COLABORADOR | Marcar falta |
| POST | `/units/{id}/walk-ins` | scheduling | COLABORADOR | Atendimento espontâneo |
| GET | `/screenings/pre-check/questionnaire` | clinical | DOADOR | Questionário vigente |
| GET | `/screenings/pre-check/{id}` | clinical | DOADOR (próprio), PROF_TRIAGEM (com consentimento + atendimento aberto) | Ver pré-triagem |
| POST | `/screenings` | clinical | PROF_TRIAGEM | Abrir triagem presencial |
| PATCH | `/screenings/{id}` | clinical | PROF_TRIAGEM | Registrar resultado (imutável depois) |
| GET | `/donations/me` | clinical | DOADOR | Histórico |
| GET | `/donors/me/next-eligibility` | clinical | DOADOR | Data informativa + aviso |
| GET | `/engagement/me` | engagement | DOADOR | Pontos, nível e conquistas |
| GET | `/achievements` | engagement | Pública | Catálogo |
| GET / PUT | `/notifications/preferences/me` | notification | Autenticado | Preferências |

**Fora do MVP (V2):** `/rule-sets/*` (CRUD e aprovação via interface; no MVP é seed), `/complementary-hours/*`, `/engagement/ranking`, `/donors/me/data-export`, `/dashboard/statistics` agregado, `/campaigns/*`.

---

## 10.4 Exemplo de contrato OpenAPI (trecho)

```yaml
openapi: 3.0.3
info:
  title: scheduling-service
  version: 1.0.0
paths:
  /api/v1/appointments:
    post:
      summary: Agenda uma doação no slot informado
      security: [{ bearerAuth: [] }]
      parameters:
        - in: header
          name: Idempotency-Key
          required: true
          schema: { type: string, format: uuid }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [slotId]
              properties:
                slotId: { type: string, format: uuid }
                campaignCode: { type: string, nullable: true, maxLength: 20 }
      responses:
        "201": { description: Agendamento criado }
        "409": { description: SLOT_FULL ou ACTIVE_APPOINTMENT_EXISTS }
        "422": { description: Regra de agendamento violada }
components:
  securitySchemes:
    bearerAuth: { type: http, scheme: bearer, bearerFormat: JWT }
```
