import assert from 'assert';

console.log('🧪 Testando SelectionHUD (ações declarativas, métricas e menu "mais ações")...');

const noop = () => {};
const makeEl = () => ({
  style: {},
  classList: { add: noop, remove: noop, toggle: noop },
  setAttribute: noop,
  appendChild: noop,
  addEventListener: noop,
  querySelector: () => null,
  querySelectorAll: () => []
});
globalThis.window = { addEventListener: noop, removeEventListener: noop };
globalThis.document = {
  createElement: makeEl,
  body: makeEl(),
  addEventListener: noop,
  removeEventListener: noop,
  getElementById: () => null,
  querySelector: () => null,
  documentElement: { style: {} },
  activeElement: null
};

const { SelectionHUD } = await import('../src/components/SelectionHUD.js');

const calls = [];
const hud = new SelectionHUD({
  onInspect: (f) => calls.push(['inspect', f.id]),
  onOpenTable: (fs) => calls.push(['table', fs.length]),
  onAction: (id) => calls.push(['action', id]),
  onDelete: (fs) => calls.push(['delete', fs.length]),
  onClear: () => calls.push(['clear'])
});

const layers = [{ id: 'l1', name: 'Vias <b>', color: '#10b981' }];
// Quadrado de ~1 km² (0,009° ≈ 1 km): só a ordem de grandeza importa
const poly = { id: 'p1', type: 'Polygon', name: 'Lote "A"', layerId: 'l1', coordinates: [[-15, -47], [-15, -46.991], [-14.991, -46.991], [-14.991, -47]] };
const line = { id: 'ln1', type: 'LineString', name: 'Rua', layerId: 'l1', locked: true, coordinates: [[-15, -47], [-15, -46.99]] };
const circle = { id: 'c1', type: 'Circle', name: 'Raio', layerId: 'l1', radius: 250, coordinates: [-15, -47] };

// --- Métricas ---------------------------------------------------------------
assert.match(hud.metricOf([poly]), /(ha|km²|m²) · .*(m|km)$/, 'polígono: área · perímetro');
assert.match(hud.metricOf([line]), /(m|km)$/, 'linha: extensão');
assert.strictEqual(hud.metricOf([circle]), 'raio 250.0 m');
assert.strictEqual(hud.metricOf([{ id: 'pt', type: 'Point', coordinates: [-15, -47] }]), '', 'ponto não tem métrica');
assert.match(hud.metricOf([poly, line]), /^Σ .* · Σ /, 'seleção múltipla soma área e extensão');
assert.strictEqual(hud.metricOf(Array.from({ length: 201 }, () => poly)), '', 'acima do limite não calcula');
assert.strictEqual(hud.metricOf([{ type: 'Polygon', coordinates: null }]).includes('NaN'), false, 'dado inválido não vaza NaN');

// --- Estrutura dos botões ---------------------------------------------------
const acts = (groups) => groups.flat().map(b => b.act);
hud.layers = layers;
hud.selectedFeatures = [poly];
assert.deepStrictEqual(acts(hud.singleGroups()), ['inspect', 'popup', 'table', 'nodes', 'duplicate', 'style', 'zoom', 'layer', 'more', 'delete', 'clear']);
hud.selectedFeatures = [line];
assert.ok(!acts(hud.singleGroups()).includes('nodes'), 'feição bloqueada não edita vértices');
hud.selectedFeatures = [circle];
assert.strictEqual(hud.singleGroups().flat().find(b => b.act === 'nodes').label, 'Raio');
hud.selectedFeatures = [poly, line];
assert.deepStrictEqual(acts(hud.multiGroups()), ['table', 'zoom', 'style', 'layer', 'more', 'delete', 'clear']);

// --- Renderização -----------------------------------------------------------
hud.selectedFeatures = [poly];
const html = hud.renderActions();
assert.ok(html.includes('role="toolbar"'), 'barra com role toolbar');
assert.ok(/data-act="more"[^>]*aria-haspopup="menu"/.test(html), 'botão "mais" declara menu');
assert.ok(/data-act="duplicate"[^>]*aria-label=/.test(html), 'botão só com ícone tem nome acessível');
assert.ok((html.match(/cm-sel-sep/g) || []).length === 3, 'três separadores entre quatro grupos');
const info = hud.renderInfo();
assert.ok(info.includes('Lote &quot;A&quot;'), 'nome escapado');
assert.ok(!info.includes('cm-sel-lock'), 'sem cadeado quando livre');
hud.selectedFeatures = [line];
assert.ok(hud.renderInfo().includes('cm-sel-lock'), 'cadeado quando bloqueada');

// --- Menu "mais ações" respeita o estado da seleção -------------------------
hud.selectedFeatures = [poly];
let menu = hud.moreMenuHtml();
assert.ok(/data-mod="mod-lock"(?![^>]*disabled)/.test(menu) && menu.includes('Bloquear'));
assert.ok(/data-mod="mod-copy-wkt"(?![^>]*disabled)/.test(menu), 'WKT habilitado para uma feição');
hud.selectedFeatures = [poly, circle];
menu = hud.moreMenuHtml();
assert.ok(/data-mod="mod-copy-wkt"[^>]*disabled/.test(menu), 'WKT desabilitado com várias feições');
hud.selectedFeatures = [{ ...poly, locked: true }];
assert.ok(hud.moreMenuHtml().includes('Desbloquear'), 'rótulo vira Desbloquear');
assert.ok(/data-mod="mod-buffer"[^>]*disabled/.test(hud.moreMenuHtml()), 'buffer desabilitado se tudo bloqueado');
assert.ok(hud.layerMenuHtml().includes('Vias &lt;b&gt;'), 'nome da camada escapado');

// --- Despacho -----------------------------------------------------------------
hud.selectedFeatures = [poly];
hud._handlers.inspect();
hud._handlers.duplicate({});
hud._handlers.table();
hud._handlers.delete();
hud.pickModAction({ disabled: false, dataset: { mod: 'mod-lock' } });
hud.pickModAction({ disabled: true, dataset: { mod: 'mod-buffer' } });
assert.deepStrictEqual(calls, [
  ['inspect', 'p1'], ['action', 'mod-duplicate'], ['table', 1], ['delete', 1], ['action', 'mod-lock']
]);

// update() com stubs não quebra e esconde com seleção vazia
hud.update([poly], layers);
hud.update([], layers);
assert.strictEqual(hud.element.style.display, 'none');

console.log('✔ SelectionHUD validado!');
