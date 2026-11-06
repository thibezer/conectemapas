// O olhinho da feição é local: não vai para a nuvem, não é aceito de outros e sobrevive ao recarregar.
import assert from 'assert';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k)
};

const { FeatureVisibility: FV } = await import('../src/services/Storage/FeatureVisibility.js');
const { packFeatureForCloud } = await import('../src/services/Storage/CloudSyncEngine.js');
const P = 'proj_vis';

// Migração: 1ª vez aproveita o que já estava oculto neste aparelho
FV._reset();
assert.strictEqual(FV.exists(P), false);
FV.seedIfMissing(P, [{ id: 'a', visible: false }, { id: 'b' }, { id: 'c', visible: true }]);
assert.strictEqual(FV.exists(P), true);
assert.strictEqual(FV.isHidden(P, 'a'), true);
assert.strictEqual(FV.isHidden(P, 'b'), false);
// 2ª vez não sobrescreve
FV.seedIfMissing(P, [{ id: 'z', visible: false }]);
assert.strictEqual(FV.isHidden(P, 'z'), false);

// Receber da nuvem/colega: o local prevalece, qualquer que seja o visible remoto
const remoteA = { id: 'a', name: 'A', visible: true };
const remoteB = { id: 'b', name: 'B', visible: false };
const remoteN = { id: 'n', name: 'N' };
assert.strictEqual(FV.apply(P, remoteA).visible, false, 'oculta aqui continua oculta');
assert.strictEqual(FV.apply(P, remoteB).visible, true, 'ocultada por outro não oculta aqui');
assert.strictEqual(FV.apply(P, remoteN), remoteN, 'sem mudança mantém a mesma referência');
assert.strictEqual(remoteA.visible, true, 'não muta a entrada');
assert.deepStrictEqual(FV.applyAll(P, [remoteA, remoteB, remoteN]).map(f => f.visible), [false, true, undefined]);

// Escolha local: oculta e reexibe; persiste e recarrega do localStorage
FV.record(P, { id: 'n', visible: false });
FV.record(P, [{ id: 'a', visible: true }]);
FV.flush(P);
FV._reset();
assert.strictEqual(FV.isHidden(P, 'n'), true, 'sobrevive ao recarregar');
assert.strictEqual(FV.isHidden(P, 'a'), false);

// Desfazer/refazer reconstrói a preferência
FV.syncFromFeatures(P, [{ id: 'x', visible: false }, { id: 'n' }]);
assert.strictEqual(FV.isHidden(P, 'x'), true);
assert.strictEqual(FV.isHidden(P, 'n'), false);

// Para a nuvem: nunca viaja `visible`
const packed = packFeatureForCloud({ id: 'f', visible: false, type: 'Point', coordinates: [0, 1], properties: {} });
assert.ok(!('visible' in packed), 'visible removido do envio');
assert.strictEqual(packed.id, 'f');

// Projetos são independentes
FV.record('outro', { id: 'q', visible: false });
assert.strictEqual(FV.isHidden(P, 'q'), false);

FV._reset();
console.log('OK test_feature_visibility_local');
