// Mock mínimo para ambiente Node.js
globalThis.window = {
  requestAnimationFrame: (cb) => setTimeout(cb, 0),
  location: { hostname: 'localhost', search: '?project=test-layers' },
  devicePixelRatio: 1,
  screen: {},
  addEventListener: () => {},
  removeEventListener: () => {}
};
globalThis.document = {
  createElement: () => ({ setAttribute: () => {}, style: {}, appendChild: () => {} }),
  documentElement: { style: {} },
  body: { appendChild: () => {} },
  addEventListener: () => {},
  removeEventListener: () => {},
  getElementById: () => null
};
globalThis.HTMLElement = class {};
globalThis.customElements = { define: () => {}, get: () => null };

import assert from 'assert';
const { FeatureSyncController } = await import('../src/controllers/FeatureSyncController.js');
const { ProjectActionsController } = await import('../src/controllers/ProjectActionsController.js');

console.log('--- Testando Seleção de Camadas Ativas e Desenhos Associados ---');

// Mock da Aplicação ConecteMapas
class MockApp {
  constructor() {
    this.projectId = 'test-proj-layers';
    this.projectName = 'Projeto Teste Camadas';
    this.layers = [
      { id: 'layer-topografia', name: 'Topografia', color: '#00E08A', visible: true, locked: false, order: 0 },
      { id: 'layer-meio-ambiente', name: 'Ambiental', color: '#38bdf8', visible: true, locked: false, order: 1 },
      { id: 'layer-infra', name: 'Infraestrutura', color: '#f59e0b', visible: true, locked: false, order: 2 }
    ];
    this.activeLayerId = this.layers[0].id; // Inicialmente 'layer-topografia'
    this.features = [];
    this.history = [];
    this.auditLog = [];

    this.layerPanelUpdateCount = 0;
    this.layerPanel = {
      setActiveLayerId: (id) => { this._panelActiveId = id; },
      setSelectedFeature: () => {},
      updateLayers: () => { this.layerPanelUpdateCount++; },
      updateAuditLog: () => {}
    };

    this.drawingToolbar = {
      setActiveLayer: (layer) => { this._toolbarActiveLayer = layer; }
    };

    this.newFeatureModal = {
      setActiveLayerId: (id) => { this._modalActiveId = id; },
      updateLayers: () => {}
    };

    this.mapEngine = {
      setActiveDrawingLayer: (layer) => { this._mapActiveLayer = layer; },
      calculatePolygonArea: () => 10000,
      calculatePolylineLength: () => 500,
      addFeature: () => {},
      updateFeature: () => {},
      removeFeature: () => {}
    };

    this.collabHub = {
      notifyFeatureCreated: () => {},
      notifyFeatureUpdated: () => {},
      notifyFeatureDeleted: () => {},
      notifyLayerCreated: () => {},
      notifyLayerDeleted: () => {},
      logAudit: (action, id) => ({ id: 'aud-' + Date.now(), action, targetId: id })
    };
  }

  setActiveLayer(layerId) {
    const layer = this.layers.find(l => l.id === layerId) || this.layers[0];
    if (!layer) return;
    this.activeLayerId = layer.id;

    if (this.layerPanel) this.layerPanel.setActiveLayerId(layer.id);
    if (this.mapEngine) this.mapEngine.setActiveDrawingLayer(layer);
    if (this.drawingToolbar) this.drawingToolbar.setActiveLayer(layer);
    if (this.newFeatureModal) this.newFeatureModal.setActiveLayerId(layer.id);
  }

  getLayersWithCounts() {
    return this.layers.map(l => ({
      ...l,
      featureCount: this.features.filter(f => f.layerId === l.id).length
    }));
  }

  pushHistory(desc) {
    this.history.push(desc);
  }

  saveFeature(f) {}
  removeFeature(id) {}
  saveMetadata() {}
  updateHUD() {}
  refreshMapAndTable() {}
}

const app = new MockApp();

// 1. Verificação da Camada Ativa Inicial
console.log('1. Verificando camada ativa inicial...');
assert.strictEqual(app.activeLayerId, 'layer-topografia');
console.log('✔ Camada ativa inicial é Topografia.');

// 2. Desenho sem especificar camada vai automaticamente para a camada ativa
console.log('2. Criando desenho sem layerId explícito...');
const feat1 = FeatureSyncController.createFeature(app, {
  type: 'Point',
  coordinates: [-23.7661, -53.3206],
  name: 'Ponto 1'
}, { notifyToast: false });

