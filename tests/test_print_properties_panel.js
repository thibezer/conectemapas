/* ==========================================================================
   ConecteMapas - Teste do painel lateral e do histórico do Layout de Impressão
   Cobre:
   1. PrintHistory: estado registrado DEPOIS da ação, desfazer/refazer simétricos,
      agrupamento de digitação, limite e descarte do ramo de refazer.
   2. PrintAlignmentHelper: registra o histórico após mover o item (refazer reaplica).
   3. PrintItemsManager.fitItemsToPaper: trocar a folha preserva os itens do usuário.
   4. PrintSheetsManager: trocar de prancha recomeça o histórico.
   5. PrintPropertiesPanel: item bloqueado não é editável nem excluível pelo painel.
   ========================================================================== */

import assert from 'assert';
import { PrintHistory } from '../src/components/PrintComposer/PrintHistory.js';
import { PrintAlignmentHelper } from '../src/components/PrintComposer/PrintAlignmentHelper.js';
import { PrintItemsManager } from '../src/components/PrintComposer/PrintItemsManager.js';
import { PrintSheetsManager } from '../src/components/PrintComposer/PrintSheetsManager.js';
import { PrintPropertiesPanel } from '../src/components/PrintComposer/PrintPropertiesPanel.js';

console.log('--- Teste do painel lateral e histórico do Layout de Impressão ---');

const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; }
};

const paperSizes = {
  A4_L: { id: 'A4_L', name: 'A4 Paisagem', width: 297, height: 210, marginL: 25, marginO: 7 },
  A4_P: { id: 'A4_P', name: 'A4 Retrato', width: 210, height: 297, marginL: 25, marginO: 7 },
  A3_L: { id: 'A3_L', name: 'A3 Paisagem', width: 420, height: 297, marginL: 25, marginO: 10 }
};

// ============================================================================
// 1. PrintHistory
// ============================================================================
console.log('1. PrintHistory...');
const st = (x, action = 'Mover') => ({ items: [{ id: 'a', x }], action });

const h = new PrintHistory();
h.reset(st(0, 'Abertura'));
assert.strictEqual(h.canUndo(), false, 'Recém-aberto não tem o que desfazer');

h.push(st(10, 'Alinhar'), { now: 1000 });
h.push(st(20, 'Arrastar'), { now: 5000 });

let step = h.undo();
assert.strictEqual(step.state.items[0].x, 10, 'Desfazer volta ao estado anterior à última ação');
assert.strictEqual(step.action, 'Arrastar', 'O aviso nomeia a ação desfeita, não a restaurada');
step = h.undo();
assert.strictEqual(step.state.items[0].x, 0);
assert.strictEqual(h.undo(), null, 'Não desfaz além da abertura');

step = h.redo();
assert.strictEqual(step.state.items[0].x, 10, 'Refazer reaplica a ação (antes devolvia o estado de antes)');
assert.strictEqual(step.action, 'Alinhar');
step = h.redo();
assert.strictEqual(step.state.items[0].x, 20);
assert.strictEqual(h.redo(), null);

// Uma nova ação depois de desfazer descarta o ramo de refazer
h.undo();
h.push(st(99, 'Nova'), { now: 9000 });
assert.strictEqual(h.canRedo(), false, 'Nova ação descarta o refazer');
assert.strictEqual(h.entries.length, 3);

// Digitação no mesmo campo vira um passo; outro campo ou pausa longa vira outro
const t = new PrintHistory();
t.reset(st(0, 'Abertura'));
t.push(st(1, 'Editar'), { coalesceKey: 'prop:a:titulo', now: 0 });
t.push(st(2, 'Editar'), { coalesceKey: 'prop:a:titulo', now: 300 });
t.push(st(3, 'Editar'), { coalesceKey: 'prop:a:titulo', now: 600 });
assert.strictEqual(t.entries.length, 2, 'Rajada no mesmo campo deve virar um único passo');
assert.strictEqual(t.entries[1].items[0].x, 3, 'O passo agrupado guarda o último valor');
t.push(st(4, 'Editar'), { coalesceKey: 'prop:a:cliente', now: 700 });
assert.strictEqual(t.entries.length, 3, 'Outro campo é outro passo');
t.push(st(5, 'Editar'), { coalesceKey: 'prop:a:cliente', now: 700 + PrintHistory.COALESCE_MS + 1 });
assert.strictEqual(t.entries.length, 4, 'Depois de uma pausa, a digitação vira outro passo');
assert.strictEqual(t.undo().state.items[0].x, 4);

