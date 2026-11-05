// Teste de Auditoria de Confiabilidade da Área 2:
// Persistência de Dados, Sincronização Cloud & Concorrência no ConecteMapas
import assert from 'assert';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k)
};

let fetchHandler = null;
const fetchLog = [];
globalThis.fetch = async (url, opts = {}) => {
  fetchLog.push({ url: String(url), opts });
  return fetchHandler(String(url), opts);
};
const jsonRes = (data, ok = true, status = 200) => ({ ok, status, json: async () => data });

const { StorageService } = await import('../src/services/StorageService.js');
const { LocalStore } = await import('../src/services/Storage/LocalStore.js');
const { DeltaQueue } = await import('../src/services/Storage/DeltaQueue.js');
const { FeatureSyncController } = await import('../src/controllers/FeatureSyncController.js');

console.log('🧪 Iniciando Auditoria Completa da Área 2: Storage & Concurrency...');

// 1. ISOLAMENTO DE CURSOR E CACHE ENTRE PROJETOS DISTINTOS
console.log('1. Verificando isolamento atômico de cursor entre múltiplos projetos...');
LocalStore.saveSyncCursor('proj_alpha', { rev: 42, id: 'feat-a' });
LocalStore.saveSyncCursor('proj_beta', { rev: 99, id: 'feat-b' });

assert.strictEqual(LocalStore.getCachedSyncCursor('proj_alpha').rev, 42);
assert.strictEqual(LocalStore.getCachedSyncCursor('proj_alpha').id, 'feat-a');
assert.strictEqual(LocalStore.getCachedSyncCursor('proj_beta').rev, 99);
assert.strictEqual(LocalStore.getCachedSyncCursor('proj_beta').id, 'feat-b');
assert.strictEqual(StorageService.getSyncCursor('proj_alpha').rev, 42);
assert.strictEqual(StorageService.getSyncCursor('proj_beta').rev, 99);
console.log('  ✔ Cursores isolados por projeto sem contaminação cruzada.');

// 2. PRIORIDADE DA EDIÇÃO LOCAL E RETENÇÃO DE CURSOR
console.log('2. Verificando prioridade estrita de edição local (hasPendingLocalChange)...');
const PROJ = 'proj_audit';
StorageService.setCurrentProjectId(PROJ);
const feat = (id, name = id) => ({ id, name, type: 'Point', coordinates: [-23.7, -53.3], layerId: 'l1' });

StorageService.queueFeatureUpsert(feat('local-1', 'Versão Local'), PROJ);
assert.ok(StorageService.hasPendingLocalChange('local-1'), 'Feição local-1 marcada como pendente de sincronização');

fetchHandler = () => jsonRes({
  success: true, rev: 10, cursor: { rev: 10, id: '' }, hasMore: false,
  changes: [
    { id: 'remoto-ok', rev: 7, deleted: false, feature: feat('remoto-ok') },
    { id: 'local-1', rev: 8, deleted: false, feature: feat('local-1', 'Sobrescrita Invalida') },
    { id: 'remoto-depois', rev: 9, deleted: false, feature: feat('remoto-depois') }
  ],
  layers: []
});

let pullRes = await StorageService.pullChangesFromCloud(PROJ);
assert.ok(!pullRes.upserted.some(f => f.id === 'local-1'), 'Edição local NUNCA é sobrescrita por pull da nuvem');
assert.ok(pullRes.upserted.some(f => f.id === 'remoto-ok'), 'Alterações legítimas não concorrentes são aplicadas');
const cursor = StorageService.getSyncCursor(PROJ);
assert.strictEqual(cursor.rev, 7, 'Cursor retido antes da feição em conflito');
assert.strictEqual(cursor.id, 'remoto-ok');
console.log('  ✔ Prioridade de edição local e retenção de cursor funcionando com precisão.');

// 3. SERIALIZAÇÃO DE ENVIO E ALLOW_MASS_DELETE
console.log('3. Verificando fila de envio serializada e envio com allowMassDelete...');
let capturedPayload = null;
fetchHandler = (url, opts) => {
  if (url.includes('sync_deltas')) {
    capturedPayload = JSON.parse(opts.body);
    return jsonRes({ success: true, rev: 15 });
  }
  return jsonRes({ success: true });
};

