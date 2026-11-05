/* ==========================================================================
   ConecteMapas - Auditoria Automatizada do Agente 1
   Especialista em Seleção, Inspeção e Navegação (Aba Modificar)
   Testes: Habilitação, GeoFormats (GeoJSON RFC 7946 & WKT ISO 19107), Resiliência,
   Área de Transferência, Métodos de Zoom/Inspetor/Tabela/Popup e Histórico Undo/Redo.
   ========================================================================== */

import assert from 'assert';
import { buildModifyTab, computeModifyState } from '../src/components/ModifyRibbon.js';
import { ModifyActionsController } from '../src/controllers/ModifyActionsController.js';
import { ShortcutsController } from '../src/controllers/ShortcutsController.js';
import { GeoFormats } from '../src/services/GeoFormats.js';
import { UIToast } from '@thibezer/ui-components-kit';

console.log('🔍 Iniciando Auditoria Completa do Agente 1 (Seleção, Inspeção e Navegação)...');

// Helper de criação de feições de teste
const makePoint = (id, lat = -23.5505, lng = -46.6333, extra = {}) => ({
  id,
  type: 'Point',
  name: `Ponto ${id}`,
  layerId: 'layer-topografia',
  coordinates: [lat, lng],
  color: '#00E08A',
  ...extra
});

const makeLine = (id, coords = [[-23.5505, -46.6333], [-23.5515, -46.6343]], extra = {}) => ({
  id,
  type: 'LineString',
  name: `Linha ${id}`,
  layerId: 'layer-topografia',
  coordinates: coords,
  color: '#38bdf8',
  ...extra
});

const makePolygon = (id, coords = [[-23.55, -46.63], [-23.55, -46.64], [-23.56, -46.64], [-23.56, -46.63]], extra = {}) => ({
  id,
  type: 'Polygon',
  name: `Polígono ${id}`,
  layerId: 'layer-topografia',
  coordinates: coords,
  color: '#f59e0b',
  ...extra
});

const makeCircle = (id, lat = -23.55, lng = -46.63, radius = 250, extra = {}) => ({
  id,
  type: 'Circle',
  name: `Círculo ${id}`,
  layerId: 'layer-topografia',
  coordinates: [lat, lng],
  radius,
  color: '#ec4899',
  ...extra
});

const makeText = (id, lat = -23.55, lng = -46.63, text = 'Anotação Cadastral', extra = {}) => ({
  id,
  type: 'Text',
  name: `Texto ${id}`,
  layerId: 'layer-topografia',
  coordinates: [lat, lng],
  text,
  properties: { text },
  color: '#ffffff',
  ...extra
});

const testLayers = [
  { id: 'layer-topografia', name: 'Topografia', visible: true, locked: false, color: '#00E08A' },
  { id: 'layer-lotes', name: 'Lotes Urbanos', visible: true, locked: false, color: '#38bdf8' }
];

