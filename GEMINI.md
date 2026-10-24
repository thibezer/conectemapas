# Regras Arquiteturais e Padrões ConecteMapas (GEMINI.md)

Este documento registra as decisões de engenharia, arquitetura e salvaguardas contra regressões no projeto **ConecteMapas**.

---

## 1. Persistência de Dados e Ciclo de Vida do Estado (StorageService)
- **Nunca fazer fallback para mock quando o array estiver vazio (`[]`)**:
  - `Array.isArray(saved.features)` deve ser respeitado diretamente. Se o usuário apagou tudo ou carregou um projeto limpo, o estado deve permanecer `[]`, e não voltar aos `DEFAULT_FEATURES`.
- **Persistência Dupla Local**:
  - Manter gravação síncrona no `LocalStorage` para velocidade e assíncrona no `IndexedDB` para resiliência de grandes volumes geodésicos.
- **Normalização de Coordenadas Leaflet**:
  - O Leaflet (`L.polygon`, `L.polyline`) exige tuplas de números `[lat, lng]`.
  - Ao desserializar ou carregar dados, sempre normalizar objetos `{lat, lng}` para `[lat, lng]`.

---

## 2. Ferramentas CAD e Mapa (`CanvasMapEngine` + `<ui-canvas-cad>`)
- O motor antigo (`MapEngine`, `DrawingEngine`, `FeatureRenderer`...) foi removido. Renderização, culling/clusters, hit-test, seleção, popup, snap, edição de vértices, ferramentas de desenho, medição, divisão e conta-gotas pertencem ao componente; o `CanvasMapEngine` só traduz feições do app e eventos `cad-*` em callbacks.
- **Ordem ao concluir uma forma** (`cad-feicao-criada`, medição, divisão, conta-gotas, laço): primeiro limpar a ferramenta e voltar para `'select'`, só então chamar `onFeatureCreated`/`onFeatureSplit`/`onEyedropperSampled`. Quem escuta a seleção precisa ver o mapa sem ferramenta ativa (o HUD de seleção some enquanto se desenha).
- **O componente não grava nada**: a feição que ele cria é removida dele e entregue ao app, que define id, nome, modal e persistência; o estado volta ao componente por `renderFeatures`/`addFeature`.
- **Seleção múltipla**: `onFeatureSelected` só com no máximo 1 feição; `onFeaturesSelected` sempre. Sincronização do `<ui-camadas>`: ao definir seleções, atualizar `uiCamadas.lastClickedFeatureId` (âncora do <kbd>Shift</kbd>) e resolver as feições a partir de `panel.features` filtrando por `newIds`.
- **Sincronização incremental**: `renderFeatures` só envia o que mudou (referência da feição, cor/bloqueio da camada, vínculo oficial × prévia). Camada ainda desconhecida: `definirFeicoes`; as demais recebem **um** `aplicarLote` por camada (remover + adicionar só as mudadas; adicionar id existente mantém a posição). Nunca voltar a um laço de `adicionarFeicao`/`removerFeicao` nem redefinir a camada inteira por causa de muitas mudanças (convertia todas as feições da camada). Feição que muda de camada sai da origem por `aplicarLote` e `_syncLayer` só remove o que ainda está registrado naquela camada (a ordem das camadas no laço não pode apagar o registro).
- **Oculta ≠ excluída**: `visible:false` vira `oculta: true` no componente (não desenha nem seleciona, mas continua existindo, editável e nos pares oficial × prévia); `excluida` é só para `is_deleted`/`_deleted`/`deleted_at`.
- **Sanitização de coordenadas** (`FeatureGeometryUtils.normalizeCoordinates` + normalização do componente): `NaN`/`Infinity` e geometrias degeneradas (polígono < 3 vértices, linha < 2) são descartados antes de chegar ao mapa. O componente também recusa (0, 0) exato.
- **Atalhos**: o app trata a tecla <kbd>S</kbd> (o `CanvasMapEngine` chama `definirAtalhoSnap(false)`); <kbd>Enter</kbd>, <kbd>Esc</kbd>, <kbd>Backspace</kbd>/<kbd>Ctrl+Z</kbd> durante o desenho são do componente, e o app ignora Delete/Backspace enquanto `mapEngine.isDrawing`.
---

