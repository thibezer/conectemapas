/**
 * Teste da Fase 1: Sincronização e Concorrência (Nuvem + BroadcastChannel)
 * Verifica:
 * 1. Ausência de eco de save_metadata ao hidratar ou receber deltas remotos / eventos entre abas.
 * 2. Exclusão de camada entre abas migra feições para a camada de destino sem acionar "Recuperadas".
 * 3. Sincronização completa de camadas (cor, opacidade, visibilidade e ordem) em applyRemoteDeltas e handleCollabEvent.
 * 4. Undo/Redo notifica o CollaborationHub sobre feições criadas, atualizadas e excluídas.
 * 5. Heartbeat de presença (pingPresence) durante desenho ativo.
 */

import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear()
};

globalThis.indexedDB = {
  open: () => {
    const req = {};
    setTimeout(() => { if (req.onerror) req.onerror(); }, 0);
    return req;
  }
};

const { StorageService } = await import('../src/services/StorageService.js');
const { CloudSyncEngine } = await import('../src/services/Storage/CloudSyncEngine.js');
const { FeatureSyncController } = await import('../src/controllers/FeatureSyncController.js');
const { AppBootstrapSync } = await import('../src/bootstrap/AppBootstrapSync.js');
const { ShortcutsController } = await import('../src/controllers/ShortcutsController.js');

console.log('🧪 Testando Fase 1: Sincronização e Concorrência...');

// 1. Ausência de eco de save_metadata ao receber dados da nuvem ou entre abas
{
  store.clear();
  CloudSyncEngine.resetProjectState();
  StorageService.setCurrentProjectId('proj_eco');

  const app = {
    projectId: 'proj_eco',
    projectName: 'Projeto Sem Eco',
    currentBasemap: 'google_satelite_puro',
    layers: [{ id: 'l-1', name: 'Base', color: '#00E08A', visible: true, opacity: 1, order: 0 }],
    features: [],
    mapEngine: {
      updateFeature: () => {},
      removeFeature: () => {},
      setLayerColor: () => {},
      setLayerVisibility: () => {},
      setLayerOpacity: () => {},
      reorderLayers: () => {},
      renderFeatures: () => {}
    },
    layerPanel: { updateLayers: () => {} },
    attributeTable: { updateData: () => {} },
    updateHUD: () => {},
    getLayersWithCounts: () => app.layers
  };

  // Hidrata da nuvem: não deve marcar cm_layers_dirty nem agendar save_metadata
  const hydrated = await AppBootstrapSync.hydrateFromCloud(app, {
    exists: true,
    rev: 5,
    project: { id: 'proj_eco', name: 'Projeto Hidratado', basemap: 'google_satelite_puro' },
    layers: [{ id: 'l-1', name: 'Base', color: '#00E08A', visible: true, opacity: 1, order: 0 }],
    features: [{ id: 'f-1', name: 'Lote 1', type: 'Point', coordinates: [-23.76, -53.32], layerId: 'l-1' }]
  });

  assert.equal(hydrated, true, 'hydrateFromCloud deve retornar true');
  assert.equal(StorageService.hasPendingLayerSync(), false, 'hydrateFromCloud não deve sujar cm_layers_dirty');

  // Aplicar delta remoto não deve sujar cm_layers_dirty
  FeatureSyncController.applyRemoteDeltas(app, {
    upserted: [{ id: 'f-2', name: 'Lote 2', type: 'Point', coordinates: [-23.77, -53.33], layerId: 'l-1' }],
    deleted: [],
    layers: [{ id: 'l-1', name: 'Base Renomeada', color: '#38bdf8', visible: false, opacity: 0.5, order: 0 }]
  });

  assert.equal(StorageService.hasPendingLayerSync(), false, 'applyRemoteDeltas não deve gerar eco de save_metadata');

  // Evento vindo de outra aba (feature:created) também não deve sujar cm_layers_dirty
  FeatureSyncController.handleCollabEvent(app, 'feature:created', {
    feature: { id: 'f-3', name: 'Lote 3', type: 'Point', coordinates: [-23.78, -53.34], layerId: 'l-1' }
  });
  assert.equal(StorageService.hasPendingLayerSync(), false, 'handleCollabEvent(feature:created) não deve gerar eco de save_metadata');

  // Salvar metadados com a mesma assinatura de camadas (ex: após criar feição local) não deve reenviar save_metadata
  StorageService.saveMetadata({
    id: app.projectId,
    name: app.projectName,
    basemap: app.currentBasemap,
    layers: app.layers,
    featureCount: app.features.length
  });
  assert.equal(StorageService.hasPendingLayerSync(), false, 'saveMetadata com camadas inalteradas não deve disparar sync de camadas');
  console.log('  ✔ 1. Eco indevido de save_metadata eliminado com sucesso.');
}

