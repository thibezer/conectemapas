import assert from 'assert';

console.log('🧪 Iniciando testes de validação do Sistema de Cores e Traço estilo Adobe Illustrator...');

// Mock do ambiente de browser / DOM para ambiente Node
global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); }
};

const noop = () => {};
globalThis.window = {
  innerWidth: 1920,
  innerHeight: 1080,
  addEventListener: noop,
  removeEventListener: noop
};
globalThis.document = {
  createElement: (tag) => ({
    tagName: tag ? tag.toUpperCase() : 'DIV',
    style: {},
    classList: { add: noop, remove: noop, toggle: noop },
    setAttribute: noop,
    getAttribute: () => null,
    appendChild: noop,
    removeChild: noop,
    addEventListener: noop,
    removeEventListener: noop,
    querySelectorAll: () => [],
    querySelector: () => null,
    getBoundingClientRect: () => ({ top: 100, left: 100, width: 200, height: 300, right: 300, bottom: 400 })
  }),
  documentElement: { style: {} },
  body: {
    appendChild: noop,
    removeChild: noop
  },
  addEventListener: noop,
  removeEventListener: noop,
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  activeElement: null
};
globalThis.HTMLElement = class {};
globalThis.customElements = { define: noop, get: () => null };
globalThis.CSSStyleSheet = class { replaceSync() {} };

// Imports dos módulos do sistema
const { DrawingToolbar } = await import('../src/components/DrawingToolbar.js');
const { ColorPickerPopover } = await import('../src/components/ColorPicker/ColorPickerPopover.js');
const { ShortcutsController } = await import('../src/controllers/ShortcutsController.js');
const { AppGeometryCoordinator } = await import('../src/bootstrap/AppGeometryCoordinator.js');
const { BatchActions } = await import('../src/services/BatchActions.js');
const { SelectionHUD } = await import('../src/components/SelectionHUD.js');

// --------------------------------------------------------------------------
// 1. Validação da DrawingToolbar: Foco Ativo (X) vs Inversão (Shift+X)
// --------------------------------------------------------------------------
console.log('▶ Testando comportamento de Foco Ativo (X) e Inversão de Cores (Shift+X)...');

let colorChangeEvents = [];
const toolbar = new DrawingToolbar({
  initialFillColor: '#10b981',
  initialStrokeColor: '#3b82f6',
  initialLayer: { id: 'l1', name: 'Lotes', color: '#10b981' },
  onColorChange: (cols, meta) => {
    colorChangeEvents.push({ cols, meta });
  }
});

assert.strictEqual(toolbar.activeColorTarget, 'fill', 'O alvo ativo inicial deve ser Preenchimento (fill)');
assert.strictEqual(toolbar.fillColor, '#10b981');
assert.strictEqual(toolbar.strokeColor, '#3b82f6');

// Teste de alternância de foco (tecla X)
toolbar.toggleActiveColorTarget();
assert.strictEqual(toolbar.activeColorTarget, 'stroke', 'Atalho X deve alternar o foco para Traçado (stroke)');
assert.strictEqual(toolbar.fillColor, '#10b981', 'Alternar foco NÃO pode alterar a cor de preenchimento');
assert.strictEqual(toolbar.strokeColor, '#3b82f6', 'Alternar foco NÃO pode alterar a cor do traço');

toolbar.toggleActiveColorTarget();
assert.strictEqual(toolbar.activeColorTarget, 'fill', 'Atalho X novamente deve retornar o foco para Preenchimento (fill)');

// Teste de inversão de cores (Shift + X)
colorChangeEvents = [];
toolbar.swapColors();
assert.strictEqual(toolbar.fillColor, '#3b82f6', 'Preenchimento deve receber a cor antiga do traço');
assert.strictEqual(toolbar.strokeColor, '#10b981', 'Traço deve receber a cor antiga do preenchimento');
assert.strictEqual(colorChangeEvents.length, 1, 'Inverter cores deve disparar onColorChange');

// Teste do atalho Sem Cor (tecla /)
toolbar.setActiveColorTarget('fill');
toolbar.setNoneColor();
assert.strictEqual(toolbar.fillColor, 'none', 'setNoneColor deve definir o preenchimento como none');

toolbar.setActiveColorTarget('stroke');
toolbar.setNoneColor();
assert.strictEqual(toolbar.strokeColor, 'none', 'setNoneColor no traço deve definir o traço como none');

