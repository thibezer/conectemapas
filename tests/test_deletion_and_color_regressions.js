import assert from 'assert';

console.log('🧪 Iniciando testes de regressão: exclusão de formas e persistência de cores...');

const noop = () => {};
global.localStorage = {
  store: {},
  getItem(k) { return Object.prototype.hasOwnProperty.call(this.store, k) ? this.store[k] : null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
  clear() { this.store = {}; }
};
globalThis.window = { innerWidth: 1920, innerHeight: 1080, addEventListener: noop, removeEventListener: noop, location: { search: '', hash: '', href: 'http://localhost/' } };
globalThis.document = {
  createElement: () => ({ style: {}, classList: { add: noop, remove: noop, toggle: noop }, setAttribute: noop, getAttribute: () => null, appendChild: noop, addEventListener: noop, removeEventListener: noop, querySelectorAll: () => [], querySelector: () => null }),
  documentElement: { style: {} },
  body: { appendChild: noop, removeChild: noop },
  addEventListener: noop,
  removeEventListener: noop,
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  activeElement: null
};
globalThis.HTMLElement = class {};
globalThis.customElements = { define: noop, get: () => null };
globalThis.CSSStyleSheet = class { replaceSync() {} };

const { GeoCompressor } = await import('../src/services/GeoCompressor.js');
const { FeatureGeometryUtils } = await import('../src/services/MapEngine/FeatureGeometryUtils.js');
const { LocalStore } = await import('../src/services/Storage/LocalStore.js');
const { DeltaQueue } = await import('../src/services/Storage/DeltaQueue.js');
const { StorageService } = await import('../src/services/StorageService.js');
const { FeatureSyncController } = await import('../src/controllers/FeatureSyncController.js');
const { SelectionStyleController } = await import('../src/controllers/SelectionStyleController.js');
const { AppGeometryCoordinator } = await import('../src/bootstrap/AppGeometryCoordinator.js');
const { FeaturePropertiesAdapter } = await import('../src/components/LayerPanel/FeaturePropertiesAdapter.js');
const { LayerTreeTab } = await import('../src/components/LayerPanel/LayerTreeTab.js');

// --------------------------------------------------------------------------
// 1. refreshStoredMetrics não reenfileira feições por quantização de 6 casas decimais
// --------------------------------------------------------------------------
{
  global.localStorage.clear();
  DeltaQueue.discardPending('proj_test');

  const highPrecisionCoords = [
    [-23.766123456789, -53.320612345678],
    [-23.766123456789, -53.319612345678],
    [-23.767123456789, -53.319612345678],
    [-23.767123456789, -53.320612345678]
  ];
  const rawFeat = {
    id: 'feat-quant-1',
    name: 'Lote Quantizado',
    type: 'Polygon',
    layerId: 'l1',
    color: '#ff0000',
    style: { fillColor: '#ff0000', strokeColor: '#ffffff', fillOpacity: 0.35 },
    coordinates: highPrecisionCoords,
    properties: FeatureGeometryUtils.computeMetricProperties({ type: 'Polygon', coordinates: highPrecisionCoords })
  };

  // Simula gravação no IndexedDB (arredonda coordenadas para 6 casas decimais)
  const storedFeat = GeoCompressor.compactFeatureForStorage(rawFeat);
  const app = {
    projectId: 'proj_test',
    features: [storedFeat],
    layers: [{ id: 'l1', name: 'Lotes', color: '#10b981' }]
  };

  const count = FeatureSyncController.refreshStoredMetrics(app);
  assert.strictEqual(count, 0, 'Não deve regravar feição cuja diferença métrica vem apenas do arredondamento de 6 casas decimais');
  assert.strictEqual(DeltaQueue.hasPendingLocalChange('feat-quant-1'), false, 'Feição não deve entrar na fila dirty no boot');
  console.log('✔ refreshStoredMetrics ignora ruído de quantização de 6 casas decimais (não ressuscita formas nem sobrescreve cores)');
}

// --------------------------------------------------------------------------
// 2. DeltaQueue persiste sincronamente em LocalStore e removeConfirmedDeltas preserva edições em trânsito
// --------------------------------------------------------------------------
{
  global.localStorage.clear();
  DeltaQueue.discardPending('proj_sync');

  const featA = { id: 'f-a', name: 'A', type: 'Point', coordinates: [-23.76, -53.32], color: '#112233', style: { fillColor: '#112233' } };
  DeltaQueue.queueFeatureUpsert(featA, 'proj_sync');

  const pendingAfterUpsert = LocalStore.readPendingDeltas('proj_sync');
  assert.strictEqual(pendingAfterUpsert.dirty.length, 1, 'Upsert deve ir imediatamente para LocalStore');
  assert.strictEqual(pendingAfterUpsert.dirty[0].color, '#112233');

  DeltaQueue.queueFeatureDelete('f-del', 'proj_sync');
  assert.strictEqual(LocalStore.hasLocalTombstone('f-del', 'proj_sync'), true, 'queueFeatureDelete deve gravar tombstone local imediatamente');
  const pendingAfterDel = LocalStore.readPendingDeltas('proj_sync');
  assert.ok(pendingAfterDel.deleted.includes('f-del'), 'Delete deve ir imediatamente para LocalStore');

  // Simula confirmação de envio de featA com cor antiga enquanto o usuário já trocou a cor para #998877
  const featANewColor = { ...featA, color: '#998877', style: { fillColor: '#998877' } };
  LocalStore.persistPendingDeltasWithItems([featANewColor], ['f-del', 'f-del-2'], 'proj_sync', 'proj_sync');
  LocalStore.removeConfirmedDeltas([featA], ['f-del'], 'proj_sync', 'proj_sync');

  const remaining = LocalStore.readPendingDeltas('proj_sync');
  assert.strictEqual(remaining.dirty.length, 1, 'Feição modificada durante o envio deve continuar pendente');
  assert.strictEqual(remaining.dirty[0].color, '#998877', 'Nova cor não pode ser descartada pelo término do envio anterior');
  assert.deepStrictEqual(remaining.deleted, ['f-del-2'], 'Apenas a exclusão confirmada deve sair da fila');

  DeltaQueue.discardPending('proj_sync');
  console.log('✔ DeltaQueue e LocalStore.removeConfirmedDeltas preservam exclusões e cores em trânsito');
}

// --------------------------------------------------------------------------
// 3. applyRemoteDeltas persiste exclusão no banco local mesmo se a memória já havia removido
// --------------------------------------------------------------------------
{
  let recordedDeleted = null;
  const origApply = StorageService.applyRemoteChangesLocally;
  StorageService.applyRemoteChangesLocally = (_upserted, deleted) => {
    recordedDeleted = deleted;
    return Promise.resolve(true);
  };

  try {
    const app = {
      projectId: 'proj_test',
      projectName: 'Teste',
      currentBasemap: 'satelite',
      layers: [{ id: 'l1', name: 'Camada 1', color: '#00E08A' }],
      features: [] // já removido em memória via BroadcastChannel
    };
    FeatureSyncController.applyRemoteDeltas(app, { upserted: [], deleted: ['f-ghost-1'] });
    assert.deepStrictEqual(recordedDeleted, ['f-ghost-1'], 'Deve persistir exclusão remota no IndexedDB mesmo quando já ausente de app.features');
  } finally {
    StorageService.applyRemoteChangesLocally = origApply;
  }
  console.log('✔ applyRemoteDeltas grava exclusão no IndexedDB mesmo após remoção prévia em memória');
}

// --------------------------------------------------------------------------
// 4. SelectionHUD e SelectionStyleController atualizam referências após mudança de cor
// --------------------------------------------------------------------------
{
  const initialFeat = {
    id: 'f-color-1',
    name: 'Polígono 1',
    type: 'Polygon',
    layerId: 'l1',
    color: '#ff0000',
    style: { fillColor: '#ff0000', strokeColor: '#ffffff', fillOpacity: 0.4 },
    coordinates: [[-23.76, -53.32], [-23.76, -53.31], [-23.77, -53.31]]
  };

  const app = {
    projectId: 'proj_test',
    features: [initialFeat],
    layers: [{ id: 'l1', name: 'Camada 1', color: '#00E08A' }],
    history: [],
    auditLog: [],
    pushHistory(d) { this.history.push(d); },
    saveFeature: noop,
    saveFeaturesBulk: noop,
    refreshMapAndTable: noop,
    getLayersWithCounts() { return this.layers; },
    updateHUD() { AppGeometryCoordinator.updateHUD(this); },
    collabHub: { notifyFeatureUpdated: noop, logAudit: (m) => ({ m }) },
    mapEngine: { updateFeature: noop, setActiveDrawingStyles: noop },
    selectionHUD: {
      isVisible: true,
      selectedFeatures: [initialFeat], // referência antiga antes da pintura
      update(feats) { this.selectedFeatures = feats; },
      hide: noop
    },
    drawingToolbar: {
      setColors: noop,
      setMixedState: noop,
      setStrokeOnly: noop,
      setActiveColorTarget: noop,
      getColors: () => ({})
    }
  };

  // Altera a cor via BatchActions / applyColorsToSelection
  SelectionStyleController.applyColorsToSelection(app, { fillColor: '#00ff88' }, ['fillColor']);
  assert.strictEqual(app.features[0].style.fillColor, '#00ff88');
  assert.strictEqual(app.selectionHUD.selectedFeatures[0].style.fillColor, '#00ff88', 'SelectionHUD deve receber a referência atualizada com a nova cor');

  // Se o seletor de estilo do HUD for fechado clicando fora (limpando a seleção do mapa antes do aoConfirmar)
  let pickerOpts = null;
  SelectionStyleController.openStylePicker(app, app.selectionHUD.selectedFeatures, null, (o) => {
    pickerOpts = o;
    return { elemento: { obterEstado: () => ({ alvo: 'preenchimento', preenchimento: '#00ff88', traco: '#ffffff', opacidade: 0.4, espessuraTraco: 2.5 }) } };
  });

  // Simula clique fora limpando a seleção antes da confirmação do seletor
  app.selectionHUD.selectedFeatures = [];
  pickerOpts.aoConfirmar({ alvo: 'preenchimento', preenchimento: '#3366ff', traco: '#ffffff', opacidade: 0.4, espessuraTraco: 2.5 });
  assert.strictEqual(app.features[0].style.fillColor, '#3366ff', 'Confirmar ao clicar fora deve salvar a cor escolhida mesmo se a seleção do mapa foi limpa');
  DeltaQueue.discardPending('proj_test');
  console.log('✔ SelectionHUD e openStylePicker preservam a cor escolhida ao clicar fora ou editar em seguida');
}

// --------------------------------------------------------------------------
// 5. LineString abre seletor no alvo "traco" e FeaturePropertiesAdapter sincroniza draft.color
// --------------------------------------------------------------------------
{
  const lineFeat = {
    id: 'f-line-1',
    name: 'Rota 1',
    type: 'LineString',
    layerId: 'l1',
    color: '#ffaa00',
    style: { strokeColor: '#ffaa00', strokeWidth: 3 },
    coordinates: [[-23.76, -53.32], [-23.77, -53.31]]
  };
  const app = {
    features: [lineFeat],
    layers: [{ id: 'l1', name: 'Rotas', color: '#ffaa00' }],
    mapEngine: { updateFeature: noop }
  };

  let openedOpts = null;
  SelectionStyleController.openStylePicker(app, [lineFeat], null, (o) => {
    openedOpts = o;
    return { elemento: { obterEstado: () => ({ alvo: o.alvo, preenchimento: o.preenchimento, traco: o.traco, opacidade: o.opacidade, espessuraTraco: o.espessuraTraco }) } };
  });
  assert.strictEqual(openedOpts.alvo, 'traco', 'Para LineString o seletor deve abrir focado na aba de traço');

  // Inspetor: applyToDraft sincroniza draft.color
  const polyDraft = { type: 'Polygon', color: '#111111', style: { fillColor: '#111111' }, properties: {} };
  FeaturePropertiesAdapter.applyToDraft({ layers: [] }, polyDraft, 'fillColor', '#22cc88');
  assert.strictEqual(polyDraft.color, '#22cc88', 'Alterar fillColor de polígono no inspetor deve atualizar draft.color');

  const lineDraft = { type: 'LineString', color: '#111111', style: { strokeColor: '#111111' }, properties: {} };
  FeaturePropertiesAdapter.applyToDraft({ layers: [] }, lineDraft, 'strokeColor', '#ff0055');
  assert.strictEqual(lineDraft.color, '#ff0055', 'Alterar strokeColor de linha no inspetor deve atualizar draft.color');

  // LayerTreeTab: render inclui persistir="false"
  const html = LayerTreeTab.render({ currentBasemap: 'satelite', activeLayerId: 'l1', layers: [{ id: 'l1' }] });
  assert.ok(html.includes('persistir="false"'), '<ui-camadas> deve ter persistir="false" para não sobrescrever cores de camadas com cache antigo');
  console.log('✔ LineString foca no traço, Inspetor sincroniza draft.color e <ui-camadas> desativa cache conflitante');
}

console.log('🎉 Todos os testes de regressão de exclusão e cores passaram com sucesso!');
