// Exportação PNG: as feições vetoriais precisam ser desenhadas com os tipos que o app grava
// ('Polygon' | 'LineString' | 'Point' | 'Circle' | 'Text'). Antes o exportador só reconhecia 'polygon' | 'line' | 'point'
// e a imagem saía sem nenhuma feição.
const noop = () => {};
globalThis.window = { addEventListener: noop, removeEventListener: noop, devicePixelRatio: 1, screen: {}, location: { hostname: 'localhost', search: '' }, requestAnimationFrame: (cb) => setTimeout(cb, 0), cancelAnimationFrame: noop };
globalThis.document = {
  createElement: () => ({ style: {}, classList: { add: noop, remove: noop, toggle: noop }, setAttribute: noop, appendChild: noop, addEventListener: noop }),
  documentElement: { style: {} }, body: { appendChild: noop }, addEventListener: noop, removeEventListener: noop,
  getElementById: () => null, querySelector: () => null, querySelectorAll: () => []
};
globalThis.HTMLElement = class {};
globalThis.customElements = { define: noop, get: () => null };
globalThis.CSSStyleSheet = class { replaceSync() {} };

import assert from 'assert';
const { MapImageExporter } = await import('../src/services/MapImageExporter.js');

console.log('🧪 MapImageExporter: feições vetoriais...');

