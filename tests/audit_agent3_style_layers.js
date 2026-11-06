/* ==========================================================================
   ConecteMapas - Teste de Auditoria do Agente 3
   Especialista em Estilização, Simbologia e Camadas
   Arquivo: tests/audit_agent3_style_layers.js

   Testa rigorosamente:
   1. Habilitação correta dos botões (mod-style, mod-eyedropper, mod-invert, mod-layer)
   2. Dinamismo de rótulos e ícones de mod-lock e mod-visible
   3. Dropdown dinâmico de camadas (mod-layer, mod-layer:<id>, ativo)
   4. BatchActions.moveToLayer (lote, histórico, inheritColor, erros)
   5. BatchActions.invertColors (inversão, filtros de tipo, idempotência)
   6. Tratamento de seleções mistas (bloqueadas vs desbloqueadas - Regra 6)
   7. Regra Ocultar vs Excluir (visible:false -> oculta: true, sem tombstone - Regra 2)
   8. SelectionStyleController (abertura, prévia, cancelamento, confirmação)
   9. Roteamento via ModifyActionsController.run
   ========================================================================== */

import assert from 'assert';

// 1. Setup de ambiente headless ANTES de importar módulos com dependência de window/document (Leaflet)
const noop = () => {};
globalThis.window = {
  addEventListener: noop,
  removeEventListener: noop,
  devicePixelRatio: 1,
  screen: { deviceXDPI: 1, logicalXDPI: 1 },
  location: { hostname: 'localhost', search: '' },
  requestAnimationFrame: (cb) => setTimeout(cb, 0),
  cancelAnimationFrame: noop
};
globalThis.document = {
  createElement: () => ({
    style: {},
    classList: { add: noop, remove: noop, toggle: noop },
    setAttribute: noop,
    appendChild: noop,
    addEventListener: noop
  }),
  documentElement: { style: {} },
  body: {},
  addEventListener: noop,
  removeEventListener: noop,
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => []
};
globalThis.HTMLElement = class {};
globalThis.customElements = { define: noop, get: () => null };
globalThis.CSSStyleSheet = class { replaceSync() {} };

// 2. Importação dinâmica dos módulos sob auditoria (evita hoisting que quebraria o Leaflet)
const {
  MODIFY_TAB_ID,
  MODIFY_ITEM_PREFIX,
  MODIFY_LAYER_PREFIX,
  ICONES,
  buildModifyTab,
  computeModifyState
} = await import('../src/components/ModifyRibbon.js');
const { FeatureVisibility } = await import('../src/services/Storage/FeatureVisibility.js');

const { ModifyActionsController } = await import('../src/controllers/ModifyActionsController.js');
const { SelectionStyleController } = await import('../src/controllers/SelectionStyleController.js');
const { BatchActions } = await import('../src/services/BatchActions.js');
const { CanvasMapEngine } = await import('../src/services/CanvasMapEngine.js');

console.log('=================================================================');
console.log('🧪 AUDITORIA AGENTE 3: ESTILIZAÇÃO, SIMBOLOGIA E CAMADAS');
console.log('=================================================================\n');

// Camadas base para os testes
const mockLayers = [
  { id: 'layer-lotes', name: 'Lotes Urbanos', color: '#38bdf8', visible: true, locked: false, opacity: 1 },
  { id: 'layer-vias', name: 'Sistema Viário', color: '#f59e0b', visible: true, locked: false, opacity: 1 },
  { id: 'layer-reserva', name: 'Área de Preservação', color: '#10b981', visible: true, locked: true, opacity: 0.8 }
];

// Geradores de geometrias de teste
const makePoly = (id, extra = {}) => ({
  id,
  type: 'Polygon',
  name: `Polígono ${id}`,
  layerId: 'layer-lotes',
  coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]],
  color: '#00E08A',
  style: { fillColor: '#00E08A', strokeColor: '#ffffff', strokeWidth: 2, fillOpacity: 0.4 },
  properties: { area_m2: 10000, tipo: 'urbano' },
  ...extra
});

const makeLine = (id, extra = {}) => ({
  id,
  type: 'LineString',
  name: `Linha ${id}`,
  layerId: 'layer-vias',
  coordinates: [[0, 0], [1, 1], [2, 2]],
  color: '#f59e0b',
  style: { strokeColor: '#f59e0b', strokeWidth: 3 },
  properties: { extensao_m: 350 },
  ...extra
});

const makePoint = (id, extra = {}) => ({
  id,
  type: 'Point',
  name: `Ponto ${id}`,
  layerId: 'layer-lotes',
  coordinates: [0.5, 0.5],
  color: '#ef4444',
  style: { fillColor: '#ef4444', strokeColor: '#ffffff' },
  ...extra
});

