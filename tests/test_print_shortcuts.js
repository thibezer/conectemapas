/* ==========================================================================
   ConecteMapas - Teste dos atalhos configuráveis do Layout de Impressão
   Cobre: leitura da tecla, padrões sem conflito, personalização (troca, remoção,
   reservadas, persistência), espessura da linha com [ e ], execução das ações e
   a janela de atalhos.
   ========================================================================== */

import assert from 'assert';

// localStorage mínimo para o Node
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k)
};

const { PrintShortcuts, SHORTCUT_ACTIONS, SHORTCUT_GROUPS, RESERVED_COMBOS } = await import('../src/components/PrintComposer/PrintShortcuts.js');
const { PrintShortcutActions } = await import('../src/components/PrintComposer/PrintShortcutActions.js');
const { PrintShortcutsDialog } = await import('../src/components/PrintComposer/PrintShortcutsDialog.js');
const { PRINT_INSERT_GROUPS } = await import('../src/components/PrintComposer/PrintToolbar.js');

console.log('--- Teste dos atalhos do Layout de Impressão ---');

const ev = (code, key, mods = {}) => ({ code, key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, repeat: false, preventDefault() { this.prevented = true; }, ...mods });

// 1. Padrões: ids únicos, grupos válidos, nenhuma combinação repetida nem reservada
const ids = SHORTCUT_ACTIONS.map(a => a.id);
assert.strictEqual(new Set(ids).size, ids.length, 'ids repetidos');
const groupIds = new Set(SHORTCUT_GROUPS.map(g => g.id));
SHORTCUT_ACTIONS.forEach(a => assert.ok(groupIds.has(a.group), `grupo inválido em ${a.id}`));
const seen = new Map();
SHORTCUT_ACTIONS.forEach(a => a.keys.forEach(k => {
  assert.ok(!RESERVED_COMBOS.has(k), `${a.id} usa a reservada ${k}`);
  assert.ok(!seen.has(k), `${k} repetida em ${seen.get(k)} e ${a.id}`);
  seen.set(k, a.id);
}));
// todo elemento do menu Inserir tem atalho
PRINT_INSERT_GROUPS.flatMap(g => g.items).forEach(it => assert.ok(PrintShortcuts.getAction(`insert:${it.type}`), `sem atalho de inserir ${it.type}`));

// 2. Leitura da tecla pelo código físico (independe de Shift/layout)
assert.strictEqual(PrintShortcuts.comboFromEvent(ev('KeyM', 'M', { shiftKey: true })), 'Shift+M');
assert.strictEqual(PrintShortcuts.comboFromEvent(ev('BracketRight', '}', { ctrlKey: true, shiftKey: true })), 'Ctrl+Shift+]');
assert.strictEqual(PrintShortcuts.comboFromEvent(ev('ArrowLeft', 'ArrowLeft', { altKey: true, shiftKey: true })), 'Alt+Shift+Left');
assert.strictEqual(PrintShortcuts.comboFromEvent(ev('Digit0', '0')), '0');
assert.strictEqual(PrintShortcuts.comboFromEvent(ev('NumpadAdd', '+')), '=');
assert.strictEqual(PrintShortcuts.comboFromEvent(ev('ShiftLeft', 'Shift', { shiftKey: true })), '', 'só modificador não é atalho');
assert.strictEqual(PrintShortcuts.comboFromEvent(ev('KeyZ', 'z', { metaKey: true })), 'Ctrl+Z', 'Cmd vale como Ctrl');

// 3. [ e ] agora são espessura da linha (não mais o painel)
assert.strictEqual(PrintShortcuts.actionForEvent(ev('BracketLeft', '[')), 'strokeDown');
assert.strictEqual(PrintShortcuts.actionForEvent(ev('BracketRight', ']')), 'strokeUp');
assert.strictEqual(PrintShortcuts.actionForEvent(ev('KeyP', 'p')), 'propertiesPanel');
assert.strictEqual(PrintShortcuts.actionForEvent(ev('Equal', '+', { shiftKey: true })), 'zoomIn');
assert.strictEqual(PrintShortcuts.prettyCombo('Ctrl+Z'), 'Ctrl+Z');
assert.strictEqual(PrintShortcuts.hint('smartGuides'), ' (U)');

