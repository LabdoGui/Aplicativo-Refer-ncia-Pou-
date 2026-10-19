# 01 — Visão geral, problema e ODS 3

## PARTE 1 — Visão geral (resumo executivo)

**Pulso** (nome provisório) é uma plataforma digital que **reduz atritos na jornada do doador de sangue** e **dá visibilidade operacional** a quem organiza a coleta. Ela tem três frentes:

1. **Doador**: entender o processo, verificar critérios básicos numa *pré-triagem informativa*, agendar, receber lembretes, acompanhar o histórico, obter comprovantes e ser incentivado a voltar.
2. **Profissional da unidade**: agenda do dia, confirmação de presença, registro do atendimento e do desfecho da doação. No protótipo, essa parte é [SIMULAÇÃO].
3. **Gestão**: configurar locais e horários, acompanhar indicadores (agendamentos, faltas, doações) e visualizar o estoque por tipo sanguíneo num painel no estilo "bolsa de valores", com dados fictícios.

A solução usa **arquitetura de microsserviços com API REST**, dimensionada para uma equipe acadêmica: 6 serviços com fronteiras claras, PostgreSQL e mensageria para eventos. O projeto também é **privacy by design**: os dados de saúde ficam isolados num único serviço, a coleta é mínima e todo acesso é auditado.

**O que o Pulso não é:**
- não substitui a triagem clínica, que continua sendo decisão do profissional de saúde;
- não é o sistema oficial de hemoterapia da instituição (rastreabilidade de bolsas, sorologia, prontuário);
- não emite atestado com validade jurídica sem convênio e validação formal.

---

## PARTE 2 — Problema

### 2.1 Contexto

- **[FONTE]** A Lei nº 10.205/2001 estabelece que a doação de sangue no Brasil é voluntária e não remunerada, e veda a comercialização.
- **[FONTE]** O Ministério da Saúde informou que **1,6% da população** doou sangue em 2023. Reportagens de junho de 2026 citam "menos de 2%". Os números variam de ano para ano, então a apresentação deve usar o boletim oficial mais recente (ver [referências](referencias.md)).
- **[FONTE]** A faixa recomendada pela OMS **aparece de forma divergente** nas fontes secundárias ("1% a 3%" e "3% a 5%"). **Recomendação:** não citar um número da OMS sem localizar o documento primário. Esse é um bom exemplo de "informação pesquisada × repetida sem fonte".
- **[FONTE]** A OMS publicou em 2025 o *Global status report on blood safety and availability*, com dados de 168 países, e reafirma a meta de que todos os países obtenham sangue apenas de doadores voluntários não remunerados.
- **[FONTE]** Em 2026, o Ministério da Saúde reformulou o regulamento técnico de procedimentos hemoterápicos (Portaria GM/MS nº 11.685, de 2/7/2026, que cria o Anexo IV-B da Portaria de Consolidação nº 5/2017). A imprensa reporta mudanças de critérios, entre elas o fim do limite máximo de idade para doadores regulares e alteração em prazos de inaptidão temporária. **O texto oficial precisa ser consultado no DOU antes de qualquer uso** [VALIDAR-SAÚDE].

### 2.2 Problema central

> Potenciais doadores enfrentam **atritos de informação, conveniência e confiança** que reduzem a primeira doação e, principalmente, o **retorno**. Ao mesmo tempo, as equipes de coleta têm pouca previsibilidade de demanda, o que gera filas ou horários ociosos.

Atritos do doador, com respaldo da literatura:

