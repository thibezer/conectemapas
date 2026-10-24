/* ==========================================================================
   ConecteMapas - Teste das vistas de mapa da prancha (padrão Revit)
   Cobre:
   1. FeatureStyle: leitura única do estilo do projeto e modelo de rótulo.
   2. BasemapCatalog: chaves antigas e fundo exportável.
   3. PrintViewResolver: hierarquia (projeto → camada → filtros → feição), visibilidade,
      meio-tom, faixa de escala, rótulos, modelos de vista e migração (followProject).
   4. PrintMapRenderer: geometria (furos, multipolígonos), recorte e desenho num canvas falso.
   5. Legenda gerada a partir da vista.
   ========================================================================== */

import assert from 'assert';
import { FeatureStyle, PX_TO_MM } from '../src/services/FeatureStyle.js';
import { BasemapCatalog } from '../src/services/BasemapCatalog.js';
import { PrintViewResolver } from '../src/components/PrintComposer/PrintViewResolver.js';
import { PrintMapRenderer } from '../src/components/PrintComposer/PrintMapRenderer.js';
import { PrintViewEdits } from '../src/components/PrintComposer/PrintViewEdits.js';
import { PrintVisibilityDialog } from '../src/components/PrintComposer/PrintVisibilityDialog.js';
import { QueryBuilder } from '../src/components/AdvancedSearch/QueryBuilder.js';

console.log('--- Teste das vistas de mapa da prancha ---');

// ============================================================================
// 1. FeatureStyle
// ============================================================================
console.log('1. FeatureStyle...');
const casaLayer = { id: 'casas', name: 'Casas', color: '#ff0000' };
const casa = { id: 'c1', layerId: 'casas', type: 'Polygon', name: 'Casa 1', coordinates: [[0, 0], [0, 1], [1, 1]], properties: { 'Área (m²)': 120 } };
let st = FeatureStyle.base(casa, casaLayer);
assert.strictEqual(st.kind, 'polygon');
assert.strictEqual(st.fill.color, '#ff0000', 'Sem estilo próprio, usa a cor da camada');
assert.strictEqual(st.fill.opacity, 0.35);
assert.strictEqual(st.stroke.width, 2.5);
st = FeatureStyle.base({ ...casa, color: '#00ff00', style: { fillColor: 'none', strokeColor: '#123456', strokeWidth: 4 } }, casaLayer);
assert.strictEqual(st.fill.color, 'none');
assert.strictEqual(st.fill.opacity, 0);
assert.strictEqual(st.stroke.color, '#123456');
assert.strictEqual(FeatureStyle.base({ type: 'LineString' }, casaLayer).stroke.color, '#ff0000', 'Linha usa a cor como traço');
assert.strictEqual(FeatureStyle.base({ type: 'Polygon', style: { fillColor: '#abcdef' } }, casaLayer).stroke.color, '#ffffff', 'Preenchimento próprio sem traço: traço branco (como no mapa principal)');
assert.strictEqual(FeatureStyle.labelText(casa, 'name'), 'Casa 1', 'Sem chaves: nome de campo');
assert.strictEqual(FeatureStyle.labelText(casa, 'Lote {name}\\n{Área (m²)} m²'), 'Lote Casa 1\n120 m²', 'Modelo com campos e quebra de linha');
assert.strictEqual(FeatureStyle.labelText(casa, '{inexistente}'), '', 'Campo ausente vira vazio');
console.log('✔ FeatureStyle validado');

