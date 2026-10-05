// Teste unitário (sem rede): correções da aba de Inspeção
// Área elipsoidal, furos/multipolígonos, perímetro, anéis fechados, empacotamento de
// campos para a nuvem, migração de métricas gravadas e edição sobre a versão mais recente.

const createMockEl = () => ({
  setAttribute: () => {}, getAttribute: () => null, style: { setProperty: () => {} },
  appendChild: () => {}, remove: () => {}, querySelector: () => null, insertBefore: () => {}, children: [],
  classList: { add: () => {}, remove: () => {}, toggle: () => {} },
  textContent: '', addEventListener: () => {}, removeEventListener: () => {}
});
globalThis.window = {
  requestAnimationFrame: (cb) => setTimeout(cb, 0),
  location: { hostname: 'localhost' }, devicePixelRatio: 1, screen: {},
  addEventListener: () => {}, removeEventListener: () => {}
};
globalThis.document = {
  createElement: createMockEl, documentElement: { style: {} }, body: { appendChild: () => {} },
  addEventListener: () => {}, removeEventListener: () => {},
  getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], activeElement: null
};
globalThis.HTMLElement = class {};
globalThis.customElements = { define: () => {}, get: () => null };
globalThis.confirm = () => true;
globalThis.prompt = () => null;

const { FeatureGeometryUtils: U } = await import('../src/services/MapEngine/FeatureGeometryUtils.js');
const { packFeatureForCloud, unpackFeatureFromCloud } = await import('../src/services/Storage/CloudSyncEngine.js');
const { FeatureSyncController } = await import('../src/controllers/FeatureSyncController.js');
const { FeaturePropertiesAdapter } = await import('../src/components/LayerPanel/FeaturePropertiesAdapter.js');
const { StorageService } = await import('../src/services/StorageService.js');

let failures = 0;
const assert = (cond, msg) => {
  if (cond) console.log('  ✔', msg);
  else { failures++; console.error('  ✖', msg); }
};
const near = (a, b, tolPct) => Math.abs(a - b) / b * 100 <= tolPct;

const c = [-23.7661, -53.3206];
const d = 0.0003;
const sq = [[c[0] - d, c[1] - d], [c[0] - d, c[1] + d], [c[0] + d, c[1] + d], [c[0] + d, c[1] - d]];
const hole = [[c[0] - d / 2, c[1] - d / 2], [c[0] - d / 2, c[1] + d / 2], [c[0] + d / 2, c[1] + d / 2], [c[0] + d / 2, c[1] - d / 2]];

// Referência elipsoidal local (GRS80): dφ·M · dλ·N·cosφ
const rad = Math.PI / 180;
const a = 6378137, e2 = 0.00669438002290, phi = c[0] * rad;
const w = 1 - e2 * Math.sin(phi) ** 2;
const N = a / Math.sqrt(w), M = a * (1 - e2) / w ** 1.5;
const ref = (2 * d * rad * M) * (2 * d * rad * N * Math.cos(phi));

console.log('--- Área e perímetro ---');
assert(near(U.calculatePolygonArea(sq), ref, 0.01), `polígono simples ≈ ${ref.toFixed(1)} m² (obtido ${U.calculatePolygonArea(sq).toFixed(1)})`);
assert(near(U.calculatePolygonArea([...sq, sq[0]]), ref, 0.01), 'anel fechado dá a mesma área');
assert(near(U.calculatePolygonArea([sq, hole]), ref * 0.75, 0.05), 'furo é subtraído');
assert(near(U.calculatePolygonArea([[sq], [sq.map(p => [p[0] + 0.01, p[1]])]]), ref * 2, 0.1), 'multipolígono soma as partes');
const sideNS = U.calculateDistance(sq[0], sq[3]);
const sideEW = U.calculateDistance(sq[0], sq[1]);
assert(near(U.calculatePolygonPerimeter(sq), 2 * (sideNS + sideEW), 0.01), 'perímetro inclui o lado de fechamento');

console.log('--- Anéis e vértices ---');
const closedPoly = { type: 'Polygon', coordinates: [...sq, [...sq[0]]] };
const rings = U.getVertexRings(closedPoly);
assert(rings.length === 1 && rings[0].points.length === 4 && rings[0].closed, 'anel fechado listado sem o vértice duplicado');
assert(U.countVertices(closedPoly) === 4, 'contagem ignora o fechamento');
const moved = rings[0].points.map(p => [...p]);
moved[0] = [c[0] - 0.001, c[1] - 0.001];
const edited = U.replaceRing(closedPoly.coordinates, rings[0].path, moved, true);
assert(edited.length === 5 && edited[0][0] === edited[4][0] && edited[0][1] === edited[4][1], 'editar V1 move também o ponto de fechamento');
const holed = { type: 'Polygon', coordinates: [sq, hole] };
const holedRings = U.getVertexRings(holed);
assert(holedRings.length === 2 && holedRings[1].label === 'Furo 1', 'furos listados como anéis próprios');
assert(U.countVertices(holed) === 8, 'contagem soma anéis externos e furos');

