/* ==========================================================================
   ConecteMapas - Campos por tipo do painel de Item (PrintItemFields)
   Contrato com o <ui-painel-propriedades> do kit: ids únicos, tipos válidos,
   valor de cada seleção entre as opções e gravação de cada campo no item.
   ========================================================================== */

import assert from 'assert';
import { PrintItemFields } from '../src/components/PrintComposer/PrintItemFields.js';
import { PrintItemsManager } from '../src/components/PrintComposer/PrintItemsManager.js';

console.log('--- Teste dos campos por tipo do painel de Item ---');

const paper = { id: 'A4_L', name: 'A4 Paisagem', width: 297, height: 210 };
const KIT_TYPES = new Set(['texto', 'numero', 'selecao', 'booleano', 'cor', 'acao', 'readonly']);
const layers = [{ id: 'l1', name: 'Camada 1', visible: true }, { id: 'l2', name: 'Camada 2', visible: false }];
const defaults = PrintItemsManager.createDefaultItems('Projeto', paper);
const extra = ['shape', 'image', 'label', 'text_block', 'table_vertices'].map((t, i) => ({ ...PrintItemsManager.createNewItem(t, 'P', i), id: `x-${t}` }));
const items = [...defaults, ...extra];
const composer = { items, layers, features: [], paperSize: paper, library: null, currentBasemap: 'esri_light', leafletMaps: new Map(), selectedItemId: null };