// ============================================================================
// 2. BasemapCatalog
// ============================================================================
console.log('2. BasemapCatalog...');
assert.strictEqual(BasemapCatalog.normalize('branco'), 'none');
assert.strictEqual(BasemapCatalog.normalize('cartodb_positron'), 'esri_light');
assert.strictEqual(BasemapCatalog.normalize('esri_dark'), 'dark');
assert.strictEqual(BasemapCatalog.normalize('inexistente'), 'satelite');
assert.strictEqual(BasemapCatalog.normalize(undefined, 'osm'), 'osm');
assert.strictEqual(BasemapCatalog.get('none').tiles.length, 0, 'Vazio não tem tiles');
assert.strictEqual(BasemapCatalog.backgroundOf('branco'), '#ffffff');
assert.ok(BasemapCatalog.isExportable('satelite'));
assert.ok(!BasemapCatalog.isExportable('google_satelite'), 'Google é marcado como instável na exportação');
assert.strictEqual(new Set(BasemapCatalog.list().map(b => b.id)).size, BasemapCatalog.list().length, 'Ids únicos');
console.log('✔ BasemapCatalog validado');

// ============================================================================
// 3. PrintViewResolver
// ============================================================================
console.log('3. PrintViewResolver...');
const layers = [
  { id: 'casas', name: 'Casas', color: '#ff0000' },
  { id: 'arvores', name: 'Árvores', color: '#00aa00', visible: false },
  { id: 'rios', name: 'Rios', color: '#0000ff' }
];
const features = [
  { id: 'c1', layerId: 'casas', type: 'Polygon', name: 'Casa grande', coordinates: [[0, 0], [0, 2], [2, 2], [2, 0]], properties: { uso: 'comercial' } },
  { id: 'c2', layerId: 'casas', type: 'Polygon', name: 'Casa pequena', coordinates: [[3, 3], [3, 4], [4, 4]], properties: { uso: 'residencial' } },
  { id: 'c3', layerId: 'casas', type: 'Polygon', name: 'Casa oculta', visible: false, coordinates: [[5, 5], [5, 6], [6, 6]] },
  { id: 'a1', layerId: 'arvores', type: 'Point', name: 'Ipê', coordinates: [1, 1] },
  { id: 'r1', layerId: 'rios', type: 'LineString', name: 'Rio Azul', coordinates: [[0, 0], [1, 1], [2, 0]] },
  { id: 'x1', layerId: 'rios', type: 'LineString', name: 'Excluído', is_deleted: true, coordinates: [[0, 0], [1, 1]] }
];
const library = {
  filters: [
    { id: 'f-com', name: 'Comercial', layerIds: ['casas'], query: { op: 'AND', items: [{ field: 'prop:uso', operator: 'equals', value: 'comercial' }] } },
    { id: 'f-casas', name: 'Todas as casas', layerIds: ['casas'], query: null }
  ],
  viewTemplates: [
    { id: 't1', name: 'Urbano', include: { layers: true, filters: false, basemap: true }, view: { basemap: 'branco', layers: { rios: { visible: false } } } }
  ]
};
const visibleIds = (view, scale = 0) => {
  const ctx = PrintViewResolver.prepare(view, { features, layers, library, scale });
  return features.filter(f => PrintViewResolver.isVisible(f, ctx)).map(f => f.id);
};
const resolveOf = (view, id, scale = 0) => {
  const ctx = PrintViewResolver.prepare(view, { features, layers, library, scale });
  return PrintViewResolver.resolve(features.find(f => f.id === id), ctx);
};

// Item antigo (sem vista): espelha o projeto
const legacyItem = { type: 'map' };
let view = PrintViewResolver.effectiveView(legacyItem, library);
assert.strictEqual(view.followProject, true, 'Item sem vista espelha o mapa principal');
assert.deepStrictEqual(visibleIds(view), ['c1', 'c2', 'r1'], 'Espelha camada e feição ocultas no projeto; excluída nunca aparece');

// Vista nova: independente do mapa principal (padrão Revit: visível até desligar)
view = PrintViewResolver.effectiveView({ type: 'map', view: { center: [0, 0], zoom: 3 }, viewConfig: PrintViewResolver.emptyView() }, library);
assert.deepStrictEqual(visibleIds(view), ['c1', 'c2', 'c3', 'a1', 'r1'], 'Vista independente mostra tudo que não foi desligado nela');