const makeText = (id, extra = {}) => ({
  id,
  type: 'Text',
  name: `Texto ${id}`,
  layerId: 'layer-lotes',
  coordinates: [0, 0],
  properties: { text: 'Anotação' },
  style: { textColor: '#111827' },
  ...extra
});

// Helper de criação de ambiente fakeApp
function createFakeApp(features = [], layers = mockLayers) {
  const log = {
    history: [],
    savedBulk: [],
    deletedBulk: [],
    refreshes: 0,
    collabUpdated: [],
    collabDeleted: []
  };

  const app = {
    projectId: 'proj-auditoria-agent3',
    features: [...features],
    layers: [...layers],
    log,
    historyUndo: [],
    historyRedo: [],
    mapEngine: {
      activeTool: 'select',
      updatedFeatures: [],
      updateFeature(feat) {
        this.updatedFeatures.push(feat);
      },
      selectFeature: noop,
      selectFeatures: noop
    },
    collabHub: {
      notifyFeatureUpdated(feat) {
        log.collabUpdated.push(feat);
      },
      notifyFeatureDeleted(id) {
        log.collabDeleted.push(id);
      }
    },
    pushHistory(desc) {
      log.history.push(desc);
      this.historyUndo.push(desc);
    },
    saveFeaturesBulk(drafts) {
      log.savedBulk.push([...drafts]);
    },
    removeFeaturesBulk(ids) {
      log.deletedBulk.push([...ids]);
    },
    refreshMapAndTable(invalidate) {
      log.refreshes++;
    },
    selectionHUD: {
      selectedFeatures: []
    },
    batchActions: {
      moveToLayer: (ids, layerId, opts) => BatchActions.moveToLayer(app, ids, layerId, opts),
      invertColors: (ids) => BatchActions.invertColors(app, ids),
      setLocked: (ids, locked) => BatchActions.setLocked(app, ids, locked),
      setVisible: (ids, visible) => BatchActions.setVisible(app, ids, visible),
      applyColors: (ids, colors) => BatchActions.applyColors(app, ids, colors),
      remove: (ids) => BatchActions.remove(app, ids)
    }
  };

  return app;
}

// =========================================================================
// SEÇÃO 1: Habilitação e Estados dos Botões do Grupo Estilo e Organizar
// =========================================================================
console.log('▶ [SEÇÃO 1] Habilitação e Estados dos Botões na Ribbon...');

{
  // 1.1 Sem seleção
  const stEmpty = computeModifyState({ features: [], layers: mockLayers, activeTool: 'select' });
  assert.strictEqual(stEmpty['mod-style'].disabled, true, 'mod-style desabilitado sem seleção');
  assert.strictEqual(stEmpty['mod-eyedropper'].disabled, false, 'mod-eyedropper SEMPRE habilitado');
  assert.strictEqual(stEmpty['mod-eyedropper'].ativo, false, 'mod-eyedropper inativo quando activeTool != eyedropper');
  assert.strictEqual(stEmpty['mod-invert'].disabled, true, 'mod-invert desabilitado sem seleção');
  assert.strictEqual(stEmpty['mod-layer'].disabled, true, 'mod-layer desabilitado sem seleção');
  console.log('  ✔ 1.1 Estado sem seleção validado com sucesso.');

  // 1.2 Com 1 polígono selecionado e desbloqueado
  const p1 = makePoly('p1');
  const stPoly = computeModifyState({ features: [p1], layers: mockLayers, activeTool: 'select' });
  assert.strictEqual(stPoly['mod-style'].disabled, false, 'mod-style habilitado com polígono selecionado');
  assert.strictEqual(stPoly['mod-eyedropper'].disabled, false, 'mod-eyedropper habilitado');
  assert.strictEqual(stPoly['mod-invert'].disabled, false, 'mod-invert habilitado para polígono');
  assert.strictEqual(stPoly['mod-layer'].disabled, false, 'mod-layer habilitado para feição desbloqueada com camadas');
  console.log('  ✔ 1.2 Seleção de 1 polígono desbloqueado validada com sucesso.');

  // 1.3 Ferramenta Eyedropper Ativa
  const stEyeActive = computeModifyState({ features: [], layers: mockLayers, activeTool: 'eyedropper' });
  assert.strictEqual(stEyeActive['mod-eyedropper'].disabled, false);
  assert.strictEqual(stEyeActive['mod-eyedropper'].ativo, true, 'mod-eyedropper ativo quando activeTool === eyedropper');
  console.log('  ✔ 1.3 Toggle visual do mod-eyedropper refletindo ferramenta ativa validado.');

  // 1.4 Invert Colors desabilitado para Linha e Texto
  const stLine = computeModifyState({ features: [makeLine('l1')], layers: mockLayers });
  assert.strictEqual(stLine['mod-invert'].disabled, true, 'mod-invert desabilitado para LineString (cor única)');

  const stText = computeModifyState({ features: [makeText('t1')], layers: mockLayers });
  assert.strictEqual(stText['mod-invert'].disabled, true, 'mod-invert desabilitado para Text (cor única)');

  // 1.5 Invert Colors em seleção mista de Linha + Polígono
  const stMixed = computeModifyState({ features: [makeLine('l1'), makePoly('p1')], layers: mockLayers });
  assert.strictEqual(stMixed['mod-invert'].disabled, false, 'mod-invert habilitado se há pelo menos um polígono');
  console.log('  ✔ 1.4 & 1.5 Restrição de tipos para mod-invert validada (apenas geometrias com preenchimento).');

  // 1.6 mod-layer desabilitado se o projeto não tiver camadas
  const stNoLayers = computeModifyState({ features: [p1], layers: [] });
  assert.strictEqual(stNoLayers['mod-layer'].disabled, true, 'mod-layer desabilitado quando layers=[]');

  // 1.7 mod-layer, mod-style e mod-visible desabilitados se todas as feições estiverem bloqueadas
  const stAllLocked = computeModifyState({ features: [makePoly('p1', { locked: true })], layers: mockLayers });
  assert.strictEqual(stAllLocked['mod-layer'].disabled, true, 'mod-layer desabilitado quando todas feições estão travadas');
  assert.strictEqual(stAllLocked['mod-style'].disabled, true, 'mod-style desabilitado quando todas feições estão travadas');
  assert.strictEqual(stAllLocked['mod-visible'].disabled, true, 'mod-visible desabilitado quando todas feições estão travadas');
  console.log('  ✔ 1.6 & 1.7 Condições de salvaguarda de mod-layer, mod-style e mod-visible validadas.');
}