## 3. Gestão de Teclas e Atalhos de Teclado
- **Proteção contra Modificadores Globais**:
  - Listeners de atalhos de ferramentas simples (`A`, `L`, `P`, `V`, `Z`, `S`) **NUNCA** devem interceptar teclas se `e.ctrlKey`, `e.metaKey` ou `e.altKey` estiverem ativos:
    ```javascript
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    ```
  - Preservar sempre os comandos do sistema e da aplicação:
    - <kbd>Ctrl+Z</kbd>: Desfazer vértice (durante desenho) ou desfazer feição (mapa geral).
    - <kbd>Ctrl+Y</kbd> / <kbd>Ctrl+Shift+Z</kbd>: Refazer ação.
    - <kbd>Ctrl+S</kbd>: Salvar projeto no banco local.
    - <kbd>Ctrl+K</kbd>: Focar na busca da tabela de atributos.

---

## 4. UI e Web Components (`ui-components-kit`)
- **Arquitetura SRP**:
  - Cada modal, toolbar, header e painel possui seu respectivo arquivo `.js` e `.css` isolados (ex: `HeaderBar.js` + `HeaderBar.css`, `LayerPanel.js` + `LayerPanel.css`).
- **Botões e Modais**:
  - Em barras, tabelas e cabeçalhos, sempre usar `<ui-botao-primario inline>`.
- **Acessibilidade**:
  - Evitar `<label>` solto sem vínculo `for="id"`. Usar `<span class="...">` ou os atributos embutidos dos Web Components (`label="..."`).

---

## 5. Colaboração em Tempo Real (Nuvem PHP/MySQL)
- **Cursor por revisão, nunca por relógio**:
  - Toda escrita (`sync_deltas`, `save_all`, camadas alteradas em `save_metadata`) chama `nextRevision()` dentro da transação; as linhas gravadas recebem essa `rev`.
  - `pull_changes` usa `sinceRev`/`sinceId` (cursor `(rev, id)` persistido em `cm_sync_cursor_<projeto>`). Não reintroduzir `updated_at > since`: empata no mesmo segundo, depende do fuso PHP x MySQL e perde linhas após o `LIMIT`.
- **Edição local vence enquanto não confirmada**:
  - `StorageService.hasPendingLocalChange(id)` (fila de debounce, envio em andamento ou pendência offline) impede que um pull sobrescreva a feição; o cursor fica retido antes dela.
  - Nunca limpar `_dirtyFeatures` ao aplicar alterações remotas.
- **Envio serializado**: toda escrita em nuvem passa por `_enqueuePush` (um POST por vez, na ordem). Falhas vão para `cm_pending_deltas_<projeto>` e são mescladas no próximo envio.
- **`keepalive` só abaixo de 64 KB** (`_postJson`); acima disso o navegador rejeita a requisição.
- **`save_all` não poda por padrão**: só marca ausentes como excluídas com `prune: true`, e respeita `baseRev` para não sobrescrever edições de outros operadores.
- **Presença**: o pull (≈1 s, aba visível) envia nome/cor/cursor e recebe os demais operadores ativos (`cm_presence`). Nomes remotos são sempre escapados antes de ir ao DOM.
- **Salvamento em lote** (desempenho): nunca fazer laço de `app.saveFeature`/`app.removeFeature` para várias feições. Use `app.saveFeaturesBulk(feições)` e `app.removeFeaturesBulk(ids)` (uma gravação de fila, tombstones e IndexedDB, um único `saveMetadata`). `saveFeature` avulso usa `saveMetadata(false)` (debounce). Tombstones ficam em cache em `LocalStore` (gravação única por lote); não reintroduzir `JSON.parse` do localStorage por feição.
- **Metadados**: `saveMetadata` só regrava as camadas no IndexedDB quando mudaram, e `save_metadata` só vai à nuvem quando nome/descrição/mapa-base/camadas mudaram (assinatura do último envio confirmado). `sync_deltas` só recalcula `feature_count` quando há exclusão ou feição nova/ressuscitada.
- **Desfazer/Refazer**: `ShortcutsController.restoreSnapshot` reaproveita a referência das feições inalteradas; sem isso o `applyDiff` (por referência) reenviaria o projeto inteiro. O snapshot (`takeSnapshot`) é um JSON **por feição**, e a feição que não mudou reaproveita a mesma string do passo anterior (50 mil feições: ~470 MB de histórico viraram ~32 MB; `pushHistory` ~300 ms → ~25 ms). A detecção compara campos por identidade (e `style`/`properties` campo a campo) contra uma cópia rasa: não mutar o interior de `coordinates` no lugar (gerar array novo), senão o histórico não vê a mudança. O snapshot continua cópia profunda, porque várias telas ainda atribuem campos da feição no lugar depois do `pushHistory`.
- **Rajada de eventos remotos**: `handleCollabEvent` (`feature:created`/`feature:deleted`) agenda **uma** reconstrução do painel de camadas por janela (`FeatureSyncController.scheduleLayerPanelRefresh`); o painel custa 100–250 ms por `updateLayers`.
- **Esquema**: ao alterar o DDL, incrementar `CM_SCHEMA_VERSION` em `api.php` (o marcador `.cm_schema_version` evita DDL a cada requisição).
- **Criar e excluir projeto** (`ProjectLifecycle`): o id novo é slug + sufixo aleatório; nome, camadas (com ids próprios, pois `cm_layers.id` é global) e enquadramento vão numa semente em localStorage que o boot consome e grava na hora. `delete_project` é só do dono, apaga tudo numa transação e reserva o id em `cm_deleted_projects`: qualquer ação posterior recebe **410 `project_deleted`** (inclusive dentro de `nextRevision`), para que fila offline, flush ao fechar a aba ou outro operador não recriem o projeto. No cliente, `app.closeProject()` cancela todo salvamento agendado antes de apagar a cópia local. O `projeto_padrao` não pode ser excluído.