// ============================================================================
// 1. Auditoria de Definição e Habilitação de Botões (ModifyRibbon)
// ============================================================================
console.log('\n--- 1. Validação de Habilitação de Botões na Aba Modificar ---');
{
  const tab = buildModifyTab();
  const allItems = tab.grupos.flatMap(g => g.itens);
  const byId = new Map(allItems.map(i => [i.id, i]));

  // Validar presença de todas as 11 ferramentas sob responsabilidade do Agente 1
  const expectedTools = [
    'mod-select-all', 'mod-lasso', 'mod-clear', 'mod-zoom',
    'mod-inspect', 'mod-table', 'mod-popup', 'mod-copy',
    'mod-undo', 'mod-redo', 'mod-fit'
  ];

  for (const toolId of expectedTools) {
    assert(byId.has(toolId), `Ferramenta ${toolId} deve estar presente na ribbon Modificar`);
  }

  // Conferir subitens de cópia
  const copyTool = byId.get('mod-copy');
  assert(Array.isArray(copyTool.filhos), 'mod-copy deve possuir menu com filhos');
  const copySubIds = copyTool.filhos.map(f => f.id);
  assert(copySubIds.includes('mod-copy-geojson'), 'Deve incluir mod-copy-geojson');
  assert(copySubIds.includes('mod-copy-wkt'), 'Deve incluir mod-copy-wkt');
  assert(copySubIds.includes('mod-copy-coords'), 'Deve incluir mod-copy-coords');

  // Validar atalhos de teclado declarados na UI
  assert.strictEqual(byId.get('mod-select-all').atalho, 'Ctrl+A');
  assert.strictEqual(byId.get('mod-lasso').atalho, 'Q');
  assert.strictEqual(byId.get('mod-clear').atalho, 'Esc');
  assert.strictEqual(byId.get('mod-undo').atalho, 'Ctrl+Z');
  assert.strictEqual(byId.get('mod-redo').atalho, 'Ctrl+Y');
  assert.strictEqual(byId.get('mod-fit').atalho, 'Z');

  // 1.1 Cenário: Sem seleção (features = [])
  const stEmpty = computeModifyState({ features: [], layers: testLayers, history: { undo: 0, redo: 0 } });
  assert.strictEqual(stEmpty['mod-select-all'].disabled, false, 'Selecionar tudo sempre habilitado');
  assert.strictEqual(stEmpty['mod-lasso'].disabled, false, 'Laço sempre habilitado para ativar');
  assert.strictEqual(stEmpty['mod-clear'].disabled, true, 'Limpar desabilitado sem seleção');
  assert.strictEqual(stEmpty['mod-zoom'].disabled, true, 'Zoom seleção desabilitado sem seleção');
  assert.strictEqual(stEmpty['mod-inspect'].disabled, true, 'Inspetor desabilitado sem seleção');
  assert.strictEqual(stEmpty['mod-table'].disabled, true, 'Tabela desabilitada sem seleção');
  assert.strictEqual(stEmpty['mod-popup'].disabled, true, 'Popup balão desabilitado sem seleção');
  assert.strictEqual(stEmpty['mod-copy'].disabled, true, 'Copiar desabilitado sem seleção');
  assert.strictEqual(stEmpty['mod-copy-geojson'].disabled, true, 'Copiar GeoJSON desabilitado sem seleção');
  assert.strictEqual(stEmpty['mod-copy-wkt'].disabled, true, 'Copiar WKT desabilitado sem seleção');
  assert.strictEqual(stEmpty['mod-copy-coords'].disabled, true, 'Copiar coordenadas desabilitado sem seleção');
  assert.strictEqual(stEmpty['mod-undo'].disabled, true, 'Undo desabilitado com histórico vazio');
  assert.strictEqual(stEmpty['mod-redo'].disabled, true, 'Redo desabilitado com histórico vazio');
  assert.strictEqual(stEmpty['mod-fit'].disabled, false, 'Enquadrar tudo sempre disponível');

  // 1.2 Cenário: Seleção única (features = [p1])
  const p1 = makePoint('p1');
  const stSingle = computeModifyState({ features: [p1], layers: testLayers, history: { undo: 2, redo: 1 } });
  assert.strictEqual(stSingle['mod-select-all'].disabled, false);
  assert.strictEqual(stSingle['mod-lasso'].disabled, false);
  assert.strictEqual(stSingle['mod-clear'].disabled, false, 'Limpar ativo com 1 feição');
  assert.strictEqual(stSingle['mod-zoom'].disabled, false, 'Zoom ativo com 1 feição');
  assert.strictEqual(stSingle['mod-inspect'].disabled, false, 'Inspetor ativo com 1 feição');
  assert.strictEqual(stSingle['mod-table'].disabled, false, 'Tabela ativa com 1 feição');
  assert.strictEqual(stSingle['mod-popup'].disabled, false, 'Popup ativo com 1 feição');
  assert.strictEqual(stSingle['mod-copy'].disabled, false, 'Copiar ativo com 1 feição');
  assert.strictEqual(stSingle['mod-copy-geojson'].disabled, false, 'Copiar GeoJSON ativo');
  assert.strictEqual(stSingle['mod-copy-wkt'].disabled, false, 'Copiar WKT ativo para feição única');
  assert.strictEqual(stSingle['mod-copy-coords'].disabled, false, 'Copiar Coordenadas ativo para feição única');
  assert.strictEqual(stSingle['mod-undo'].disabled, false, 'Undo habilitado com undo > 0');
  assert.strictEqual(stSingle['mod-redo'].disabled, false, 'Redo habilitado com redo > 0');

  // 1.3 Cenário: Seleção múltipla (features = [p1, p2])
  const p2 = makePoint('p2');
  const stMulti = computeModifyState({ features: [p1, p2], layers: testLayers, history: { undo: 1, redo: 0 } });
  assert.strictEqual(stMulti['mod-clear'].disabled, false, 'Limpar ativo com seleção múltipla');
  assert.strictEqual(stMulti['mod-zoom'].disabled, false, 'Zoom seleção ativo com seleção múltipla');
  assert.strictEqual(stMulti['mod-table'].disabled, false, 'Tabela de atributos ativa com seleção múltipla');
  assert.strictEqual(stMulti['mod-copy'].disabled, false, 'Copiar ativo com seleção múltipla');
  assert.strictEqual(stMulti['mod-copy-geojson'].disabled, false, 'GeoJSON ativo com seleção múltipla');
  // Apenas seleção única permite inspeção lateral individual, balão de popup e cópia de WKT/Coords diretas
  assert.strictEqual(stMulti['mod-inspect'].disabled, true, 'Inspetor desabilitado para múltiplas feições');
  assert.strictEqual(stMulti['mod-popup'].disabled, true, 'Popup balão desabilitado para múltiplas feições');
  assert.strictEqual(stMulti['mod-copy-wkt'].disabled, true, 'WKT desabilitado para múltiplas feições');
  assert.strictEqual(stMulti['mod-copy-coords'].disabled, true, 'Coords desabilitado para múltiplas feições');

  // 1.4 Ativação de ferramenta visual (ex: laço ativo)
  const stLassoActive = computeModifyState({ features: [], activeTool: 'pen-select' });
  assert.strictEqual(stLassoActive['mod-lasso'].ativo, true, 'Laço com ativo: true quando tool for pen-select');
  const stLassoInactive = computeModifyState({ features: [], activeTool: 'select' });
  assert.strictEqual(stLassoInactive['mod-lasso'].ativo, false, 'Laço com ativo: false quando tool for select');

  console.log('✔ Todas as matrizes de habilitação e estados visuais passaram com sucesso!');
}

