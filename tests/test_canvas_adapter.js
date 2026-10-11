// Conversões do CanvasMapEngine (feição do app <-> Feicao do <ui-canvas-cad>), sem DOM real.
// O adaptador é instanciado sem construtor: só as funções puras de tradução são exercitadas.
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
const engine = Object.create(CanvasMapEngine.prototype);

console.log('🧪 Iniciando testes do adaptador CanvasMapEngine...');

const layer = { id: 'l1', name: 'Camada', color: '#112233', opacity: 1, visible: true, locked: false };

// --- 1. Geometrias ---
console.log('  1. Conversão de geometrias...');
const point = engine._toFeicao({ id: 'p', type: 'Point', layerId: 'l1', coordinates: [-23.5, -46.6], name: 'P' }, layer);
assert.deepStrictEqual(point.geometria, { tipo: 'Point', coordenada: [-23.5, -46.6] });
assert.strictEqual(point.propriedades.name, 'P');

const poly = engine._toFeicao({ id: 'g', type: 'Polygon', layerId: 'l1', coordinates: [[-23.5, -46.6], [-23.5, -46.59], [-23.51, -46.59]] }, layer);
assert.strictEqual(poly.geometria.tipo, 'Polygon');
assert.strictEqual(poly.geometria.aneis.length, 1);
assert.strictEqual(poly.geometria.aneis[0].length, 3);

const holes = engine._toFeicao({
  id: 'h', type: 'Polygon', layerId: 'l1',
  coordinates: [
    [[-23.5, -46.6], [-23.5, -46.59], [-23.51, -46.59], [-23.51, -46.6]],
    [[-23.502, -46.598], [-23.502, -46.596], [-23.504, -46.596]]
  ]
}, layer);
assert.strictEqual(holes.geometria.aneis.length, 2, 'polígono com furo vira multianel');

const closed = engine._toFeicao({ id: 'c', type: 'Polygon', layerId: 'l1', coordinates: [[-23.5, -46.6], [-23.5, -46.59], [-23.51, -46.59], [-23.5, -46.6]] }, layer);
assert.strictEqual(closed.geometria.aneis[0].length, 3, 'anel fechado duplicado é aberto');

const circle = engine._toFeicao({ id: 'o', type: 'Circle', layerId: 'l1', coordinates: [-23.5, -46.6], radius: 120 }, layer);
assert.deepStrictEqual(circle.geometria, { tipo: 'Circle', centro: [-23.5, -46.6], raioMetros: 120 });
assert.strictEqual(engine._toFeicao({ id: 'o2', type: 'Circle', layerId: 'l1', coordinates: [-23.5, -46.6] }, layer).geometria.raioMetros, 500, 'raio padrão');

const text = engine._toFeicao({ id: 't', type: 'Text', layerId: 'l1', coordinates: [-23.5, -46.6], name: 'Nome', properties: { text: 'Rótulo' } }, layer);
assert.deepStrictEqual(text.geometria, { tipo: 'Text', coordenada: [-23.5, -46.6], texto: 'Rótulo' });
assert.strictEqual(engine._toFeicao({ id: 't2', type: 'Text', layerId: 'l1', coordinates: [-23.5, -46.6] }, layer).geometria.texto, 'Texto');

assert.strictEqual(engine._toFeicao({ id: 'x', type: 'Polygon', layerId: 'l1', coordinates: [[NaN, 1], [2, 3]] }, layer), null, 'geometria degenerada é descartada');
assert.strictEqual(engine._toFeicao({ id: 'y', type: 'Desconhecido', layerId: 'l1', coordinates: [1, 2] }, layer), null);

// --- 2. Estilo, bloqueio e visibilidade ---
console.log('  2. Estilo, bloqueio e visibilidade...');
const styled = engine._toFeicao({
  id: 's', type: 'Polygon', layerId: 'l1', coordinates: [[-23.5, -46.6], [-23.5, -46.59], [-23.51, -46.59]],
  style: { fillColor: '#ff0000', strokeColor: '#00ff00', fillOpacity: 0.5, strokeWidth: 4, strokeDashArray: '6, 4', showLabel: true, labelField: 'area' }
}, layer);
assert.strictEqual(styled.estilo.corPreenchimento, '#ff0000');
assert.strictEqual(styled.estilo.corTraco, '#00ff00');
assert.strictEqual(styled.estilo.opacidadePreenchimento, 0.5);
assert.strictEqual(styled.estilo.espessuraTraco, 4);
assert.strictEqual(styled.estilo.dashArray, '6, 4');
assert.strictEqual(styled.estilo.mostrarRotulo, true);
assert.strictEqual(styled.estilo.campoRotulo, 'area');

assert.strictEqual(point.estilo.icone, undefined, 'pin padrão = marcador circular');
const tower = engine._toFeicao({ id: 'tw', type: 'Point', layerId: 'l1', coordinates: [-23.5, -46.6], style: { markerIcon: 'tower', markerSize: 30 } }, layer);
assert.strictEqual(tower.estilo.icone, 'tower');
assert.strictEqual(tower.estilo.tamanhoIcone, 30);

