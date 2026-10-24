# 12 — Identidade visual

## 14.1 Nome

| Opção | Conceito | Prós | Contras |
|---|---|---|---|
| **SangueConecta** ✅ | "Sangue" é o que se doa; "Conecta" é o papel da plataforma: ligar quem doa, as unidades de coleta e as vidas que precisam de ajuda | Autoexplicativo, em português; diz o que o app faz; combina com o símbolo (duas pessoas formando um coração) | Nome composto, mais longo; pode haver marcas parecidas |
| Pulso | O pulso é sinal vital, ritmo e continuidade (nome da primeira versão do protótipo) | Curto e memorável | Não diz que o assunto é doação de sangue; palavra comum |
| Corrente | "Corrente do bem" e corrente sanguínea | Forte apelo de solidariedade | Ambíguo ("conta corrente") |
| Sangue Bom | Gíria para "pessoa boa" | Muito carismático | Informal demais para uma instituição de saúde |

> **Antes de adotar:** pesquisar o nome na base de marcas do **INPI** e verificar domínio e redes sociais. O nome é provisório até essa checagem.

## 14.2 Slogan

- **Principal:** *"Conectando doadores a vidas que precisam de ajuda."*
- Alternativas: *"Cada doação conecta alguém à vida."* · *"Do agendamento ao agradecimento, com você."*

## 14.3 Conceito

**"Cuidado preciso."** A marca equilibra o **calor humano** da solidariedade (vermelho carmim, linguagem acolhedora, fotografia de pessoas reais) com a **precisão e a confiança** de um serviço de saúde (azul petróleo, layout limpo, números legíveis). A gamificação aparece como **reconhecimento**, não como jogo: medalhas sóbrias, progresso discreto, sem mascotes nem efeitos chamativos.

Atributos: **confiável · acolhedora · clara · viva · discreta**.

## 14.4 Paleta de cores

| Papel | Nome | HEX | Uso | Contraste sobre branco |
|---|---|---|---|---|
| Primária | **Carmim Vital** | `#A3123A` | Marca, botões principais, destaques | ≈ 7,8:1 ✅ AA/AAA |
| Secundária | **Petróleo Clínico** | `#0E4D64` | Cabeçalhos, navegação, áreas do profissional e do admin | ≈ 9,3:1 ✅ |
| Acento | Coral Suave | `#F26D6D` | Ilustrações e detalhes **não textuais** | Não usar em texto |
| Fundo | Linho | `#FAF8F6` | Fundo geral (branco quente, menos frio que `#FFF`) | — |
| Superfície | Branco | `#FFFFFF` | Cards | — |
| Texto | Grafite | `#1F2328` | Texto principal | ≈ 15,8:1 ✅ |
| Texto secundário | Cinza Ardósia | `#57606A` | Legendas | ≈ 6,4:1 ✅ |
| Borda | Névoa | `#D8DEE4` | Divisores, bordas de input | — |

**Cores de status (uso exclusivo para estado; sempre com ícone e texto):**

| Status | HEX (texto/ícone) | HEX (fundo do chip) | Ícone | Rótulo |
|---|---|---|---|---|
| 🟢 Adequado | `#1E7F4F` (≈ 5,0:1) | `#E6F4EC` | ● círculo cheio / ▲ | "Adequado" |
| 🟡 Atenção | `#B25E00` (≈ 4,7:1) | `#FFF4E0` | ◆ losango / ! | "Atenção" |
| 🔴 Crítico | `#D92D20` (≈ 4,8:1) | `#FDECEA` | ▼ triângulo / !! | "Crítico" |

> **Decisão de design importante:** a cor da marca (carmim, puxada para o vinho) é **diferente** do vermelho de "crítico" (mais alaranjado e vivo). Sem essa separação, o usuário confundiria "botão da marca" com "alerta". Além disso, **nenhum status depende só da cor** (WCAG 1.4.1, RNF23): pessoas com daltonismo (protanopia ou deuteranopia) distinguem os estados pelo ícone e pelo rótulo.
> Os contrastes foram calculados pela fórmula de luminância relativa da WCAG; confira-os com uma ferramenta (ex.: WebAIM Contrast Checker) ao montar o Figma.

**Modo escuro (V2):** fundo `#0F1418`, superfície `#161D22`, primária clareada `#E0496B`, secundária `#5FB3CE`, com status recalibrados para contraste ≥ 4,5:1 sobre o fundo escuro.

## 14.5 Tipografia

| Uso | Fonte | Motivo |
|---|---|---|
| Títulos | **Plus Jakarta Sans** (600–700) | Geométrica e humana: moderna sem parecer infantil |
| Texto e interface | **Inter** (400–600) | Altíssima legibilidade em tela; **algarismos tabulares** (`font-feature-settings: "tnum"`) para alinhar números no painel de estoque |
| Alternativa de acessibilidade | Atkinson Hyperlegible | Criada para baixa visão; pode ser oferecida como opção nas preferências |

Todas são gratuitas (Google Fonts).

**Escala (base 16 px, razão ~1,25):** 12 · 14 · **16** · 20 · 24 · 32 · 40. Corpo mínimo de 16 px no mobile; entrelinha de 1,5 no texto.

## 14.6 Logotipo (conceito)

