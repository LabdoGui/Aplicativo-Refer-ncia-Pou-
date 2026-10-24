# 10 — Segurança e LGPD

> **Premissa do protótipo:** só existem **dados fictícios**. Mesmo assim, o sistema é projetado como se fosse tratar dados reais, porque isso é o que se avalia e o que torna a proposta defensável.
> Este documento **não é parecer jurídico**. Os pontos marcados [VALIDAR-JURÍDICO] precisam de revisão por orientador, jurídico ou encarregado de dados da instituição parceira.

## 11.1 Enquadramento na LGPD (Lei nº 13.709/2018) [FONTE]

| Conceito | Aplicação no SangueConecta |
|---|---|
| **Dado pessoal** (art. 5º, I) | Nome, e-mail, telefone, data de nascimento, histórico de agendamentos. |
| **Dado pessoal sensível** (art. 5º, II: "dado referente à saúde") | Respostas da pré-triagem, resultado da triagem, registros de doação, tipo sanguíneo, data de elegibilidade derivada de regra clínica. **Até o fato de ter comparecido a um hemocentro pode revelar informação de saúde por inferência** [VALIDAR-JURÍDICO]. |
| **Controlador** (art. 5º, VI) | Em produção, provavelmente a instituição de hemoterapia, que decide as finalidades. No protótipo, a equipe acadêmica (dados fictícios). |
| **Operador** (art. 5º, VII) | Quem opera a plataforma em nome do controlador. |
| **Encarregado (DPO)** (art. 41) | Indicado pelo controlador. Canal de contato visível na política de privacidade. |

### Bases legais (art. 7º e art. 11), a validar

| Tratamento | Base provável em produção | No protótipo |
|---|---|---|
| Cadastro e agendamento | Execução de políticas públicas (art. 7º, III) se o controlador for órgão público; ou consentimento | Dados fictícios |
| Pré-triagem (dado sensível) | **Consentimento específico e destacado** (art. 11, I), por ser uma etapa opcional e informativa | Dados fictícios |
| Triagem e registro da doação | Tutela da saúde por profissional ou serviço de saúde (art. 11, II, "f") e/ou cumprimento de obrigação regulatória (art. 11, II, "a") | [SIMULAÇÃO] |
| Compartilhamento da pré-triagem com a unidade | Consentimento específico (separado) | Dados fictícios |
| Notificações transacionais | Execução do serviço solicitado | — |
| Mensagens institucionais e campanhas | Consentimento (opt-in), revogável | — |
| Campanha direcionada por tipo sanguíneo | **Consentimento específico**, porque cria perfil com dado sensível | V2 |
| Horas complementares (compartilhar com a instituição de ensino) | Consentimento específico por pedido | V2 |

> Todas as bases acima são [VALIDAR-JURÍDICO]. O ponto central é que **cada finalidade tem consentimento ou base próprios**, sem "aceite tudo".

### Princípios do art. 6º aplicados

| Princípio | Como o projeto aplica |
|---|---|
| Finalidade e adequação | Cada dado coletado tem uma finalidade declarada (mapa em 11.2). |
| **Necessidade (minimização)** | Sem CPF no protótipo; sem endereço do doador; sem dados clínicos detalhados da triagem; respostas da pré-triagem com prazo de expiração; eventos sem dados clínicos. |
| Livre acesso | O doador vê os próprios dados e exporta uma cópia (V2). |
| Qualidade | O doador corrige os próprios dados cadastrais. |
| Transparência | Política de privacidade em linguagem simples e aviso em cada coleta sensível. |
| Segurança e prevenção | Controles técnicos em 11.4. |
| Não discriminação | Nenhuma decisão automatizada exclui o doador: a pré-triagem é informativa (art. 20 trata de revisão de decisões automatizadas). |
| Responsabilização | Auditoria, registro das operações de tratamento (art. 37) e RIPD. |

### Direitos do titular (art. 18) no sistema

| Direito | Implementação |
|---|---|
| Confirmação e acesso | Área "Meus dados" + `GET /donors/me` (MVP) e exportação JSON/PDF (V2) |
| Correção | `PATCH /donors/me` |
| Anonimização, bloqueio ou eliminação | `DELETE /donors/me` → evento de exclusão para todos os serviços (ver [07](07-banco-de-dados.md), item 8.7) |
| Informação sobre compartilhamento | Política de privacidade + histórico de consentimentos |
| Revogação do consentimento | `PUT /donors/me/consents`, com efeito imediato (ex.: as respostas compartilhadas são apagadas) |

### Governança

- **RIPD — Relatório de Impacto à Proteção de Dados** (art. 38): **recomendado** antes de qualquer piloto com pessoas reais, por envolver dados sensíveis de saúde. Um esboço do RIPD pode virar entregável acadêmico na V2.
- **Incidentes:** pelo regulamento da ANPD (Resolução CD/ANPD nº 15/2024), o controlador comunica à ANPD e aos titulares incidentes que possam causar risco ou dano relevante, em **3 dias úteis** [FONTE]. O projeto deve ter um plano simples de resposta: detectar, conter, avaliar, comunicar e registrar.
- **Pesquisa com pessoas:** as entrevistas e questionários do benchmarking seguem o item 12.4 do [documento 11](11-pesquisa-benchmarking.md) (CEP, TCLE, anonimização).

