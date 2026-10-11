const noop = () => {};
globalThis.window = {
  addEventListener: noop, removeEventListener: noop, devicePixelRatio: 1,
  screen: { deviceXDPI: 1, logicalXDPI: 1 }, location: { hostname: 'localhost', search: '' },
  requestAnimationFrame: (cb) => setTimeout(cb, 0), cancelAnimationFrame: noop
};
globalThis.document = {
  createElement: () => ({ style: {}, classList: { add: noop, remove: noop, toggle: noop }, setAttribute: noop, appendChild: noop, addEventListener: noop }),
  documentElement: { style: {} }, body: {}, addEventListener: noop, removeEventListener: noop,
  getElementById: () => null, querySelector: () => null, querySelectorAll: () => []
};
globalThis.HTMLElement = class {};
globalThis.customElements = { define: noop, get: () => null };
globalThis.CSSStyleSheet = class { replaceSync() {} };

import assert from 'assert';
const { FeaturePropertiesAdapter } = await import('../src/components/LayerPanel/FeaturePropertiesAdapter.js');
const { CanvasMapEngine } = await import('../src/services/CanvasMapEngine.js');
const { DrawingToolbar } = await import('../src/components/DrawingToolbar.js');

console.log('🧪 Iniciando testes de validação de cores transparentes (sem cor) no ConecteMapas...');

// 1. Validação no FeaturePropertiesAdapter
const featComCores = {
  id: 'f1',
  type: 'Polygon',
  coordinates: [[[0, 0], [0, 1], [1, 1], [0, 0]]],
  properties: { name: 'Polígono Teste', layerId: 'l1' },
  style: {
    fillColor: '#3b82f6',
    fillOpacity: 0.5,
    strokeColor: '#ef4444',
    strokeWidth: 2
  }
};

const layerMock = { id: 'l1', name: 'Camada 1', color: '#10b981' };
let currentFeature = structuredClone(featComCores);

const panelMock = {
  layers: [layerMock],
  getLatestFeature: () => currentFeature,
  selectedFeature: currentFeature,
  commitFeatureEdit: (id, mutator) => {
    mutator(currentFeature);
    return true;
  },
  refreshSelectedFeature: () => {},
  calculatePolygonArea: () => 100,
  calculatePolygonPerimeter: () => 40
};

const getPropValue = (categorias, id) => {
  for (const cat of categorias) {
    const prop = (cat.propriedades || []).find(p => p.id === id);
    if (prop) return prop.valor;
  }
  return undefined;
};

// Teste 1.1: Geração de propriedades iniciais
let config = FeaturePropertiesAdapter.gerarConfiguracao(panelMock, currentFeature);
assert.strictEqual(getPropValue(config.categorias, 'fillEnabled'), true, 'Preenchimento deve iniciar ativo');
assert.strictEqual(getPropValue(config.categorias, 'strokeEnabled'), true, 'Borda deve iniciar ativa');
assert.strictEqual(getPropValue(config.categorias, 'fillColor'), '#3b82f6');
assert.strictEqual(getPropValue(config.categorias, 'strokeColor'), '#ef4444');

// Teste 1.2: Desativar preenchimento (fillEnabled = false)
FeaturePropertiesAdapter.aplicarAlteracao(panelMock, 'f1', 'fillEnabled', false);
assert.strictEqual(currentFeature.style.fillColor, 'none', 'fillColor deve ser "none" quando fillEnabled = false');
assert.strictEqual(currentFeature.style._lastFillColor, '#3b82f6', '_lastFillColor deve armazenar a cor anterior');

// Teste 1.3: Reativar preenchimento (fillEnabled = true) restaura cor
FeaturePropertiesAdapter.aplicarAlteracao(panelMock, 'f1', 'fillEnabled', true);
assert.strictEqual(currentFeature.style.fillColor, '#3b82f6', 'fillColor deve restaurar a cor anterior');

// Teste 1.4: Desativar borda (strokeEnabled = false)
FeaturePropertiesAdapter.aplicarAlteracao(panelMock, 'f1', 'strokeEnabled', false);
assert.strictEqual(currentFeature.style.strokeColor, 'none', 'strokeColor deve ser "none" quando strokeEnabled = false');
assert.strictEqual(currentFeature.style._lastStrokeColor, '#ef4444', '_lastStrokeColor deve armazenar a cor anterior');

// Teste 1.5: Reativar borda (strokeEnabled = true) restaura cor
FeaturePropertiesAdapter.aplicarAlteracao(panelMock, 'f1', 'strokeEnabled', true);
assert.strictEqual(currentFeature.style.strokeColor, '#ef4444', 'strokeColor deve restaurar a cor anterior');

