# 03 — Requisitos e regras de negócio

> Priorização **MoSCoW**: **Must** (indispensável ao MVP), **Should** (importante, entra no MVP se houver tempo, senão na V2), **Could** (desejável, V2 ou Futuro).
> A coluna "Serviço" antecipa a arquitetura do [documento 06](06-arquitetura.md).

## PARTE 6.1 — Requisitos funcionais

### Doador

| ID | Requisito | Perfil | Prioridade | Descrição | Serviço |
|----|-----------|--------|------------|-----------|---------|
| RF01 | Criar conta | Visitante | Must | Cadastro com nome, e-mail, data de nascimento, telefone (opcional) e senha. Aceite da política de privacidade. Sem CPF real no protótipo. | identity |
| RF02 | Autenticar | Todos | Must | Login, logout e renovação de sessão (refresh token). | identity |
| RF03 | Recuperar senha | Todos | Should | Link de redefinição com uso único e expiração curta, enviado por e-mail. | identity + notification |
| RF04 | Editar dados pessoais | Doador | Must | Alterar nome, telefone e preferências. Trocar e-mail exige confirmação. | identity |
| RF05 | Gerenciar consentimentos | Doador | Must | Conceder e revogar por finalidade: notificações de marketing institucional, compartilhamento da pré-triagem com a unidade, tipo sanguíneo autodeclarado. | identity |
| RF06 | Exercer direitos LGPD | Doador | Should | Solicitar cópia dos dados e exclusão ou anonimização da conta (LGPD, art. 18). | identity (orquestra eventos) |
| RF07 | Ver conteúdo educativo | Visitante | Must | Importância da doação, passo a passo, requisitos básicos, mitos e verdades. Conteúdo revisado [VALIDAR-SAÚDE]. | frontend |
| RF08 | Responder pré-triagem | Doador | Must | Questionário da versão vigente, com perguntas condicionais. | clinical |
| RF09 | Ver resultado preliminar | Doador | Must | Resultado informativo (PODE_PROSSEGUIR / CONVERSAR_COM_UNIDADE / AGUARDAR) com explicação e aviso obrigatório. | clinical |
| RF10 | Consultar locais | Visitante | Must | Unidades ativas com endereço, horários e orientações. | scheduling |
| RF11 | Consultar horários disponíveis | Doador | Must | Vagas por unidade e período, já descontada a ocupação. | scheduling |
| RF12 | Agendar doação | Doador | Must | Reserva atômica de vaga, respeitando as regras RN01 a RN05. | scheduling |
| RF13 | Cancelar agendamento | Doador | Must | Dentro da janela permitida (RN06). Libera a vaga. | scheduling |
| RF14 | Reagendar | Doador | Should | Troca atômica: só cancela a vaga antiga se conseguir reservar a nova. | scheduling |
| RF15 | Ver meus agendamentos | Doador | Must | Lista de agendamentos futuros e passados com status. | scheduling |
| RF16 | Confirmar presença pelo lembrete | Doador | Should | Botões "Confirmo" e "Preciso remarcar" no lembrete. | scheduling |
| RF17 | Ver histórico de doações | Doador | Must | Datas, unidade e desfecho resumido (concluída / não concluída), sem detalhes clínicos. | clinical |
| RF18 | Receber notificações por e-mail | Doador | Must | Cadastro, confirmação, lembrete, cancelamento, agradecimento. | notification |
| RF19 | Preferências de notificação | Doador | Should | Escolher canais e tipos de mensagem. Mensagens transacionais não podem ser desativadas. | notification |
| RF20 | Ver pontos, nível e conquistas | Doador | Must | Painel de progresso (versão simplificada no MVP). | engagement |
| RF21 | Ranking opcional | Doador | Could | Somente com adesão explícita (opt-in) e apelido. Preferir **metas coletivas** (turma, curso, empresa). | engagement |
| RF22 | Solicitar horas complementares | Doador | Could | Pedido vinculado a um comparecimento comprovado; a instituição de ensino valida. | engagement |
| RF23 | Baixar comprovante | Doador | Should | PDF do comprovante acadêmico com código e QR de verificação. | clinical (documentos) |
| RF24 | Compartilhar verificação | Doador | Could | Link com prazo de expiração e revogável, para o doador enviar a quem quiser, como o RH. | clinical (documentos) |
| RF25 | Ver próxima data informativa | Doador | Should | Data calculada pelo conjunto de regras vigente, sempre com aviso [VALIDAR-SAÚDE]. | clinical |
| RF26 | Ver nível público do estoque | Visitante | Could | Somente o **nível** por tipo (adequado / atenção / crítico), sem quantidades. | inventory |
| RF27 | Lista de espera | Doador | Could | Avisar quando abrir vaga num horário lotado. | scheduling |
| RF28 | Adicionar ao calendário | Doador | Could | Arquivo .ics na confirmação. | scheduling |