// Migração na primeira edição: fotografa a visibilidade do projeto
const migrating = { type: 'map' };
assert.ok(PrintViewResolver.detachFromProject(migrating, layers, features));
assert.strictEqual(migrating.viewConfig.followProject, false);
assert.deepStrictEqual(migrating.viewConfig.layers.arvores, { visible: false });
assert.deepStrictEqual(migrating.viewConfig.elements.c3, { visible: false });
assert.ok(!PrintViewResolver.detachFromProject(migrating, layers, features), 'Só migra uma vez');
assert.deepStrictEqual(visibleIds(PrintViewResolver.effectiveView(migrating, library)), ['c1', 'c2', 'r1'], 'Depois da migração a prancha continua igual');

// Camada desligada na vista
view = { ...PrintViewResolver.emptyView(), layers: { casas: { visible: false } } };
assert.deepStrictEqual(visibleIds(view), ['a1', 'r1']);

// Gráficos da camada ("casas em cinza") vencem a cor própria da feição
const cinza = { ...PrintViewResolver.emptyView(), layers: { casas: { fill: { color: '#9ca3af', opacity: 0.8 }, stroke: { color: '#4b5563', widthMm: 0.35, pattern: 'tracejado' } } } };
let g = resolveOf(cinza, 'c1');
assert.strictEqual(g.fill.color, '#9ca3af');
assert.strictEqual(g.fill.opacity, 0.8);
assert.strictEqual(g.stroke.color, '#4b5563');
assert.strictEqual(g.stroke.widthMm, 0.35);
assert.ok(Array.isArray(g.stroke.dashMm) && g.stroke.dashMm.length === 2, 'Tracejado vira padrão em mm');
g = resolveOf(PrintViewResolver.emptyView(), 'c1');
assert.strictEqual(g.fill.color, '#ff0000', 'Sem ajuste, segue o projeto');
assert.strictEqual(g.stroke.widthMm, 2.5 * PX_TO_MM, 'Espessura do projeto convertida para mm');

// Filtros: o do topo vence; visível desmarcado oculta
view = {
  ...PrintViewResolver.emptyView(),
  layers: { casas: { fill: { color: '#9ca3af' } } },
  filters: [
    { filterId: 'f-com', enabled: true, fill: { color: '#ff8800' } },
    { filterId: 'f-casas', enabled: true, fill: { color: '#0000aa' }, stroke: { color: '#111111' } }
  ]
};
assert.strictEqual(resolveOf(view, 'c1').fill.color, '#ff8800', 'Filtro do topo vence o de baixo');
assert.strictEqual(resolveOf(view, 'c1').stroke.color, '#111111', 'Campo que o filtro do topo não define vem do filtro de baixo');
assert.strictEqual(resolveOf(view, 'c2').fill.color, '#0000aa', 'Só o filtro que casa');
view.filters[0].enabled = false;
assert.strictEqual(resolveOf(view, 'c1').fill.color, '#0000aa', 'Filtro desativado não vale');
view.filters = [{ filterId: 'f-com', enabled: true, visible: false }];
assert.deepStrictEqual(visibleIds(view), ['c2', 'c3', 'a1', 'r1'], 'Filtro com visível desmarcado oculta o que casa');
view.elements = { c1: { visible: true } };
assert.ok(visibleIds(view).includes('c1'), 'Ajuste por feição reexibe o que o filtro escondeu');
view.layers = { casas: { visible: false } };
assert.ok(!visibleIds(view).includes('c1'), 'Mas não religa camada desligada');
view = { ...PrintViewResolver.emptyView(), filters: [{ filterId: 'apagado', enabled: true, visible: false }] };
assert.strictEqual(visibleIds(view).length, 5, 'Filtro excluído da biblioteca é ignorado');

// Feição na vista vence filtros
view = {
  ...PrintViewResolver.emptyView(),
  filters: [{ filterId: 'f-casas', enabled: true, fill: { color: '#0000aa' } }],
  elements: { c1: { fill: { color: '#ffff00' } } }
};
assert.strictEqual(resolveOf(view, 'c1').fill.color, '#ffff00');

