# 14 — Riscos, diferenciais e recomendações

## PARTE 17 — Riscos

Escala: **P** = probabilidade, **I** = impacto (B = baixo, M = médio, A = alto).

### Técnicos

| ID | Risco | P | I | Mitigação |
|---|---|---|---|---|
| R-T1 | Complexidade dos microsserviços supera a capacidade da equipe | A | A | Plano B de 4 ou 5 serviços ([06](06-arquitetura.md), item 7.11); Sprint 0 dedicada à fundação; um serviço "modelo" copiado pelos demais |
| R-T2 | Ambiente completo não roda nos notebooks (7 JVMs) | M | A | `-Xmx256m`, perfis do compose (subir só o necessário), medir na Sprint 0; plano B; VM compartilhada |
| R-T3 | Eventos perdidos ou duplicados geram inconsistência (ex.: pontos em dobro) | M | M | Outbox, consumidores idempotentes, `UNIQUE(source_event_id)`, DLQ monitorada |
| R-T4 | Sobrealocação de vagas sob concorrência | M | A | UPDATE condicional + índice único parcial + teste k6 como evidência |
| R-T5 | Falha da demonstração ao vivo (rede, VM, Wi-Fi) | M | A | Vídeo gravado, ambiente local pronto, seed determinístico, roteiro ensaiado |
| R-T6 | Autenticação implementada com falhas (JWT caseiro) | M | A | Spring Security + Nimbus; testes de autorização automatizados; caminho documentado para um IdP (Keycloak) |
| R-T7 | Divergência de contrato entre front e back | A | M | Cliente TypeScript gerado do OpenAPI no CI |

### Acadêmicos

| ID | Risco | P | I | Mitigação |
|---|---|---|---|---|
| R-A1 | Escopo cresce e o MVP não fecha | A | A | MVP fechado, ordem de corte ([13](13-mvp-roadmap.md), item 15.3); itens novos só entram se outro sair |
| R-A2 | Nenhum hemocentro responde | A | M | Contatar 3 ou mais instituições e professores da área da saúde da própria faculdade; registrar as tentativas; apoiar-se em fontes documentais; deixar explícito o que ficou como [HIPÓTESE] |
| R-A3 | Citar números ou referências sem fonte primária | M | A | Regra "sem fonte primária, não entra no slide"; [referencias.md](referencias.md) verificado; registro de evidências |
| R-A4 | Exigência de CEP atrasa a pesquisa de campo | M | M | Consultar o orientador já na semana do CP1; preferir questionário anônimo de opinião; entrevistas sem dados de terceiros |
| R-A5 | Carga desigual na equipe | M | M | Responsáveis por serviço, kanban com issues ligadas aos RF, revisão cruzada |

### Jurídicos e de privacidade

| ID | Risco | P | I | Mitigação |
|---|---|---|---|---|
| R-J1 | Tratar dados de saúde reais sem base legal ou proteção adequada | B (com a regra) | A | **Somente dados fictícios**; consentimentos por finalidade; RIPD antes de qualquer piloto |
| R-J2 | Comprovante confundido com atestado oficial | M | A | Texto "documento acadêmico sem validade legal", marca d'água, verificação pública mínima |
| R-J3 | Gamificação interpretada como remuneração pela doação (Lei nº 10.205/2001) | B | A | Sem prêmios materiais nem vantagens financeiras; validar com o orientador e com a instituição |
| R-J4 | Envio de documento ao RH expõe dados sem controle do titular | M | M | Sem integração direta: o doador compartilha um link com prazo de expiração e revogável |
| R-J5 | Nome ou marca já registrados por terceiros | M | B | Pesquisa no INPI antes de publicar |
| R-J6 | Uso indevido de emblemas protegidos (cruz vermelha) | B | M | Proibido no guia de marca |
| R-J7 | Termos como "bolsa de valores" ou "cotação" sugerem comercialização do sangue | M | M | Na interface, usar "SangueConecta do Estoque" e "nível". A metáfora fica só na explicação da visualização |

### Relacionados à saúde

