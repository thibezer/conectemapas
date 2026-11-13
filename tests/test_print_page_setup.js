/* ==========================================================================
   ConecteMapas - Teste da configuração da folha do Layout de Impressão
   Cobre:
   1. Margens: ABNT por padrão, personalizadas validadas e folha volta ao padrão.
   2. Alinhamento, guias, layout padrão e reajuste usam as margens da folha.
   3. Pré-definições por projeto: salvar, substituir pelo nome, reconhecer e excluir.
   4. Painel: margens, selo ABNT e pré-definições sem texto institucional.
   ========================================================================== */

import assert from 'assert';
import { PrintItemsManager } from '../src/components/PrintComposer/PrintItemsManager.js';
import { PrintAlignmentHelper } from '../src/components/PrintComposer/PrintAlignmentHelper.js';
import { PrintSmartGuides } from '../src/components/PrintComposer/PrintSmartGuides.js';
import { PrintSheetsManager } from '../src/components/PrintComposer/PrintSheetsManager.js';
import { PrintPropertiesPanel } from '../src/components/PrintComposer/PrintPropertiesPanel.js';

console.log('--- Teste da configuração da folha ---');

const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; }
};

const paperSizes = {
  A4_L: { id: 'A4_L', name: 'A4 Paisagem', width: 297, height: 210, marginL: 25, marginO: 7 },
  A3_L: { id: 'A3_L', name: 'A3 Paisagem', width: 420, height: 297, marginL: 25, marginO: 10 }
};
const A4 = paperSizes.A4_L;

// ============================================================================
// 1. Margens
// ============================================================================
console.log('1. Margens...');
assert.deepStrictEqual(PrintItemsManager.sheetMargins(A4), { top: 7, right: 7, bottom: 7, left: 25 }, 'Sem personalização vale a ABNT');
assert.ok(PrintItemsManager.isAbntMargins(A4));

const custom = PrintItemsManager.withMargins(A4, { top: 10, right: 10, bottom: 12, left: 30 });
assert.deepStrictEqual(custom.margins, { top: 10, right: 10, bottom: 12, left: 30 });
assert.ok(!PrintItemsManager.isAbntMargins(custom));
assert.ok(!('margins' in A4), 'A folha do dicionário não é alterada');

const backToAbnt = PrintItemsManager.withMargins(custom, { top: 7, right: 7, bottom: 7, left: 25 });
assert.ok(!('margins' in backToAbnt), 'Margens iguais às ABNT voltam ao padrão');
assert.ok(!('margins' in PrintItemsManager.withMargins(custom, null)), 'null volta à ABNT');

const clean = PrintItemsManager.sanitizeMargins({ top: -5, right: 'x', bottom: 3.26 }, A4);
assert.strictEqual(clean.top, 0, 'Margem negativa vira 0');
assert.strictEqual(clean.right, 7, 'Valor inválido mantém o lado ABNT');
assert.strictEqual(clean.bottom, 3.5, 'Arredonda a 0,5 mm');
const clamped = PrintItemsManager.sanitizeMargins({ left: 400 }, A4);
assert.ok(clamped.left + clamped.right <= A4.width - 2 * PrintItemsManager.MIN_ITEM_MM, 'Sempre sobra área útil');
console.log('✔ Margens validadas');

// ============================================================================
// 2. Quem usa as margens
// ============================================================================
console.log('2. Alinhamento, guias, layout padrão e reajuste...');
const item = { id: 'a', x: 100, y: 100, width: 40, height: 20 };
const composer = {
  paperSize: custom,
  showAbntMargins: true,
  items: [item],
  selectedItemId: 'a',
  updateItemPositionDOM: () => {},
  updatePropertiesPanel: () => {},
  pushHistoryState: () => {}
};
PrintAlignmentHelper.alignLeft(composer);
assert.strictEqual(item.x, 30);
PrintAlignmentHelper.alignRight(composer);
assert.strictEqual(item.x, 297 - 10 - 40);
PrintAlignmentHelper.alignTop(composer);
assert.strictEqual(item.y, 10);
PrintAlignmentHelper.alignBottom(composer);
assert.strictEqual(item.y, 210 - 12 - 20);

const guides = new PrintSmartGuides({ mmToPx: 3.78 });
const snap = guides.calculateDragSnap({ id: 'm', width: 50, height: 30 }, 31.2, 60, [], custom, true);
assert.strictEqual(snap.snappedX, 30, 'Guia na margem esquerda personalizada');

const defaults = PrintItemsManager.createDefaultItems('P', custom);
const mainMap = defaults.find(i => i.id === 'item-map-main');
assert.strictEqual(mainMap.x, 30);
assert.strictEqual(mainMap.y, 10);
assert.strictEqual(mainMap.height, 210 - 10 - 12, 'Layout padrão ocupa a área útil personalizada');
defaults.forEach(i => {
  assert.ok(i.x + i.width <= 297 - 10 + 0.01, `${i.id} fica dentro da margem direita`);
  assert.ok(i.y + i.height <= 210 - 12 + 0.01, `${i.id} fica dentro da margem inferior`);
});