// =========================================================================
// SEÇÃO 2: Dinamismo de Rótulos e Ícones de mod-lock e mod-visible
// =========================================================================
console.log('\n▶ [SEÇÃO 2] Dinamismo de Rótulos e Ícones (mod-lock e mod-visible)...');

{
  // 2.1 mod-lock
  // Sem seleção: desabilitado, rótulo "Bloquear", ícone bloquear
  const stEmpty = computeModifyState({ features: [] });
  assert.strictEqual(stEmpty['mod-lock'].disabled, true);
  assert.strictEqual(stEmpty['mod-lock'].rotulo, 'Bloquear');
  assert.strictEqual(stEmpty['mod-lock'].icone, ICONES.bloquear);

  // Feição desbloqueada: habilitado, rótulo "Bloquear", ícone bloquear
  const stUnlocked = computeModifyState({ features: [makePoly('p1', { locked: false })] });
  assert.strictEqual(stUnlocked['mod-lock'].disabled, false);
  assert.strictEqual(stUnlocked['mod-lock'].rotulo, 'Bloquear');
  assert.strictEqual(stUnlocked['mod-lock'].icone, ICONES.bloquear);

  // Todas bloqueadas: habilitado, rótulo "Desbloquear", ícone desbloquear
  const stLocked = computeModifyState({ features: [makePoly('p1', { locked: true }), makePoly('p2', { locked: true })] });
  assert.strictEqual(stLocked['mod-lock'].disabled, false);
  assert.strictEqual(stLocked['mod-lock'].rotulo, 'Desbloquear');
  assert.strictEqual(stLocked['mod-lock'].icone, ICONES.desbloquear);

  // Mista (1 travada, 1 destravada): prioridade é bloquear o resto -> "Bloquear"
  const stMixedLock = computeModifyState({ features: [makePoly('p1', { locked: true }), makePoly('p2', { locked: false })] });
  assert.strictEqual(stMixedLock['mod-lock'].disabled, false);
  assert.strictEqual(stMixedLock['mod-lock'].rotulo, 'Bloquear');
  assert.strictEqual(stMixedLock['mod-lock'].icone, ICONES.bloquear);
  console.log('  ✔ 2.1 Dinamismo de rótulo e ícone de mod-lock validado (Bloquear vs Desbloquear).');

  // 2.2 mod-visible
  // Sem seleção: desabilitado, rótulo "Ocultar", ícone ocultar
  assert.strictEqual(stEmpty['mod-visible'].disabled, true);
  assert.strictEqual(stEmpty['mod-visible'].rotulo, 'Ocultar');
  assert.strictEqual(stEmpty['mod-visible'].icone, ICONES.ocultar);

  // Feição visível: habilitado, rótulo "Ocultar", ícone ocultar
  const stVis = computeModifyState({ features: [makePoly('p1', { visible: true })] });
  assert.strictEqual(stVis['mod-visible'].disabled, false);
  assert.strictEqual(stVis['mod-visible'].rotulo, 'Ocultar');
  assert.strictEqual(stVis['mod-visible'].icone, ICONES.ocultar);

  // Todas ocultas: habilitado, rótulo "Mostrar", ícone mostrar
  const stHidden = computeModifyState({ features: [makePoly('p1', { visible: false }), makePoly('p2', { visible: false })] });
  assert.strictEqual(stHidden['mod-visible'].disabled, false);
  assert.strictEqual(stHidden['mod-visible'].rotulo, 'Mostrar');
  assert.strictEqual(stHidden['mod-visible'].icone, ICONES.mostrar);

  // Mista (1 oculta, 1 visível): prioridade é ocultar o resto -> "Ocultar"
  const stMixedVis = computeModifyState({ features: [makePoly('p1', { visible: false }), makePoly('p2', { visible: true })] });
  assert.strictEqual(stMixedVis['mod-visible'].disabled, false);
  assert.strictEqual(stMixedVis['mod-visible'].rotulo, 'Ocultar');
  assert.strictEqual(stMixedVis['mod-visible'].icone, ICONES.ocultar);
  console.log('  ✔ 2.2 Dinamismo de rótulo e ícone de mod-visible validado (Ocultar vs Mostrar).');
}