### Colaborador (recepção)

| ID | Requisito | Perfil | Prioridade | Descrição | Serviço |
|----|-----------|--------|------------|-----------|---------|
| RF30 | Ver agenda do dia | Colaborador | Must | Lista por horário da sua unidade, com status. | scheduling |
| RF31 | Buscar agendamento | Colaborador | Must | Por código do agendamento ou nome. | scheduling |
| RF32 | Fazer check-in | Colaborador | Must | Muda o status para CHECKED_IN. | scheduling |
| RF33 | Registrar espontâneo | Colaborador | Should | Cria um atendimento sem agendamento prévio, desde que o doador tenha cadastro. | scheduling |
| RF34 | Marcar falta | Colaborador | Must | Muda o status para NO_SHOW. Também pode ser automático (RF95). | scheduling |

### Profissional de triagem — [SIMULAÇÃO] no protótipo

| ID | Requisito | Perfil | Prioridade | Descrição | Serviço |
|----|-----------|--------|------------|-----------|---------|
| RF40 | Consultar pré-triagem | Prof. triagem | Should | Somente se o doador consentiu e somente durante o atendimento. O acesso é auditado. | clinical |
| RF41 | Registrar triagem presencial | Prof. triagem | Must | Formulário **configurável e mínimo**. No protótipo, os campos são fictícios. | clinical |
| RF42 | Definir resultado da triagem | Prof. triagem | Must | APTO / NÃO APTO. Exclusivo do perfil PROFISSIONAL_TRIAGEM. | clinical |
| RF43 | Registrar desfecho da doação | Prof. triagem | Must | CONCLUÍDA / NÃO CONCLUÍDA, com motivo categorizado e não clínico. | clinical |
| RF44 | Finalizar atendimento | Prof. triagem | Must | Fecha o atendimento e dispara os eventos de pós-doação. | clinical |
| RF45 | Observações restritas | Prof. triagem | Should | Texto livre visível só para profissionais da unidade. Não aparece para o doador nem em eventos. | clinical |

### Administração da unidade e gestão de estoque