---

## 6. Deploy e Servidor de Produção (Hostinger LiteSpeed / Node.js & Vite)
- **`entry_file: null` e `app_type: "vite"` nas configurações de build Node.js**:
  - Aplicações Vite são frontends SPA estáticos. Nas configurações de build do Node.js na Hostinger, o `entry_file` **NUNCA** deve ser configurado (deve ser mantido `null` / `none`).
  - Se `entry_file` for preenchido (ex: `index.js`), a Hostinger assume tratar-se de um servidor Node contínuo (Express/Nest) e o sincronizador interno não copia os arquivos compilados de `dist/` para a `public_html/`, resultando em `403 Forbidden` por ausência de `index.html`.
- **Configurações Mandatórias do `.htaccess`**:
  - `DirectoryIndex index.html index.php` deve sempre constar no início do `.htaccess` para que o LiteSpeed sirva o SPA na raiz sem tentar listagem de diretório.
  - `Options -Indexes +FollowSymLinks` para segurança e resolução correta de caminhos.
  - Proteção de arquivos (`db_config.php`, `.env`, `.cm_schema_version`) deve usar sintaxe Apache 2.4 / LiteSpeed (`<IfModule mod_authz_core.c> Require all denied </IfModule>`), evitando diretivas 2.2 isoladas (`Order allow,deny`) que causam comportamentos anômalos.
  - Regra SPA Rewrite: `RewriteRule ^ index.html [L]`.
- **Higiene Rígida da Pasta `public/`**:
  - O Vite copia integralmente o conteúdo da pasta `public/` para a raiz de `dist/`.
  - **NUNCA** versionar `public/index.html` ou pastas `public/assets/`. O entrypoint do Vite é exclusivamente o `index.html` da raiz do repositório.
- **Resiliência do Banco de Dados no Deploy (`api.php`)**:
  - `db_config.php` é ignorado no Git (`.gitignore`). O backend `api.php` carrega `db_config.php` ou lê variáveis de ambiente / `.env` automaticamente (`loadEnvFileIfNeeded`). Senhas de produção nunca devem ser versionadas em código-fonte aberto, mantendo-se estritamente em `db_config.php` ou `.env`.


---

