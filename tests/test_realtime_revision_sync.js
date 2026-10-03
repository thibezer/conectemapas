// Teste unitário (sem rede): sincronização quase em tempo real por cursor de revisão
// Cobre cursor monotônico, retenção em conflito local, eco obsoleto, fila serializada,
// retry offline sem perda e limite de 64 KB do keepalive.

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

let failures = 0;
const assert = (cond, msg) => {
  if (cond) {
    console.log('  ✔', msg);
  } else {
    failures++;
    console.error('  ✖', msg);
  }
};

const PROJ = 'proj_rev_test';
StorageService.setCurrentProjectId(PROJ);
const feat = (id, name = id) => ({ id, name, type: 'Point', coordinates: [-23.7, -53.3], layerId: 'l1' });

console.log('--- Cursor de revisão ---');
fetchHandler = (url) => {
  const params = new URL(url, 'http://x').searchParams;
  assert(params.get('sinceRev') === '0' && params.get('clientId') === StorageService.getClientId(), 'primeiro pull parte da revisão 0 com clientId');
  return jsonRes({
    success: true, rev: 5, cursor: { rev: 5, id: '' }, hasMore: false,
    changes: [
      { id: 'a', rev: 3, deleted: false, feature: feat('a') },
      { id: 'b', rev: 4, deleted: true }
    ],
    layers: [], presence: [{ id: 'cli_x', name: 'Ana', color: '#3B82F6', lat: -23.7, lng: -53.3 }]
  });
};
let r = await StorageService.pullChangesFromCloud(PROJ, { name: 'Eu', color: '#00E08A', lat: -23.1, lng: -53.1 });
assert(r.upserted.length === 1 && r.upserted[0].id === 'a', 'upsert remoto aplicado');
assert(r.deleted.length === 1 && r.deleted[0] === 'b', 'exclusão remota aplicada');
assert(r.presence.length === 1 && r.presence[0].name === 'Ana', 'presença dos demais recebida');
assert(StorageService.getSyncCursor().rev === 5, 'cursor avançou para a revisão do servidor');
assert(JSON.parse(localStorage.getItem('cm_sync_cursor_' + PROJ)).rev === 5, 'cursor persistido por projeto');
const presParams = new URL(fetchLog[fetchLog.length - 1].url, 'http://x').searchParams;
assert(presParams.get('userName') === 'Eu' && presParams.get('lat') === '-23.100000', 'presença local enviada no pull');

console.log('--- Edição local pendente retém o cursor ---');
StorageService.queueFeatureUpsert(feat('c', 'local'), PROJ); // fica na fila de debounce
assert(StorageService.hasPendingLocalChange('c'), 'feição c marcada como pendente');
fetchHandler = () => jsonRes({
  success: true, rev: 9, cursor: { rev: 9, id: '' }, hasMore: false,
  changes: [
    { id: 'd', rev: 6, deleted: false, feature: feat('d') },
    { id: 'c', rev: 7, deleted: false, feature: feat('c', 'remoto') },
    { id: 'e', rev: 8, deleted: false, feature: feat('e') }
  ], layers: []
});
r = await StorageService.pullChangesFromCloud(PROJ);
assert(!r.upserted.some(f => f.id === 'c'), 'versão remota de c NÃO sobrescreve a edição local');
assert(r.upserted.some(f => f.id === 'd') && r.upserted.some(f => f.id === 'e'), 'demais alterações aplicadas normalmente');
const held = StorageService.getSyncCursor();
assert(held.rev === 6 && held.id === 'd', 'cursor retido logo antes da linha em conflito');

