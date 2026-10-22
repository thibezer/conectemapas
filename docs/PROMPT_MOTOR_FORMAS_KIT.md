Você está no repositório do kit `@thibezer/ui-components-kit` (D:\Programação\UI_Componentes). O app ConecteMapas usa o `<ui-canvas-cad>` (v2.8.1) por meio do adaptador `CanvasMapEngine`. Medi o app com muitas formas e o gargalo está dentro do kit: **o motor das formas está acoplado ao Leaflet** (uma camada Leaflet por feição). O objetivo desta tarefa é **separar o motor das formas do Leaflet**: um motor sem DOM e sem Leaflet que decide o que desenhar, e um renderizador que só pinta. Leaflet continua dono do mapa (tiles, pan, zoom, eventos), mas deixa de ter um objeto por forma.

Não faça commit nem publique no npm (isso fica comigo). Nada que o app usa pode mudar de assinatura (lista no fim). Tudo novo é opt-in até a Fase 4.

## Regras de trabalho
- Uma fase por vez, nesta ordem. A cada fase: código, testes (vitest), benchmark (ver "Benchmark"), `docs/` e `CHANGELOG` ("Não lançado", com "Mudanças de comportamento").
- Antes de dar uma fase por concluída: `npx tsc --noEmit` limpo, `npx vitest run` inteiro verde e a tabela de benchmark da fase colada no relatório. Ao final: `npm run build`.
- Estilo do código vizinho (português, módulos `feature_*.ts` puros + `cad-*.ts` de orquestração, eventos `cad-*`).
- Relatório curto por fase: o que mudou, números antes/depois, decisões que você tomou sozinho, o que não conseguiu.

## O que medi (reproduza com o benchmark abaixo)
Dados sintéticos: 50% polígonos de 14 vértices (~90 m), 25% linhas de 8 vértices, 25% pontos, 5 camadas, bloco de ~13 km. Tempo por **mudança de vista** (pan + reconciliação + redesenho dos canvases, forçado de forma síncrona). Zoom 12 = todas as formas na tela.

| Formas | zoom 12 | zoom 15 | zoom 18 |
|---|---|---|---|
| 0 (piso) | ~50 ms | – | – |
| 1 000 | ~100 ms | ~70 ms | – |
| 5 000 | ~275 ms | ~130 ms | ~80 ms |
| 10 000 | ~750 ms | ~460 ms | ~100 ms |
| 20 000 | ~1,4 s | ~0,7 s | ~100 ms |
| 50 000 | ~3,4 s | ~0,7 s (z16) | – |

Outras medidas (20 mil formas, zoom 14): selecionar 1 feição ~100 ms síncronos e limpar uma seleção de 2 000 ~400 ms; `ui-camadas.definirCamadas` ~100–250 ms por chamada, com ~11,5 mil nós no shadow DOM, mesmo com poucas feições. Com 20 mil formas no zoom 12 havia ~15 300 camadas Leaflet vivas e 15 canvases em tela cheia (um por pane).

Custo linear, ~70 µs por forma visível. Onde ele está (arquivo `dist/canvas.js` da 2.8.1; use os nomes do código-fonte TS correspondentes):
1. `materializar` (≈L1961): cada feição visível vira um `L.Polygon`/`L.Polyline`/marcador com eventos (`ligarEventos`) e `addLayer`/`removeLayer`. Memória e CPU por forma, e redesenho de todos os objetos a cada `moveend`/`zoomend`.
2. `reconciliar` (≈L2007–2063): culling só por caixa da vista + 75% de margem (`Ke = 0.75`) e só quando a camada tem mais de 300 feições (`Ye = 300`). **Não há corte por tamanho em pixels**: um polígono de 2 px custa o mesmo que um de 500 px. A simplificação (`simplificarGeometria`) só age com ≥ 40 vértices (`MIN_VERTICES_SIMPLIFICAR`) e só abaixo do zoom 12 (`ZOOM_SEM_SIMPLIFICACAO`).
3. `aplicarSelecao` (≈L2150–2180) termina chamando `reconciliar(t, o, !1, null)`: selecionar ou limpar a seleção reconcilia a camada inteira (O(visíveis)), em vez de remendar só as feições que mudaram de estado.
4. Um canvas por pane (15 no app): cada redesenho limpa e repinta N canvases do tamanho da vista.
5. `ui-camadas`: reconstrói a árvore inteira a cada `definirCamadas`/`definirFeicoes`, sem virtualização nem atualização incremental de contagens.

## Arquitetura alvo
Três camadas, de baixo para cima. Só a de cima conhece Leaflet.

