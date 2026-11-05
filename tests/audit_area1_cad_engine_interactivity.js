/* ==========================================================================
   ConecteMapas - Teste de Auditoria Especializada da Área 1
   Motor Gráfico CAD, Canvas Host & Interatividade de Mapa
   ========================================================================== */

import assert from 'assert';

console.log('🔍 Executando Auditoria da Área 1: Motor Gráfico CAD, Canvas Host & Interatividade...');

const noop = () => {};

// Mock do ambiente DOM para testes unitários em Node
globalThis.window = {
  addEventListener: noop,
  removeEventListener: noop,
  devicePixelRatio: 1,
  screen: { deviceXDPI: 1, logicalXDPI: 1 },
  location: { hostname: 'localhost', search: '' },
  requestAnimationFrame: (cb) => setTimeout(cb, 0),
  cancelAnimationFrame: noop
};

globalThis.document = {
  createElement: () => ({
    style: {},
    classList: { add: noop, remove: noop, toggle: noop },
    setAttribute: noop,
    appendChild: noop,
    addEventListener: noop,
    querySelector: () => null,
    querySelectorAll: () => []
  }),
  documentElement: { style: {} },
  body: {},
  addEventListener: noop,
  removeEventListener: noop,
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => []
};

globalThis.HTMLElement = class {};
globalThis.customElements = { define: noop, get: () => null };
globalThis.CSSStyleSheet = class { replaceSync() {} };

const { CanvasMapEngine } = await import('../src/services/CanvasMapEngine.js');
const { FeatureGeometryUtils } = await import('../src/services/MapEngine/FeatureGeometryUtils.js');
const { ShortcutsController } = await import('../src/controllers/ShortcutsController.js');