// =========================================================================
// SEÇÃO 3: Dropdown Dinâmico de Camadas (mod-layer)
// =========================================================================
console.log('\n▶ [SEÇÃO 3] Dropdown Dinâmico de Camadas (mod-layer)...');

{
  const f1 = makePoly('f1', { layerId: 'layer-lotes' });
  const f2 = makePoly('f2', { layerId: 'layer-lotes' });
  const f3 = makeLine('f3', { layerId: 'layer-vias' });

  // 3.1 Lista de filhos gerada a partir das camadas fornecidas
  const stLayers = computeModifyState({ features: [f1, f2], layers: mockLayers });
  const layerItem = stLayers['mod-layer'];
  assert(Array.isArray(layerItem.filhos), 'filhos deve ser um array');
  assert.strictEqual(layerItem.filhos.length, mockLayers.length, 'número de filhos igual ao de camadas');

  // Mapeamento de prefixos e identificadores
  assert.strictEqual(layerItem.filhos[0].id, `${MODIFY_LAYER_PREFIX}layer-lotes`);
  assert.strictEqual(layerItem.filhos[0].rotulo, 'Lotes Urbanos');
  assert.strictEqual(layerItem.filhos[0].tipo, 'botao');
  assert.strictEqual(layerItem.filhos[0].ativo, true, 'Lotes Urbanos está ativo porque f1 e f2 pertencem a ela');

  assert.strictEqual(layerItem.filhos[1].id, `${MODIFY_LAYER_PREFIX}layer-vias`);
  assert.strictEqual(layerItem.filhos[1].ativo, false, 'Sistema Viário não está ativo');

  // 3.2 Seleção heterogênea (feições em camadas diferentes)
  const stHetero = computeModifyState({ features: [f1, f3], layers: mockLayers });
  const layerItemHetero = stHetero['mod-layer'];
  assert(layerItemHetero.filhos.every(filho => filho.ativo === false), 'nenhuma camada deve ficar ativa em seleção heterogênea');
  console.log('  ✔ 3.1 & 3.2 Lista de filhos, prefixos e marcação ativa validadas.');
}

// =========================================================================
// SEÇÃO 4: BatchActions.moveToLayer
// =========================================================================
console.log('\n▶ [SEÇÃO 4] BatchActions.moveToLayer (Migração de Camada em Lote)...');