## 6. Geometria e Inspeção de Feições
- **Fonte única de cálculo**: área, perímetro e extensão vêm sempre de `FeatureGeometryUtils` (área elipsoidal GRS80 com furos subtraídos e multipolígonos somados; perímetro inclui o lado de fechamento). Não duplicar fórmulas em componentes.
- **Métricas gravadas** (`Área (ha)`, `Área (m²)`, `Perímetro`, `Extensão`, `Raio`, `Área Coberta`) são geradas por `computeMetricProperties()` e recalculadas a cada edição; são somente leitura no inspetor.
- **Vértices na mesma posição viram um só**: `FeatureGeometryUtils.mergeCoincidentVertices` (comparação exata, só vizinhos, anel de polígono circular, mínimo de 3/2 pontos) é aplicada no arraste do mapa (`_handleKitUpdated`), no desenho novo (`_handleKitCreated`) e na tabela de vértices (`applyVertexEdit`). Novo caminho de edição de geometria deve passar por ela.
- **Edição pelo inspetor**: sempre via `panel.commitFeatureEdit(id, mutate)`, que parte da versão mais recente em `app.features` (nunca da cópia exibida), preservando alterações de colaboradores.
- **Bloqueio**: feição com `locked: true` não é excluída (atalho, HUD, lote, inspetor) nem editada; somente o próprio bloqueio pode ser alterado.
- **Campos sem coluna na API** (`description`, `category`, `locked`, `status`, `customAttributes`) viajam em `properties._cm` (`packFeatureForCloud`/`unpackFeatureFromCloud`); nunca exibir chaves iniciadas por `_`.
- **Distância e azimute são geodésicos (GRS80)**: `Geodesy.inverse` (Vincenty) é a fonte única; `FeatureGeometryUtils.calculateDistance/calculateBearing` delegam a ele. Nunca reintroduzir Haversine/esfera para medidas de projeto (erro de até 0,5% e ~10′ de azimute). A tabela de vértices da impressão usa N/E UTM, mas distância, azimute, área e perímetro geodésicos (iguais aos do inspetor).
- **Modelo de polígono**: profundidade 2 = anel; 3 = externo + furos; 4 = multipolígono. Partes disjuntas importadas (Shapefile, GeoJSON MultiPolygon) viram **uma feição por parte**, nunca anéis irmãos na mesma feição (o cálculo trataria a 2ª parte como furo e zeraria a área). Shapefile: anel horário = externo, anti-horário = furo (`groupPolygonRings`); o escritor grava nessa orientação.
- **`.prj`** (`PrjParser`): geográfica x projetada vem da estrutura do WKT (PROJCS/GEOGCS), não do nome do datum; UTM exige fuso explícito e o hemisfério vem do sufixo N/S ou do False_Northing; SAD69/Córrego Alegre sem TOWGS84 recebem o deslocamento de datum. Coordenadas fora de ±90°/±180° após a reprojeção são descartadas (nunca importar metros como graus); sem nenhuma válida a importação falha com mensagem clara.
- **UTM**: o hemisfério vem da latitude (`PrintItemsManager.toUtmCoords`, `Projections.utmProjection`); fusos 18S–25S e 18N–22N têm código EPSG registrado.
- **Importação CAD/CSV/GeoJSON/KML**: só DXF é lido (DWG binário é recusado com instrução de salvar como DXF: varrer bytes inventava geometria); POLYLINE fechada, ARC e bulge viram geometria real; texto DXF é UTF-8 com fallback Windows-1252; coordenadas que não viram lat/lng válidas são descartadas (erro claro se nenhuma sobra). CSV aceita vírgula decimal pt-BR; GeoJSON respeita `crs` (EPSG conhecido) ou falha; KML lê furos e MultiGeometry (uma feição por geometria). Buffer e deslocamentos usam `Geodesy.metersPerDegree` (M e N do GRS80), não esfera.
- **Contrato de métodos**: ao modularizar, conferir que todo método chamado por `CanvasMapEngine`/`LayerPanel` continua existindo (os testes usam mocks e não detectam a ausência).

---

## 7. Busca Avançada e Ações em Lote
- **Motor puro**: `FeatureQuery` (sem DOM) avalia critérios `{campo, operador, valor}` em grupos E/OU/NÃO aninhados e devolve ids. Critérios incompletos são ignorados; regex inválida não casa nada (`validate()` informa o erro). Área/comprimento são cacheados por referência do array de coordenadas, então geometria editada precisa gerar coordenadas **novas** (como faz `FeatureGeometryUtils.replaceRing`), nunca mutar o array no lugar.
- **Ações em lote** passam sempre por `BatchActions` (mover de camada, cores, bloquear, visibilidade, atributo, excluir): ignoram feições bloqueadas, gravam **um** passo de histórico e redesenham uma vez. Não fazer loop de `updateFeature` para lotes. A exclusão em lote reaproveita `layerPanel.onBulkDelete`.
- **Ponto único de entrada**: `app.batchActions` (criado em `AppComponentsBuilder.buildAdvancedSearchActions`) é usado pelo painel (Ctrl+Shift+F), pelo HUD de seleção e pelo menu de contexto.
- **Renderer**: `FeatureRenderer.renderFeatures` guarda uma **cópia** de `app.features`; nunca compartilhar a referência do array (causava feições duplicadas no `createFeature`).

