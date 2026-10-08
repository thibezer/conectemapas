import assert from 'assert';
import { FeatureQuery, parseNumber, normalizeText } from '../src/services/FeatureQuery.js';
import { BatchActions } from '../src/services/BatchActions.js';
import { FeatureGeometryUtils } from '../src/services/MapEngine/FeatureGeometryUtils.js';

console.log('🧪 Iniciando testes da busca avançada (FeatureQuery) e ações em lote (BatchActions)...');

const layers = [
  { id: 'L1', name: 'Lotes', color: '#ff0000', visible: true },
  { id: 'L2', name: 'Vias Públicas', color: '#00ff00', visible: true },
  { id: 'L3', name: 'Oculta', color: '#0000ff', visible: false }
];

const square = (lat, lng, d) => [[[lat, lng], [lat, lng + d], [lat + d, lng + d], [lat + d, lng], [lat, lng]]];

const mk = () => [
  { id: 'a', type: 'Polygon', name: 'Lote Água Verde', layerId: 'L1', category: 'Residencial', createdBy: 'Ana',
    createdAt: '2026-03-10T10:00:00Z', color: '#ff0000', style: { fillColor: '#FF0000', strokeColor: '#ff0000', fillOpacity: 0.5 },
    coordinates: square(-23.76, -53.32, 0.001), properties: { Zona: 'ZR-1', 'Área (ha)': '1,5 ha', Valor: '1.250,50' } },
  { id: 'b', type: 'Polygon', name: 'Lote Centro', layerId: 'L1', category: 'Comercial', createdBy: 'Bruno',
    createdAt: '2026-05-01T10:00:00Z', locked: true, style: { fillColor: '#00f' }, color: '#00f',
    coordinates: square(-23.77, -53.33, 0.01), properties: { Zona: 'ZC-2', Valor: '300' } },
  { id: 'c', type: 'LineString', name: 'Rua das Flores', layerId: 'L2', category: 'Eixo Viário', createdBy: 'Ana',
    createdAt: '2026-04-15T10:00:00Z', color: '#00ff00', style: { strokeColor: '#00ff00' },
    coordinates: [[-23.76, -53.32], [-23.761, -53.321], [-23.762, -53.322]], properties: {} },
  { id: 'd', type: 'Point', name: 'Praça', layerId: 'L2', visible: false, createdBy: 'Ana', color: '#abc',
    style: { fillColor: '#abc' }, coordinates: [-23.7, -53.3], properties: {} },
  { id: 'e', type: 'Text', name: 'Rótulo', layerId: 'L3', style: { textColor: '#111111' }, coordinates: [-23.7, -53.3], properties: { text: 'oi' } }
];

const ids = (q, opts) => FeatureQuery.run(mk(), q, { layers, ...opts }).ids.sort();
const crit = (field, operator, value, value2) => ({ field, operator, value, value2 });
const and = (...items) => ({ op: 'AND', items });
const or = (...items) => ({ op: 'OR', items });

// Utilitários
assert.strictEqual(normalizeText('  ÁGUA Verde '), 'agua verde');
assert.strictEqual(parseNumber('1.250,50'), 1250.5);
assert.strictEqual(parseNumber('1,5 ha'), 1.5);
assert.strictEqual(parseNumber('abc'), null);
console.log('✔ Utilitários de normalização passaram');

// Consulta vazia = tudo; critério incompleto é ignorado
assert.deepStrictEqual(ids(and()), ['a', 'b', 'c', 'd', 'e']);
assert.deepStrictEqual(ids(and(crit('name', 'contains', ''))), ['a', 'b', 'c', 'd', 'e']);
console.log('✔ Consulta vazia/incompleta retorna todas');

