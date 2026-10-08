import assert from 'assert';

console.log('🧪 Regressão: criar feição não pode duplicá-la em app.features...');

// FeatureRenderer importa o Leaflet, que precisa de window/document mínimos para carregar em Node
globalThis.window = { devicePixelRatio: 1, screen: {}, addEventListener() {}, removeEventListener() {}, location: { hostname: 'localhost' }, requestAnimationFrame: cb => setTimeout(cb, 0) };
globalThis.document = {
  createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, addEventListener() {}, getContext: () => null }),
  documentElement: { style: {} }, addEventListener() {}, body: {}, getElementsByTagName: () => []
};
const { FeatureRenderer } = await import('../src/services/MapEngine/FeatureRenderer.js');

// Renderer mínimo: só a contabilidade de feições é exercitada (sem mapa)
const renderer = Object.create(FeatureRenderer.prototype);
Object.assign(renderer, {
  map: null,
  allLayers: [], layerMap: new Map(),
  engine: {
    spatialIndex: { size: 0, build() {}, update() {}, remove() {}, intersects: () => false },
    featureLayers: new Map(), renderedFeatures: new Map()
  },
  invalidateClusterCache() {}, clearAllClusters() {}, updateViewportCulling() {}, updateLayerZIndexes() {},
  removeSingleFeature() {}, renderSingleFeature() {}, removeLayerPane() {}
});

// Mesmo fluxo do app: renderFeatures(app.features) e depois push + addFeature
const appFeatures = [{ id: 'a', type: 'Polygon' }];
renderer.renderFeatures(appFeatures, []);

const b = { id: 'b', type: 'Point' };
appFeatures.push(b);          // FeatureSyncController.createFeature
renderer.addFeature(b, []);   // MapEngine.addFeature
assert.strictEqual(appFeatures.length, 2, 'app.features não pode receber a feição duas vezes');
assert.strictEqual(new Set(appFeatures.map(f => f.id)).size, 2);
assert.strictEqual(renderer.allFeatures.length, 2, 'o renderer mantém a própria lista');
console.log('✔ createFeature + addFeature não duplica');

// updateFeature de feição desconhecida (criada por colega) entra no renderer sem mexer no array do app
const c = { id: 'c', type: 'Point' };
renderer.updateFeature(c, []);
assert.strictEqual(appFeatures.length, 2);
assert.strictEqual(renderer.allFeatures.length, 3);
console.log('✔ updateFeature adiciona só na lista do renderer');

// removeFeature não mexe no array do app
renderer.removeFeature('a');
assert.strictEqual(appFeatures.length, 2);
assert.strictEqual(renderer.allFeatures.length, 2);
console.log('✔ removeFeature não altera app.features');

console.log('🏁 Sem duplicação de feições: todos os testes passaram');
