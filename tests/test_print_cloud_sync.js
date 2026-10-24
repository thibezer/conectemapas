/* ==========================================================================
   ConecteMapas - Teste do PrintCloudSync (sem rede)
   Cobre: carga inicial (nuvem vence, migração das pranchas locais, excluídas na nuvem),
   trava (edição exclusiva e modo só visualização), envio da prancha ativa, aplicação
   das mudanças remotas e conflito (a versão local vira uma cópia).
   ========================================================================== */

import assert from 'assert';
import { PrintCloudSync } from '../src/components/PrintComposer/PrintCloudSync.js';

console.log('--- Teste do PrintCloudSync ---');

const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; }
};

function makeComposer(localSheets, activeId) {
  const sm = {
    sheets: localSheets,
    activeSheetId: activeId,
    getCurrentSheet() { return this.sheets.find(s => s.id === this.activeSheetId) || this.sheets[0]; },
    updateSheetNumbersInTitleBlocks() {},
    saveToStorage() {},
    renderSheetsSelectorDOM() {}
  };
  const calls = [];
  return {
    projectId: 'p1',
    sheetsManager: sm,
    library: { filters: [], viewTemplates: [] },
    readOnly: false,
    calls,
    setReadOnly(flag, holder = null, opts = {}) { this.readOnly = flag; calls.push(['readOnly', flag, holder, !!opts.free]); },
    loadActiveSheetIntoComposer() { calls.push(['load', sm.activeSheetId]); },
    setLibrary(lib) { this.library = lib; calls.push(['library']); }
  };
}

function fakeStore(overrides = {}) {
  const log = [];
  let rev = 10;
  return {
    log,
    async changes() { return { rev: 5, sheets: [], locks: [], library: null }; },
    async lock(id) { log.push(['lock', id]); return { ok: true }; },
    async release(id) { log.push(['release', id]); return {}; },
    async saveSheet(sheet, order, baseRev) { log.push(['save', sheet.id, order, baseRev]); return { ok: true, rev: ++rev }; },
    async deleteSheet(id) { log.push(['delete', id]); return { ok: true }; },
    async saveLibrary() { log.push(['library']); return { ok: true, rev: ++rev }; },
    ...overrides
  };
}

const sheet = (id, name = id) => ({ id, name, items: [{ id: 'm', type: 'map' }] });

// 1. Migração: nuvem vazia, pranchas locais sobem (a ativa fica travada, as outras são soltas)
{
  const composer = makeComposer([sheet('a'), sheet('b')], 'a');
  const st = fakeStore();
  const sync = new PrintCloudSync(composer, st, { clientId: 'me' });
  await sync.start();
  sync.stop({ keepalive: false });
  assert.deepStrictEqual(st.log.filter(l => l[0] === 'save').map(l => l[1]), ['a', 'b'], 'Migração envia todas as pranchas locais');
  assert.ok(st.log.some(l => l[0] === 'release' && l[1] === 'b'), 'Prancha não aberta é solta depois de subir');
  assert.ok(st.log.some(l => l[0] === 'lock' && l[1] === 'a'), 'Prancha aberta fica travada');
  assert.deepStrictEqual(composer.calls.find(c => c[0] === 'readOnly'), ['readOnly', false, null, false]);
  console.log('✔ Migração');
}

// 2. Nuvem vence; prancha criada só aqui sobe; prancha que já esteve na nuvem e sumiu é descartada
{
  store['cm_print_cloud_known_p1'] = JSON.stringify(['old']);
  const composer = makeComposer([sheet('a', 'local A'), sheet('old'), sheet('novaLocal')], 'a');
  const st = fakeStore({
    async changes() {
      return { rev: 7, sheets: [{ id: 'a', order: 0, rev: 3, sheet: sheet('a', 'nuvem A') }, { id: 'c', order: 1, rev: 4, sheet: sheet('c') }], locks: [], library: { rev: 6, data: { filters: [{ id: 'f' }], viewTemplates: [] } } };
    }
  });
  const sync = new PrintCloudSync(composer, st, { clientId: 'me' });
  await sync.start();
  sync.stop({ keepalive: false });
  const sm = composer.sheetsManager;
  assert.deepStrictEqual(sm.sheets.map(s => s.id), ['a', 'c', 'novaLocal'], 'Ordem da nuvem + criadas só aqui; a excluída na nuvem some');
  assert.strictEqual(sm.sheets[0].name, 'nuvem A', 'Versão da nuvem vence');
  assert.deepStrictEqual(st.log.filter(l => l[0] === 'save').map(l => l[1]), ['novaLocal'], 'Só a prancha nova sobe');
  assert.strictEqual(composer.library.filters[0].id, 'f', 'Biblioteca da nuvem adotada');
  console.log('✔ Carga inicial');
}

