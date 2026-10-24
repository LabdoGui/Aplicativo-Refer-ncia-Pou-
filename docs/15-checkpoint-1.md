# 15 — Roteiro do Checkpoint 1 (19/10 a 23/10/2026)

> Formato sugerido: **20 slides, de 12 a 15 minutos + perguntas**. Cada slide indica o conteúdo, a fonte na documentação e quem apresenta.
> Princípio: **um slide, uma ideia**. Os detalhes técnicos (DDL, endpoints completos) vão para o apêndice ou para o repositório.

| # | Slide | Conteúdo essencial | Visual sugerido | Fonte |
|---|---|---|---|---|
| 1 | **Título** | SangueConecta: "Conectando doadores a vidas que precisam de ajuda." Integrantes, curso, orientador, data | Logotipo + foto de pessoas (sem agulhas) | [12](12-identidade-visual.md) |
| 2 | **ODS relacionado** | ODS 3, com contribuição principal às metas 3.8 e 3.d e indireta às 3.1 e 3.6. Deixar claro que é contribuição **indireta** | Ícone oficial do ODS 3 + 4 metas | [01](01-visao-geral-problema-ods.md), Parte 3 |
| 3 | **Problema** | Só 1,6% da população doou em 2023 (MS); inconveniência, falta de informação e medo são barreiras (Bednall & Bove, 2011); a retenção é o desafio (Masser et al., 2008) | 3 números/ícones grandes com a fonte no rodapé | [01](01-visao-geral-problema-ods.md), Parte 2 |
| 4 | **Público-alvo** | 3 personas principais: Ana (1ª doação), Carlos (recorrente), Juliana (profissional) + gestora | Cards de persona | [02](02-personas-e-jornada.md) |
| 5 | **Justificativa** | Por que agora: critérios mudaram em 30/09/2026; o doador precisa de informação atualizada e as instituições, de previsibilidade | Linha do tempo | [01](01-visao-geral-problema-ods.md) |
| 6 | **Objetivo geral** | "Desenvolver uma plataforma que facilite e incentive a doação voluntária de sangue, da descoberta ao retorno, e apoie a gestão de agenda e estoque" | Frase única | — |
| 7 | **Objetivos específicos** | (1) pré-triagem informativa com regras versionadas; (2) agendamento com controle de capacidade; (3) registro simulado do atendimento; (4) gamificação ética; (5) painel de estoque; (6) segurança e LGPD by design | Lista numerada com ícones | [03](03-requisitos.md) |
| 8 | **Proposta de solução** | 3 frentes (doador, profissional, gestão) + o que o sistema **não** é | Diagrama de 3 colunas | [01](01-visao-geral-problema-ods.md), Parte 1 |
| 9 | **Jornada do usuário** | As 13 etapas resumidas em uma linha do tempo, destacando os momentos críticos | Diagrama journey | [02](02-personas-e-jornada.md), Parte 5 |
| 10 | **Funcionalidades** | Must × Should × Could (contagem por perfil) + **slide "Real × Simulação"** | Tabela-resumo | [03](03-requisitos.md), itens 6.1 e 6.4 |
| 11 | **Arquitetura** | Gateway + 6 serviços; por que **não** 11; eventos com outbox | Diagrama de contêineres | [06](06-arquitetura.md), item 7.3 |
| 12 | **Banco de dados** | PostgreSQL com schema por serviço; por que não MongoDB; 2 decisões-chave (vaga atômica, estoque por ledger) | Modelo conceitual | [07](07-banco-de-dados.md), item 8.3 |
| 13 | **Tecnologias** | React + TS (PWA), Spring Boot, PostgreSQL, RabbitMQ, Docker, GitHub Actions; critério "o que a equipe domina" | Logos em camadas | [08](08-stack.md) |
| 14 | **Segurança / LGPD** | Dados sensíveis isolados; consentimento por finalidade; JWT + RBAC + escopo + posse; **apenas dados fictícios** | Diagrama de camadas de proteção | [10](10-seguranca-lgpd.md) |
| 15 | **Pesquisa e fontes** | Perguntas de pesquisa + 4 categorias de fontes + regra "sem fonte primária, sem slide" | Tabela de fontes | [11](11-pesquisa-benchmarking.md), Parte 12 |
| 16 | **Benchmarking** | Instituições contatadas (status), roteiro de entrevista, apps analisados; ética (CEP, TCLE) | Matriz de comparação (prévia) | [11](11-pesquisa-benchmarking.md), Parte 13 |
| 17 | **Identidade visual** | Nome, slogan, paleta (com a separação marca × crítico), tipografia, 3 telas do Figma | Mockups | [12](12-identidade-visual.md) |
| 18 | **Diferenciais** | Regras como dados versionados; gamificação ética; metas coletivas; comprovante verificável; SangueConecta do Estoque | 5 ícones | [14](14-riscos-diferenciais-recomendacoes.md), Parte 29 |
| 19 | **MVP** | A "história do MVP" em uma frase + o que fica para a V2 e o Futuro | Funil MVP → V2 → Futuro | [13](13-mvp-roadmap.md), Parte 15 |
| 20 | **Próximos passos** | Roadmap por sprint, entrevistas agendadas, validações pendentes com profissionais (as 10 perguntas) | Gantt resumido | [13](13-mvp-roadmap.md), Parte 16 |
| A | *Apêndice* | Riscos (top 6), matriz de microsserviços, API (endpoints-chave), ER lógico | — | [06](06-arquitetura.md), [07](07-banco-de-dados.md), [09](09-api.md), [14](14-riscos-diferenciais-recomendacoes.md) |

## Perguntas prováveis da banca (e respostas curtas)

| Pergunta | Resposta |
|---|---|
| "Por que não fizeram os 11 microsserviços?" | Porque o critério é fronteira de negócio e sensibilidade de dado, não quantidade. Com 6, demonstramos gateway, eventos, isolamento e falha independente sem um custo que a equipe não sustentaria. |
| "A pré-triagem pode excluir alguém que poderia doar?" | Ela não bloqueia nem autoriza. Só orienta, com linguagem revisada, e a decisão é sempre do profissional. As regras são versionadas e aprovadas. |
| "Vocês vão usar dados reais?" | Não. Todo o protótipo usa dados fictícios gerados por script, e as telas de estoque exibem esse aviso. |
| "O documento tem validade?" | Não. É um comprovante acadêmico verificável. A validade depende de emissão pela instituição. |
| "E se o hemocentro não aceitar a pré-triagem?" | É uma das perguntas do benchmarking. O sistema funciona sem ela (é opcional) e a arquitetura não muda. |
| "Gamificação não é remuneração?" | Não há prêmio material. Recompensamos participação e reconhecimento, e o comparecimento vale o mesmo para quem foi considerado apto ou não. |
| "Como garantem que duas pessoas não pegam a última vaga?" | Com um UPDATE condicional atômico no banco + índice único; vamos provar com teste de carga. |

## Checklist de entrega

- [ ] Deck com os 20 slides + apêndice
- [ ] Link do repositório com esta documentação
- [ ] Protótipo no Figma (10 telas em wireframe, 3 em alta fidelidade)
- [ ] Diagramas exportados (contexto, contêineres, ER conceitual, sequência de agendamento)
- [ ] Planilha de fichamento (≥ 10 fontes) e registro de evidências iniciado
- [ ] Comprovantes de contato enviados aos hemocentros (prints/e-mails)
- [ ] Nome checado no INPI (ou marcado como provisório no slide)
- [ ] Ensaio cronometrado (≤ 15 min)