{
  const p1 = makePoly('p1', { layerId: 'layer-lotes', color: '#111111' });
  const p2 = makePoly('p2', { layerId: 'layer-lotes', color: '#222222' });
  const pLocked = makePoly('pLocked', { layerId: 'layer-lotes', locked: true });
  const app = createFakeApp([p1, p2, pLocked], mockLayers);

  // 4.1 Mover para camada existente sem inheritColor
  const res = BatchActions.moveToLayer(app, ['p1', 'p2', 'pLocked'], 'layer-vias');
  assert.strictEqual(res.changed, 2, '2 feições desbloqueadas movidas');
  assert.strictEqual(res.locked, 1, '1 feição bloqueada ignorada');
  assert.deepStrictEqual(res.ids, ['p1', 'p2']);

  // Verifica mutação correta no estado do app
  assert.strictEqual(app.features.find(f => f.id === 'p1').layerId, 'layer-vias');
  assert.strictEqual(app.features.find(f => f.id === 'p2').layerId, 'layer-vias');
  assert.strictEqual(app.features.find(f => f.id === 'pLocked').layerId, 'layer-lotes', 'feição travada manteve camada original');

  // Preservação de atributos e cores intactas
  assert.strictEqual(app.features.find(f => f.id === 'p1').properties.area_m2, 10000, 'atributos preservados');
  assert.strictEqual(app.features.find(f => f.id === 'p1').color, '#111111', 'cor própria preservada');

  // Histórico e gravação em lote
  assert.strictEqual(app.log.history.length, 1, 'exatamente 1 entrada de histórico gerada');
  assert.strictEqual(app.log.history[0], 'Mover para "Sistema Viário" (2)');
  assert.strictEqual(app.log.savedBulk.length, 1, 'exatamente 1 gravação saveFeaturesBulk');
  assert.strictEqual(app.log.refreshes, 1, 'exatamente 1 refresh no mapa e tabela');
  console.log('  ✔ 4.1 Migração de camada em lote com histórico atômico e salvaguarda de bloqueio validada.');

  // 4.2 Mover para a mesma camada sem inheritColor (operação sem efeito / idempotente)
  const resSame = BatchActions.moveToLayer(app, ['p1', 'p2'], 'layer-vias');
  assert.strictEqual(resSame.changed, 0, 'nenhuma feição alterada');
  assert.strictEqual(resSame.unchanged, 2, '2 identificadas como já na camada');
  assert.strictEqual(app.log.history.length, 1, 'nenhum histórico gravado para operação sem efeito');
  console.log('  ✔ 4.2 Idempotência: mover para a mesma camada não polui o histórico.');

  // 4.3 Opção inheritColor: adota a cor da camada de destino
  const p3 = makePoly('p3', { layerId: 'layer-lotes', color: '#111111' });
  const appInherit = createFakeApp([p3], mockLayers);
  const targetLayer = mockLayers.find(l => l.id === 'layer-reserva');
  const resInherit = BatchActions.moveToLayer(appInherit, ['p3'], 'layer-reserva', { inheritColor: true });
  assert.strictEqual(resInherit.changed, 1);
  const p3Updated = appInherit.features.find(f => f.id === 'p3');
  assert.strictEqual(p3Updated.layerId, 'layer-reserva');
  assert.strictEqual(p3Updated.style.fillColor, targetLayer.color, 'fillColor herdou cor da camada de destino');
  assert.strictEqual(p3Updated.style.strokeColor, targetLayer.color, 'strokeColor herdou cor da camada de destino');
  console.log('  ✔ 4.3 Opção inheritColor aplica cor da camada de destino com sucesso.');

  // 4.4 Tratamento de erro com camada inexistente
  const resInvalid = BatchActions.moveToLayer(app, ['p1'], 'layer-fantasma');
  assert.strictEqual(resInvalid.changed, 0);
  assert(resInvalid.error.includes('não encontrada'), 'retorna erro amigável sem lançar exceção');
  console.log('  ✔ 4.4 Camada inexistente tratada graciosamente sem exception.');
}

// =========================================================================
// SEÇÃO 5: BatchActions.invertColors
// =========================================================================
console.log('\n▶ [SEÇÃO 5] BatchActions.invertColors (Inversão de Cores)...');

{
  const p1 = makePoly('p1', {
    color: '#10b981',
    style: { fillColor: '#10b981', strokeColor: '#ffffff' }
  });
  const pIdentical = makePoly('pIdentical', {
    color: '#333333',
    style: { fillColor: '#333333', strokeColor: '#333333' }
  });
  const line1 = makeLine('line1', {
    color: '#f59e0b',
    style: { strokeColor: '#f59e0b' }
  });
  const text1 = makeText('text1', {
    style: { textColor: '#000000' }
  });
  const pLocked = makePoly('pLocked', {
    color: '#ff0000',
    locked: true,
    style: { fillColor: '#ff0000', strokeColor: '#ffffff' }
  });

  const app = createFakeApp([p1, pIdentical, line1, text1, pLocked], mockLayers);

  const res = BatchActions.invertColors(app, ['p1', 'pIdentical', 'line1', 'text1', 'pLocked']);
  assert.strictEqual(res.changed, 1, 'apenas p1 deve ser invertido');
  assert.strictEqual(res.locked, 1, 'pLocked ignorado por estar bloqueado');
  assert.strictEqual(res.unchanged, 3, 'pIdentical, line1 e text1 não alterados');
  assert.deepStrictEqual(res.ids, ['p1']);

  const p1Updated = app.features.find(f => f.id === 'p1');
  assert.strictEqual(p1Updated.style.fillColor, '#ffffff', 'fillColor recebeu o antigo strokeColor');
  assert.strictEqual(p1Updated.style.strokeColor, '#10b981', 'strokeColor recebeu o antigo fillColor');
  assert.strictEqual(p1Updated.color, '#ffffff', 'd.color acompanha o novo preenchimento');

  // Verifica que feições não aplicáveis permaneceram 100% inalteradas
  const line1After = app.features.find(f => f.id === 'line1');
  assert.strictEqual(line1After.style.strokeColor, '#f59e0b', 'linha mantida intacta');
  const pLockedAfter = app.features.find(f => f.id === 'pLocked');
  assert.strictEqual(pLockedAfter.style.fillColor, '#ff0000', 'bloqueada mantida intacta');

  assert.strictEqual(app.log.history.length, 1, '1 entrada de histórico gerada');
  assert.strictEqual(app.log.history[0], 'Inverter cores (1)');
  console.log('  ✔ 5.1 Inversão correta de cores e exclusão de Linhas, Textos e cores iguais validada.');
}