| ID | Requisito | Perfil | Prioridade | Descrição | Serviço |
|----|-----------|--------|------------|-----------|---------|
| RF50 | Gerenciar unidades | Admin | Must | Criar, editar e desativar unidades de coleta. | scheduling |
| RF51 | Configurar grade semanal | Admin | Must | Dias da semana, horário de início e fim, duração do slot, capacidade por slot. Exemplo acadêmico: quinta, sexta e sábado. | scheduling |
| RF52 | Capacidade diária | Admin | Should | Limite diário além da soma dos slots. | scheduling |
| RF53 | Bloquear períodos | Admin | Must | Feriados, manutenção. Agendamentos afetados são notificados. | scheduling |
| RF54 | Campanhas | Admin | Could | Período especial com capacidade extra e código de campanha (turma, empresa). | scheduling |
| RF55 | Gerenciar profissionais | Admin | Must | Criar contas de colaboradores e profissionais e atribuir papéis e unidade. | identity |
| RF56 | Dashboard de indicadores | Admin | Must | Agendamentos do dia, doações, cancelamentos, faltas, doadores ativos, evolução. | scheduling + clinical + inventory |
| RF57 | Regras de agendamento | Admin | Should | Janela de cancelamento, limite de agendamentos ativos e tolerância para falta. | scheduling |
| RF58 | Conteúdo educativo | Admin | Could | CMS simples. No MVP o conteúdo é estático. | frontend |
| RF60 | Visualizar estoque | Gestor estoque | Must | Por tipo ABO e Rh (e por hemocomponente, se modelado), com status. **[SIMULAÇÃO]** | inventory |
| RF61 | Registrar movimentação | Gestor estoque | Must | Entrada, saída, descarte ou ajuste, com justificativa. O saldo nunca é editado diretamente. | inventory |
| RF62 | Parametrizar mínimo e ideal | Gestor estoque | Must | Por unidade e tipo. Os parâmetros são definidos pela instituição [VALIDAR-SAÚDE]. | inventory |
| RF63 | Histórico e tendência | Gestor estoque | Should | Série diária, entradas e saídas, variação. | inventory |
| RF64 | Alertas de estoque | Gestor estoque | Should | Notificação quando um tipo passar para atenção ou crítico. | inventory + notification |
| RF65 | Painel "bolsa de valores" | Admin, Gestor | Must | Ticker por tipo com quantidade, variação, mini-gráfico e status com cor, ícone e texto. | frontend + inventory |

### Administração do sistema, responsável técnico e instituição de ensino

| ID | Requisito | Perfil | Prioridade | Descrição | Serviço |
|----|-----------|--------|------------|-----------|---------|
| RF70 | Gerenciar questionário e regras | Admin sistema | Should | Criar uma nova versão (rascunho). No MVP, a carga é feita por migração ou seed. | clinical |
| RF71 | Aprovar e publicar regras | Responsável técnico | Should | Uma versão só entra em vigor com aprovação registrada (quem, quando, norma de referência). | clinical |
| RF72 | Consultar auditoria | Admin sistema | Should | Quem acessou ou alterou dados sensíveis. | todos |
| RF73 | Templates de notificação | Admin sistema | Could | Editar textos sem precisar de deploy. | notification |
| RF74 | Catálogo de conquistas | Admin sistema | Could | Criar e desativar conquistas. | engagement |
| RF80 | Validar horas complementares | Instituição ensino | Could | Aprovar ou rejeitar pedidos de alunos vinculados à instituição. | engagement |

### Processos automáticos

| ID | Requisito | Prioridade | Descrição | Serviço |
|----|-----------|------------|-----------|---------|
| RF90 | Confirmação de agendamento | Must | Ao receber o evento `AppointmentBooked`. | notification |
| RF91 | Lembrete | Must | Job periódico que emite `AppointmentReminderDue`. | scheduling → notification |
| RF92 | Agradecimento pós-doação | Must | Ao receber `DonationCompleted`. | notification |
| RF93 | Pontuação e conquistas | Must | Ao receber `AttendanceFinished` ou `DonationCompleted`, com processamento idempotente. | engagement |
| RF94 | Aviso de nova elegibilidade | Should | Job diário que emite `DonorEligibleAgain`. | clinical → notification |
| RF95 | Falta automática | Should | Marca NO_SHOW depois do fim do slot + tolerância configurada. | scheduling |
| RF96 | Snapshot diário do estoque | Should | Base para histórico e tendência. | inventory |
| RF97 | Alerta de estoque crítico | Should | Emite `StockLevelChanged` quando o status muda. | inventory → notification |

---

## PARTE 6.2 — Requisitos não funcionais