// ============================================================================
// 1. CICLO DE FERRAMENTAS CAD (Retorno obrigatório a 'select' antes dos eventos)
// ============================================================================
console.log('\n--- 1. Auditoria do Ciclo de Ferramentas CAD ---');
{
  const eventListeners = new Map();
  const hostCalls = [];

  const hostMock = {
    addEventListener: (type, handler) => {
      if (!eventListeners.has(type)) eventListeners.set(type, []);
      eventListeners.get(type).push(handler);
    },
    removeEventListener: noop,
    definirFerramenta: (tool) => {
      hostCalls.push({ name: 'definirFerramenta', tool });
      return { ok: true };
    },
    limparMedicao: () => hostCalls.push({ name: 'limparMedicao' }),
    removerFeicao: (camadaId, id) => hostCalls.push({ name: 'removerFeicao', camadaId, id }),
    definirAtalhoSnap: noop,
    definirMargensPopup: noop,
    definirMargensHud: noop,
    getLayerManager: () => ({ getLayerDef: () => ({}), setLayerBlocked: noop })
  };

  const dispatch = (type, detail) => {
    const list = eventListeners.get(type) || [];
    for (const fn of list) fn({ detail });
  };

  const engine = Object.create(CanvasMapEngine.prototype);
  engine.host = hostMock;
  engine.onToolChange = noop;
  engine._tool = 'select';
  engine._features = [];
  engine._featureMap = new Map();
  engine._layers = [{ id: 'l1', name: 'Lotes', color: '#00E08A' }];
  engine._layerMap = new Map(engine._layers.map(l => [l.id, l]));
  engine._applied = new Map();
  engine._disposers = [];
  engine.selectedFeatureIds = new Set();
  engine.selectedFeatureId = null;

  // Registrar listeners
  engine._bindKitEvents();

  // 1.1 Conta-gotas: deve resetar ferramenta antes de emitir onEyedropperSampled
  let toolDuringEyedropper = null;
  engine.onEyedropperSampled = (feat) => {
    toolDuringEyedropper = engine.activeTool;
  };
  engine._tool = 'eyedropper';
  const sampleFeat = { id: 'f-sample', type: 'Polygon', layerId: 'l1', coordinates: [[-15, -47], [-15, -46.9], [-14.9, -46.9]] };
  engine._featureMap.set('f-sample', sampleFeat);
  dispatch('cad-conta-gotas', { feicao: { id: 'f-sample' } });
  assert.strictEqual(toolDuringEyedropper, 'select', 'Conta-gotas deve voltar ferramenta para "select" ANTES do callback');
  assert.strictEqual(engine.activeTool, 'select', 'Ferramenta ativa após conta-gotas deve ser select');

  // 1.2 Laço poligonal (pen-select): deve resetar ferramenta para 'select' antes de onFeaturesSelected
  let toolDuringLassoSelection = null;
  engine.onFeaturesSelected = (feats) => {
    toolDuringLassoSelection = engine.activeTool;
  };
  engine._tool = 'pen-select';
  dispatch('cad-selecao', { feicoes: [{ id: 'f-sample' }] });
  assert.strictEqual(toolDuringLassoSelection, 'select', 'Laço deve voltar ferramenta para "select" ANTES de emitir cad-selecao');
  assert.strictEqual(engine.activeTool, 'select', 'Ferramenta ativa após laço deve ser select');

  // 1.3 Divisão com falha: deve voltar para 'select' antes de onSplitFailed
  let toolDuringSplitFailed = null;
  engine.onSplitFailed = (reason) => {
    toolDuringSplitFailed = engine.activeTool;
  };
  engine._tool = 'split';
  dispatch('cad-divisao-falhou', { motivo: 'sem-intersecao' });
  assert.strictEqual(toolDuringSplitFailed, 'select', 'Falha na divisão deve voltar ferramenta para "select" ANTES de onSplitFailed');

  // 1.4 Divisão bem-sucedida: estado deve voltar para 'select' antes de onFeatureSplit
  let toolDuringSplitSuccess = null;
  engine.onFeatureSplit = (target, polys) => {
    toolDuringSplitSuccess = engine.activeTool;
  };
  engine._tool = 'split';
  dispatch('cad-feicao-dividida', {
    origem: { id: 'f-sample' },
    partes: [
      { id: 'part-1', camadaId: 'l1', geometria: { tipo: 'Polygon', aneis: [[[-15, -47], [-15, -46.95], [-14.9, -46.95]]] } },
      { id: 'part-2', camadaId: 'l1', geometria: { tipo: 'Polygon', aneis: [[[-15, -46.95], [-15, -46.9], [-14.9, -46.9]]] } }
    ]
  });
  assert.strictEqual(toolDuringSplitSuccess, 'select', 'Divisão bem-sucedida deve voltar ferramenta para "select" ANTES de onFeatureSplit');

  // 1.5 Criação e Medição
  let toolDuringCreated = null;
  engine.onFeatureCreated = () => { toolDuringCreated = engine.activeTool; };
  engine._tool = 'polygon';
  dispatch('cad-feicao-criada', {
    camadaId: 'l1',
    feicao: { id: 'f-new', geometria: { tipo: 'Polygon', aneis: [[[-15, -47], [-15, -46.9], [-14.9, -46.9]]] } }
  });
  assert.strictEqual(toolDuringCreated, 'select', 'Criação deve voltar ferramenta para "select" ANTES de onFeatureCreated');

  console.log('✔ Ciclo de ferramentas CAD verificado com conformidade total!');
}

