// Sincronização incremental do CanvasMapEngine com o componente: camada nova é definida por inteiro; nas demais,
// todas as mudanças vão em UM aplicarLote (só as mudadas são convertidas), sem laço de adicionar/remover.
const noop = () => {};
globalThis.window = {
  addEventListener: noop, removeEventListener: noop, devicePixelRatio: 1,
  screen: { deviceXDPI: 1, logicalXDPI: 1 }, location: { hostname: 'localhost', search: '' },
  requestAnimationFrame: (cb) => setTimeout(cb, 0), cancelAnimationFrame: noop
};
globalThis.document = {
  createElement: () => ({ style: {}, classList: { add: noop, remove: noop, toggle: noop }, setAttribute: noop, appendChild: noop, addEventListener: noop }),
  documentElement: { style: {} }, body: {}, addEventListener: noop, removeEventListener: noop,
  getElementById: () => null, querySelector: () => null, querySelectorAll: () => []
};
globalThis.HTMLElement = class {};
globalThis.customElements = { define: noop, get: () => null };
globalThis.CSSStyleSheet = class { replaceSync() {} };

import assert from 'assert';

const { CanvasMapEngine } = await import('../src/services/CanvasMapEngine.js');

console.log('🧪 Sincronização incremental do CanvasMapEngine...');

function makeEngine() {
  const calls = [];
  const rec = (name) => (...args) => { calls.push({ name, args }); };
  const layerDefs = new Map();
  const host = {
    definirFeicoes: (id, list, opts) => { layerDefs.set(id, { nome: opts?.nome, zIndex: opts?.zIndex, opacidade: opts?.opacidade, interativo: opts?.interativo }); calls.push({ name: 'definirFeicoes', args: [id, list, opts] }); return { aceitas: list.length, recusadas: [] }; },
    aplicarLote: (id, lote, opts) => { calls.push({ name: 'aplicarLote', args: [id, lote, opts] }); return { adicionadas: (lote.adicionar || []).length, atualizadas: 0, removidas: (lote.remover || []).length, recusadas: [] }; },
    removerFeicao: rec('removerFeicao'),
    adicionarFeicao: rec('adicionarFeicao'),
    setLayerVisibility: rec('setLayerVisibility'),
    getLayerManager: () => ({
      setLayerBlocked: noop,
      getLayerDef: (id) => layerDefs.get(id),
      setLayerZIndex: noop,
      setLayerOpacity: noop
    })
  };
  const engine = Object.create(CanvasMapEngine.prototype);
  engine.host = host;
  engine._applied = new Map();
  engine._features = [];
  engine._featureMap = new Map();
  engine._layers = [];
  engine._layerMap = new Map();
  return { engine, calls };
}

const layers = [
  { id: 'A', name: 'A', color: '#111111', visible: true, locked: false, opacity: 1 },
  { id: 'B', name: 'B', color: '#222222', visible: true, locked: false, opacity: 1 }
];
const mkPoint = (id, layerId, extra = {}) => ({ id, type: 'Point', layerId, coordinates: [-23.5 + Number(id.slice(1)) * 1e-4, -46.6], name: id, ...extra });
const only = (calls, name) => calls.filter(c => c.name === name);

// --- 1. Carga inicial: cada camada definida por inteiro ---
const { engine, calls } = makeEngine();
let feats = [];
for (let i = 0; i < 300; i++) feats.push(mkPoint(`a${i}`, 'A'));
for (let i = 0; i < 50; i++) feats.push(mkPoint(`b${i}`, 'B'));
engine.renderFeatures(feats, layers);
assert.strictEqual(only(calls, 'definirFeicoes').length, 2, 'camada nova é definida por inteiro');
assert.strictEqual(only(calls, 'definirFeicoes')[0].args[1].length, 300);
assert.strictEqual(only(calls, 'aplicarLote').length, 0);

// --- 2. Sem mudança: nenhuma chamada de dados ---
calls.length = 0;
engine.renderFeatures(feats, layers);
assert.strictEqual(only(calls, 'definirFeicoes').length + only(calls, 'aplicarLote').length, 0, 'sem mudança não grava nada no componente');