| ID | Requisito | Categoria | Descrição |
|----|-----------|-----------|-----------|
| RNF01 | Tráfego cifrado | Segurança | HTTPS/TLS 1.2+ em toda comunicação externa; HSTS em produção. |
| RNF02 | Senhas | Segurança | Hash adaptativo (Argon2id, ou BCrypt com custo ≥ 12); política mínima de 10 caracteres; checagem contra senhas vazadas (Could). |
| RNF03 | Tokens | Segurança | JWT assinado com chave assimétrica (RS256/ES256), access token de 15 min; refresh token opaco, rotativo e guardado como hash. |
| RNF04 | Autorização | Segurança | RBAC + escopo por unidade + verificação de posse do recurso (proteção contra BOLA/IDOR, OWASP API1:2023). |
| RNF05 | Proteções web | Segurança | Validação de entrada no servidor, consultas parametrizadas, CSP, cookies HttpOnly/Secure/SameSite, proteção CSRF no endpoint de refresh. |
| RNF06 | Rate limiting | Segurança | No gateway: login e cadastro limitados por IP e conta; respostas 429 com `Retry-After`. |
| RNF07 | Segredos | Segurança | Nenhum segredo no repositório; variáveis de ambiente e GitHub Secrets; varredura com gitleaks no CI. |
| RNF08 | Minimização | Privacidade | Coletar apenas o necessário para cada finalidade documentada (LGPD, art. 6º, III). |
| RNF09 | Isolamento de dados de saúde | Privacidade | Dados de saúde só no `clinical-service`, em schema próprio, com usuário de banco exclusivo e campos sensíveis cifrados na aplicação. |
| RNF10 | Eventos mínimos | Privacidade | Eventos carregam IDs e fatos mínimos, **nunca** respostas clínicas nem motivos de inaptidão. |
| RNF11 | Retenção | Privacidade | Respostas da pré-triagem expiram (ex.: 30 dias após o agendamento [HIPÓTESE]); política de retenção por entidade. |
| RNF12 | Auditoria | Privacidade / Segurança | Registrar leitura e alteração de dados sensíveis (quem, quando, o quê, de onde), em tabela somente de inserção. |
| RNF13 | Dados fictícios | Privacidade | O ambiente acadêmico usa apenas dados gerados (seed). É proibido importar dados reais. |
| RNF14 | Tempo de resposta | Desempenho | p95 < 500 ms para leituras e < 1 s para agendamento, com 50 usuários simultâneos no ambiente de demonstração. |
| RNF15 | Concorrência de vagas | Desempenho / Integridade | Nenhuma sobrealocação sob concorrência, comprovada por teste de carga (k6). |
| RNF16 | Disponibilidade | Disponibilidade | Meta acadêmica de 99% durante as janelas de apresentação; health checks e reinício automático (Docker `restart: unless-stopped`). |
| RNF17 | Degradação controlada | Disponibilidade | A falha de notification ou engagement não impede agendar nem registrar a doação; os eventos ficam na fila e são reprocessados. |
| RNF18 | Escalabilidade horizontal | Escalabilidade | Serviços stateless (estado só em banco e fila), permitindo várias réplicas. |
| RNF19 | Desacoplamento | Escalabilidade | Comunicação assíncrona por eventos para efeitos colaterais (notificar, pontuar, projetar). |
| RNF20 | Mobile-first | Usabilidade | Fluxo do doador utilizável em telas a partir de 360 px; agendar em até 5 passos a partir do login. |
| RNF21 | Linguagem clara | Usabilidade | Textos em linguagem simples, sem jargão clínico; revisão por profissional [VALIDAR-SAÚDE]. |
| RNF22 | WCAG 2.2 AA | Acessibilidade | Contraste ≥ 4,5:1, navegação por teclado, foco visível, rótulos em formulários, alvos de toque ≥ 24×24 px. |
| RNF23 | Cor não é o único sinal | Acessibilidade | Status de estoque sempre com cor + ícone + texto. |
| RNF24 | Leitores de tela | Acessibilidade | HTML semântico e ARIA; gráficos com tabela alternativa. |
| RNF25 | API documentada | Manutenibilidade | OpenAPI 3 gerado a partir do código (springdoc) e publicado no Swagger UI de cada serviço. |
| RNF26 | Testes | Manutenibilidade | Testes unitários das regras de domínio (agendamento, motor de regras, estoque); integração com Testcontainers; cobertura ≥ 60% no domínio. |
| RNF27 | Migrações versionadas | Manutenibilidade | Flyway por serviço; nenhuma alteração manual de esquema. |
| RNF28 | Padrões de código | Manutenibilidade | Lint e formatação no CI; Conventional Commits; PR com revisão. |
| RNF29 | Logs estruturados | Observabilidade | JSON com `traceId`/`correlationId`, sem dados pessoais nem de saúde. |
| RNF30 | Rastreamento | Observabilidade | Correlation ID propagado pelo gateway e por todos os serviços e eventos; OpenTelemetry na V2. |
| RNF31 | Health e métricas | Observabilidade | Actuator `/health` e `/metrics`; painel Prometheus + Grafana na V2. |
| RNF32 | Portabilidade | Manutenibilidade | Ambiente completo sobe com `docker compose up` numa máquina com 8 GB de RAM (ver o risco R-T2). |

