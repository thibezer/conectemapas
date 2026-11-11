import assert from 'assert';

const store = new Map();
const createMockEl = () => ({
  setAttribute: () => {},
  getAttribute: () => null,
  style: {},
  classList: { add: () => {}, remove: () => {} },
  textContent: '',
  appendChild: () => {},
  addEventListener: () => {},
  removeEventListener: () => {}
});

globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k)
};

globalThis.window = {
  requestAnimationFrame: (cb) => setTimeout(cb, 0),
  location: { hostname: 'localhost', search: '' },
  devicePixelRatio: 1,
  screen: {},
  addEventListener: () => {},
  removeEventListener: () => {}
};

globalThis.document = {
  createElement: createMockEl,
  documentElement: { style: {} },
  body: { appendChild: () => {} },
  addEventListener: () => {},
  removeEventListener: () => {},
  getElementById: () => createMockEl(),
  querySelector: () => createMockEl(),
  querySelectorAll: () => []
};

globalThis.HTMLElement = class {};
globalThis.customElements = { define: () => {}, get: () => null };
globalThis.requestIdleCallback = (cb) => setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 50 }), 0);
globalThis.cancelIdleCallback = (id) => clearTimeout(id);

const { IndexedDbSchema } = await import('../src/services/Storage/IndexedDbSchema.js');
const { StorageService } = await import('../src/services/StorageService.js');
const { FeatureSyncController } = await import('../src/controllers/FeatureSyncController.js');
const { ShortcutsController } = await import('../src/controllers/ShortcutsController.js');
const { PrintMapRenderer } = await import('../src/components/PrintComposer/PrintMapRenderer.js');
const { PrintViewResolver } = await import('../src/components/PrintComposer/PrintViewResolver.js');
const { GeoFormats } = await import('../src/services/GeoFormats.js');
const { FeatureGeometryUtils } = await import('../src/services/MapEngine/FeatureGeometryUtils.js');

console.log('--- Testando otimizações de performance (cache, lote, R-Tree, lazy parsers) ---');

// 1. Cache de conexão IndexedDbSchema + invalidação em onclose / onversionchange / troca de factory
{
  let openCountA = 0;
  let lastDbA = null;
  let closeCalls = 0;

  const makeMockFactory = (onOpen) => ({
    open() {
      onOpen();
      const db = {
        objectStoreNames: { contains: () => true },
        onclose: null,
        onversionchange: null,
        close() { closeCalls++; }
      };
      lastDbA = db;
      const req = { result: db, onupgradeneeded: null, onsuccess: null, onerror: null, onblocked: null };
      queueMicrotask(() => req.onsuccess && req.onsuccess({ target: { result: db } }));
      return req;
    }
  });

  IndexedDbSchema.resetConnectionCache();
  globalThis.window.indexedDB = makeMockFactory(() => { openCountA++; });

  const db1 = await IndexedDbSchema.getDB();
  const db2 = await IndexedDbSchema.getDB();
  assert.strictEqual(db1, db2, 'getDB() deve reutilizar a mesma instância');
  assert.strictEqual(openCountA, 1, 'getDB() em chamada repetida não deve reabrir conexão');

  db1.onclose();
  const db3 = await IndexedDbSchema.getDB();
  assert.notStrictEqual(db3, db1, 'onclose deve invalidar o cache da conexão');
  assert.strictEqual(openCountA, 2);

  db3.onversionchange();
  assert.strictEqual(closeCalls, 1, 'onversionchange deve fechar a conexão aberta');
  const db4 = await IndexedDbSchema.getDB();
  assert.notStrictEqual(db4, db3, 'onversionchange deve invalidar cache e abrir nova conexão');
  assert.strictEqual(openCountA, 3);

  let openCountB = 0;
  globalThis.window.indexedDB = makeMockFactory(() => { openCountB++; });
  const dbB = await IndexedDbSchema.getDB();
  assert.ok(dbB === lastDbA && openCountB === 1, 'troca de window.indexedDB deve abrir pela nova factory');

  IndexedDbSchema.resetConnectionCache();
  delete globalThis.window.indexedDB;
}