// =========================================================================
// SEÇÃO 6: Tratamento de Seleções Mistas e Salvaguarda de Bloqueio (Regra 6)
// =========================================================================
console.log('\n▶ [SEÇÃO 6] Tratamento de Seleções Mistas e Salvaguarda de Bloqueio (Regra 6 do GEMINI.md)...');

{
  const pFree = makePoly('pFree', { locked: false, color: '#aaaaaa', style: { fillColor: '#aaaaaa' } });
  const pLocked = makePoly('pLocked', { locked: true, color: '#bbbbbb', style: { fillColor: '#bbbbbb' } });
  const app = createFakeApp([pFree, pLocked], mockLayers);

  // 6.1 BatchActions.applyColors pula bloqueadas
  BatchActions.applyColors(app, ['pFree', 'pLocked'], { fillColor: '#0000ff' });
  assert.strictEqual(app.features.find(f => f.id === 'pFree').style.fillColor, '#0000ff');
  assert.strictEqual(app.features.find(f => f.id === 'pLocked').style.fillColor, '#bbbbbb', 'bloqueada NÃO teve cor alterada');
  console.log('  ✔ 6.1 applyColors respeita locked: true.');

  // 6.2 BatchActions.setVisible pula bloqueadas
  BatchActions.setVisible(app, ['pFree', 'pLocked'], false);
  assert.strictEqual(app.features.find(f => f.id === 'pFree').visible, false);
  assert.strictEqual(app.features.find(f => f.id === 'pLocked').visible, undefined, 'bloqueada NÃO teve visibilidade alterada');
  console.log('  ✔ 6.2 setVisible respeita locked: true.');

  // 6.3 BatchActions.setLocked opera com precisão
  // Bloquear pFree
  BatchActions.setLocked(app, ['pFree'], true);
  assert.strictEqual(app.features.find(f => f.id === 'pFree').locked, true);

  // Agora ambas estão bloqueadas. Desbloquear ambas:
  const resUnlock = BatchActions.setLocked(app, ['pFree', 'pLocked'], false);
  assert.strictEqual(resUnlock.changed, 2, 'ambas foram desbloqueadas');
  assert.strictEqual(app.features.find(f => f.id === 'pFree').locked, false);
  assert.strictEqual(app.features.find(f => f.id === 'pLocked').locked, false);
  console.log('  ✔ 6.3 setLocked alterna bloqueio/desbloqueio sem perda de dados.');
}

// =========================================================================
// SEÇÃO 7: Regra de Ocultar vs Excluir (Regra 2 do GEMINI.md)
// =========================================================================
console.log('\n▶ [SEÇÃO 7] Regra de Ocultar vs Excluir (Regra 2 do GEMINI.md)...');