---

## PARTE 6.3 — Regras de negócio

| ID | Regra | Origem | Etiqueta |
|----|-------|--------|----------|
| RN01 | Não é possível agendar acima da capacidade do slot nem da capacidade diária. | Enunciado | — |
| RN02 | Não é possível agendar em horário bloqueado, fora da grade ou no passado. | Enunciado | — |
| RN03 | Cada doador tem no máximo **1 agendamento ativo** (BOOKED ou CHECKED_IN). A regra é configurável e o padrão é ativo. | Enunciado | [HIPÓTESE] |
| RN04 | Não é possível agendar antes da data informativa de nova elegibilidade (com base na última doação registrada **ou autodeclarada**). O sistema só alerta; quem decide é o profissional. | Enunciado | [VALIDAR-SAÚDE] |
| RN05 | Antecedência mínima e máxima para agendar (ex.: de 2 h até 60 dias). | Grupo | [HIPÓTESE] |
| RN06 | O cancelamento pelo doador vale até X horas antes (padrão 2 h, configurável). Depois disso, só a unidade pode cancelar. | Grupo | [HIPÓTESE] |
| RN07 | O resultado da pré-triagem **nunca** autoriza nem impede a doação. Cada regra tem uma severidade: INFORMATIVA, CONVERSAR_COM_UNIDADE ou AGUARDAR_ATÉ. Nenhuma regra bloqueia o agendamento por padrão no protótipo. | Enunciado | [VALIDAR-SAÚDE] |
| RN08 | Regras de pré-triagem e de intervalo ficam em **conjuntos versionados** com vigência (`valid_from`/`valid_to`), referência normativa e aprovação registrada. Cada resultado guarda a versão usada. | Grupo | [VALIDAR-SAÚDE] |
| RN09 | Só o perfil PROFISSIONAL_TRIAGEM define o resultado da triagem e o desfecho da doação. | Enunciado | [VALIDAR-SAÚDE] (quem pode triar) |
| RN10 | O estoque **só muda por movimentações**. Uma doação concluída **não** gera entrada automática, porque a bolsa precisa ser processada e liberada. | Grupo | [SIMULAÇÃO] |
| RN11 | Status do estoque: CRÍTICO se quantidade < mínimo; ATENÇÃO se mínimo ≤ quantidade < ideal; ADEQUADO se quantidade ≥ ideal. Os parâmetros são da instituição. | Enunciado | [VALIDAR-SAÚDE] |
| RN12 | Pontos de **comparecimento** são dados quando o atendimento é finalizado, independentemente do resultado da triagem. A doação concluída gera um bônus menor que o comparecimento. | Grupo | Decisão ética do grupo |
| RN13 | Não há prêmios materiais nem vantagens financeiras vinculados à doação. | Lei 10.205/2001 | [VALIDAR-JURÍDICO] |
| RN14 | Conquistas iniciais: "Primeiro Passo" (1º comparecimento), "Doador Recorrente" (2 doações concluídas), "Herói da Comunidade" (5 doações concluídas). | Enunciado | — |
| RN15 | Horas complementares só são reconhecidas após **aprovação pela instituição de ensino**. O sistema nunca concede horas automaticamente. | Enunciado | [VALIDAR-JURÍDICO] |
| RN16 | O comprovante só é emitido para atendimento finalizado. Ele indica **comparecimento/doação na data**, não traz informação clínica e mostra o aviso "documento acadêmico sem validade legal". | Grupo | [VALIDAR-JURÍDICO] |
| RN17 | Se o desfecho indicar que o doador não deve ser convidado novamente, os lembretes de retorno são suspensos (flag `reminders_blocked`) **sem registrar nem propagar o motivo**. | Grupo | [VALIDAR-SAÚDE] |
| RN18 | O cadastro no MVP é restrito a maiores de 18 anos. Para 16 e 17 anos, o sistema orienta a procurar a unidade, porque o tratamento de dados de adolescentes exige cuidados adicionais (LGPD, art. 14). | Grupo | [VALIDAR-JURÍDICO] |
| RN19 | Mensagens automáticas nunca mencionam o resultado da triagem nem informações clínicas. | Grupo | — |
| RN20 | O ranking individual, quando existir, é opt-in, usa apelido e nunca expõe dados de saúde. | Grupo | — |