| ID | Risco | P | I | Mitigação |
|---|---|---|---|---|
| R-S1 | Pré-triagem dá **falsa segurança** ("pode doar") | M | A | Linguagem cuidadosa, aviso obrigatório, regras validadas por profissional, decisão final sempre presencial |
| R-S2 | Pré-triagem gera **falsa exclusão** e afasta quem poderia doar | M | A | Nenhuma regra bloqueia por padrão; severidade "conversar com a unidade"; texto que convida em vez de excluir |
| R-S3 | **Regras desatualizadas**. Exemplo real: mudança de critérios a partir de 30/09/2026 | A | A | Conjuntos de regras versionados com vigência, referência normativa, aprovador e data de revisão; o conteúdo educativo exibe "atualizado em" |
| R-S4 | Incentivos levam o doador a **omitir informações** na triagem | M | A | Pontos de **comparecimento independentes do resultado** (RN12); nenhum benefício ligado a "ser aprovado" |
| R-S5 | Pressão social por doação frequente (rankings) | M | M | Ranking opt-in com apelido; preferir metas coletivas; respeitar sempre o intervalo informado |
| R-S6 | Mensagens automáticas revelam condição de saúde | B | A | Templates neutros (RN19); revisão dos textos; nenhum motivo clínico nos eventos |
| R-S7 | Conteúdo educativo incorreto | M | A | Fonte para cada afirmação; revisão por profissional; data de atualização visível |

### Produto e adoção

| ID | Risco | P | I | Mitigação |
|---|---|---|---|---|
| R-P1 | **Dupla digitação**: profissionais teriam de registrar em dois sistemas | A (em produção) | A | Módulo de triagem tratado como [SIMULAÇÃO]; proposta futura de sincronizar só o desfecho com o sistema oficial |
| R-P2 | Baixa adesão do doador | M | M | PWA sem instalação; validação com questionário; UX de agendamento em até 5 passos |
| R-P3 | Estoque exibido desatualizado induz decisões erradas | M | M | Data e hora de atualização sempre visíveis; aviso de "dados fictícios" no protótipo |

---

## PARTE 29 — O que diferencia o SangueConecta de "um app de agendamento"

| Elemento | Por que diferencia | Honestidade: o que já existe | Como medir |
|---|---|---|---|
| **Redução de faltas** | Lembrete com confirmação ativa e liberação de vaga; indicador de comparecimento por unidade | Lembretes são comuns em agendamentos | Taxa de comparecimento antes e depois (em piloto) |
| **Pré-triagem com regras versionadas e rastreáveis à norma** | Cada resultado registra *qual versão* da regra, *qual norma* e *quem aprovou*. A mudança de 30/09/2026 é atualizada sem deploy | Questionários "posso doar?" existem em vários sites, quase sempre como texto estático | Tempo para atualizar uma regra; % de pré-triagens com versão vigente |
| **Experiência do doador de ponta a ponta** | Uma jornada só: descobrir → agendar → doar → agradecer → voltar | Soluções costumam cobrir só parte da jornada [HIPÓTESE: confirmar no benchmarking] | SUS (System Usability Scale) em teste com usuários; tempo para agendar |
| **Gamificação ética** | Recompensa **participação**, não resultado clínico; sem prêmios materiais; ranking opcional; **metas coletivas** | Há apps gamificados (Pontos de Vida, Hemo4Play), com evidência ainda limitada (Johnson et al., 2016) | Taxa de retorno; percepção de pressão no questionário |
| **Integração com instituições de ensino** | Fluxo de horas complementares com **aprovação da instituição** + campanhas por turma | Depende de convênio | Pedidos aprovados; doações por campanha |
| **Estoque conectado à mobilização** | O "SangueConecta do Estoque" mostra criticidade e tendência; na V2, alerta doadores que consentiram | Alguns hemocentros divulgam níveis [HIPÓTESE: levantar quais] | Tempo entre o alerta crítico e a recomposição (simulação) |
| **Indicadores para gestão** | Faltas, cancelamentos, doações, primeira doação × retorno | — | Uso do painel pela persona gestora (teste) |
| **Notificações desacopladas** | Troca de fornecedor sem tocar no domínio; mensagens sem dados clínicos | Padrão de engenharia (diferencial técnico, não de produto) | Trocar o adaptador na demo (Mailpit → outro) |
| **Comprovante verificável** | QR + código: o terceiro verifica a autenticidade sem receber dados extras; compartilhamento com expiração | Comprovantes em papel são o padrão [HIPÓTESE] | Verificações bem-sucedidas; aceitação pela instituição |
| **Privacy by design** | Dados de saúde isolados num serviço, cifrados e auditados; eventos mínimos | Raramente demonstrado em projetos acadêmicos | Checklist LGPD; testes de autorização |
| **Integração futura com bases públicas** | Contextualizar e calibrar dados (Hemoprod, IBGE) | Bases agregadas e sem tempo real | — (Futuro) |