// --- 3. Uma edição: um aplicarLote com 1 feição ---
calls.length = 0;
feats = feats.map(f => f.id === 'a7' ? { ...f, name: 'editada' } : f);
engine.renderFeatures(feats, layers);
let lotes = only(calls, 'aplicarLote');
assert.strictEqual(lotes.length, 1);
assert.strictEqual(lotes[0].args[0], 'A');
assert.strictEqual(lotes[0].args[1].adicionar.length, 1);
assert.strictEqual(lotes[0].args[1].adicionar[0].id, 'a7');
assert.strictEqual(only(calls, 'removerFeicao').length + only(calls, 'adicionarFeicao').length, 0, 'sem laço de remover/adicionar');

// --- 4. Muitas edições (antes: redefinia a camada toda e convertia as 300) ---
calls.length = 0;
feats = feats.map(f => f.layerId === 'A' && Number(f.id.slice(1)) < 200 ? { ...f, name: 'em lote' } : f);
engine.renderFeatures(feats, layers);
lotes = only(calls, 'aplicarLote');
assert.strictEqual(only(calls, 'definirFeicoes').length, 0, 'não redefine a camada por causa de um lote grande');
assert.strictEqual(lotes.length, 1, 'um único aplicarLote');
assert.strictEqual(lotes[0].args[1].adicionar.length, 200, 'só as 200 mudadas são enviadas');

// --- 5. Exclusão + edição na mesma passagem ---
calls.length = 0;
feats = feats.filter(f => f.id !== 'a250' && f.id !== 'a251').map(f => f.id === 'a299' ? { ...f, name: 'x' } : f);
engine.renderFeatures(feats, layers);
lotes = only(calls, 'aplicarLote');
assert.strictEqual(lotes.length, 1);
assert.deepStrictEqual(lotes[0].args[1].remover.sort(), ['a250', 'a251']);
assert.strictEqual(lotes[0].args[1].adicionar.length, 1);

// --- 6. Mover de camada (camada de origem antes e depois da de destino) ---
calls.length = 0;
feats = feats.map(f => f.id === 'a10' ? { ...f, layerId: 'B' } : f); // A (origem) é processada antes de B
engine.renderFeatures(feats, layers);
assert.strictEqual(engine._applied.get('a10').layerId, 'B', 'a feição movida fica registrada na camada de destino');
let toB = only(calls, 'aplicarLote').filter(c => c.args[0] === 'B');
assert.strictEqual(toB.length, 1);
assert.strictEqual(toB[0].args[1].adicionar[0].id, 'a10');
assert.ok(only(calls, 'aplicarLote').some(c => c.args[0] === 'A' && c.args[1].remover.includes('a10')), 'sai da camada de origem');

calls.length = 0;
const reversed = [layers[1], layers[0]]; // B primeiro: a origem (A) é processada depois do destino
feats = feats.map(f => f.id === 'a30' ? { ...f, layerId: 'B' } : f);
engine.renderFeatures(feats, reversed);
assert.strictEqual(engine._applied.get('a30').layerId, 'B', 'a origem processada depois não apaga o registro da feição movida');
assert.ok(only(calls, 'aplicarLote').some(c => c.args[0] === 'A' && c.args[1].remover.includes('a30')), 'sai da camada A');
assert.ok(only(calls, 'aplicarLote').some(c => c.args[0] === 'B' && c.args[1].adicionar.some(x => x.id === 'a30')), 'entra na camada B');
calls.length = 0;
engine.renderFeatures(feats, reversed);
assert.strictEqual(only(calls, 'aplicarLote').length, 0, 'estado estável depois da movimentação');

// --- 7. Geometria que deixa de ser válida sai do mapa ---
calls.length = 0;
feats = feats.map(f => f.id === 'a20' ? { ...f, coordinates: [NaN, NaN] } : f);
engine.renderFeatures(feats, layers);
assert.ok(only(calls, 'aplicarLote').some(c => c.args[1].remover.includes('a20')), 'geometria inválida é removida do componente');
assert.strictEqual(engine._applied.has('a20'), false);

// --- 8. Camada excluída do projeto é esvaziada ---
calls.length = 0;
engine.renderFeatures(feats.filter(f => f.layerId !== 'B' || f.id === 'a10'), [layers[0]]);
assert.ok(only(calls, 'definirFeicoes').some(c => c.args[0] === 'B' && c.args[1].length === 0), 'camada que deixou de existir é limpa');

console.log('✅ Sincronização incremental do CanvasMapEngine passou!');
