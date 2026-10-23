import assert from 'assert';
import {
  MODIFY_LAYER_PREFIX,
  MODIFY_TAB_ID,
  buildModifyTab,
  computeModifyState
} from '../src/components/ModifyRibbon.js';
import { BatchActions } from '../src/services/BatchActions.js';

console.log('🧪 Iniciando testes da aba Modificar da ribbon...');

const layers = [
  { id: 'L1', name: 'Lotes' },
  { id: 'L2', name: 'Vias' }
];

const poly = (id, extra = {}) => ({ id, type: 'Polygon', layerId: 'L1', coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]], ...extra });
const line = (id, extra = {}) => ({ id, type: 'LineString', layerId: 'L2', coordinates: [[0, 0], [0, 1]], ...extra });
const point = (id, extra = {}) => ({ id, type: 'Point', layerId: 'L1', coordinates: [0, 0], ...extra });
const state = (features, extra = {}) => computeModifyState({ features, layers, ...extra });

// ---- Definição da aba ----------------------------------------------------
{
  const tab = buildModifyTab();
  assert.strictEqual(tab.id, MODIFY_TAB_ID);
  const items = tab.grupos.flatMap(g => g.itens);
  const ids = items.map(i => i.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'ids únicos na aba');
  assert(ids.every(id => id.startsWith('mod-')), 'todo id começa com mod-');
  assert(items.every(i => i.rotulo && i.icone), 'todo comando tem rótulo e ícone');

  const childIds = items.flatMap(i => (i.filhos || []).map(c => c.id));
  assert(childIds.every(id => id.startsWith('mod-')), 'filhos também usam o prefixo');

  // Todo comando da aba tem estado calculado (senão ficaria sempre habilitado por esquecimento)
  const st = state([]);
  for (const id of [...ids, ...childIds]) {
    assert(id in st || id.startsWith(MODIFY_LAYER_PREFIX), `sem estado para ${id}`);
  }
  for (const id of Object.keys(st)) {
    assert(ids.includes(id) || childIds.includes(id), `estado de item que não existe na aba: ${id}`);
  }
  console.log('✔ Definição da aba coerente com o estado passou');
}

// ---- Sem seleção ---------------------------------------------------------
{
  const st = state([]);
  for (const id of ['mod-clear', 'mod-zoom', 'mod-inspect', 'mod-table', 'mod-style', 'mod-join', 'mod-simplify',
    'mod-vertices', 'mod-duplicate', 'mod-buffer', 'mod-delete', 'mod-layer', 'mod-lock', 'mod-visible', 'mod-copy']) {
    assert.strictEqual(st[id].disabled, true, `${id} desabilitado sem seleção`);
  }
  for (const id of ['mod-select-all', 'mod-lasso', 'mod-eyedropper', 'mod-split', 'mod-measure', 'mod-fit']) {
    assert.strictEqual(st[id].disabled, false, `${id} sempre disponível`);
  }
  console.log('✔ Estado sem seleção passou');
}

// ---- Seleção única -------------------------------------------------------
{
  const st = state([poly('a')]);
  assert.strictEqual(st['mod-inspect'].disabled, false);
  assert.strictEqual(st['mod-vertices'].disabled, false);
  assert.strictEqual(st['mod-duplicate'].disabled, false);
  assert.strictEqual(st['mod-buffer'].disabled, false);
  assert.strictEqual(st['mod-simplify'].disabled, false);
  assert.strictEqual(st['mod-join'].disabled, true, 'unir exige 2 ou mais');
  assert.strictEqual(st['mod-copy-wkt'].disabled, false);

  const ponto = state([point('p')]);
  assert.strictEqual(ponto['mod-simplify'].disabled, true, 'ponto não tem o que simplificar');
  assert.strictEqual(ponto['mod-invert'].disabled, false);
  assert.strictEqual(state([line('l')])['mod-invert'].disabled, true, 'linha tem uma cor só');
  assert.strictEqual(state([{ id: 't', type: 'Text', coordinates: [0, 0] }])['mod-invert'].disabled, true);
  console.log('✔ Seleção única passou');
}

// ---- Seleção múltipla ----------------------------------------------------
{
  const st = state([poly('a'), poly('b')]);
  assert.strictEqual(st['mod-join'].disabled, false);
  assert.strictEqual(st['mod-join-bridge'].disabled, false);
  assert.strictEqual(st['mod-inspect'].disabled, true, 'propriedades é de uma feição só');
  assert.strictEqual(st['mod-vertices'].disabled, true);
  assert.strictEqual(st['mod-duplicate'].disabled, true);
  assert.strictEqual(st['mod-buffer'].disabled, false, 'buffer disponível com múltiplos objetos');
  assert.strictEqual(st['mod-table'].disabled, false);
  assert.strictEqual(st['mod-copy-geojson'].disabled, false);
  assert.strictEqual(st['mod-copy-wkt'].disabled, true, 'WKT é de uma feição só');
  console.log('✔ Seleção múltipla passou');
}

// ---- Bloqueio ------------------------------------------------------------
{
  const travada = state([poly('a', { locked: true })]);
  assert.strictEqual(travada['mod-delete'].disabled, true);
  assert.strictEqual(travada['mod-buffer'].disabled, true, 'buffer desabilitado se bloqueada');
  assert.strictEqual(travada['mod-vertices'].disabled, true);
  assert.strictEqual(travada['mod-layer'].disabled, true);
  assert.strictEqual(travada['mod-simplify'].disabled, true);
  assert.strictEqual(travada['mod-lock'].rotulo, 'Desbloquear', 'só bloqueadas: o botão desbloqueia');
  assert.strictEqual(travada['mod-lock'].disabled, false);
  assert.strictEqual(travada['mod-inspect'].disabled, false, 'inspecionar não altera nada');

  const mista = state([poly('a', { locked: true }), poly('b')]);
  assert.strictEqual(mista['mod-lock'].rotulo, 'Bloquear', 'com alguma desbloqueada: bloqueia todas');
  assert.strictEqual(mista['mod-delete'].disabled, false);
  assert.strictEqual(mista['mod-join'].disabled, true, 'só uma desbloqueada: nada a unir');
  console.log('✔ Bloqueio passou');
}