const abntItems = PrintItemsManager.createDefaultItems('P', A4);
const refit = PrintItemsManager.fitItemsToPaper(abntItems, A4, custom);
const refitMap = refit.find(i => i.id === 'item-map-main');
assert.strictEqual(refitMap.x, 30, 'Reajuste leva o mapa para a nova margem');
assert.strictEqual(refitMap.y, 10);
console.log('✔ Margens aplicadas em todos os pontos');

// ============================================================================
// 3. Pré-definições por projeto
// ============================================================================
console.log('3. Pré-definições...');
const mgr = new PrintSheetsManager({ paperSizes });
mgr.projectId = 'proj-a';
assert.deepStrictEqual(mgr.loadPresets(), []);

const p1 = mgr.addPreset('  Encadernação larga ', custom, true);
assert.strictEqual(p1.name, 'Encadernação larga');
assert.deepStrictEqual(p1.margins, custom.margins);
const p2 = mgr.addPreset('A3 ABNT', paperSizes.A3_L, false);
assert.strictEqual(p2.margins, null, 'Margens ABNT ficam como null (acompanham o papel)');
assert.strictEqual(mgr.loadPresets().length, 2);

assert.strictEqual(mgr.findMatchingPreset(custom, true)?.id, p1.id, 'Reconhece a pré-definição da folha atual');
assert.strictEqual(mgr.findMatchingPreset(custom, false), null, 'Moldura diferente não corresponde');
assert.strictEqual(mgr.findMatchingPreset(paperSizes.A3_L, false)?.id, p2.id);

const p1b = mgr.addPreset('encadernação LARGA', A4, true);
assert.strictEqual(mgr.loadPresets().length, 2, 'Mesmo nome substitui');
assert.ok(mgr.loadPresets().some(p => p.id === p1b.id));
assert.strictEqual(mgr.addPreset('   ', A4, true), null, 'Nome vazio não grava');

const other = new PrintSheetsManager({ paperSizes });
other.projectId = 'proj-b';
assert.deepStrictEqual(other.loadPresets(), [], 'Cada projeto tem as suas');

assert.ok(mgr.deletePreset(p2.id));
assert.strictEqual(mgr.loadPresets().length, 1);
assert.strictEqual(mgr.deletePreset('nao-existe'), false);
console.log('✔ Pré-definições validadas');

// ============================================================================
// 4. Painel da folha (<ui-painel-propriedades>), formatos custom e guias InDesign
// ============================================================================
console.log('4. Painel da folha (<ui-painel-propriedades>), custom e guias...');

// Formatos padrão e personalizados
const customPaper = PrintItemsManager.customPaper(700.3, 450, A4);
assert.strictEqual(customPaper.id, 'CUSTOM');
assert.strictEqual(customPaper.width, 700.5);
assert.strictEqual(customPaper.height, 450);
assert.strictEqual(PrintItemsManager.customPaper(10, 99999, A4).width, 50, 'Largura mínima é 50mm');
assert.strictEqual(PrintItemsManager.customPaper(10, 99999, A4).height, 5000, 'Altura máxima é 5000mm');

// Guias estilo InDesign: 3 colunas com calha de 5mm dentro das margens do A4 (x útil = 25..290, span=265)
const gridGuides = PrintItemsManager.computeGridGuides(A4, {
  cols: 3, colGutter: 5, rows: 2, rowGutter: 10, fitTo: 'margins', mode: 'grid'
});
// spanX = 265, calhas = 2*5 = 10 -> célula = 85 -> div1 = 25+85=110, 115; div2 = 200, 205
assert.deepStrictEqual(gridGuides.x, [110, 115, 200, 205], 'Colunas estilo InDesign com espaçamento (calha)');
// spanY = 210 - 7 - 7 = 196, calha = 10 -> célula = 93 -> div1 = 7+93=100, 110
assert.deepStrictEqual(gridGuides.y, [100, 110], 'Linhas estilo InDesign com espaçamento (calha)');

// 1 coluna com espaçamento centralizado na página inteira
const pageSplit = PrintItemsManager.computeGridGuides(A4, {
  cols: 1, colGutter: 10, rows: 0, fitTo: 'page', mode: 'grid'
});
assert.deepStrictEqual(pageSplit.x, [143.5, 153.5], 'Divisão única centralizada com calha');
assert.deepStrictEqual(pageSplit.y, []);

