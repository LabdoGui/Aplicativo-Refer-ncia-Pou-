# 07 — Banco de dados

## 8.1 PostgreSQL, MongoDB ou híbrido?

| Critério | PostgreSQL | MongoDB | Híbrido |
|---|---|---|---|
| Integridade transacional (vagas, estoque, ledger de pontos) | ✅ ACID, constraints, `CHECK`, índices únicos parciais | ⚠️ Transações multi-documento existem, mas constraints declarativas são limitadas | ✅ só na parte relacional |
| Dados com estrutura variável (questionários, condições de regra) | ✅ `JSONB` indexável | ✅ natural | — |
| Relatórios e agregações (dashboard) | ✅ SQL, window functions | ⚠️ aggregation pipeline (curva de aprendizado) | ⚠️ dados em dois lugares |
| Segurança (GRANT por schema, RLS, pgcrypto) | ✅ | ⚠️ diferente e menos ensinado | ❌ duas superfícies de ataque |
| Custo operacional para a equipe | 1 tecnologia | 1 tecnologia | **2 tecnologias, backup, migrações e drivers em dobro** |
| Ensino e familiaridade acadêmica | Alta | Média | — |

**Decisão: somente PostgreSQL** (versão 16 ou superior).

- **MongoDB não se justifica:** a única parte "flexível" (questionários e regras) cabe em `JSONB`, e todo o resto é fortemente relacional e transacional.
- **Híbrido só se paga** com um caso de uso que o PostgreSQL não atenda, e esse caso não existe neste escopo.
- **Redis** fica **opcional** (V2) para rate limit distribuído no gateway e cache do nível público de estoque. **Não** é usado para "travar vaga": o banco faz isso melhor e de forma transacional (ver 8.6).

---

## 8.2 Revisão das entidades sugeridas

| Entidade sugerida | Decisão | Justificativa |
|---|---|---|
| users | ✅ Mantida (identity) | Credenciais e status da conta. |
| donors | ✅ Renomeada `donor_profiles` (identity) | Relação 1:1 com users; separa credencial de dado cadastral. |
| professionals | ✅ Mantida + `professional_units` (N:N) | Um profissional pode atuar em mais de uma unidade. |
| roles, permissions | ✅ Mantidas + `role_permissions`, `user_roles` | O N:N exige tabelas associativas. A carga é por migração; não há edição pela interface no MVP. |
| screening_questions | ✅ Mantida + **`questionnaires`** (versão) | Sem versionar o questionário, não dá para auditar qual pergunta foi respondida. |
| screening_answers | 🔁 **Substituída** por coluna cifrada em `pre_screenings` | Uma linha por resposta facilitaria consultas analíticas sobre a saúde de pessoas identificadas, o que **não queremos**. O bloco cifrado com prazo de expiração é mais simples e mais privado. |
| — | ➕ **`rule_sets`, `screening_rules`** | As regras ficam **separadas** das perguntas, versionadas e com aprovação registrada (RN08). |
| — | ➕ **`screening_sessions`** | A triagem presencial não estava na lista. |
| appointments | ✅ Mantida (scheduling) | — |
| schedules | 🔁 Dividida em `schedule_rules` (grade), **`slots`** (vagas concretas), `schedule_blocks`, `campaigns` | Materializar slots torna a checagem de capacidade atômica e simples. |
| health_units | ✅ Mantida (scheduling) | — |
| donation_records | ✅ Mantida (clinical) | — |
| blood_inventory | 🔁 Renomeada `inventory_levels` | Inclui o hemocomponente e o status calculado. |
| blood_inventory_movements | ✅ Renomeada `inventory_movements` | Ledger imutável. |
| — | ➕ `inventory_daily_snapshots` | Histórico e tendência sem reprocessar todo o ledger. |
| gamification_points | 🔁 Renomeada `points_ledger` | Ledger de lançamentos, com idempotência por evento. |
| achievements, donor_achievements | ✅ Mantidas | — |
| complementary_hours | 🔁 `complementary_hours_requests` + `partner_institutions` (V2) | Precisa de fluxo de aprovação institucional. |
| notifications | ✅ Mantida + `notification_templates`, `notification_preferences` | — |
| documents | ✅ Mantida + `document_share_links` | Verificação e compartilhamento seguros. |
| audit_logs | ✅ **Uma por schema** | Cada serviço audita o que é seu. |
| — | ➕ `consents` | Exigência da LGPD (finalidade, versão, revogação). |
| — | ➕ `refresh_tokens`, `one_time_tokens` | Sessão segura e recuperação de senha. |
| — | ➕ `outbox_events`, `processed_events` | Confiabilidade dos eventos. |
| — | ➕ `donor_eligibility_projection` (scheduling) | Cópia local mínima para agendar sem chamar o clinical. |
| — | ➕ `donor_health_profile` (clinical) | Tipo sanguíneo autodeclarado, última doação externa, dado de sexo para regras: **dados sensíveis, isolados**. |

