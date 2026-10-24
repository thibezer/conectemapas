/* ==========================================================================
   ConecteMapas - Teste de integração das pranchas na nuvem (opt-in)
   Cobre as ações print_* do api.php pelo mesmo cliente do app (PrintCloudStore):
   trava exclusiva por prancha, gravação com rev, conflito por baseRev, exclusão,
   biblioteca, leitura incremental e JSON preservado (objetos vazios não viram listas).
   Só roda com CM_TEST_API_URL apontando para um backend de TESTES.
   ========================================================================== */

import assert from 'assert';
import { requireTestApiUrl } from './_cloud_target.js';
import { PrintCloudStore } from '../src/services/Storage/PrintCloudStore.js';

const url = requireTestApiUrl();
const projectId = `print_test_${Date.now()}`;
const make = (clientId, name) => new PrintCloudStore({
  projectId,
  clientId,
  getUserName: () => name,
  baseUrl: url,
  fetchImpl: (u, init) => fetch(u, init),
  headers: (extra) => extra
});
const A = make('cliA', 'Ana');
const B = make('cliB', 'Bruno');

console.log('--- Teste das pranchas na nuvem ---');

let c = await A.changes(0);
assert.deepStrictEqual(c.sheets, [], 'Projeto novo sem pranchas');

// Trava exclusiva
assert.ok((await A.lock('s1')).ok, 'A pega a trava');
assert.ok((await A.lock('s1')).ok, 'A renova a própria trava');
let r = await B.lock('s1');
assert.strictEqual(r.ok, false, 'B não pega a trava de A');
assert.strictEqual(r.holder, 'Ana', 'Informa quem está editando');

// Gravação: a vista volta idêntica, inclusive objetos vazios
const viewConfig = { templateId: null, followProject: false, layers: {}, labels: {}, filters: [], elements: { f1: { visible: false } } };
const sheet = { id: 's1', name: 'Prancha 01', items: [{ id: 'm', type: 'map', viewConfig }] };
r = await A.saveSheet(sheet, 0, 0);
assert.ok(r.ok, 'A grava');
const rev1 = r.rev;
r = await B.saveSheet({ ...sheet, name: 'Invasão' }, 0);
assert.strictEqual(r.locked, 'Ana', 'B não grava a prancha travada por A');

c = await B.changes(0);
assert.strictEqual(c.sheets.length, 1);
assert.strictEqual(c.sheets[0].sheet.name, 'Prancha 01');
assert.deepStrictEqual(c.sheets[0].sheet.items[0].viewConfig, viewConfig, 'Vista do mapa vai e volta íntegra');
assert.ok(!Array.isArray(c.sheets[0].sheet.items[0].viewConfig.layers), 'Objeto vazio continua objeto ({} não vira [])');
assert.deepStrictEqual(c.locks.map(l => l.userName), ['Ana']);

// Liberação e conflito: B edita depois de A soltar; A volta com a versão antiga
await A.release('s1');
r = await B.saveSheet({ ...sheet, name: 'Editada por B' }, 0, rev1);
assert.ok(r.ok, 'B grava depois que A solta');
await B.release('s1');
r = await A.saveSheet({ ...sheet, name: 'A desatualizada' }, 0, rev1);
assert.ok(r.conflict, 'A com versão antiga recebe conflito');
assert.strictEqual(r.conflict.sheet.name, 'Editada por B', 'Conflito devolve a versão do servidor');

// Leitura incremental
const since = (await A.changes(0)).rev;
assert.ok((await A.saveSheet({ id: 's2', name: 'Prancha 02', items: [] }, 1)).ok);
c = await B.changes(since);
assert.deepStrictEqual(c.sheets.map(s => s.id), ['s2'], 'Só o que mudou desde a rev');

// Exclusão
assert.strictEqual((await B.deleteSheet('s2')).locked, 'Ana', 'Não exclui prancha que outro edita');
assert.ok((await A.deleteSheet('s2')).ok);
c = await B.changes(since);
assert.ok(c.sheets.some(s => s.id === 's2' && s.deleted && s.sheet === null), 'Exclusão chega como tombstone');
assert.ok(!(await B.changes(0)).sheets.some(s => s.id === 's2'), 'Carga inicial não traz excluídas');

// Biblioteca
const lib = { filters: [{ id: 'f1', name: 'APP', layerIds: [], query: { op: 'AND', items: [] } }], viewTemplates: [] };
r = await A.saveLibrary(lib, 0);
assert.ok(r.ok);
const libRev = r.rev;
r = await B.saveLibrary({ ...lib, filters: [] }, 0);
assert.ok(r.conflict && r.conflict.data.filters.length === 1, 'Biblioteca desatualizada recebe conflito com a versão do servidor');
r = await B.saveLibrary({ ...lib, viewTemplates: [{ id: 't1', name: 'Urbano', include: {}, view: { layers: {} } }] }, libRev);
assert.ok(r.ok);
c = await A.changes(0);
assert.strictEqual(c.library.data.viewTemplates[0].name, 'Urbano');
assert.ok(!Array.isArray(c.library.data.viewTemplates[0].view.layers), 'Objeto vazio da biblioteca continua objeto');

// Validações do servidor
const raw = await fetch(`${url}?action=print_save_sheet`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ projectId, clientId: 'cliA', sheetJson: '{"name":"sem id"}' })
});
assert.strictEqual(raw.status, 400, 'Prancha sem id é recusada');
const noClient = await fetch(`${url}?action=print_lock`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ projectId, sheetId: 's1' })
});
assert.strictEqual(noClient.status, 400, 'Sem cliente não trava');

console.log('🎉 TESTES DAS PRANCHAS NA NUVEM PASSARAM!');