// Meio-tom
view = { ...PrintViewResolver.emptyView(), layers: { rios: { halftone: true } } };
g = resolveOf(view, 'r1');
assert.strictEqual(g.stroke.color, '#8080ff', 'Meio-tom mistura 50% com branco');

// Faixa de escala
view = { ...PrintViewResolver.emptyView(), layers: { casas: { minScale: 500, maxScale: 5000 } } };
assert.ok(visibleIds(view, 2000).includes('c1'));
assert.ok(!visibleIds(view, 10000).includes('c1'), 'Acima de 1:5.000 some');
assert.ok(!visibleIds(view, 200).includes('c1'), 'Abaixo de 1:500 some');

// Rótulos por camada
view = { ...PrintViewResolver.emptyView(), labels: { casas: { show: true, text: 'Lote {name}', sizePt: 9 } } };
g = resolveOf(view, 'c1');
assert.strictEqual(g.label.show, true);
assert.strictEqual(g.label.sizePt, 9);
assert.strictEqual(PrintViewResolver.labelText(features[0], g.label.text), 'Lote Casa grande');
assert.strictEqual(resolveOf(PrintViewResolver.emptyView(), 'c1').label.show, false, 'Sem configuração, sem rótulo');

// Modelo de vista: seções incluídas vêm do modelo
const withTpl = { type: 'map', basemap: 'osm', viewConfig: { ...PrintViewResolver.emptyView(), templateId: 't1', layers: { casas: { visible: false } }, filters: [{ filterId: 'f-com', enabled: true, visible: false }] } };
view = PrintViewResolver.effectiveView(withTpl, library);
assert.strictEqual(view.basemap, 'none', 'Fundo vem do modelo (chave antiga normalizada)');
assert.deepStrictEqual(view.layers, { rios: { visible: false } }, 'Camadas vêm do modelo, não do item');
assert.strictEqual(view.filters.length, 1, 'Filtros não incluídos continuam do item');
assert.ok(PrintViewResolver.isLockedByTemplate(withTpl, library, 'layers'));
assert.ok(!PrintViewResolver.isLockedByTemplate(withTpl, library, 'filters'));
withTpl.viewConfig.templateId = 'apagado';
assert.deepStrictEqual(PrintViewResolver.effectiveView(withTpl, library).layers, { casas: { visible: false } }, 'Modelo excluído: volta a valer o item');
console.log('✔ PrintViewResolver validado');

// ============================================================================
// 4. PrintMapRenderer
// ============================================================================
console.log('4. PrintMapRenderer...');
const hole = [[[0, 0], [0, 10], [10, 10], [10, 0]], [[2, 2], [2, 4], [4, 4], [4, 2]]];
assert.strictEqual(PrintMapRenderer.polygonsOf(hole).length, 1);
assert.strictEqual(PrintMapRenderer.polygonsOf(hole)[0].length, 2, 'Furo preservado');
const multi = [hole, [[[20, 20], [20, 30], [30, 30]]]];
assert.strictEqual(PrintMapRenderer.polygonsOf(multi).length, 2, 'Multipolígono: todas as partes');
assert.strictEqual(PrintMapRenderer.polygonsOf([{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 1 }])[0][0].length, 3, 'Aceita {lat, lng}');
assert.strictEqual(PrintMapRenderer.polygonsOf([[0, 0], [1, 1]]).length, 0, 'Anel com menos de 3 vértices é descartado');
assert.strictEqual(PrintMapRenderer.linesOf([[[0, 0], [1, 1]], [[2, 2], [3, 3]]]).length, 2, 'Multilinha');
assert.deepStrictEqual(PrintMapRenderer.bboxOf({ coordinates: hole }), [0, 0, 10, 10]);
assert.ok(!PrintMapRenderer.intersects([0, 0, 1, 1], { south: 5, west: 5, north: 6, east: 6 }), 'Recorte pela área do mapa');

