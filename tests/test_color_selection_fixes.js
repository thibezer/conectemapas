import assert from 'assert';

console.log('🧪 Cores em seleção: só o que mudou, restauração por feição e barra sincronizada...');

// Mock mínimo de browser/DOM para o Node
const noop = () => {};
global.localStorage = { store: {}, getItem(k) { return this.store[k] || null; }, setItem(k, v) { this.store[k] = String(v); }, removeItem(k) { delete this.store[k]; } };
globalThis.window = { innerWidth: 1920, innerHeight: 1080, addEventListener: noop, removeEventListener: noop, location: { search: '', hash: '', href: 'http://localhost/' } };
globalThis.document = {
  createElement: () => ({ style: {}, classList: { add: noop, remove: noop, toggle: noop }, setAttribute: noop, getAttribute: () => null, appendChild: noop, addEventListener: noop, removeEventListener: noop, querySelectorAll: () => [], querySelector: () => null }),
  documentElement: { style: {} },
  body: { appendChild: noop, removeChild: noop },
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

const { SelectionStyleController } = await import('../src/controllers/SelectionStyleController.js');
const { FeatureSyncController } = await import('../src/controllers/FeatureSyncController.js');

const poly = (id, fill, stroke, opacity) => ({
  id, name: id, type: 'Polygon', layerId: 'l1', color: fill,
  style: { fillColor: fill, strokeColor: stroke, fillOpacity: opacity }
});

function makeApp(features) {
  const toolbarCalls = [];
  const app = {
    features,
    layers: [{ id: 'l1', name: 'Lotes', color: '#10b981' }],
    history: [],
    pushHistory(d) { this.history.push(d); },
    saveFeature: noop,
    saveFeaturesBulk: noop,
    refreshMapAndTable: noop,
    collabHub: { notifyFeatureUpdated: noop, logAudit: (m) => ({ m }) },
    auditLog: [],
    mapEngine: { updateFeature: noop, setActiveDrawingStyles: noop },
    selectionHUD: { selectedFeatures: features.slice() },
    drawingToolbar: {
      setColors: (c) => toolbarCalls.push(['setColors', c]),
      setMixedState: (m) => toolbarCalls.push(['setMixedState', m]),
      setStrokeOnly: noop,
      getColors: () => ({})
    }
  };
  return { app, toolbarCalls };
}

const style = (app, id) => app.features.find(f => f.id === id).style;

// --------------------------------------------------------------------------
// 1. applyColorsToSelection grava só as propriedades indicadas (lote)
// --------------------------------------------------------------------------
{
  const { app, toolbarCalls } = makeApp([poly('a', '#ff0000', '#ffffff', 0.2), poly('b', '#00ff00', '#ffffff', 0.8)]);
  SelectionStyleController.applyColorsToSelection(app, { fillColor: '#123456', strokeColor: '#000000', fillOpacity: 0.5 }, ['strokeColor']);
  assert.strictEqual(style(app, 'a').fillColor, '#ff0000', 'Preenchimento de A não pode mudar');
  assert.strictEqual(style(app, 'b').fillColor, '#00ff00', 'Preenchimento de B não pode mudar');
  assert.strictEqual(style(app, 'a').fillOpacity, 0.2, 'Opacidade só muda se estiver em changed');
  assert.strictEqual(style(app, 'b').fillOpacity, 0.8);
  assert.strictEqual(style(app, 'a').strokeColor, '#000000');
  assert.strictEqual(style(app, 'b').strokeColor, '#000000');
  assert.ok(toolbarCalls.some(([n, m]) => n === 'setMixedState' && m.fill === true), 'A barra volta a mostrar o preenchimento como misto');

  // changed vazio não grava nada nem cria histórico
  const before = app.history.length;
  SelectionStyleController.applyColorsToSelection(app, { fillColor: '#123456' }, []);
  assert.strictEqual(app.history.length, before);
  console.log('✔ applyColorsToSelection em lote preserva o que não mudou');
}

// --------------------------------------------------------------------------
// 2. Seletor "Estilo" do HUD: pré-visualização, volta ao inicial e Cancelar
// --------------------------------------------------------------------------
{
  const { app } = makeApp([poly('a', '#ff0000', '#ffffff', 0.2), poly('b', '#00ff00', '#cccccc', 0.8)]);
  let opts = null;
  const fakeOpen = (o) => {
    opts = o;
    return { elemento: { obterEstado: () => ({ alvo: 'preenchimento', cor: '#ff0000', preenchimento: '#ff0000', traco: '#ffffff', opacidade: 0.2 }) } };
  };
  SelectionStyleController.openStylePicker(app, app.features, null, fakeOpen);
  assert.strictEqual(opts.misto, true, 'Preenchimentos diferentes abrem o seletor como "misto"');
  assert.strictEqual(opts.preenchimento, '#ff0000');

  const ev = (over) => ({ alvo: 'traco', cor: '#ffffff', preenchimento: '#ff0000', traco: '#ffffff', opacidade: 0.2, ...over });

  // Muda só o traço: preenchimentos e opacidades continuam diferentes
  opts.aoAlterar(ev({ traco: '#0000ff' }));
  assert.strictEqual(style(app, 'a').strokeColor, '#0000ff');
  assert.strictEqual(style(app, 'b').strokeColor, '#0000ff');
  assert.strictEqual(style(app, 'b').fillColor, '#00ff00', 'Preenchimento misto preservado');
  assert.strictEqual(style(app, 'b').fillOpacity, 0.8, 'Opacidade de B preservada');

  // Cancelar: o componente emite as cores iniciais; cada feição volta ao seu traço original
  opts.aoAlterar(ev({ traco: '#ffffff' }));
  assert.strictEqual(style(app, 'a').strokeColor, '#ffffff');
  assert.strictEqual(style(app, 'b').strokeColor, '#cccccc', 'B volta ao próprio traço, não ao de A');
  assert.strictEqual(style(app, 'b').fillColor, '#00ff00');

  // Opacidade e confirmação
  opts.aoAlterar(ev({ opacidade: 0.5 }));
  opts.aoConfirmar(ev({ opacidade: 0.5 }));
  assert.strictEqual(style(app, 'a').fillOpacity, 0.5);
  assert.strictEqual(style(app, 'b').fillOpacity, 0.5);
  assert.strictEqual(style(app, 'b').fillColor, '#00ff00');
  console.log('✔ Estilo do HUD grava só o que mudou e restaura feição por feição');
}

// --------------------------------------------------------------------------
// 3. Edição de uma feição selecionada (ex.: inspetor) sincroniza a barra
// --------------------------------------------------------------------------
{
  const { app, toolbarCalls } = makeApp([poly('a', '#ff0000', '#ffffff', 0.2)]);
  app.getLayersWithCounts = () => app.layers;
  app.layerPanel = { updateLayers: noop, refreshSelectedFeature: noop, updateAuditLog: noop };
  const edited = JSON.parse(JSON.stringify(app.features[0]));
  edited.style.fillColor = '#abcdef';
  FeatureSyncController.updateFeature(app, edited);
  const last = toolbarCalls.filter(([n]) => n === 'setColors').at(-1);
  assert.ok(last, 'A barra deve ser atualizada');
  assert.strictEqual(last[1].fillColor, '#abcdef', 'A barra espelha a cor nova');

  // Feição fora da seleção não mexe na barra
  toolbarCalls.length = 0;
  app.features.push(poly('z', '#111111', '#ffffff', 0.3));
  const other = JSON.parse(JSON.stringify(app.features[1]));
  other.style.fillColor = '#222222';
  FeatureSyncController.updateFeature(app, other);
  assert.strictEqual(toolbarCalls.length, 0, 'Edição fora da seleção não altera a barra');
  console.log('✔ Edição de feição selecionada sincroniza a barra de cores');
}

console.log('🎉 Correções de cores em seleção validadas!');