{
  const p1 = makePoly('p1', { visible: true });
  const p2 = makePoly('p2', { visible: true });
  const app = createFakeApp([p1, p2], mockLayers);

  // 7.1 Ocultar feição em lote
  const resHide = BatchActions.setVisible(app, ['p1'], false);
  assert.strictEqual(resHide.changed, 1);
  assert.strictEqual(app.features.find(f => f.id === 'p1').visible, false);

  // Verificações vitais de conformidade com GEMINI.md:
  assert.strictEqual(app.log.deletedBulk.length, 0, 'removeFeaturesBulk NUNCA deve ser chamado ao ocultar');
  // O olhinho é preferência local: não grava em lote (nuvem) — vai só para FeatureVisibility
  assert.strictEqual(app.log.savedBulk.length, 0, 'ocultar não envia nada à nuvem (saveFeaturesBulk não é chamado)');
  assert.strictEqual(FeatureVisibility.isHidden(app.projectId, 'p1'), true, 'ocultação registrada localmente');
  assert.strictEqual(app.features.length, 2, 'feição oculta CONTINUA existindo no array de features do app');

  const p1Draft = app.features.find(f => f.id === 'p1');
  assert.strictEqual(p1Draft.is_deleted, undefined, 'is_deleted não é setado');
  assert.strictEqual(p1Draft._deleted, undefined, '_deleted não é setado');
  assert.strictEqual(p1Draft.deleted_at, undefined, 'deleted_at não é setado');
  console.log('  ✔ 7.1 Ocultar não exclui e não gera tombstones no estado local.');

  // 7.2 Tradução no CanvasMapEngine: visible:false vira oculta: true
  const engine = Object.create(CanvasMapEngine.prototype);
  const kitFeatVisible = engine._toFeicao(p2, mockLayers[0]);
  assert.strictEqual(kitFeatVisible.oculta, undefined, 'feição visível não tem campo oculta');
  assert.strictEqual(kitFeatVisible.excluida, false, 'feição visível não é excluída');

  const kitFeatHidden = engine._toFeicao(p1Draft, mockLayers[0]);
  assert.strictEqual(kitFeatHidden.oculta, true, 'visible:false vira oculta: true no componente');
  assert.strictEqual(kitFeatHidden.excluida, false, 'feição oculta tem excluida: false');

  // Comparação com exclusão real
  const deletedFeat = { ...p1, is_deleted: true };
  const kitFeatDeleted = engine._toFeicao(deletedFeat, mockLayers[0]);
  assert.strictEqual(kitFeatDeleted.excluida, true, 'feição com is_deleted vira excluida: true');
  console.log('  ✔ 7.2 CanvasMapEngine mapeia visible:false -> oculta: true e is_deleted -> excluida: true.');
}

// =========================================================================
// SEÇÃO 8: SelectionStyleController e Seletor de Cores
// =========================================================================
console.log('\n▶ [SEÇÃO 8] SelectionStyleController e Seletor de Cores...');

{
  const p1 = makePoly('p1', {
    color: '#00E08A',
    style: { fillColor: '#00E08A', strokeColor: '#ffffff', strokeWidth: 2, fillOpacity: 0.4 }
  });
  const p2 = makePoly('p2', {
    color: '#38bdf8',
    style: { fillColor: '#38bdf8', strokeColor: '#1e293b', strokeWidth: 1, fillOpacity: 0.8 }
  });
  const app = createFakeApp([p1, p2], mockLayers);
  app.selectionHUD.selectedFeatures = [p1, p2];

  let mockPickerHandle = null;
  let mockPickerOpts = null;

  // Mock de abrirSeletorCor do kit
  const fakeAbrirSeletor = (options) => {
    mockPickerOpts = options;
    mockPickerHandle = {
      elemento: {
        obterEstado: () => ({
          preenchimento: options.preenchimento,
          traco: options.traco,
          opacidade: options.opacidade,
          espessuraTraco: options.espessuraTraco
        })
      }
    };
    return mockPickerHandle;
  };

  // 8.1 Abertura do seletor para seleção múltipla
  const handle = SelectionStyleController.openStylePicker(app, [p1, p2], null, fakeAbrirSeletor);
  assert(handle !== null, 'seletor aberto com sucesso');
  assert.strictEqual(mockPickerOpts.titulo, 'Estilo em Lote (2)');
  assert.strictEqual(mockPickerOpts.misto, true, 'detectou seleção mista de cores');
  console.log('  ✔ 8.1 Abertura com título inteligente e flag misto=true validada.');

  // 8.2 Pré-visualização ao vivo (aoAlterar) não grava no histórico nem altera app.features
  mockPickerOpts.aoAlterar({
    preenchimento: '#f43f5e',
    traco: '#ffffff',
    opacidade: 0.4,
    espessuraTraco: 2
  });
  assert.strictEqual(app.mapEngine.updatedFeatures.length, 2, 'mapEngine.updateFeature chamado para preview das 2 feições');
  assert.strictEqual(app.log.history.length, 0, 'preview NÃO grava histórico');
  assert.strictEqual(app.features[0].style.fillColor, '#00E08A', 'app.features intacto durante preview');
  console.log('  ✔ 8.2 Prévia ao vivo reativa sem poluição de histórico validada.');

  // 8.3 Cancelamento (aoCancelar): desfaz preview e restaura mapa
  app.mapEngine.updatedFeatures = [];
  mockPickerOpts.aoCancelar();
  assert.strictEqual(app.mapEngine.updatedFeatures.length, 2, 'mapEngine.updateFeature chamado para restaurar versão original');
  assert.strictEqual(app._stylePreviewIds, null, 'ids de preview limpos');
  console.log('  ✔ 8.3 Cancelamento reverte preview com sucesso.');

  // 8.4 Confirmação (aoConfirmar): grava APENAS o que mudou (1 histórico, lote)
  mockPickerOpts.aoConfirmar({
    preenchimento: '#8b5cf6', // mudou
    traco: '#ffffff',        // igual
    opacidade: 0.4,          // igual
    espessuraTraco: 2        // igual
  });
  assert.strictEqual(app.log.history.length, 1, 'exatamente 1 histórico após confirmação');
  assert.strictEqual(app.features[0].style.fillColor, '#8b5cf6', 'p1 atualizado');
  assert.strictEqual(app.features[1].style.fillColor, '#8b5cf6', 'p2 atualizado');
  // strokeColor de p2 deve ter sido PRESERVADO (#1e293b), pois só o preenchimento mudou no seletor!
  assert.strictEqual(app.features[1].style.strokeColor, '#1e293b', 'strokeColor original de p2 preservado em seleção mista');
  console.log('  ✔ 8.4 Confirmação atômica gravando somente propriedades modificadas validada.');
}