assert.strictEqual(feat1.layerId, 'layer-topografia', 'Feição 1 deve ser atribuída à camada ativa Topografia');
assert.strictEqual(feat1.color, '#00E08A', 'Cor deve ser herdada da camada ativa Topografia');
console.log('✔ Feição 1 salva com sucesso na camada ativa "layer-topografia".');

// 3. Mudando de camada ativa para 'layer-meio-ambiente'
console.log('3. Mudando a camada ativa para "layer-meio-ambiente"...');
app.setActiveLayer('layer-meio-ambiente');
assert.strictEqual(app.activeLayerId, 'layer-meio-ambiente');
assert.strictEqual(app._panelActiveId, 'layer-meio-ambiente');
assert.strictEqual(app._mapActiveLayer.id, 'layer-meio-ambiente');
assert.strictEqual(app._toolbarActiveLayer.id, 'layer-meio-ambiente');

// 4. Novos desenhos agora devem ir automaticamente para 'layer-meio-ambiente'
console.log('4. Criando polígono e linha após mudança de camada...');
const feat2 = FeatureSyncController.createFeature(app, {
  type: 'Polygon',
  coordinates: [[-23.76, -53.32], [-23.76, -53.31], [-23.75, -53.31]],
  name: 'Área Preservação'
}, { notifyToast: false });

const feat3 = FeatureSyncController.createFeature(app, {
  type: 'LineString',
  coordinates: [[-23.76, -53.32], [-23.75, -53.31]],
  name: 'Córrego'
}, { notifyToast: false });

assert.strictEqual(feat2.layerId, 'layer-meio-ambiente', 'Polígono deve ser salvo em layer-meio-ambiente');
assert.strictEqual(feat2.color, '#38bdf8', 'Polígono deve herdar cor azul da camada ambiental');
assert.strictEqual(feat3.layerId, 'layer-meio-ambiente', 'Linha deve ser salva em layer-meio-ambiente');
assert.strictEqual(feat3.color, '#38bdf8', 'Linha deve herdar cor azul da camada ambiental');
console.log('✔ Polígono e Linha salvos automaticamente na camada ativa "layer-meio-ambiente"!');

// 5. Criação de nova camada e ativação automática
console.log('5. Criando nova camada "Loteamento Residencial"...');
ProjectActionsController.createLayer(app, {
  name: 'Loteamento Residencial',
  color: '#ec4899'
});

const novaCamada = app.layers.find(l => l.name === 'Loteamento Residencial');
assert(novaCamada, 'A nova camada deve existir no array de camadas');
assert.strictEqual(app.activeLayerId, novaCamada.id, 'A nova camada deve se tornar a ativa imediatamente');
console.log('✔ Nova camada criada e definida automaticamente como ativa para novos desenhos.');

// 6. Desenho na nova camada ativa
const feat4 = FeatureSyncController.createFeature(app, {
  type: 'Point',
  coordinates: [-23.765, -53.315],
  name: 'Vértice Quadra 01'
}, { notifyToast: false });
assert.strictEqual(feat4.layerId, novaCamada.id);
assert.strictEqual(feat4.color, '#ec4899');
console.log('✔ Desenho salvo na nova camada recém-criada.');

// 7. Modificação de camada de uma feição existente (migração)
console.log('7. Alterando a camada da feição 1 de Topografia para Infraestrutura...');
const initialPanelCount = app.layerPanelUpdateCount;
feat1.layerId = 'layer-infra';
FeatureSyncController.updateFeature(app, feat1);
assert.strictEqual(app.features[0].layerId, 'layer-infra');
assert(app.layerPanelUpdateCount > initialPanelCount, 'updateLayers no layerPanel deve ter sido chamado');
console.log('✔ Feição migrada de camada e árvore de camadas atualizada com sucesso.');

// 8. Exclusão de camada ativa com migração de feições e fallback de camada ativa
console.log('8. Excluindo camada ativa e verificando transição...');
const camadaExcluidaId = app.activeLayerId;
ProjectActionsController.deleteLayer(app, camadaExcluidaId);
assert(!app.layers.some(l => l.id === camadaExcluidaId), 'Camada excluída não deve mais existir');
assert(app.activeLayerId !== camadaExcluidaId, 'Camada ativa deve ter mudado para outra camada válida');
assert(app.layers.some(l => l.id === app.activeLayerId), 'Nova camada ativa deve existir no projeto');
console.log(`✔ Camada ativa excluída com sucesso; nova camada ativa: "${app.activeLayerId}".`);

console.log('\n======================================================');
console.log('🎉 TODOS OS TESTES DE CAMADAS E DESENHOS PASSARAM COM 100% DE SUCESSO!');
console.log('======================================================');