| Atrito | Evidência | Como o Pulso atua |
|--------|-----------|-------------------|
| Inconveniência (onde, quando, fila) | **[FONTE]** Bednall & Bove (2011): inconveniência está entre os desmotivadores mais citados por doadores e não doadores, e conveniência está entre os principais motivadores. | Locais, horários e agendamento num só lugar. |
| Falta de conhecimento / baixa autoeficácia ("não sei se posso") | **[FONTE]** Bednall & Bove (2011): falta de conhecimento e baixa autoeficácia aparecem entre os desmotivadores. | Conteúdo educativo e pré-triagem informativa. |
| Medo e experiências negativas | **[FONTE]** Bednall & Bove (2011). | Linguagem acolhedora, explicação do passo a passo, preparo antes da doação. |
| Retenção baixa após a primeira doação | **[FONTE]** Masser et al. (2008) destacam a retenção como questão central. **[FONTE]** Gemelli et al. (2018): uma mensagem pós-doação personalizada elevou o retorno em 12 meses (70,3% contra 62,6%). | Mensagem de agradecimento, lembrete de nova elegibilidade, conquistas. |
| Faltas em horários agendados | **[FONTE]** Bosnes et al. (2005): no banco de sangue de Oslo, só cerca de 59% dos doadores agendados compareceram, com grande variação diária. | Lembretes, confirmação ativa, liberação de vaga, indicador de comparecimento. |

> **[HIPÓTESE]** Os números de Oslo **não** podem ser transpostos para o Brasil. A taxa de falta de um hemocentro brasileiro deve ser perguntada na pesquisa de campo (ver [11-pesquisa-benchmarking](11-pesquisa-benchmarking.md)).

Atritos da instituição, a validar em campo:

- **[HIPÓTESE]** Agendamentos por telefone ou planilha, sem visão consolidada.
- **[HIPÓTESE]** Pouca antecedência para reagir a estoque crítico de um tipo sanguíneo.
- **[HIPÓTESE]** Comunicação com o doador concentrada em campanhas genéricas.

### 2.3 Impacto social

- A doação de sangue sustenta cirurgias, tratamento de pacientes oncológicos e hematológicos, atendimento a traumas e intercorrências obstétricas.
- Aumentar a **recorrência** tem efeito maior que só recrutar novos doadores, porque o doador que retorna estabiliza o estoque.
- O projeto também tem impacto **educativo**: combate a mitos e explica os critérios. A formulação final desses conteúdos é [VALIDAR-SAÚDE].

---

## PARTE 3 — Contribuição ao ODS 3

O ODS 3 busca "assegurar uma vida saudável e promover o bem-estar para todos, em todas as idades". Nenhuma meta do ODS 3 fala especificamente de sangue. Por isso, **a contribuição do projeto é indireta e precisa ser apresentada com honestidade**:

| Meta do ODS 3 (texto resumido; ver IPEA/ONU) | Relação com a disponibilidade de sangue | Contribuição do Pulso |
|---|---|---|
| **3.1** Reduzir a mortalidade materna | Hemorragias obstétricas exigem acesso rápido a hemocomponentes. | Ajuda a manter o estoque com doações recorrentes e agendadas. |
| **3.6** Reduzir mortes e lesões no trânsito | Vítimas de trauma frequentemente precisam de transfusão. | Mobiliza doadores quando o estoque fica crítico (painel e alertas). |
| **3.8** Cobertura universal de saúde e acesso a serviços essenciais | Hemoterapia é serviço essencial do SUS. | Reduz barreiras de acesso à doação e dá previsibilidade às unidades. |
| **3.d** Alerta precoce e gestão de riscos à saúde | Estoques críticos são um risco sistêmico (feriados, férias, emergências). | Painel com níveis de atenção e crítico, tendências e alertas. **Na simulação, os dados são fictícios.** |

**Frase sugerida para a apresentação:**
> "O Pulso contribui para o ODS 3, especialmente às metas 3.8 e 3.d, ao reduzir barreiras à doação voluntária e dar às instituições visibilidade para agir antes que o estoque fique crítico. Indiretamente, apoia as metas 3.1 e 3.6, que dependem de sangue disponível."

> Fonte das metas: página do IPEA sobre o ODS 3 (metas adaptadas ao Brasil). Confira o texto exato antes de colocá-lo no slide.