// ============================================================================
// 2. Auditoria de Exportação de GeoFormats (GeoJSON RFC 7946 & WKT ISO 19107)
// ============================================================================
console.log('\n--- 2. Validação de GeoFormats (GeoJSON RFC 7946 e WKT ISO 19107) ---');
{
  const pt = makePoint('p1', -23.55052, -46.63331);
  const line = makeLine('l1', [[-23.5505, -46.6333], [-23.5515, -46.6343]]);
  const poly = makePolygon('pg1', [[-23.550, -46.630], [-23.550, -46.635], [-23.555, -46.635], [-23.555, -46.630]]);
  const polyHoles = {
    id: 'ph1',
    type: 'Polygon',
    name: 'Gleba com Ilha/Furo',
    coordinates: [
      [[-23.550, -46.630], [-23.550, -46.640], [-23.560, -46.640], [-23.560, -46.630]],
      [[-23.552, -46.632], [-23.552, -46.638], [-23.558, -46.638], [-23.558, -46.632]]
    ]
  };
  const circ = makeCircle('c1', -23.55, -46.63, 150);
  const txt = makeText('t1', -23.5501, -46.6302, 'Marco Geodésico M-01');

  // 2.1 WKT para todos os 5 tipos de feição
  const wktPt = GeoFormats.toWKT(pt);
  assert(wktPt.startsWith('POINT('), `WKT Point deve ser POINT: ${wktPt}`);
  assert(wktPt.includes('-46.63331 -23.55052'), 'Ordem WKT deve ser X (lng) Y (lat)');

  const wktLine = GeoFormats.toWKT(line);
  assert(wktLine.startsWith('LINESTRING('), `WKT LineString deve ser LINESTRING: ${wktLine}`);
  assert(wktLine.includes('-46.6333 -23.5505, -46.6343 -23.5515'), 'Vértices formatados com separador');

  const wktPoly = GeoFormats.toWKT(poly);
  assert(wktPoly.startsWith('POLYGON(('), `WKT Polygon deve ter anéis duplos: ${wktPoly}`);
  assert(wktPoly.endsWith('))'), 'WKT Polygon deve fechar parênteses');

  const wktPolyHoles = GeoFormats.toWKT(polyHoles);
  assert(wktPolyHoles.startsWith('POLYGON(('), 'WKT com furos deve ser POLYGON');
  assert(wktPolyHoles.includes('), ('), 'Anéis externo e interno devem ser separados por ), (');

  const wktCirc = GeoFormats.toWKT(circ);
  assert(wktCirc.startsWith('POINT(') && wktCirc.includes('/* BUFFER 150m */'), `WKT Círculo deve ter centro e comentário: ${wktCirc}`);

  const wktTxt = GeoFormats.toWKT(txt);
  assert(wktTxt.startsWith('POINT(') && wktTxt.includes('Marco Geodésico M-01'), `WKT Text deve ser POINT anotado: ${wktTxt}`);

  // 2.2 GeoJSON RFC 7946 para todos os 5 tipos
  const rawJson = GeoFormats.toGeoJSON([pt, line, poly, polyHoles, circ, txt]);
  const parsed = JSON.parse(rawJson);

  assert.strictEqual(parsed.type, 'FeatureCollection', 'Raiz deve ser FeatureCollection');
  assert.strictEqual(parsed.features.length, 6, 'Deve conter 6 feições');

  // Validar coordenadas [lng, lat] em conformidade com RFC 7946 seção 3.1.1
  const featPt = parsed.features.find(f => f.id === 'p1');
  assert.strictEqual(featPt.geometry.type, 'Point');
  assert.strictEqual(featPt.geometry.coordinates[0], -46.63331, 'GeoJSON X deve ser lng');
  assert.strictEqual(featPt.geometry.coordinates[1], -23.55052, 'GeoJSON Y deve ser lat');

  const featLine = parsed.features.find(f => f.id === 'l1');
  assert.strictEqual(featLine.geometry.type, 'LineString');
  assert.strictEqual(featLine.geometry.coordinates[0][0], -46.6333);

  const featPoly = parsed.features.find(f => f.id === 'pg1');
  assert.strictEqual(featPoly.geometry.type, 'Polygon');
  const ring = featPoly.geometry.coordinates[0];
  const firstPt = ring[0];
  const lastPt = ring[ring.length - 1];
  assert.deepStrictEqual(firstPt, lastPt, 'Anel de polígono GeoJSON RFC 7946 DEVE ser fechado');

  const featPolyHoles = parsed.features.find(f => f.id === 'ph1');
  assert.strictEqual(featPolyHoles.geometry.coordinates.length, 2, 'Polígono com furo deve ter 2 anéis');

  const featCirc = parsed.features.find(f => f.id === 'c1');
  assert.strictEqual(featCirc.geometry.type, 'Point');
  assert.strictEqual(featCirc.properties.radius, 150);

  const featTxt = parsed.features.find(f => f.id === 't1');
  assert.strictEqual(featTxt.geometry.type, 'Point', 'Texto deve manter geometria pontual para GIS');
  assert.strictEqual(featTxt.properties.text, 'Marco Geodésico M-01', 'Propriedades do texto preservadas');

  console.log('✔ Validação GeoJSON RFC 7946 e WKT ISO 19107 passou com êxito!');
}

