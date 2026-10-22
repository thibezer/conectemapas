// Rajada de eventos remotos (feature:created / feature:deleted): o painel de camadas é reconstruído uma vez só
const noop = () => {};
const el = () => ({ setAttribute: noop, getAttribute: () => null, style: {}, classList: { add: noop, remove: noop }, textContent: '', appendChild: noop, addEventListener: noop, removeEventListener: noop });
globalThis.window = { requestAnimationFrame: (cb) => setTimeout(cb, 0), location: { hostname: 'localhost', search: '?project=coalesce' }, devicePixelRatio: 1, screen: {}, addEventListener: noop, removeEventListener: noop };
globalThis.document = { createElement: el, documentElement: { style: {} }, body: { appendChild: noop }, addEventListener: noop, removeEventListener: noop, getElementById: el, querySelector: el, querySelectorAll: () => [] };

globalThis.HTMLElement = class {};
globalThis.customElements = { define: noop, get: () => null };

import assert from 'assert';
const { FeatureSyncController } = await import('../src/controllers/FeatureSyncController.js');
const { StorageService } = await import('../src/services/StorageService.js');
StorageService.applyRemoteChangesLocally = noop;
StorageService.saveMetadata = noop;

console.log('🧪 Coalescência do painel de camadas em eventos remotos...');

let panelUpdates = 0;
let tableUpdates = 0;
const app = {
  projectId: 'coalesce', projectName: 'c', currentBasemap: 'osm',
  layers: [{ id: 'l1', name: 'L', color: '#fff' }],
  features: [],
  mapEngine: { updateFeature: noop, removeFeature: noop },
  attributeTable: { updateData: () => { tableUpdates++; } },
  layerPanel: { updateLayers: () => { panelUpdates++; }, handleSelectedFeatureRemoved: noop },
  updateHUD: noop,
  getLayersWithCounts: () => app.layers.map(l => ({ ...l, featureCount: app.features.length }))
};

for (let i = 0; i < 200; i++) {
  FeatureSyncController.handleCollabEvent(app, 'feature:created', { feature: { id: `r${i}`, type: 'Point', layerId: 'l1', coordinates: [-23.5, -46.6] } });
}
assert.strictEqual(app.features.length, 200, 'todas as feições entram na memória na hora');
assert.strictEqual(tableUpdates, 200, 'a tabela segue atualizada a cada evento (é barata)');
assert.strictEqual(panelUpdates, 0, 'o painel ainda não foi reconstruído dentro da janela');

await new Promise(r => setTimeout(r, 250));
assert.strictEqual(panelUpdates, 1, 'uma única reconstrução para a rajada inteira');

for (let i = 0; i < 100; i++) FeatureSyncController.handleCollabEvent(app, 'feature:deleted', { featureId: `r${i}` });
await new Promise(r => setTimeout(r, 250));
assert.strictEqual(app.features.length, 100);
assert.strictEqual(panelUpdates, 2, 'exclusões em rajada também viram uma reconstrução');

// A atualização agendada enxerga o estado final
let lastCount = null;
app.layerPanel.updateLayers = (layers) => { lastCount = layers[0].featureCount; };
FeatureSyncController.handleCollabEvent(app, 'feature:created', { feature: { id: 'z1', type: 'Point', layerId: 'l1', coordinates: [-23.5, -46.6] } });
FeatureSyncController.handleCollabEvent(app, 'feature:created', { feature: { id: 'z2', type: 'Point', layerId: 'l1', coordinates: [-23.5, -46.6] } });
await new Promise(r => setTimeout(r, 250));
assert.strictEqual(lastCount, 102, 'a contagem do painel reflete todos os eventos da janela');

console.log('✅ Coalescência do painel de camadas passou!');