---

## 8.3 Modelo conceitual

Linhas contínuas indicam relacionamento **dentro** de um serviço (FK física). Linhas tracejadas indicam referência **lógica entre serviços**, apenas por UUID.

```mermaid
erDiagram
    USER ||--o| DONOR_PROFILE : "tem"
    USER ||--o| PROFESSIONAL : "tem"
    USER ||--o{ CONSENT : "concede"
    USER }o--o{ ROLE : "possui"
    PROFESSIONAL }o..o{ HEALTH_UNIT : "atua em"

    HEALTH_UNIT ||--o{ SCHEDULE_RULE : "define"
    HEALTH_UNIT ||--o{ SLOT : "oferece"
    HEALTH_UNIT ||--o{ SCHEDULE_BLOCK : "bloqueia"
    SLOT ||--o{ APPOINTMENT : "reserva"
    DONOR_PROFILE ||..o{ APPOINTMENT : "agenda"

    QUESTIONNAIRE ||--o{ SCREENING_QUESTION : "contém"
    RULE_SET ||--o{ SCREENING_RULE : "contém"
    DONOR_PROFILE ||..o{ PRE_SCREENING : "responde"
    APPOINTMENT ||..o| SCREENING_SESSION : "origina"
    SCREENING_SESSION ||--o| DONATION_RECORD : "resulta em"
    SCREENING_SESSION ||--o{ DOCUMENT : "comprovado por"

    HEALTH_UNIT ||..o{ INVENTORY_LEVEL : "mantém"
    INVENTORY_LEVEL ||--o{ INVENTORY_MOVEMENT : "movimentado por"

    DONOR_PROFILE ||..o{ POINTS_ENTRY : "acumula"
    ACHIEVEMENT ||--o{ DONOR_ACHIEVEMENT : "concedida em"
    DONOR_PROFILE ||..o{ DONOR_ACHIEVEMENT : "conquista"
    DONOR_PROFILE ||..o{ NOTIFICATION : "recebe"
```

---

## 8.4 Modelo lógico por schema

> Convenções: PK `uuid` (UUIDv7 gerado na aplicação, ordenável por tempo); `created_at` e `updated_at` (`timestamptz`) em todas as tabelas de negócio; enums como `varchar` + `CHECK` (mais fácil de migrar que `ENUM` nativo); nomes em inglês no banco, para ficar coerente com o código; **(V2)** = fora do MVP.

### Schema `identity`

```mermaid
erDiagram
    users ||--o| donor_profiles : "1:1"
    users ||--o| professionals : "1:1"
    professionals ||--o{ professional_units : "1:N"
    users ||--o{ user_roles : "1:N"
    roles ||--o{ user_roles : "1:N"
    roles ||--o{ role_permissions : "1:N"
    permissions ||--o{ role_permissions : "1:N"
    users ||--o{ consents : "1:N"
    users ||--o{ refresh_tokens : "1:N"
    users ||--o{ one_time_tokens : "1:N"

    users {
        uuid id PK
        citext email UK
        timestamptz email_verified_at
        text password_hash
        varchar status
        smallint failed_login_count
        timestamptz locked_until
        timestamptz last_login_at
    }
    donor_profiles {
        uuid user_id PK, FK
        varchar full_name
        varchar social_name
        date birth_date
        varchar phone_e164
        bytea cpf_enc "producao apenas"
        char cpf_hmac UK "producao apenas"
    }
    professionals {
        uuid user_id PK, FK
        varchar full_name
        varchar job_title
        varchar professional_registry "se exigido"
        boolean active
    }
    professional_units {
        uuid professional_user_id PK, FK
        uuid unit_id PK "ref logica scheduling"
    }
    roles {
        smallint id PK
        varchar code UK
    }
    permissions {
        smallint id PK
        varchar code UK
    }
    role_permissions {
        smallint role_id PK, FK
        smallint permission_id PK, FK
    }
    user_roles {
        uuid user_id PK, FK
        smallint role_id PK, FK
        uuid granted_by
        timestamptz granted_at
    }
    consents {
        uuid id PK
        uuid user_id FK
        varchar purpose
        varchar policy_version
        timestamptz granted_at
        timestamptz revoked_at
    }
    refresh_tokens {
        uuid id PK
        uuid user_id FK
        char token_hash UK
        uuid family_id
        timestamptz expires_at
        timestamptz revoked_at
    }
    one_time_tokens {
        uuid id PK
        uuid user_id FK
        varchar purpose
        char token_hash UK
        timestamptz expires_at
        timestamptz used_at
    }
```

