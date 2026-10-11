# MapEngine — inventário completo de funções

Levantamento do que o `MapEngine` (`src/services/MapEngine.js` + `src/services/MapEngine/*`) faz hoje, para guiar a migração das funções para o `<ui-canvas-cad>`.

**Estado atual da integração:** o `<ui-canvas-cad>` é o dono do `L.Map` (ver `CanvasHost.js`); o `MapEngine` continua desenhando e interagindo sobre esse mapa. Cada função abaixo traz o módulo de origem e o que precisa existir no componente quando ela migrar.

Modelo de feição que tudo consome: `{ id, type: 'Point'|'LineString'|'Polygon'|'Circle'|'Text', coordinates [lat,lng] (ou lista/anéis), radius?, layerId, name, category, description, color, style{…}, properties{…}, visible, locked, status, createdBy, createdAt }`.

---

## 1. Ciclo de vida e mapa base

| Função | Onde | O que faz |
|---|---|---|
| Construção | `MapEngine.constructor` | Cria o mapa (via `CanvasHost`, ou `options.mapFactory`), instancia `DrawingEngine`, `VertexEditor`, `FeatureRenderer`, `FeatureHitTester`, `SpatialIndex` e registra os eventos. Recebe callbacks: `onFeatureCreated/Updated/Selected`, `onFeaturesSelected`, `onCursorMove`, `onToolChange`, `onContextMenu`, `onTextPromptRequested`, `onFeatureAction`. |
| `initMap` | `MapEngine` | Centro/zoom inicial (-23.7661, -53.3206, z14), `maxZoom 22`, duplo clique e arrasto com botão esquerdo desligados (o esquerdo é da caixa de seleção), controle de zoom em `bottomright`. |
| `initBaseLayers` / `setBaseLayer(name)` | `MapEngine` | 6 mapas base: `google_satelite_puro`, `google_satelite` (híbrido), `satelite` (Esri), `osm`, `topografia` (OpenTopoMap), `dark` (Esri Dark Gray base + referência). `'none'` remove o base e aplica a classe `cm-no-basemap` (grade pontilhada). Zoom nativo por provedor, `maxZoom 22`. |
| `destroy` | `MapEngine` | Remove listeners de `window`, cancela RAF, destrói sub-motores, cursores remotos, grupos de camada, camada base, índice espacial e libera o mapa/host. |

## 2. Navegação e eventos do mapa (`bindEvents`)

- **Pan com a roda do mouse** (botão do meio): `mousedown/mousemove/mouseup`, `panBy` sem animação, cursor `grabbing`, bloqueia `auxclick`.
- **Caixa de seleção com o botão esquerdo** (só na ferramenta `select`): arrasto > 6 px cria `.cm-selection-box`; ignora controles (`.leaflet-control`, `.cm-map-hud`, `.cm-sidebar`, botões/inputs). Ao soltar, converte a caixa em bounds + caixa em pixels e chama `findFeaturesInBounds` → `handleBoxSelectionResult`. Shift/Ctrl somam à seleção. `_justBoxSelected` (300 ms) impede que o `click` seguinte limpe a seleção.
- **Cursor de coordenadas**: `mousemove` (throttle por `requestAnimationFrame`) → `onCursorMove(latlng)`, `_updateHoverCursor` (classe `cm-feature-hover` quando há feição sob o cursor) e `drawingEngine.handleMouseMove`.
- **Clique**: com ferramenta de desenho → `drawingEngine.handleClick`; em `select` → hit-test unificado → `handleFeatureClick` ou `clearSelection`. `_suppressNextClick` evita duplo tratamento da caneta.
- **Duplo clique** → `drawingEngine.handleDoubleClick` (conclui desenho).
- **Botão direito**: desenhando → conclui (se tem vértices mínimos), desfaz o último vértice ou volta para `select`; em `select` → `onContextMenu({latlng, point, originalEvent, feature})` com a feição sob o cursor.
- **`moveend`/`zoomend`** → `updateViewportCulling()`.
- **Teclado** (`window keydown`, ignora campos de texto, usa `composedPath` por causa do Shadow DOM): `Enter`/`Esc` encerram a edição de vértices; com ferramenta ativa, `Enter`/`Espaço` concluem, `Esc` cancela e volta para `select`, `Ctrl+Z` desfaz vértice.

