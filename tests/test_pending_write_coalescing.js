// Deltas pendentes: gravações agrupadas (1 setItem por rajada) e painel de camadas preserva colapso
import assert from 'assert';

const store = new Map();
let setCount = 0;
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { setCount++; store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); }
};

const { LocalStore } = await import('../src/services/Storage/LocalStore.js');
const { LayerTreeTab } = await import('../src/components/LayerPanel/LayerTreeTab.js');

const key = 'cm_pending_deltas_p';
const baseline = setCount;
for (let i = 0; i < 200; i++) {
  LocalStore.persistPendingDeltasWithItems([{ id: `f${i}`, type: 'Point', coordinates: [i, i] }], [], 'p', 'p');
}
LocalStore.persistPendingDeltasWithItems([], ['f0'], 'p', 'p');
assert.strictEqual(setCount, baseline, 'nenhuma gravação síncrona por edição');

// Leitura força a gravação pendente e fica consistente
const pending = LocalStore.readPendingDeltas('p');
assert.strictEqual(setCount, baseline + 1, 'uma única gravação para a rajada');
assert.strictEqual(pending.dirty.length, 199);
assert.deepStrictEqual(pending.deleted, ['f0']);
assert.ok(LocalStore.getOfflinePendingIds('p').has('f5'));

// clear descarta o que ainda está na fila
LocalStore.persistPendingDeltasWithItems([{ id: 'x', type: 'Point', coordinates: [0, 0] }], [], 'p', 'p');
LocalStore.clearPendingDeltas('p', 'p');
assert.strictEqual(LocalStore.readPendingDeltas('p').dirty.length, 0);
assert.ok(!store.has(key));

// ui-camadas: definirCamadas reexpande tudo (persistir=false); syncData mantém o colapsado
const el = {
  camadas: [{ id: 'a' }, { id: 'b' }],
  expandedLayers: new Set(['a']), // 'b' colapsada
  emLote(fn) { fn(); },
  definirCamadas(layers) {
    this.camadas = layers.slice();
    layers.forEach(l => this.expandedLayers.add(l.id));
  }
};
LayerTreeTab.syncData(el, [{ id: 'a' }, { id: 'b' }, { id: 'c' }], []);
assert.ok(el.expandedLayers.has('a'));
assert.ok(!el.expandedLayers.has('b'), 'camada colapsada continua colapsada');
assert.ok(el.expandedLayers.has('c'), 'camada nova nasce expandida');

console.log('✔ gravação agrupada de deltas e colapso preservado');