---

## 8. Ambientes: Banco Local de Testes x Hostinger
- **`npm run dev` (localhost) não fala com a Hostinger**: `CLOUD_API_URL` fica vazio e `cloudFetch` falha na hora (como offline); só IndexedDB/localStorage são usados e o chip mostra "Modo local de testes". Nenhum fetch à nuvem deve ser feito sem passar por `cloudFetch`.
- **Backend alternativo (staging/local)**: defina `VITE_CLOUD_API_URL` em `.env.local` (ignorado pelo Git). Em produção (hospedagem) o app usa `./api.php` da própria origem.
- **Testes nunca tocam produção**: testes em Node usam o host reservado `.invalid`. Os testes de integração que escrevem no backend (`test_cloud*`, `test_single_upsert`, `test_full_realtime_cycle`, `test_check_layers`, `test_query_feat`) são opt-in e exigem `CM_TEST_API_URL` apontando para um backend de TESTES; URLs de produção são recusadas (`tests/_cloud_target.js`). `test_cloud_isolation.js` falha se a URL de produção aparecer em `src/` ou `tests/`.

---

## 9. Mapa hospedado no `<ui-canvas-cad>`
- O `L.map` pertence ao `<ui-canvas-cad>` (`CanvasHost.mount`); o `CanvasMapEngine` só traduz o app para ele. Nunca chamar `map.remove()` no mapa hospedado: o componente o destrói (`CanvasHost.dispose`).
- O componente usa Shadow DOM: o CSS do documento é espelhado no shadow root (`CanvasHost._mirrorDocumentStyles`). Seletores e consultas ao DOM do mapa devem partir de `map.getContainer()`, não de `document`.
- Padrões do componente desligados no `CanvasHost`: camadas padrão (satélite Google, WMS SIGEF/INCRA — que consulta o INCRA a cada clique), painel/barra do kit. Pan com a roda, caixa Window/Crossing, snap e menu de contexto do componente ficam ligados.
- O kit instalado é uma build local do repositório do usuário (D:/Programação/UI_Componentes) enquanto não for publicado.
- **Atualização Rápida do Kit**: Ao receber pedidos como "atualize o kit de ui", execute imediatamente o comando em 1 passo `npm run update:kit` documentado em `docs/ATUALIZAR_UI_KIT.md`.
- Histórico: o que o motor antigo fazia e o mapa de migração estão em `docs/MAPENGINE_INVENTARIO.md`.

---

## 10. Ribbon: abas Modificar, Projeto e Dados
- **Definição pura**: `ModifyRibbon.js` (sem DOM) declara a aba (`buildModifyTab`) e calcula o estado de cada comando para a seleção (`computeModifyState`: habilitado, rótulo/ícone de bloquear e ocultar, camada marcada, ferramenta ativa, histórico). Comando novo = item na aba + entrada no estado; `tests/test_modify_ribbon.js` falha se um id existir só de um lado.
- **Sem lógica própria**: `ModifyActionsController` só roteia para o que já existe (barra de desenho via `drawingToolbar.onAction`, `app.batchActions`, `SelectionStyleController`, HUD). Simplificar e inverter cores em lote ficam em `BatchActions` (um passo de histórico) e entram em `app.batchActions`; não duplicar essas regras na ribbon, no HUD ou no menu de contexto.
- **Sincronização**: `app.syncRibbon()` (agrupa chamadas no mesmo ciclo) é disparada por `AppGeometryCoordinator.updateHUD` (seleção, recarga, desfazer/refazer), `pushHistory` e troca de ferramenta. `HeaderBar.syncItems` só chama `atualizarItem` no que mudou. Com seleção, a aba assume o foco e a anterior volta ao limpar; trocar de aba à mão cancela o retorno.
- **Estado é do app**: botões de ferramenta (laço, conta-gotas, dividir, régua) refletem `mapEngine.activeTool`; clicar de novo volta para `select`.
- **Abas Projeto e Dados**: `ViewRibbon.js` (puro) define as duas abas e `computeViewState` (histórico, snap, zoom automático, painéis abertos); `RibbonViewController` roteia os botões (histórico, enquadrar, snap e zoom reaproveitam `drawingToolbar.onAction`). Painéis passam por `LayerPanel.setSidebarCollapsed` e `AttributeTable.toggleCollapse`, que avisam `onSidebarToggle`/`onCollapseChange`; não mexer na classe `collapsed` direto. Toggles da ribbon têm o estado no app (`preventDefault` no clique + `syncItems`).

