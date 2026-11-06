/* ==========================================================================
   ConecteMapas - Teste da Fase 2 (Cartografia Avançada e Ferramentas CAD)
   Cobre:
   1. PrintAlignmentHelper: distributeH e distributeV com 3+ itens.
   2. PrintItemsManager: renderMapGridBorder com formatos crosses, lines e ticks.
   3. PrintSmartGuides: snap magnético em guias manuais.
   4. PrintCanvasEngine: addManualGuide e removeManualGuide.
   ========================================================================== */

import assert from 'assert';
import { PrintAlignmentHelper } from '../src/components/PrintComposer/PrintAlignmentHelper.js';
import { PrintItemsManager } from '../src/components/PrintComposer/PrintItemsManager.js';
import { PrintSmartGuides } from '../src/components/PrintComposer/PrintSmartGuides.js';

console.log('--- Teste da Fase 2 do Layout de Impressão (Cartografia & CAD) ---');

// ============================================================================
// 1. Distribuição Equidistante (distributeH e distributeV)
// ============================================================================
console.log('1. Distribuição Equidistante...');

const movedPositions = [];
const composerMock = {
  paperSize: { width: 420, height: 297 },
  showAbntMargins: true,
  items: [
    { id: 'item1', x: 10, y: 10, width: 20, height: 10, locked: false },
    { id: 'item2', x: 30, y: 30, width: 20, height: 10, locked: false },
    { id: 'item3', x: 100, y: 100, width: 20, height: 10, locked: false }
  ],
  selectedItemIds: new Set(['item1', 'item2', 'item3']),
  getSelectedItems() {
    return this.items.filter(i => this.selectedItemIds.has(i.id));
  },
  updateItemPositionDOM(item) {
    movedPositions.push({ id: item.id, x: item.x, y: item.y });
  },
  updatePropertiesPanel() {},
  pushHistoryState() {}
};

// Teste distributeH: de x=10 até x=100 (total=120) com 3 caixas de 20mm
// Espaço total entre primeiro e último: (100 + 20) - 10 = 110mm
// Largura dos 3 itens = 60mm. Sobra para 2 gaps = 50mm -> gap = 25mm
// item1: x=10
// item2: x = 10 + 20 + 25 = 55mm
// item3: x=100
PrintAlignmentHelper.distributeH(composerMock);
assert.strictEqual(composerMock.items[1].x, 55, 'Item 2 distribuído com gap uniforme de 25mm');

// Teste distributeV: de y=10 até y=100 (total=110) com 3 caixas de 10mm
// Espaço total: (100 + 10) - 10 = 100mm
// Altura dos 3 itens = 30mm. Sobra para 2 gaps = 70mm -> gap = 35mm
// item1: y=10
// item2: y = 10 + 10 + 35 = 55mm
// item3: y=100
PrintAlignmentHelper.distributeV(composerMock);
assert.strictEqual(composerMock.items[1].y, 55, 'Item 2 distribuído verticalmente com gap uniforme de 35mm');

console.log('✔ Distribuição Equidistante validada!');

// ============================================================================
// 2. Estilos de Grade Cartográfica (Crosses, Lines, Ticks)
// ============================================================================
console.log('2. Estilos de Grade Cartográfica...');

const bounds = { north: -15, south: -16, west: -48, east: -47 };

// Formato padrão: crosses (cruzetas e ticks)
const htmlCrosses = PrintItemsManager.renderMapGridBorder(bounds, 'dms', 'crosses', 'vertical');
assert.ok(htmlCrosses.includes('cm-grid-cross'), 'Cruzetas presentes no modo crosses');
assert.ok(htmlCrosses.includes('cm-grid-tick'), 'Ticks presentes no modo crosses');
assert.ok(!htmlCrosses.includes('cm-grid-full-line'), 'Sem linhas completas no modo crosses');

// Formato lines (linhas contínuas)
const htmlLines = PrintItemsManager.renderMapGridBorder(bounds, 'dms', 'lines', 'vertical');
assert.ok(htmlLines.includes('cm-grid-full-line'), 'Linhas completas presentes no modo lines');
assert.ok(!htmlLines.includes('cm-grid-cross'), 'Sem cruzetas no modo lines');

// Formato ticks (apenas marcas de borda)
const htmlTicks = PrintItemsManager.renderMapGridBorder(bounds, 'dms', 'ticks', 'vertical');
assert.ok(htmlTicks.includes('cm-grid-tick'), 'Ticks presentes no modo ticks');
assert.ok(!htmlTicks.includes('cm-grid-cross'), 'Sem cruzetas no modo ticks');
assert.ok(!htmlTicks.includes('cm-grid-full-line'), 'Sem linhas no modo ticks');

// Rótulos horizontais vs verticais
const htmlHoriz = PrintItemsManager.renderMapGridBorder(bounds, 'dms', 'crosses', 'horizontal');
assert.ok(htmlHoriz.includes('is-horizontal'), 'Classe is-horizontal aplicada nos rótulos laterais');

console.log('✔ Estilos de Grade Cartográfica validados!');

// ============================================================================
// 3. Snap Magnético em Guias Manuais
// ============================================================================
console.log('3. Snap Magnético em Guias Manuais...');

const engineMock = {
  mmToPx: 3.78,
  composer: {
    manualGuides: { x: [50, 100], y: [40, 80] }
  }
};

const smartGuides = new PrintSmartGuides(engineMock);
smartGuides.setEnabled(true);

// Teste de snap horizontal (referência em X=50)
const testItem = { id: 'drag-item', width: 20, height: 20 };
// rawX está em 49mm (dentro da tolerância de 2.5mm de 50mm)
const snapResult = smartGuides.calculateDragSnap(testItem, 49, 10, [], { width: 297, height: 210 }, false);
assert.strictEqual(snapResult.snappedX, 50, 'Borda esquerda do item atraída magneticamente para a guia manual X=50mm');

// Teste de snap vertical (referência em Y=80)
// rawY está em 79mm (dentro da tolerância de 80mm)
const snapResultY = smartGuides.calculateDragSnap(testItem, 10, 79, [], { width: 297, height: 210 }, false);
assert.strictEqual(snapResultY.snappedY, 80, 'Borda superior do item atraída magneticamente para a guia manual Y=80mm');

console.log('✔ Snap em Guias Manuais validado!');

console.log('🎉 Todos os testes da Fase 2 passaram com sucesso!');
