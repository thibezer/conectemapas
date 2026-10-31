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

  const previews = [];
  app.mapEngine.updateFeature = (f) => previews.push(f);

  // Prévia: pinta só o mapa (cópias), sem tocar em app.features, histórico ou gravação
  opts.aoAlterar(ev({ traco: '#0000ff' }));
  opts.aoAlterar(ev({ traco: '#0000aa' }));
  assert.strictEqual(app.history.length, 0, 'Prévia não cria histórico');
  assert.strictEqual(style(app, 'a').strokeColor, '#ffffff', 'Prévia não altera as feições do app');
  assert.strictEqual(style(app, 'b').strokeColor, '#cccccc');
  const lastB = previews.filter(f => f.id === 'b').at(-1);
  assert.strictEqual(lastB.style.strokeColor, '#0000aa', 'Prévia mostra o traço novo no mapa');
  assert.strictEqual(lastB.style.fillColor, '#00ff00', 'Preenchimento misto preservado na prévia');
  assert.strictEqual(lastB.style.fillOpacity, 0.8, 'Opacidade de B preservada na prévia');

  // Voltar ao valor inicial (ou Cancelar) devolve ao mapa as feições originais
  opts.aoAlterar(ev({ traco: '#ffffff' }));
  assert.strictEqual(previews.at(-1).style.strokeColor, '#cccccc', 'B volta ao próprio traço, não ao de A');
  assert.strictEqual(app.history.length, 0);
  opts.aoAlterar(ev({ traco: '#123123' }));
  opts.aoCancelar();
  assert.strictEqual(previews.at(-1).style.strokeColor, '#cccccc', 'Cancelar desfaz a prévia');
  assert.strictEqual(app.history.length, 0, 'Cancelar não grava nada');

  // Confirmar: um único histórico, só o que mudou desde a abertura
  opts.aoAlterar(ev({ opacidade: 0.5 }));
  opts.aoAlterar(ev({ opacidade: 0.6 }));
  opts.aoConfirmar(ev({ opacidade: 0.5 }));
  assert.strictEqual(app.history.length, 1, 'Confirmar grava 1 passo de histórico');
  assert.strictEqual(style(app, 'a').fillOpacity, 0.5);
  assert.strictEqual(style(app, 'b').fillOpacity, 0.5);
  assert.strictEqual(style(app, 'b').fillColor, '#00ff00');
  assert.strictEqual(style(app, 'b').strokeColor, '#cccccc', 'Traço não tocado continua o de cada feição');
  console.log('✔ Estilo do HUD: prévia só visual, 1 histórico ao confirmar, só o que mudou');
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

// --------------------------------------------------------------------------
// 4. strokeWidth em lote e auto-ativação de espessura quando borda estava com 0 px
// --------------------------------------------------------------------------
{
  const { app } = makeApp([
    { id: 'p0', type: 'Polygon', style: { strokeColor: 'none', strokeWidth: 0 } },
    { id: 'p1', type: 'Polygon', style: { strokeColor: '#ffffff', strokeWidth: 2 } }
  ]);
  SelectionStyleController.applyColorsToSelection(app, { strokeWidth: 4 }, ['strokeWidth']);
  assert.strictEqual(style(app, 'p0').strokeWidth, 4, 'strokeWidth deve ser aplicado a p0');
  assert.strictEqual(style(app, 'p1').strokeWidth, 4, 'strokeWidth deve ser aplicado a p1');

  // Ao definir strokeColor numa feição com strokeWidth 0, restaura espessura visível
  const zeroStroke = { id: 'pZero', type: 'Polygon', style: { strokeColor: 'none', strokeWidth: 0 } };
  const { app: appZero } = makeApp([zeroStroke]);
  SelectionStyleController.applyColorsToSelection(appZero, { strokeColor: '#ff0000' }, ['strokeColor']);
  assert.strictEqual(style(appZero, 'pZero').strokeColor, '#ff0000');
  assert.ok(style(appZero, 'pZero').strokeWidth > 0, 'strokeWidth deve ser reativado para valor > 0');
  console.log('✔ strokeWidth aplicado e recuperado de 0 px');
}

console.log('🎉 Correções de cores em seleção validadas!');