// ============================================================================
// 3. Auditoria de Resiliência contra Dados Corrompidos e Feições Sem Coordenadas
// ============================================================================
console.log('\n--- 3. Validação de Resiliência contra Dados Corrompidos ---');
{
  const corruptedFeatures = [
    { id: 'c-null', type: 'Point', name: 'Nulo', coordinates: null },
    { id: 'c-empty', type: 'Point', name: 'Vazio', coordinates: [] },
    { id: 'c-nan', type: 'Point', name: 'NaN', coordinates: [NaN, Infinity] },
    { id: 'c-incomplete', type: 'Point', name: 'Incompleto', coordinates: [-23.55] },
    { id: 'c-line-empty', type: 'LineString', name: 'Linha Vazia', coordinates: [] },
    { id: 'c-line-one', type: 'LineString', name: 'Linha Degenerada', coordinates: [[-23.55, -46.63]] },
    { id: 'c-poly-empty', type: 'Polygon', name: 'Polígono Vazio', coordinates: [] },
    { id: 'c-poly-deg', type: 'Polygon', name: 'Polígono < 3 pts', coordinates: [[-23.55, -46.63], [-23.56, -46.64]] }
  ];

  // 3.1 WKT nunca deve lançar exceção nem gerar POINT(undefined undefined)
  for (const feat of corruptedFeatures) {
    let wkt = '';
    assert.doesNotThrow(() => {
      wkt = GeoFormats.toWKT(feat);
    }, `toWKT não deve estourar com ${feat.id}`);
    assert.strictEqual(wkt, '', `Feição corrompida ${feat.id} deve retornar string vazia`);
  }

  // Objeto completamente nulo ou indefinido
  assert.strictEqual(GeoFormats.toWKT(null), '');
  assert.strictEqual(GeoFormats.toWKT(undefined), '');
  assert.strictEqual(GeoFormats.toWKT({}), '');

  // 3.2 GeoJSON não deve falhar nem lançar TypeError ao mapear feições sem coordenadas
  let jsonOutput = '';
  assert.doesNotThrow(() => {
    jsonOutput = GeoFormats.toGeoJSON(corruptedFeatures);
  }, 'toGeoJSON não deve estourar com lista de feições corrompidas');

  const parsed = JSON.parse(jsonOutput);
  assert.strictEqual(parsed.features.length, corruptedFeatures.length);
  for (const f of parsed.features) {
    assert.strictEqual(f.geometry, null, `Feição corrompida ${f.id} deve produzir geometry: null`);
  }

  // Lista com elementos nulos ou array vazio
  assert.doesNotThrow(() => {
    const res = GeoFormats.toGeoJSON([null, undefined, false]);
    assert.strictEqual(JSON.parse(res).features.length, 0);
  });

  console.log('✔ Resiliência absoluta contra dados corrompidos validada!');
}

