// Camadas recolhidas no painel sobrevivem ao F5 (preferência local em localStorage).
import assert from 'assert';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k)
};
const { loadCollapsedLayers, saveCollapsedLayers } = await import('../src/services/Storage/LayerExpansion.js');

assert.strictEqual(loadCollapsedLayers().size, 0);

// a e c recolhidas; b expandida
saveCollapsedLayers(['a', 'b', 'c'], new Set(['b']));
assert.deepStrictEqual([...loadCollapsedLayers()].sort(), ['a', 'c']);

// reabrir a: sai do registro; "x" (outro projeto, não carregada) é preservada
saveCollapsedLayers(['x'], new Set());
saveCollapsedLayers(['a', 'b', 'c'], new Set(['a', 'b']));
assert.deepStrictEqual([...loadCollapsedLayers()].sort(), ['c', 'x']);

// storage corrompido não quebra
store.set('cm_collapsed_layers', '{ruim');
assert.strictEqual(loadCollapsedLayers().size, 0);

console.log('✅ test_layer_expansion_local OK');
