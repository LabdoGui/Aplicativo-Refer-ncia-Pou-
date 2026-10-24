# 05 — Fluxos

> Diagramas em **Mermaid**, que o GitHub renderiza automaticamente. Para os slides, exporte em [mermaid.live](https://mermaid.live).

## 1. Fluxo do doador

```mermaid
flowchart TD
    A["Acessa a página pública"] --> B{"Tem conta?"}
    B -- Não --> C["Cadastro mínimo + aceite de privacidade"]
    C --> C2["Confirma e-mail"]
    C2 --> D
    B -- Sim --> D["Login"]
    D --> E["Pré-triagem informativa (opcional, recomendada)"]
    E --> F{"Resultado"}
    F -- PODE_PROSSEGUIR --> G["Escolhe unidade, dia e horário"]
    F -- CONVERSAR_COM_UNIDADE --> F2["Mostra contato da unidade"]
    F2 --> G
    F -- AGUARDAR --> F3["Mostra data informativa e oferece lembrete"]
    G --> H{"Vaga disponível?"}
    H -- Não --> G
    H -- Sim --> I["Agendamento confirmado + e-mail"]
    I --> J["Lembrete antes da data"]
    J --> K{"Confirma presença?"}
    K -- Remarcar --> G
    K -- Sim --> L["Comparece e faz check-in"]
    L --> M["Triagem profissional"]
    M --> N{"Apto?"}
    N -- Sim --> O["Doação"]
    N -- Não --> P["Agradecimento neutro, sem motivo clínico"]
    O --> Q["Agradecimento + orientações pós-doação"]
    P --> R["Pontos de comparecimento"]
    Q --> R
    R --> S["Comprovante PDF verificável"]
    S --> T["Aviso de nova elegibilidade (data informativa)"]
    T --> G
```

## 2. Fluxo do profissional (colaborador + profissional de triagem)

```mermaid
flowchart TD
    A["Login profissional"] --> B["Agenda do dia da unidade"]
    B --> C{"Doador chegou?"}
    C -- "Com agendamento" --> D["Busca por código ou nome e faz check-in"]
    C -- "Espontâneo" --> D2["Localiza cadastro e registra atendimento sem agendamento"]
    C -- "Não veio até o fim da tolerância" --> X["Marca falta (ou job automático)"]
    D --> E["Fila de triagem"]
    D2 --> E
    E --> F["Abre atendimento"]
    F --> G{"Doador consentiu compartilhar pré-triagem?"}
    G -- Sim --> H["Visualiza respostas (acesso auditado)"]
    G -- Não --> I["Segue sem pré-triagem"]
    H --> J["Registra triagem (formulário mínimo)"]
    I --> J
    J --> K{"Resultado"}
    K -- APTO --> L["Doação"]
    L --> M{"Concluída?"}
    M -- Sim --> N["Registra doação concluída"]
    M -- Não --> N2["Registra não concluída (motivo não clínico)"]
    K -- "NÃO APTO" --> O["Define se suspende lembretes de retorno"]
    N --> P["Finaliza atendimento"]
    N2 --> P
    O --> P
    P --> Q["Eventos: agradecimento, pontos, atualização do agendamento"]
```

> No protótipo, J, K, L e M são [SIMULAÇÃO]. Em produção, esses passos aconteceriam no sistema oficial da instituição, e só o desfecho seria sincronizado (ver [documento 14](14-riscos-diferenciais-recomendacoes.md)).

## 3. Fluxo do administrador

```mermaid
flowchart LR
    A["Login admin"] --> B["Dashboard"]
    B --> C["Indicadores: agendamentos do dia, doações, cancelamentos, faltas"]
    B --> D["SangueConecta do Estoque"]
    D --> D1["Detalhe por tipo: histórico, tendência, entradas e saídas"]
    D --> D2["Registrar movimentação (gestor de estoque)"]
    D --> D3["Parametrizar mínimo e ideal"]
    B --> E["Configurações da unidade"]
    E --> E1["Grade semanal e capacidade"]
    E --> E2["Bloqueios e feriados"]
    E --> E3["Campanhas"]
    E --> E4["Regras de agendamento (janela de cancelamento, limite)"]
    B --> F["Usuários e papéis"]
    B --> G["Auditoria"]
    D2 --> H{"Status mudou?"}
    H -- Sim --> I["Alerta para gestores + nível público atualizado"]
```

## 4. Fluxo de agendamento

### 4.1 Sequência

```mermaid
sequenceDiagram
    autonumber
    actor D as Doador
    participant W as Frontend PWA
    participant G as API Gateway
    participant S as scheduling-service
    participant DB as PostgreSQL (schema scheduling)
    participant MQ as RabbitMQ
    participant N as notification-service

    D->>W: Escolhe unidade e período
    W->>G: GET /api/v1/appointments/available?unitId&from&to
    G->>S: encaminha (JWT validado)
    S->>DB: slots com ocupação abaixo da capacidade, sem bloqueio
    S-->>W: 200 lista de slots
    D->>W: Confirma horário
    W->>G: POST /api/v1/appointments (Idempotency-Key)
    G->>S: encaminha
    S->>DB: BEGIN
    S->>DB: UPDATE condicional do slot (incrementa só se ainda houver vaga)
    alt nenhuma linha atualizada
        S->>DB: ROLLBACK
        S-->>W: 409 SLOT_FULL
    else vaga reservada
        S->>DB: INSERT appointment (BOOKED) com índice único de agendamento ativo
        S->>DB: INSERT outbox (AppointmentBooked)
        S->>DB: COMMIT
        S-->>W: 201 Created (código do agendamento)
        S-)MQ: publica AppointmentBooked (relay da outbox)
        MQ-)N: entrega evento
        N->>N: renderiza template e envia e-mail
    end
```

### 4.2 Estados do agendamento

```mermaid
stateDiagram-v2
    [*] --> BOOKED: agendar
    BOOKED --> CONFIRMED: doador confirma no lembrete
    BOOKED --> CANCELLED: cancelar (doador na janela, unidade ou bloqueio)
    CONFIRMED --> CANCELLED: cancelar
    BOOKED --> CHECKED_IN: check-in
    CONFIRMED --> CHECKED_IN: check-in
    BOOKED --> NO_SHOW: tolerância expirada
    CONFIRMED --> NO_SHOW: tolerância expirada
    CHECKED_IN --> COMPLETED: AttendanceFinished
    CANCELLED --> [*]
    NO_SHOW --> [*]
    COMPLETED --> [*]
```

> "Ativo" (RN03) = BOOKED, CONFIRMED ou CHECKED_IN.

## 5. Fluxo de triagem

### 5.1 Pré-triagem (motor de regras configurável)

```mermaid
sequenceDiagram
    autonumber
    actor D as Doador
    participant W as Frontend
    participant C as clinical-service
    participant DB as Schema clinical

    W->>C: GET /api/v1/screenings/pre-check/questionnaire
    C->>DB: versão PUBLISHED vigente na data de hoje
    C-->>W: perguntas + condições de exibição
    D->>W: Responde
    W->>C: POST /api/v1/screenings/pre-check (respostas, consentShare)
    C->>C: avalia cada regra (condição JSON) contra as respostas
    C->>C: resultado = pior severidade encontrada
    alt consentShare = true
        C->>DB: grava respostas cifradas + resultado + rule_set_version + expires_at
    else
        C->>DB: grava apenas resultado + rule_set_version
    end
    C-->>W: 200 resultado + explicações + aviso obrigatório
```

**Como uma regra é representada (exemplo ilustrativo, não é regra clínica):**

```json
{
  "code": "PESO_MINIMO",
  "questionCode": "PESO_KG",
  "condition": { "op": "lt", "value": 50 },
  "severity": "CONVERSAR_COM_UNIDADE",
  "messageKey": "pre_check.weight.below_min",
  "normativeReference": "Portaria de Consolidação GM/MS nº 5/2017, Anexo IV-B (conferir artigo)",
  "status": "PENDENTE_VALIDACAO"
}
```

> Os valores e a referência acima são **exemplo de formato** [VALIDAR-SAÚDE]. Nenhuma regra é publicada sem aprovação registrada (RN08).

### 5.2 Triagem presencial — [SIMULAÇÃO]

```mermaid
sequenceDiagram
    autonumber
    actor P as Profissional de triagem
    participant W as Frontend
    participant C as clinical-service
    participant S as scheduling-service

    P->>W: Abre atendimento do agendamento X
    W->>C: POST /api/v1/screenings {appointmentId}
    C->>S: GET /internal/appointments/X (timeout 2s, circuit breaker)
    S-->>C: status CHECKED_IN, unitId, donorId
    C->>C: confere unitId do agendamento contra unit_ids do token
    C-->>W: 201 screening_session
    opt doador consentiu
        W->>C: GET /api/v1/screenings/pre-check/{id}
        C->>C: registra auditoria de leitura
        C-->>W: respostas
    end
    P->>W: Preenche e define resultado
    W->>C: PATCH /api/v1/screenings/{id} {result, remindersBlocked?}
    C-->>W: 200 (registro imutável)
```

## 6. Fluxo de doação

```mermaid
sequenceDiagram
    autonumber
    actor P as Profissional
    participant C as clinical-service
    participant MQ as RabbitMQ
    participant S as scheduling-service
    participant E as engagement-service
    participant N as notification-service

    P->>C: POST /api/v1/donations {screeningId, outcome: COMPLETED}
    C->>C: grava donation_record + calcula próxima data informativa (rule set vigente)
    C->>C: grava outbox DonationCompleted + AttendanceFinished (mesma transação)
    C-->>P: 201
    C-)MQ: publica eventos
    par
        MQ-)S: AttendanceFinished, appointment vira COMPLETED e a projeção de elegibilidade é atualizada
    and
        MQ-)E: AttendanceFinished + DonationCompleted, pontos e conquistas
        E-)MQ: AchievementUnlocked (se houver)
    and
        MQ-)N: DonationCompleted, e-mail de agradecimento
    end
    Note over C,N: Nenhum evento altera o estoque (RN10)
```

## 7. Fluxo de atualização do estoque — [SIMULAÇÃO]

```mermaid
sequenceDiagram
    autonumber
    actor G as Gestor de estoque
    participant I as inventory-service
    participant DB as Schema inventory
    participant MQ as RabbitMQ
    participant N as notification-service

    G->>I: POST /api/v1/blood-inventory/movements {type: SAIDA, bloodGroup: O, rh: NEG, qty: 3, reason}
    I->>DB: BEGIN, SELECT nível FOR UPDATE
    alt saldo ficaria negativo
        I-->>G: 422 INSUFFICIENT_STOCK
    else
        I->>DB: INSERT movement, UPDATE quantity, recalcula status
        I->>DB: INSERT audit + outbox (se status mudou)
        I->>DB: COMMIT
        I-->>G: 201 movimento + novo saldo + status
        I-)MQ: StockLevelChanged {bloodType, from: ATENCAO, to: CRITICO}
        MQ-)N: alerta para gestores da unidade
    end
    Note over I: Job diário grava inventory_daily_snapshots para histórico e tendência
```

## 8. Fluxo de emissão de documento

```mermaid
sequenceDiagram
    autonumber
    actor D as Doador
    participant W as Frontend
    participant C as clinical-service (módulo documents)
    participant ST as Armazenamento de arquivos
    participant V as Verificador (qualquer pessoa)

    D->>W: Gerar comprovante do atendimento A
    W->>C: POST /api/v1/documents/donation-certificate {attendanceId}
    C->>C: confere posse (sub do token = donor_id) e status finalizado
    C->>C: gera código aleatório (128 bits) + QR com URL de verificação
    C->>C: renderiza template HTML versionado e converte em PDF
    C->>ST: salva PDF (bucket privado ou volume)
    C->>C: grava documents (sha256 do PDF, hash do código, template_version)
    C-->>W: 201 {documentId, downloadUrl}
    W->>C: GET /api/v1/documents/{id}/download (autenticado)
    C-->>W: PDF
    V->>C: GET /api/v1/documents/verify/{code} (público, rate limited)
    C-->>V: válido, data, unidade, iniciais do nome
```

## 9. Fluxo de notificações

```mermaid
flowchart LR
    subgraph Produtores
      S["scheduling: Booked, Cancelled, Rescheduled, ReminderDue"]
      C["clinical: DonationCompleted, DonorEligibleAgain, DocumentIssued"]
      I["inventory: StockLevelChanged"]
      E["engagement: AchievementUnlocked"]
      ID["identity: UserRegistered, PasswordResetRequested"]
    end
    S & C & I & E & ID --> X(["Exchange pulso.events (topic)"])
    X --> Q["Fila notification.q"]
    Q --> H["Handler idempotente (processed_events)"]
    H --> P{"Preferências e consentimento permitem?"}
    P -- Não --> Z["Descarta e registra motivo"]
    P -- Sim --> T["Template versionado (sem dado clínico)"]
    T --> R["Roteador de canal"]
    R --> EM["EmailChannel (SMTP / Mailpit / provedor)"]
    R -. V2 .-> PU["WebPushChannel (VAPID)"]
    R -. V2 .-> SM["SmsChannel (provedor)"]
    EM --> L["notifications: SENT / FAILED"]
    EM -- "falha temporária" --> RT["Retry com backoff (3x)"]
    RT -- "esgotou" --> DLQ["notification.dlq"]
```

**Trocar de fornecedor sem alterar o resto do sistema:** o notification-service define a interface `NotificationChannel` (porta) e cada fornecedor é um adaptador (`SmtpEmailChannel`, `SesEmailChannel`, `TwilioSmsChannel`…), escolhido por configuração. Os outros serviços só publicam **eventos de domínio**. Eles não sabem que existe e-mail ou SMS.