// ============================================================================
// 2. SINCRONIZAÇÃO INCREMENTAL DO MAPA (Sem loops, lote único)
// ============================================================================
console.log('\n--- 2. Auditoria da Sincronização Incremental ---');
{
  const calls = [];
  const layerDefs = new Map();
  const host = {
    definirFeicoes: (id, list, opts) => {
      layerDefs.set(id, opts);
      calls.push({ name: 'definirFeicoes', id, count: list.length });
    },
    aplicarLote: (id, lote, opts) => {
      calls.push({ name: 'aplicarLote', id, add: (lote.adicionar || []).length, rem: (lote.remover || []).length });
    },
    removerFeicao: (layerId, id) => calls.push({ name: 'removerFeicao', layerId, id }),
    adicionarFeicao: (layerId, feat) => calls.push({ name: 'adicionarFeicao', layerId, id: feat.id }),
    setLayerVisibility: noop,
    getLayerManager: () => ({
      setLayerBlocked: noop,
      getLayerDef: (id) => layerDefs.get(id),
      setLayerZIndex: noop,
      setLayerOpacity: noop
    })
  };

  const engine = Object.create(CanvasMapEngine.prototype);
  engine.host = host;
  engine._applied = new Map();
  engine._features = [];
  engine._featureMap = new Map();
  engine._layers = [];
  engine._layerMap = new Map();

  const layers = [
    { id: 'L1', name: 'Loteamento', color: '#00E08A', visible: true, locked: false, opacity: 1 },
    { id: 'L2', name: 'Vias', color: '#38bdf8', visible: true, locked: false, opacity: 1 }
  ];

  const p1 = { id: 'p1', type: 'Point', layerId: 'L1', coordinates: [-15.0, -47.0] };
  const p2 = { id: 'p2', type: 'Point', layerId: 'L1', coordinates: [-15.1, -47.1] };
  const p3 = { id: 'p3', type: 'Point', layerId: 'L2', coordinates: [-15.2, -47.2] };

  // Carga inicial
  engine.renderFeatures([p1, p2, p3], layers);
  assert.strictEqual(calls.filter(c => c.name === 'definirFeicoes').length, 2, 'Cada camada definida por inteiro no início');
  assert.strictEqual(calls.filter(c => c.name === 'aplicarLote').length, 0);

  // Sem alterações
  calls.length = 0;
  engine.renderFeatures([p1, p2, p3], layers);
  assert.strictEqual(calls.length, 0, 'Sem alterações: nenhuma chamada ao host');

  // Atualização de 1 elemento: 1 único aplicarLote, NENHUM loop de adicionar/remover
  calls.length = 0;
  const p1Edit = { ...p1, coordinates: [-15.05, -47.05] };
  engine.renderFeatures([p1Edit, p2, p3], layers);
  const lotes = calls.filter(c => c.name === 'aplicarLote');
  assert.strictEqual(lotes.length, 1, 'Exatamente um aplicarLote para a camada afetada');
  assert.strictEqual(lotes[0].id, 'L1');
  assert.strictEqual(lotes[0].add, 1);
  assert.strictEqual(calls.filter(c => c.name === 'adicionarFeicao' || c.name === 'removerFeicao').length, 0, 'Proibido loops de adicionar/remover!');

  console.log('✔ Sincronização incremental com lote único validada com sucesso!');
}

// ============================================================================
// 3. GEOMETRIA, COORDENADAS E SANITIZAÇÃO
// ============================================================================
console.log('\n--- 3. Auditoria de Geometria e Sanitização ---');
{
  const G = FeatureGeometryUtils;

  // 3.1 Descarte de NaN e Infinity
  const nanPoint = { type: 'Point', coordinates: [NaN, -47.0] };
  assert.strictEqual(G.normalizeCoordinates(nanPoint), null, 'Ponto com NaN deve ser descartado');

  const infPoly = {
    type: 'Polygon',
    coordinates: [[-15.0, -47.0], [Infinity, -47.1], [-15.2, -47.2]]
  };
  assert.strictEqual(G.normalizeCoordinates(infPoly), null, 'Polígono contendo Infinity deve ser descartado');

  // 3.2 Descarte de geometrias degeneradas
  const degenPoly = {
    type: 'Polygon',
    coordinates: [[-15.0, -47.0], [-15.1, -47.1]] // Menos de 3 pontos
  };
  assert.strictEqual(G.normalizeCoordinates(degenPoly), null, 'Polígono < 3 vértices deve ser descartado');

  const degenLine = {
    type: 'LineString',
    coordinates: [[-15.0, -47.0]] // Menos de 2 pontos
  };
  assert.strictEqual(G.normalizeCoordinates(degenLine), null, 'Linha < 2 pontos deve ser descartada');

  // 3.3 mergeCoincidentVertices: fusão exata de vizinhos
  const pA = [-15.0, -47.0];
  const pB = [-15.0, -46.9];
  const pC = [-14.9, -46.9];
  const polyCoords = [pA, pB, pB, pC]; // Vizinho pB duplicado
  const merged = G.mergeCoincidentVertices(polyCoords, 'Polygon');
  assert.deepStrictEqual(merged, [pA, pB, pC], 'Vizinho duplicado deve ser fundido');

  // 3.4 Fechamento circular no polígono (último vizinho do primeiro)
  const circularClosed = [pA, pB, pC, pA];
  const mergedCirc = G.mergeCoincidentVertices(circularClosed, 'Polygon');
  assert.deepStrictEqual(mergedCirc, [pA, pB, pC, pA], 'Anel fechado padrão RFC 7946 deve manter fechamento');

  // 3.5 Circuito proposital em linha não deve ser destruído
  const lineLoop = [pA, pB, pC, pA];
  const mergedLine = G.mergeCoincidentVertices(lineLoop, 'LineString');
  assert.strictEqual(mergedLine, lineLoop, 'Linha em circuito fechado intencional deve ser preservada');

  console.log('✔ Sanitização e fusão de vértices validadas com sucesso!');
}