// ============================================================================
// 4. Auditoria de Tratamento de Erros no Clipboard (Área de Transferência)
// ============================================================================
console.log('\n--- 4. Validação de Erros e Área de Transferência ---');
{
  const originalNav = globalThis.navigator;

  // 4.1 Navigator indefinido
  delete globalThis.navigator;
  let toastEmitted = null;
  const originalNotificar = UIToast.notificar;
  UIToast.notificar = (t) => { toastEmitted = t; };

  try {
    assert.doesNotThrow(() => {
      ModifyActionsController.copy('LINESTRING(0 0, 1 1)', 'Título', 'Mensagem');
    }, 'copy não deve lançar ReferenceError quando navigator não existir');
    assert.strictEqual(toastEmitted?.tipo, 'erro');
    assert(toastEmitted?.mensagem.includes('indisponível'), 'Deve avisar que clipboard está indisponível');

    // 4.2 Navigator sem writeText
    globalThis.navigator = { clipboard: {} };
    toastEmitted = null;
    ModifyActionsController.copy('LINESTRING(0 0, 1 1)', 'Título', 'Mensagem');
    assert.strictEqual(toastEmitted?.tipo, 'erro');

    // 4.3 Falha / Rejeição na Promise do writeText (ex: permissão negada)
    let rejected = false;
    globalThis.navigator = {
      clipboard: {
        writeText: () => new Promise((_, reject) => {
          rejected = true;
          reject(new Error('Permission denied'));
        })
      }
    };
    toastEmitted = null;
    ModifyActionsController.copy('POINT(0 0)', 'Título', 'Mensagem');
    assert(rejected, 'Deve invocar writeText');

    // Aguardar o microtask da promise rejeitada
    await new Promise(r => setTimeout(r, 10));
    assert.strictEqual(toastEmitted?.tipo, 'erro');
    assert(toastEmitted?.mensagem.includes('Não foi possível acessar'), 'Deve exibir toast de falha de permissão');

    // 4.4 Cópia de texto vazio ou inválido (não deve copiar nada vazio)
    toastEmitted = null;
    ModifyActionsController.copy('', 'Título', 'Mensagem');
    assert.strictEqual(toastEmitted?.tipo, 'alerta');
    assert(toastEmitted?.mensagem.includes('Nenhuma informação geométrica válida'), 'Deve avisar geometria vazia');
  } finally {
    globalThis.navigator = originalNav;
    UIToast.notificar = originalNotificar;
  }

  console.log('✔ Tratamento defensivo da área de transferência aprovado!');
}

