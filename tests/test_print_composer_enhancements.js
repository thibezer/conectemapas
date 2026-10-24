/* ==========================================================================
   ConecteMapas - Teste das Novas Funcionalidades do Layout de Impressão
   Cobre:
   1. PrintSmartGuides: Snap magnético e detecção de guias ABNT e entre itens.
   2. PrintSheetsManager: Multi-pranchas (criação, duplicação, alternância, exclusão e numeração ABNT).
   3. PrintAlignmentHelper: Alinhamento, centralização, z-index e duplicação.
   4. PrintItemsManager: Novos itens (shape, image, label) e renderização.
   ========================================================================== */

import assert from 'assert';
import { PrintSmartGuides } from '../src/components/PrintComposer/PrintSmartGuides.js';
import { PrintSheetsManager } from '../src/components/PrintComposer/PrintSheetsManager.js';
import { PrintAlignmentHelper } from '../src/components/PrintComposer/PrintAlignmentHelper.js';
import { PrintItemsManager } from '../src/components/PrintComposer/PrintItemsManager.js';

console.log('--- Iniciando Teste de Aprimoramentos do Layout de Impressão ---');

// Mock simples de mock storage
const mockLocalStorage = (() => {
  let store = {};
  return {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; }
  };
})();
globalThis.localStorage = mockLocalStorage;

const paperSizes = {
  A4_L: { id: 'A4_L', name: 'A4 Paisagem', width: 297, height: 210, marginL: 25, marginO: 7 },
  A3_L: { id: 'A3_L', name: 'A3 Paisagem', width: 420, height: 297, marginL: 25, marginO: 10 }
};

// ============================================================================
// 1. TESTE DO MOTOR DE SMART GUIDES (GUIAS INTELIGENTES DO ILLUSTRATOR)
// ============================================================================
console.log('1. Testando PrintSmartGuides (Snap Magnético e Guias Automáticas)...');

const mockEngine = { mmToPx: 3.78 };
const smartGuides = new PrintSmartGuides(mockEngine);

const paperA4 = paperSizes.A4_L;
const item1 = { id: 'item-1', name: 'Item 1', x: 25, y: 7, width: 100, height: 80, visible: true };
const item2 = { id: 'item-2', name: 'Item 2', x: 150, y: 50, width: 60, height: 40, visible: true };
const allItems = [item1, item2];

// Teste 1.1: Snap próximo à Margem ABNT Esquerda (25 mm)
// Posição crua: x = 26.2 mm (distância 1.2 mm <= tolerância de 2.5 mm)
const snapLeft = smartGuides.calculateDragSnap(
  { id: 'item-moving', width: 50, height: 30 },
  26.2,
  40,
  allItems,
  paperA4,
  true
);

assert.strictEqual(snapLeft.snappedX, 25, 'Deve estalar (snap) exatamente na Margem ABNT Esquerda (25mm)');
assert.ok(snapLeft.guides.some(g => g.type === 'vertical' && g.x === 25), 'Deve gerar linha guia vertical em 25mm');

// Teste 1.2: Snap com centro de outro item (item2 centerX = 150 + 30 = 180)
// Item ativo largura 40, rawX = 160.5 -> centro ativo = 180.5 -> deve atrair para centerX = 180 (snappedX = 160)
const snapCenter = smartGuides.calculateDragSnap(
  { id: 'item-moving', width: 40, height: 30 },
  160.5,
  80,
  allItems,
  paperA4,
  true
);
assert.strictEqual(snapCenter.snappedX, 160, 'Deve alinhar os centros perfeitamente (snap no centro do item 2)');
assert.ok(snapCenter.guides.some(g => g.type === 'vertical' && g.x === 180), 'Deve gerar guia vertical no centro 180mm');

// Teste 1.3: Quando guias desativadas, não deve alterar coordenadas
smartGuides.setEnabled(false);
const snapDisabled = smartGuides.calculateDragSnap(
  { id: 'item-moving', width: 50, height: 30 },
  26.2,
  40,
  allItems,
  paperA4,
  true
);
assert.strictEqual(snapDisabled.snappedX, 26.2, 'Com guias desativadas, posição deve permanecer inalterada');
smartGuides.setEnabled(true);