// 2. Flag O(1) de métricas + chunked scheduleRefreshStoredMetrics (guarda contra edição simultânea e closeProject)
{
  const polyCoords = [[-15.80, -47.90], [-15.80, -47.89], [-15.79, -47.89], [-15.79, -47.90]];
  const exactMetrics = FeatureGeometryUtils.computeMetricProperties({ type: 'Polygon', coordinates: polyCoords });
  const features = [];
  for (let i = 0; i < 1600; i++) {
    features.push({
      id: `perf-f-${i}`,
      name: `Pol ${i}`,
      type: 'Polygon',
      layerId: 'layer-default',
      coordinates: polyCoords,
      properties: i === 0
        ? { 'Área (ha)': '99999,00 ha' }
        : (i === 2 ? {} : { ...exactMetrics })
    });
  }

  const origQueueBulk = StorageService.queueFeaturesBulkUpsert;
  let queuedBulkCount = 0;
  StorageService.queueFeaturesBulkUpsert = (list, ...rest) => {
    queuedBulkCount += list.length;
    return origQueueBulk.call(StorageService, list, ...rest);
  };
  try {
    const appA = {
      projectId: 'proj_perf_a',
      _projectClosed: false,
      layers: [{ id: 'layer-default', color: '#00E08A', visible: true }],
      features: features.map(f => ({ ...f, properties: { ...f.properties } })),
      mapEngine: null,
      layerPanel: null,
      attributeTable: null
    };

    store.delete('cm_metrics_v2_proj_perf_a');
    FeatureSyncController.scheduleRefreshStoredMetrics(appA);
    await new Promise(r => setTimeout(r, 80));

    assert.strictEqual(appA.features[0].properties['Área (ha)'], exactMetrics['Área (ha)'], 'feição com métrica legada divergente deve ser recalculada em fatias');
    assert.strictEqual(appA.features[2].properties['Área (ha)'], undefined, 'feição sem chaves de métrica deve ser ignorada (pré-filtro O(1))');
    assert.strictEqual(queuedBulkCount, 1, 'apenas a feição legada divergente deve ir para queueFeaturesBulkUpsert');
    assert.strictEqual(store.get('cm_metrics_v2_proj_perf_a'), '1', 'flag cm_metrics_v2 deve ser gravada');

    // Segunda chamada com flag ligada: O(1) skip (mesmo com feição legada alterada em memória no cenário)
    appA.features[1] = { ...appA.features[1], properties: { 'Área (ha)': '99999,00 ha' } };
    FeatureSyncController.scheduleRefreshStoredMetrics(appA);
    await new Promise(r => setTimeout(r, 40));
    assert.strictEqual(appA.features[1].properties['Área (ha)'], '99999,00 ha', 'flag O(1) deve pular varredura repetida');

    // Invalidação limpa a flag
    FeatureSyncController.invalidateMetricsCheck('proj_perf_a');
    assert.strictEqual(store.has('cm_metrics_v2_proj_perf_a'), false, 'invalidateMetricsCheck deve remover a flag');

    // Concorrência: se o usuário editou app.features[0] durante o cálculo fatiado, não pode sobrescrever
    const beforeConcurrent = queuedBulkCount;
    const appB = {
      projectId: 'proj_perf_b',
      _projectClosed: false,
      layers: [{ id: 'layer-default', color: '#00E08A', visible: true }],
      features: features.map(f => ({ ...f, properties: { ...f.properties } }))
    };
    FeatureSyncController.scheduleRefreshStoredMetrics(appB);
    // Edita feição 0 imediatamente antes do tick assíncrono finalizar
    const userEdited = { ...appB.features[0], name: 'EditadaLocal' };
    appB.features[0] = userEdited;
    await new Promise(r => setTimeout(r, 80));
    assert.strictEqual(appB.features[0].name, 'EditadaLocal', 'cálculo em background não deve sobrescrever edição concorrente');
    assert.strictEqual(queuedBulkCount, beforeConcurrent);

    // Fechamento de projeto antes do término aborta gravação
    const beforeClosed = queuedBulkCount;
    const appC = {
      projectId: 'proj_perf_c',
      _projectClosed: false,
      layers: [{ id: 'layer-default', color: '#00E08A', visible: true }],
      features: features.map(f => ({ ...f, properties: { ...f.properties } }))
    };
    FeatureSyncController.scheduleRefreshStoredMetrics(appC);
    appC._projectClosed = true;
    await new Promise(r => setTimeout(r, 80));
    assert.strictEqual(queuedBulkCount, beforeClosed, '_projectClosed deve abortar o recálculo em background');
  } finally {
    StorageService.queueFeaturesBulkUpsert = origQueueBulk;
  }
}

