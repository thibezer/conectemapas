// Teste unitário (sem rede): inspetor com várias feições selecionadas
// Valores iguais aparecem, diferentes viram "Varia"; edição vale para todas num passo de histórico.

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
let promptAnswer = null;
globalThis.prompt = () => promptAnswer;

// LayerPanel importa CSS (Vite): no Node, .css vira módulo vazio
const { register } = await import('node:module');
register('data:text/javascript,' + encodeURIComponent(
  "export async function load(url, ctx, next) { return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, ctx); }"
));

const { FeatureGeometryUtils: U } = await import('../src/services/MapEngine/FeatureGeometryUtils.js');
const { FeaturePropertiesAdapter: A } = await import('../src/components/LayerPanel/FeaturePropertiesAdapter.js');
const { FeatureInspectorRenderer } = await import('../src/components/LayerPanel/FeatureInspectorRenderer.js');
const { LayerPanel } = await import('../src/components/LayerPanel.js');

let failures = 0;
const assert = (cond, msg) => {
  if (cond) console.log('  ✔', msg);
  else { failures++; console.error('  ✖', msg); }
};

const c = [-23.7661, -53.3206];
const square = (dx, s = 0.001) => [[c[0], c[1] + dx], [c[0], c[1] + dx + s], [c[0] + s, c[1] + dx + s], [c[0] + s, c[1] + dx]];

const app = {
  layers: [{ id: 'l1', name: 'Lotes' }, { id: 'l2', name: 'Reservas' }],
  features: [
    { id: 'a', type: 'Polygon', name: 'Lote 1', layerId: 'l1', coordinates: square(0), style: { fillColor: '#ff0000', strokeWidth: 2 }, properties: { Dono: 'Ana', Zona: 'Rural' }, customAttributes: [{ key: 'Lote', value: '7' }] },
    { id: 'b', type: 'Polygon', name: 'Lote 2', layerId: 'l1', coordinates: square(0.002, 0.0015), style: { fillColor: '#00ff00', strokeWidth: 2 }, properties: { Dono: 'Bia', Zona: 'Rural' }, customAttributes: [{ key: 'Obs', value: '' }, { key: 'Lote', value: '7' }] },
    { id: 'c', type: 'Polygon', name: 'Lote 3', layerId: 'l2', coordinates: square(0.004), style: { fillColor: '#0000ff', strokeWidth: 2 }, visible: false, properties: { Zona: 'Rural' }, customAttributes: [] },
    { id: 'line', type: 'LineString', name: 'Cerca', layerId: 'l1', coordinates: [c, [c[0] + 0.001, c[1]]], style: {}, properties: {} }
  ],
  history: [],
  saved: [],
  pushHistory(label) { this.history.push(label); },
  saveFeaturesBulk(list) { this.saved.push(list.map(f => f.id)); },
  refreshMapAndTable() {}
};

let refreshes = 0;
const panel = {
  app,
  layers: app.layers,
  getLatestFeature(id) { return app.features.find(f => f.id === id) || null; },
  refreshInspector() { refreshes++; },
  calculatePolygonArea: (x) => U.calculatePolygonArea(x),
  calculatePolygonPerimeter: (x) => U.calculatePolygonPerimeter(x),
  calculatePolylineLength: (x) => U.calculatePolylineLength(x)
};

const rowsOf = (cfg) => new Map(cfg.categorias.flatMap(cat => cat.propriedades).map(p => [p.id, p]));
const pick = (...ids) => ids.map(id => app.features.find(f => f.id === id));

console.log('--- Mescla das propriedades ---');
const cfg = A.gerarConfiguracaoMulti(panel, pick('a', 'b'));
const rows = rowsOf(cfg);
assert(rows.get('layerId').valor === 'l1', 'camada igual em todas é exibida');
assert(rows.get('name').valor === '' && rows.get('name').placeholder === 'Varia', 'nome diferente aparece como "Varia"');
assert(rows.get('strokeWidth').valor === 2, 'espessura igual é exibida');
assert(rows.get('fillColor').textoAmostra === 'Varia', 'cor diferente aparece como "Varia"');
assert(rows.get('prop_Dono').placeholder === 'Varia' && rows.get('prop_Zona').valor === 'Rural', 'atributos: diferente → "Varia", igual → valor');
assert(rows.has('custom_key_Lote') && rows.get('custom_key_Lote').valor === '7', 'atributo personalizado casado pelo nome, não pela posição');
assert(!rows.has('custom_key_Obs'), 'atributo que só uma tem fica de fora');
assert(!rows.has('id') && !cfg.categorias.some(c => c.id === 'vertices' || c.id === 'azimutes'), 'ID, vértices e azimutes (de uma feição só) ficam de fora');
assert(rows.get('area_ha').valor === 'Varia', 'métrica individual diferente aparece como "Varia"');
assert(rows.get('multi_qtd').valor === '2 feições' && /ha/.test(rows.get('multi_area').valor), 'totais da seleção na Geometria');

