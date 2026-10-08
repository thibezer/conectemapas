import assert from 'assert';
import { FeatureQuery } from '../src/services/FeatureQuery.js';

console.log('--- Testando FeatureQuery com 100.000 feições ---');

const N = 100000;
const layers = Array.from({ length: 10 }, (_, i) => ({ id: `L${i}`, name: `Camada ${i}`, color: '#00e08a', visible: i !== 9 }));
const authors = ['Ana', 'Bruno', 'Carla', 'Diego'];

const features = [];
for (let i = 0; i < N; i++) {
  const lat = -23.7 + Math.random() * 0.2;
  const lng = -53.3 + Math.random() * 0.2;
  const kind = i % 4; // 0 ponto, 1 linha, 2 polígono, 3 círculo
  const base = {
    id: `f${i}`,
    name: `Feição ${i}`,
    layerId: `L${i % 10}`,
    category: i % 3 === 0 ? 'Residencial' : 'Comercial',
    createdBy: authors[i % 4],
    createdAt: new Date(Date.UTC(2026, i % 12, 1 + (i % 28))).toISOString(),
    style: { fillColor: i % 2 ? '#ff0000' : '#00ff00', strokeColor: '#ffffff' },
    properties: { Zona: `Z${i % 20}`, Valor: String((i % 1000) + 0.5) }
  };
  if (kind === 0) features.push({ ...base, type: 'Point', coordinates: [lat, lng] });
  else if (kind === 1) features.push({ ...base, type: 'LineString', coordinates: [[lat, lng], [lat + 0.001, lng + 0.001], [lat + 0.002, lng]] });
  else if (kind === 2) features.push({ ...base, type: 'Polygon', coordinates: [[[lat, lng], [lat, lng + 0.001], [lat + 0.001, lng + 0.001], [lat + 0.001, lng], [lat, lng]]] });
  else features.push({ ...base, type: 'Circle', coordinates: [lat, lng], radius: 50 + (i % 500) });
}

const crit = (field, operator, value, value2) => ({ field, operator, value, value2 });
const run = (label, query, opts = {}) => {
  const t0 = performance.now();
  const r = FeatureQuery.run(features, query, { layers, ...opts });
  const ms = performance.now() - t0;
  console.log(`  ${label}: ${r.ids.length.toLocaleString('pt-BR')} resultados em ${ms.toFixed(0)}ms`);
  return { r, ms };
};

// Limites generosos (5 s) só para pegar regressões grosseiras, não variações de máquina
const LIMIT_MS = 5000;

const cases = [
  ['texto simples', { op: 'AND', items: [crit('name', 'contains', 'feicao 99')] }],
  ['camada + autor', { op: 'AND', items: [crit('layer', 'in', ['L1', 'L2']), crit('createdBy', 'equals', 'Ana')] }],
  ['atributo numérico', { op: 'AND', items: [crit('prop:Valor', 'between', 100, 300)] }],
  ['cor + data', { op: 'AND', items: [crit('fillColor', 'equals', '#ff0000'), crit('createdAt', 'between', '2026-03-01', '2026-06-30')] }],
  ['área geodésica', { op: 'AND', items: [crit('type', 'in', ['Polygon', 'Circle']), crit('area', 'gt', 5000)] }],
  ['grupo OU aninhado', { op: 'OR', items: [crit('prop:Zona', 'equals', 'Z3'), { op: 'AND', items: [crit('vertices', 'gte', 4), crit('category', 'contains', 'resid')] }] }]
];

for (const [label, query] of cases) {
  const { r, ms } = run(label, query);
  assert(r.total === N, 'escopo total deve ser N');
  assert(ms < LIMIT_MS, `${label} levou ${ms.toFixed(0)}ms (limite ${LIMIT_MS}ms)`);
}

// Corretude em volume: resultados batem com um filtro manual equivalente
const manual = features.filter(f => f.createdBy === 'Ana' && (f.layerId === 'L1' || f.layerId === 'L2')).length;
assert.strictEqual(run('conferência manual', { op: 'AND', items: [crit('layer', 'in', ['L1', 'L2']), crit('createdBy', 'equals', 'Ana')] }).r.ids.length, manual);

// Escopo "visíveis" exclui a camada oculta (L9 = 10% das feições)
const visible = FeatureQuery.run(features, null, { layers, scope: 'visible' });
assert.strictEqual(visible.ids.length, N - N / 10);

// Descoberta de atributos também precisa ser rápida
const t0 = performance.now();
const props = FeatureQuery.discoverProperties(features);
const msProps = performance.now() - t0;
console.log(`  discoverProperties: ${props.length} chaves em ${msProps.toFixed(0)}ms`);
assert(msProps < LIMIT_MS);

console.log('✔ FeatureQuery com 100.000 feições passou');

// ---- Ações em lote em volume ----
import { BatchActions } from '../src/services/BatchActions.js';
{
  const log = { history: 0, saved: 0, refresh: 0 };
  const app = {
    features: features.map(f => ({ ...f })),
    layers,
    collabHub: { notifyFeatureUpdated() {}, notifyFeatureDeleted() {} },
    pushHistory: () => { log.history++; },
    saveFeature: () => { log.saved++; },
    removeFeature: () => {},
    refreshMapAndTable: () => { log.refresh++; }
  };
  const ids = FeatureQuery.run(app.features, { op: 'AND', items: [crit('layer', 'in', ['L0'])] }, { layers }).ids; // 10.000
  const t1 = performance.now();
  const res = BatchActions.moveToLayer(app, ids, 'L1', { inheritColor: true });
  const ms = performance.now() - t1;
  console.log(`  moveToLayer: ${res.changed.toLocaleString('pt-BR')} feições em ${ms.toFixed(0)}ms`);
  assert.strictEqual(res.changed, ids.length);
  assert.strictEqual(log.history, 1);
  assert.strictEqual(log.refresh, 1);
  assert.strictEqual(log.saved, ids.length);
  assert(ms < LIMIT_MS, `moveToLayer levou ${ms.toFixed(0)}ms`);
  console.log('✔ Ações em lote com 10.000 feições passaram');
}