---

## PARTE 6.4 — Funcionalidade real × simulação acadêmica

| Funcionalidade | No protótipo | Em produção exigiria |
|---|---|---|
| Cadastro, login, perfis, consentimentos | **Real** (dados fictícios) | DPO, política de privacidade revisada, RIPD |
| Conteúdo educativo | **Real** (texto do grupo, com fontes) | Revisão e aprovação pela instituição [VALIDAR-SAÚDE] |
| Pré-triagem informativa | **Real como mecanismo**; regras de exemplo [SIMULAÇÃO] | Regras aprovadas pelo responsável técnico, conforme a norma vigente |
| Agendamento, capacidade, bloqueios | **Real** | Parametrização pela unidade |
| Notificações por e-mail | **Real** (Mailpit no desenvolvimento; provedor gratuito na demonstração) | Provedor contratado, SPF/DKIM, opt-out |
| SMS / push / WhatsApp | Não implementado (interface pronta) | Custos e contratos |
| Check-in na recepção | **Real** | — |
| Triagem presencial e registro da doação | **[SIMULAÇÃO]** | Integração com o sistema oficial; a triagem real continua no sistema da instituição |
| Estoque de sangue | **[SIMULAÇÃO]** com dados gerados | Integração com o sistema de hemoterapia (rastreabilidade por bolsa, ISBT 128) |
| Painel "bolsa de valores" | **Real como visualização** de dados fictícios | Dados reais integrados |
| Gamificação | **Real** | Política aprovada pela instituição |
| Horas complementares | V2; fluxo de aprovação **real**, instituições fictícias | Convênio com a instituição de ensino [VALIDAR-JURÍDICO] |
| Comprovante PDF verificável | **Real como mecanismo**; "documento acadêmico sem validade" | Emissão pela instituição, assinatura digital (ICP-Brasil) se exigida |
| Envio ao RH | **Não implementado**; substituído por link de verificação | Consentimento específico e cadastro de empresas |

---

## PARTE 6.5 — Pontos a validar com profissionais de saúde

Estas perguntas alimentam diretamente o [roteiro de benchmarking](11-pesquisa-benchmarking.md):

1. Quais critérios podem ser perguntados **antes** da triagem sem gerar falsa segurança? Qual a redação adequada?
2. Algum critério deveria impedir o **agendamento online** (ex.: peso < 50 kg) ou todos devem só orientar?
3. A unidade usaria as respostas da pré-triagem durante a triagem, ou isso atrapalha (viés, retrabalho)?
4. Quais intervalos entre doações valem após a Portaria GM/MS nº 11.685/2026, e eles dependem de sexo, idade ou tipo de doação?
5. Quem, pela norma e pela organização local, pode registrar o resultado da triagem?
6. Quais dados mínimos da triagem um sistema externo **poderia** guardar? Ou só o desfecho?
7. Como comunicar ao doador que não foi considerado apto? O sistema deve ter algum papel?
8. Faz sentido parametrizar estoque por "bolsas" ou por hemocomponente? Como a unidade define mínimo e ideal (quantidade ou dias de cobertura)?
9. Qual documento a unidade emite hoje para fins trabalhistas e escolares? Um comprovante digital verificável seria aceito?
10. Gamificação: há alguma objeção ética da equipe? Há risco de pressionar o doador?