| Tabela | Constraints e índices relevantes |
|---|---|
| users | `UNIQUE(email)` com `citext` (sem diferenciar maiúsculas); `CHECK status IN ('PENDING_VERIFICATION','ACTIVE','SUSPENDED','ANONYMIZED')` |
| donor_profiles | idade mínima (RN18) validada **na aplicação**: um `CHECK` com `current_date` é má prática, porque o PostgreSQL trata constraints como imutáveis; `social_name` opcional, seguindo a lógica do Decreto nº 8.727/2016 sobre nome social [VALIDAR-JURÍDICO]; `cpf_*` **nulos no protótipo** |
| consents | `CHECK purpose IN ('TERMS_PRIVACY','MARKETING_INSTITUCIONAL','SHARE_PRESCREENING','BLOOD_TYPE_SELF_DECLARED','RANKING_OPT_IN')`; índice único parcial `(user_id, purpose) WHERE revoked_at IS NULL` |
| refresh_tokens | índice `(family_id)` para revogar a família inteira ao detectar reuso |

### Schema `scheduling`

```mermaid
erDiagram
    health_units ||--o{ schedule_rules : "1:N"
    health_units ||--o{ slots : "1:N"
    health_units ||--o{ schedule_blocks : "1:N"
    health_units ||--o{ campaigns : "1:N"
    health_units ||--|| scheduling_settings : "1:1"
    campaigns ||--o{ slots : "0:N"
    slots ||--o{ appointments : "1:N"
    health_units ||--o{ appointments : "1:N"
    appointments ||--o| appointments : "reagendado de"

    health_units {
        uuid id PK
        varchar name
        varchar slug UK
        varchar city
        char state
        varchar address_line
        numeric latitude
        numeric longitude
        varchar timezone
        boolean active
    }
    schedule_rules {
        uuid id PK
        uuid unit_id FK
        smallint weekday "1-7 ISO"
        time start_time
        time end_time
        smallint slot_minutes
        smallint capacity_per_slot
        smallint daily_capacity
        date valid_from
        date valid_to
    }
    slots {
        uuid id PK
        uuid unit_id FK
        uuid campaign_id FK
        timestamptz starts_at
        timestamptz ends_at
        smallint capacity
        smallint booked_count
        varchar status
    }
    schedule_blocks {
        uuid id PK
        uuid unit_id FK
        timestamptz starts_at
        timestamptz ends_at
        varchar reason
        uuid created_by
    }
    campaigns {
        uuid id PK
        uuid unit_id FK
        varchar name
        varchar code UK
        date starts_on
        date ends_on
        varchar partner_type
    }
    appointments {
        uuid id PK
        varchar code UK
        uuid donor_id "ref logica identity"
        uuid unit_id FK
        uuid slot_id FK
        uuid campaign_id FK
        uuid rescheduled_from_id FK
        varchar kind
        varchar status
        timestamptz starts_at
        varchar idempotency_key
        timestamptz checked_in_at
        timestamptz cancelled_at
        varchar cancel_reason
        integer version
    }
    scheduling_settings {
        uuid unit_id PK, FK
        integer cancel_window_minutes
        smallint max_active_per_donor
        integer no_show_tolerance_minutes
        integer reminder_hours_before
        integer booking_max_days_ahead
    }
    donor_eligibility_projection {
        uuid donor_id PK
        date next_eligible_date
        boolean reminders_blocked
        uuid source_event_id
    }
```

