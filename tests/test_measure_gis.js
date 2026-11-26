import assert from 'node:assert/strict';

const noop = () => {};
const makeEl = () => {
  const listeners = new Map();
  const el = {
    style: {},
    className: '',
    _html: '',
    get innerHTML() { return this._html; },
    set innerHTML(v) {
      this._html = v;
      this._mockMap?.forEach(c => c._clearListeners?.());
      this._mockAllMap?.forEach(arr => arr.forEach(c => c._clearListeners?.()));
    },
    _clearListeners() { listeners.clear(); },
    value: '',
    attrs: {},
    children: [],
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return this.attrs[k]; },
    appendChild(child) { this.children.push(child); return child; },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    dispatchEvent(ev) {
      for (const fn of [...(listeners.get(ev.type) || [])]) fn(ev);
    },
    click() {
      this.dispatchEvent({ type: 'click', target: this });
    },
    querySelector(sel) {
      return this._mockMap?.get(sel) || null;
    },
    querySelectorAll(sel) {
      return this._mockAllMap?.get(sel) || [];
    }
  };
  return el;
};

globalThis.window = globalThis.window || {
  addEventListener: noop,
  removeEventListener: noop,
  devicePixelRatio: 1,
  screen: { deviceXDPI: 1, logicalXDPI: 1 },
  location: { hostname: 'localhost', search: '' },
  requestAnimationFrame: (cb) => setTimeout(cb, 0),
  cancelAnimationFrame: noop
};
globalThis.HTMLElement = globalThis.HTMLElement || class {};
globalThis.customElements = globalThis.customElements || { define: noop, get: () => null };
globalThis.CSSStyleSheet = globalThis.CSSStyleSheet || class { replaceSync() {} };
globalThis.document = globalThis.document || {
  createElement: makeEl,
  body: makeEl(),
  addEventListener: noop,
  removeEventListener: noop,
  getElementById: () => null,
  querySelector: () => null,
  documentElement: { style: {} },
  activeElement: null
};

const { CanvasMapEngine } = await import('../src/services/CanvasMapEngine.js');
const { MeasureHUD } = await import('../src/components/MeasureHUD.js');

console.log('🧪 Testando Régua GIS efêmera (CanvasMapEngine + MeasureHUD)...');

// 1. CanvasMapEngine._handleKitMeasure não cria feição permanente e não limpa o overlay
{
  let createdCount = 0;
  let clearedCount = 0;
  let toolChangedTo = null;
  let measuredPayload = null;

  const fakeEngine = Object.create(CanvasMapEngine.prototype);
  fakeEngine._tool = 'measure';
  fakeEngine.host = {
    limparMedicao() { clearedCount++; },
    definirFerramenta() {}
  };
  fakeEngine.onFeatureCreated = () => { createdCount++; };
  fakeEngine.onToolChange = (t) => { toolChangedTo = t; };
  fakeEngine.onMeasurement = (m) => { measuredPayload = m; };

  fakeEngine._handleKitMeasure({
    tipo: 'distancia',
    pontos: [[-23.5, -46.6], [-23.501, -46.601], [-23.502, -46.6]]
  });

  assert.equal(createdCount, 0, 'Medição NÃO deve criar feição permanente no desenho');
  assert.equal(clearedCount, 0, 'Medição concluída deve manter o overlay temporário no mapa');
  assert.equal(toolChangedTo, null, 'Ferramenta de medição deve permanecer ativa no padrão GIS');
  assert.ok(measuredPayload, 'onMeasurement deve ser chamado');
  assert.equal(measuredPayload.mode, 'distance');
  assert.equal(measuredPayload.coords.length, 3);
  assert.equal(measuredPayload.segments.length, 2);
  assert.ok(measuredPayload.lengthM > 100, 'Comprimento geodésico deve ser positivo');
  assert.ok(measuredPayload.areaM2 > 0, 'Com >= 3 pontos deve calcular área delimitada');

  // clearMeasurement delega para host.limparMedicao()
  fakeEngine.clearMeasurement();
  assert.equal(clearedCount, 1, 'clearMeasurement deve limpar o overlay temporário');
}

// 2. MeasureHUD: modos, unidades, limpar, fechar e salvar opcional
{
  const container = makeEl();
  let modeChanged = null;
  let cleared = 0;
  let closed = 0;
  let saved = null;

  const hud = new MeasureHUD({
    container,
    onModeChange: (m) => { modeChanged = m; },
    onClear: () => { cleared++; },
    onClose: () => { closed++; },
    onSaveAsFeature: (m) => { saved = m; }
  });

  // Instrumenta o elemento raiz após criação para simular cliques sem DOM real
  hud.show('distance');
  assert.equal(hud.isVisible, true);
  assert.ok(hud.el.innerHTML.includes('Clique no mapa para medir'));

  const unitSel = makeEl();
  const clearBtn = makeEl();
  const saveBtn = makeEl();
  const closeBtn = makeEl();
  const areaBtn = makeEl();
  areaBtn.setAttribute('data-mode', 'area');
  const distBtn = makeEl();
  distBtn.setAttribute('data-mode', 'distance');

  hud.el._mockMap = new Map([
    ['[data-action="unit"]', unitSel],
    ['[data-action="clear"]', clearBtn],
    ['[data-action="save"]', saveBtn],
    ['[data-action="close"]', closeBtn]
  ]);
  hud.el._mockAllMap = new Map([
    ['[data-mode]', [distBtn, areaBtn]]
  ]);

  hud.setMeasurement({
    mode: 'distance',
    coords: [[-23.5, -46.6], [-23.51, -46.6]],
    lengthM: 1107.5,
    perimeterM: 1107.5,
    areaM2: 0,
    segments: [{ index: 1, distance: 1107.5, bearing: 180 }]
  });

  assert.ok(hud.el.innerHTML.includes('km'), 'Modo auto >= 1000m deve exibir km');

  // Trocar unidade para m / m²
  unitSel.dispatchEvent({ type: 'change', target: { value: 'metric-m' } });
  assert.ok(hud.el.innerHTML.includes('1.107,50 m') || hud.el.innerHTML.includes('1107,50 m'), 'Modo metric-m deve exibir em metros');

  // Salvar opcional
  saveBtn.click();
  assert.ok(saved && saved.lengthM === 1107.5, 'Salvar no desenho deve repassar a medição atual');

  // Limpar
  clearBtn.click();
  assert.equal(cleared, 1);
  assert.equal(hud.measurement, null);

  // Alternar para modo Área
  areaBtn.click();
  assert.equal(modeChanged, 'area');

  // Fechar
  closeBtn.click();
  assert.equal(closed, 1);
  assert.equal(hud.isVisible, false);
}

console.log('✅ test_measure_gis.js passou com sucesso!');