console.log('--- Métricas gravadas ---');
const metrics = U.computeMetricProperties({ type: 'Polygon', coordinates: sq });
assert(metrics['Área (m²)'] === `${U.calculatePolygonArea(sq).toFixed(1)} m²`, 'Área (m²) gravada com a fórmula nova');
const app = {
  projectId: 'test_proj_insp',
  layers: [],
  features: [
    { id: 'old1', type: 'Polygon', coordinates: sq, properties: { 'Área (ha)': '0.89 ha', 'Área (m²)': '8922.3 m²', Dono: 'Ana' } },
    { id: 'clean', type: 'Polygon', coordinates: sq, properties: { Dono: 'Bia' } }
  ]
};
let queued = [];
const originalQueue = StorageService.queueFeaturesBulkUpsert;
StorageService.queueFeaturesBulkUpsert = (feats) => { queued = feats; };
const fixedCount = FeatureSyncController.refreshStoredMetrics(app);
StorageService.queueFeaturesBulkUpsert = originalQueue;
assert(fixedCount === 1 && queued.length === 1 && queued[0].id === 'old1', 'migração corrige só feições com métricas antigas');
assert(app.features[0].properties['Área (m²)'] === metrics['Área (m²)'] && app.features[0].properties.Dono === 'Ana', 'valor corrigido e atributos do usuário preservados');
assert(!('Área (m²)' in app.features[1].properties), 'feição sem métricas não ganha atributos novos');
assert(FeatureSyncController.refreshStoredMetrics(app) === 0, 'migração é idempotente');

console.log('--- Campos extras na nuvem ---');
const local = { id: 'f1', type: 'Point', coordinates: c, description: 'Marco', category: 'Divisa', locked: true, status: 'oficial', customAttributes: [{ key: 'Lote', value: '7' }], properties: { Dono: 'Ana' } };
const packed = packFeatureForCloud(local);
assert(packed.properties._cm && packed.properties._cm.description === 'Marco' && packed.properties.Dono === 'Ana', 'descrição/categoria/bloqueio empacotados em properties._cm');
assert(local.properties._cm === undefined, 'empacotar não altera a feição local');
const restored = unpackFeatureFromCloud({ id: 'f1', properties: JSON.parse(JSON.stringify(packed.properties)) });
assert(restored.description === 'Marco' && restored.category === 'Divisa' && restored.locked === true && restored.customAttributes[0].key === 'Lote', 'campos restaurados no recebimento');
assert(restored.properties._cm === undefined && restored.properties.Dono === 'Ana', 'chave interna removida das propriedades');
const unlocked = packFeatureForCloud({ ...local, locked: false, description: '' });
assert(!('locked' in unlocked.properties._cm) && !('description' in unlocked.properties._cm), 'desbloqueio e descrição vazia não ficam presos no pacote');

console.log('--- Inspetor edita a versão mais recente ---');
const remoteGeom = [[c[0], c[1]], [c[0] + 0.001, c[1]], [c[0] + 0.001, c[1] + 0.001]];
const appState = {
  features: [{ id: 'p1', type: 'Polygon', name: 'Lote', layerId: 'l1', coordinates: remoteGeom, style: { fillOpacity: 0.35 }, properties: {} }],
  layers: [{ id: 'l1', name: 'Lotes' }]
};
const updates = [];
const panel = {
  app: appState,
  layers: appState.layers,
  selectedFeature: { id: 'p1', type: 'Polygon', name: 'Lote', layerId: 'l1', coordinates: sq, style: {}, properties: {} }, // cópia velha
  getLatestFeature(id) { return appState.features.find(f => f.id === id) || null; },
  commitFeatureEdit(id, mutate) {
    const draft = JSON.parse(JSON.stringify(this.getLatestFeature(id)));
    if (mutate(draft) === false) return null;
    updates.push(draft);
    appState.features[0] = draft;
    return draft;
  },
  refreshSelectedFeature() {},
  calculatePolygonArea: (x) => U.calculatePolygonArea(x),
  calculatePolygonPerimeter: (x) => U.calculatePolygonPerimeter(x),
  calculatePolylineLength: (x) => U.calculatePolylineLength(x)
};
FeaturePropertiesAdapter.aplicarAlteracao(panel, 'p1', 'name', 'Lote 7');
assert(updates[0] && updates[0].name === 'Lote 7', 'nome gravado');
assert(JSON.stringify(updates[0].coordinates) === JSON.stringify(remoteGeom), 'geometria do colaborador preservada (não volta para a cópia do painel)');
FeaturePropertiesAdapter.aplicarAlteracao(panel, 'p1', 'fillOpacity', 0);
assert(updates[1] && updates[1].style.fillOpacity === 0, 'opacidade 0% é aceita');
FeaturePropertiesAdapter.aplicarAlteracao(panel, 'p1', 'strokeWidth', '0');
assert(updates[2] && updates[2].style.strokeWidth === 0, 'espessura 0 é aceita');

appState.features[0] = { ...appState.features[0], locked: true };
const countBefore = updates.length;
FeaturePropertiesAdapter.aplicarAlteracao(panel, 'p1', 'name', 'Invasor');
assert(updates.length === countBefore, 'feição bloqueada rejeita edição');

const config = FeaturePropertiesAdapter.gerarConfiguracao(panel, { ...appState.features[0], locked: false, coordinates: sq });
const geom = config.categorias.find(cat => cat.id === 'geometria').propriedades;
const perim = geom.find(p => p.id === 'perimetro_m');
assert(perim && !perim.valor.startsWith('0,00'), `perímetro do polígono exibido (${perim && perim.valor})`);
const pointCfg = FeaturePropertiesAdapter.gerarConfiguracao(panel, { id: 'pt', type: 'Point', coordinates: c, style: { markerIcon: 'star' }, properties: {} });
const icon = pointCfg.categorias.find(cat => cat.id === 'simbologia').propriedades.find(p => p.id === 'markerIcon');
assert(icon.opcoes.every(o => ['pin', 'tower', 'tree', 'warning', 'water', 'boundary'].includes(o.id)) && icon.valor === 'pin', 'símbolos oferecidos são os que o mapa desenha');

if (failures > 0) {
  console.error(`\n${failures} verificação(ões) falharam`);
  process.exit(1);
}
console.log('\nCorreções do inspetor: OK');
process.exit(0);