// Gera exclusão em lote de 60 feições (simulando exclusão em lote no mapa)
const bulkIds = Array.from({ length: 60 }, (_, i) => `bulk-del-${i}`);
await StorageService.queueFeaturesBulkDelete(bulkIds, PROJ);
await StorageService.commitDeltas(PROJ);

assert.ok(capturedPayload !== null, 'sync_deltas foi disparado');
assert.strictEqual(capturedPayload.allowMassDelete, true, 'allowMassDelete: true é enviado para prevenir bloqueio 409');
assert.strictEqual(capturedPayload.toDelete.length, 60, 'Todos os 60 IDs foram enviados no lote');
console.log('  ✔ Exclusões em lote legítimas protegidas contra falso 409 do servidor.');

// 4. KEEPALIVE DINÂMICO (< 60 KB vs >= 60 KB)
console.log('4. Verificando limite de 60 KB para keepalive em POSTs...');
fetchLog.length = 0;
// Envio pequeno
await StorageService.syncDeltasToCloud([feat('small')], [], PROJ);
const smallReq = fetchLog[fetchLog.length - 1];
assert.strictEqual(smallReq.opts.keepalive, true, 'Envio pequeno usa keepalive');

// Envio massivo
const bigCoords = Array.from({ length: 5000 }, (_, i) => [-23.7 + i * 1e-6, -53.3 + i * 1e-6]);
const bigFeat = { ...feat('big-dense'), coordinates: bigCoords };
await StorageService.syncDeltasToCloud([bigFeat], [], PROJ);
const bigReq = fetchLog[fetchLog.length - 1];
assert.strictEqual(bigReq.opts.keepalive, false, 'Envio acima de 60 KB desativa keepalive');
console.log('  ✔ Gestão de keepalive testada e validada.');

// 5. PROTEÇÃO EM TEMPO REAL NO COLLAB_HUB CONTRA SOBRESCRITA DE PENDÊNCIAS
console.log('5. Verificando salvaguarda no CollabHub contra sobrescrita de itens locais...');
const mockApp = {
  projectId: PROJ,
  projectName: 'Audit Proj',
  features: [{ id: 'editing-now', name: 'Minha Versao Local', type: 'Point', coordinates: [0, 0] }],
  layers: [{ id: 'l1', name: 'Camada 1' }],
  mapEngine: { updateFeature: () => {}, removeFeature: () => {} },
  auditLog: [],
  getLayersWithCounts: () => []
};

StorageService.queueFeatureUpsert(mockApp.features[0], PROJ);
assert.ok(StorageService.hasPendingLocalChange('editing-now'));

// Simula chegada de evento de outro usuário via WebSocket
FeatureSyncController.handleCollabEvent(mockApp, 'feature:updated', {
  feature: { id: 'editing-now', name: 'Versão do Colega que Sobrescreveria', type: 'Point', coordinates: [1, 1] }
});

assert.strictEqual(mockApp.features[0].name, 'Minha Versao Local', 'Evento de WebSocket NÃO sobrescreve feição com alteração local pendente');

// Simula tombstone local
LocalStore.addLocalTombstone('deleted-here', PROJ);
FeatureSyncController.handleCollabEvent(mockApp, 'feature:created', {
  feature: { id: 'deleted-here', name: 'Tentativa de Ressurreicao', type: 'Point', coordinates: [1, 1] }
});
assert.ok(!mockApp.features.some(f => f.id === 'deleted-here'), 'Evento de WebSocket NÃO ressuscita feição com tombstone local');
console.log('  ✔ Salvaguardas do CollabHub ativas contra corrida de WebSocket.');

DeltaQueue.discardPending();
console.log('\n🎉 TODOS OS TESTES DA AUDITORIA ÁREA 2 FORAM APROVADOS COM 100% DE SUCESSO!\n');
process.exit(0);