## 3. Ferramentas de desenho (`DrawingEngine` + helpers)

Máquina de estados com `activeTool` e buffer `drawingPoints`. Ferramentas: `select`, `point`, `text`, `line`, `polygon`, `rectangle`, `ellipse`, `regular-polygon` (hexágono), `star` (5 pontas), `circle`, `pen` (caneta com Bézier), `pen-select` (laço), `split` (faca), `measure` (régua), `eyedropper` (conta-gotas).

| Ferramenta | Comportamento |
|---|---|
| `point` | Um clique cria `Point` (`markerSize 24`, `fillOpacity 1`). |
| `text` | Clique dispara `onTextPromptRequested(latlng)` (o app abre o modal). |
| `line` | Cliques acumulam vértices; prévia tracejada com elástico até o cursor. |
| `polygon` | Idem, com preenchimento; clicar no 1º vértice (snap) fecha. |
| `rectangle` / `ellipse` / `regular-polygon` / `star` | 2 cliques (centro/canto + extremidade); geometria gerada por `ShapeGeometryGenerator` (elipse, hexágono, estrela). Prévia ao vivo. |
| `circle` | Centro + raio em metros (`calculateDistance`); raio mínimo 2 m; cria `Circle` com `radius` arredondado. |
| `pen` | Estilo Illustrator: clique = âncora reta, clique+arraste = âncora curva (alças espelhadas), clicar no 1º ponto (≤10 px) fecha em polígono. `DrawingPenHelper` achata Bézier cúbica em Mercator com tolerância ≈ ½ pixel (0,15 m a 5 m). Resultado: `LineString` ou `Polygon`. |
| `pen-select` | Laço poligonal; ao fechar seleciona (`selectFeatures`) pontos/círculos dentro, e linhas/polígonos com algum vértice ou centroide dentro (`DrawingPenSelectHelper`). |
| `split` | Linha de 2 pontos; `splitFeatureWithLine` corta o polígono selecionado (ou o primeiro cruzado) via `SpatialAlgorithms.splitPolygonWithLine` e dispara `onFeatureSplit`/`onSplitFailed`. |
| `measure` | Régua: marcadores numerados, selo de distância por trecho, tooltip da distância acumulada, polígono tracejado de área quando há ≥3 pontos. `Enter`/“Fixar” cria `LineString` com `properties` (extensão, vértices, trechos, área em ha/m²), cor `#f59e0b` e rótulo. |
| `eyedropper` | Clique faz hit-test e chama `onEyedropperSampled(feat, latlng)`. |

Comuns:
- **Estilos ativos**: `setActiveDrawingStyles` (`strokeColor`, `fillColor`, `fillOpacity`, `strokeWidth`) e `setActiveDrawingLayer(layer)` (define `layerId` e cor padrão).
- **Ordem ao concluir** (regra do `GEMINI.md`): `resetDrawingState()` → `setTool('select')` → `onFeatureCreated(...)`.
- **`undoLastVertex`**, `resetDrawingState`, `finalizeCurrentDrawing`, `isDrawing`, `drawingPoints`.
- **HUD de desenho** (`#cm-cad-hud`): nome da ferramenta, nº de vértices, atalhos, botão de snap, “Concluir/Fixar/Limpar”. Esconde o HUD de seleção durante o desenho.
- Primeiro vértice destacado (verde) com tooltip “Clique para fechar forma”.

## 4. Snapping (`DrawingSnappingHelper`)

