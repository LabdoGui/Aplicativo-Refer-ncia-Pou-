# Pulso — Plataforma de apoio à doação de sangue

> **Nome provisório.** Projeto acadêmico alinhado ao **ODS 3 — Saúde e Bem-Estar**.
> Status: **proposta para o Checkpoint 1 (19/10 a 23/10/2026)**. Ainda não há código: esta etapa cobre análise, requisitos, arquitetura e plano de pesquisa.

O Pulso é uma plataforma web responsiva (PWA) que acompanha a jornada de quem doa sangue: descoberta, cadastro, pré-triagem informativa, agendamento, lembretes, atendimento, pós-doação e incentivo à recorrência. Ela também oferece aos profissionais e gestores ferramentas para organizar a agenda, registrar o atendimento e acompanhar o estoque de sangue, com **dados fictícios** no protótipo.

---

## Leitura recomendada (em ordem)

| # | Documento | Partes do enunciado |
|---|-----------|---------------------|
| 1 | [Visão geral, problema e ODS 3](docs/01-visao-geral-problema-ods.md) | Partes 1, 2 e 3 |
| 2 | [Personas e jornada do doador](docs/02-personas-e-jornada.md) | Partes 4 e 5 |
| 3 | [Requisitos e regras de negócio](docs/03-requisitos.md) | Parte 6 (itens 21 e 22) |
| 4 | [Casos de uso](docs/04-casos-de-uso.md) | Item 23 |
| 5 | [Fluxos e diagramas](docs/05-fluxos.md) | Item 24 |
| 6 | [Arquitetura de microsserviços](docs/06-arquitetura.md) | Parte 7 (itens 13 e 26) |
| 7 | [Banco de dados](docs/07-banco-de-dados.md) | Parte 8 (item 14) |
| 8 | [Stack tecnológica](docs/08-stack.md) | Parte 9 (item 15) |
| 9 | [API REST v1](docs/09-api.md) | Parte 10 (item 25) |
| 10 | [Segurança e LGPD](docs/10-seguranca-lgpd.md) | Parte 11 (item 16) |
| 11 | [Pesquisa, benchmarking e dados públicos](docs/11-pesquisa-benchmarking.md) | Partes 12 e 13 (itens 17, 18 e 19) |
| 12 | [Identidade visual](docs/12-identidade-visual.md) | Parte 14 (item 20) |
| 13 | [MVP e roadmap](docs/13-mvp-roadmap.md) | Partes 15 e 16 (item 27) |
| 14 | [Riscos, diferenciais e recomendações](docs/14-riscos-diferenciais-recomendacoes.md) | Partes 17 e 18 (item 29) |
| 15 | [Roteiro do Checkpoint 1](docs/15-checkpoint-1.md) | Item 28 |
| — | [Referências verificadas](docs/referencias.md) | Item 17 |

---

## Convenção de marcação (vale para todos os documentos)

Para separar o que foi **pesquisado** do que é **hipótese do grupo**, como pede o enunciado, os documentos usam as etiquetas abaixo:

| Etiqueta | Significado |
|----------|-------------|
| **[FONTE]** | Informação com origem verificável, listada em [referencias.md](docs/referencias.md). |
| **[HIPÓTESE]** | Suposição do grupo. Precisa ser confirmada em pesquisa de campo ou com a instituição parceira. |
| **[VALIDAR-SAÚDE]** | Depende de legislação, protocolo de hemoterapia ou decisão de profissional de saúde. O sistema **não** decide sozinho. |
| **[VALIDAR-JURÍDICO]** | Depende de análise jurídica, LGPD, validade documental ou convênio institucional. |
| **[SIMULAÇÃO]** | Existe apenas para demonstração acadêmica, com dados fictícios. Não representa operação real. |

---

## Decisões que mudam o enunciado original (resumo)

Esta proposta **não concorda automaticamente** com todas as premissas do enunciado. As principais divergências, justificadas no documento 14, são:

1. **6 serviços em vez de 11.** Auth e Usuário viram `identity-service`; Pré-triagem, Triagem, Doação e Documentos viram `clinical-service`, que concentra todos os dados de saúde num único lugar mais fácil de proteger; Admin/Reporting sai do MVP. Ver [06-arquitetura](docs/06-arquitetura.md).
2. **Somente PostgreSQL**, com um schema por serviço. MongoDB não se justifica: o JSONB do PostgreSQL cobre os questionários flexíveis.
3. **Registrar uma doação não aumenta o estoque.** No mundo real, a bolsa coletada passa por testes e processamento e pode ser descartada. O estoque só muda por **movimentações** registradas por quem gere o estoque. O endpoint `PATCH /blood-inventory/{id}` do enunciado vira `POST /blood-inventory/movements`.
4. **A pré-triagem nunca bloqueia nem libera a doação.** O resultado é apenas "parece que você pode seguir" ou "fale com o hemocentro antes". As regras ficam em tabelas versionadas, cada uma ligada à norma de origem e aprovada por um profissional. A mudança normativa de **30/09/2026** (Portaria GM/MS nº 11.685/2026) [FONTE] é o argumento concreto para isso.
5. **A gamificação premia a participação, não o resultado clínico.** Quem comparece e é considerado inapto ganha os mesmos pontos de comparecimento. Assim ninguém é incentivado a omitir informações na triagem. Não há prêmios materiais, por causa da Lei nº 10.205/2001 [FONTE] [VALIDAR-JURÍDICO].
6. **O documento gerado não é o atestado oficial.** O protótipo emite um *comprovante acadêmico verificável*, com QR Code e código de validação. Em vez de enviar o documento direto ao RH, o doador gera um *link de verificação* com prazo de expiração.
7. **No mundo real, o módulo do profissional não deve substituir o sistema do hemocentro.** Fazer a equipe digitar tudo em dois sistemas é o maior risco de adoção. No protótipo a triagem é [SIMULAÇÃO]; em produção, o caminho seria integrar e sincronizar apenas o desfecho.

---

## Estrutura prevista do repositório (após o Checkpoint 1)

```
/docs                    documentação (este material)
/frontend                PWA React + TypeScript (doador, profissional, admin)
/services
  /gateway               Spring Cloud Gateway (somente roteamento e políticas)
  /identity-service
  /scheduling-service
  /clinical-service
  /inventory-service
  /engagement-service
  /notification-service
/infra                   docker-compose, scripts de seed com dados fictícios
```

> Aviso permanente: **nenhum dado médico real** será usado no protótipo. Todos os doadores, triagens, doações e estoques são fictícios.