// ============================================================================
// 5. Auditoria de Chamadas e Roteamento de Ações (Zoom, Popup, Inspetor, Tabela)
// ============================================================================
console.log('\n--- 5. Validação de Roteamento de Comandos (Zoom, Popup, Inspetor, Tabela) ---');
{
  const p1 = makePoint('feat-100');
  let zoomCalledWith = null;
  let popupCalledWith = null;
  let inspectCalledWith = null;
  let tableCalledWith = null;
  let clearCalled = false;
  let fitCalled = false;

  const mockApp = {
    features: [p1],
    selectionHUD: {
      selectedFeatures: [p1],
      onInspect: (f) => { inspectCalledWith = f; },
      onOpenTable: (feats) => { tableCalledWith = feats; }
    },
    mapEngine: {
      activeTool: 'select',
      zoomToFeatures: (feats) => { zoomCalledWith = feats; },
      openFeaturePopup: (id) => { popupCalledWith = id; },
      fitAllFeatures: () => { fitCalled = true; }
    },
    drawingToolbar: {
      onAction: (act) => {
        if (act === 'clear-selection') clearCalled = true;
        if (act === 'fit') fitCalled = true;
      }
    }
  };

  // 5.1 Zoom Seleção
  ModifyActionsController.run(mockApp, 'mod-zoom');
  assert.strictEqual(zoomCalledWith?.[0]?.id, 'feat-100', 'mod-zoom deve acionar zoomToFeatures com a seleção');

  // 5.2 Popup Balão
  ModifyActionsController.run(mockApp, 'mod-popup');
  assert.strictEqual(popupCalledWith, 'feat-100', 'mod-popup deve acionar openFeaturePopup com o id da feição');

  // 5.3 Inspetor com HUD montado
  ModifyActionsController.run(mockApp, 'mod-inspect');
  assert.strictEqual(inspectCalledWith?.id, 'feat-100', 'mod-inspect deve acionar onInspect');

  // 5.4 Tabela de Atributos com HUD montado
  ModifyActionsController.run(mockApp, 'mod-table');
  assert.strictEqual(tableCalledWith?.[0]?.id, 'feat-100', 'mod-table deve acionar onOpenTable');

  // 5.5 Limpar Seleção
  ModifyActionsController.run(mockApp, 'mod-clear');
  assert.strictEqual(clearCalled, true, 'mod-clear deve rotear para toolbar clear-selection');

  // 5.6 Enquadrar Tudo
  ModifyActionsController.run(mockApp, 'mod-fit');
  assert.strictEqual(fitCalled, true, 'mod-fit deve rotear para toolbar fit');

  // 5.7 Fallbacks resilientes quando app.selectionHUD for NULO
  let sidebarCollapsedSet = null;
  let selectedInLayerPanel = null;
  let tableToggled = false;
  let featureSelectedInTable = null;

  const mockAppNoHUD = {
    features: [p1],
    selectionHUD: null,
    layerPanel: {
      selectedFeature: p1,
      setSelectedFeature: (f, focus) => { selectedInLayerPanel = f; },
      setSidebarCollapsed: (c) => { sidebarCollapsedSet = c; }
    },
    attributeTable: {
      isCollapsed: true,
      toggleCollapse: () => { tableToggled = true; },
      selectFeature: (id) => { featureSelectedInTable = id; }
    }
  };

  ModifyActionsController.run(mockAppNoHUD, 'mod-inspect');
  assert.strictEqual(selectedInLayerPanel?.id, 'feat-100', 'Fallback do inspetor deve selecionar feição no painel');
  assert.strictEqual(sidebarCollapsedSet, false, 'Fallback do inspetor deve abrir barra lateral');

  ModifyActionsController.run(mockAppNoHUD, 'mod-table');
  assert.strictEqual(tableToggled, true, 'Fallback da tabela deve expandir tabela fechada');
  assert.strictEqual(featureSelectedInTable, 'feat-100', 'Fallback da tabela deve selecionar feição na tabela');

  console.log('✔ Roteamento e fallbacks resilientes de todos os métodos verificados!');
}