- **Símbolo:** uma **gota vermelha** com **duas pessoas** cujos braços se unem formando um **coração**: quem doa e quem recebe, conectados pela doação. Arquivos em [`docs/marca`](marca) (arte original e versão vetorial `sangueconecta-simbolo.svg`, usada no app e no favicon).
- **Logotipo:** "SangueConecta" em negrito, com **"Sangue" em vermelho** (`#D30A04`) e **"Conecta" em azul** (`#215F8F`), ao lado do símbolo; slogan abaixo na versão completa ([`docs/marca/sangueconecta-logo.jpg`](marca/sangueconecta-logo.jpg)).
- **Versões:** horizontal (símbolo + nome), vertical, só símbolo (favicon e ícone da PWA), monocromática (carmim, petróleo, branco).
- **Área de proteção:** altura do "S" em volta do logotipo; tamanho mínimo de 24 px de altura para o símbolo.
- **Evitar:**
  - a **cruz vermelha sobre fundo branco**: é um emblema protegido pelas Convenções de Genebra e não pode ser usado como marca;
  - mãos segurando gotas (clichê) e outros símbolos que concorram com a gota da marca;
  - degradês fortes e efeitos 3D.

## 14.7 Estilo de componentes

| Elemento | Especificação |
|---|---|
| Grid | Base 8 px; mobile com 4 colunas e margem de 16 px; desktop com 12 colunas e largura máxima de 1200 px |
| Raio de borda | 12 px (cards), 10 px (botões e inputs), 999 px (chips) |
| Sombra | Suave e única: `0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.10)` |
| Botões | Primário carmim com texto branco; secundário com contorno petróleo; altura mínima de 44 px (toque); foco visível com anel de 3 px |
| Inputs | Rótulo sempre visível (nunca só *placeholder*); mensagem de erro abaixo, com ícone e texto |
| Cards | Fundo branco sobre linho, título + conteúdo + ação |
| Ícones | **Lucide**, traço de 1,75 px, cantos arredondados |
| Ilustração e foto | Pessoas reais e diversas (idade, etnia, corpos, deficiência); sem sangue explícito nem agulhas em destaque, para não reforçar o medo (um dos desmotivadores citados por Bednall & Bove, 2011) |
| Microcopy | Segunda pessoa, verbos de ação, frases curtas: "Agendar doação", "Ver meus horários" |
| Gamificação | Medalhas em traço monocromático (petróleo), preenchidas em carmim quando conquistadas; barra de progresso fina; **sem** confete, mascotes ou sons |

## 14.8 Identidade das telas

| Perfil | Dispositivo principal | Tom visual | Telas-chave para o Figma (Checkpoint 1) |
|---|---|---|---|
| Doador | Celular | Acolhedor: mais respiro, ilustrações, carmim nas ações | 1. Página pública · 2. Cadastro · 3. Pré-triagem (pergunta + resultado) · 4. Escolha de horário · 5. Confirmação · 6. Painel "Minha jornada" (próxima data, conquistas, histórico) |
| Profissional | Tablet ou desktop | Funcional: denso, petróleo, foco em velocidade e leitura | 7. Agenda do dia com check-in · 8. Atendimento (triagem simulada) |
| Admin / gestor | Desktop | Analítico: painéis, números tabulares | 9. **SangueConecta do Estoque** · 10. Configuração da grade semanal |

### "SangueConecta do Estoque": a visualização no estilo bolsa de valores

```
┌───────────────────────────────────────────────────────────────────────────┐
│  SangueConecta do Estoque · Unidade Centro · atualizado 14/11 10:32   DADOS FICTÍCIOS │
├───────────┬───────────┬───────────┬───────────┬───────────┬───────────┬─────┤
│ O+   82 ▲2│ O-   18 ▼3│ A+   61 ▲1│ A-   22 ▼1│ B+   35 ═0│ B-    9 ▼2│ ... │
│ ●Adequado │ ▼Crítico  │ ●Adequado │ ◆Atenção  │ ◆Atenção  │ ▼Crítico  │     │
│ ╱╲_╱‾╲_╱‾ │ ‾╲_╲__╲_  │ _╱‾╱‾‾╲╱‾ │ ‾‾╲_╱‾╲_  │ ‾╲_╱‾‾╲_‾ │ ╲_╲__╱╲_  │     │
└───────────┴───────────┴───────────┴───────────┴───────────┴───────────┴─────┘
  Clique num tipo → série de 30 dias, entradas × saídas, linhas de mínimo e ideal
```

- **Cada "ação" é um tipo sanguíneo:** quantidade atual, variação em 24 h (▲ ▼ ═), mini-gráfico (sparkline) de 7 a 30 dias e chip de status (cor + ícone + texto).
- **Ordenação padrão:** primeiro os críticos (o que exige ação aparece primeiro).
- **Faixa superior opcional (ticker):** rolagem lenta e **pausável** (WCAG 2.2.2), com alternativa estática.
- **Detalhe:** gráfico de linha com faixas de fundo para crítico, atenção e adequado, além de barras de entradas e saídas.
- **Acessibilidade:** cada mini-gráfico tem uma tabela equivalente ("ver dados") e um rótulo ARIA ("O negativo: 18 bolsas, crítico, queda de 3 em 24 horas").
- **Aviso fixo "DADOS FICTÍCIOS"** em todas as telas de estoque do protótipo.