// Canvas falso que registra as chamadas
const calls = [];
const fakeCtx = new Proxy({}, {
  get(target, prop) {
    if (prop in target) return target[prop];
    return (...args) => { calls.push([prop, ...args]); };
  },
  set(target, prop, value) { target[prop] = value; calls.push(['set', prop, value]); return true; }
});
const project = ([lat, lng]) => ({ x: lng * 10, y: -lat * 10 });
const drawView = {
  ...PrintViewResolver.emptyView(),
  layers: { casas: { fill: { pattern: 'hachura' } } },
  labels: { rios: { show: true, text: '{name}' } }
};
const ctx = { ...PrintViewResolver.prepare(drawView, { features, layers, library }), view: drawView };
const drawn = PrintMapRenderer.draw(fakeCtx, { features: [...features, { id: 'h', layerId: 'rios', type: 'Polygon', coordinates: hole }], layers, resolveCtx: ctx, project, pxPerMm: 3.78 });
assert.strictEqual(drawn, 6, 'Desenha as 6 feições visíveis (a excluída fica de fora)');
assert.ok(calls.some(c => c[0] === 'fill' && c[1] === 'evenodd'), 'Polígono preenchido com evenodd (furos)');
assert.ok(calls.some(c => c[0] === 'clip'), 'Hachura recortada no polígono');
assert.ok(calls.some(c => c[0] === 'fillText' && c[1] === 'Rio Azul'), 'Rótulo da linha desenhado');
const firstRio = calls.findIndex(c => c[0] === 'set' && c[1] === 'strokeStyle' && c[2] === '#0000ff');
const firstCasa = calls.findIndex(c => c[0] === 'set' && c[1] === 'fillStyle' && c[2] === '#ff0000');
assert.ok(firstRio >= 0 && firstRio < firstCasa, 'A 1ª camada da lista (Casas) fica por cima: é desenhada por último');
console.log('✔ PrintMapRenderer validado');

// ============================================================================
// 5. Legenda a partir da vista
// ============================================================================
console.log('5. Legenda...');
const legView = {
  ...PrintViewResolver.emptyView(),
  layers: { arvores: { visible: false }, casas: { fill: { color: '#9ca3af' } } },
  filters: [{ filterId: 'f-com', enabled: true, fill: { color: '#ff8800' } }]
};
const entries = PrintViewResolver.legendEntries(legView, { features, layers, library });
assert.deepStrictEqual(entries.map(e => e.name), ['Casas', 'Rios', 'Comercial'], 'Só camadas visíveis na vista, depois os filtros que mudam a aparência');
assert.strictEqual(entries[0].graphics.fill.color, '#9ca3af', 'Amostra com a cor da vista');
assert.strictEqual(entries[2].graphics.fill.color, '#ff8800');
assert.deepStrictEqual(PrintViewResolver.legendEntries(legView, { features, layers, library, hiddenLayerIds: ['rios'] }).map(e => e.name), ['Casas', 'Comercial'], 'Camada desmarcada na legenda');
console.log('✔ Legenda validada');