// 1. Contrato: toda entrada é uma propriedade válida do kit e a seleção usa uma opção existente
console.log('1. Contrato com o kit...');
for (const it of items) {
  const entries = PrintItemFields.build(it, composer);
  const ids = entries.map(e => e.prop.id);
  assert.strictEqual(new Set(ids).size, ids.length, `${it.type}: ids de propriedade únicos`);
  entries.forEach(e => {
    assert.ok(KIT_TYPES.has(e.prop.tipo), `${it.type}/${e.prop.id}: tipo "${e.prop.tipo}" existe no kit`);
    assert.ok(e.prop.rotulo, `${it.type}/${e.prop.id}: tem rótulo`);
    assert.ok(e.apply || e.run || e.prop.tipo === 'readonly' || e.transient, `${it.type}/${e.prop.id}: sabe o que fazer ao mudar`);
    if (e.prop.tipo === 'selecao' && !e.prop.somenteLeitura) {
      assert.ok(e.prop.opcoes.some(o => String(o.id) === String(e.prop.valor)), `${it.type}/${e.prop.id}: valor "${e.prop.valor}" está entre as opções`);
    }
    if (e.prop.tipo === 'cor') assert.match(e.prop.valor, /^#[0-9a-f]{6}$/, `${it.type}/${e.prop.id}: cor em #rrggbb`);
  });
}
['map', 'inset_map', 'north_arrow', 'scale_bar', 'legend', 'title_block', 'shape', 'image', 'label', 'text_block', 'table_vertices']
  .forEach(t => assert.ok(PrintItemFields.build(items.find(i => i.type === t), composer).length > 0, `${t} tem campos`));
console.log('✔ Contrato validado');

// 2. Gravar um valor em cada campo não quebra o item
console.log('2. Gravação...');
for (const it of items) {
  const copy = JSON.parse(JSON.stringify(it));
  PrintItemFields.build(copy, composer).filter(e => e.apply).forEach(e => {
    const v = e.prop.tipo === 'booleano' ? true : e.prop.tipo === 'numero' ? (e.prop.min ?? 1) : e.prop.tipo === 'cor' ? '#123456'
      : e.prop.tipo === 'selecao' ? e.prop.opcoes[0].id : 'texto';
    assert.doesNotThrow(() => e.apply(copy, v, composer), `${it.type}/${e.prop.id}`);
  });
}
console.log('✔ Gravação validada');

// 3. Regras específicas
console.log('3. Regras...');
const find = (it, id) => PrintItemFields.find(it, composer, id);

// Fundo do rótulo: ligar usa a cor atual ou branco; desligar limpa
const label = { ...items.find(i => i.type === 'label'), fillColor: '' };
find(label, 'label_bg_on').apply(label, true);
assert.strictEqual(label.fillColor, '#ffffff');
find(label, 'label_fill').apply(label, '#abcdef');
assert.strictEqual(label.fillColor, '#abcdef');
find(label, 'label_bg_on').apply(label, false);
assert.strictEqual(label.fillColor, '');

// Tabela de vértices: nunca fica sem coluna; trocar o CRS volta às colunas do sistema
const vt = { ...items.find(i => i.type === 'table_vertices'), tableMode: 'vertices', crs: 'utm', columns: ['name'] };
assert.strictEqual(find(vt, 'vert_col:name').guard(vt, false), false, 'Não desmarca a última coluna');
assert.strictEqual(find(vt, 'vert_col:azimuth').guard(vt, true), true);
find(vt, 'vert_col:azimuth').apply(vt, true);
assert.deepStrictEqual(vt.columns, ['name', 'azimuth'], 'Colunas na ordem do quadro');
find(vt, 'vert_crs').apply(vt, 'dms');
assert.strictEqual(vt.columns, null, 'Trocar o CRS volta às colunas padrão');
assert.ok(!PrintItemFields.build({ ...vt, tableMode: 'areas' }, composer).some(e => e.prop.id === 'vert_feature'), 'Quadro de áreas não mostra campos de vértices');

// Grade do mapa: tipo/estilo só com a grade ligada; mudar redesenha a grade
const map = items.find(i => i.type === 'map');
assert.ok(!find({ ...map, showGrid: false }, 'map_grid_type'), 'Sem grade, sem tipo de grade');
assert.strictEqual(find({ ...map, showGrid: true }, 'map_grid_type').refresh, 'grid');
assert.strictEqual(find(map, 'map_scale').map, true, 'Escala reaplica o mapa');

// Carimbo: escala própria desliga o acompanhamento; desligar congela o texto à mostra
const tb = JSON.parse(JSON.stringify(items.find(i => i.type === 'title_block')));
find(tb, 'tb_scale').apply(tb, '1:500');
assert.strictEqual(tb.properties.scaleAuto, false);
assert.strictEqual(tb.properties.scaleText, '1:500');
// Campos personalizados: um par de campos mais "remover" por linha
tb.properties.customFields = [{ label: 'A', value: '1' }, { label: 'B', value: '2' }];
const tbIds = PrintItemFields.build(tb, composer).map(e => e.prop.id);
['tb_cf_label:0', 'tb_cf_val:1', 'tb_cf_del:1', 'tb_add_custom'].forEach(id => assert.ok(tbIds.includes(id), id));
find(tb, 'tb_cf_val:1').apply(tb, 'novo');
assert.strictEqual(tb.properties.customFields[1].value, 'novo');

// Temporário: a camada escolhida é só do painel e sobrevive ao redesenho
composer.panelTransient = { temp_layer: 'l2' };
assert.strictEqual(find(map, 'temp_layer').prop.valor, 'l2');
assert.strictEqual(find(map, 'temp_layer').transient, true);
composer.panelTransient = { temp_layer: 'removida' };
assert.strictEqual(find(map, 'temp_layer').prop.valor, 'l1', 'Camada que sumiu volta à primeira');

// Bloqueado: só leitura e sem ações
const locked = { ...items.find(i => i.type === 'title_block'), locked: true };
const lockedEntries = PrintItemFields.build(locked, composer);
assert.ok(lockedEntries.every(e => e.prop.somenteLeitura && e.prop.tipo !== 'acao'));
console.log('✔ Regras validadas');

console.log('\n🎉 TESTES DOS CAMPOS POR TIPO PASSARAM!');
