# Tycoon Empire — Simulador de Império Financeiro

Jogo web de simulação econômica: comece clicando em um cartão bancário virtual e construa um conglomerado com negócios, ações, criptomoedas e imóveis — tudo fictício, offline e sem anúncios.

## Como executar

Requisitos: Node.js 18+ (testado com Node 22).

```bash
npm install
npm run dev        # servidor de desenvolvimento (http://localhost:5173)
npm run build      # checagem de tipos + build de produção em dist/
npm run preview    # serve o build de produção
npm test           # testes automatizados (Vitest) — motor econômico e salvamento
npm run e2e        # teste de ponta a ponta em Chromium (exige `npm run build` antes)
npm run sim -- 8 3 # simulador de balanceamento: 8 horas, 3 cliques/s
```

O `e2e` usa `playwright-core` com o Chromium em `/opt/pw-browsers`; em outra máquina, defina `CHROMIUM_PATH` com o caminho do Chrome/Chromium.

## O que já funciona

| Sistema | Detalhes |
|---|---|
| Início | Cartão bancário com saldo, botão de clique com animação, "Hora do Rush" (×3 por 30 s, recarga 5 min, gratuita), tutorial interativo em 6 passos, 8 melhorias com compra ×1/×10/Máx |
| Negócios | 11 empresas com perfis diferentes (margem, crescimento de custo, risco, sensibilidade a eventos, defensivas, holding com bônus de grupo). Níveis, marcos ×2, gerente (com salário), marketing, filiais, aquisição de concorrente, venda (50% do investido), indicadores de receita/despesa/lucro/margem/retorno |
| Bolsa | 10 ações fictícias; preço = tendência + clima do mercado + eventos do setor + momento + reversão ao valor fundamental + choque; resultados trimestrais com notícia; dividendos; taxa 0,25%; preço médio, P&L realizado e não realizado; gráfico com cursor |
| Criptomoedas | 5 moedas fictícias com riscos distintos (inclui moeda estável e moeda-meme com tendência negativa); taxa 0,5% |
| Imóveis | 4 regiões com ciclos; 8 tipos de imóvel; comprar, vender, reformar (3 níveis), desenvolver terreno em prédio; sinergias (galpão reduz despesas da transportadora, escritório libera a holding, resort dá +5% de renda etc.) |
| Patrimônio | Composição do patrimônio, fluxo de caixa por minuto, cada fonte de receita/despesa, eventos ativos e previstos, histórico financeiro filtrável, Legado, estatísticas, configurações, exportar/importar save |
| Eventos | 12 eventos econômicos, anunciados 1 min antes com dica de preparação, efeitos declarados por setor |
| Progressão | 20 missões (tutorial, curto, médio, longo prazo), 17 conquistas (+1% de renda cada), Legado (prestígio opcional) |
| Salvamento | IndexedDB (fallback localStorage), autosave 10 s + a cada compra, backup rotativo, checksum, migrações versionadas, cópia de emergência ao fechar, bloqueio de múltiplas abas, progresso offline com limite de 8 h |

## Arquitetura

```
src/
  engine/              Motor do jogo — TypeScript puro, sem React (testável isoladamente)
    money.ts           Dinheiro em centavos (bigint), formatação mil/mi/bi/tri/qa/qi…
    types.ts           Formato do estado do jogo
    state.ts           Estado inicial e versão do save
    config/            CONTEÚDO declarativo: melhorias, negócios, ativos, imóveis, eventos,
                       missões/conquistas e balance.ts (todos os botões de balanceamento)
    economy.ts         Cálculos puros (renda, despesas, custos, patrimônio) — a UI usa os mesmos
    ledger.ts          Único ponto que altera o saldo; registra tudo no histórico
    actions.ts         Ações do jogador: validação atômica + idempotência por ID
    market.ts          Bolsa e cripto
    realestate.ts      Imóveis
    events.ts          Eventos econômicos
    simulation.ts      Avanço do tempo (mesmo código no jogo ativo e no offline)
    progress.ts        Missões e conquistas
  save/                Serialização, validação, migrações, IndexedDB, backup/recuperação
  ui/                  React: store (laço de tempo + autosave), abas, componentes, gráficos SVG
  tools/balanceSim.ts  Jogador simulado para medir a curva de progressão
scripts/e2e.mjs        Teste de ponta a ponta no navegador
```

Para adicionar conteúdo (um novo negócio, ação, imóvel ou evento), basta incluir um item no arquivo correspondente em `src/engine/config/`. Saves antigos recebem automaticamente os novos ativos e regiões (`normalizeState`).

### Decisões de engenharia

