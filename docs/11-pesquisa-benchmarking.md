# 11 — Pesquisa bibliográfica, pesquisa de campo, benchmarking e dados públicos

## PARTE 12 — Plano de pesquisa

### 12.1 Perguntas de pesquisa

| # | Pergunta | Para que serve no projeto |
|---|---|---|
| PQ1 | Quais fatores motivam e desmotivam a doação de sangue, principalmente o **retorno**? | Justificativa, funcionalidades de retenção |
| PQ2 | Quais critérios de elegibilidade estão vigentes no Brasil após a Portaria GM/MS nº 11.685/2026, e quais podem ser informados antes da triagem? | Pré-triagem (regras), conteúdo educativo |
| PQ3 | Lembretes, mensagens pós-doação e agendamento reduzem faltas ou aumentam o retorno? | Notificações, indicadores |
| PQ4 | Que evidências existem sobre gamificação em saúde e em doação de sangue, incluindo riscos? | Desenho ético da gamificação |
| PQ5 | Como os hemocentros brasileiros organizam hoje agendamento, triagem, estoque e comunicação? | Benchmarking, requisitos reais |
| PQ6 | Quais bases públicas permitem contextualizar a doação (volume, cobertura, estoque)? | Dashboard, justificativa |
| PQ7 | Quais exigências legais (LGPD, normas sanitárias, trabalhistas) afetam o sistema? | Segurança, documentos |

### 12.2 Método

- **Tipo:** revisão narrativa com busca estruturada (viável para o prazo). Registrar strings, datas e bases para dar reprodutibilidade.
- **Bases:**

| Base | Para quê |
|---|---|
| SciELO, LILACS/BVS | Produção latino-americana e brasileira em saúde |
| PubMed | Hemoterapia, doação, retenção, intervenções |
| Google Acadêmico | Varredura ampla e citações |
| IEEE Xplore, ACM Digital Library | Gamificação, sistemas de agendamento, engenharia de software |
| SOL – Biblioteca Digital da SBC | Trabalhos brasileiros de computação aplicada à saúde (SBCAS, WebMedia) |
| BDTD (IBICT) | Teses e dissertações brasileiras |
| gov.br (Ministério da Saúde, ANVISA, ANPD), DOU, Planalto | Normas e documentos oficiais |

- **Strings de busca (exemplos):**
  - `("blood donation" OR "blood donor") AND (retention OR "return behavior" OR "repeat donation")`
  - `("blood donor") AND (reminder OR SMS OR "text message" OR "no-show")`
  - `(gamification) AND (health OR "blood donation")`
  - `"doação de sangue" AND (aplicativo OR gamificação OR agendamento)`
  - `"doadores de sangue" AND (motivação OR fidelização OR retorno)`
- **Inclusão:** 2005 em diante (exceto clássicos), revisado por pares ou documento oficial, em português, inglês ou espanhol, relação direta com uma PQ.
- **Exclusão:** opinião sem método, conteúdo comercial, sites sem autoria ou data.
- **Fichamento** (planilha compartilhada): `ID · Referência ABNT · Tipo · PQ · Método · Achado principal · Limitações · Uso no projeto · Quem leu · Data`.
- **Regra do grupo:** **nenhum número entra em slide sem a fonte primária localizada**. Exemplo prático: a recomendação da OMS sobre o percentual de doadores aparece com valores diferentes em fontes secundárias, então ainda não pode ser usada.

### 12.3 Fontes já identificadas (verificadas em 16/10/2026)

Detalhes completos (autor, ano, DOI/URL) estão em [referencias.md](referencias.md).

**1. Fontes acadêmicas**

| Fonte | Relevância |
|---|---|
| Bednall & Bove (2011), *Transfusion Medicine Reviews* | Meta-análise de motivadores e desmotivadores: conveniência, falta de conhecimento, medo (PQ1) |
| Masser et al. (2008), *Transfusion Medicine Reviews* | Psicologia da doação; ênfase na retenção (PQ1) |
| Gemelli et al. (2018), *Transfusion* | SMS pós-doação aumentou o retorno em 12 meses (PQ3) |
| Bosnes, Aldrin & Heier (2005), *Transfusion* | Previsão de comparecimento; ~59% de comparecimento em Oslo (PQ3) |
| Ensaio randomizado em Guangzhou (2020), *BMC Public Health* | Telefone × SMS para reativar doadores inativos (PQ3) |
| Deterding et al. (2011), MindTrek | Definição de gamificação (PQ4) |
| Hamari, Koivisto & Sarsa (2014), HICSS | Revisão: efeitos positivos dependem do contexto e dos usuários (PQ4) |
| Johnson et al. (2016), *Internet Interventions* | Revisão sistemática de gamificação em saúde; evidência limitada (PQ4) |
| Serrano (UFPB), tese sobre o app "Pontos de Vida" | Piloto brasileiro de gamificação num hemocentro (PQ4, benchmarking) |
| Feitosa, Nunes & Silva, "Hemo4Play" (WebMedia, trilha estendida) | App gamificado brasileiro (benchmarking) |
| de Paula, Vasconcelos & Sirqueira (SBCAS, trilha estendida) | App de incentivo e fidelização na região Sul-Fluminense (benchmarking) |