console.log('✔ PrintSmartGuides validado com sucesso!');

// ============================================================================
// 2. TESTE DO GERENCIADOR DE MULTI-PRANCHAS (PrintSheetsManager)
// ============================================================================
console.log('2. Testando PrintSheetsManager (Múltiplas Pranchas no Projeto)...');

const mockComposer = {
  projectName: 'Projeto Teste de Engenharia',
  currentBasemap: 'satelite',
  paperSizes,
  paperSize: paperSizes.A4_L,
  showAbntMargins: true,
  items: [],
  selectedItemId: null,
  updatePaperSheetDOM: () => {},
  renderAllItems: () => {},
  updatePropertiesPanel: () => {},
  canvasEngine: { zoomFit: () => {}, renderRulers: () => {} },
  updateInsetMapExtent: () => {}
};

const sheetsMgr = new PrintSheetsManager(mockComposer);
mockComposer.sheetsManager = sheetsMgr;

// Inicializa pranchas
mockLocalStorage.clear();
const initialSheet = sheetsMgr.init('proj-123', mockComposer.projectName, paperSizes);
assert.ok(initialSheet, 'Deve criar a prancha inicial');
assert.strictEqual(sheetsMgr.sheets.length, 1, 'Deve conter 1 prancha inicialmente');
assert.strictEqual(initialSheet.name, 'Prancha 01 - Planta Geral', 'Nome padrão da 1ª prancha correto');

// Criação de 2ª prancha
sheetsMgr.createSheet('Prancha 02 - Detalhe da Área A', 'A3_L', 'abnt');
assert.strictEqual(sheetsMgr.sheets.length, 2, 'Deve conter 2 pranchas');
assert.strictEqual(sheetsMgr.activeSheetId, sheetsMgr.sheets[1].id, 'A prancha recém-criada deve ser a ativa');
assert.strictEqual(mockComposer.paperSize.id, 'A3_L', 'Compositor deve atualizar para papel A3');

// Duplicação de prancha
sheetsMgr.duplicateCurrentSheet();
assert.strictEqual(sheetsMgr.sheets.length, 3, 'Deve conter 3 pranchas após duplicação');
const duplicated = sheetsMgr.getCurrentSheet();
assert.ok(duplicated.name.includes('(Cópia)'), 'Nome da prancha duplicada deve conter (Cópia)');

// Renomeação de prancha
sheetsMgr.renameSheet(duplicated.id, 'Prancha 03 - Perfis');
assert.strictEqual(sheetsMgr.getCurrentSheet().name, 'Prancha 03 - Perfis', 'Nome deve ser atualizado');

// Numeração automática de prancha nos carimbos ABNT
sheetsMgr.updateSheetNumbersInTitleBlocks();
const sh1 = sheetsMgr.sheets[0];
const tbItem = sh1.items.find(i => i.type === 'title_block');
assert.ok(tbItem, 'Deve conter selo técnico na prancha 1');
assert.strictEqual(tbItem.properties.sheetNumber, '01/03', 'Numeração automática no selo deve ser 01/03');

// Exclusão de prancha
const idToDelete = sheetsMgr.sheets[2].id;
sheetsMgr.deleteSheet(idToDelete);
assert.strictEqual(sheetsMgr.sheets.length, 2, 'Deve ter 2 pranchas após exclusão');
sheetsMgr.updateSheetNumbersInTitleBlocks();
assert.strictEqual(tbItem.properties.sheetNumber, '01/02', 'Após exclusão, numeração no selo deve atualizar para 01/02');

// Proteção contra excluir a última prancha
sheetsMgr.deleteSheet(sheetsMgr.sheets[0].id);
assert.strictEqual(sheetsMgr.sheets.length, 1, 'Deve ter 1 prancha restante');
sheetsMgr.deleteSheet(sheetsMgr.sheets[0].id);
assert.strictEqual(sheetsMgr.sheets.length, 1, 'NÃO deve permitir excluir a última prancha restante do projeto');