// Modo passo fixo
const stepGuides = PrintItemsManager.computeGridGuides(A4, {
  cols: 2, colGutter: 50, rows: 1, rowGutter: 30, fitTo: 'page', mode: 'step'
});
assert.deepStrictEqual(stepGuides.x, [50, 100]);
assert.deepStrictEqual(stepGuides.y, [30]);

const fullPaperSizes = {
  ...paperSizes,
  A4_P: { id: 'A4_P', name: 'A4 Retrato', width: 210, height: 297, marginL: 25, marginO: 7 },
  A3_P: { id: 'A3_P', name: 'A3 Retrato', width: 297, height: 420, marginL: 25, marginO: 10 },
  A2_L: { id: 'A2_L', name: 'A2 Paisagem', width: 594, height: 420, marginL: 25, marginO: 10 },
  A2_P: { id: 'A2_P', name: 'A2 Retrato', width: 420, height: 594, marginL: 25, marginO: 10 },
  A1_L: { id: 'A1_L', name: 'A1 Paisagem', width: 841, height: 594, marginL: 25, marginO: 10 },
  A1_P: { id: 'A1_P', name: 'A1 Retrato', width: 594, height: 841, marginL: 25, marginO: 10 },
  A0_L: { id: 'A0_L', name: 'A0 Paisagem', width: 1189, height: 841, marginL: 25, marginO: 10 },
  A0_P: { id: 'A0_P', name: 'A0 Retrato', width: 841, height: 1189, marginL: 25, marginO: 10 }
};

const panelComposer = {
  items: [], selectedItemId: null, features: [], paperSizes: fullPaperSizes,
  paperSize: A4, showAbntMargins: true, sheetsManager: mgr,
  manualGuides: gridGuides,
  guideGeneratorConfig: { rows: 2, rowGutter: 10, cols: 3, colGutter: 5, fitTo: 'margins', mode: 'grid', replace: true }
};

const html = PrintPropertiesPanel.render(panelComposer);
assert.ok(html.includes('<ui-painel-propriedades'), 'Aba da folha renderiza o componente <ui-painel-propriedades> do kit');
assert.ok(html.includes('id="print-paper-props-panel"'), 'Id esperado no componente de propriedades da folha');
assert.ok(html.includes('data-paper-id="A4_L"'));
assert.ok(html.includes('data-margins-abnt="true"'));

const propById = (cats, id) => {
  for (const c of cats) {
    const p = c.propriedades.find(x => x.id === id);
    if (p) return p;
  }
  return null;
};

let cats = PrintPropertiesPanel.buildPaperCategories(panelComposer);
assert.deepStrictEqual(cats.map(c => c.id), ['formato', 'margens', 'guias', 'presets']);
const formatOpts = propById(cats, 'paper_size').opcoes.map(o => o.id);
assert.ok(['A4_L', 'A4_P', 'A3_L', 'A3_P', 'A2_L', 'A2_P', 'A1_L', 'A1_P', 'A0_L', 'A0_P', 'CUSTOM'].every(k => formatOpts.includes(k)), 'Contém todos os formatos padrão e Personalizado');
assert.strictEqual(propById(cats, 'margin_standard').valor, 'ABNT');
assert.strictEqual(propById(cats, 'reset_margins_abnt'), null, 'Sem botão de voltar à ABNT quando já está em ABNT');
assert.strictEqual(propById(cats, 'preset_select').valor, p1b.id);
assert.ok(propById(cats, 'preset_delete'), 'Mostra botão de excluir quando corresponde a uma pré-definição');
assert.strictEqual(propById(cats, 'guides_clear').rotuloAcao, 'Limpar guias (6)', 'Contador de guias no botão');

panelComposer.paperSize = custom;
cats = PrintPropertiesPanel.buildPaperCategories(panelComposer);
assert.strictEqual(propById(cats, 'margin_standard').valor, 'Personalizada');
assert.strictEqual(propById(cats, 'margin_left').valor, 30);
assert.ok(propById(cats, 'reset_margins_abnt'), 'Margem personalizada oferece voltar à ABNT');
assert.strictEqual(propById(cats, 'preset_delete'), null, 'Sem pré-definição correspondente, não exibe excluir');

// syncPaperSection atualiza a instância viva de <ui-painel-propriedades> sem recriá-la
const fakePanelEl = { dataset: {}, categorias: null, shadowRoot: null };
PrintPropertiesPanel.syncPaperSection(fakePanelEl, panelComposer);
assert.strictEqual(fakePanelEl.dataset.paperId, 'A4_L');
assert.strictEqual(fakePanelEl.dataset.marginsAbnt, 'false');
assert.ok(Array.isArray(fakePanelEl.categorias) && fakePanelEl.categorias.length === 4);
console.log('✔ Painel validado');

console.log('\n🎉 TESTES DA CONFIGURAÇÃO DA FOLHA PASSARAM!');