**2. Fontes governamentais e normativas**

| Fonte | Relevância |
|---|---|
| Lei nº 10.205/2001 | Doação voluntária e não remunerada (limites da gamificação) |
| Portaria de Consolidação GM/MS nº 5/2017 + Portaria GM/MS nº 11.685/2026 (Anexo IV-B) | Regulamento técnico de procedimentos hemoterápicos **vigente** (PQ2) |
| RDC Anvisa nº 34/2014 | Boas práticas no ciclo do sangue |
| Lei nº 13.709/2018 (LGPD) e Resolução CD/ANPD nº 15/2024 | Proteção de dados e incidentes |
| ANPD — Guia orientativo sobre tratamento de dados para fins acadêmicos (2023) | Pesquisa de campo e protótipo |
| CLT, art. 473, IV; Lei nº 1.075/1950 | Ausência justificada do trabalho no dia da doação (documentos) |
| Resoluções CNS nº 466/2012, 510/2016 e 674/2022 | Ética em pesquisa com seres humanos |
| ANVISA — Boletins de produção hemoterápica (Hemoprod) | Dados agregados nacionais (PQ6) |
| Ministério da Saúde / DATASUS — Manual do usuário do HEMOVIDA (2024) | Existência de um sistema federal de estoque e redistribuição; **não implica que um hemocentro específico o use** |
| IPEA — página do ODS 3 | Metas adaptadas ao Brasil |
| OMS — *Global status report on blood safety and availability 2025* | Contexto internacional |

**3. Fontes técnicas**

| Fonte | Uso |
|---|---|
| OWASP Top 10 e OWASP API Security Top 10 (2023); OWASP ASVS | Controles de segurança |
| RFC 9457 (Problem Details), RFC 7519 (JWT), RFC 6749 (OAuth 2.0) | Padrões de API |
| OpenAPI Specification 3.x | Contrato de API |
| W3C WCAG 2.2; eMAG (governo federal) | Acessibilidade |
| Newman, *Building Microservices* (2ª ed., 2021); Richardson, *Microservices Patterns* (2018); Evans, *Domain-Driven Design* (2003) | Decomposição, outbox, sagas, bounded contexts |
| CloudEvents (CNCF) | Envelope de eventos |
| ICCBBA — ISBT 128 | Padrão internacional de identificação de hemocomponentes (citado pela imprensa como adotado na nova portaria; conferir) |

**4. Fontes institucionais** (a coletar)

- Sites dos hemocentros estaduais e regionais da cidade do grupo: requisitos publicados, formas de agendamento, se divulgam nível de estoque.
- Materiais de campanhas do Ministério da Saúde (Dia Nacional do Doador, 25/11; Junho Vermelho).
- Coordenação de cursos ou pró-reitoria da faculdade: regulamento de atividades complementares.

### 12.4 Ética na pesquisa de campo

- **Consultar o orientador e o CEP da instituição antes de aplicar entrevistas ou questionários.** A Resolução CNS nº 510/2016 (art. 1º, parágrafo único) dispensa de registro no sistema CEP/Conep algumas modalidades, como pesquisa de opinião pública com participantes não identificados. Ofício da Conep esclarece que a dispensa só vale se **todo** o protocolo se enquadrar, e cada instituição pode exigir análise local [FONTE]. **O grupo não decide sozinho se a dispensa se aplica.**
- Entrevistas com profissionais: **TCLE** (termo de consentimento), objetivo explicado, gravação só com autorização, anonimização do entrevistado se pedido, **nenhum dado de paciente ou doador** coletado.
- Questionário com estudantes/doadores: anônimo, sem perguntas de saúde individual (perguntar sobre **percepções e hábitos**, não sobre condições clínicas).
- Pedido formal à instituição (ofício da faculdade) antes de visitas.

---

## PARTE 13 — Benchmarking

### 13.1 Benchmarking de produtos (o grupo faz)