// Salvamento automático: edições sem histórico sobrevivem a fechar/reabrir (nova instância lendo o storage)
console.log('2b. Testando salvamento automático e reabertura das pranchas...');
mockLocalStorage.clear();
mockComposer.items = [];
const autoMgr = new PrintSheetsManager(mockComposer);
mockComposer.sheetsManager = autoMgr;
autoMgr.init('proj-auto', mockComposer.projectName, paperSizes);
autoMgr.createSheet('Prancha 02 - Detalhe', 'A3_L', 'abnt');
const editedSheetId = autoMgr.activeSheetId;

const mapItem = mockComposer.items.find(i => i.type === 'map');
mapItem.view = { center: [-23.55, -46.63], zoom: 17 };
mapItem.locked = true;
mockComposer.showAbntMargins = false;
autoMgr.scheduleSave();
await new Promise(r => setTimeout(r, PrintSheetsManager.AUTOSAVE_DELAY_MS + 50));

mockComposer.items = [];
const reopened = new PrintSheetsManager(mockComposer);
const reopenedSheet = reopened.init('proj-auto', mockComposer.projectName, paperSizes);
assert.strictEqual(reopened.sheets.length, 2, 'Deve recarregar as 2 pranchas salvas');
assert.strictEqual(reopenedSheet.id, editedSheetId, 'Deve reabrir na última prancha usada, não na primeira');
assert.strictEqual(reopenedSheet.showAbntMargins, false, 'Deve manter a opção de margens editada');
const reopenedMap = reopenedSheet.items.find(i => i.type === 'map');
assert.deepStrictEqual(reopenedMap.view, { center: [-23.55, -46.63], zoom: 17 }, 'Deve manter o enquadramento do mapa');
assert.strictEqual(reopenedMap.locked, true, 'Deve manter o bloqueio do item');

// flushPendingSave grava na hora uma edição ainda no debounce (ex.: recarregar a página)
mockComposer.items = JSON.parse(JSON.stringify(reopenedSheet.items));
mockComposer.items.find(i => i.type === 'map').locked = false;
reopened.scheduleSave();
reopened.flushPendingSave();
const raw = JSON.parse(mockLocalStorage.getItem(PrintSheetsManager.STORAGE_PREFIX + 'proj-auto'));
assert.strictEqual(raw.find(s => s.id === editedSheetId).items.find(i => i.type === 'map').locked, false, 'flush deve gravar a edição pendente');

console.log('✔ PrintSheetsManager validado com sucesso!');

// ============================================================================
// 3. TESTE DE ALINHAMENTO E FERRAMENTAS (PrintAlignmentHelper)
// ============================================================================
console.log('3. Testando PrintAlignmentHelper (Alinhamento, Z-Index e Duplicação)...');

const itemAlignA = { id: 'box-a', name: 'Caixa A', x: 50, y: 50, width: 60, height: 40, locked: false };
const itemAlignB = { id: 'box-b', name: 'Caixa B', x: 120, y: 80, width: 40, height: 30, locked: false };

const alignComposer = {
  paperSize: paperSizes.A4_L, // W=297, H=210, marginL=25, marginO=7
  showAbntMargins: true,
  items: [itemAlignA, itemAlignB],
  selectedItemId: 'box-a',
  history: [],
  pushHistoryState: (act) => alignComposer.history.push(act),
  updateItemPositionDOM: () => {},
  updatePropertiesPanel: () => {},
  renderAllItems: () => {},
  selectItem: (id) => { alignComposer.selectedItemId = id; }
};

// Alinhar à Esquerda (deve ir para a margem ABNT de 25mm)
PrintAlignmentHelper.alignLeft(alignComposer);
assert.strictEqual(itemAlignA.x, 25, 'Alinhar à esquerda deve posicionar na margem ABNT (25mm)');

// Centralizar Horizontalmente ((297 - 60) / 2 = 118.5 -> 119 ou 118)
PrintAlignmentHelper.alignCenterH(alignComposer);
assert.strictEqual(itemAlignA.x, Math.round((297 - 60) / 2), 'Deve centralizar horizontalmente na folha');

// Alinhar à Direita (297 - 7 - 60 = 230mm)
PrintAlignmentHelper.alignRight(alignComposer);
assert.strictEqual(itemAlignA.x, 230, 'Alinhar à direita deve respeitar a margem ABNT de 7mm');