| Tabela | Constraints e índices relevantes |
|---|---|
| schedule_rules | `CHECK (end_time > start_time)`, `CHECK (slot_minutes BETWEEN 10 AND 120)`, `CHECK (capacity_per_slot > 0)` |
| slots | `UNIQUE(unit_id, starts_at)`; `CHECK (booked_count BETWEEN 0 AND capacity)`; índice parcial `(unit_id, starts_at) WHERE status = 'OPEN'` |
| schedule_blocks | `CHECK (ends_at > starts_at)`; índice `(unit_id, starts_at, ends_at)` |
| appointments | `CHECK status IN ('BOOKED','CONFIRMED','CHECKED_IN','COMPLETED','CANCELLED','NO_SHOW')`; `CHECK kind IN ('SCHEDULED','WALK_IN')`; `CHECK (kind = 'WALK_IN' OR slot_id IS NOT NULL)`; **índice único parcial** `(donor_id) WHERE status IN ('BOOKED','CONFIRMED','CHECKED_IN')` (RN03); `UNIQUE(donor_id, idempotency_key)`; índices `(unit_id, starts_at)` para a agenda do dia e `(donor_id, starts_at DESC)` para "meus agendamentos" |

### Schema `clinical` (dados sensíveis)

```mermaid
erDiagram
    questionnaires ||--o{ screening_questions : "1:N"
    questionnaires ||--o{ rule_sets : "1:N"
    rule_sets ||--o{ screening_rules : "1:N"
    questionnaires ||--o{ pre_screenings : "1:N"
    rule_sets ||--o{ pre_screenings : "1:N"
    pre_screenings |o--o{ screening_sessions : "consultada em"
    screening_sessions ||--o| donation_records : "1:0..1"
    screening_sessions ||--o| screening_sessions : "corrige"
    screening_sessions ||--o{ documents : "1:N"
    documents ||--o{ document_share_links : "1:N"
    rule_sets ||--o{ donation_records : "calcula elegibilidade"

    questionnaires {
        uuid id PK
        integer version UK
        varchar status
        date valid_from
        date valid_to
    }
    screening_questions {
        uuid id PK
        uuid questionnaire_id FK
        varchar code
        text text
        varchar answer_type
        jsonb options
        jsonb display_condition
        smallint order_index
    }
    rule_sets {
        uuid id PK
        varchar purpose "PRE_SCREENING ou NEXT_ELIGIBILITY"
        integer version
        uuid questionnaire_id FK
        varchar status
        date valid_from
        date valid_to
        text normative_reference
        uuid approved_by_user_id
        timestamptz approved_at
    }
    screening_rules {
        uuid id PK
        uuid rule_set_id FK
        varchar code
        jsonb condition
        varchar severity
        integer wait_days
        varchar message_key
        text normative_reference
    }
    pre_screenings {
        uuid id PK
        uuid donor_id
        uuid questionnaire_id FK
        uuid rule_set_id FK
        varchar result
        text_array triggered_rule_codes
        bytea answers_enc "nulo sem consentimento"
        boolean share_consent
        timestamptz expires_at
    }
    screening_sessions {
        uuid id PK
        uuid appointment_id "ref logica"
        uuid donor_id
        uuid unit_id
        uuid professional_user_id
        uuid pre_screening_id FK
        uuid supersedes_id FK
        varchar status
        varchar result
        bytea form_data_enc
        bytea restricted_notes_enc
        boolean reminders_blocked
        date suggested_return_date
        timestamptz decided_at
    }
    donation_records {
        uuid id PK
        uuid screening_session_id FK, UK
        uuid donor_id
        uuid unit_id
        varchar outcome
        varchar not_completed_reason
        varchar collection_type
        varchar external_bag_ref "simulacao"
        timestamptz occurred_at
        date next_eligible_date
        uuid eligibility_rule_set_id FK
    }
    donor_health_profile {
        uuid donor_id PK
        varchar self_declared_blood_group
        varchar self_declared_rh
        varchar sex_for_rules
        date self_declared_last_donation
    }
    documents {
        uuid id PK
        uuid donor_id
        uuid screening_session_id FK
        varchar type
        varchar template_version
        varchar storage_key
        char sha256
        char verification_code_hash UK
        timestamptz issued_at
        timestamptz revoked_at
    }
    document_share_links {
        uuid id PK
        uuid document_id FK
        char token_hash UK
        timestamptz expires_at
        timestamptz revoked_at
    }
```