| Solução | O que analisar | Fonte para começar |
|---|---|---|
| "Pontos de Vida" (PWA, hemocentro da Paraíba) | Mecânicas de gamificação, resultados do piloto | Tese UFPB |
| Hemo4Play | Personagem e recompensas, avaliação de usabilidade | Anais WebMedia (SBC) |
| App da região Sul-Fluminense | Pontos de coleta, pré-informação, gamificação | Anais SBCAS (SBC) |
| "Gota de Vida" (Governo do ES) | Funcionalidades de um app governamental | Notícia em es.gov.br |
| Apps e sites de hemocentros da região | Agendamento, divulgação de estoque, comunicação | Lojas de apps e sites oficiais |
| Sistemas de agendamento genéricos (ex.: agendamento de vacinação municipal) | Padrões de UX de agendamento público | Observação direta |

**Matriz de comparação** (preencher): `Solução · Agendamento · Pré-triagem · Lembretes · Estoque público · Gamificação · Comprovante · Acessibilidade · Integração com instituição · Pontos fortes · Pontos fracos · Fonte · Data de acesso`.

> Registrar o que **foi observado** (com captura de tela e data) separado do que **se supõe**. Não afirmar como um app funciona por dentro sem evidência.

### 13.2 Benchmarking institucional (entrevistas)

**Quem procurar (em ordem de prioridade):**
1. Hemocentro regional ou estadual (setor de captação de doadores).
2. Agência transfusional de hospital (estoque e consumo).
3. Profissional de enfermagem ou médico que atue em triagem de doadores.
4. Responsável técnico em hemoterapia.
5. Coordenação de curso ou pró-reitoria (horas complementares).

**Modelo de mensagem de contato:**

> Prezada equipe do [Hemocentro],
> Somos estudantes de [curso] da [instituição] e desenvolvemos um projeto acadêmico, alinhado ao ODS 3, sobre ferramentas digitais de apoio à doação de sangue. Gostaríamos de conversar por 30 a 40 minutos com alguém da captação de doadores ou da triagem para entender o processo atual. Não coletaremos dados de doadores ou pacientes, e o conteúdo será usado apenas para fins acadêmicos, com anonimização se preferirem. Seguem em anexo o ofício da faculdade e o termo de consentimento.
> Atenciosamente, [nomes] — orientação: [professor(a)]

### 13.3 Roteiro de perguntas

**A. Agendamento e fluxo de doadores**
1. Como o doador agenda hoje (telefone, site, app, espontâneo)? Qual a proporção aproximada de cada forma?
2. Existe capacidade por horário? Como é definida (cadeiras, equipe, turnos)?
3. Qual a taxa aproximada de faltas em agendamentos? Vocês fazem *overbooking*?
4. Lembretes são enviados? Por qual canal? Há confirmação de presença?
5. Quais são os horários e dias de maior e menor movimento?
6. Como funcionam campanhas com empresas e universidades?

**B. Triagem**
7. Quais etapas compõem a triagem (cadastro, sinais vitais, testes, entrevista clínica)?
8. Quanto tempo leva cada etapa? Onde se formam filas?
9. Que critérios podem ser informados **antes** sem gerar falsa segurança? Que linguagem vocês recomendam?
10. Uma pré-triagem on-line ajudaria ou atrapalharia? A equipe consultaria as respostas?
11. Quais critérios mudaram com a portaria de 2026? Como vocês atualizam materiais e sistemas?
12. Quem pode registrar o resultado da triagem? Como o doador considerado inapto é comunicado?

**C. Dados coletados e sistemas**
13. Quais dados são coletados do doador? Quais são obrigatórios pela norma?
14. Que sistema(s) vocês usam para cadastro, triagem e estoque? (Registrar o que **eles disserem**; não supor.)
15. Um sistema externo poderia receber algum dado? Qual o mínimo útil (ex.: só "compareceu" e "doou")?
16. Há integração com sistemas do Ministério da Saúde ou da secretaria estadual?

**D. Estoque e bolsas**
17. Como o estoque é controlado: por bolsa, por hemocomponente, por tipo? Com que frequência é atualizado?
18. Como se definem estoque mínimo e ideal? Em quantidade ou dias de cobertura?
19. Quanto tempo vai da coleta à liberação da bolsa? Qual a proporção de descarte?
20. Como vocês sabem que um tipo vai ficar crítico? Como reagem (convocação, campanha, redes sociais)?
21. Divulgam o nível de estoque ao público? Em que formato?

**E. Comunicação com o doador e documentos**
22. Como o doador recebe orientações antes e depois da doação?
23. O doador recebe algum retorno sobre a doação (agradecimento, uso da bolsa)?
24. Que documento é emitido para trabalho, escola ou faculdade? Em papel ou digital? Quem assina?
25. Um comprovante digital com código de verificação seria aceitável? Que cuidados seriam necessários?

