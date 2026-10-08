import assert from 'assert';
import { DrawingToolbar } from '../src/components/DrawingToolbar.js';

console.log('🧪 Iniciando testes de validação da DrawingToolbar enriquecida...');

// Mock do localStorage para ambiente Node
global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); }
};

// Instanciação da toolbar
let lastTool = null;
let lastAction = null;
let lastColors = null;
let lastLayerId = null;

const toolbar = new DrawingToolbar({
  initialTool: 'select',
  snappingEnabled: true,
  initialFillColor: '#00E08A',
  initialStrokeColor: '#ffffff',
  initialLayer: { id: 'l1', name: 'Lotes', color: '#00E08A' },
  getLayers: () => [
    { id: 'l1', name: 'Lotes', color: '#00E08A' },
    { id: 'l2', name: 'Ruas', color: '#38bdf8' }
  ],
  onToolChange: (tool) => { lastTool = tool; },
  onAction: (act) => { lastAction = act; },
  onColorChange: (cols) => { lastColors = cols; },
  onSelectLayer: (lid) => { lastLayerId = lid; }
});

// 1. Validação das ferramentas da lista canônica
const tools = toolbar.getToolsDefinition();
console.log(`Total de itens na paleta: ${tools.length}`);

const toolIds = tools.map(t => t.id);
const expectedTools = [
  'select', 'pen-select',
  'polygon', 'formas', 'line', 'point', 'text',
  'eyedropper', 'split', 'join',
  'snap', 'measure',
  'fit', 'locate'
];

for (const exp of expectedTools) {
  assert(toolIds.includes(exp), `Ferramenta esperada '${exp}' não encontrada na paleta`);
}

// Garante que undo, redo, clear-selection e delete-feature foram removidos da barra
const removedTools = ['undo', 'redo', 'clear-selection', 'delete-feature'];
for (const rem of removedTools) {
  assert(!toolIds.includes(rem), `Ferramenta desnecessária '${rem}' não deveria constar na paleta`);
}

// Validação dos filhos do grupo de formas
const grupoFormas = tools.find(t => t.id === 'formas');
assert(grupoFormas && Array.isArray(grupoFormas.filhos), 'Grupo de formas deve possuir filhos');
const filhosIds = grupoFormas.filhos.map(f => f.id);
const expectedFilhos = ['rectangle', 'circle', 'ellipse', 'regular-polygon', 'star'];
for (const filho of expectedFilhos) {
  assert(filhosIds.includes(filho), `Sub-forma '${filho}' não encontrada no grupo de formas`);
}

console.log('✔ Todas as ferramentas esperadas, grupo de formas com sub-itens e remoção de botões redundantes validados com sucesso');

// 2. Validação do snap como toggle
const snapItem = tools.find(t => t.id === 'snap');
assert.strictEqual(snapItem.tipo, 'toggle', 'O item snap deve ser do tipo toggle');
assert.strictEqual(snapItem.ativo, true, 'O item snap deve iniciar ativo');
console.log('✔ Snap configurado corretamente como toggle');

// 3. Validação do alternador de colunas híbrido
assert.strictEqual(toolbar.columns, '2', 'Padrão inicial deve ser 2 colunas');
toolbar.setColumns('1');
assert.strictEqual(toolbar.columns, '1', 'Deve alternar para 1 coluna');
assert.strictEqual(global.localStorage.getItem('cm_toolbar_cols'), '1', 'Deve salvar 1 coluna no localStorage');
toolbar.setColumns('2');
assert.strictEqual(toolbar.columns, '2', 'Deve alternar para 2 colunas');
assert.strictEqual(global.localStorage.getItem('cm_toolbar_cols'), '2', 'Deve salvar 2 colunas no localStorage');
console.log('✔ Modo híbrido de alternância de 1 e 2 colunas testado com sucesso');

// 4. Validação do Seletor de Cores estilo Illustrator
toolbar.setColors({ fillColor: '#ff0055', strokeColor: '#00ffff' });
assert.strictEqual(toolbar.fillColor, '#ff0055');
assert.strictEqual(toolbar.strokeColor, '#00ffff');

toolbar.swapColors(); // Inverter Fill e Stroke (atalho X)
assert.strictEqual(toolbar.fillColor, '#00ffff');
assert.strictEqual(toolbar.strokeColor, '#ff0055');
console.log('✔ Inversão de cores de preenchimento e traço (atalho X) funcionando');

toolbar.resetDefaultColors(); // Cores padrão da camada (atalho D)
assert.strictEqual(toolbar.fillColor, '#00E08A');
assert.strictEqual(toolbar.strokeColor, '#ffffff');
console.log('✔ Reset para cores padrão da camada (atalho D) funcionando');

// 5. Validação da camada ativa
toolbar.setActiveLayer({ id: 'l2', name: 'Ruas', color: '#38bdf8' });
assert.strictEqual(toolbar.activeLayer.id, 'l2');
console.log('✔ Atualização da camada ativa funcionando');

console.log('🎉 Todos os testes de unidade da DrawingToolbar passaram com 100% de sucesso!');