// A abertura nunca é absorvida por um agrupamento
const o = new PrintHistory();
o.reset({ ...st(0, 'Abertura'), coalesceKey: 'x' });
o.push(st(1), { coalesceKey: 'x', now: 0 });
assert.strictEqual(o.entries.length, 2, 'A entrada de abertura deve ser preservada');

// Limite de passos
const l = new PrintHistory();
l.reset(st(0, 'Abertura'));
for (let i = 1; i <= PrintHistory.LIMIT + 10; i++) l.push(st(i), { now: i * 10000 });
assert.strictEqual(l.entries.length, PrintHistory.LIMIT, 'Histórico limitado');
assert.strictEqual(l.index, PrintHistory.LIMIT - 1);
console.log('✔ PrintHistory validado');

// ============================================================================
// 2. Alinhamento registra o estado depois de mover
// ============================================================================
console.log('2. PrintAlignmentHelper + histórico...');
const boxA = { id: 'box-a', name: 'A', x: 100, y: 60, width: 40, height: 30 };
const alignComposer = {
  paperSize: paperSizes.A4_L,
  showAbntMargins: true,
  items: [boxA],
  selectedItemId: 'box-a',
  history: new PrintHistory(),
  pushHistoryState(action) { this.history.push({ items: JSON.parse(JSON.stringify(this.items)), action }, { now: Date.now() }); },
  updateItemPositionDOM: () => {},
  updatePropertiesPanel: () => {},
  renderAllItems: () => {},
  selectItem(id) { this.selectedItemId = id; }
};
alignComposer.history.reset({ items: JSON.parse(JSON.stringify(alignComposer.items)), action: 'Abertura' });

PrintAlignmentHelper.alignLeft(alignComposer);
assert.strictEqual(alignComposer.history.entries.at(-1).items[0].x, 25, 'O histórico deve guardar a posição já alinhada');
assert.strictEqual(alignComposer.history.undo().state.items[0].x, 100, 'Desfazer volta à posição original');
assert.strictEqual(alignComposer.history.redo().state.items[0].x, 25, 'Refazer reaplica o alinhamento');

boxA.locked = true;
const before = alignComposer.history.entries.length;
PrintAlignmentHelper.alignRight(alignComposer);
assert.strictEqual(alignComposer.history.entries.length, before, 'Item bloqueado não gera passo nem se move');
console.log('✔ Alinhamento validado');

// ============================================================================
// 3. Trocar a folha preserva os itens do usuário
// ============================================================================
console.log('3. fitItemsToPaper...');
const userItems = PrintItemsManager.createDefaultItems('Projeto', paperSizes.A4_L);
const label = PrintItemsManager.createNewItem('label', 'Projeto', userItems.length);
label.text = 'MEU TÍTULO';
userItems.push(label);
userItems[0].view = { center: [-23.5, -46.6], zoom: 16 };

const inside = (items, paper) => items.every(i =>
  i.x >= 0 && i.y >= 0 && i.x + i.width <= paper.width + 1e-9 && i.y + i.height <= paper.height + 1e-9);

const onA3 = PrintItemsManager.fitItemsToPaper(userItems, paperSizes.A4_L, paperSizes.A3_L);
assert.deepStrictEqual(onA3.map(i => i.id), userItems.map(i => i.id), 'Mesmos itens, na mesma ordem');
assert.strictEqual(onA3.find(i => i.type === 'label').text, 'MEU TÍTULO', 'Conteúdo editado é preservado');
assert.deepStrictEqual(onA3[0].view, userItems[0].view, 'Enquadramento do mapa é preservado');
assert.ok(inside(onA3, paperSizes.A3_L), 'Todos os itens dentro da A3');
assert.ok(onA3[0].width > userItems[0].width, 'O mapa cresce na folha maior');
assert.notStrictEqual(onA3[0], userItems[0], 'Retorna cópias (não altera os itens originais)');
assert.strictEqual(userItems[0].x, PrintItemsManager.createDefaultItems('Projeto', paperSizes.A4_L)[0].x, 'Originais intactos');