| Tabela | Constraints e índices relevantes |
|---|---|
| questionnaires, rule_sets | `CHECK status IN ('DRAFT','PUBLISHED','RETIRED')`; **`CHECK (status <> 'PUBLISHED' OR approved_by_user_id IS NOT NULL)`**, ou seja, nada é publicado sem aprovação (RN08); índice único parcial: só 1 versão PUBLISHED por `purpose` com vigência aberta |
| screening_rules | `UNIQUE(rule_set_id, code)`; `CHECK severity IN ('INFORMATIVA','CONVERSAR_COM_UNIDADE','AGUARDAR')` |
| pre_screenings | `CHECK result IN ('PODE_PROSSEGUIR','CONVERSAR_COM_UNIDADE','AGUARDAR')`; `CHECK (share_consent OR answers_enc IS NULL)`; job diário zera `answers_enc` depois de `expires_at` |
| screening_sessions | `CHECK result IN ('APTO','NAO_APTO')`; `CHECK status IN ('OPEN','LINK_PENDING','DECIDED','CANCELLED')`; `CHECK (status <> 'DECIDED' OR result IS NOT NULL)`; o registro decidido é imutável (correção = nova linha com `supersedes_id`) |
| donation_records | `CHECK ((outcome = 'NOT_COMPLETED') = (not_completed_reason IS NOT NULL))`; `CHECK not_completed_reason IN ('INTERRUPTED','DONOR_WITHDREW','OTHER_NON_CLINICAL')`; índice `(donor_id, occurred_at DESC)` |
| donor_health_profile | `CHECK sex_for_rules IN ('F','M','NAO_INFORMADO')`; **coleta só com finalidade explicada e somente se a regra vigente exigir** [VALIDAR-SAÚDE] |
| documents | `UNIQUE(screening_session_id, type)`; `CHECK type IN ('COMPROVANTE_COMPARECIMENTO','COMPROVANTE_DOACAO')` |

### Schema `inventory` — [SIMULAÇÃO]

```mermaid
erDiagram
    inventory_levels ||--o{ inventory_movements : "1:N"
    inventory_levels ||--o{ inventory_daily_snapshots : "1:N"

    inventory_levels {
        uuid id PK
        uuid unit_id "ref logica scheduling"
        varchar blood_group "A B AB O"
        varchar rh_factor "POS NEG"
        varchar component
        integer quantity
        integer min_quantity
        integer ideal_quantity
        varchar status "coluna gerada"
        timestamptz updated_at
        integer version
    }
    inventory_movements {
        uuid id PK
        uuid level_id FK
        varchar type
        integer quantity
        integer balance_after
        text reason
        varchar external_ref
        date expires_on "opcional"
        uuid performed_by
        timestamptz occurred_at
    }
    inventory_daily_snapshots {
        uuid level_id PK, FK
        date snapshot_date PK
        integer quantity
        varchar status
        integer entries
        integer exits
    }
```

| Tabela | Constraints e índices relevantes |
|---|---|
| inventory_levels | `UNIQUE(unit_id, blood_group, rh_factor, component)`; `CHECK (quantity >= 0)`; `CHECK (ideal_quantity >= min_quantity AND min_quantity >= 0)`; `status` como **coluna gerada** (RN11) |
| inventory_movements | `CHECK type IN ('ENTRADA','SAIDA','DESCARTE','AJUSTE_POSITIVO','AJUSTE_NEGATIVO')`; `CHECK (quantity > 0)`; `CHECK (type NOT LIKE 'AJUSTE%' OR length(reason) >= 10)`; o usuário da aplicação **não tem** `UPDATE` nem `DELETE` (ledger imutável); índice `(level_id, occurred_at DESC)` |

> **Hemocomponente:** o estoque real é controlado por hemocomponente (concentrado de hemácias, plasma, plaquetas…), cada um com regras próprias de validade [VALIDAR-SAÚDE]. O padrão do protótipo é `CONCENTRADO_HEMACIAS`, e a coluna existe para não engessar o modelo. Validade por lote (`inventory_lots`) fica para a V2.

### Schema `engagement`

