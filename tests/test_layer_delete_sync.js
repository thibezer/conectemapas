import assert from 'assert';
import fs from 'fs';

const createMockEl = () => ({
  setAttribute: () => {},
  getAttribute: () => null,
  style: {},
  classList: { add: () => {}, remove: () => {} },
  textContent: '',
  addEventListener: () => {},
  removeEventListener: () => {}
});

globalThis.window = {
  requestAnimationFrame: (cb) => setTimeout(cb, 0),
  location: { hostname: 'localhost' },
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

const { FeatureSyncController } = await import('../src/controllers/FeatureSyncController.js');

console.log('--- Exclusão de camada propagada entre dispositivos ---');

// 1. Cliente: tombstone de camada vindo do pull remove a camada e move as feições
let refreshed = 0;
const app = {
  projectId: 'test_layer_delete',
  layers: [{ id: 'layer-a', name: 'A' }, { id: 'layer-b', name: 'B' }],
  features: [{ id: 'f-1', name: 'F1', type: 'Point', layerId: 'layer-b', coordinates: [-23.7, -53.3] }],
  activeLayerId: 'layer-a',
  mapEngine: { updateFeature: () => {}, removeFeature: () => {} },
  attributeTable: { updateData: () => {} },
  layerPanel: { updateLayers: () => {} },
  newFeatureModal: { updateLayers: () => {} },
  updateHUD: () => {},
  refreshMapAndTable: () => { refreshed++; },
  getLayersWithCounts: () => app.layers
};

FeatureSyncController.applyRemoteDeltas(app, {
  layers: [{ id: 'layer-b', name: 'B', deleted: true }]
});
assert.deepStrictEqual(app.layers.map(l => l.id), ['layer-a'], 'camada excluída remotamente deve sair da lista');
assert.strictEqual(app.features[0].layerId, 'layer-a', 'feições da camada excluída vão para a camada restante');
assert.ok(refreshed > 0, 'mapa/tabela devem ser redesenhados');
console.log('✔ tombstone remoto remove a camada e move as feições');

// 2. A última camada nunca é removida por um tombstone remoto
FeatureSyncController.applyRemoteDeltas(app, {
  layers: [{ id: 'layer-a', name: 'A', deleted: true }]
});
assert.deepStrictEqual(app.layers.map(l => l.id), ['layer-a'], 'não pode ficar sem camadas');
console.log('✔ última camada preservada');

// 3. Tombstone de camada desconhecida não a cria
FeatureSyncController.applyRemoteDeltas(app, {
  layers: [{ id: 'layer-x', name: 'X', deleted: true }]
});
assert.ok(!app.layers.some(l => l.id === 'layer-x'), 'tombstone não cria camada');
console.log('✔ tombstone de camada desconhecida é ignorado');

// 4. Contrato do servidor (api.php não roda no teste: confere os pontos essenciais)
const api = fs.readFileSync(new URL('../public/api.php', import.meta.url), 'utf8');
assert.match(api, /case 'delete_layer':/, 'ação delete_layer');
assert.match(api, /ALTER TABLE cm_layers ADD COLUMN deleted/, 'migração da coluna deleted');
assert.match(api, /WHERE project_id = \? AND deleted = 0\s+ORDER BY order_idx/, 'load não devolve camadas excluídas');
assert.match(api, /\(int\)\$existing\['deleted'\] === 1\) continue;/, 'save_metadata não ressuscita camada excluída');
assert.match(api, /order_idx AS `order`, updated_at, rev, deleted/, 'pull devolve o tombstone');
console.log('✔ api.php: tombstone de camada presente');

console.log('--- Teste concluído ---');