// Texto sem acento / caixa
assert.deepStrictEqual(ids(and(crit('name', 'contains', 'agua'))), ['a']);
assert.deepStrictEqual(ids(and(crit('name', 'startsWith', 'lote'))), ['a', 'b']);
assert.deepStrictEqual(ids(and(crit('name', 'endsWith', 'FLORES'))), ['c']);
assert.deepStrictEqual(ids(and(crit('name', 'regex', '^(Rua|Praça)'))), ['c', 'd']);
assert.deepStrictEqual(ids(and(crit('category', 'empty'))), ['d', 'e']);
assert.deepStrictEqual(ids(and(crit('createdBy', 'notEmpty'))), ['a', 'b', 'c', 'd']);
console.log('✔ Operadores de texto passaram');

// E / OU / NÃO e aninhamento
assert.deepStrictEqual(ids(and(crit('createdBy', 'equals', 'Ana'), crit('type', 'in', ['Polygon', 'LineString']))), ['a', 'c']);
assert.deepStrictEqual(ids(or(crit('name', 'contains', 'centro'), crit('name', 'contains', 'praça'))), ['b', 'd']);
assert.deepStrictEqual(ids({ op: 'AND', not: true, items: [crit('type', 'in', ['Polygon'])] }), ['c', 'd', 'e']);
assert.deepStrictEqual(
  ids(and(crit('createdBy', 'equals', 'Ana'), or(crit('type', 'in', 'Point'), crit('layer', 'in', 'L1')))),
  ['a', 'd']
);
console.log('✔ Grupos E/OU/NÃO aninhados passaram');

// Camada por id e por nome
assert.deepStrictEqual(ids(and(crit('layer', 'in', ['L2']))), ['c', 'd']);
assert.deepStrictEqual(ids(and(crit('layer', 'in', ['vias publicas']))), ['c', 'd']);
assert.deepStrictEqual(ids(and(crit('layer', 'contains', 'lote'))), ['a', 'b']);
assert.deepStrictEqual(ids(and(crit('layer', 'notIn', ['L1', 'L2']))), ['e']);
console.log('✔ Filtro por camada passou');

// Booleanos
assert.deepStrictEqual(ids(and(crit('locked', 'isTrue'))), ['b']);
assert.deepStrictEqual(ids(and(crit('visible', 'isFalse'))), ['d']);
console.log('✔ Booleanos passaram');

// Cores (normaliza #RGB e caixa)
assert.deepStrictEqual(ids(and(crit('fillColor', 'equals', '#ff0000'))), ['a']);
assert.deepStrictEqual(ids(and(crit('fillColor', 'equals', '#0000FF'))), ['b']);
assert.deepStrictEqual(ids(and(crit('strokeColor', 'in', ['#00ff00', '#FF0000']))), ['a', 'c']);
assert.deepStrictEqual(ids(and(crit('fillColor', 'equals', '#aabbcc'))), ['d']);
console.log('✔ Cores passaram');

// Datas
assert.deepStrictEqual(ids(and(crit('createdAt', 'after', '2026-04-15'))), ['b']);
assert.deepStrictEqual(ids(and(crit('createdAt', 'before', '2026-04-01'))), ['a']);
assert.deepStrictEqual(ids(and(crit('createdAt', 'between', '2026-04-15', '2026-05-01'))), ['b', 'c']);
console.log('✔ Datas passaram');

// Atributos livres (texto e numérico pt-BR)
assert.deepStrictEqual(ids(and(crit('prop:Zona', 'startsWith', 'zr'))), ['a']);
assert.deepStrictEqual(ids(and(crit('prop:Valor', 'gt', 1000))), ['a']);
assert.deepStrictEqual(ids(and(crit('prop:Valor', 'between', 100, 400))), ['b']);
assert.deepStrictEqual(ids(and(crit('prop:Área (ha)', 'gte', 1.5))), ['a']);
assert.deepStrictEqual(ids(and(crit('prop:Zona', 'empty'))), ['c', 'd', 'e']);
const found = FeatureQuery.discoverProperties(mk()).map(p => p.id);
assert(found.includes('prop:Zona') && found.includes('prop:Valor'));
console.log('✔ Atributos dinâmicos passaram');