- Atração a vértices existentes: raio ≈ 9–10 px (por zoom), busca local de ~32 px no `SpatialIndex` (O(log N)), pré-filtro geográfico antes de projetar pixels.
- Considera vértices de pontos, linhas e polígonos visíveis (de camadas visíveis); no desenho, o 1º vértice para fechar polígono/caneta; na edição, ignora a própria feição.
- Zona neutra: se dois vértices estão a < 18 px, reduz o raio (`≥4 px`, `42%` da distância) para permitir desengatar.
- `Alt` desliga temporariamente; `S`/botão alterna (`setSnappingEnabled`, `toggleSnapping`, callback `onSnappingChange`); marcador de snap `cm-snap`.

## 5. Edição de vértices (`VertexEditor`)

- `startVertexEditing(feature, onUpdated)` / `stopVertexEditing`. Ignora feição `locked`; polígonos com furos/multipartes são recusados (vão para a tabela de vértices do Inspetor) com aviso.
- **Ponto**: alça arrastável única. **Linha/Polígono**: uma alça por vértice (arrastar), **alças-fantasma nos pontos médios** (clique insere vértice), **botão direito exclui** (mínimo 3 em polígono, 2 em linha), snap durante o arrasto.
- Atualiza a geometria Leaflet ao vivo e notifica `onFeatureUpdated` no fim de cada gesto.
- HUD próprio (`#cm-vertex-edit-hud`): nº de nós, **área/extensão/lat-lng ao vivo**, snap, “Concluir”. Esconde/restaura o HUD de seleção.

## 6. Renderização (`FeatureRenderer`, `GeometryLayerBuilder`, `FeaturePopupBuilder`)

- `renderFeatures(features, layers, forceRebuildIndex)`: cópia própria da lista (evita duplicar no array do app), reconstrói o `SpatialIndex` se mudou, cria/remove `L.featureGroup` por camada, remove feições órfãs, reaplica culling e z-index.
- `addFeature` / `updateFeature` / `removeFeature`: atualização incremental (indexa, renderiza só se está no viewport + 20% de folga, e se `GeometryVersionManager` permitir).
- **Tipos → Leaflet**: `Point` → `L.circleMarker` (ou `L.marker` com ícone SVG `tower/tree/warning/water/boundary`), `LineString` → `polyline`, `Polygon` → `polygon`, `Circle` → `L.circle` (metros), `Text` → `L.marker` com `divIcon` (rótulo arrastável, halo opcional, respeita `locked`).
- **Patching in-place** (`patchLeafletLayer`) em vez de recriar; troca de tipo/ícone recria.
- **Estilo** resolvido por feição: `fillColor`, `fillOpacity × opacidade da camada`, `strokeColor`, `strokeWidth`, `strokeDashArray`, `markerIcon/Size/Rotation`, `showLabel/labelField`.
- **Panes por camada**: 4 sub-panes (`poly` base, `line` +2, `point` +4, `text` +6) com z-index por posição na árvore (`410 + (n-1-i)*10`); `reorderLayers`/`updateLayerZIndexes`.
- **Camadas**: `setLayerVisibility`, `setLayerOpacity` (aplica também em marcadores), `setLayerColor` (inclui ícones SVG e ícones de cluster).
- **Rótulos permanentes**: tooltip central com `name`, `category`, `description`, `id`, `area` (ha, pt-BR) ou `extensao` (m/km).
- **Normalização** (`FeatureGeometryUtils.normalizeCoordinates`): aceita `[lat,lng]` e `{lat,lng}`/`{latitude,longitude}`, descarta `NaN/Infinity`, exige ≥3 vértices (polígono) / ≥2 (linha), abre anel fechado duplicado, suporta multianel.
- **Simplificação por zoom** (`GeometrySimplifier`, Douglas-Peucker): tolerância > 0 só até zoom 11; não destrutiva.
- **Versões de geometria** (`GeometryVersionManager`): oficial × prévia (por `status`/`properties.status`/`tipo_geometria`). Prévia só aparece quando não há oficial, ou quando solicitada (global: `setGlobalShowPreviews`/`toggleGlobalShowPreviews`; individual: `toggleIndividualPreview`; consulta: `isFeaturePreviewActive`).

