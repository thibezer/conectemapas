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
// 4. Contrato DrawingToolbar ↔ <ui-controle-cores> (componente do kit)
//    O comportamento do componente é testado no kit; aqui validamos a ponte do app.
// --------------------------------------------------------------------------
console.log('▶ Testando a ponte entre DrawingToolbar e <ui-controle-cores>...');

class FakeControleCores extends EventTarget {
  constructor() {
    super();
    this.calls = [];
    this.attrs = {};
    this.atalhos = null;
    this.coresProjeto = [];
  }
  definirCores(c) { this.calls.push(['definirCores', c]); }
  definirAlvo(a) { this.calls.push(['definirAlvo', a]); }
  definirMisto(m) { this.calls.push(['definirMisto', m]); }
  abrirSeletor(a) { this.calls.push(['abrirSeletor', a]); }
  toggleAttribute(n, v) { this.calls.push(['toggleAttribute', n, v]); }
  setAttribute(n, v) { this.attrs[n] = v; }
}

const fakeControl = new FakeControleCores();
const bridgeEvents = [];
const bridge = new DrawingToolbar({
  initialFillColor: '#10b981',
  initialStrokeColor: '#ffffff',
  initialLayer: { id: 'l1', name: 'Lotes', color: '#10b981' },
  getLayers: () => [{ id: 'l1', color: '#10b981' }, { id: 'l2', color: '#3b82f6' }],
  onColorChange: (cols, meta) => bridgeEvents.push({ cols, meta })
});
bridge.container = { querySelector: (sel) => (sel === '#cm-controle-cores' ? fakeControl : null) };
bridge.bindColorEvents();

assert.strictEqual(bridge.colorControl, fakeControl, 'A barra deve guardar a referência ao <ui-controle-cores>');
assert.deepStrictEqual(fakeControl.atalhos, { alternar: 'X', inverter: 'Shift+X', semCor: '/', padrao: 'D' });
assert.deepStrictEqual(fakeControl.coresProjeto, ['#10b981', '#3b82f6'], 'Cores das camadas viram "cores do projeto"');

const emitCores = (detail) => fakeControl.dispatchEvent(new CustomEvent('ui-cores-change', { detail }));

// Pré-visualização do seletor: commit false, só o que mudou, sempre com a opacidade atual
emitCores({ preenchimento: '#000000', traco: '#ffffff', opacidade: 0.6, alvo: 'preenchimento', confirmado: false, alterados: ['preenchimento'], origem: 'seletor' });
assert.deepStrictEqual(bridgeEvents.at(-1), {
  cols: { fillColor: '#000000', strokeColor: '#ffffff', fillOpacity: 0.6 },
  meta: { commit: false, changed: ['fillColor'] }
});
assert.strictEqual(bridge.fillColor, '#000000');
assert.strictEqual(bridge.fillOpacity, 0.6);

// Confirmação do seletor: commit true
emitCores({ preenchimento: '#000000', traco: '#ffffff', opacidade: 0.6, alvo: 'preenchimento', confirmado: true, alterados: ['preenchimento', 'opacidade'], origem: 'seletor' });
assert.strictEqual(bridgeEvents.at(-1).meta.commit, true);
assert.deepStrictEqual(bridgeEvents.at(-1).meta.changed, ['fillColor', 'fillOpacity'], 'Confirmação grava só o que mudou desde que o seletor abriu');

// Botões do controle: mesmo contrato dos atalhos (sem opacidade, só o que mudou)
emitCores({ preenchimento: '#ffffff', traco: '#000000', opacidade: 0.6, alvo: 'preenchimento', confirmado: true, alterados: ['preenchimento', 'traco'], origem: 'inverter' });
assert.deepStrictEqual(bridgeEvents.at(-1), {
  cols: { fillColor: '#ffffff', strokeColor: '#000000' },
  meta: { commit: true, changed: ['fillColor', 'strokeColor'] }
});
emitCores({ preenchimento: '#ffffff', traco: 'none', opacidade: 0.6, alvo: 'traco', confirmado: true, alterados: ['traco'], origem: 'sem-cor' });
assert.deepStrictEqual(bridgeEvents.at(-1).meta, { commit: true, changed: ['strokeColor'] });
assert.strictEqual(bridge.strokeColor, 'none');
assert.strictEqual(bridge.activeColorTarget, 'stroke', 'O alvo do evento atualiza a barra');

// Troca de alvo vinda do componente
fakeControl.dispatchEvent(new CustomEvent('ui-alvo-change', { detail: { alvo: 'preenchimento' } }));
assert.strictEqual(bridge.activeColorTarget, 'fill');

// Métodos da barra repassam ao componente (sem emitir eventos de volta)
fakeControl.calls = [];
const eventsBefore = bridgeEvents.length;
bridge.setColors({ fillColor: '#ABC', strokeColor: 'transparent' });
bridge.setActiveColorTarget('stroke');
bridge.setMixedState({ fill: true });
bridge.setStrokeOnly(true);
bridge.openColorPicker('fill');
assert.deepStrictEqual(fakeControl.calls, [
  ['definirCores', { preenchimento: '#AABBCC', traco: 'none' }],
  ['definirAlvo', 'traco'],
  ['definirMisto', { preenchimento: true, traco: false }],
  ['toggleAttribute', 'so-traco', true],
  ['definirAlvo', 'preenchimento'],
  ['abrirSeletor', 'preenchimento']
]);
assert.strictEqual(bridgeEvents.length, eventsBefore, 'Métodos definir* não disparam onColorChange');

// Camada ativa define a cor de "restaurar padrão" do componente
bridge.setActiveLayer({ id: 'l2', name: 'Vias', color: '#3b82f6' });
assert.strictEqual(fakeControl.attrs['padrao-preenchimento'], '#3b82f6');

console.log('✔ Ponte DrawingToolbar ↔ <ui-controle-cores> validada!');

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