---

## 11.2 Mapa de dados (inventário)

| Dado | Sensível? | Finalidade | Serviço | Proteção | Retenção |
|---|---|---|---|---|---|
| E-mail, senha (hash) | Não | Autenticação | identity | Argon2id; e-mail com `citext` | Enquanto houver conta |
| Nome, nome social, telefone | Não | Identificação e contato | identity | TLS; acesso por papel | Enquanto houver conta |
| Data de nascimento | Não | Idade mínima, informativo de regra | identity | — | Enquanto houver conta |
| CPF | Não (mas alto risco) | **Não coletado no protótipo**; em produção, só se a instituição exigir | identity | Cifra AES-GCM + HMAC para unicidade | A definir |
| Respostas da pré-triagem | **Sim** | Informar o doador; compartilhar com a unidade se houver consentimento | clinical | Cifra na aplicação + auditoria de leitura | 30 dias [HIPÓTESE] |
| Resultado da pré-triagem | **Sim** | Histórico do próprio doador | clinical | Acesso pelo dono | 12 meses [HIPÓTESE] |
| Triagem e doação | **Sim** | [SIMULAÇÃO] do atendimento | clinical | Cifra das observações + auditoria | Enquanto houver conta (protótipo) |
| Tipo sanguíneo autodeclarado | **Sim** | Mostrar o nível do estoque do próprio tipo (opt-in) | clinical | Consentimento específico | Até a revogação |
| Pontos e conquistas | Não diretamente | Engajamento | engagement | Sem dado clínico | Enquanto houver conta |
| Matrícula do aluno | Não | Horas complementares (V2) | engagement | Cifra; compartilhada só com a instituição escolhida | Até a decisão + prazo da instituição |
| IP | Pessoal | Segurança e auditoria | gateway, audit | Guardado como hash com sal rotativo | 1 ano [HIPÓTESE] |

---

## 11.3 Modelo de ameaças (STRIDE resumido)

| Ameaça | Exemplo no SangueConecta | Controle |
|---|---|---|
| **S**poofing | Uso de credencial vazada | Hash forte, rate limit, bloqueio progressivo, MFA para profissionais (V2), e-mail de "novo acesso" (Could) |
| **T**ampering | Alterar o saldo do estoque sem rastro; alterar o resultado da triagem | Ledger imutável, registros decididos imutáveis, `REVOKE UPDATE/DELETE`, auditoria |
| **R**epudiation | Profissional nega ter registrado um resultado | `audit_logs` com ator, horário e correlation-id; somente inserção |
| **I**nformation disclosure | Doador A vê dados do doador B (IDOR); vazamento em log | Verificação de posse, `/me`, 404 em vez de 403 quando adequado, logs sem PII, cifra de colunas |
| **D**enial of service | Robô agendando todas as vagas | Rate limit, 1 agendamento ativo por doador, e-mail verificado para agendar, CAPTCHA (Could) |
| **E**levation of privilege | Admin da unidade se concede ADMIN_SISTEMA | Matriz de quem pode conceder o quê; segregação (ADMIN_SISTEMA sem acesso clínico) |

---

## 11.4 Controles técnicos

### Autenticação e sessão

| Controle | Especificação |
|---|---|
| Hash de senha | **Argon2id** (parâmetros recomendados pela OWASP para Argon2) ou BCrypt com custo ≥ 12 |
| Política de senha | Mínimo de 10 caracteres, sem regras de composição forçada, bloqueio das senhas mais comuns (lista) |
| Access token | JWT RS256, 15 min, guardado **em memória** no frontend (não em `localStorage`) |
| Refresh token | Opaco, 7 dias, cookie `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`, **rotativo**; o reuso revoga a família |
| CSRF | O endpoint de refresh exige um cabeçalho customizado (`X-CSRF-Token`, padrão double-submit) além do cookie SameSite |
| Bloqueio | 5 falhas → espera progressiva; 10 → bloqueio de 15 min + e-mail ao titular |
| MFA | TOTP obrigatório para PROF_TRIAGEM, ADMIN e GESTOR (Should/V2) |
| Recuperação de senha | Token de uso único, 30 min, guardado como hash; resposta genérica |

### Autorização

- **RBAC** (papéis → permissões) + **escopo de unidade** (claim `unit_ids`) + **posse** (doador = `sub`).
- Implementada no **serviço** (`@PreAuthorize` + verificação no caso de uso), não só no gateway.
- **Menor privilégio:** cada papel recebe o mínimo; ADMIN_SISTEMA não lê dados clínicos; o usuário de banco de cada serviço só acessa o próprio schema.
- **Acesso a dados de saúde por profissional:** só durante um atendimento aberto da própria unidade, com registro de leitura na auditoria ("break-the-glass" não previsto no MVP).