console.log('--- Envio serializado e eco obsoleto ---');
let releasePush;
const pushBodies = [];
fetchHandler = (url, opts) => {
  if (url.includes('sync_deltas')) {
    pushBodies.push(JSON.parse(opts.body));
    if (pushBodies.length === 1) {
      return new Promise((resolve) => { releasePush = () => resolve(jsonRes({ success: true, rev: 10 })); });
    }
    return jsonRes({ success: true, rev: 11 });
  }
  return jsonRes({ success: true });
};
const p1 = StorageService.commitDeltas();
assert(StorageService.hasPendingLocalChange('c'), 'c continua protegida enquanto está em envio');
StorageService.queueFeatureUpsert(feat('f'), PROJ);
const p2 = StorageService.commitDeltas();
await new Promise(res => setTimeout(res, 10));
assert(pushBodies.length === 1, 'segundo envio aguarda o primeiro (fila serializada)');
assert(pushBodies[0].clientId === StorageService.getClientId(), 'envio identifica o cliente');
releasePush();
await p1; await p2;
await new Promise(res => setTimeout(res, 10));
assert(pushBodies.length === 2 && pushBodies[1].toUpsert[0].id === 'f', 'segundo envio sai após o primeiro');
assert(!StorageService.hasPendingLocalChange('c'), 'c liberada após confirmação');

fetchHandler = () => jsonRes({
  success: true, rev: 12, cursor: { rev: 12, id: '' }, hasMore: false,
  changes: [
    { id: 'c', rev: 7, deleted: false, feature: feat('c', 'remoto-antigo') },
    { id: 'e', rev: 8, deleted: false, feature: feat('e') }
  ], layers: []
});
r = await StorageService.pullChangesFromCloud(PROJ);
assert(r.upserted.length === 0, 'versão remota anterior à nossa gravação (rev 10) é descartada; e já aplicada');
assert(StorageService.getSyncCursor().rev === 12, 'cursor liberado e avançado após resolver o conflito');

console.log('--- Falha de rede não perde deltas de outras feições ---');
fetchHandler = () => { throw new TypeError('Failed to fetch'); };
await StorageService.syncDeltasToCloud([feat('g')], [], PROJ);
assert(StorageService.hasPendingOfflineDeltas(), 'delta de g persistido para retry');
assert(StorageService.hasPendingLocalChange('g'), 'g protegida contra sobrescrita remota enquanto pendente');

fetchHandler = (url, opts) => {
  pushBodies.push(JSON.parse(opts.body));
  return jsonRes({ success: true, rev: 13 });
};
await StorageService.syncDeltasToCloud([feat('h')], [], PROJ);
const lastBody = pushBodies[pushBodies.length - 1];
assert(lastBody.toUpsert.some(f => f.id === 'g') && lastBody.toUpsert.some(f => f.id === 'h'), 'envio seguinte leva junto a pendência de g');
assert(!StorageService.hasPendingOfflineDeltas(), 'pendências limpas após sucesso');

console.log('--- keepalive somente abaixo de 64 KB ---');
const big = feat('big');
big.coordinates = Array.from({ length: 5000 }, (_, i) => [-23.7 + i * 1e-6, -53.3 + i * 1e-6]);
await StorageService.syncDeltasToCloud([big], [], PROJ);
const bigCall = fetchLog[fetchLog.length - 1];
assert(bigCall.opts.keepalive === false, 'corpo grande enviado sem keepalive');
await StorageService.syncDeltasToCloud([feat('small')], [], PROJ);
assert(fetchLog[fetchLog.length - 1].opts.keepalive === true, 'corpo pequeno usa keepalive');

console.log('--- Servidor antigo (sem revisões) continua funcionando ---');
fetchHandler = () => jsonRes({ success: true, serverTime: '2026-10-03 10:00:00', upserted: [feat('z')], deleted: [], layers: [] });
r = await StorageService.pullChangesFromCloud(PROJ);
assert(r.upserted.length === 1 && r.upserted[0].id === 'z', 'resposta legada repassada');

if (failures > 0) {
  console.error(`\n${failures} verificação(ões) falharam`);
  process.exit(1);
}
console.log('\nSincronização por revisão: OK');
process.exit(0);
