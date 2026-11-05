// Testes de Qualidade do Canvas (integração do <ui-canvas-cad qualidade="..."> com CanvasMapEngine e CanvasHost).
const noop = () => {};
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear()
};

globalThis.window = {
  addEventListener: noop, removeEventListener: noop, devicePixelRatio: 2,
  screen: { deviceXDPI: 1, logicalXDPI: 1 }, location: { hostname: 'localhost', search: '' },
  requestAnimationFrame: (cb) => setTimeout(cb, 0), cancelAnimationFrame: noop
};
globalThis.document = {
  createElement: (tag) => {
    const attrs = new Map();
    const el = {
      tagName: tag.toUpperCase(),
      style: {},
      classList: { add: noop, remove: noop, toggle: noop },
      setAttribute: (k, v) => attrs.set(k, String(v)),
      getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
      hasAttribute: (k) => attrs.has(k),
      removeAttribute: (k) => attrs.delete(k),
      appendChild: noop,
      addEventListener: noop,
      removeEventListener: noop,
      replaceWith: noop
    };
    if (tag.toLowerCase() === 'ui-canvas-cad') {
      let _qualidade = 'alta';
      Object.defineProperty(el, 'qualidade', {
        get: () => el.getAttribute('qualidade') || _qualidade,
        set: (v) => { _qualidade = v; el.setAttribute('qualidade', v); }
      });
      el.perfilQualidade = { nivel: 'alta', dprMaximo: 2 };
      el.getMap = () => ({ options: {}, setView: noop, setMaxZoom: noop });
      el.definirAtalhoSnap = noop;
      el.setLayerVisibility = noop;
    }
    return el;
  },
  documentElement: { style: {} }, body: {}, addEventListener: noop, removeEventListener: noop,
  getElementById: () => null, querySelector: () => null, querySelectorAll: () => []
};
globalThis.HTMLElement = class {};
globalThis.customElements = { define: noop, get: () => null };
globalThis.CSSStyleSheet = class { replaceSync() {} };

import assert from 'assert';

const { CanvasMapEngine } = await import('../src/services/CanvasMapEngine.js');
const { CanvasHost } = await import('../src/services/MapEngine/CanvasHost.js');
const { buildProjectTab } = await import('../src/components/ViewRibbon.js');

console.log('🧪 Iniciando testes de Qualidade do Canvas (CanvasMapEngine / CanvasHost)...');

// --- 1. Inicialização e valor padrão ---
{
  globalThis.localStorage.clear();
  let hostAttrs = new Map();
  const mockHost = {
    _qualidade: 'alta',
    get qualidade() { return this._qualidade; },
    set qualidade(v) { this._qualidade = v; hostAttrs.set('qualidade', v); },
    setAttribute: (k, v) => hostAttrs.set(k, v),
    getAttribute: (k) => hostAttrs.get(k) || null,
    perfilQualidade: { nivel: 'alta', dprMaximo: 2, tracejado: true }
  };

  const engine = Object.create(CanvasMapEngine.prototype);
  engine.host = mockHost;
  engine.quality = 'alta';
  engine.onQualityChange = noop;

  assert.strictEqual(engine.getQuality(), 'alta', 'qualidade inicial é alta');
  assert.deepStrictEqual(engine.getQualityProfile(), { nivel: 'alta', dprMaximo: 2, tracejado: true }, 'retorna perfil de qualidade do host');
  console.log('  ✔ 1. Inicialização e valor padrão validados');
}