// Teste do atalho Padrão (tecla D)
toolbar.resetDefaultColors();
assert.strictEqual(toolbar.fillColor, '#10b981', 'Restaurar padrão deve aplicar a cor da camada ao preenchimento');
assert.strictEqual(toolbar.strokeColor, '#ffffff', 'Restaurar padrão deve aplicar branco ao traço');

console.log('✔ Foco Ativo (X), Inversão (Shift+X), Sem Cor (/) e Reset (D) validados na toolbar!');

// --------------------------------------------------------------------------
// 2. Validação dos Atalhos Globais no ShortcutsController
// --------------------------------------------------------------------------
console.log('▶ Testando ShortcutsController com X, Shift+X e /...');

let toggledTargetCalled = false;
let swapColorsCalled = false;
let noneColorCalled = false;
let resetDefaultCalled = false;

const mockApp = {
  drawingToolbar: {
    toggleActiveColorTarget: () => { toggledTargetCalled = true; },
    swapColors: () => { swapColorsCalled = true; },
    setNoneColor: () => { noneColorCalled = true; },
    resetDefaultColors: () => { resetDefaultCalled = true; }
  }
};

let keyListener = null;
globalThis.window.addEventListener = (evt, handler) => {
  if (evt === 'keydown') keyListener = handler;
};

ShortcutsController.bindGlobalShortcuts(mockApp);
assert(typeof keyListener === 'function', 'Listener de teclado global deve ser registrado');

// Pressionar 'x' sem Shift (deve alternar foco)
toggledTargetCalled = false;
swapColorsCalled = false;
keyListener({
  key: 'x',
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  preventDefault: noop
});
assert.strictEqual(toggledTargetCalled, true, 'Tecla x minúscula sem Shift deve chamar toggleActiveColorTarget');
assert.strictEqual(swapColorsCalled, false, 'Tecla x sem Shift não pode chamar swapColors');

// Pressionar 'x' com Shift (Shift+X deve inverter cores)
toggledTargetCalled = false;
swapColorsCalled = false;
keyListener({
  key: 'x',
  shiftKey: true,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  preventDefault: noop
});
assert.strictEqual(swapColorsCalled, true, 'Shift+X deve chamar swapColors');
assert.strictEqual(toggledTargetCalled, false, 'Shift+X não pode chamar toggleActiveColorTarget');

// Pressionar '/' (deve chamar setNoneColor)
noneColorCalled = false;
keyListener({
  key: '/',
  code: 'Slash',
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  preventDefault: noop
});
assert.strictEqual(noneColorCalled, true, 'Tecla / deve chamar setNoneColor');

// Salvaguarda: com Ctrl ou Alt, atalhos não devem ser disparados
toggledTargetCalled = false;
keyListener({
  key: 'x',
  shiftKey: false,
  ctrlKey: true,
  metaKey: false,
  altKey: false,
  preventDefault: noop
});
assert.strictEqual(toggledTargetCalled, false, 'Ctrl+X não pode disparar alternância de cor da toolbar');

console.log('✔ Atalhos globais e proteção contra modificadores validados!');

// --------------------------------------------------------------------------
// 3. Validação de Seleção Múltipla e Estado Misto (?) em AppGeometryCoordinator
// --------------------------------------------------------------------------
console.log('▶ Testando sincronização de seleção e estado misto (?) no Coordinator...');

let lastMixedState = null;
toolbar.setMixedState = (state) => { lastMixedState = state; };

const featA = { id: 'a', type: 'Polygon', color: '#ff0000', style: { fillColor: '#ff0000', strokeColor: '#ffffff' } };
const featB = { id: 'b', type: 'Polygon', color: '#00ff00', style: { fillColor: '#00ff00', strokeColor: '#ffffff' } };
const featC = { id: 'c', type: 'Polygon', color: '#ff0000', style: { fillColor: '#ff0000', strokeColor: '#000000' } };

// Feição única
AppGeometryCoordinator.syncToolbarColors({ drawingToolbar: toolbar, layers: [] }, [featA]);
assert.deepStrictEqual(lastMixedState, { fill: false, stroke: false }, 'Feição única deve desativar estado misto');

// Múltiplas feições com preenchimento diferente e mesmo traço
AppGeometryCoordinator.syncToolbarColors({ drawingToolbar: toolbar, layers: [] }, [featA, featB]);
assert.strictEqual(lastMixedState.fill, true, 'Preenchimentos diferentes devem marcar fill: true (misto)');
assert.strictEqual(lastMixedState.stroke, false, 'Mesmo traço deve marcar stroke: false (uniforme)');