// Teste 1.6: Ambos sem cor
FeaturePropertiesAdapter.aplicarAlteracao(panelMock, 'f1', 'fillEnabled', false);
FeaturePropertiesAdapter.aplicarAlteracao(panelMock, 'f1', 'strokeEnabled', false);
assert.strictEqual(currentFeature.style.fillColor, 'none');
assert.strictEqual(currentFeature.style.strokeColor, 'none');

const configSemAmbos = FeaturePropertiesAdapter.gerarConfiguracao(panelMock, currentFeature);
assert.strictEqual(getPropValue(configSemAmbos.categorias, 'fillEnabled'), false);
assert.strictEqual(getPropValue(configSemAmbos.categorias, 'strokeEnabled'), false);

console.log('✔ Validações de FeaturePropertiesAdapter passaram com sucesso');

// 2. Validação no CanvasMapEngine (_styleOf)
const engine = Object.create(CanvasMapEngine.prototype);
const featSemFillParaEngine = {
  id: 'f2',
  layerId: 'l1',
  style: { fillColor: 'none', strokeColor: '#22c55e', strokeWidth: 3, fillOpacity: 0.7 }
};
const styleSemFill = engine._styleOf(featSemFillParaEngine, layerMock);
assert.strictEqual(styleSemFill.corPreenchimento, 'none', 'corPreenchimento deve ser "none"');
assert.strictEqual(styleSemFill.opacidadePreenchimento, 0, 'opacidadePreenchimento deve ser 0');
assert.strictEqual(styleSemFill.corTraco, '#22c55e');
assert.strictEqual(styleSemFill.espessuraTraco, 3);

const featSemStrokeParaEngine = {
  id: 'f3',
  layerId: 'l1',
  style: { fillColor: '#eab308', strokeColor: 'none', strokeWidth: 3, fillOpacity: 0.8 }
};
const styleSemStroke = engine._styleOf(featSemStrokeParaEngine, layerMock);
assert.strictEqual(styleSemStroke.corTraco, 'none', 'corTraco deve ser "none"');
assert.strictEqual(styleSemStroke.espessuraTraco, 0, 'espessuraTraco deve ser 0');
assert.strictEqual(styleSemStroke.corPreenchimento, '#eab308');

const featSemAmbosParaEngine = {
  id: 'f4',
  layerId: 'l1',
  style: { fillColor: 'none', strokeColor: 'none' }
};
const styleSemAmbos = engine._styleOf(featSemAmbosParaEngine, layerMock);
assert.strictEqual(styleSemAmbos.corPreenchimento, 'none');
assert.strictEqual(styleSemAmbos.opacidadePreenchimento, 0);
assert.strictEqual(styleSemAmbos.corTraco, 'none');
assert.strictEqual(styleSemAmbos.espessuraTraco, 0);

console.log('✔ Validações de CanvasMapEngine._styleOf passaram com sucesso');

// 3. Validação na DrawingToolbar
globalThis.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); }
};

let capturedColors = null;
const toolbar = new DrawingToolbar({
  initialTool: 'select',
  snappingEnabled: true,
  initialFillColor: '#3b82f6',
  initialStrokeColor: '#ffffff',
  initialLayer: layerMock,
  getLayers: () => [layerMock],
  onColorChange: (cols) => { capturedColors = cols; }
});

// 3.1 Alvo fill sem cor
toolbar.activeColorTarget = 'fill';
toolbar.setNoneColor();
assert.strictEqual(toolbar.fillColor, 'none', 'fillColor deve ser "none" após setNoneColor');
assert.strictEqual(capturedColors.fillColor, 'none');

// 3.2 Alvo stroke sem cor
toolbar.activeColorTarget = 'stroke';
toolbar.setNoneColor();
assert.strictEqual(toolbar.strokeColor, 'none', 'strokeColor deve ser "none" após setNoneColor');
assert.strictEqual(capturedColors.strokeColor, 'none');

// 3.3 Ambos sem cor e inversão (swapColors)
toolbar.setColors({ fillColor: '#ff00aa', strokeColor: 'none' });
assert.strictEqual(toolbar.fillColor, '#ff00aa');
assert.strictEqual(toolbar.strokeColor, 'none');

toolbar.swapColors();
assert.strictEqual(toolbar.fillColor, 'none');
assert.strictEqual(toolbar.strokeColor, '#ff00aa');

console.log('✔ Validações de DrawingToolbar passaram com sucesso');
console.log('🎉 Todos os testes de cores transparentes (sem cor) passaram com 100% de sucesso!');