// Geometria
const a = FeatureQuery.run(mk(), and(crit('area', 'gt', 1000000)), { layers });
assert.deepStrictEqual(a.ids, ['b'], 'só o lote grande passa de 1 km²');
assert.deepStrictEqual(ids(and(crit('area', 'between', 1000, 50000))), ['a']);
assert.deepStrictEqual(ids(and(crit('length', 'gt', 100), crit('type', 'in', 'LineString'))), ['c']);
assert.deepStrictEqual(ids(and(crit('vertices', 'eq', 3))), ['c']);
assert.deepStrictEqual(ids(and(crit('vertices', 'gte', 4))), ['a', 'b']);
console.log('✔ Geometria (área, comprimento, vértices) passou');

// Escopo
assert.deepStrictEqual(ids(and(), { scope: 'visible' }), ['a', 'b', 'c']);
assert.deepStrictEqual(ids(and(), { scope: 'activeLayer', activeLayerId: 'L2' }), ['c', 'd']);
console.log('✔ Escopo passou');

// Validação
assert.strictEqual(FeatureQuery.validate(and(crit('name', 'regex', '('))).length, 1);
assert.strictEqual(FeatureQuery.validate(and(crit('area', 'contains', 'x'))).length, 1);
assert.strictEqual(FeatureQuery.validate(and(crit('foo', 'equals', 'x'))).length, 1);
assert.strictEqual(FeatureQuery.validate(and(crit('name', 'contains', 'x'))).length, 0);
assert.deepStrictEqual(ids(and(crit('name', 'regex', '('))), [], 'regex inválida não casa nada');
console.log('✔ Validação passou');

// Cache de área/comprimento entre consultas (chave = referência das coordenadas)
{
  const feats = mk();
  const orig = FeatureGeometryUtils.calculatePolygonArea;
  let calls = 0;
  FeatureGeometryUtils.calculatePolygonArea = function (...args) { calls++; return orig.apply(this, args); };
  try {
    const q = and(crit('area', 'gt', 1000));
    const first = FeatureQuery.run(feats, q, { layers }).ids;
    const afterFirst = calls;
    assert(afterFirst > 0, 'a primeira consulta calcula a área');
    assert.deepStrictEqual(FeatureQuery.run(feats, q, { layers }).ids, first);
    assert.strictEqual(calls, afterFirst, 'a segunda consulta reaproveita o cache');

    // Editar a geometria gera coordenadas novas: o valor antigo não pode vazar
    const big = feats.find(f => f.id === 'b');
    const edited = { ...big, coordinates: square(-23.77, -53.33, 0.0001) };
    const idx = feats.indexOf(big);
    feats[idx] = edited;
    const after = FeatureQuery.run(feats, and(crit('area', 'gt', 1000000)), { layers }).ids;
    assert.deepStrictEqual(after, [], 'lote encolhido não pode mais passar de 1 km²');
    assert(calls > afterFirst, 'geometria nova foi recalculada');
  } finally {
    FeatureGeometryUtils.calculatePolygonArea = orig;
  }
  console.log('✔ Cache de métricas geométricas passou');
}

// ---- Ações em lote -------------------------------------------------------
function fakeApp() {
  const log = { history: [], saved: [], notified: [], removed: [], refresh: 0 };
  return {
    log,
    features: mk(),
    layers: layers.map(l => ({ ...l })),
    collabHub: { notifyFeatureUpdated: f => log.notified.push(f.id), notifyFeatureDeleted: id => log.notified.push('del:' + id) },
    pushHistory: d => log.history.push(d),
    saveFeature: f => log.saved.push(f.id),
    removeFeature: id => log.removed.push(id),
    refreshMapAndTable: () => { log.refresh++; }
  };
}