// 3. Trava de outro operador: só visualização; envio bloqueado
{
  const composer = makeComposer([sheet('a')], 'a');
  const st = fakeStore({
    async changes() { return { rev: 2, sheets: [{ id: 'a', order: 0, rev: 2, sheet: sheet('a') }], locks: [], library: null }; },
    async lock() { return { ok: false, holder: 'Bruno' }; }
  });
  const sync = new PrintCloudSync(composer, st, { clientId: 'me' });
  await sync.start();
  assert.strictEqual(composer.readOnly, true);
  assert.deepStrictEqual(composer.calls.filter(c => c[0] === 'readOnly').pop(), ['readOnly', true, 'Bruno', false]);
  composer.sheetsManager.sheets[0].name = 'mudança local';
  assert.strictEqual(sync.pushNow(), null, 'Só visualizando não envia');

  // Remoto: Bruno edita (a prancha aberta é atualizada) e depois solta (aparece "Editar")
  sync.applyRemote({ rev: 3, sheets: [{ id: 'a', order: 0, rev: 3, clientId: 'bruno', sheet: sheet('a', 'do Bruno') }], locks: [{ sheetId: 'a', clientId: 'bruno', userName: 'Bruno' }] });
  assert.strictEqual(composer.sheetsManager.sheets[0].name, 'do Bruno', 'Quem visualiza recebe a edição');
  assert.ok(composer.calls.some(c => c[0] === 'load'), 'Prancha aberta é recarregada');
  sync.applyRemote({ rev: 4, sheets: [], locks: [] });
  assert.deepStrictEqual(composer.calls.filter(c => c[0] === 'readOnly').pop(), ['readOnly', true, null, true], 'Trava liberada: oferece Editar');
  sync.stop({ keepalive: false });
  console.log('✔ Só visualização');
}

// 4. Editando: envio com baseRev, eco ignorado, prancha minha não é sobrescrita
{
  const composer = makeComposer([sheet('a'), sheet('b')], 'a');
  const st = fakeStore({
    async changes() { return { rev: 2, sheets: [{ id: 'a', order: 0, rev: 2, sheet: sheet('a') }, { id: 'b', order: 1, rev: 1, sheet: sheet('b') }], locks: [], library: null }; }
  });
  const sync = new PrintCloudSync(composer, st, { clientId: 'me' });
  await sync.start();
  assert.strictEqual(sync.pushNow(), null, 'Sem mudança, nada sobe');
  composer.sheetsManager.sheets[0].name = 'editada';
  await sync.pushNow();
  const save = st.log.filter(l => l[0] === 'save').pop();
  assert.deepStrictEqual([save[1], save[3]], ['a', 2], 'Envia a ativa com a rev conhecida');
  sync.applyRemote({ rev: 20, sheets: [
    { id: 'a', order: 0, rev: 19, clientId: 'outro', sheet: sheet('a', 'sobrescrita?') },
    { id: 'b', order: 1, rev: 20, clientId: 'outro', sheet: sheet('b', 'B nova') }
  ], locks: [] });
  assert.strictEqual(composer.sheetsManager.sheets[0].name, 'editada', 'Prancha que eu edito (trava minha) não é sobrescrita');
  assert.strictEqual(composer.sheetsManager.sheets[1].name, 'B nova', 'Outras pranchas são atualizadas');
  sync.applyRemote({ rev: 21, sheets: [{ id: 'a', deleted: true, rev: 21, clientId: 'outro' }], locks: [] });
  assert.deepStrictEqual(composer.sheetsManager.sheets.map(s => s.id), ['b'], 'Exclusão remota remove a prancha');
  assert.strictEqual(composer.sheetsManager.activeSheetId, 'b', 'Abre outra prancha quando a aberta é excluída');
  sync.stop({ keepalive: false });
  console.log('✔ Envio e mudanças remotas');
}

// 5. Conflito: versão do servidor fica; a minha vira cópia
{
  const composer = makeComposer([sheet('a', 'minha')], 'a');
  const sync = new PrintCloudSync(composer, fakeStore(), { clientId: 'me' });
  sync.active = true;
  sync.resolveConflict(composer.sheetsManager.sheets[0], { rev: 9, sheet: sheet('a', 'do servidor') });
  const names = composer.sheetsManager.sheets.map(s => s.name);
  assert.deepStrictEqual(names, ['do servidor', 'minha (sua versão)']);
  assert.notStrictEqual(composer.sheetsManager.sheets[1].id, 'a', 'Cópia com id novo');
  console.log('✔ Conflito');
}

// 6. Sem nuvem configurada: nada acontece
{
  const composer = makeComposer([sheet('a')], 'a');
  const sync = new PrintCloudSync(composer, null);
  await sync.start();
  sync.onLocalChange();
  assert.strictEqual(composer.calls.length, 0, 'Sem store, o compositor não é tocado');
  console.log('✔ Sem nuvem');
}

console.log('\n🎉 TESTES DO PRINTCLOUDSYNC PASSARAM!');