### Criptografia

| Camada | Controle |
|---|---|
| Em trânsito (externo) | HTTPS (TLS 1.2+), HSTS, certificado via Caddy/Let's Encrypt |
| Em trânsito (interno) | Rede Docker isolada no MVP; mTLS entre serviços na V2 |
| Em repouso (disco) | Volume cifrado na VM, se o provedor oferecer |
| Em repouso (colunas sensíveis) | **AES-256-GCM na aplicação** para `answers_enc`, `form_data_enc`, `restricted_notes_enc`, `cpf_enc` e `student_registration_enc`. Chave por variável de ambiente no MVP; KMS/Vault em produção; versão da chave guardada junto ao dado, para permitir rotação |
| Busca sem expor | HMAC-SHA256 com chave separada para campos que precisem de unicidade (CPF em produção) |
| Tokens | Guardados apenas como hash SHA-256 |

### Proteções de aplicação (OWASP Top 10 e API Security Top 10)

| Risco | Controle |
|---|---|
| Injeção (SQL) | JPA com parâmetros; proibido concatenar SQL; consultas nativas só com `:param` |
| XSS | React escapa por padrão; proibido `dangerouslySetInnerHTML` com dados do usuário; **CSP** restritiva (`default-src 'self'`); templates de e-mail e PDF com escape |
| CSRF | API stateless com Bearer (imune por padrão); refresh com SameSite + cabeçalho |
| CORS | Lista explícita de origens no gateway; credenciais só para a origem do frontend |
| BOLA/IDOR (API1:2023) | Verificação de posse e escopo em todo acesso por ID |
| Atribuição em massa (API3:2023) | DTOs de entrada explícitos (nunca a entidade); `donorId` sempre vindo do token |
| Consumo irrestrito (API4:2023) | Rate limit, paginação com `size` máximo, período máximo nas consultas |
| Configuração insegura | Cabeçalhos `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors 'none'`; Actuator só com `health` exposto externamente; Swagger desativado em produção ou protegido |
| Validação de entrada | Bean Validation no back-end e Zod no front-end (**o front nunca é a única barreira**); limites de tamanho em todos os campos |
| Componentes vulneráveis | Dependabot, Trivy (imagens) e OWASP Dependency-Check ou equivalente no CI |
| Upload | Não há upload de arquivos do usuário no MVP (reduz a superfície de ataque) |

### Rate limiting (gateway)

| Rota | Limite inicial [HIPÓTESE] |
|---|---|
| `POST /auth/login` | 5/min por IP+e-mail; 20/min por IP |
| `POST /donors` | 3/min por IP |
| `POST /auth/password-reset/request` | 3/hora por e-mail |
| `GET /documents/verify/{code}` | 30/min por IP |
| Demais autenticadas | 120/min por usuário |

### Gestão de segredos

- `.env` **nunca** versionado (`.gitignore`), com `.env.example` sem valores reais.
- GitHub Actions Secrets para o CI; *Docker secrets* ou variáveis da VM na demonstração.
- gitleaks no CI e no pre-commit; rotação imediata se algo vazar.
- Chaves JWT (par RSA) geradas por ambiente; a privada fica só no identity-service.

### Logs, auditoria e monitoramento

| Registrar | **Não** registrar |
|---|---|
| Login (sucesso e falha), mudança de papel, leitura de pré-triagem por profissional, decisão de triagem, movimentação de estoque, emissão de documento, mudança de consentimento, pedido de exclusão | Senhas, tokens, respostas da pré-triagem, resultado clínico, observações, CPF, conteúdo de e-mails |

### Backup e recuperação

| Item | Proposta |
|---|---|
| Frequência | `pg_dump` diário, cifrado (GPG/age), guardado fora da VM |
| Retenção | 7 diários + 4 semanais |
| Teste | Restauração testada **ao menos uma vez antes da apresentação final** (evidência no relatório) |
| Objetivo | RPO de 24 h e RTO de 2 h (metas acadêmicas) [HIPÓTESE] |

### Anonimização e pseudonimização

- **Pseudonimização:** os serviços conhecem o doador só por UUID; nome e contato ficam apenas no identity. Os logs usam o UUID, nunca o nome.
- **Agregação com supressão:** estatísticas exibidas com contagem menor que 5 aparecem como "<5", para evitar reidentificação em unidades pequenas.
- **Dados de demonstração:** gerados com Datafaker (pt-BR) por script de seed, com distribuição plausível e **marcação visível "DADOS FICTÍCIOS"** nas telas de estoque e dashboard.
- **Proibição explícita:** importar planilhas reais de hemocentro, mesmo "para teste".

### Desenvolvimento seguro

- Checklist de segurança no template de PR (autorização verificada? dado sensível em log? validação de entrada?).
- Testes automatizados de autorização (ex.: "doador B não acessa o agendamento do doador A" → 404).
- Análise estática (CodeQL, se o repositório for público, ou SonarCloud) [HIPÓTESE sobre disponibilidade gratuita: verificar].