// Alinhar ao Topo (7mm)
PrintAlignmentHelper.alignTop(alignComposer);
assert.strictEqual(itemAlignA.y, 7, 'Alinhar ao topo deve posicionar na margem superior ABNT (7mm)');

// Alinhar à Base (210 - 7 - 40 = 163mm)
PrintAlignmentHelper.alignBottom(alignComposer);
assert.strictEqual(itemAlignA.y, 163, 'Alinhar à base deve respeitar a margem inferior ABNT');

// Trazer para Frente e Enviar para Trás (Camadas / Z-Index)
assert.strictEqual(alignComposer.items[0].id, 'box-a');
PrintAlignmentHelper.bringToFront(alignComposer);
assert.strictEqual(alignComposer.items[1].id, 'box-a', 'box-a deve ir para o final da lista (frente visual)');

PrintAlignmentHelper.sendToBack(alignComposer);
assert.strictEqual(alignComposer.items[0].id, 'box-a', 'box-a deve voltar para o início da lista (fundo visual)');

// Duplicar Item Selecionado
PrintAlignmentHelper.duplicateItem(alignComposer);
assert.strictEqual(alignComposer.items.length, 3, 'Deve haver 3 itens após duplicação');
const dupItem = alignComposer.items[2];
assert.strictEqual(dupItem.name, 'Caixa A (Cópia)');
assert.strictEqual(dupItem.x, itemAlignA.x + 5, 'Item duplicado deve ser deslocado 5mm em X');
assert.strictEqual(dupItem.y, itemAlignA.y + 5, 'Item duplicado deve ser deslocado 5mm em Y');

console.log('✔ PrintAlignmentHelper validado com sucesso!');

// ============================================================================
// 4. TESTE DOS NOVOS ITENS E RENDERIZAÇÃO (PrintItemsManager)
// ============================================================================
console.log('4. Testando Novos Itens Cartográficos (Moldura, Imagem, Título)...');

// Criação de Shape
const shapeItem = PrintItemsManager.createNewItem('shape', 'Projeto Teste', 1);
assert.ok(shapeItem, 'Deve criar item do tipo shape');
assert.strictEqual(shapeItem.type, 'shape');
assert.strictEqual(shapeItem.strokeWidth, 1.5);
const shapeHtml = PrintItemsManager.renderShape(shapeItem);
assert.ok(shapeHtml.includes('cm-item-shape-box'), 'HTML do shape deve conter classe cm-item-shape-box');

// Criação de Imagem / Logo
const imgItem = PrintItemsManager.createNewItem('image', 'Projeto Teste', 2);
assert.ok(imgItem, 'Deve criar item do tipo image');
assert.strictEqual(imgItem.type, 'image');
const imgEmptyHtml = PrintItemsManager.renderImage(imgItem);
assert.ok(imgEmptyHtml.includes('cm-item-image-placeholder'), 'Sem URL, deve exibir placeholder de upload');
imgItem.imageUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const imgLoadedHtml = PrintItemsManager.renderImage(imgItem);
assert.ok(imgLoadedHtml.includes('<img src="data:image/png;base64,'), 'Com URL, deve renderizar a tag img');

// Criação de Label / Título Livre
const labelItem = PrintItemsManager.createNewItem('label', 'Projeto Teste', 3);
assert.ok(labelItem, 'Deve criar item do tipo label');
assert.strictEqual(labelItem.type, 'label');
assert.strictEqual(labelItem.fontWeight, 'bold');
labelItem.text = 'MEMORIAL TOPOGRÁFICO DE DEMARCAÇÃO';
const labelHtml = PrintItemsManager.renderLabel(labelItem);
assert.ok(labelHtml.includes('MEMORIAL TOPOGRÁFICO DE DEMARCAÇÃO'), 'HTML do label deve conter o texto formatado');

console.log('✔ PrintItemsManager validado com sucesso!');

console.log('\n🎉 TODOS OS TESTES DE LAYOUT DE IMPRESSÃO PASSARAM COM SUCESSO!');