---

## 11. Layout de Impressão (`PrintComposer`)
- **Histórico guarda o estado DEPOIS da ação** (`PrintHistory`; a 1ª entrada é a abertura da prancha). Toda mudança chama `composer.pushHistoryState(ação)` após mutar; edições em rajada no mesmo campo (digitação, setas) passam `coalesceKey` e viram um passo. Trocar, criar ou excluir prancha chama `composer.resetHistory()`.
- **Painel nunca recria os mapas**: editar um item usa `composer.refreshItemContent(item)` (redesenha só aquele item; mapas só atualizam grade/escala). `renderAllItems` destrói e recria os Leaflet e fica para mudanças estruturais (inserir, excluir, visibilidade, ordem, desfazer).
- **Callbacks de mapa conferem a instância**: `updateGridAndScale` e o `moveend` saem se `leafletMaps.get(item.id) !== map`; timeouts dos mapas ficam em `mapTimers` e são cancelados em `destroyLeafletMaps`.
- **Escala exata**: mapas com `zoomSnap: 0` e `setZoom(..., { animate: false })`; o campo do painel é atualizado a partir da escala real do mapa.
- **Bloqueio**: item `locked` não é excluído (`deleteItem` recusa) nem editado pelo painel (campos num `<fieldset disabled>`); só o próprio bloqueio muda.
- **Empilhamento = ordem de `composer.items`** (z-index inline no `renderAllItems`, a mesma ordem do exportador). Não reintroduzir z-index por tipo no CSS; moldura nova entra logo acima dos mapas (`PrintItemsManager.insertionIndex`).
- **Barra de escala**: `PrintItemsManager.scaleBarModel` é a fonte única (régua = distância redonda rotulada, em px absolutos na tela e em `w × ratio` no exportador). Toda barra acompanha a escala do mapa principal.
- **Tamanho e limites**: `PrintItemsManager.MIN_ITEM_MM` vale para alças, guias e painel; o painel passa por `clampItemToPaper`.
- **Painel lateral sem estilos inline**: classes em `PrintPropertiesPanel.css` (importado pelo `PrintComposerModal`, para o painel continuar testável no Node); só valores vindos de dados (cor da camada) ficam no `style`, sempre via `sanitizeColor`. Seções abertas/fechadas ficam em `composer.panelSections` pelo `data-section`, nunca pela posição.
- **Cores e valores no `style`/canvas**: passar por `PrintItemsManager.sanitizeColor` (tela e exportador); campos de lista (enquadramento, peso, alinhamento) só aceitam os valores conhecidos. O preenchimento da forma é seletor de cor + opacidade gravados como `rgba()`.
- **Grade e mapa de localização**: `.cm-item-map-canvas` tem `z-index: 0` (contém as camadas do Leaflet, z 200–700) para a grade (`z-index: 1`) ficar por cima. O mapa de localização centra na área do projeto e usa `PrintItemsManager.insetLocator` (tela e exportador): área menor que `INSET_MIN_BOX_PX` vira ponto.
- **Grade de coordenadas**: `PrintItemsManager.graticuleModel` (intervalos redondos em DMS ou metros UTM, frações da moldura em Web Mercator) é a fonte única da grade na tela (`renderMapGridBorder`) e no PDF (`drawMapGraticule`). Não voltar a cruzes em posições fixas.
- **Carimbo**: a escala vem de `titleBlockScaleText` (acompanha o mapa principal salvo `scaleAuto: false`); o número da prancha fica só em `properties.sheetNumber` e `titleBlockDateText` junta data e número (nunca gravar o número dentro de `date`).
- **Imagens** passam por `PrintImageUtils.prepareImageFile` (máx. 1200 px, JPEG se a data URL passar de ~500 KB). Falha de gravação das pranchas avisa o usuário uma vez por sequência (`saveFailed`).
- **Trocar o papel preserva os itens** (`PrintItemsManager.fitItemsToPaper`, proporcional à área útil ABNT). Só "Restaurar Layout Padrão ABNT" substitui os itens, e ambos podem ser desfeitos.