// ---- Visibilidade, camada e ferramenta ativa -----------------------------
{
  assert.strictEqual(state([poly('a')])['mod-visible'].rotulo, 'Ocultar');
  assert.strictEqual(state([poly('a', { visible: false })])['mod-visible'].rotulo, 'Mostrar');
  assert.strictEqual(state([poly('a', { visible: false }), poly('b')])['mod-visible'].rotulo, 'Ocultar');

  const camada = state([poly('a'), point('p')])['mod-layer'];
  assert.deepStrictEqual(camada.filhos.map(f => f.id), [`${MODIFY_LAYER_PREFIX}L1`, `${MODIFY_LAYER_PREFIX}L2`]);
  assert.deepStrictEqual(camada.filhos.map(f => f.ativo), [true, false], 'camada comum a toda a seleção fica marcada');
  assert.deepStrictEqual(state([poly('a'), line('l')])['mod-layer'].filhos.map(f => f.ativo), [false, false]);

  assert.strictEqual(state([], { activeTool: 'split' })['mod-split'].ativo, true);
  assert.strictEqual(state([], { activeTool: 'measure' })['mod-measure'].ativo, true);
  assert.strictEqual(state([], { activeTool: 'select' })['mod-lasso'].ativo, false);
  assert.strictEqual(state([], { activeTool: 'pen-select' })['mod-lasso'].ativo, true);

  assert.strictEqual(state([], { history: { undo: 0, redo: 0 } })['mod-undo'].disabled, true);
  assert.strictEqual(state([], { history: { undo: 2, redo: 1 } })['mod-undo'].disabled, false);
  assert.strictEqual(state([], { history: { undo: 2, redo: 1 } })['mod-redo'].disabled, false);
  console.log('✔ Visibilidade, camada, ferramenta e histórico passaram');
}

// ---- Ações em lote novas -------------------------------------------------
function fakeApp(features) {
  const log = { history: [], saved: [], refresh: 0 };
  return {
    log,
    features,
    collabHub: { notifyFeatureUpdated() {} },
    pushHistory: d => log.history.push(d),
    saveFeaturesBulk: fs => fs.forEach(f => log.saved.push(f.id)),
    refreshMapAndTable: () => { log.refresh++; }
  };
}

{
  const colineares = [[0, 0], [0.0001, 0.00001], [0.0002, 0], [0.0003, 0.00001], [0.0004, 0]];
  const app = fakeApp([
    { id: 'l', type: 'LineString', layerId: 'L2', coordinates: colineares },
    { id: 'ok', type: 'LineString', layerId: 'L2', coordinates: [[0, 0], [1, 1]] },
    { id: 'trava', type: 'LineString', layerId: 'L2', locked: true, coordinates: colineares },
    { id: 'pt', type: 'Point', layerId: 'L1', coordinates: [0, 0] }
  ]);
  const r = BatchActions.simplify(app, ['l', 'ok', 'trava', 'pt']);
  assert.deepStrictEqual(r.ids, ['l'], 'só a linha com vértices redundantes muda');
  assert.strictEqual(r.locked, 1);
  assert.strictEqual(r.unchanged, 2, 'linha mínima e ponto não mudam');
  assert(app.features.find(f => f.id === 'l').coordinates.length < colineares.length, 'vértices removidos');
  assert.strictEqual(app.features.find(f => f.id === 'trava').coordinates.length, colineares.length, 'bloqueada intacta');
  assert.strictEqual(app.log.history.length, 1, 'um único passo de histórico');
  assert.strictEqual(app.log.refresh, 1, 'um único re-render');
  assert.strictEqual(BatchActions.simplify(app, ['l']).changed, 0, 'já simplificada não gera histórico');
  assert.strictEqual(app.log.history.length, 1);
  console.log('✔ BatchActions.simplify passou');
}

{
  const app = fakeApp([
    { id: 'a', type: 'Polygon', layerId: 'L1', color: '#111111', style: { fillColor: '#111111', strokeColor: '#eeeeee' }, coordinates: [] },
    { id: 'igual', type: 'Polygon', layerId: 'L1', color: '#222222', style: { fillColor: '#222222', strokeColor: '#222222' }, coordinates: [] },
    { id: 'l', type: 'LineString', layerId: 'L2', color: '#333333', style: { strokeColor: '#333333' }, coordinates: [] },
    { id: 't', type: 'Text', layerId: 'L1', style: { textColor: '#444444' }, coordinates: [] }
  ]);
  const r = BatchActions.invertColors(app, ['a', 'igual', 'l', 't']);
  assert.deepStrictEqual(r.ids, ['a'], 'só polígono com preenchimento e traço diferentes');
  const a = app.features.find(f => f.id === 'a');
  assert.strictEqual(a.style.fillColor, '#eeeeee');
  assert.strictEqual(a.style.strokeColor, '#111111');
  assert.strictEqual(a.color, '#eeeeee', 'cor principal acompanha o novo preenchimento');
  assert.strictEqual(app.log.history.length, 1);
  console.log('✔ BatchActions.invertColors passou');
}

console.log('🎉 Testes da aba Modificar concluídos com sucesso!');