// 4. Personalização: troca, conflito, reservada, remoção, persistência, padrão
assert.deepStrictEqual(PrintShortcuts.setCombo('insert:map', 'Escape').ok, false, 'Esc é reservada');
assert.strictEqual(PrintShortcuts.setCombo('insert:map', 'Ctrl').ok, false, 'só modificador é recusado');
let changes = 0;
const off = PrintShortcuts.onChange(() => changes++);
const swap = PrintShortcuts.setCombo('insert:map', 'N'); // N era do Norte
assert.ok(swap.ok && swap.displaced === 'insert:north_arrow');
assert.deepStrictEqual(PrintShortcuts.keysFor('insert:map'), ['N']);
assert.deepStrictEqual(PrintShortcuts.keysFor('insert:north_arrow'), [], 'a ação desalojada fica sem atalho');
assert.strictEqual(PrintShortcuts.actionForEvent(ev('KeyN', 'n')), 'insert:map');
assert.strictEqual(PrintShortcuts.actionForEvent(ev('KeyM', 'm')), null, 'a tecla antiga ficou livre');
assert.ok(JSON.parse(store.get('cm_print_shortcuts'))['insert:map'], 'grava no localStorage');
assert.ok(PrintShortcuts.isCustomized('insert:map'));
assert.strictEqual(changes, 1);
PrintShortcuts.clearCombo('strokeUp');
assert.strictEqual(PrintShortcuts.actionForEvent(ev('BracketRight', ']')), null);
assert.strictEqual(PrintShortcuts.hint('strokeUp'), '');
PrintShortcuts.reset('strokeUp');
assert.deepStrictEqual(PrintShortcuts.keysFor('strokeUp'), [']']);
PrintShortcuts.reset();
assert.strictEqual(store.has('cm_print_shortcuts'), false, 'sem personalizações, nada fica gravado');
assert.deepStrictEqual(PrintShortcuts.keysFor('insert:map'), ['M']);
off();

// 5. Armazenamento corrompido ou com ids/teclas inválidos não derruba nem vale
store.set('cm_print_shortcuts', JSON.stringify({ 'insert:map': ['Escape', 'K'], 'acao:inexistente': ['Q'], undo: 'x' }));
PrintShortcuts._resetForTests();
store.set('cm_print_shortcuts', JSON.stringify({ 'insert:map': ['Escape', 'K'], 'acao:inexistente': ['Q'], undo: 'x' }));
assert.deepStrictEqual(PrintShortcuts.keysFor('insert:map'), ['K'], 'reservada é descartada');
assert.deepStrictEqual(PrintShortcuts.keysFor('undo'), ['Ctrl+Z'], 'valor inválido volta ao padrão');
store.set('cm_print_shortcuts', '{quebrado');
PrintShortcuts._resetForTests();
store.set('cm_print_shortcuts', '{quebrado');
assert.deepStrictEqual(PrintShortcuts.keysFor('insert:map'), ['M']);
PrintShortcuts._resetForTests();

// 6. Espessura da linha: [ e ] em passos de 0,5, limites por tipo, bloqueados e sem alvo
const pushes = [];
const mk = (extra) => ({ id: `i${Math.random()}`, locked: false, ...extra });
const shape = mk({ type: 'shape' }); // sem strokeWidth: padrão 1,5
const label = mk({ type: 'label', strokeWidth: 8 });
const image = mk({ type: 'image' });
const locked = mk({ type: 'shape', strokeWidth: 3, locked: true });
const map = mk({ type: 'map' });
let selection = [shape];
const composer = {
  readOnly: false,
  getSelectedItems: () => selection,
  refreshItemContent: () => {},
  updatePropertiesPanel: () => {},
  pushHistoryState: (name, opts) => pushes.push([name, opts?.coalesceKey])
};
assert.ok(PrintShortcutActions.run(composer, 'strokeUp'));
assert.strictEqual(shape.strokeWidth, 2);
PrintShortcutActions.run(composer, 'strokeDown');
PrintShortcutActions.run(composer, 'strokeDown');
assert.strictEqual(shape.strokeWidth, 1);
for (let i = 0; i < 40; i++) PrintShortcutActions.run(composer, 'strokeUp');
assert.strictEqual(shape.strokeWidth, 15, 'moldura limita em 15');
for (let i = 0; i < 40; i++) PrintShortcutActions.run(composer, 'strokeDown');
assert.strictEqual(shape.strokeWidth, 0, 'não passa de 0');
selection = [label, image, locked, map];
PrintShortcutActions.run(composer, 'strokeUp');
assert.strictEqual(label.strokeWidth, 8, 'título limita em 8');
assert.strictEqual(image.strokeWidth, 0.5, 'imagem sem borda começa em 0,5');
assert.strictEqual(locked.strokeWidth, 3, 'item travado não muda');
assert.strictEqual(map.strokeWidth, undefined, 'tipo sem traço é ignorado');
assert.ok(pushes.length > 0 && pushes.every(p => p[0] === 'Espessura da Linha' && p[1].startsWith('stroke:')), 'cada toque vira passo de histórico agrupado');
selection = [map];
assert.strictEqual(PrintShortcutActions.run(composer, 'strokeUp'), false, 'sem item com traço, a tecla não é consumida');