{
  const app = fakeApp();
  const r = BatchActions.moveToLayer(app, ['a', 'b', 'c', 'zzz'], 'L2');
  assert.deepStrictEqual(r.ids, ['a'], 'b bloqueada, c já está em L2');
  assert.strictEqual(r.locked, 1);
  assert.strictEqual(r.missing, 1);
  assert.strictEqual(r.unchanged, 1);
  assert.strictEqual(app.features.find(f => f.id === 'a').layerId, 'L2');
  assert.strictEqual(app.features.find(f => f.id === 'b').layerId, 'L1', 'bloqueada intacta');
  assert.strictEqual(app.features.find(f => f.id === 'a').style.fillColor, '#FF0000', 'sem herdar cor mantém estilo');
  assert.strictEqual(app.log.history.length, 1, 'um único passo de histórico');
  assert.strictEqual(app.log.refresh, 1, 'um único re-render');
  assert.deepStrictEqual(app.log.saved, ['a']);
  console.log('✔ moveToLayer (bloqueio, inexistente, histórico único) passou');
}
{
  const app = fakeApp();
  const r = BatchActions.moveToLayer(app, ['a', 'c'], 'L1', { inheritColor: true });
  assert.strictEqual(r.changed, 2);
  const c = app.features.find(f => f.id === 'c');
  assert.strictEqual(c.layerId, 'L1');
  assert.strictEqual(c.style.strokeColor, '#ff0000', 'linha herda traço');
  assert.strictEqual(c.style.fillColor, undefined, 'linha não ganha preenchimento');
  assert.strictEqual(BatchActions.moveToLayer(app, ['a'], 'NOPE').changed, 0);
  assert.strictEqual(app.log.history.length, 1, 'destino inexistente não gera histórico');
  console.log('✔ moveToLayer com herança de cor passou');
}
{
  const app = fakeApp();
  const r = BatchActions.applyColors(app, ['a', 'c', 'e', 'd'], { fillColor: '#123456', strokeColor: '#654321' });
  assert.strictEqual(r.changed, 4);
  const g = id => app.features.find(f => f.id === id);
  assert.strictEqual(g('a').style.fillColor, '#123456');
  assert.strictEqual(g('a').style.strokeColor, '#654321');
  assert.strictEqual(g('c').style.strokeColor, '#654321');
  assert.strictEqual(g('c').style.fillColor, undefined, 'linha só recebe traço');
  assert.strictEqual(g('e').style.textColor, '#123456', 'texto recebe cor do texto');
  assert.strictEqual(g('e').style.strokeColor, undefined);
  assert.strictEqual(BatchActions.applyColors(app, ['a'], {}).changed, 0);
  console.log('✔ applyColors por tipo de geometria passou');
}
{
  const app = fakeApp();
  assert.strictEqual(BatchActions.setLocked(app, ['a', 'b'], true).changed, 1, 'b já bloqueada');
  assert.strictEqual(BatchActions.setLocked(app, ['a', 'b', 'c'], false).changed, 2);
  assert.strictEqual(app.features.find(f => f.id === 'b').locked, false);
  assert.strictEqual(BatchActions.setVisible(app, ['d'], true).changed, 1);
  assert.strictEqual(BatchActions.setProperty(app, ['a', 'c'], 'Status', 'ok').changed, 2);
  assert.strictEqual(app.features.find(f => f.id === 'c').properties.Status, 'ok');
  assert.strictEqual(BatchActions.setProperty(app, ['a'], 'Status', 'ok').changed, 0, 'sem mudança não gera histórico');
  console.log('✔ bloquear/visibilidade/atributo em massa passaram');
}
{
  const app = fakeApp();
  const r = BatchActions.remove(app, ['a', 'b', 'c']);
  assert.deepStrictEqual(r.ids, ['a', 'c']);
  assert.strictEqual(r.locked, 1);
  assert.deepStrictEqual(app.features.map(f => f.id).sort(), ['b', 'd', 'e']);
  assert.deepStrictEqual(app.log.removed.sort(), ['a', 'c']);
  assert(BatchActions.describe(r, 'excluídas').includes('1 ignorada(s) (1 bloqueada(s))'));
  console.log('✔ remove em lote passou');
}

console.log('🏁 Busca avançada e ações em lote: todos os testes passaram');
