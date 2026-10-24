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

// ============================================================================
// 6. Ordem de empilhamento ao inserir
// ============================================================================
console.log('6. insertionIndex...');
const stack = PrintItemsManager.createDefaultItems('Projeto', paperSizes.A4_L);
const lastMapIdx = stack.map(i => i.type).lastIndexOf('inset_map');
assert.strictEqual(PrintItemsManager.insertionIndex(stack, 'shape'), lastMapIdx + 1, 'Moldura entra logo acima dos mapas');
assert.strictEqual(PrintItemsManager.insertionIndex(stack, 'label'), stack.length, 'Demais elementos vão para a frente');
assert.strictEqual(PrintItemsManager.insertionIndex([], 'shape'), 0);
console.log('✔ insertionIndex validado');

// ============================================================================
// 7. Limites da folha e tamanho mínimo
// ============================================================================
console.log('7. clampItemToPaper...');
const A4 = paperSizes.A4_L;
const MIN = PrintItemsManager.MIN_ITEM_MM;
let c = PrintItemsManager.clampItemToPaper({ x: 280, y: 5, width: 50, height: 20 }, A4);
assert.deepStrictEqual([c.x, c.width], [247, 50], 'Item que passa da borda direita é trazido para dentro');
c = PrintItemsManager.clampItemToPaper({ x: -12, y: -3, width: 2, height: 1 }, A4);
assert.deepStrictEqual([c.x, c.y, c.width, c.height], [0, 0, MIN, MIN], 'Posição negativa e tamanho abaixo do mínimo');
c = PrintItemsManager.clampItemToPaper({ x: 10, y: 10, width: 999, height: 999 }, A4);
assert.deepStrictEqual([c.x, c.y, c.width, c.height], [0, 0, 297, 210], 'Maior que a folha vira a folha inteira');
c = PrintItemsManager.clampItemToPaper({ x: NaN, y: 20, width: 40, height: NaN }, A4);
assert.deepStrictEqual([c.x, c.height], [0, MIN], 'Valores inválidos não viram NaN');
console.log('✔ clampItemToPaper validado');

// ============================================================================
// 8. Barra de escala: régua = distância rotulada
// ============================================================================
console.log('8. scaleBarModel...');
assert.strictEqual(PrintItemsManager.niceFloor(737), 500);
assert.strictEqual(PrintItemsManager.niceFloor(2.7), 2.5);
assert.strictEqual(PrintItemsManager.niceFloor(0.0042), 0.0025);
assert.strictEqual(PrintItemsManager.niceFloor(0), 0);

for (const [width, scale, segments] of [[60, 10000, 4], [43, 2848, 3], [100, 50000, 5], [25, 1234567, 2], [80, 500, 8]]) {
  const m = PrintItemsManager.scaleBarModel({ width, segments }, scale);
  const barMm = m.ratio * width;
  assert.ok(Math.abs(barMm / 1000 * scale - m.totalMeters) < 1e-6, `Régua deve medir exatamente ${m.totalMeters} m no terreno (${width} mm, 1:${scale})`);
  assert.ok(m.ratio <= 0.9 + 1e-9 && m.ratio > 0.35, `Régua ocupa uma fração razoável do item (${m.ratio})`);
  const seg = m.totalMeters / m.segments;
  assert.strictEqual(PrintItemsManager.niceFloor(seg), seg, 'Cada divisão é um valor redondo');
}

const sb = PrintItemsManager.scaleBarModel({ width: 60 }, 10000);
assert.strictEqual(sb.segments, 4, 'Padrão: 4 divisões');
assert.strictEqual(sb.totalMeters, 400, '60 mm × 90% a 1:10.000 = 540 m → 4 × 100 m = 400 m');
assert.deepStrictEqual(sb.labels.map(l => l.text), ['0', '100', '200', '300', '400 m']);
assert.strictEqual(sb.units, 'm');
assert.strictEqual(sb.scaleText, 'Escala 1:10.000');

const sbKm = PrintItemsManager.scaleBarModel({ width: 60, units: 'km' }, 10000);
assert.strictEqual(sbKm.labels.at(-1).text, '0,4 km', 'Unidade forçada em km');
assert.strictEqual(PrintItemsManager.scaleBarModel({ width: 60 }, 100000).units, 'km', 'Automática vira km acima de 1 km');
assert.strictEqual(PrintItemsManager.scaleBarModel({ width: 60, segments: 99 }, 10000).segments, 8, 'Máximo de 8 divisões');
assert.strictEqual(PrintItemsManager.scaleBarModel({ width: 60, segments: 6 }, 10000).labels.length, 2, 'Muitas divisões: só 0 e o total');

