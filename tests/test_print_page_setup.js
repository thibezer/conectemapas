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
// 4. Painel
// ============================================================================
console.log('4. Painel da folha...');
const panelComposer = {
  items: [], selectedItemId: null, features: [], paperSizes,
  paperSize: A4, showAbntMargins: true, sheetsManager: mgr
};
let html = PrintPropertiesPanel.render(panelComposer);
assert.ok(html.includes('class="cm-pp-badge"'), 'Margens ABNT mostram o selo');
assert.ok(!html.includes('btn-margins-abnt'), 'Sem botão de voltar quando já é ABNT');
['top', 'right', 'bottom', 'left'].forEach(side => {
  assert.ok(new RegExp(`data-margin-side="${side}"[^>]*value="${PrintItemsManager.sheetMargins(A4)[side]}"`).test(html), `Campo da margem ${side}`);
});
assert.ok(new RegExp(`<option value="${p1b.id}" selected>`).test(html), 'Pré-definição correspondente vem selecionada');
assert.ok(new RegExp(`id="btn-preset-delete"[^>]*data-preset-id="${p1b.id}"`).test(html));
assert.ok(!html.includes('encadernação e borda interna'), 'Sem texto institucional longo');
assert.ok(html.includes('A4 Paisagem · 297×210'));

panelComposer.paperSize = custom;
html = PrintPropertiesPanel.render(panelComposer);
assert.ok(html.includes('id="btn-margins-abnt"'), 'Margem personalizada oferece voltar à ABNT');
assert.ok(/id="btn-preset-delete"[^>]*disabled/.test(html), 'Sem pré-definição correspondente, excluir fica desabilitado');
assert.ok(html.includes('value="30"'));
console.log('✔ Painel validado');

console.log('\n🎉 TESTES DA CONFIGURAÇÃO DA FOLHA PASSARAM!');