/** Contexto 2D falso que grava as chamadas junto com o estado de pintura no momento. */
function fakeCtx() {
  const calls = [];
  const ctx = { fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '', lineJoin: '', lineCap: '' };
  for (const name of ['save', 'restore', 'beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'fill', 'stroke', 'fillText', 'strokeText', 'setLineDash']) {
    ctx[name] = (...args) => { calls.push({ name, args, fillStyle: ctx.fillStyle, strokeStyle: ctx.strokeStyle, lineWidth: ctx.lineWidth }); };
  }
  return { ctx, calls, of: (name) => calls.filter(c => c.name === name) };
}

// 1 grau de latitude = 1000 px (norte para cima); 1 grau de longitude = 1000 px
const map = { latLngToContainerPoint: ([lat, lng]) => ({ x: lng * 1000, y: -lat * 1000 }) };
const layer = { id: 'L', color: '#00e08a', visible: true, opacity: 1 };
const draw = (feat, scale = 1, layerOpacity = 1) => {
  const f = fakeCtx();
  MapImageExporter.drawSingleFeature(f.ctx, map, feat, layer, layerOpacity, scale);
  return f;
};

// --- 1. Tipo de desenho ---
for (const [type, kind] of [['Polygon', 'polygon'], ['LineString', 'line'], ['Point', 'point'], ['Circle', 'circle'], ['Text', 'text'], ['polygon', 'polygon'], ['line', 'line'], ['point', 'point']]) {
  assert.strictEqual(MapImageExporter.featureKind({ type }), kind, `${type} -> ${kind}`);
}
assert.strictEqual(MapImageExporter.featureKind({ type: 'Desconhecido' }), null);
assert.strictEqual(MapImageExporter.featureKind(null), null);

// --- 2. Polígono (tipo do app) ---
const square = [[1, 1], [1, 2], [0, 2], [0, 1]];
let f = draw({ id: 'p', type: 'Polygon', coordinates: square, style: { fillColor: '#ff0000', strokeColor: '#00ff00', fillOpacity: 0.5, strokeWidth: 3 } });
assert.strictEqual(f.of('moveTo').length, 1);
assert.strictEqual(f.of('lineTo').length, 3);
assert.strictEqual(f.of('closePath').length, 1);
assert.strictEqual(f.of('fill').length, 1, 'polígono é preenchido');
assert.strictEqual(f.of('fill')[0].fillStyle, 'rgba(255, 0, 0, 0.5)');
assert.deepStrictEqual(f.of('fill')[0].args, ['evenodd']);
assert.strictEqual(f.of('stroke')[0].strokeStyle, '#00ff00');
assert.strictEqual(f.of('stroke')[0].lineWidth, 3);
assert.deepStrictEqual(f.of('moveTo')[0].args, [1000, -1000], 'projeção: lng*1000, -lat*1000');

// anel fechado duplicado não vira vértice repetido
f = draw({ id: 'pc', type: 'Polygon', coordinates: [...square, square[0]] });
assert.strictEqual(f.of('lineTo').length, 3);

// coordenadas {lat, lng} também funcionam
f = draw({ id: 'po', type: 'Polygon', coordinates: square.map(([lat, lng]) => ({ lat, lng })) });
assert.strictEqual(f.of('fill').length, 1);

// polígono com furo: um único caminho com 2 anéis e preenchimento 'evenodd'
const hole = [[0.8, 1.2], [0.8, 1.8], [0.2, 1.8], [0.2, 1.2]];
f = draw({ id: 'ph', type: 'Polygon', coordinates: [square, hole] });
assert.strictEqual(f.of('beginPath').length, 1);
assert.strictEqual(f.of('moveTo').length, 2, 'externo + furo no mesmo caminho');
assert.strictEqual(f.of('closePath').length, 2);
assert.deepStrictEqual(f.of('fill')[0].args, ['evenodd'], 'furo vazado');

// sem preenchimento / sem contorno
f = draw({ id: 'pn', type: 'Polygon', coordinates: square, style: { fillColor: 'none', strokeColor: 'none' } });
assert.strictEqual(f.of('fill').length, 0);
assert.strictEqual(f.of('stroke').length, 0);

// opacidade da camada multiplica a do preenchimento
f = draw({ id: 'po2', type: 'Polygon', coordinates: square, style: { fillColor: '#0000ff', fillOpacity: 0.8 } }, 1, 0.5);
assert.strictEqual(f.of('fill')[0].fillStyle, 'rgba(0, 0, 255, 0.4)');

// rótulo no centroide
f = draw({ id: 'pl', type: 'Polygon', coordinates: square, name: 'Gleba 1' });
assert.ok(f.of('fillText').some(c => c.args[0] === 'Gleba 1'), 'nome vira rótulo');

// tracejado respeita a escala
f = draw({ id: 'pd', type: 'Polygon', coordinates: square, style: { strokeDashArray: '6, 4' } }, 2);
assert.deepStrictEqual(f.of('setLineDash')[0].args, [[12, 8]]);

// --- 3. Linha ---
f = draw({ id: 'l', type: 'LineString', coordinates: [[0, 0], [1, 1], [2, 0]], style: { strokeColor: '#00ff00', strokeWidth: 4 } });
assert.strictEqual(f.of('moveTo').length, 1);
assert.strictEqual(f.of('lineTo').length, 2);
assert.strictEqual(f.of('stroke').length, 1);
assert.strictEqual(f.of('stroke')[0].strokeStyle, '#00ff00');
assert.strictEqual(f.of('fill').length, 0, 'linha não é preenchida');

f = draw({ id: 'lm', type: 'LineString', coordinates: [[[0, 0], [1, 1]], [[2, 2], [3, 3]]] });
assert.strictEqual(f.of('moveTo').length, 2, 'multilinha: uma parte por moveTo');
assert.strictEqual(f.of('stroke').length, 1);

// linha usa a cor própria da feição quando não há strokeColor
f = draw({ id: 'lc', type: 'LineString', coordinates: [[0, 0], [1, 1]], color: '#123456' });
assert.strictEqual(f.of('stroke')[0].strokeStyle, '#123456');

// --- 4. Ponto ---
f = draw({ id: 'pt', type: 'Point', coordinates: [1, 2], color: '#0000ff', style: { markerSize: 30 } });
const arcs = f.of('arc');
assert.strictEqual(arcs.length, 4, 'halo, borda, círculo e ponto central');
assert.deepStrictEqual(arcs[2].args.slice(0, 3), [2000, -1000, 15], 'círculo principal no ponto, raio = markerSize/2');
assert.strictEqual(f.of('fill')[2].fillStyle, '#0000ff');

// --- 5. Círculo (raio em metros) ---
f = draw({ id: 'ci', type: 'Circle', coordinates: [0, 0], radius: 111320 / 10, style: { fillColor: '#ffff00', fillOpacity: 1 } });
assert.strictEqual(f.of('arc').length, 1);
assert.ok(Math.abs(f.of('arc')[0].args[2] - 100) < 1e-6, `raio em px = 100 (0,1° * 1000), obtido ${f.of('arc')[0].args[2]}`);
assert.strictEqual(f.of('fill')[0].fillStyle, 'rgba(255, 255, 0, 1)');
assert.strictEqual(draw({ id: 'c0', type: 'Circle', coordinates: [0, 0] }).calls.length, 2 /* save/restore */, 'círculo sem raio não desenha');

// --- 6. Texto ---
f = draw({ id: 'tx', type: 'Text', coordinates: [1, 1], properties: { text: 'Anotação' } });
assert.ok(f.of('fillText').some(c => c.args[0] === 'Anotação'));
assert.strictEqual(draw({ id: 'tx0', type: 'Text', coordinates: [1, 1] }).of('fillText').length, 0, 'texto vazio não desenha');

// --- 7. Entradas hostis: nada desenhado, nada lançado ---
for (const bad of [
  { id: 'a', type: 'Polygon', coordinates: [[NaN, 1], [2, 3]] },
  { id: 'b', type: 'Polygon', coordinates: [[0, 0], [1, 1]] },
  { id: 'c', type: 'LineString', coordinates: [[0, 0]] },
  { id: 'd', type: 'Point', coordinates: [NaN, NaN] },
  { id: 'e', type: 'Point' },
  { id: 'g', type: 'Desconhecido', coordinates: [1, 2] },
  { id: 'h', type: 'Polygon', coordinates: 'x' },
  null
]) {
  const r = draw(bad);
  assert.strictEqual(r.of('fill').length + r.of('stroke').length + r.of('arc').length, 0, `entrada inválida não desenha (${bad && bad.id})`);
}

// --- 8. drawVectorFeatures: camadas, visibilidade e exclusão ---
const layers = [
  { id: 'top', color: '#ff0000', visible: true, opacity: 1 },
  { id: 'hidden', color: '#00ff00', visible: false },
  { id: 'bottom', color: '#0000ff', visible: true, opacity: 0.5 }
];
const feats = [
  { id: '1', type: 'Polygon', layerId: 'top', coordinates: square },
  { id: '2', type: 'Polygon', layerId: 'hidden', coordinates: square },
  { id: '3', type: 'Polygon', layerId: 'bottom', coordinates: square },
  { id: '4', type: 'Polygon', layerId: 'top', coordinates: square, visible: false },
  { id: '5', type: 'Polygon', layerId: 'top', coordinates: square, is_deleted: true },
  { id: '6', type: 'Polygon', layerId: 'top', coordinates: square, _deleted: true },
  { id: '7', type: 'Polygon', layerId: 'sem-camada', coordinates: square }
];
f = fakeCtx();
MapImageExporter.drawVectorFeatures(f.ctx, map, feats, layers, 1);
assert.strictEqual(f.of('fill').length, 2, 'só as feições visíveis, não excluídas, de camadas visíveis');
assert.strictEqual(f.of('fill')[0].fillStyle, 'rgba(0, 0, 255, 0.175)', 'a camada de baixo é pintada primeiro (0,35 * 0,5)');
assert.strictEqual(f.of('fill')[1].fillStyle, 'rgba(255, 0, 0, 0.35)');

console.log('✅ MapImageExporter: feições vetoriais passaram!');