## 7. Culling, clusters e desempenho (`ViewportCullingManager`, `PointClusterEngine`)

- Até 300 feições: mantém tudo carregado (sem pop-in). Acima: consulta o `SpatialIndex` com buffer de 75% da viewport.
- Vetores só re-renderizam se mudou o zoom abaixo de 12 ou com `forceRefresh`.
- **Clusters de pontos**: grade de 55 px, desmembra a partir do zoom 17 ou com ≤ 8 pontos; ícone com contagem/cor; clique aproxima (`fitBounds` com folga) e tooltip “N feições agrupadas”.
- Pontos **selecionados ou em edição nunca entram em cluster**.
- Remove do mapa o que saiu da viewport, ficou oculto, foi apagado (`is_deleted/_deleted/deleted_at`), está em cluster ou pertence a camada oculta. Tudo agendado em `requestAnimationFrame`, com cache de clusters por revisão/zoom.
- **Índice espacial** (`SpatialIndex`, R-Tree `rbush`): `build/insert/update/remove/query/intersects`, bounds por feição (`computeBounds`). Testado com 100 mil feições.

## 8. Seleção e popup

- **Estado**: `selectedFeatureId` (única) e `selectedFeatureIds` (Set).
- **API**: `selectFeature`, `selectFeatures(ids)`, `toggleFeatureSelection`, `clearSelection`, `getSelectedFeatures`, `handleBoxSelectionResult({shift, ctrl})`, `findFeaturesInBounds(bounds, pixelBox)`.
- **Regra de callbacks**: `onFeaturesSelected(lista)` sempre; `onFeatureSelected(feat|null)` **só com ≤ 1 feição** (senão o HUD/painel colapsa para a primeira).
- **Visual de seleção** (`refreshSelectionVisuals`): contorno `#38bdf8`, traço mais grosso, preenchimento +0,18, `bringToFront`; marcadores recebem classe e `drop-shadow`. Lotes > 150 mudanças: processa o que está na tela primeiro e o resto em blocos de 100 por frame.
- **Caixa de seleção (narrow-phase)**: `SpatialAlgorithms.featureIntersectsBounds` exige toque geométrico real (não só bbox); respeita visibilidade de feição/camada e versão de geometria.
- **Hit-test unificado** (`FeatureHitTester`): como cada camada tem seu `<canvas>` do tamanho do mapa, o canvas do topo engoliria os cliques. Os canvases ficam com `pointer-events: none` e o clique é resolvido em pixels sobre todas as camadas: tolerância 6 px (linhas), 4 px (pontos), prioridade ponto/texto > linha > área; pontos e linhas desempatam pela camada do topo, áreas pela menor; **cliques repetidos no mesmo lugar alternam** entre feições empilhadas. Usado também em hover, menu de contexto e conta-gotas. *(No `<ui-canvas-cad>` este é o item que o componente precisa absorver.)*
- **Popup único sob demanda** (`openFeaturePopup`, `refreshFeaturePopup`, `closeFeaturePopup`): card com cor da camada, título, tipo · camada · categoria, descrição, métricas (área/perímetro/extensão/vértices/raio/coordenadas), até 6 atributos (+ “N atributos”), autor/data e ações `Inspecionar`, `Zoom`, `Vértices`, `Copiar` (pontos) via `onFeatureAction`. Auto-pan desvia da barra de seleção, da tabela e do painel lateral (`_rightOverlayPadding`). Fecha quando a seleção deixa de ser exatamente essa feição.

## 9. Câmera

`zoomToFeature(id)` (liga camada/feição ocultas, `flyTo` z≥17 para ponto, `fitBounds` com folga 60), `zoomToFeatures(lista)`, `fitAllFeatures`, `fitLayer(id)` (torna a camada visível). Todos usam `SpatialIndex.computeBounds` e respeitam `maxZoom 18`.

## 10. Geodésia e geometria (delegados)