```mermaid
erDiagram
    achievements ||--o{ donor_achievements : "1:N"
    partner_institutions ||--o{ complementary_hours_requests : "1:N"
    partner_institutions ||--o{ institution_members : "1:N"

    points_ledger {
        uuid id PK
        uuid donor_id
        integer points
        varchar reason_code
        uuid source_event_id
        timestamptz created_at
    }
    achievements {
        uuid id PK
        varchar code UK
        varchar name
        text description
        jsonb criteria
        boolean active
    }
    donor_achievements {
        uuid donor_id PK
        uuid achievement_id PK, FK
        timestamptz unlocked_at
        uuid source_event_id
    }
    donor_engagement_summary {
        uuid donor_id PK
        integer total_points
        smallint level
        integer attendances_count
        integer donations_count
        boolean ranking_opt_in
        varchar nickname
    }
    partner_institutions {
        uuid id PK
        varchar name
        varchar type
        varchar agreement_reference
        boolean active
    }
    institution_members {
        uuid institution_id PK, FK
        uuid user_id PK
    }
    complementary_hours_requests {
        uuid id PK
        uuid donor_id
        uuid institution_id FK
        uuid attendance_ref
        uuid document_id
        bytea student_registration_enc
        varchar status
        numeric hours_granted
        uuid decided_by
        timestamptz decided_at
    }
```

| Tabela | Constraints e índices relevantes |
|---|---|
| points_ledger | **`UNIQUE(source_event_id, reason_code)`** (idempotência); `CHECK reason_code IN ('ATTENDANCE','DONATION_BONUS','REVERSAL')`; índice `(donor_id, created_at DESC)` |
| donor_achievements | PK composta impede conceder duas vezes |
| complementary_hours_requests (V2) | `UNIQUE(attendance_ref, institution_id)`; `CHECK status IN ('PENDENTE','APROVADA','REJEITADA')`; `CHECK (status <> 'APROVADA' OR hours_granted > 0)`; as horas são definidas **pela instituição** (RN15) |

### Schema `notification`

| Tabela | Colunas principais | Constraints |
|---|---|---|
| notification_templates | id, code, channel, locale, version, subject, body, active | `UNIQUE(code, channel, locale, version)` |
| notification_preferences | user_id (PK), email_enabled, push_enabled, sms_enabled, marketing_opt_in, quiet_start, quiet_end | — |
| notifications | id, user_id, event_id, template_code, template_version, channel, status, attempts, last_error, recipient_masked, sent_at | `CHECK status IN ('PENDING','SENT','FAILED','SKIPPED')`; `UNIQUE(event_id, channel)`; **o corpo da mensagem não é guardado** (minimização) |

### Tabelas técnicas presentes em cada schema

| Tabela | Colunas | Observação |
|---|---|---|
| `outbox_events` | id (PK), aggregate_type, aggregate_id, event_type, payload `jsonb`, created_at, published_at, attempts | índice parcial `WHERE published_at IS NULL` |
| `processed_events` | event_id (PK), event_type, processed_at | idempotência dos consumidores |
| `audit_logs` | id, occurred_at, actor_user_id, actor_roles, action, resource_type, resource_id, outcome (`SUCCESS`/`DENIED`/`FAILURE`), correlation_id, ip_hash, details `jsonb` | **somente INSERT/SELECT** para o usuário da aplicação; `details` nunca contém dado de saúde; particionamento mensal na V2 |

---

## 8.5 Relacionamentos e cardinalidades (resumo)

| Relação | Cardinalidade | Tipo |
|---|---|---|
| users → donor_profiles | 1 : 0..1 | FK física (identity) |
| users → professionals | 1 : 0..1 | FK física |
| users ↔ roles | N : N | via `user_roles` |
| roles ↔ permissions | N : N | via `role_permissions` |
| professionals ↔ health_units | N : N | `professional_units` + referência lógica |
| health_units → slots | 1 : N | FK física (scheduling) |
| slots → appointments | 1 : N (até `capacity` ativos) | FK física + `CHECK` |
| donor → appointments | 1 : N (no máximo 1 ativo) | lógica + índice único parcial |
| appointments → screening_sessions | 1 : 0..1 (espontâneo: sem agendamento) | lógica (entre serviços) |
| screening_sessions → donation_records | 1 : 0..1 | FK física + `UNIQUE` |
| screening_sessions → documents | 1 : 0..2 (um por tipo) | FK física + `UNIQUE` |
| rule_sets → screening_rules | 1 : N | FK física |
| inventory_levels → inventory_movements | 1 : N | FK física |
| achievements ↔ donors | N : N | `donor_achievements` |
| donor → points_ledger | 1 : N | lógica |