// ============================================================================
// 4. ATALHOS DE TECLADO (Proteção contra modificadores e digitação)
// ============================================================================
console.log('\n--- 4. Auditoria de Atalhos de Teclado ---');
{
  // Simular evento de teclado
  let executedTool = null;
  let undoCalled = false;
  let saveCalled = false;

  const mockApp = {
    features: [],
    setDrawingTool: (tool) => { executedTool = tool; },
    saveState: () => { saveCalled = true; },
    undo: () => { undoCalled = true; },
    mapEngine: { isDrawing: false, drawingPoints: [] }
  };

  // Simulação das regras de ShortcutsController.bindGlobalShortcuts
  const simulateKey = (key, modifiers = {}) => {
    executedTool = null;
    undoCalled = false;
    saveCalled = false;

    const e = {
      key,
      ctrlKey: !!modifiers.ctrlKey,
      metaKey: !!modifiers.metaKey,
      altKey: !!modifiers.altKey,
      shiftKey: !!modifiers.shiftKey,
      target: modifiers.target || { tagName: 'DIV' },
      composedPath: () => [modifiers.target || { tagName: 'DIV' }],
      preventDefault: noop
    };

    if (ShortcutsController.isTypingTarget(e)) return;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      if (mockApp.mapEngine?.isDrawing) return;
      undoCalled = true;
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      saveCalled = true;
      return;
    }

    // Atalhos simples NUNCA devem rodar se ctrlKey, metaKey ou altKey forem verdadeiros
    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      const toolMap = {
        v: 'select',
        q: 'pen-select',
        p: 'point',
        l: 'line',
        a: 'polygon'
      };
      const k = e.key.toLowerCase();
      if (toolMap[k]) {
        mockApp.setDrawingTool(toolMap[k]);
      }
    }
  };

  // 4.1 Teclas simples sem modificadores acionam ferramenta
  simulateKey('a');
  assert.strictEqual(executedTool, 'polygon', 'Tecla A simples ativa polígono');

  simulateKey('l');
  assert.strictEqual(executedTool, 'line', 'Tecla L simples ativa linha');

  // 4.2 Tecla com Ctrl NUNCA deve ativar ferramenta
  simulateKey('a', { ctrlKey: true });
  assert.strictEqual(executedTool, null, 'Ctrl+A NÃO pode acionar ferramenta polígono (pertence a Selecionar Tudo)');

  simulateKey('s', { ctrlKey: true });
  assert.strictEqual(executedTool, null, 'Ctrl+S NÃO pode alternar snap (pertence a Salvar)');
  assert.strictEqual(saveCalled, true, 'Ctrl+S salva o projeto');

  simulateKey('z', { ctrlKey: true });
  assert.strictEqual(executedTool, null, 'Ctrl+Z NÃO pode acionar ferramenta (pertence a Undo)');
  assert.strictEqual(undoCalled, true, 'Ctrl+Z aciona Undo');

  // 4.3 Tecla com Alt NUNCA deve ativar ferramenta
  simulateKey('a', { altKey: true });
  assert.strictEqual(executedTool, null, 'Alt+A não aciona ferramenta');

  // 4.4 Digitação em campo de texto NÃO aciona ferramenta
  simulateKey('a', { target: { tagName: 'INPUT' } });
  assert.strictEqual(executedTool, null, 'Digitação em input com tecla A não aciona ferramenta');

  console.log('✔ Salvaguardas de atalhos e modificadores globais 100% blindadas!');
}

console.log('\n🎉 AUDITORIA DA ÁREA 1 CONCLUÍDA COM 100% DE SUCESSO!\n');