- `FeatureGeometryUtils`: `calculateDistance`, `calculatePolylineLength`, `calculatePolygonArea` (inclui furos), `calculatePolygonPerimeter`, `calculateBearing`, `calculateSegments`, formatação de comprimento/área, contagem de vértices, anéis.
- `SpatialAlgorithms` (usados por outras telas, não só pelo mapa): `splitPolygonWithLine`, `joinFeatures`/`joinMany` (união de linhas/polígonos, com ponte e tolerância), `generateBuffer`, `duplicateWithOffset`, `simplifyDouglasPeucker`, conversão de unidades, DD ⇄ DMS, `isPointInPolygon`, `segmentIntersectsBox`.

## 11. Colaboração

`updateRemoteCursor(user, latlng)` / `removeRemoteCursor(userId)`: ícone de cursor com nome/cor do operador; nome escapado e cor validada (`#hex`), pois vêm da rede.

## 12. Superfície consumida pelo resto do app

Mais usados fora do motor: `map` (21×), `drawingEngine`, `setTool`, `zoomToFeature`, `updateFeature`, `clearSelection`, `startVertexEditing`, `setBaseLayer`, `selectFeature(s)`, `setActiveDrawingStyles/Layer`, `removeFeature`, `fitAllFeatures`, `renderFeatures`, `updateRemoteCursor`, `toggleSnapping`, `setLayerVisibility/Color/Opacity`, `zoomToFeatures`, `toggleIndividualPreview`, `toggleGlobalShowPreviews`, `reorderLayers`, `fitLayer`, `closeFeaturePopup`, `addFeature`, `destroy`. Hooks atribuídos de fora: `onSplitFailed`, `onFeatureSplit`, `onEyedropperSampled`, `onSnappingChange`. Consumidores: `AppComponentsBuilder`, `AppBootstrapSync`, `AppGeometryCoordinator`, `AppModalsBuilder`, `FeatureSyncController`, `ProjectActionsController`, `ShortcutsController`, `ContextMenu`, `AdvancedSearchPanel`, `FeaturePropertiesAdapter`, `MapImageExporter`.

---

## Mapa de migração para o `<ui-canvas-cad>`

O componente hoje modela **pontos, segmentos, vizinhos e SIGEF** (topografia), não feições genéricas. O que ele já tem e o que falta:

| Função do MapEngine | No `<ui-canvas-cad>` | Situação |
|---|---|---|
| Dono do mapa, pan/zoom, escala | Sim (`getMap()`) | **Já migrado** (`CanvasHost`) |
| Pan com a roda, caixa Window/Crossing | Sim (`CanvasInteracao`), mas só sobre pontos/vizinhos | Desligado; migrar exige que a caixa selecione qualquer feição |
| Camadas com visibilidade/opacidade/z-index | Sim (`CanvasLayerManager`, panes por camada) | Modelo diferente (1 pane por camada, tipos fixos) |
| Hit-test entre camadas empilhadas | Não (cada pane intercepta cliques) | **Falta** — maior ganho de corrigir no componente |
| Feições Point/Line/Polygon/Circle/Text com estilo | Parcial (`plotarPoligonos`, `plotarConexoes`, `plotarPontos`) | Falta Circle, Text, estilo por feição, ícones SVG |
| Desenho (11 ferramentas), caneta Bézier, medição | Não | **Falta** |
| Snapping | Só `magnetSnap` simples | Falta o snap por índice espacial |
| Edição de vértices | Não | **Falta** |
| Seleção múltipla, popup, HUD | Parcial (`ui-ponto-selecionado`, popups de ponto) | Falta seleção de feições e popup de feição |
| Clusters, culling, índice espacial, simplificação por zoom | Não | **Falta** |
| Versões oficial × prévia | Não | **Falta** |
| Cursores remotos | Não | **Falta** |

**Sugestão de ordem** (da menor para a maior dependência): 1) hit-test unificado; 2) feições genéricas (Circle/Text/estilo); 3) seleção + popup; 4) culling/clusters/índice; 5) snapping e edição de vértices; 6) ferramentas de desenho; 7) versões de geometria e cursores remotos.