// 6. Edições da vista (esparsas) e janela Visibilidade/Gráficos
// ============================================================================
console.log('6. Edições e janela VV...');
const ev = PrintViewResolver.emptyView();
PrintViewEdits.setField(ev, 'layer', 'casas', 'fill.color', '#9ca3af');
PrintViewEdits.setField(ev, 'layer', 'casas', 'stroke.widthMm', 0.35);
assert.deepStrictEqual(ev.layers.casas, { fill: { color: '#9ca3af' }, stroke: { widthMm: 0.35 } });
PrintViewEdits.setField(ev, 'layer', 'casas', 'fill.color', null);
assert.deepStrictEqual(ev.layers.casas, { stroke: { widthMm: 0.35 } }, 'Vazio volta a herdar e some o objeto vazio');
PrintViewEdits.setVisible(ev, 'layer', 'rios', false);
assert.deepStrictEqual(ev.layers.rios, { visible: false });
PrintViewEdits.setVisible(ev, 'layer', 'rios', true);
assert.ok(!('rios' in ev.layers), 'Religar remove o ajuste (visível é o padrão)');
assert.ok(PrintViewEdits.hasOverride(ev, 'layer', 'casas'));
PrintViewEdits.reset(ev, 'layer', 'casas');
assert.ok(!PrintViewEdits.hasOverride(ev, 'layer', 'casas'), 'Voltar ao projeto');
PrintViewEdits.copyProjectVisibility(ev, layers);
assert.deepStrictEqual(Object.keys(ev.layers), ['arvores'], 'Copia só o que está desligado no mapa principal');
PrintViewEdits.addFilter(ev, 'f-com');
PrintViewEdits.addFilter(ev, 'f-casas');
assert.deepStrictEqual(ev.filters.map(f => f.filterId), ['f-casas', 'f-com'], 'Filtro novo entra no topo');
assert.ok(!PrintViewEdits.addFilter(ev, 'f-com'), 'Sem filtro repetido');
PrintViewEdits.moveFilter(ev, 'f-com', -1);
assert.deepStrictEqual(ev.filters.map(f => f.filterId), ['f-com', 'f-casas']);
PrintViewEdits.setField(ev, 'filter', 'f-com', 'fill.color', '#ff0000');
PrintViewEdits.reset(ev, 'filter', 'f-com');
assert.deepStrictEqual(ev.filters[0], { filterId: 'f-com', enabled: true }, 'Reset do filtro mantém vínculo e ativo');
PrintViewEdits.removeFilter(ev, 'f-com');
assert.deepStrictEqual(ev.filters.map(f => f.filterId), ['f-casas']);

const vvComposer = { items: [{ id: 'm', type: 'map', name: 'Mapa' }], layers, features, library };
let vvHtml = PrintVisibilityDialog.render(vvComposer, vvComposer.items[0], { tab: 'layers' });
assert.ok(vvHtml.includes('espelha o mapa principal'), 'Avisa que o mapa ainda espelha o principal');
assert.strictEqual((vvHtml.match(/data-row-kind="layer"/g) || []).length, 3, 'Uma linha por camada do projeto');
vvComposer.items[0].viewConfig = { ...PrintViewResolver.emptyView(), layers: { casas: { fill: { color: '#9ca3af' } } } };
vvHtml = PrintVisibilityDialog.render(vvComposer, vvComposer.items[0], { tab: 'layers' });
assert.ok(vvHtml.includes('is-overridden'), 'Célula com ajuste próprio é marcada');
vvComposer.items[0].locked = true;
vvHtml = PrintVisibilityDialog.render(vvComposer, vvComposer.items[0], { tab: 'layers' });
assert.ok(vvHtml.includes('Mapa bloqueado') && /data-gfx="visible"[^>]*disabled/.test(vvHtml), 'Mapa bloqueado: campos desabilitados');
const fakeInput = (gfx, props) => ({ dataset: { gfx }, type: 'text', ...props });
assert.strictEqual(PrintVisibilityDialog.parseField(fakeInput('fill.opacity', { value: '70' })), 0.7);
assert.strictEqual(PrintVisibilityDialog.parseField(fakeInput('fill.opacity', { value: '' })), null, 'Vazio herda');
assert.strictEqual(PrintVisibilityDialog.parseField(fakeInput('minScale', { value: '0' })), null, 'Escala 0 = sem limite');
assert.strictEqual(PrintVisibilityDialog.parseField(fakeInput('halftone', { type: 'checkbox', checked: false })), null, 'Meio-tom desmarcado herda');
assert.strictEqual(PrintVisibilityDialog.parseField(fakeInput('visible', { type: 'checkbox', checked: false })), false);
console.log('✔ Edições e janela VV validadas');