1. **Motor das formas (headless, `gerencigeo-canvas/motor/`)**: sem `window`, `document` nem `L`. Roda em Node/vitest e em Web Worker.
   - Guarda as feições por camada (o que `cad-feicoes-dados` já faz) e o índice espacial (`IndiceEspacial`, já puro).
   - Recebe uma **vista** (`{ caixa, zoom, larguraPx, alturaPx, dpr }` e uma função de projeção `latlng → px de mundo` própria, Web Mercator; não use `map.project`) e devolve uma **lista de desenho**: `ListaDesenho = { camadaId, id, forma, geometriaEmPx, estilo, selecionada, rotulo? }[]` por camada, já em ordem de empilhamento, com LOD aplicado.
   - LOD por tamanho em pixels: caixa da feição < `limitePx` (padrão 1,5–2 px) não entra; 2–6 px vira ponto/quadradinho do tamanho do envelope; Douglas-Peucker com tolerância em px (não em graus) para qualquer contagem de vértices acima de ~8; linhas finas sub-pixel somem. Clusters de pontos continuam (`AgrupadorCluster` já é puro) e a regra vale também para polígonos pequenos agrupáveis, se ficar simples.
   - Hit-test (`feicaoNoPonto`, já puro), seleção por clique/caixa Window×Crossing/laço, snap e candidatos de edição trabalham sobre o índice + a vista, sem tocar em objeto Leaflet. A seleção é um conjunto de ids; marcar/desmarcar custa O(alterados) e só pede repintura da camada de destaque.
   - Cache por feição da geometria projetada/simplificada por zoom (chave: id + revisão + zoom inteiro), invalidado por revisão da feição. Nada de reprojetar tudo a cada pan: no pan puro só se translada.
   - `aplicarLote` O(mudanças) (hoje a camada inteira é regravada), com `aposDados` uma vez.
2. **Renderizador (`RenderizadorFormas`, interface pequena)**: `desenhar(lista, vista, opcoes)`, `destacar(ids)`, `limpar()`, `destruir()`. Implementação padrão **Canvas 2D único** (um só `<canvas>` para todas as camadas de feições, pintado em ordem de camada/zIndex/opacidade, com `Path2D` cacheado por feição+zoom, `devicePixelRatio`, pintura em lotes por estilo igual para reduzir `fillStyle`/`strokeStyle`). Um segundo canvas leve só para seleção/hover/edição de vértices (overlay), para selecionar não repintar a base. Opcional e depois: `OffscreenCanvas` num worker.
3. **Ponte com o Leaflet (`cad-leaflet-formas.ts`, fina)**: um único `L.Layer` customizado que cria o canvas, escuta `move`/`moveend`/`zoom`/`zoomend`/`resize`, calcula a vista a partir de `map.getBounds()/getZoom()/getSize()`, chama o motor e o renderizador, e traduz eventos do ponteiro (`click`, `dblclick`, `mousemove`, `contextmenu`) para o motor. Durante o pan, desloca o canvas por CSS (como o Leaflet faz) e só repinta ao fim; durante o zoom animado, escala o canvas e repinta ao fim. Os tiles e o resto do mapa não mudam.

Opt-in: atributo `renderizador="leaflet" | "canvas"` (padrão `leaflet` até a Fase 4) e propriedade equivalente. Os dois caminhos devem passar na mesma suíte de comportamento.

## Fases
**Fase 0 — Benchmark e rede de segurança.** Coloque o benchmark em `bench/` (ver abaixo), rode e cole a tabela "antes". Escreva testes de caracterização do comportamento atual que a migração não pode perder: z-order por camada/zIndex, opacidade da camada, `oculta` × `excluida`, regra oficial × prévia, popups sob demanda, seleção (clique, Window/Crossing, laço, aditiva), snap, edição de vértices, versões, DPR.

**Fase 1 — Ganhos dentro da arquitetura atual (sem mexer no desenho).**
- `aplicarSelecao` não chama `reconciliar` da camada inteira: remenda só as feições cujo estado de seleção mudou e reconcilia apenas se a seleção mudar o conjunto desenhado (ex.: ponto dentro de cluster).
- Corte por tamanho em pixels em `reconciliar`/`materializar` (feição cuja caixa em px < limite não é materializada; reavaliar ao mudar de zoom por faixa, não a cada pan). Simplificação por tolerância em px também abaixo de 40 vértices e acima do zoom 12.
- Reduzir de 15 canvases para o mínimo (um renderer compartilhado por tipo de geometria, ou um só) e confirmar que `z-index` entre camadas continua certo.
- Meta da fase: com 20 mil formas no zoom 12, mudança de vista ≤ 250 ms; selecionar 1 feição ≤ 20 ms síncronos.

**Fase 2 — Motor headless.** Extraia o motor (item 1 acima) com a interface `Vista` → `ListaDesenho`, testado só com vitest, sem DOM. Projeção, LOD, cache por revisão, hit-test, caixa/laço, snap e seleção sobre ele. Testes de propriedade: a lista de desenho de uma vista contém exatamente as feições que cruzam a caixa e passam no LOD; resultado igual com/sem cache.

**Fase 3 — Renderizador Canvas e ponte Leaflet (atrás de `renderizador="canvas"`).** Implemente `RenderizadorFormas` em Canvas 2D único + overlay, e o `L.Layer` fino. Paridade visual com o caminho Leaflet (estilos, tracejado, ícones SVG, rótulos, clusters, texto com selo, círculo em metros, curvas). Pan sem repintar. Teste de imagem (pixel diff com tolerância) nos casos principais.