// --- 2. Alteração de qualidade e persistência ---
{
  globalThis.localStorage.clear();
  let alteradoPara = null;
  let hostAttrs = new Map();
  const mockHost = {
    _qualidade: 'alta',
    get qualidade() { return this._qualidade; },
    set qualidade(v) { this._qualidade = v; hostAttrs.set('qualidade', v); },
    setAttribute: (k, v) => hostAttrs.set(k, v),
    getAttribute: (k) => hostAttrs.get(k) || null
  };

  const engine = Object.create(CanvasMapEngine.prototype);
  engine.host = mockHost;
  engine.quality = 'alta';
  engine.onQualityChange = (q) => { alteradoPara = q; };

  // Altera para média
  const r1 = engine.setQuality('media');
  assert.strictEqual(r1, 'media');
  assert.strictEqual(engine.getQuality(), 'media');
  assert.strictEqual(mockHost.qualidade, 'media');
  assert.strictEqual(globalThis.localStorage.getItem('cm_canvas_qualidade'), 'media');
  assert.strictEqual(alteradoPara, 'media');

  // Altera para baixa
  const r2 = engine.setQuality('baixa');
  assert.strictEqual(r2, 'baixa');
  assert.strictEqual(engine.getQuality(), 'baixa');
  assert.strictEqual(mockHost.qualidade, 'baixa');
  assert.strictEqual(globalThis.localStorage.getItem('cm_canvas_qualidade'), 'baixa');
  assert.strictEqual(alteradoPara, 'baixa');

  // Valor inválido deve cair em 'alta'
  const r3 = engine.setQuality('ultra_invalido');
  assert.strictEqual(r3, 'alta');
  assert.strictEqual(engine.getQuality(), 'alta');
  assert.strictEqual(mockHost.qualidade, 'alta');
  assert.strictEqual(globalThis.localStorage.getItem('cm_canvas_qualidade'), 'alta');

  console.log('  ✔ 2. Alteração de qualidade, persistência no localStorage e sanitização validadas');
}

// --- 3. Ciclo de qualidade (cycleQuality) ---
{
  globalThis.localStorage.clear();
  let hostAttrs = new Map();
  const mockHost = {
    _qualidade: 'alta',
    get qualidade() { return this._qualidade; },
    set qualidade(v) { this._qualidade = v; hostAttrs.set('qualidade', v); }
  };

  const engine = Object.create(CanvasMapEngine.prototype);
  engine.host = mockHost;
  engine.quality = 'alta';
  engine.onQualityChange = noop;

  assert.strictEqual(engine.getQuality(), 'alta');
  assert.strictEqual(engine.cycleQuality(), 'media', 'alta -> media');
  assert.strictEqual(engine.cycleQuality(), 'baixa', 'media -> baixa');
  assert.strictEqual(engine.cycleQuality(), 'alta', 'baixa -> alta');
  console.log('  ✔ 3. Alternância cíclica (alta -> media -> baixa -> alta) validada');
}

// --- 4. CanvasHost.mount atribui qualidade ao elemento ---
{
  globalThis.localStorage.setItem('cm_canvas_qualidade', 'baixa');
  const placeholder = globalThis.document.createElement('div');
  placeholder.id = 'map-test-quality';
  globalThis.document.getElementById = (id) => (id === 'map-test-quality' ? placeholder : null);

  const { host } = CanvasHost.mount('map-test-quality');
  assert.strictEqual(host.getAttribute('qualidade'), 'baixa', 'CanvasHost lê preferência salva do localStorage');
  assert.strictEqual(host.getAttribute('renderizador'), 'canvas', 'renderizador permanece canvas');

  // Com opção explícita em mount
  const { host: host2 } = CanvasHost.mount('map-test-quality', { qualidade: 'media' });
  assert.strictEqual(host2.getAttribute('qualidade'), 'media', 'CanvasHost aceita opção explícita de qualidade');

  console.log('  ✔ 4. CanvasHost.mount atribui qualidade declarativa corretamente');
}

// --- 5. Botão de qualidade na Ribbon ---
{
  const tab = buildProjectTab();
  const grupoMapa = tab.grupos.find(g => g.id === 'grp-mapa');
  assert(grupoMapa, 'grupo mapa existe na aba Projeto');

  const btnQualidade = grupoMapa.itens.find(i => i.id === 'btn-canvas-quality');
  assert(btnQualidade, 'botão btn-canvas-quality existe no grupo mapa');
  assert.strictEqual(btnQualidade.rotulo, 'Qualidade: Alta');
  assert(btnQualidade.icone, 'botão tem ícone associado');
  assert(btnQualidade.rotuloAcessivel, 'botão tem rótulo acessível para leitores de tela');

  console.log('  ✔ 5. Botão de qualidade no grupo Mapa da Ribbon validado');
}

console.log('🎉 Todos os testes de Qualidade do Canvas passaram com sucesso!');
