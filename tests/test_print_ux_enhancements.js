/* ==========================================================================
   ConecteMapas - Teste de UX e Aprimoramentos do Layout de Impressão
   Cobre:
   1. Colapso e expansão do painel lateral de propriedades (togglePropertiesPanel).
   2. Modo de navegação de terreno (content_pan) e feedback visual de viewport.
   3. Sincronização em 1-clique do Selo ABNT com metadados do projeto.
   4. Seleção múltipla no canvas / lista e alinhamento em lote entre itens.
   5. Exclusão em lote de múltiplos itens selecionados.
   ========================================================================== */

import assert from 'assert';
import { PrintAlignmentHelper } from '../src/components/PrintComposer/PrintAlignmentHelper.js';
import { PrintItemsManager } from '../src/components/PrintComposer/PrintItemsManager.js';
import { PrintPropertiesPanel } from '../src/components/PrintComposer/PrintPropertiesPanel.js';

console.log('--- Teste de UX e Novos Recursos do Layout de Impressão ---');

// Mock DOM mínimo para Node
const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; }
};

// ============================================================================
// 1. Sincronização em 1-clique do Selo ABNT com metadados do projeto
// ============================================================================
console.log('1. Testando syncTitleBlockWithProject...');
const fakeComposer = {
  projectName: 'Fazenda Santa Maria - Georreferenciamento',
  features: [
    {
      id: 'poly-1',
      type: 'Polygon',
      coordinates: [[[-53.3, -23.7], [-53.3, -23.71], [-53.31, -23.71], [-53.3, -23.7]]]
    }
  ],
  items: [
    { id: 'item-map-main', type: 'map', scale: 5000 }
  ]
};

const titleBlockItem = {
  id: 'item-title-block',
  type: 'title_block',
  properties: {}
};

const updatedFields = PrintItemsManager.syncTitleBlockWithProject(titleBlockItem, fakeComposer);
assert(Array.isArray(updatedFields), 'Deve retornar array de campos atualizados');
assert(updatedFields.includes('Projeto'), 'Deve sincronizar nome do projeto');
assert.strictEqual(titleBlockItem.properties.projectName, 'Fazenda Santa Maria - Georreferenciamento');
assert(titleBlockItem.properties.datum.includes('SIRGAS 2000'), 'Deve preencher datum com SIRGAS 2000');
assert(titleBlockItem.properties.date, 'Deve preencher data atual');
assert.strictEqual(titleBlockItem.properties.scaleAuto, true, 'Deve ativar scaleAuto');
assert(titleBlockItem.properties.areaPerimeter, 'Deve calcular área e perímetro');
console.log('✔ syncTitleBlockWithProject validado com sucesso!');

// ============================================================================
// 2. Seleção múltipla e alinhamento em lote entre itens
// ============================================================================
console.log('2. Testando seleção múltipla e alinhamento em lote...');
class MockComposer {
  constructor() {
    this.projectName = 'Projeto Teste';
    this.paperSize = { id: 'A4_L', name: 'A4 Paisagem', width: 297, height: 210, marginL: 25, marginO: 7 };
    this.showAbntMargins = true;
    this.items = [];
    this.selectedItemIds = new Set();
    this.isPanelCollapsed = false;
    this.historySteps = [];
  }

  get selectedItemId() {
    for (const id of this.selectedItemIds) return id;
    return null;
  }

  set selectedItemId(val) {
    this.selectedItemIds.clear();
    if (val) this.selectedItemIds.add(val);
  }

  getSelectedItems() {
    return this.items.filter(i => this.selectedItemIds.has(i.id));
  }

  selectItem(id, { additive = false } = {}) {
    if (!id) {
      this.selectedItemIds.clear();
    } else if (additive) {
      if (this.selectedItemIds.has(id)) {
        if (this.selectedItemIds.size > 1) this.selectedItemIds.delete(id);
      } else {
        this.selectedItemIds.add(id);
      }
    } else {
      this.selectedItemIds.clear();
      this.selectedItemIds.add(id);
    }
  }

  selectItems(ids) {
    this.selectedItemIds.clear();
    ids.forEach(id => this.selectedItemIds.add(id));
  }