**Fase 4 — Tornar o novo caminho padrão e remover o antigo.** Quando a suíte de comportamento e o benchmark passarem nos dois, troque o padrão para `canvas`, mantenha `renderizador="leaflet"` por uma versão como escape, depois remova `materializar`/`ligarEventos` por feição. Medições finais no CHANGELOG.

## Metas (orçamento, máquina de desenvolvimento de 12 threads)
| Cenário | Hoje | Meta |
|---|---|---|
| Mudança de vista, 50 mil formas, zoom 12 | ~3,4 s | ≤ 100 ms |
| Mudança de vista, 20 mil formas, zoom 12 | ~1,4 s | ≤ 60 ms |
| Selecionar 1 feição (20 mil) | ~100 ms síncronos | ≤ 5 ms |
| Selecionar/limpar 2 000 feições | 250–400 ms | ≤ 30 ms |
| Editar 1 feição (100 mil na camada) | O(N) | tempo constante |
| `aplicarLote` com 5 000 mudanças | regrava a camada | O(5 000) |
| Memória por forma visível | 1 objeto Leaflet + eventos | só dados + cache de Path2D |

## `ui-camadas` (item separado, fora do motor)
- `definirCamadas`/`definirFeicoes` com diff: atualizar contagens e linhas alteradas sem reconstruir os ~11,5 mil nós; árvore virtualizada (só as linhas visíveis no DOM). Hoje cada chamada custa 100–250 ms e o app chama a cada criação/edição/exclusão.
- API nova sugerida: `atualizarContagens({ [camadaId]: n })` e `definirFeicoes(feicoes, { incremental: true })`.
- Meta: ≤ 10 ms para atualizar uma contagem, independente do número de feições.

## Benchmark (entregue junto)
O app tem `tools/bench_mapa_formas.js` (cole no console com `npm run dev` rodando e abra `?project=bench_perf`). Ele mede por mudança de vista sem depender de `requestAnimationFrame` (o painel estrangula o rAF quando a janela perde o foco). Crie em `bench/` do kit um equivalente que rode no playground com o mesmo gerador de dados (semente fixa, mesma proporção de tipos e vértices) e imprima a mesma tabela, para comparar kit isolado × app. Rode em 1 mil, 5 mil, 20 mil e 50 mil formas, nos zooms 12, 15 e 18, e inclua as operações pontuais (selecionar 1, selecionar 2 000, limpar, editar 1, ocultar/exibir camada).

## O que o app usa hoje e não pode mudar
Métodos: `definirFeicoes`, `adicionarFeicao`, `atualizarFeicao`, `removerFeicao`, **`aplicarLote`** (usado pelo adaptador em toda sincronização), `obterFeicoes`, `selecionarFeicoes`, `alternarSelecaoFeicao`, `limparSelecaoFeicoes`, `fecharPopupFeicao`, `definirFerramenta`, `definirCamadaDesenho`, `definirEstiloDesenho`, `definirSnap`, `definirAtalhoSnap`, `editarVertices`, `pararEdicaoVertices`, `zoomParaFeicao(s)`, `ajustarTudo`, `ajustarCamada`, `*Previa*`, `atualizarCursorRemoto`/`removerCursorRemoto`, `definirMargensPopup`, `definirMargensHud`, `nosDesenho`, `desfazerVerticeDesenho`, `limparMedicao`, `getLayerManager()` (`setLayerVisibility`, `setLayerOpacity`, `setLayerZIndex`, `setLayerBlocked`, `getLayerDef`), `getMap()`, `initCAD`/`initTimeout` (ainda privados, o app os usa), `setLayerVisibility`, `destroy`.
Eventos: `cad-selecao`, `cad-feicao-selecionada`, `cad-feicao-criada`, `cad-feicao-atualizada`, `cad-feicao-acao`, `cad-feicao-menu`, `cad-feicao-hover`, `cad-medicao`, `cad-feicao-dividida`, `cad-divisao-falhou`, `cad-conta-gotas`, `cad-ferramenta`, `cad-snap`, `cad-edicao-concluida`, `cad-edicao-recusada`, `cad-desenho-recusado`.
Campos de `Feicao`: `id`, `geometria`, `estilo`, `propriedades`, `bloqueada`, `excluida`, **`oculta`** (o app passou a usar: feição oculta não desenha nem seleciona, mas continua existindo e editável), `status`, `entidadeId`, `camadaId`.
O app acessa também `map._layers` e renderers do Leaflet **apenas no benchmark**, não em produção; no caminho `canvas` o benchmark deve cair num contador próprio (`estatisticas(camadaId)` com `materializadas`/`desenhadas`/`clusters`) que você expõe publicamente.

## Entrega esperada
1. Código + testes + docs por fase, `tsc` e `vitest` verdes, `npm run build` ok.
2. Tabela de benchmark antes/depois por fase e o relatório final (o que mudou, arquivos principais, decisões tomadas, o que ficou de fora e por quê).
3. Versão sugerida (minor por fase, major só se algum comportamento do padrão mudar) e os comandos exatos de publicação e de atualização no app (`npm install @thibezer/ui-components-kit@<versão>`), sem publicar.