---

## 8.6 Trechos de DDL críticos

```sql
-- Vaga reservada de forma atômica (sem Redis, sem lock distribuído)
UPDATE scheduling.slots
   SET booked_count = booked_count + 1
 WHERE id = :slotId
   AND status = 'OPEN'
   AND booked_count < capacity;      -- 0 linhas afetadas => 409 SLOT_FULL

-- RN03: no máximo um agendamento ativo por doador (garantido pelo banco)
CREATE UNIQUE INDEX ux_appointments_one_active_per_donor
    ON scheduling.appointments (donor_id)
 WHERE status IN ('BOOKED', 'CONFIRMED', 'CHECKED_IN');

-- RN11: status do estoque calculado pelo próprio banco
CREATE TABLE inventory.inventory_levels (
    id              uuid PRIMARY KEY,
    unit_id         uuid        NOT NULL,
    blood_group     varchar(2)  NOT NULL CHECK (blood_group IN ('A','B','AB','O')),
    rh_factor       varchar(3)  NOT NULL CHECK (rh_factor IN ('POS','NEG')),
    component       varchar(30) NOT NULL DEFAULT 'CONCENTRADO_HEMACIAS',
    quantity        integer     NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    min_quantity    integer     NOT NULL CHECK (min_quantity >= 0),
    ideal_quantity  integer     NOT NULL,
    status          varchar(10) GENERATED ALWAYS AS (
                        CASE WHEN quantity < min_quantity   THEN 'CRITICO'
                             WHEN quantity < ideal_quantity THEN 'ATENCAO'
                             ELSE 'ADEQUADO' END) STORED,
    updated_at      timestamptz NOT NULL DEFAULT now(),
    version         integer     NOT NULL DEFAULT 0,
    CONSTRAINT ck_ideal_ge_min CHECK (ideal_quantity >= min_quantity),
    CONSTRAINT ux_level UNIQUE (unit_id, blood_group, rh_factor, component)
);

-- Ledger imutável
REVOKE UPDATE, DELETE ON inventory.inventory_movements FROM inventory_app;

-- Pontos idempotentes por evento
ALTER TABLE engagement.points_ledger
  ADD CONSTRAINT ux_points_event UNIQUE (source_event_id, reason_code);

-- Isolamento por serviço
CREATE ROLE clinical_app LOGIN PASSWORD :'secret';
GRANT USAGE ON SCHEMA clinical TO clinical_app;
REVOKE ALL ON SCHEMA identity, scheduling, inventory, engagement, notification FROM clinical_app;
```

---

## 8.7 Auditoria, retenção e anonimização

| Dado | Retenção proposta | Ao fim do prazo | Etiqueta |
|---|---|---|---|
| Respostas da pré-triagem | 30 dias após o agendamento, ou após a pré-triagem se não houver agendamento | `answers_enc = NULL` (fica só o resultado) | [HIPÓTESE] |
| Sessões de triagem e doações (protótipo) | Enquanto a conta existir | Anonimização na exclusão da conta | [SIMULAÇÃO] |
| Registros clínicos reais (produção) | Definidos pela norma sanitária e pela instituição | — | [VALIDAR-SAÚDE] [VALIDAR-JURÍDICO] |
| Logs de auditoria | 1 ano no protótipo | Expurgo | [HIPÓTESE] |
| Notificações enviadas | 90 dias | Expurgo | [HIPÓTESE] |
| Refresh tokens e tokens de uso único | Até expirar + 7 dias | Expurgo | — |

**Exclusão de conta (LGPD, art. 18, VI):** o identity marca `ANONYMIZED`, apaga e-mail, nome e telefone e publica `identity.user.erasure_requested.v1`; cada serviço substitui as referências pessoais pelo que lhe cabe. Estatísticas agregadas são preservadas sem identificação. Quando houver obrigação legal de guardar algum dado, a guarda prevalece (LGPD, art. 16, I) [VALIDAR-JURÍDICO].