- **Precisão**: saldos, preços, custos e históricos são `bigint` em centavos. Taxas por segundo são `number` e a fração de centavo é acumulada em `carry` — nada se perde nem é criado por arredondamento.
- **Transações auditáveis**: toda variação de saldo passa por `applyTransaction` com categoria e descrição. Renda passiva e cliques são creditados continuamente e resumidos no histórico a cada minuto, com o detalhamento por fonte.
- **Sem saldo negativo escondido**: se despesas superam o caixa, a diferença vira "dívida operacional" visível, abatida automaticamente pela renda futura.
- **Ações atômicas e idempotentes**: cada ação valida tudo antes de alterar o estado; a UI envia um ID único e um ID repetido é ignorado.
- **Aleatoriedade determinística**: o gerador aleatório tem semente salva no jogo. Recarregar a página não "rola os dados de novo".
- **Offline seguro**: usa o maior horário já registrado; voltar o relógio não credita nada, adiantar rende no máximo o limite (8 h), e aplicar duas vezes não duplica.
- **Sem backend**: jogo local de um jogador. Para nuvem no futuro, o `SaveStorage` é uma interface — basta outra implementação (o envelope com versão e checksum já serve para sincronização).

## Pesquisa: críticas a jogos do gênero

Busquei avaliações de *Business Empire: RichMan* e jogos semelhantes. **Limitação importante:** não consegui ler diretamente as avaliações das lojas nem threads do Reddit sobre o jogo. O que encontrei vem principalmente de agregadores e resumos de avaliações, então os pontos abaixo são **relatos recorrentes nessas fontes, não críticas universais verificadas**. Uma listagem da App Store mostrava nota média 4,6 (442 avaliações), ou seja, muitos jogadores gostam do jogo.

| Problema relatado | Fonte | Requisito criado neste projeto |
|---|---|---|
| Anúncios forçados frequentes, pop-ups ao navegar | Resumo de avaliações em agregador (marlvel.ai) | Nenhum anúncio. O turbo "Hora do Rush" é gratuito |
| Sem salvamento na nuvem; perda de progresso ao trocar de aparelho ou reinstalar | marlvel.ai | Exportar/importar save em arquivo ou texto; arquitetura de armazenamento pronta para nuvem |
| Precisa de conexão para salvar; risco de perder ganhos sem internet | Guia em francês (clubic.com) | 100% offline com IndexedDB local |
| Ações sumiram da carteira após reiniciar o app (relato individual) | Página de agregador | Saves verificados após gravar, com checksum, backup e testes de reabertura |
| Tela de carregamento infinita, travamentos e fechamentos após atualização | Agregadores; resumo de ~30 avaliações do Google Play (kimola.com) | Erro de carga nunca apaga o save e mostra o motivo; recuperação por backup; migrações testadas |
| Pedidos de mais conteúdo (terrenos, veículos, negócios, criptomoedas) | kimola.com | Conteúdo por configuração, sem duplicar código |
| Progressão lenta e repetitiva ("grindy") | Listagem de terceiros | Compras em lote ×10/Máx, automação de cliques, clique proporcional à renda, simulador para calibrar a curva |
| Custos do fim de jogo extremamente altos (~40 trilhões para melhorar a empresa mais rentável) | Wiki de fãs (só descreve, não avalia) | Endgame com objetivos diferentes (holding, conglomerado, Legado), não só preços maiores |

Fontes consultadas:
- [Business Empire: RichMan vs its rivals (marlvel.ai)](https://marlvel.ai/apps/com-xentech-empire/vs)
- [Business Empire: RichMan — AppFollow](https://apps.appfollow.io/ios/business-empire-richman/6451208928?country=pt)
- [Pourquoi utiliser Business Empire: RichMan ? (Clubic)](https://www.clubic.com/telecharger-fiche586258-business-empire-richman.html)
- [Business game mixed reviews (Kimola)](https://kimola.com/reports/business-game-mixed-reviews-learning-potential-141035)
- [Business Empire: RichMan — App Store](https://apps.apple.com/app/id6451208928)

### Diferenciais adicionados

Eventos anunciados com antecedência e com dica de preparação; negócios com trade-offs reais (gerente com salário, defensivos vs. cíclicos); sinergias entre imóveis e empresas; transparência total de taxas e despesas; resumo do período offline; bloqueio de múltiplas abas para proteger o save.

## Balanceamento

Saída do `npm run sim -- 8 3`: jogador "perfeito" que clica 3×/s sem parar e sempre compra o melhor retorno. Jogadores reais levam mais tempo.

| Marco | Tempo |
|---|---|
| R$ 1 mil | ~1,5 min |
| R$ 1 milhão | ~21 min |
| R$ 1 bilhão | ~2 h 45 |
| R$ 1 trilhão | ~7 h |

A holding custa R$ 7 trilhões e exige escritório ou prédio comercial. O Legado fica disponível a partir de R$ 10 milhões.

## O que ainda falta

- **Ordens limitadas e alertas de preço** (previstos como melhorias desbloqueáveis na bolsa).
- **Endgame avançado**: participações em grandes empresas, fusões e aquisições, expansão internacional, grandes obras de infraestrutura, metas de "décadas econômicas" e ranking local. Hoje o endgame tem holding, conglomerado completo, resort de luxo, missões de longo prazo e Legado.
- **Balanceamento fino** do fim de jogo e testes com jogadores reais.
- **PWA instalável** (ícone na tela inicial e funcionamento sem internet após o primeiro acesso).
- **Acessibilidade**: revisão completa com leitor de tela. Já existem rótulos ARIA, foco visível, clique pelo teclado, opção de reduzir movimento e sons desligados por padrão.