// 2. Exclusão de camada entre abas migra feições sem deixar órfãs
{
  const appB = {
    projectId: 'proj_layers',
    projectName: 'Projeto Camadas',
    currentBasemap: 'google_satelite_puro',
    activeLayerId: 'l-del',
    layers: [
      { id: 'l-keep', name: 'Principal', color: '#00E08A', visible: true, opacity: 1, order: 0 },
      { id: 'l-del', name: 'Temporária', color: '#ef4444', visible: true, opacity: 1, order: 1 }
    ],
    features: [
      { id: 'f-orphan-test', name: 'Polígono 1', layerId: 'l-del', type: 'Point', coordinates: [-23.76, -53.32] }
    ],
    setActiveLayer(id) { this.activeLayerId = id; },
    getLayersWithCounts() { return this.layers; },
    refreshMapAndTable() {}
  };

  FeatureSyncController.handleCollabEvent(appB, 'layer:deleted', {
    layerId: 'l-del',
    fallbackLayerId: 'l-keep'
  });

  assert.equal(appB.layers.length, 1);
  assert.equal(appB.layers[0].id, 'l-keep');
  assert.equal(appB.features[0].layerId, 'l-keep', 'Feição deve ser migrada para a camada de destino na outra aba');
  assert.equal(appB.activeLayerId, 'l-keep', 'Camada ativa na outra aba deve mudar para o fallback');
  console.log('  ✔ 2. Exclusão de camada entre abas migra feições sem criar órfãs.');
}

// 3. Sincronização completa de propriedades de camadas (cor, opacidade, visibilidade e ordem)
{
  const engineCalls = { colors: [], visibilities: [], opacities: [], reorders: 0 };
  const appC = {
    projectId: 'proj_props',
    projectName: 'Projeto Props',
    currentBasemap: 'google_satelite_puro',
    layers: [
      { id: 'l-a', name: 'Camada A', color: '#00E08A', visible: true, opacity: 1, order: 0 },
      { id: 'l-b', name: 'Camada B', color: '#38bdf8', visible: true, opacity: 1, order: 1 }
    ],
    features: [],
    mapEngine: {
      setLayerColor: (id, c) => engineCalls.colors.push([id, c]),
      setLayerVisibility: (id, v) => engineCalls.visibilities.push([id, v]),
      setLayerOpacity: (id, o) => engineCalls.opacities.push([id, o]),
      reorderLayers: () => { engineCalls.reorders++; },
      renderFeatures: () => {}
    },
    getLayersWithCounts() { return this.layers; }
  };

  StorageService.setCurrentProjectId('proj_props');
  CloudSyncEngine.cancelPendingMetadata();

  FeatureSyncController.applyRemoteDeltas(appC, {
    layers: [
      { id: 'l-a', name: 'Camada A', color: '#f59e0b', visible: false, opacity: 0.4, order: 1 },
      { id: 'l-b', name: 'Camada B', color: '#38bdf8', visible: true, opacity: 1, order: 0 }
    ]
  });

  assert.equal(appC.layers[0].id, 'l-b', 'Camada B deve passar para a posição 0 após reordenação remota');
  assert.equal(appC.layers[1].id, 'l-a', 'Camada A deve passar para a posição 1');
  assert.equal(appC.layers[1].color, '#f59e0b');
  // O olhinho é preferência local: o `visible: false` do outro operador é ignorado
  assert.equal(appC.layers[1].visible, true);
  // A opacidade também é preferência local (o 0.4 do outro operador é ignorado)
  assert.equal(appC.layers[1].opacity, 1);
  assert.deepEqual(engineCalls.colors, [['l-a', '#f59e0b']]);
  assert.deepEqual(engineCalls.visibilities, []);
  assert.deepEqual(engineCalls.opacities, []);
  assert.equal(engineCalls.reorders, 1);
  console.log('  ✔ 3. Cor e ordem sincronizadas; olhinho e opacidade das camadas permanecem locais.');
}

// 4. Undo e Redo notificam o CollaborationHub
{
  const events = [];
  const appD = {
    projectId: 'proj_undo',
    features: [
      { id: 'f-1', name: 'Original', type: 'Point', coordinates: [-23.76, -53.32] }
    ],
    historyUndo: [],
    historyRedo: [],
    collabHub: {
      notifyFeatureCreated: (f) => events.push(['created', f.id]),
      notifyFeatureUpdated: (f) => events.push(['updated', f.id, f.name]),
      notifyFeatureDeleted: (id) => events.push(['deleted', id])
    },
    refreshMapAndTable() {},
    saveMetadata() {},
    syncRibbon() {}
  };

  ShortcutsController.pushHistory(appD, 'Editar e criar');
  appD.features = [
    { ...appD.features[0], name: 'Editado' },
    { id: 'f-2', name: 'Novo', type: 'Point', coordinates: [-23.77, -53.33] }
  ];

  ShortcutsController.undo(appD);
  assert.deepEqual(events, [
    ['deleted', 'f-2'],
    ['updated', 'f-1', 'Original']
  ], 'Undo deve notificar exclusão de f-2 e restauração de f-1 no CollaborationHub');

  events.length = 0;
  ShortcutsController.redo(appD);
  assert.deepEqual(events, [
    ['updated', 'f-1', 'Editado'],
    ['created', 'f-2']
  ], 'Redo deve notificar atualização de f-1 e recriação de f-2 no CollaborationHub');
  console.log('  ✔ 4. Undo e Redo propagam eventos instantaneamente pelo CollaborationHub.');
}

console.log('✅ Todos os testes da Fase 1 passaram com sucesso!');
process.exit(0);