// Múltiplas feições com mesmo preenchimento e traço diferente
AppGeometryCoordinator.syncToolbarColors({ drawingToolbar: toolbar, layers: [] }, [featA, featC]);
assert.strictEqual(lastMixedState.fill, false, 'Mesmo preenchimento deve marcar fill: false');
assert.strictEqual(lastMixedState.stroke, true, 'Traços diferentes devem marcar stroke: true (misto)');

console.log('✔ Detecção automática de estado misto (?) em seleção múltipla testada com sucesso!');

// --------------------------------------------------------------------------
// 4. Validação do ColorPickerPopover: Modo Dual e Suporte a Alpha
// --------------------------------------------------------------------------
console.log('▶ Testando ColorPickerPopover (modo dual, alpha, swatches)...');

let popoverChange = null;
let popoverCommit = null;

const popover = new ColorPickerPopover({
  anchorEl: globalThis.document.createElement('div'),
  activeTarget: 'fill',
  fillColor: '#10b981',
  strokeColor: '#ef4444',
  opacity: 0.35,
  layers: [{ id: 'l1', name: 'Lotes', color: '#10b981' }],
  onChange: (res) => { popoverChange = res; },
  onCommit: (res) => { popoverCommit = res; }
});

assert.strictEqual(popover.activeTarget, 'fill');
assert.strictEqual(popover.currentColor, '#10b981');
assert.strictEqual(popover.fillOpacity, 0.35);

// Alternar para traço
popover.switchTarget('stroke');
assert.strictEqual(popover.activeTarget, 'stroke');
assert.strictEqual(popover.currentColor, '#ef4444');
assert.strictEqual(popover.showOpacity, false, 'Traço não deve exibir controle de opacidade por padrão');

// Alterar cor do traço
popover.setColor('#38bdf8', true);
assert.strictEqual(popover.strokeColor, '#38bdf8');
assert.strictEqual(popoverChange.strokeColor, '#38bdf8');

// Voltar para preenchimento e alterar opacidade
popover.switchTarget('fill');
assert.strictEqual(popover.showOpacity, true);
popover.setOpacity(0.75, true);
assert.strictEqual(popover.fillOpacity, 0.75);
assert.strictEqual(popoverChange.fillOpacity, 0.75);

// Testar fechamento e onCommit
popover.close(true);
assert.strictEqual(popoverCommit.fillColor, '#10b981');
assert.strictEqual(popoverCommit.strokeColor, '#38bdf8');
assert.strictEqual(popoverCommit.fillOpacity, 0.75);

console.log('✔ ColorPickerPopover com modo dual e alpha validado!');

// --------------------------------------------------------------------------
// 5. Validação do SelectionHUD com Ação de Estilo
// --------------------------------------------------------------------------
console.log('▶ Testando botão de Estilo no SelectionHUD...');

let hudStyleCalled = false;
const hud = new SelectionHUD({
  onStyle: (feats, anchor) => {
    hudStyleCalled = true;
  }
});

hud.update([featA], [{ id: 'l1', name: 'Camada', color: '#10b981' }]);
assert.strictEqual(typeof hud.onStyle, 'function', 'SelectionHUD deve possuir callback onStyle');

console.log('✔ Botão e integração de Estilo no SelectionHUD validados!');

// --------------------------------------------------------------------------
// 6. Validação do BatchActions com fillOpacity
// --------------------------------------------------------------------------
console.log('▶ Testando BatchActions.applyColors com fillOpacity...');

const batchApp = {
  features: [
    { id: 'f1', type: 'Polygon', style: { fillColor: '#000000', fillOpacity: 0.2 } },
    { id: 'f2', type: 'Polygon', style: { fillColor: '#000000', fillOpacity: 0.2 } }
  ],
  pushHistory: noop,
  saveFeature: noop,
  refreshMapAndTable: noop
};

BatchActions.applyColors(batchApp, ['f1', 'f2'], {
  fillColor: '#00E08A',
  strokeColor: '#ffffff',
  fillOpacity: 0.8
});

assert.strictEqual(batchApp.features[0].style.fillColor, '#00E08A');
assert.strictEqual(batchApp.features[0].style.fillOpacity, 0.8);
assert.strictEqual(batchApp.features[1].style.fillColor, '#00E08A');
assert.strictEqual(batchApp.features[1].style.fillOpacity, 0.8);

console.log('✔ BatchActions.applyColors gravou cores e fillOpacity corretamente!');

console.log('\n======================================================');
console.log('🎉 TODOS OS TESTES DO SISTEMA DE CORES PASSARAM COM SUCESSO!');
console.log('======================================================');