// =========================================================================
// SEÇÃO 9: Roteamento de Comandos via ModifyActionsController.run
// =========================================================================
console.log('\n▶ [SEÇÃO 9] Roteamento de Comandos via ModifyActionsController.run...');

{
  const p1 = makePoly('p1', { layerId: 'layer-lotes', locked: false, visible: true });
  const app = createFakeApp([p1], mockLayers);
  app.selectionHUD.selectedFeatures = [p1];

  // 9.1 Roteamento de mod-layer:<id>
  ModifyActionsController.run(app, `${MODIFY_LAYER_PREFIX}layer-vias`);
  assert.strictEqual(app.features[0].layerId, 'layer-vias', 'mod-layer:<id> migrou feição selecionada');
  assert.strictEqual(app.log.history.length, 1);

  // 9.2 Roteamento de mod-visible em feição desbloqueada
  ModifyActionsController.run(app, 'mod-visible');
  assert.strictEqual(app.features[0].visible, false, 'mod-visible ocultou a feição');
  assert.strictEqual(app.log.history.length, 2);

  // Reexibe feição com mod-visible
  ModifyActionsController.run(app, 'mod-visible');
  assert.strictEqual(app.features[0].visible, true, 'mod-visible reexibiu a feição');
  assert.strictEqual(app.log.history.length, 3);

  // 9.3 Roteamento de mod-lock (bloquear e desbloquear)
  ModifyActionsController.run(app, 'mod-lock');
  assert.strictEqual(app.features[0].locked, true, 'mod-lock bloqueou a feição');
  assert.strictEqual(app.log.history.length, 4);

  // Salvaguarda: mod-visible em feição bloqueada é ignorado por BatchActions.setVisible
  ModifyActionsController.run(app, 'mod-visible');
  assert.strictEqual(app.features[0].visible, true, 'feição bloqueada NÃO tem visibilidade alterada');

  // Desbloqueia com mod-lock
  ModifyActionsController.run(app, 'mod-lock');
  assert.strictEqual(app.features[0].locked, false, 'mod-lock desbloqueou a feição');

  // 9.4 Roteamento de mod-invert
  app.features[0].style.fillColor = '#111111';
  app.features[0].style.strokeColor = '#999999';
  ModifyActionsController.run(app, 'mod-invert');
  assert.strictEqual(app.features[0].style.fillColor, '#999999');
  assert.strictEqual(app.features[0].style.strokeColor, '#111111');

  // 9.5 Feedback visual via UIToast ao mover seleção mista com feições bloqueadas
  const { UIToast } = await import('@thibezer/ui-components-kit');
  const toasts = [];
  const origNotificar = UIToast.notificar;
  UIToast.notificar = (t) => toasts.push(t);
  try {
    const pFree = makePoly('pFree', { layerId: 'layer-lotes', locked: false });
    const pLocked = makePoly('pLocked', { layerId: 'layer-lotes', locked: true });
    const appMixed = createFakeApp([pFree, pLocked], mockLayers);
    appMixed.selectionHUD.selectedFeatures = [pFree, pLocked];

    ModifyActionsController.run(appMixed, `${MODIFY_LAYER_PREFIX}layer-vias`);
    assert.strictEqual(appMixed.features[0].layerId, 'layer-vias', 'pFree movida');
    assert.strictEqual(appMixed.features[1].layerId, 'layer-lotes', 'pLocked mantida intacta');
    assert.strictEqual(toasts.length, 1, 'toast emitido quando há feições bloqueadas');
    assert.strictEqual(toasts[0].tipo, 'alerta');
    assert.ok(toasts[0].mensagem.includes('bloqueada(s) foram ignoradas'));
  } finally {
    UIToast.notificar = origNotificar;
  }

  console.log('  ✔ 9.1 - 9.5 Roteamento e feedback de aviso no ModifyActionsController.run validados.');
}

console.log('\n=================================================================');
console.log('🎉 TODOS OS TESTES DE AUDITORIA DO AGENTE 3 PASSARAM COM SUCESSO!');
console.log('=================================================================');