**Diferenciais adicionais propostos (só os que fazem sentido):**
1. **"Compliance como dado":** regras clínicas fora do código, versionadas e auditáveis. É o diferencial técnico mais forte e mais fácil de defender.
2. **Metas coletivas em vez de ranking individual** (ex.: "Turma de Engenharia: 40 doações neste semestre"): engaja sem expor nem pressionar indivíduos.
3. **Pontos independentes do resultado da triagem:** protege a honestidade da triagem. É um argumento ético forte e pouco comum.
4. **Mensagem pós-doação baseada em evidência:** o agradecimento é desenhado com base no efeito observado por Gemelli et al. (2018), e não por intuição.

---

## PARTE 18 — Recomendações: premissas questionadas

| # | Premissa do enunciado | Problema | Recomendação |
|---|---|---|---|
| 1 | 11 microsserviços | Custo operacional desproporcional; microsserviço artificial | **6 serviços** com fronteiras justificadas (plano B: 4) |
| 2 | Avaliar MongoDB ou híbrido | Nenhum caso de uso exige; dobra a complexidade | **Somente PostgreSQL** (JSONB para o que é flexível) |
| 3 | Pré-triagem indica "apto / não apto" | Risco à saúde e responsabilidade indevida | Resultado **informativo** em três níveis; nunca bloqueia nem autoriza |
| 4 | Registrar a doação atualiza o estoque | Factualmente incorreto: a bolsa passa por processamento e pode ser descartada | O estoque muda só por **movimentações** |
| 5 | `PATCH /blood-inventory/{id}` | Permite editar o saldo sem rastro | `POST /movements` (ledger) + `PATCH /thresholds` |
| 6 | Cadastro com CPF | Dado de alto risco, desnecessário para agendar no protótipo | Sem CPF no protótipo; em produção, só se a instituição exigir (cifrado + HMAC) |
| 7 | Perfil "ENFERMEIRO" | Grava no código uma decisão regulatória | Perfil por **função**: PROFISSIONAL_TRIAGEM |
| 8 | Profissional registra triagem e sinais no sistema | Em produção causaria dupla digitação e duplicaria o registro clínico oficial | Módulo como **[SIMULAÇÃO]** com formulário mínimo; no futuro, integração que sincroniza o desfecho |
| 9 | "Atestado" em PDF e envio ao RH | Validade jurídica não garantida; exposição de dados | **Comprovante acadêmico verificável**; o doador compartilha um link com expiração |
| 10 | Horas complementares | Não há reconhecimento automático | Pedido + **aprovação pela instituição**, só com convênio |
| 11 | Ranking | Pressão e exposição | Opt-in com apelido; **metas coletivas** |
| 12 | Pontos pela doação | Incentiva omitir informações na triagem | Pontos pelo **comparecimento**; bônus menor pela doação |
| 13 | E-mail, SMS e push desde o início | SMS tem custo; push exige configuração | **E-mail no MVP**; interface pronta para os demais canais |
| 14 | Aplicativo mobile | Instalar é barreira para quem usa poucas vezes por ano | **PWA responsiva**; app nativo só se a pesquisa indicar |
| 15 | `GET /dashboard/statistics` | Exigiria um serviço de relatórios já no MVP | Composição de estatísticas por serviço; read-model na V2 |
| 16 | Visualização "bolsa de valores" | A metáfora de mercado pode sugerir comercialização | Manter a **forma** visual (ticker, variação, sparkline) com o nome **"SangueConecta do Estoque"** e o vocabulário "nível" |
| 17 | Doadores de 16 e 17 anos | Exige consentimento do responsável e cuidados da LGPD (art. 14) | Fora do MVP; o sistema orienta a procurar a unidade |
| 18 | "Informar quando estiver elegível" | A regra é clínica e mudou recentemente | Data **informativa**, calculada por regra versionada, sempre com aviso |
| 19 | Escopo amplo já no Checkpoint 1 | Dispersa a apresentação | No CP1, focar em **problema, solução, arquitetura, dados, segurança, MVP e plano de pesquisa**. Detalhes ficam em apêndice |

### Recomendações para a avaliação acadêmica

1. **Mostrar um slide "Real × Simulação"** ([03-requisitos](03-requisitos.md), item 6.4). Isso transmite maturidade e evita questionamentos éticos.
2. **Usar a mudança normativa de 30/09/2026 como estudo de caso** de por que as regras são dados versionados.
3. **Medir usabilidade com o SUS** (questionário padronizado de 10 itens) com 5 a 8 colegas na fase final: dá números concretos à banca.
4. **Manter o registro de evidências** (pesquisado × hipótese) e mostrá-lo na apresentação final.
5. **Não prometer integração com sistemas reais.** Apresente-a como trabalho futuro, condicionado a parceria.
