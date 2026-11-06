/**
 * ConecteMapas - Teste Automatizado da Fase 3: Automação & Inteligência de Dados
 * Valida o Motor de Atlas Cartográfico (PrintAtlasEngine), BoundingBox com respiro,
 * interpolação de expressões dinâmicas QGIS ([% ... %], [@...], {...}) e UI do Atlas.
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { PrintAtlasEngine } from '../src/components/PrintComposer/PrintAtlasEngine.js';
import { PrintAtlasBar } from '../src/components/PrintComposer/PrintAtlasBar.js';
import { PrintSideToolbox } from '../src/components/PrintComposer/PrintSideToolbox.js';
import { PrintPropertiesPanel } from '../src/components/PrintComposer/PrintPropertiesPanel.js';
import { PrintTitleBlockRenderer } from '../src/components/PrintComposer/PrintTitleBlockRenderer.js';
import { PrintExporter } from '../src/components/PrintComposer/PrintExporter.js';

test('Fase 3: PrintAtlasEngine - Cálculo de Bounding Box', () => {
  const featPoly = {
    id: 'f1',
    name: 'Lote 01',
    coordinates: [
      [[-15.790, -47.880], [-15.790, -47.870], [-15.800, -47.870], [-15.800, -47.880]]
    ]
  };

  const bounds = PrintAtlasEngine.computeFeatureBounds(featPoly);
  assert.ok(bounds, 'Deve calcular bounds com sucesso');
  assert.strictEqual(bounds.minLat, -15.800);
  assert.strictEqual(bounds.maxLat, -15.790);
  assert.strictEqual(bounds.minLng, -47.880);
  assert.strictEqual(bounds.maxLng, -47.870);

  // Geometria vazia ou nula
  assert.strictEqual(PrintAtlasEngine.computeFeatureBounds(null), null);
  assert.strictEqual(PrintAtlasEngine.computeFeatureBounds({ coordinates: [] }), null);
});

test('Fase 3: PrintAtlasEngine - Navegação e Camada de Cobertura', () => {
  const mockComposer = {
    projectName: 'Projeto Fazenda Boa Vista',
    layers: [
      { id: 'lay-lotes', name: 'Lotes Urbanos' },
      { id: 'lay-eixos', name: 'Eixos Viários' }
    ],
    features: [
      { id: 'l1', layerId: 'lay-lotes', type: 'Polygon', name: 'Lote A', coordinates: [[[-15.79, -47.88], [-15.79, -47.87], [-15.80, -47.87]]] },
      { id: 'l2', layerId: 'lay-lotes', type: 'Polygon', name: 'Lote B', coordinates: [[[-15.81, -47.88], [-15.81, -47.87], [-15.82, -47.87]]] },
      { id: 'l3', layerId: 'lay-lotes', type: 'Polygon', name: 'Lote C', coordinates: [[[-15.83, -47.88], [-15.83, -47.87], [-15.84, -47.87]]] },
      { id: 'r1', layerId: 'lay-eixos', type: 'LineString', name: 'Rua 01', coordinates: [[-15.79, -47.88], [-15.80, -47.88]] }
    ],
    items: [
      { id: 'item-map-main', type: 'map', scale: 2500 }
    ],
    sheetsManager: {
      getCurrentSheet: () => ({ name: 'Prancha 01' })
    }
  };

  const engine = new PrintAtlasEngine(mockComposer);
  engine.setLayerId('lay-lotes');

  // Cobertura deve conter exatamente os 3 lotes
  const cov = engine.getCoverageFeatures();
  assert.strictEqual(cov.length, 3);
  assert.strictEqual(cov[0].name, 'Lote A');
  assert.strictEqual(cov[2].name, 'Lote C');

  // Ativação e navegação
  engine.setEnabled(true);
  assert.strictEqual(engine.enabled, true);
  assert.strictEqual(engine.getCurrentFeature().name, 'Lote A');

  // Next
  engine.next();
  assert.strictEqual(engine.currentIndex, 1);
  assert.strictEqual(engine.getCurrentFeature().name, 'Lote B');

  engine.next();
  assert.strictEqual(engine.currentIndex, 2);
  assert.strictEqual(engine.getCurrentFeature().name, 'Lote C');

  // Limite superior não deve estourar
  engine.next();
  assert.strictEqual(engine.currentIndex, 2);

  // Prev
  engine.prev();
  assert.strictEqual(engine.currentIndex, 1);
  assert.strictEqual(engine.getCurrentFeature().name, 'Lote B');

  // Go to
  engine.goTo(0);
  assert.strictEqual(engine.currentIndex, 0);
  assert.strictEqual(engine.getCurrentFeature().name, 'Lote A');

  // Limite inferior não deve ser menor que 0
  engine.prev();
  assert.strictEqual(engine.currentIndex, 0);
});

test('Fase 3: PrintAtlasEngine - Avaliação de Expressões Dinâmicas Estilo QGIS', () => {
  const mockComposer = {
    projectName: 'Condomínio Solar',
    layers: [{ id: 'lay1', name: 'Glebas' }],
    features: [
      {
        id: 'feat-10',
        layerId: 'lay1',
        type: 'Polygon',
        name: 'Gleba das Palmeiras',
        coordinates: [
          [[-15.791, -47.881], [-15.791, -47.871], [-15.801, -47.871], [-15.801, -47.881]]
        ],
        properties: {
          proprietario: 'João da Silva',
          matricula: '123.456-R'
        }
      }
    ],
    items: [
      { id: 'item-map-main', type: 'map', scale: 5000 }
    ],
    sheetsManager: {
      getCurrentSheet: () => ({ name: 'Prancha de Demarcação' })
    }
  };

  const engine = new PrintAtlasEngine(mockComposer);
  engine.setLayerId('lay1');
  engine.setEnabled(true);

  // 1. Variável de nome padrão QGIS: [% feature.name %]
  const t1 = engine.evaluateExpressions('Levantamento do Lote: [% feature.name %]');
  assert.strictEqual(t1, 'Levantamento do Lote: Gleba das Palmeiras');

  // 2. Variável de contexto: [% project.name %] e [% scale %]
  const t2 = engine.evaluateExpressions('Projeto: [% project.name %] - Escala: [% scale %]');
  assert.ok(t2.includes('Projeto: Condomínio Solar'));
  assert.ok(t2.includes('1:5.000'));

  // 3. Sintaxe com chaves {nome} e colchetes arroba [@feature.name]
  assert.strictEqual(engine.evaluateExpressions('Imóvel: {nome}'), 'Imóvel: Gleba das Palmeiras');
  assert.strictEqual(engine.evaluateExpressions('Imóvel: [@feature.name]'), 'Imóvel: Gleba das Palmeiras');

  // 4. Atributos customizados da feição: [% proprietario %] e [% prop.matricula %]
  const t3 = engine.evaluateExpressions('Prop.: [% proprietario %] | Reg.: [% prop.matricula %]');
  assert.strictEqual(t3, 'Prop.: João da Silva | Reg.: 123.456-R');

  // 5. Paginação do Atlas: [% atlas.index %] de [% atlas.total %]
  const t4 = engine.evaluateExpressions('Folha [% atlas.index %] de [% atlas.total %]');
  assert.strictEqual(t4, 'Folha 1 de 1');
});

test('Fase 3: Integração do Atlas no Carimbo Técnico (PrintTitleBlockRenderer)', () => {
  const item = {
    properties: {
      headerTitle: 'LEVANTAMENTO DE [% feature.name %]',
      client: '[% proprietario %]',
      location: 'Gleba [% feature.name %], Quadra 04'
    }
  };

  const evaluator = (text) => {
    return (text || '')
      .replace(/\[%\s*feature\.name\s*%\]/g, 'LOTE 42')
      .replace(/\[%\s*proprietario\s*%\]/g, 'Maria Oliveira');
  };

  // Header Title avaliado
  const header = PrintTitleBlockRenderer.headerText(item, evaluator);
  assert.strictEqual(header, 'LEVANTAMENTO DE LOTE 42');

  // Células do carimbo avaliadas
  const cells = PrintTitleBlockRenderer.cells(item, 'Projeto X', 2000, evaluator);
  const clientCell = cells.find(c => c.label === 'Proprietário / Cliente');
  const locCell = cells.find(c => c.label === 'Imóvel / Endereço');

  assert.strictEqual(clientCell.value, 'Maria Oliveira');
  assert.strictEqual(locCell.value, 'Gleba LOTE 42, Quadra 04');
});

test('Fase 3: UI - Renderização da Barra e Controles do Atlas', () => {
  const mockComposer = {
    projectName: 'Projeto Teste',
    paperSize: { name: 'A4 Paisagem', width: 297, height: 210 },
    items: [],
    layers: [{ id: 'l1', name: 'Camada 1' }],
    atlas: {
      enabled: true,
      layerId: 'l1',
      currentIndex: 0,
      marginPct: 20,
      getCoverageFeatures: () => [{ id: 'f1', name: 'Lote 01' }],
      getCurrentFeature: () => ({ id: 'f1', name: 'Lote 01' })
    }
  };

  // 1. Barra de ferramentas do Atlas
  const atlasBarHtml = PrintAtlasBar.render(mockComposer);
  assert.ok(atlasBarHtml.includes('id="cm-print-atlas-bar"'), 'Barra deve renderizar o container');
  assert.ok(atlasBarHtml.includes('Lote 01'), 'Barra deve exibir o nome da feição ativa');
  assert.ok(atlasBarHtml.includes('Exportar Caderno PDF'), 'Barra deve conter botão de exportação');

  // 2. Botão do Atlas na Barra Lateral (Toolbox)
  const toolboxHtml = PrintSideToolbox.render(mockComposer);
  assert.ok(toolboxHtml.includes('data-stb-action="toggle-atlas"'), 'Toolbox deve conter botão de alternância do Atlas');

  // 3. Seção do Atlas no Painel de Propriedades
  const atlasSectionHtml = PrintPropertiesPanel.renderAtlasSection(mockComposer, () => 'open');
  assert.ok(atlasSectionHtml.includes('data-section="atlas"'), 'Painel de propriedades deve conter seção do Atlas');
  assert.ok(atlasSectionHtml.includes('id="prop-atlas-enable"'), 'Deve conter checkbox de ativação do Atlas');
  assert.ok(atlasSectionHtml.includes('id="prop-atlas-layer"'), 'Deve conter seleção da camada de cobertura');
  assert.ok(atlasSectionHtml.includes('id="prop-atlas-margin"'), 'Deve conter campo de margem percentual');
});

test('Fase 3: PrintAtlasEngine - Enquadramento real com Leaflet Map (applyCurrentFeature)', () => {
  let fittedBounds = null;
  const mockLeafletMap = {
    fitBounds: (bounds) => { fittedBounds = bounds; },
    getCenter: () => ({ lat: -15.795, lng: -47.875 }),
    getZoom: () => 16
  };
  const mapItem = { id: 'item-map-main', type: 'map', scale: 10000 };
  const mockComposer = {
    projectName: 'Atlas Real',
    layers: [{ id: 'l1', name: 'Lotes' }],
    features: [
      { id: 'f1', layerId: 'l1', type: 'Polygon', name: 'Lote 01', coordinates: [[[-15.79, -47.88], [-15.79, -47.87], [-15.80, -47.87], [-15.80, -47.88]]] }
    ],
    items: [mapItem],
    leafletMaps: new Map([['item-map-main', mockLeafletMap]])
  };

  const engine = new PrintAtlasEngine(mockComposer);
  engine.setLayerId('l1');
  engine.setEnabled(true);

  assert.ok(fittedBounds, 'fitBounds deve ter sido chamado no mapa Leaflet');
  assert.deepStrictEqual(mapItem.view, { center: [-15.795, -47.875], zoom: 16 });
  assert.ok(Number.isFinite(mapItem.scale) && mapItem.scale > 0, 'Escala do mapa deve ser calculada via PrintItemsManager.calculateScale');
});

test('Fase 3: PrintExporter - Consistência Tela vs Exportação (Grade, Rosa dos Ventos e Quebra de Linha)', () => {
  const lineToCalls = [];
  const arcCalls = [];
  const fillTextCalls = [];
  const ctx = {
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: (x, y) => { lineToCalls.push([x, y]); },
    arc: (x, y, r) => { arcCalls.push(r); },
    rect: () => {},
    clip: () => {},
    fill: () => {},
    stroke: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    setLineDash: () => {},
    measureText: (txt) => ({ width: String(txt).length * 6 }),
    fillText: (txt, x, y) => { fillTextCalls.push({ txt, x, y }); }
  };

  // 1. Grade com linhas contínuas não deve passar undefined em lineTo(x + w, py)
  const mockMap = {
    getBounds: () => ({
      getNorth: () => -15.78,
      getSouth: () => -15.80,
      getWest: () => -47.89,
      getEast: () => -47.87
    })
  };
  PrintExporter.drawMapGraticule(ctx, { gridType: 'dms', gridFormat: 'lines' }, mockMap, 10, 20, 200, 150, 4);
  assert.ok(lineToCalls.length > 0, 'Deve desenhar linhas da grade');
  assert.ok(lineToCalls.every(([lx, ly]) => Number.isFinite(lx) && Number.isFinite(ly)), 'Todas as coordenadas lineTo da grade devem ser finitas');

  // 2. Rosa dos ventos nos estilos compass e modern
  PrintExporter.drawNorthArrowItem(ctx, { arrowStyle: 'compass', rotation: 15 }, 0, 0, 40, 40);
  assert.ok(arcCalls.length >= 2, 'Estilo compass deve desenhar círculos concêntricos');
  PrintExporter.drawNorthArrowItem(ctx, { arrowStyle: 'modern', rotation: 0 }, 0, 0, 40, 40);

  // 3. Quebra de linha em bloco de texto e rótulo
  const wrapped = PrintExporter.wrapTextLines(ctx, 'Linha muito longa para caber em uma unica linha estreita', 80);
  assert.ok(wrapped.length >= 3, 'Texto longo deve ser quebrado em múltiplas linhas');
});