// 3. applyRemoteDeltas consolidando exclusões + upserts em renderFeatures único e podando seleção
{
  let renderCalls = 0;
  let singleUpdates = 0;
  let singleRemoves = 0;
  const mockEngine = {
    selectedFeatureIds: new Set(['d1', 'keep1']),
    selectedFeatureId: 'd1',
    pruneDeletedSelection(ids) {
      for (const id of ids) {
        this.selectedFeatureIds.delete(id);
        if (this.selectedFeatureId === id) this.selectedFeatureId = null;
      }
    },
    renderFeatures() { renderCalls++; },
    updateFeature() { singleUpdates++; },
    removeFeature() { singleRemoves++; }
  };

  const appDelta = {
    projectId: 'proj_delta_perf',
    projectName: 'P',
    currentBasemap: 'clean',
    layers: [{ id: 'l1', name: 'C1', color: '#00E08A', visible: true }],
    features: [
      { id: 'd1', name: 'Del', type: 'Point', layerId: 'l1', coordinates: [-15.8, -47.9], properties: {} },
      { id: 'keep1', name: 'Keep', type: 'Point', layerId: 'l1', coordinates: [-15.81, -47.91], properties: {} }
    ],
    mapEngine: mockEngine,
    getLayersWithCounts: () => [{ id: 'l1', count: 3 }]
  };

  FeatureSyncController.applyRemoteDeltas(appDelta, {
    deleted: ['d1'],
    upserted: [
      { id: 'u1', name: 'U1', type: 'Point', layerId: 'l1', coordinates: [-15.82, -47.92], properties: {} },
      { id: 'u2', name: 'U2', type: 'Point', layerId: 'l1', coordinates: [-15.83, -47.93], properties: {} }
    ]
  });

  assert.strictEqual(renderCalls, 1, 'delta em lote deve consolidar em 1 renderFeatures');
  assert.strictEqual(singleUpdates, 0, 'delta em lote não deve disparar loop de updateFeature');
  assert.strictEqual(singleRemoves, 0, 'delta em lote não deve disparar loop de removeFeature');
  assert.strictEqual(mockEngine.selectedFeatureIds.has('d1'), false, 'exclusão remota em lote deve sair de selectedFeatureIds');
  assert.strictEqual(mockEngine.selectedFeatureIds.has('keep1'), true);
  assert.strictEqual(mockEngine.selectedFeatureId, null, 'selectedFeatureId excluído deve virar null');
}