const sbHtml = PrintItemsManager.renderScaleBar({ width: 60, segments: 3, showScaleText: false }, 10000);
assert.strictEqual((sbHtml.match(/cm-scale-bar-seg/g) || []).length, 3, 'HTML com o número de divisões escolhido');
assert.ok(!sbHtml.includes('Escala 1:'), 'Escala numérica pode ser ocultada');
console.log('✔ Barra de escala validada');

// ============================================================================
// 9. Legenda: título e camadas
// ============================================================================
console.log('9. Legenda...');
const layers = [
  { id: 1, name: 'Lotes', color: '#f00' },
  { id: 'app', name: 'APP', color: '#0f0' },
  { id: 'oculta', name: 'Oculta', color: '#00f', visible: false }
];
assert.deepStrictEqual(PrintItemsManager.legendLayers({}, layers).map(l => l.name), ['Lotes', 'APP'], 'Camadas ocultas no projeto não entram');
assert.deepStrictEqual(PrintItemsManager.legendLayers({ hiddenLayerIds: ['1'] }, layers).map(l => l.name), ['APP'], 'Id numérico ocultado pelo painel (string)');
let legHtml = PrintItemsManager.renderLegend({ title: 'CONVENÇÕES <b>' }, layers);
assert.ok(legHtml.includes('CONVENÇÕES &lt;b&gt;'), 'Título personalizado e escapado');
legHtml = PrintItemsManager.renderLegend({ title: '' }, layers);
assert.ok(!legHtml.includes('cm-legend-title'), 'Título vazio remove o cabeçalho');
assert.ok(PrintItemsManager.renderLegend({}, layers).includes(PrintItemsManager.DEFAULT_LEGEND_TITLE), 'Sem título definido usa o padrão');
console.log('✔ Legenda validada');

// ============================================================================
// 10. Imagem reduzida e falha de gravação avisada
// ============================================================================
console.log('10. PrintImageUtils e falha de gravação...');
const { PrintImageUtils } = await import('../src/components/PrintComposer/PrintImageUtils.js');
assert.deepStrictEqual(PrintImageUtils.fitWithin(4000, 2000, 1200), { width: 1200, height: 600 }, 'Reduz pelo maior lado');
assert.deepStrictEqual(PrintImageUtils.fitWithin(300, 900, 1200), { width: 300, height: 900 }, 'Nunca amplia');
assert.deepStrictEqual(PrintImageUtils.fitWithin(0, 10), { width: 0, height: 0 });

const { UIToast } = await import('@thibezer/ui-components-kit');
const toasts = [];
const originalNotify = UIToast.notificar;
UIToast.notificar = (o) => toasts.push(o);
const failMgr = new PrintSheetsManager(sheetComposer);
failMgr.init('proj-cota', 'Projeto', paperSizes);
const originalSet = globalThis.localStorage.setItem;
globalThis.localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
assert.strictEqual(failMgr.saveToStorage(), false, 'Falha de cota é reportada');
failMgr.saveToStorage();
assert.strictEqual(toasts.filter(t => t.titulo === 'Prancha não salva').length, 1, 'Avisa uma única vez por sequência de falhas');
globalThis.localStorage.setItem = originalSet;
assert.strictEqual(failMgr.saveToStorage(), true);
assert.strictEqual(failMgr.saveFailed, false, 'Gravação bem-sucedida rearma o aviso');
UIToast.notificar = originalNotify;
console.log('✔ Imagem e falha de gravação validadas');

// ============================================================================
// 11. Painel: controles da barra de escala e da legenda
// ============================================================================
console.log('11. Painel da barra de escala e legenda...');
const pItems = PrintItemsManager.createDefaultItems('Projeto', paperSizes.A4_L);
const pComposer = { items: pItems, features: [], layers, paperSize: paperSizes.A4_L, showAbntMargins: true };
pComposer.selectedItemId = pItems.find(i => i.type === 'scale_bar').id;
html = PrintPropertiesPanel.render(pComposer);
['prop-sb-segments', 'prop-sb-units', 'prop-sb-text'].forEach(id => assert.ok(html.includes(`id="${id}"`), `Painel da barra deve ter ${id}`));
assert.ok(html.includes(`min="${PrintItemsManager.MIN_ITEM_MM}"`), 'Campos de tamanho usam o mínimo comum');
pComposer.selectedItemId = pItems.find(i => i.type === 'legend').id;
html = PrintPropertiesPanel.render(pComposer);
assert.ok(html.includes('id="prop-legend-title"'), 'Painel da legenda tem o título');
assert.strictEqual((html.match(/data-legend-layer=/g) || []).length, 2, 'Uma caixa por camada visível');
console.log('✔ Painel validado');

console.log('\n🎉 TESTES DO PAINEL LATERAL E HISTÓRICO PASSARAM!');
