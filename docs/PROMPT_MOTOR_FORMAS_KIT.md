Você está no repositório do kit `@thibezer/ui-components-kit` (`D:\Programação\UI_Componentes`). O app ConecteMapas usa o `<ui-canvas-cad>` (build local 2.8.1) por meio do adaptador `CanvasMapEngine`. Medi o app com muitas formas e o gargalo está dentro do kit: **o motor das formas está acoplado ao Leaflet** (um objeto Leaflet por feição, vários canvases por camada). A tarefa é **separar o motor das formas do Leaflet**: um motor sem DOM e sem Leaflet que decide o que desenhar, e um renderizador que só pinta. O Leaflet continua dono do mapa (tiles, pan, zoom, eventos), mas deixa de ter um objeto por forma.

## Antes de começar (obrigatório)
1. **Leia `AGENTS.md` inteiro** e siga o Definition of Done (camadas L0→L5 com `npm run check:layers`, Regra #0 "Never Crash", SSR-safety, `ListenerBag`, teste primeiro, `*.regressao.test.ts` para bug corrigido, zero `any`, `tests/tipos/react.tsx` e `vue.ts`, JSDoc para o `custom-elements-manifest`). Leia também `docs/desempenho-feicoes.md`, `docs/canvas-cad-eventos.md`, `docs/plano-migracao-canvas-cad.md` e `src/gerencigeo-canvas/README.md`.
2. **Base de trabalho.** O checkout principal está no branch `feat/barra-ferramentas-pendencias` (2.6.0, com alterações não commitadas de outra frente): **não use nem altere esse checkout**. O que o app usa (2.8.1: `aplicarLote`, `oculta`, popups sob demanda, `ui-linha`) está no branch `claude/layers-component-usability-09772c` (commit `7b912fb`, hoje no worktree `.claude/worktrees/hostinger-plugin-install-548fbb`). Crie um worktree novo a partir dele, com o branch `feat/motor-formas`, e trabalhe lá. Não faça merge com `main` (2.7.0) nem com `claude/polish-text-components-1fdd98` (outra linha 2.8.1, com `ui-area-texto`): reconciliar linhas é decisão minha.
3. Não faça commit nem publique no npm (isso fica comigo). Nada que o app usa pode mudar de assinatura (lista no fim). Tudo novo é opt-in até a Fase 4.

## Regras de trabalho
- Uma fase por vez, nesta ordem. A cada fase: testes primeiro (vitest), código, `docs/` (incluindo `docs/desempenho-feicoes.md`), `README` do módulo, JSDoc de atributos/eventos novos e `CHANGELOG` ("Não lançado", com "Mudanças de comportamento").
- Fase concluída = `npx tsc --noEmit`, `npm run check:layers`, `tests/ssr-safety.test.ts`, `npx vitest run` inteiro e `npm run test:tipos` verdes, e a tabela de benchmark da fase no relatório. Ao final: `npm run build`.
- Estilo do código vizinho (português; `feature_*.ts`/`layer_*.ts` puros, `cad-*.ts` de orquestração; eventos `cad-*`).
- Relatório curto por fase: o que mudou, números antes/depois, decisões tomadas sozinho, o que não conseguiu.

## O que medi (reproduza com o benchmark descrito abaixo)
Dados sintéticos: 50% polígonos de 14 vértices (~90 m), 25% linhas de 8 vértices, 25% pontos, 5 camadas, bloco de ~13 km, sem mapa base. Tempo por **mudança de vista** (pan + reconciliação + redesenho dos canvases, forçado de forma síncrona), no navegador, máquina de desenvolvimento de 12 threads. Zoom 12 = todas as formas na tela.

| Formas | zoom 12 | zoom 15 | zoom 18 |
|---|---|---|---|
| 0 (piso) | ~50 ms | – | – |
| 1 000 | ~100 ms | ~70 ms | – |
| 5 000 | ~275 ms | ~130 ms | ~80 ms |
| 10 000 | ~750 ms | ~460 ms | ~100 ms |
| 20 000 | ~1,4 s | ~0,7 s | ~100 ms |
| 50 000 | ~3,4 s | ~0,7 s (z16) | – |

Outras medidas (20 mil formas, zoom 14): selecionar 1 feição ~100 ms síncronos; limpar uma seleção de 2 000 ~400 ms; `ui-camadas.definirCamadas` 100–250 ms por chamada, com ~11,5 mil nós no shadow DOM mesmo com poucas feições. Com 20 mil formas no zoom 12 havia ~15 300 camadas Leaflet vivas e 15 canvases em tela cheia. Custo linear, ~70 µs por forma visível.

**Por que o kit não viu isso:** as medições de `docs/desempenho-feicoes.md` rodam em Node + happy-dom, sem canvas real, e dizem que "o custo de desenhar fica por conta do Leaflet". Edição unitária e `aplicarLote` já são O(mudanças) desde a 2.1.0 e **não fazem parte desta tarefa**; o que falta é o custo de **desenhar e reconciliar a vista**.

Onde está o custo (branch base; `src/gerencigeo-canvas/`):
1. `renderers/feicoes_renderer.ts`, `materializar`/`criar`/`ligarEventos`: cada feição visível vira um `L.Polygon`/`L.Polyline`/marcador com eventos e `addLayer`/`removeLayer`.
2. Mesmo arquivo, `reconciliar` e `reconciliarParcial`: culling só por caixa da vista + `FOLGA_VIEWPORT = 0.75`, e só acima de `LIMITE_CULLING = 300` feições. **Não há corte por tamanho em pixels**: um polígono de 2 px custa o mesmo que um de 500 px. `feature_simplificacao.ts` só age com `MIN_VERTICES_SIMPLIFICAR = 40` vértices e abaixo do zoom `ZOOM_SEM_SIMPLIFICACAO = 12`.
3. `aplicarSelecao` termina chamando `reconciliar` da camada inteira: selecionar ou limpar a seleção custa O(visíveis) em vez de remendar só quem mudou de estado.
4. `layer_pane_ops.ts` cria um pane por camada e subpanes por tipo; cada pane tem seu canvas Leaflet. Com 5 camadas são 15 canvases do tamanho da vista, todos limpos e repintados a cada redesenho.
5. `ui-camadas` reconstrói a árvore inteira a cada `definirCamadas`/`definirFeicoes`, sem virtualização nem atualização incremental de contagens.

**O que ainda passa pelo Leaflet por feição** (inventário para a separação; confirme no código): evento `click` por camada (`ligarEventos` → `onLayerAction('feicao-clique')`), arraste de marcador de `Text` (`feicao-movida`), `bindTooltip` de rótulos e de clusters, `bringToFront` na seleção, popup (`feature_popup.ts`), o mapa `entradas` consumido por `cad-feicoes-consulta/-edicao/-versoes`, `feature_desenho_controle.ts`, `layer_defaults.ts`, curvas (`feature_curvas.ts`, `curva_leaflet.ts`) e as alças do editor de vértices. **Já são do mapa, não da camada:** hover, menu de contexto e hit-test (`PonteiroFeicoes` + `feicaoSob`, `layer_hit_test.ts`), seleção por caixa/laço e snap sobre o índice. Só o `FeicoesLayerRenderer` (camadas do tipo `feicoes`) está no escopo; os renderers de tiles, WMS, grade e `vector_*` não mudam.

## Arquitetura alvo
Três camadas, de baixo para cima. Só a de cima conhece o Leaflet.

1. **Motor das formas (headless, `src/gerencigeo-canvas/motor/`, L2).** Sem `window`, `document` nem `L`; importável em Node/SSR e rodável em Web Worker. Adicione ao `scripts/check-layers.mjs` (ou a um teste) a regra "nada em `motor/` importa `leaflet` nem usa DOM", e cubra no `ssr-safety.test.ts`.
   - Guarda as feições por camada e o índice espacial (`IndiceEspacial`, `AgrupadorCluster`, `feicaoNoPonto` já são puros e são reaproveitados).
   - Recebe uma **vista** (`{ caixa, zoom, larguraPx, alturaPx, dpr }`) e uma projeção própria Web Mercator (não use `map.project`) e devolve uma **lista de desenho** por camada, na ordem de empilhamento, com LOD aplicado: `{ camadaId, id, forma, geometriaEmPx, estilo, selecionada, destaque? }`.
   - **Regras de LOD (precisas, não deixe a decisão para mais tarde):**
     - Use a **diagonal da caixa em px**, não a área (uma linha longa e fina tem área ~0 e deve continuar visível).
     - Feição cuja diagonal fica abaixo de ~3 px **não é descartada**: vira uma marca de 1–2 px na cor do preenchimento/contorno, **desenhada em lote por cor** (`fillRect`). O mapa não pode ficar "furado": numa carta cadastral com milhares de glebas pequenas, o operador precisa ver a densidade. Acima desse limite, Douglas-Peucker com tolerância em **px** (não em graus) para qualquer feição acima de ~8 vértices.
     - **Sempre em detalhe completo**: feição selecionada, sob o mouse, em edição, com rótulo visível ou em par oficial × prévia ativo.
     - **Hit-test, snap, caixa e laço usam a geometria original** (índice + `feicaoNoPonto`), nunca a lista de desenho: uma feição de 1 px continua clicável.
     - Ponto nunca é cortado por tamanho (já tem a regra de cluster); linha de 1 px nunca some.
   - Cache por feição da geometria projetada e simplificada por zoom (chave: id + revisão + zoom), invalidado pela revisão da feição. No pan puro só se translada, sem reprojetar.
   - Entrada hostil (Regra #0): `NaN`, `Infinity`, geometria degenerada, ids duplicados e camadas inexistentes não podem lançar; testes adversariais em `*.regressao.test.ts`.
2. **Renderizador (`RenderizadorFormas`, interface pequena):** `desenhar(lista, vista, opcoes)`, `destacar(ids)`, `limpar()`, `destruir()`.
   - Padrão: **um canvas Canvas 2D** para os vetores de todas as camadas (substitui os 15), pintado em ordem de camada/`zIndex`, com `Path2D` cacheado por feição+zoom, `devicePixelRatio`, e pintura em lotes por estilo igual. Um segundo canvas leve (overlay) só para seleção, hover e edição, para selecionar não repintar a base.
   - **Opacidade da camada é opacidade de grupo** (como o pane do Leaflet hoje: sobreposições dentro da camada não se somam). Para camada com opacidade < 1, pinte num canvas fora da tela e componha com `globalAlpha`; com opacidade 1, pinte direto.
   - **Decisão de projeto (documente no CHANGELOG):** ponto com ícone SVG, `Text` (selo/halo), marcador de cluster e rótulos permanentes continuam **marcadores DOM** (no pane de marcadores, limitados à vista e ao LOD), porque dependem de CSS e de arraste. Consequência: marcadores ficam sempre acima dos vetores, em vez de intercalados por camada como hoje. Se isso for inaceitável, a alternativa é um canvas por camada (5 em vez de 15); escolha, justifique e meça.
   - Curvas (`feature_curvas.ts`, `curva_leaflet.ts`): na Fase 3 podem continuar no caminho Leaflet legado dentro do mesmo renderer (híbrido). Marque como pendência explícita, não como "feito".
3. **Ponte com o Leaflet (`cad-leaflet-formas.ts`, fina, L4):** um único `L.Layer` customizado que cria os canvases, escuta `move`/`moveend`/`zoom`/`zoomend`/`resize` (inscrições via `ListenerBag`, limpas no `disconnectedCallback`), calcula a vista de `map.getBounds()/getZoom()/getSize()`, chama motor e renderizador e leva os eventos do ponteiro ao motor. No pan, desloca o canvas por CSS e repinta ao fim; no zoom animado, escala o canvas e repinta ao fim. O popup deixa de ser ancorado a uma camada Leaflet da feição e abre numa coordenada (`L.popup` avulso), mantendo `popups` (`sob-demanda`/`automatico`/`desligado`).
   - O clique na feição passa a vir do hit-test do mapa; `bloqueada`/`interativo:false` não captura clique nem hover; ferramentas de desenho têm prioridade sobre seleção (hoje o Leaflet faz isso por propagação). O app define `.leaflet-pane > canvas { pointer-events: none !important }` e muda o cursor por uma classe do contêiner a partir do evento `cad-feicao-hover`: os canvases novos não podem depender de `leaflet-interactive` nem capturar ponteiro.

Opt-in: atributo/propriedade `renderizador="leaflet" | "canvas"` (padrão `leaflet` até a Fase 4). Os dois caminhos passam na mesma suíte de comportamento.

## Estratégia de testes (o ambiente é Node + happy-dom, sem Canvas 2D real)
- **Motor:** testes puros e de propriedade (a lista de desenho de uma vista contém exatamente as feições que cruzam a caixa e passam no LOD; resultado igual com e sem cache; hit-test idêntico antes e depois do LOD). Orçamentos duros em `tests/feicoes-desempenho.test.ts` (limites folgados para CI lenta, como o resto do arquivo).
- **Renderizador:** contexto 2D falso que **grava as chamadas** (ordem, estilos, `globalAlpha`, número de `fill`/`stroke`) para testar lógica de pintura. Não prometa pixel diff em vitest. Se quiser comparação de pixels, proponha a devDependency (`@napi-rs/canvas` ou Playwright) e me peça aprovação antes de instalar.
- **Equivalência:** estenda o padrão de `tests/feicoes-lote.test.ts` ("renderizador incremental = completo"): sequências aleatórias de lotes, seleção no meio, travessia do limite de 300, oficial × prévia, `oculta` × `excluida`, e os dois renderizadores (`leaflet` e `canvas`) comparados pela lista de desenho.
- **Comportamento do kit atual (Fase 0):** caracterize antes de mexer: z-order por camada/`zIndex`, opacidade, `oculta` × `excluida`, regra oficial × prévia, popups sob demanda, seleção (clique, Window/Crossing, laço, aditiva), snap, edição de vértices, DPR.
- **Benchmark no navegador:** no playground (`pagina_testes.ts`, `npm run dev`), com o mesmo gerador de dados (semente fixa, mesma proporção de tipos e vértices). O app tem `tools/bench_mapa_formas.js` (cole no console com `?project=bench_perf`); use a mesma metodologia: **mudança de vista com redesenho forçado de forma síncrona** (canal de mensagens em vez de `requestAnimationFrame`, e `getImageData` para esperar a rasterização), porque o painel estrangula o rAF quando a janela perde o foco e os tempos saem falsos. Rode com a janela em foco, sem mapa base, em 1 mil, 5 mil, 20 mil, 50 mil e 100 mil formas, nos zooms 12, 15 e 18, mais as operações pontuais (selecionar 1, selecionar 2 000, limpar, ocultar/exibir camada).

## Fases
**Fase 0 — Benchmark e rede de segurança.** Benchmark no playground, tabela "antes" e a caracterização acima. Nenhuma mudança de comportamento.

**Fase 1 — Ganhos dentro da arquitetura atual (pode ser lançada sozinha como 2.9.0).**
- `aplicarSelecao` não chama `reconciliar` da camada inteira: remenda só as feições cujo estado de seleção mudou e reconcilia apenas se a seleção mudar o conjunto desenhado (ex.: ponto dentro de cluster).
- Corte por tamanho em px em `reconciliar`/`materializar`, com as regras de LOD acima (marca de 1–2 px em vez de descarte), reavaliado ao mudar de zoom por faixa, não a cada pan. Simplificação por tolerância em px abaixo de 40 vértices e acima do zoom 12.
- **Não consolide os canvases nesta fase** (é trabalho descartável diante da Fase 3).
- Meta: 20 mil formas no zoom 12 com mudança de vista ≤ 250 ms; selecionar 1 feição ≤ 20 ms síncronos.

**Fase 2 — Motor headless.** Extraia o motor (item 1 da arquitetura) com `Vista` → `ListaDesenho`, testado só com vitest, sem DOM.

**Fase 3 — Renderizador Canvas e ponte Leaflet, atrás de `renderizador="canvas"`.** Paridade visual com o caminho Leaflet: estilos, tracejado, círculo em metros (raio em px por zoom e latitude), seleção, hover, edição de vértices (alças continuam `L.Marker` no overlay), versões oficial × prévia, `oculta`. Liste no relatório o que ficou no caminho híbrido (curvas, marcadores DOM).

**Fase 4 — Novo caminho como padrão.** Só quando a suíte de comportamento e o benchmark passarem nos dois caminhos. Troque o padrão, mantenha `renderizador="leaflet"` por uma versão como escape e depois remova `materializar`/`ligarEventos` por feição. Mudar o padrão é mudança de comportamento (z-order de marcadores, popup ancorado): proponha a versão (major ou minor) e justifique.

## Metas (orçamento; máquina de desenvolvimento de 12 threads, navegador, sem mapa base)
| Cenário | Hoje | Meta |
|---|---|---|
| Pan (arraste) | repinta ao fim | deslocamento por CSS, 0 repintura durante o arraste |
| Hover / hit-test | já map-level | ≤ 16 ms (AGENTS.md, Camada E), em 100 mil feições |
| Mudança de vista, 50 mil formas, zoom 12 | ~3,4 s | ≤ 100 ms |
| Mudança de vista, 100 mil formas, zoom 12 | não medido | ≤ 200 ms |
| Mudança de vista, 20 mil formas, zoom 12 | ~1,4 s | ≤ 60 ms |
| Selecionar 1 feição (20 mil) | ~100 ms síncronos | ≤ 5 ms |
| Selecionar / limpar 2 000 feições | 250–400 ms | ≤ 30 ms |
| Memória por forma visível | 1 objeto Leaflet + eventos | só dados + cache de `Path2D` |
| Canvases por mapa | 15 (5 camadas) | 2 (base + overlay) |

Edição unitária e `aplicarLote` já cumprem o orçamento (`docs/desempenho-feicoes.md`): não podem regredir (os testes atuais são o piso).

## `ui-camadas` (item separado, fora do motor)
- `definirCamadas`/`definirFeicoes` com diff: atualizar contagens e linhas alteradas sem reconstruir os ~11,5 mil nós; árvore virtualizada (só as linhas visíveis no DOM). O app chama a cada criação, edição e exclusão.
- API sugerida: `atualizarContagens({ [camadaId]: n })` e `definirFeicoes(feicoes, { incremental: true })`. Meta: ≤ 10 ms para atualizar uma contagem, independente do número de feições.
- Pode ser entregue antes das fases do motor.

## O que o app usa hoje e não pode mudar
Métodos: `definirFeicoes`, `adicionarFeicao`, `atualizarFeicao`, `removerFeicao`, **`aplicarLote`** (toda sincronização do adaptador), `obterFeicoes`, `selecionarFeicoes`, `alternarSelecaoFeicao`, `limparSelecaoFeicoes`, `fecharPopupFeicao`, `definirFerramenta`, `definirCamadaDesenho`, `definirEstiloDesenho`, `definirSnap`, `definirAtalhoSnap`, `editarVertices`, `pararEdicaoVertices`, `zoomParaFeicao(s)`, `ajustarTudo`, `ajustarCamada`, `definirPreviasGlobais`, `alternarPrevia`, `previaSolicitada`, `atualizarCursorRemoto`/`removerCursorRemoto`, `definirMargensPopup`, `definirMargensHud`, `nosDesenho`, `desfazerVerticeDesenho`, `limparMedicao`, `getLayerManager()` (`setLayerVisibility`, `setLayerOpacity`, `setLayerZIndex`, `setLayerBlocked`, `getLayerDef`), `getMap()`, `setLayerVisibility`, `destroy`, e ainda `initCAD`/`initTimeout` (o app não migrou para `inicializarAgora`; mantenha os dois).
Eventos: `cad-selecao`, `cad-feicao-selecionada`, `cad-feicao-criada`, `cad-feicao-atualizada`, `cad-feicao-acao`, `cad-feicao-menu`, `cad-feicao-hover`, `cad-medicao`, `cad-feicao-dividida`, `cad-divisao-falhou`, `cad-conta-gotas`, `cad-ferramenta`, `cad-snap`, `cad-edicao-concluida`, `cad-edicao-recusada`, `cad-desenho-recusado`.
Campos de `Feicao`: `id`, `geometria`, `estilo`, `propriedades`, `bloqueada`, `excluida`, **`oculta`** (feição oculta não desenha nem seleciona, mas continua existindo e editável), `status`, `entidadeId`, `camadaId`.
O app exporta PNG desenhando as feições **a partir dos dados** (não lê canvases do Leaflet), então a troca de renderizador não o afeta. Só `tools/bench_mapa_formas.js` lê `map._layers` e os renderers do Leaflet; no caminho `canvas` ele precisa de um contador público: exponha `estatisticas(camadaId)` com `materializadas`, `desenhadas`, `marcasLOD`, `clusters` e `canvases`.

## Entrega esperada
1. Código + testes + docs por fase, com todos os gates do `AGENTS.md` verdes e `npm run build` ok.
2. Tabela de benchmark antes/depois por fase e o relatório final (o que mudou, arquivos principais, decisões tomadas, o que ficou de fora e por quê).
3. Versão sugerida por fase (Fase 1 = 2.9.0; renderizador opt-in = minor; padrão novo = decisão justificada) e os comandos exatos de publicação e de atualização no app (`npm install @thibezer/ui-components-kit@<versão>`), sem publicar.