// Aba Rótulos
const lbComposer = { items: [{ id: 'm', type: 'map', viewConfig: { ...PrintViewResolver.emptyView(), labels: { casas: { show: true, text: 'Lote {name}' } } } }], layers, features, library };
const lbHtml = PrintVisibilityDialog.render(lbComposer, lbComposer.items[0], { tab: 'labels' });
assert.strictEqual((lbHtml.match(/data-row-kind="label"/g) || []).length, 3, 'Uma linha de rótulo por camada');
assert.ok(lbHtml.includes('Lote Casa grande'), 'Exemplo do rótulo com o primeiro objeto da camada');
assert.ok(lbHtml.includes('data-vv-field="uso"'), 'Campos de properties oferecidos como chips');
assert.strictEqual(PrintVisibilityDialog.parseField(fakeInput('halo', { type: 'checkbox', checked: false })), false, 'Halo desmarcado grava false (o padrão é com halo)');
console.log('✔ Aba Rótulos validada');

// Aba Filtros e construtor de critérios
const flComposer = { items: [{ id: 'm', type: 'map', viewConfig: { ...PrintViewResolver.emptyView(), filters: [{ filterId: 'f-com', enabled: true, fill: { color: '#ff8800' } }, { filterId: 'sumiu', enabled: true }] } }], layers, features, library };
let flHtml = PrintVisibilityDialog.render(flComposer, flComposer.items[0], { tab: 'filters' });
assert.strictEqual((flHtml.match(/data-row-kind="filter"/g) || []).length, 2, 'Uma linha por filtro da vista');
assert.ok(flHtml.includes('Filtro excluído da biblioteca'), 'Filtro apagado da biblioteca aparece como tal');
const addSelect = flHtml.slice(flHtml.indexOf('data-vv-add-filter'), flHtml.indexOf('</select>', flHtml.indexOf('data-vv-add-filter')));
assert.ok(addSelect.includes('value="f-casas"') && !addSelect.includes('value="f-com"'), 'Só oferece filtros que ainda não estão na vista');
assert.deepStrictEqual(PrintVisibilityDialog.filterMatches(library.filters[0], flComposer), ['c1'], 'Contagem do filtro respeita camadas e critérios');
flHtml = PrintVisibilityDialog.render(flComposer, flComposer.items[0], { tab: 'filters', filterDraft: { id: null, name: '', layerIds: [], query: QueryBuilder.emptyQuery() } });
assert.ok(flHtml.includes('Novo filtro') && flHtml.includes('data-role="field"'), 'Editor de filtro com o construtor de critérios');
assert.ok(!QueryBuilder.hasActiveCriteria(QueryBuilder.emptyQuery()), 'Consulta vazia não tem critério ativo');
assert.ok(QueryBuilder.hasActiveCriteria({ op: 'AND', items: [{ field: 'name', operator: 'notEmpty' }] }));
let q = QueryBuilder.emptyQuery();
const qb = new QueryBuilder({ getQuery: () => q, onChange: () => {} });
const qev = (attrs) => ({ target: { dataset: attrs.dataset, value: attrs.value, checked: attrs.checked, closest: (sel) => (sel === '[data-act]' && attrs.dataset.act ? { dataset: attrs.dataset } : null) } });
qb.handleClick(qev({ dataset: { act: 'add-group', path: '' } }));
assert.strictEqual(q.items.length, 2, 'Adiciona grupo');
qb.handleChange(qev({ dataset: { role: 'field', path: '0' }, value: 'area' }));
assert.strictEqual(q.items[0].operator, 'eq', 'Trocar o campo ajusta o operador');
qb.handleInput(qev({ dataset: { role: 'value', path: '0', slot: 'value' }, value: '500' }));
assert.strictEqual(q.items[0].value, '500');
qb.handleClick(qev({ dataset: { act: 'rm', path: '1' } }));
qb.handleClick(qev({ dataset: { act: 'rm', path: '0' } }));
assert.strictEqual(q.items.length, 1, 'Raiz nunca fica vazia');
console.log('✔ Aba Filtros validada');



console.log('\n🎉 TESTES DAS VISTAS DE MAPA PASSARAM!');// ============================================================================