**F. Gargalos, ética e integrações**
26. Quais são os três maiores problemas operacionais hoje?
27. O que mais faz um doador não voltar, na percepção de vocês?
28. Vocês veem riscos em gamificação (pressão, omissão de informações)? Que limites colocariam?
29. Quais integrações seriam indispensáveis para um sistema como o nosso ser útil de verdade?
30. Há interesse em validar nosso protótipo numa segunda conversa?

**G. Instituição de ensino (horas complementares)**
31. A doação de sangue pode contar como atividade complementar? Com quantas horas e qual comprovante?
32. Quem valida? Um painel de aprovação digital ajudaria?

### 13.4 Questionário rápido com estudantes (anônimo)

Objetivo: testar hipóteses de comportamento, **sem perguntas de saúde individual**.

1. Você já doou sangue? (nunca / uma vez / mais de uma vez)
2. Qual o principal motivo para não doar ou não doar mais vezes? (múltipla escolha + outro)
3. Você saberia onde doar perto de você? (sim / não)
4. Agendaria a doação por um site? Instalaria um app só para isso?
5. Quais funcionalidades o fariam doar mais? (lembrete, horas complementares, comprovante digital, conquistas, saber o estoque do seu tipo…)
6. Você se sentiria pressionado(a) por rankings de doação? (escala 1–5)

### 13.5 Registro de evidências: "pesquisado" × "hipótese"

Toda afirmação usada no projeto entra nesta tabela (planilha versionada):

| ID | Afirmação | Tipo | Origem | Data | Impacto no projeto | Status |
|---|---|---|---|---|---|---|
| EV-01 | Cerca de 59% de comparecimento aos agendamentos em Oslo | [FONTE] | Bosnes et al. (2005) | 16/10/2026 | Justifica lembretes | Confirmado (contexto norueguês) |
| EV-02 | A taxa de faltas no hemocentro local é relevante | [HIPÓTESE] | — | — | Prioridade do RF91 | **A validar** (pergunta A3) |
| EV-03 | Estudantes não instalariam um app só para doar | [HIPÓTESE] | — | — | Escolha por PWA | **A validar** (questionário, item 4) |
| EV-04 | Critérios de doação mudaram em 30/09/2026 | [FONTE] (imprensa) | CNN Brasil, O Povo, Agência Gov | 16/10/2026 | Regras versionadas | Conferir no DOU |
| … | | | | | | |

Tipos: **[FONTE]** documento · **[CAMPO]** entrevista ou questionário (anonimizado) · **[HIPÓTESE]** suposição do grupo.

---

## PARTE 19 — Dados públicos

| Base | O que pode oferecer | Como usar | Cuidados |
|---|---|---|---|
| **ANVISA — Hemoprod** (boletins de produção hemoterápica) | Coletas, produção de hemocomponentes, por UF e ano (boletins de 2011 a 2018 localizados) | Contexto e justificativa; valores de referência para calibrar dados fictícios | Verificar se há boletins mais recentes ou a substituição pelo sistema do Ministério; não é dado em tempo real |
| **Ministério da Saúde — publicações de hemoterapia** | Cadernos de informação (última edição localizada: 7ª, 2012), guias, campanhas | Fundamentação | Dados antigos: deixar o ano explícito |
| **Ministério da Saúde / DATASUS — HEMOVIDA** | Manual público do módulo de estoque e redistribuição | Benchmarking de funcionalidades (ex.: estoque emergencial) | **Não afirmar** que o hemocentro X usa o sistema sem confirmação em campo |
| **DATASUS — TabNet** | Investigar se há procedimentos de hemoterapia em bases ambulatoriais e hospitalares do SUS | Possível série histórica por município | Exige entendimento das tabelas de procedimentos; validar a interpretação com o orientador |
| **IBGE — API de dados** (localidades, população) | Lista de UFs e municípios, população | Calcular indicadores por habitante; combos de UF e cidade no cadastro de unidades | API pública documentada |
| **Portal Brasileiro de Dados Abertos (dados.gov.br)** | Buscar conjuntos sobre sangue e hemoterapia | Pesquisa exploratória | Verificar data de atualização e licença |
| **OMS — Global status report 2025** | Indicadores internacionais | Comparação e contexto | Indicadores agregados por país |
| **Sites dos hemocentros** | Nível de estoque divulgado ao público (em alguns) | Benchmarking da visualização "SangueConecta do Estoque" | Respeitar termos de uso; **não** fazer scraping sem autorização |

**Conclusão provisória:** não foi encontrada evidência de **API pública nacional de estoque de sangue em tempo real** [HIPÓTESE: confirmar na pesquisa]. Por isso, o painel de estoque do protótipo é [SIMULAÇÃO] e pode ser calibrado com ordens de grandeza dos boletins públicos. A integração com bases públicas é uma funcionalidade **Futuro**.
