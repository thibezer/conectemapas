// Tombstones em cache: exclusão em lote grava uma vez; regravar a feição (único ou lote) remove a marca
import assert from 'assert';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); }
};

const { LocalStore } = await import('../src/services/Storage/LocalStore.js');
const { DeltaQueue } = await import('../src/services/Storage/DeltaQueue.js');

LocalStore.addLocalTombstones(['a', 'b', 'c'], 'p');
assert.ok(LocalStore.hasLocalTombstone('b', 'p'));

// Edição externa do localStorage (outra aba) é respeitada pelo cache
store.set('cm_tombstones_p', JSON.stringify(['z']));
assert.ok(LocalStore.hasLocalTombstone('z', 'p') && !LocalStore.hasLocalTombstone('a', 'p'));

LocalStore.addLocalTombstones(['a', 'b'], 'p');
DeltaQueue.queueFeatureUpsert({ id: 'a', type: 'Point', coordinates: [1, 2] }, 'p');
assert.ok(!LocalStore.hasLocalTombstone('a', 'p'), 'upsert único remove a tombstone');
DeltaQueue.queueFeaturesBulkUpsert([{ id: 'b', type: 'Point', coordinates: [1, 2] }], 'p');
assert.ok(!LocalStore.hasLocalTombstone('b', 'p'), 'upsert em lote remove a tombstone');
assert.ok(LocalStore.hasLocalTombstone('z', 'p'));

DeltaQueue.discardPending();
console.log('✔ tombstones em cache e remoção ao regravar');