const defaultColor = engine._toFeicao({ id: 'd', type: 'LineString', layerId: 'l1', coordinates: [[-23.5, -46.6], [-23.5, -46.59]] }, layer);
assert.strictEqual(defaultColor.estilo.corTraco, '#112233', 'linha sem cor própria usa a cor da camada');

assert.strictEqual(engine._toFeicao({ id: 'lk', type: 'Point', layerId: 'l1', coordinates: [-23.5, -46.6], locked: true }, layer).bloqueada, true);
assert.strictEqual(engine._toFeicao({ id: 'lk2', type: 'Point', layerId: 'l1', coordinates: [-23.5, -46.6] }, { ...layer, locked: true }).bloqueada, true, 'camada bloqueada bloqueia a feição');
assert.strictEqual(engine._toFeicao({ id: 'iv', type: 'Point', layerId: 'l1', coordinates: [-23.5, -46.6], visible: false }, layer).excluida, true, 'visible:false some do mapa');

// --- 3. Propriedades ---
console.log('  3. Propriedades...');
const props = engine._toFeicao({
  id: 'pp', type: 'Polygon', layerId: 'l1', coordinates: [[-23.5, -46.6], [-23.5, -46.59], [-23.51, -46.59]],
  name: 'Gleba', category: 'Rural', createdBy: 'Ana', createdAt: '2026-10-09',
  properties: { 'Área (ha)': '10 ha', Perímetro: '1 km', matricula: '123', _interno: 'x', text: 'ignorado' }
}, layer);
assert.deepStrictEqual(Object.keys(props.propriedades).sort(), ['author', 'category', 'created_at', 'matricula', 'name']);
assert.strictEqual(props.propriedades.author, 'Ana');

// --- 4. Versões oficial × prévia ---
console.log('  4. Vínculo oficial × prévia...');
const mk = (id, status, properties = {}) => ({ id, status, type: 'Point', layerId: 'l1', coordinates: [-23.5, -46.6], properties });
let ent = engine._computeEntities([mk('o1', 'oficial', { codigo: 'A' }), mk('p1', 'previa', { codigo: 'A' }), mk('solta', 'oficial'), mk('sem', null)]);
assert.strictEqual(ent.get('o1'), 'o1');
assert.strictEqual(ent.get('p1'), 'o1', 'a prévia aponta para a oficial do mesmo código');
assert.strictEqual(ent.has('solta'), false, 'oficial sem par não precisa de entidade');
assert.strictEqual(ent.has('sem'), false);

ent = engine._computeEntities([mk('p2', 'previa', { linkedId: 'o2' }), mk('o2', 'oficial')]);
assert.strictEqual(ent.get('p2'), 'o2', 'vínculo direto por linkedId');

ent = engine._computeEntities([mk('pa', 'previa', { codigo: 'Z' }), mk('pb', 'previa', { codigo: 'Z' })]);
assert.strictEqual(ent.get('pa'), 'pa', 'sem oficial, a entidade é a menor id');
assert.strictEqual(ent.get('pb'), 'pa');

ent = engine._computeEntities([mk('p3', 'previa', { matricula: 'M' }), mk('o3', 'oficial', { matricula: 'M' }), mk('o4', 'oficial', { matricula: 'N' }), mk('p4', 'previa', { matricula: 'N' })]);
assert.strictEqual(ent.get('p3'), 'o3');
assert.strictEqual(ent.get('p4'), 'o4', 'pares diferentes não se misturam');

// --- 5. Volta: geometria do componente -> coordenadas do app ---
console.log('  5. Coordenadas de volta...');
assert.deepStrictEqual(engine._coordinatesOf({ geometria: { tipo: 'Point', coordenada: [1, 2] } }), [1, 2]);
assert.deepStrictEqual(engine._coordinatesOf({ geometria: { tipo: 'Circle', centro: [1, 2], raioMetros: 5 } }), [1, 2]);
assert.deepStrictEqual(engine._coordinatesOf({ geometria: { tipo: 'LineString', coordenadas: [[1, 2], [3, 4]] } }), [[1, 2], [3, 4]]);
assert.deepStrictEqual(engine._coordinatesOf({ geometria: { tipo: 'Polygon', aneis: [[[1, 2], [3, 4], [5, 6]]] } }), [[1, 2], [3, 4], [5, 6]], 'um anel volta como lista simples');
assert.strictEqual(engine._coordinatesOf({ geometria: { tipo: 'Polygon', aneis: [[[1, 2]], [[3, 4]]] } }).length, 2, 'com furos volta como multianel');

// --- 6. Ordem das camadas ---
assert.strictEqual(engine._zIndexFor(0, 3), 430, 'a primeira camada da árvore fica no topo');
assert.strictEqual(engine._zIndexFor(2, 3), 410);

console.log('✅ Todos os testes do adaptador CanvasMapEngine passaram!');