// 4. PrintMapRenderer.plan() paridade entre varredura linear (<300) e R-Tree em cache (>=300)
{
  const layers = [
    { id: 'l1', name: 'C1', color: '#00E08A', visible: true },
    { id: 'l2', name: 'C2', color: '#3B82F6', visible: true }
  ];
  const feats = [];
  for (let i = 0; i < 340; i++) {
    const inside = i % 3 === 0;
    const baseLat = inside ? -15.80 + (i % 10) * 0.001 : -20.0;
    const baseLng = inside ? -47.90 + (i % 10) * 0.001 : -52.0;
    feats.push({
      id: `pm-${i}`,
      name: `PM ${i}`,
      type: i % 5 === 0 ? 'Circle' : 'Polygon',
      radius: i % 5 === 0 ? 500 : undefined,
      layerId: i % 2 === 0 ? 'l1' : 'l2',
      coordinates: i % 5 === 0
        ? [baseLat, baseLng]
        : [[baseLat, baseLng], [baseLat, baseLng + 0.002], [baseLat + 0.002, baseLng + 0.002], [baseLat + 0.002, baseLng]],
      style: { color: '#00E08A', fillColor: '#00E08A', fillOpacity: 0.3 }
    });
  }
  // Inclui uma feição sem bbox (Circle sem coordenadas válidas -> entra em noBox, sempre incluída quando visível)
  feats.push({ id: 'pm-nobox', name: 'NoBox', type: 'Point', layerId: 'l1', coordinates: null, style: {} });

  const bounds = { north: -15.75, south: -15.85, east: -47.85, west: -47.95 };
  const resolveCtx = PrintViewResolver.prepare({}, { features: feats, layers });

  // Referência linear direta (< threshold simulado chamando slice e comparando IDs, ou cálculo manual exato)
  const expectedOrder = new Map(layers.map((l, i) => [l.id, i]));
  const linearPlan = [];
  for (let idx = 0; idx < feats.length; idx++) {
    const f = feats[idx];
    if (!PrintMapRenderer.intersects(PrintMapRenderer.bboxOf(f), bounds)) continue;
    linearPlan.push({ id: f.id, idx, layerOrder: expectedOrder.get(f.layerId) });
  }
  linearPlan.sort((a, b) => (b.layerOrder - a.layerOrder) || (a.idx - b.idx));

  // Chamada 1 constrói R-Tree; Chamada 2 acerta cache
  const rtreePlan1 = PrintMapRenderer.plan({ features: feats, layers, bounds, resolveCtx });
  const rtreePlan2 = PrintMapRenderer.plan({ features: feats, layers, bounds, resolveCtx });

  assert.deepStrictEqual(
    rtreePlan1.items.map(it => it.f.id),
    linearPlan.map(x => x.id),
    'R-Tree plan (cold) deve ter paridade exata de IDs e ordenação com a varredura linear'
  );
  assert.deepStrictEqual(
    rtreePlan2.items.map(it => it.f.id),
    linearPlan.map(x => x.id),
    'R-Tree plan (warm cache) deve manter paridade exata'
  );
  assert.ok(rtreePlan1.items.some(it => it.f.id === 'pm-nobox'), 'feição com bbox null (noBox) deve ser preservada');
}

// 5. ShortcutsController.selectAll com índice Map por camada
{
  let selectedIdsArg = null;
  let selectedFeatsArg = null;
  const mockApp = {
    layers: [
      { id: 'vis', visible: true },
      { id: 'hid', visible: false },
      { id: 'def' }
    ],
    features: [
      { id: 'a1', layerId: 'vis', visible: true },
      { id: 'a2', layerId: 'vis', visible: false },
      { id: 'b1', layerId: 'hid', visible: true },
      { id: 'c1', layerId: 'def' }
    ],
    mapEngine: { selectFeatures: (ids) => { selectedIdsArg = ids; } },
    layerPanel: { setSelectedFeatures: (feats) => { selectedFeatsArg = feats; } }
  };
  ShortcutsController.selectAll(mockApp);
  assert.deepStrictEqual(selectedIdsArg, ['a1', 'c1'], 'selectAll deve incluir apenas feições/camadas visíveis');
  assert.deepStrictEqual(selectedFeatsArg.map(f => f.id), ['a1', 'c1']);
}

// 6. Carregamento assíncrono preguiçoso de parsers pesados (DWG/DXF e Shapefile)
{
  assert.strictEqual(typeof GeoFormats.parseCad, 'function');
  assert.strictEqual(typeof GeoFormats.parseShapefile, 'function');
  assert.strictEqual(typeof GeoFormats.toShapefileZip, 'function');
  const dxf = '0\nSECTION\n2\nENTITIES\n0\nPOINT\n8\n0\n10\n-47.9\n20\n-15.8\n0\nENDSEC\n0\nEOF';
  const parsed = await GeoFormats.parseCad(dxf, 'point.dxf', { sourceProjection: 'EPSG:4326' });
  assert.ok(parsed && Array.isArray(parsed.features) && parsed.features.length === 1, 'parseCad lazy deve carregar DwgDxfParser e extrair entidade');
  const zip = await GeoFormats.toShapefileZip([{
    id: 'shp-1',
    name: 'Area Teste',
    type: 'Polygon',
    coordinates: [[[-15.8, -47.9], [-15.8, -47.89], [-15.79, -47.89], [-15.8, -47.9]]]
  }], 'teste_lazy');
  assert.ok(zip && (zip.size > 0 || zip.byteLength > 0), 'toShapefileZip lazy deve carregar ShapefileParser e JSZip');
}

StorageService.discardPendingWrites?.();
console.log('OK - Otimizacoes de performance validadas.');