const mainMap = userItems[0];
const mapOnA3 = onA3[0];
assert.ok(Math.abs(mapOnA3.x - paperSizes.A3_L.marginL) < 0.11, 'Item na margem ABNT continua na margem ABNT');
assert.ok(Math.abs(mainMap.x - paperSizes.A4_L.marginL) < 0.11);

const onPortrait = PrintItemsManager.fitItemsToPaper(userItems, paperSizes.A4_L, paperSizes.A4_P);
assert.ok(inside(onPortrait, paperSizes.A4_P), 'Todos os itens dentro da A4 retrato');
const arrowSrc = userItems.find(i => i.type === 'north_arrow');
const arrowDst = onPortrait.find(i => i.type === 'north_arrow');
assert.ok(Math.abs(arrowDst.width / arrowDst.height - arrowSrc.width / arrowSrc.height) < 0.05, 'Seta norte mantém a proporção');
console.log('✔ fitItemsToPaper validado');

// ============================================================================
// 4. Trocar de prancha recomeça o histórico
// ============================================================================
console.log('4. PrintSheetsManager + histórico...');
let resets = 0;
const sheetComposer = {
  projectName: 'Projeto',
  paperSizes,
  paperSize: paperSizes.A4_L,
  showAbntMargins: true,
  items: [],
  selectedItemId: null,
  updatePaperSheetDOM: () => {},
  renderAllItems: () => {},
  updatePropertiesPanel: () => {},
  canvasEngine: { zoomFit: () => {}, renderRulers: () => {} },
  updateInsetMapExtent: () => {},
  resetHistory: () => { resets++; }
};
const mgr = new PrintSheetsManager(sheetComposer);
sheetComposer.sheetsManager = mgr;
mgr.init('proj-hist', 'Projeto', paperSizes);
mgr.createSheet('Prancha 02', 'A3_L', 'abnt');
const afterCreate = resets;
assert.ok(afterCreate >= 1, 'Criar/ativar outra prancha recomeça o histórico');
mgr.switchToSheet(mgr.sheets[0].id);
assert.strictEqual(resets, afterCreate + 1, 'Alternar prancha recomeça o histórico');
mgr.deleteSheet(mgr.activeSheetId);
assert.strictEqual(resets, afterCreate + 2, 'Excluir a prancha ativa recomeça o histórico');
mgr.cancelScheduledSave();
console.log('✔ Histórico por prancha validado');

// ============================================================================
// 5. Painel: item bloqueado
// ============================================================================
console.log('5. PrintPropertiesPanel com item bloqueado...');
const panelItems = PrintItemsManager.createDefaultItems('Projeto', paperSizes.A4_L);
const locked = panelItems.find(i => i.type === 'legend');
locked.locked = true;
const panelComposer = { items: panelItems, selectedItemId: locked.id, features: [], paperSize: paperSizes.A4_L, showAbntMargins: true };

let html = PrintPropertiesPanel.render(panelComposer);
assert.ok(/<fieldset class="cm-print-props-fields"\s+disabled/.test(html), 'Campos do item bloqueado ficam desabilitados');
assert.ok(html.includes('Item bloqueado'), 'Painel avisa que o item está bloqueado');
assert.ok(new RegExp(`data-composer-del="${locked.id}"[^>]*disabled`).test(html), 'Lixeira do item bloqueado fica desabilitada');
const unlocked = panelItems.find(i => i.type === 'north_arrow');
assert.ok(!new RegExp(`data-composer-del="${unlocked.id}"[^>]*disabled`).test(html), 'Lixeira de item livre continua ativa');

panelComposer.selectedItemId = unlocked.id;
html = PrintPropertiesPanel.render(panelComposer);
assert.ok(!/<fieldset class="cm-print-props-fields"\s+disabled/.test(html), 'Item livre continua editável');
assert.ok(html.includes('Restaurar Layout Padrão ABNT'), 'O botão de reset diz o que faz');
console.log('✔ Painel validado');

console.log('\n🎉 TESTES DO PAINEL LATERAL E HISTÓRICO PASSARAM!');