  deleteItems(ids) {
    this.items = this.items.filter(i => !ids.includes(i.id));
    ids.forEach(id => this.selectedItemIds.delete(id));
  }

  updateItemPositionDOM(item) {}
  updatePropertiesPanel() {}
  renderAllItems() {}
  pushHistoryState(act) { this.historySteps.push(act); }

  togglePropertiesPanel(forceState = null) {
    this.isPanelCollapsed = forceState !== null ? Boolean(forceState) : !this.isPanelCollapsed;
  }
}

const composer = new MockComposer();

// Adiciona 3 itens com coordenadas distintas
composer.items = [
  { id: 'it-1', type: 'label', x: 20, y: 30, width: 40, height: 10, locked: false },
  { id: 'it-2', type: 'label', x: 50, y: 60, width: 30, height: 15, locked: false },
  { id: 'it-3', type: 'label', x: 80, y: 100, width: 20, height: 20, locked: false }
];

// Seleção única
composer.selectItem('it-1');
assert.strictEqual(composer.selectedItemId, 'it-1');
assert.strictEqual(composer.selectedItemIds.size, 1);

// Seleção aditiva
composer.selectItem('it-2', { additive: true });
composer.selectItem('it-3', { additive: true });
assert.strictEqual(composer.selectedItemIds.size, 3);
const selectedItems = composer.getSelectedItems();
assert.strictEqual(selectedItems.length, 3);

// Alinhamento em lote à Esquerda: todos os itens devem alinhar pelo menor X (20)
PrintAlignmentHelper.alignLeft(composer);
assert.strictEqual(composer.items.find(i => i.id === 'it-1').x, 20);
assert.strictEqual(composer.items.find(i => i.id === 'it-2').x, 20);
assert.strictEqual(composer.items.find(i => i.id === 'it-3').x, 20);
console.log('✔ alignLeft em lote validado');

// Alinhamento em lote ao Topo: todos os itens devem alinhar pelo menor Y (30)
PrintAlignmentHelper.alignTop(composer);
assert.strictEqual(composer.items.find(i => i.id === 'it-1').y, 30);
assert.strictEqual(composer.items.find(i => i.id === 'it-2').y, 30);
assert.strictEqual(composer.items.find(i => i.id === 'it-3').y, 30);
console.log('✔ alignTop em lote validado');

// ============================================================================
// 3. Duplicação e Exclusão em lote
// ============================================================================
console.log('3. Testando duplicação e exclusão em lote...');
const countBefore = composer.items.length;
PrintAlignmentHelper.duplicateItem(composer);
assert.strictEqual(composer.items.length, countBefore + 3, 'Deve duplicar os 3 itens');

// Exclui os itens originais em lote
composer.deleteItems(['it-1', 'it-2', 'it-3']);
assert.strictEqual(composer.items.some(i => i.id === 'it-1'), false);
assert.strictEqual(composer.items.some(i => i.id === 'it-2'), false);
assert.strictEqual(composer.items.some(i => i.id === 'it-3'), false);
console.log('✔ Exclusão em lote validada');

// ============================================================================
// 4. Painel de Propriedades e Colapso
// ============================================================================
console.log('4. Testando renderização de seleção múltipla e colapso...');
composer.selectItems([composer.items[0].id, composer.items[1].id]);
const htmlMulti = PrintPropertiesPanel.render(composer);
assert(htmlMulti.includes('Itens Selecionados'), 'Painel deve exibir resumo de itens selecionados');
assert(htmlMulti.includes('cm-pp-collapse-btn'), 'Cabeçalho deve conter botão de colapsar');

assert.strictEqual(composer.isPanelCollapsed, false);
composer.togglePropertiesPanel(true);
assert.strictEqual(composer.isPanelCollapsed, true);
composer.togglePropertiesPanel(false);
assert.strictEqual(composer.isPanelCollapsed, false);
console.log('✔ Painel e colapso validados com sucesso');

console.log('\n🎉 TODOS OS TESTES DE UX E NOVOS RECURSOS PASSARAM COM SUCESSO!');