const visCfg = rowsOf(A.gerarConfiguracaoMulti(panel, pick('a', 'c')));
const vis = visCfg.get('visible');
assert(vis.tipo === 'selecao' && vis.valor === '__varia__' && vis.opcoes[0].rotulo === 'Varia', 'booleano diferente vira seleção com "Varia"');
assert(visCfg.get('layerId').valor === '__varia__' && visCfg.get('layerId').opcoes[0].rotulo === 'Varia', 'seleção diferente ganha a opção "Varia"');

console.log('--- Renderização ---');
const fakePanel = { ...panel, isFloating: false, escapeHtml: (s) => String(s), getMultiSelectedFeatures: () => pick('a', 'line') };
const mixedHtml = FeatureInspectorRenderer.render(fakePanel, 'sidebar');
assert(/tipos diferentes/.test(mixedHtml) && !/ui-tabela-propriedades/.test(mixedHtml), 'tipos diferentes: só o resumo, sem tabela');
const sameHtml = FeatureInspectorRenderer.render({ ...fakePanel, getMultiSelectedFeatures: () => pick('a', 'b') }, 'sidebar');
assert(/2 feições selecionadas/.test(sameHtml) && /ui-tabela-propriedades/.test(sameHtml), 'mesmo tipo: cabeçalho da seleção e tabela');

console.log('--- Edição em lote ---');
A.aplicarAlteracaoMulti(panel, ['a', 'b'], 'strokeWidth', 4);
assert(app.history.length === 1 && app.saved[0].join() === 'a,b', 'um passo de histórico e uma gravação em lote');
assert(pick('a', 'b').every(f => f.style.strokeWidth === 4), 'espessura aplicada nas duas');
assert(pick('a')[0].style.fillColor === '#ff0000' && pick('b')[0].style.fillColor === '#00ff00', 'cores individuais preservadas');

A.aplicarAlteracaoMulti(panel, ['a', 'b'], 'strokeWidth', 4);
assert(app.history.length === 1, 'valor que já é o de todas não gera passo de histórico');

A.aplicarAlteracaoMulti(panel, ['a', 'c'], 'visible', '__varia__');
assert(app.history.length === 1, 'escolher "Varia" de novo não grava nada');
A.aplicarAlteracaoMulti(panel, ['a', 'c'], 'strokeWidth', null);
assert(app.history.length === 1, 'número apagado não grava nada');

A.aplicarAlteracaoMulti(panel, ['a', 'c'], 'visible', '__sim__');
assert(pick('a', 'c').every(f => f.visible === true), '"Sim" vira true em todas');

A.aplicarAlteracaoMulti(panel, ['a', 'b'], 'custom_key_Lote', '8');
assert(pick('a')[0].customAttributes[0].value === '8' && pick('b')[0].customAttributes[1].value === '8', 'atributo personalizado editado pela chave em cada feição');

app.features = app.features.map(f => (f.id === 'b' ? { ...f, locked: true } : f));
A.aplicarAlteracaoMulti(panel, ['a', 'b'], 'description', 'Revisar');
assert(pick('a')[0].description === 'Revisar' && pick('b')[0].description === undefined, 'feição bloqueada é pulada');
const lockedRows = rowsOf(A.gerarConfiguracaoMulti(panel, pick('a', 'b')));
assert(lockedRows.get('description').somenteLeitura === false, 'linha continua editável se alguma não está bloqueada');

promptAnswer = 'Matrícula';
A.executarAcaoMulti(panel, ['a', 'c'], 'acao_adicionar_atributo');
assert(pick('a', 'c').every(f => f.customAttributes.some(x => x.key === 'Matrícula')), 'novo atributo criado em todas');

console.log('--- LayerPanel ---');
const lp = new LayerPanel({ app, layers: app.layers, features: app.features });
lp.selectedFeatureIds = new Set(['a', 'c']);
assert(lp.getMultiSelectedFeatures().map(f => f.id).join() === 'a,c', 'seleção múltipla resolvida pela versão mais recente');
lp.selectedFeature = pick('a')[0];
assert(lp.getMultiSelectedFeatures().length === 0, 'com feição única não há seleção múltipla');
lp.selectedFeature = null;
lp.handleSelectedFeatureRemoved('c');
assert(lp.selectedFeatureIds.size === 1 && lp.selectedFeature?.id === 'a', 'excluir da seleção múltipla até sobrar uma volta ao inspetor de uma feição');

if (failures > 0) {
  console.error(`\n${failures} verificação(ões) falharam`);
  process.exit(1);
}
console.log('\nInspetor com seleção múltipla: OK');
process.exit(0);