// 7. handleKeyEvent: só visualização, janela de visibilidade aberta, repetição
const calls = [];
const stub = { ...composer, readOnly: false, undo: () => calls.push('undo'), alignLeft: () => calls.push('alignLeft'), canvasEngine: { zoomFit: () => calls.push('zoomFit') } };
let e = ev('KeyZ', 'z', { ctrlKey: true });
assert.ok(PrintShortcutActions.handleKeyEvent(stub, e) && e.prevented);
assert.ok(PrintShortcutActions.handleKeyEvent(stub, ev('KeyZ', 'z', { ctrlKey: true }), { dialogOpen: true }), 'desfazer passa com a janela de visibilidade aberta');
assert.strictEqual(PrintShortcutActions.handleKeyEvent(stub, ev('ArrowLeft', 'ArrowLeft', { altKey: true, shiftKey: true }), { dialogOpen: true }), false);
assert.strictEqual(PrintShortcutActions.handleKeyEvent(stub, ev('ArrowLeft', 'ArrowLeft', { altKey: true, shiftKey: true }), { readOnly: true }), false, 'só visualizando não alinha');
assert.ok(PrintShortcutActions.handleKeyEvent(stub, ev('ArrowLeft', 'ArrowLeft', { altKey: true, shiftKey: true })));
assert.ok(PrintShortcutActions.handleKeyEvent(stub, ev('Digit0', '0'), { readOnly: true }), 'zoom vale só visualizando');
assert.strictEqual(PrintShortcutActions.handleKeyEvent(stub, ev('KeyQ', 'q')), false, 'tecla sem ação não é consumida');
assert.deepStrictEqual(calls, ['undo', 'undo', 'alignLeft', 'zoomFit']);

// 8. Janela de atalhos: lista tudo, destaca personalizados, filtra, escapa HTML
PrintShortcuts.setCombo('insert:legend', 'G');
let html = PrintShortcutsDialog.renderHTML();
SHORTCUT_ACTIONS.forEach(a => assert.ok(html.includes(`data-psc-id="${a.id}"`), `janela sem a ação ${a.id}`));
assert.ok(/data-psc-id="insert:legend"/.test(html) && html.includes('is-custom'), 'personalizado é destacado');
assert.ok(html.includes('data-psc-reset-all'));
assert.ok(PrintShortcutsDialog.renderHTML({ recordingId: 'undo' }).includes('is-recording'));
const filtered = PrintShortcutsDialog.renderHTML({ filter: 'espessura' });
assert.ok(filtered.includes('data-psc-id="strokeUp"') && !filtered.includes('data-psc-id="undo"'), 'filtro por nome');
assert.ok(PrintShortcutsDialog.renderHTML({ filter: 'zzzz' }).includes('Nenhum atalho'), 'filtro sem resultado');
assert.ok(PrintShortcutsDialog.renderHTML({ status: '<b>x</b>' }).includes('&lt;b&gt;'), 'status escapado');
assert.ok(PrintShortcuts.attrs('insert:map', 'Inserir mapa').includes('data-sc="insert:map"'));
PrintShortcuts._resetForTests();

console.log('OK: atalhos do Layout de Impressão');