// ============================================================================
// 6. Auditoria de Histórico Undo/Redo e Atalhos Globais
// ============================================================================
console.log('\n--- 6. Validação do Histórico Undo/Redo e Atalhos Globais ---');
{
  const p1 = makePoint('f1');
  const p2 = makePoint('f2');

  const appState = {
    features: [p1],
    layers: testLayers,
    historyUndo: [],
    historyRedo: [],
    refreshMapAndTable: () => {},
    saveMetadata: () => {}
  };

  // 6.1 Histórico vazio não lança erro
  let toastMsg = null;
  const originalNotificar = UIToast.notificar;
  UIToast.notificar = (t) => { toastMsg = t; };

  try {
    ShortcutsController.undo(appState);
    assert.strictEqual(toastMsg?.titulo, 'Nada para desfazer');

    ShortcutsController.redo(appState);
    assert.strictEqual(toastMsg?.titulo, 'Nada para refazer');

    // 6.2 Resiliência se historyUndo / historyRedo forem nulos ou undefined
    delete appState.historyUndo;
    delete appState.historyRedo;
    assert.doesNotThrow(() => ShortcutsController.undo(appState));
    assert.doesNotThrow(() => ShortcutsController.redo(appState));

    // 6.3 Ciclo completo de Push -> Undo -> Redo seguindo o fluxo canônico
    appState.historyUndo = [];
    appState.historyRedo = [];

    // O usuário vai adicionar a feição p2: pushHistory é chamado ANTES da mutação (FeatureSyncController padrão)
    ShortcutsController.pushHistory(appState, 'Criação de f2');
    assert.strictEqual(appState.historyUndo.length, 1);

    // Aplica a criação de f2
    appState.features = [p1, p2];
    assert.strictEqual(appState.features.length, 2);

    // Passo Undo: desfaz a criação -> Volta para [p1]
    ShortcutsController.undo(appState);
    assert.strictEqual(appState.features.length, 1, 'Após Undo deve ter 1 feição');
    assert.strictEqual(appState.features[0].id, 'f1');
    assert.strictEqual(appState.historyRedo.length, 1, 'Redo deve conter 1 passo');

    // Passo Redo: refaz a criação -> Restaura [p1, p2]
    ShortcutsController.redo(appState);
    assert.strictEqual(appState.features.length, 2, 'Após Redo deve ter 2 feições');
    assert.strictEqual(appState.historyRedo.length, 0, 'Redo consumido');
    assert.strictEqual(appState.historyUndo.length, 1, 'Undo recuperado após redo');

    // 6.4 Atalho Ctrl+A (selectAll)
    let selectedIdsMap = null;
    let selectedFeatsPanel = null;
    const mockMapApp = {
      features: [
        makePoint('v1', -23.55, -46.63, { visible: true }),
        makePoint('v2', -23.56, -46.64, { visible: false }), // oculta
        makePoint('v3', -23.57, -46.65, { visible: true, layerId: 'layer-hidden' })
      ],
      layers: [
        { id: 'layer-topografia', visible: true },
        { id: 'layer-hidden', visible: false } // camada oculta
      ],
      mapEngine: {
        selectFeatures: (ids) => { selectedIdsMap = ids; }
      },
      layerPanel: {
        setSelectedFeatures: (feats) => { selectedFeatsPanel = feats; }
      }
    };

    ShortcutsController.selectAll(mockMapApp);
    assert.deepStrictEqual(selectedIdsMap, ['v1'], 'Apenas feição v1 é visível em camada visível');
    assert.strictEqual(selectedFeatsPanel.length, 1);
    assert.strictEqual(selectedFeatsPanel[0].id, 'v1');

    // 6.5 Atalho Esc (clearSelectionOnEscape)
    let mapCleared = false;
    let panelCleared = false;
    let hudHidden = false;
    const mockEscApp = {
      mapEngine: { clearSelection: () => { mapCleared = true; } },
      layerPanel: { setSelectedFeatures: () => { panelCleared = true; }, updateContent: () => {} },
      selectionHUD: { hide: () => { hudHidden = true; } }
    };
    ShortcutsController.clearSelectionOnEscape(mockEscApp);
    assert.strictEqual(mapCleared, true, 'Esc deve desmarcar mapa');
    assert.strictEqual(panelCleared, true, 'Esc deve desmarcar painel de camadas');
    assert.strictEqual(hudHidden, true, 'Esc deve ocultar HUD de seleção');
  } finally {
    UIToast.notificar = originalNotificar;
  }

  console.log('✔ Undo/Redo e atalhos de seleção funcionando perfeitamente!');
}

console.log('\n======================================================');
console.log('🎉 AUDITORIA DO AGENTE 1 CONCLUÍDA COM 100% DE SUCESSO!');
console.log('======================================================\n');

process.exit(0);
