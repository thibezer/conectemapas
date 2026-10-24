/* ==========================================================================
   ConecteMapas - Teste da barra do Layout de Impressão (PrintToolbar)
   Cobre: tipos do menu Inserir, roteamento das ações (inserir, zoom, DPI, pranchas)
   e a marcação dos menus (sem os controles removidos da barra).
   ========================================================================== */

import assert from 'assert';
import { PrintToolbar, PRINT_INSERT_GROUPS, PRINT_ICONS } from '../src/components/PrintComposer/PrintToolbar.js';
import { PrintItemsManager } from '../src/components/PrintComposer/PrintItemsManager.js';

console.log('--- Teste da barra do Layout de Impressão ---');

// 1. Todo elemento do menu Inserir vira um item válido e tem ícone
const allTypes = PRINT_INSERT_GROUPS.flatMap(g => g.items);
assert.strictEqual(allTypes.length, 11, 'O menu Inserir deve oferecer os 11 elementos');
assert.strictEqual(new Set(allTypes.map(t => t.type)).size, allTypes.length, 'Tipos repetidos no menu Inserir');
allTypes.forEach(it => {
  assert.ok(PRINT_ICONS[it.icon], `Ícone ausente para ${it.type}`);
  const item = PrintItemsManager.createNewItem(it.type, 'Projeto', 0);
  assert.ok(item && item.type === it.type, `createNewItem não cria "${it.type}"`);
});
assert.deepStrictEqual(
  allTypes.filter(t => t.quick).map(t => t.type),
  ['map', 'north_arrow', 'scale_bar', 'legend', 'label'],
  'Atalhos de inserção à mostra'
);

// 2. Roteamento das ações
const calls = [];
const composer = {
  exportDpi: 300,
  insertItem: (type) => calls.push(['insert', type]),
  canvasEngine: {
    zoomIn: () => calls.push(['zoomIn']),
    zoomOut: () => calls.push(['zoomOut']),
    zoomFit: () => calls.push(['zoomFit']),
    setZoom: (z) => calls.push(['setZoom', z])
  },
  sheetsManager: {
    sheets: [{ id: 'a' }, { id: 'b' }],
    runMenuAction: (a) => calls.push(['sheet', a])
  }
};

assert.ok(PrintToolbar.runAction(composer, 'insert:north_arrow'));
PrintToolbar.runAction(composer, 'zoom:in');
PrintToolbar.runAction(composer, 'zoom:fit');
PrintToolbar.runAction(composer, 'zoom:0.5');
PrintToolbar.runAction(composer, 'sheet:switch=sheet-1-abc');
assert.deepStrictEqual(calls, [
  ['insert', 'north_arrow'],
  ['zoomIn'],
  ['zoomFit'],
  ['setZoom', 0.5],
  ['sheet', 'switch=sheet-1-abc']
]);
assert.strictEqual(PrintToolbar.runAction(composer, 'nada:x'), false, 'Ação desconhecida é recusada');

// DPI troca sem exportar (sem DOM, refreshMenu não pode quebrar)
globalThis.document = { getElementById: () => null };
PrintToolbar.runAction(composer, 'dpi:150');
assert.strictEqual(composer.exportDpi, 150);

// 3. Marcação: menus presentes, controles removidos ausentes
const html = PrintToolbar.render(composer);
['btn-ptb-insert', 'btn-ptb-zoom', 'btn-ptb-export', 'cm-print-zoom-val', 'btn-print-undo', 'btn-print-redo',
  'btn-toggle-smart-guides', 'btn-close-print-composer', 'cm-print-sheets-controls'].forEach(id => {
  assert.ok(html.includes(`id="${id}"`), `Falta #${id} na barra`);
});
['btn-topbar-align-left', 'btn-topbar-duplicate', 'btn-print-auto-align', 'btn-mode-layout',
  'btn-mode-content-pan', 'cm-print-paper-badge', 'print-export-dpi-select'].forEach(id => {
  assert.ok(!html.includes(id), `#${id} não deveria estar mais na barra`);
});
assert.ok(PrintToolbar.renderExportMenu(composer).includes('PDF de todas (2)'), 'Contagem de pranchas no Exportar');
assert.ok(PrintToolbar.renderExportMenu(composer).includes('aria-checked="true" data-ptb-action="dpi:150"'), 'DPI marcado');

// Nome de prancha é escapado no menu
const sheetsMenu = PrintToolbar.renderSheetsMenu([{ id: 's1', name: '<b>X</b>' }], 's1');
assert.ok(sheetsMenu.includes('&lt;b&gt;X&lt;/b&gt;') && !sheetsMenu.includes('<b>X</b>'), 'Nome da prancha precisa ser escapado');

console.log('🎉 Barra do Layout de Impressão validada!');
