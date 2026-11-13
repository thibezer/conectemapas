/* ==========================================================================
   Testes dos objetos avançados e edição direta das pranchas (PrintComposer):
   - Formas geométricas (10 tipos), traços (4 estilos), setas duplas e rotação
   - Tabelas avançadas (colunas dinâmicas, CRS UTM/DMS, prefixo, paginação,
     Quadro Resumo de Áreas e continuação dividida)
   - Rosa dos Ventos (5 estilos + cor), Barra de Escala (double/line_ticks/sem caixa)
   - Rótulos e Blocos de Notas (2 colunas, justificado, maiúsculas, espaçamento,
     Fundo/Borda, gerador de Memorial Descritivo ABNT)
   - Legenda (contagem de feições, soma de áreas, cabeçalho/borda/opacidade)
   - Selo ABNT (campos personalizados)
   - PrintAlignmentHelper (matchWidth/Height/Size, packVertical/Horizontal, fitToMargins)
   - Inserção exclusivamente por desenho (setPlacementTool + insertItem com retângulo), clipboard & copiar/colar estilo
   - Paridade em PDF vetorial real (PdfVectorContext + jsPDF) e validação do Painel
   ========================================================================== */
import assert from 'assert';
import { register } from 'node:module';
import { jsPDF } from 'jspdf';

// Stub para imports .css e globals mínimos do Leaflet / ui-kit ao carregar módulos de UI no Node
globalThis.window = globalThis;
globalThis.screen = globalThis.screen || { deviceXDPI: 96, logicalXDPI: 96 };
globalThis.addEventListener = globalThis.addEventListener || (() => {});
globalThis.removeEventListener = globalThis.removeEventListener || (() => {});
globalThis.HTMLElement = globalThis.HTMLElement || class {};
globalThis.customElements = globalThis.customElements || { get: () => true, define() {} };
globalThis.MutationObserver = globalThis.MutationObserver || class { observe() {} disconnect() {} };
globalThis.document = {
  readyState: 'complete',
  documentElement: { style: {} },
  body: { appendChild() {} },
  createElement: () => ({ style: {}, getContext: () => null, addEventListener() {}, appendChild() {} }),
  getElementsByTagName: () => [],
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {}
};
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);

register('data:text/javascript,' + encodeURIComponent(
  'export async function load(url, ctx, next){ if(url.endsWith(".css")) return { format:"module", source:"", shortCircuit:true }; return next(url, ctx); }'
));

const { PdfVectorContext } = await import('../src/components/PrintComposer/PdfVectorContext.js');
const { PrintItemsManager } = await import('../src/components/PrintComposer/PrintItemsManager.js');
const { PrintExporter } = await import('../src/components/PrintComposer/PrintExporter.js');
const { PrintAlignmentHelper } = await import('../src/components/PrintComposer/PrintAlignmentHelper.js');
const { PrintTitleBlockRenderer } = await import('../src/components/PrintComposer/PrintTitleBlockRenderer.js');
const { PrintViewResolver } = await import('../src/components/PrintComposer/PrintViewResolver.js');
const { PrintPropertiesPanel } = await import('../src/components/PrintComposer/PrintPropertiesPanel.js');
const { PrintComposerModal } = await import('../src/components/PrintComposer/PrintComposerModal.js');

const PX = 300 / 25.4;
const samplePolygon = {
  id: 'poly-1',
  name: 'Gleba A',
  layerId: 'lote',
  type: 'polygon',
  coordinates: [[
    [-15.7800, -47.9200],
    [-15.7800, -47.9100],
    [-15.7900, -47.9100],
    [-15.7900, -47.9200],
    [-15.7800, -47.9200]
  ]],
  style: { strokeColor: '#0f766e', fillColor: '#14b8a6' }
};
const sampleLayers = [{ id: 'lote', name: 'Parcelas', visible: true, color: '#0f766e' }];

// 1. Todas as 10 formas geométricas e 4 estilos de traço na tela + PDF vetorial
{
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [297, 210], compress: false });
  const vctx = new PdfVectorContext(pdf, { pxPerMm: PX });
  for (const { value: shapeType } of PrintItemsManager.SHAPE_TYPES) {
    for (const { value: strokeStyle } of PrintItemsManager.STROKE_STYLES) {
      const item = {
        id: `s-${shapeType}`,
        type: 'shape',
        shapeType,
        strokeStyle,
        arrowHead: shapeType === 'arrow' ? 'both' : undefined,
        strokeColor: '#1d4ed8',
        strokeWidth: 2,
        fillColor: 'rgba(59, 130, 246, 0.25)',
        borderRadius: shapeType === 'rounded_rect' ? 8 : 0,
        rotation: 15,
        width: 50,
        height: 30
      };
      const html = PrintItemsManager.renderShape(item);
      assert.ok(html.length > 20, `renderShape deve gerar HTML para ${shapeType}/${strokeStyle}`);
      if (['ellipse', 'triangle', 'diamond', 'line_h', 'line_v', 'line_diag', 'arrow'].includes(shapeType)) {
        assert.ok(html.includes('<svg'), `shape ${shapeType} usa SVG vetorial na folha`);
      }
      PrintExporter.drawShapeItem(vctx, item, 100, 100, Math.round(50 * PX), Math.round(30 * PX), PX);
    }
  }
  const pdfStr = pdf.output();
  assert.ok(pdfStr.length > 1000, 'PdfVectorContext gera operadores PDF válidos para todas as formas');
  console.log('✔ Formas geométricas avançadas (tela × PDF vetorial)');
}

// 2. Rosa dos ventos (5 estilos + cor) e Barra de escala (3 estilos + caixa)
{
  for (const st of ['classic', 'compass', 'star8', 'technical', 'modern']) {
    const svg = PrintItemsManager.getNorthArrowSVG(st, 30, '#0f172a');
    assert.ok(svg.includes('<svg') && svg.includes('rotate(30deg)'), `getNorthArrowSVG suporta estilo ${st}`);
  }
  for (const barStyle of ['alternating', 'double', 'line_ticks']) {
    const html = PrintItemsManager.renderScaleBar({ width: 60, segments: 4, barStyle, showBox: false, barColor: '#1e293b' }, 5000);
    assert.ok(html.includes(`cm-item-scale-bar--${barStyle}`) && html.includes('cm-item-scale-bar--nobox'), `renderScaleBar suporta ${barStyle} sem caixa`);
  }
  console.log('✔ Rosa dos ventos (5 estilos + cor) e Barra de escala (double / line_ticks / nobox)');
}

// 3. Tabela de vértices avançada, DMS, prefixo, paginação, Quadro de Áreas e Memorial ABNT
{
  const poly6 = {
    id: 'poly-6',
    name: 'Gleba 6V',
    layerId: 'lote',
    type: 'polygon',
    coordinates: [[
      [-15.780, -47.920], [-15.780, -47.915], [-15.783, -47.912],
      [-15.788, -47.912], [-15.790, -47.918], [-15.785, -47.921],
      [-15.780, -47.920]
    ]]
  };

  const customVerts = PrintItemsManager.extractVerticesData([poly6], 'poly-6', {
    vertexPrefix: 'P',
    segmentFormat: 'segment',
    startVertex: 2,
    endVertex: 4
  });
  assert.strictEqual(customVerts.allVerticesCount, 6);
  assert.strictEqual(customVerts.vertices.length, 3);
  assert.strictEqual(customVerts.vertices[0].name, 'P02 → P03');

  const dmsHtml = PrintItemsManager.renderVerticesTable({
    id: 'tv1', type: 'table_vertices', width: 95, height: 65,
    crs: 'dms', showFooter: false, title: 'TABELA GEOGRÁFICA'
  }, [poly6], sampleLayers);
  assert.ok(dmsHtml.includes('SIRGAS 2000 Geográficas (DMS)'));
  assert.ok(dmsHtml.includes('TABELA GEOGRÁFICA'));
  assert.ok(!dmsHtml.includes('cm-tb-vert-footer'));

  const areasSummary = PrintItemsManager.extractAreasSummaryData([samplePolygon], sampleLayers);
  assert.strictEqual(areasSummary.isSummary, true);
  assert.strictEqual(areasSummary.vertices.length, 1);
  assert.strictEqual(areasSummary.vertices[0].layer, 'Parcelas');

  const areasHtml = PrintItemsManager.renderVerticesTable({
    id: 'tv-areas', type: 'table_vertices', tableMode: 'areas', width: 95, height: 55
  }, [samplePolygon], sampleLayers);
  assert.ok(areasHtml.includes('QUADRO DE ÁREAS E PERÍMETROS') && areasHtml.includes('Parcelas'));

  const memorial = PrintItemsManager.generateDescriptiveMemorial([poly6], 'poly-6');
  assert.ok(memorial.includes('MEMORIAL DESCRITIVO') && memorial.includes('V01') && memorial.includes('azimute de'));
  console.log('✔ Tabela de vértices (DMS, prefixo, paginação, Quadro de Áreas) e Memorial ABNT');
}

// 4. Rótulo, Bloco de Texto em 2 colunas, Legenda com contagem/área e Carimbo com campos extras
{
  const lblHtml = PrintItemsManager.renderLabel({
    text: 'planta baixa', textTransform: 'uppercase', fontStyle: 'italic',
    letterSpacing: 2, verticalAlign: 'bottom', fillColor: '#fef3c7', strokeWidth: 1, rotation: -10
  });
  assert.ok(lblHtml.includes('PLANTA BAIXA') && lblHtml.includes('font-style: italic') && lblHtml.includes('letter-spacing: 2px'));

  const tbHtml = PrintItemsManager.renderTextBlock({
    title: 'OBSERVAÇÕES', showTitle: false, columns: 2, textAlign: 'justify', showBorder: false
  });
  assert.ok(!tbHtml.includes('cm-text-block-title') && tbHtml.includes('column-count: 2') && tbHtml.includes('border: none'));

  const legEntries = PrintViewResolver.legendEntries({ filters: [] }, {
    features: [samplePolygon], layers: sampleLayers
  });
  assert.strictEqual(legEntries[0].count, 1);
  assert.ok(legEntries[0].areaHa > 100);

  const cells = PrintTitleBlockRenderer.cells({
    properties: { customFields: [{ label: 'Matrícula CRI', value: '12.345' }] }
  }, 'Fazenda', 10000);
  assert.ok(cells.some(c => c.label === 'Matrícula CRI' && c.value === '12.345'));
  console.log('✔ Rótulo, Bloco 2 colunas, Legenda c/ área+contagem e Carimbo c/ campos personalizados');
}

// 5. PrintAlignmentHelper (match/pack/fitToMargins), Desenho-criação, Clipboard, Copy Style e Split Table
{
  const makeComposer = (items) => ({
    paperSize: { width: 297, height: 210 },
    items,
    selectedItemIds: new Set(items.map(i => i.id)),
    get selectedItemId() { return [...this.selectedItemIds][0] || null; },
    getSelectedItems() { return this.items.filter(i => this.selectedItemIds.has(i.id)); },
    updateItemPositionDOM() {},
    refreshItemContent() {},
    updatePropertiesPanel() {},
    pushHistoryState() {}
  });

  const a = { id: 'a', x: 10, y: 10, width: 60, height: 25 };
  const b = { id: 'b', x: 90, y: 80, width: 30, height: 40 };
  const cmp = makeComposer([a, b]);
  PrintAlignmentHelper.matchSize(cmp);
  assert.strictEqual(b.width, 60);
  assert.strictEqual(b.height, 25);

  PrintAlignmentHelper.packVertical(cmp, 5);
  assert.strictEqual(b.y, 40);

  PrintAlignmentHelper.packHorizontal(cmp, 4);
  assert.strictEqual(b.x, 74);

  const single = { id: 'only', x: 50, y: 50, width: 30, height: 30 };
  const cmpSingle = makeComposer([single]);
  const margins = PrintItemsManager.sheetMargins(cmpSingle.paperSize);
  PrintAlignmentHelper.fitToMargins(cmpSingle);
  assert.strictEqual(single.x, margins.left);
  assert.strictEqual(single.width, 297 - margins.left - margins.right);

  assert.strictEqual(PrintItemsManager.findSmartPosition, undefined, 'Posicionamento automático removido em favor da inserção por desenho');

  // Clipboard, copiar/colar estilo e divisão de tabela via métodos reais de PrintComposerModal
  const proto = PrintComposerModal.prototype;
  const mockModal = {
    readOnly: false,
    paperSize: { width: 297, height: 210 },
    features: [samplePolygon],
    layers: sampleLayers,
    items: [
      { id: 'lbl1', type: 'label', name: 'L1', x: 20, y: 20, width: 50, height: 15, textColor: '#dc2626', fontSize: 14 },
      { id: 'lbl2', type: 'label', name: 'L2', x: 20, y: 50, width: 50, height: 15, textColor: '#000000', fontSize: 9 }
    ],
    selectedItemIds: new Set(['lbl1']),
    get selectedItemId() { return [...this.selectedItemIds][0] || null; },
    getSelectedItems() { return this.items.filter(i => this.selectedItemIds.has(i.id)); },
    selectItem(id) { this.selectedItemIds = id ? new Set([id]) : new Set(); },
    selectItems(ids) { this.selectedItemIds = new Set(ids); },
    renderAllItems() {},
    refreshItemContent() {},
    updatePropertiesPanel() {},
    pushHistoryState() {},
    deleteItems(ids) { this.items = this.items.filter(i => !ids.includes(i.id)); }
  };

  assert.strictEqual(proto.copySelectedItems.call(mockModal), 1);
  const pasted = proto.pasteItems.call(mockModal);
  assert.strictEqual(pasted.length, 1);
  assert.strictEqual(pasted[0].x, 26);

  mockModal.selectItem('lbl1');
  assert.strictEqual(proto.copyItemStyle.call(mockModal), true);
  mockModal.selectItem('lbl2');
  assert.strictEqual(proto.pasteItemStyle.call(mockModal), true);
  assert.strictEqual(mockModal.items[1].textColor, '#dc2626');
  assert.strictEqual(mockModal.items[1].fontSize, 14);

  // Split continuation table quando altura só comporta parte dos vértices
  const bigVerts = [];
  for (let i = 0; i < 12; i++) {
    const aRad = (i / 12) * Math.PI * 2;
    bigVerts.push([-15.78 + Math.sin(aRad) * 0.005, -47.92 + Math.cos(aRad) * 0.005]);
  }
  bigVerts.push(bigVerts[0]);
  mockModal.features = [{ id: 'big', name: 'Poligono 12V', type: 'polygon', coordinates: [bigVerts] }];
  mockModal.items.push({ id: 'tbl1', type: 'table_vertices', name: 'Tabela', x: 15, y: 15, width: 85, height: 32, targetFeatureId: 'big' });
  const cont = proto.splitVerticesTableContinuation.call(mockModal, 'tbl1');
  assert.ok(cont && cont.startVertex > 1, 'splitVerticesTableContinuation cria tabela de continuação com vértices seguintes');

  // Inserção por desenho: setPlacementTool + insertItem com retângulo desenhado
  mockModal.canvasEngine = { placementType: null };
  mockModal.interactionMode = 'content_pan';
  mockModal.setInteractionMode = function (m) { this.interactionMode = m; };
  mockModal.setPlacementTool = proto.setPlacementTool;
  mockModal.projectName = 'Fazenda';
  proto.setPlacementTool.call(mockModal, 'label');
  assert.strictEqual(mockModal.canvasEngine.placementType, 'label');
  assert.strictEqual(mockModal.interactionMode, 'layout', 'Ativar desenho sai do pan de conteúdo');
  const drawn = proto.insertItem.call(mockModal, 'label', { x: 42, y: 38, width: 65, height: 18 });
  assert.strictEqual(drawn.x, 42);
  assert.strictEqual(drawn.y, 38);
  assert.strictEqual(drawn.width, 65);
  assert.strictEqual(drawn.height, 18);
  assert.strictEqual(mockModal.canvasEngine.placementType, null, 'Limpa modo de desenho após concluir inserção');
  console.log('✔ Alinhamento avançado, desenho-criação, clipboard, copiar estilo e split de tabela');
}

// 6. Validação do HTML gerado pelo PrintPropertiesPanel para todos os novos painéis
{
  const panelItems = [
    { id: '1', type: 'shape', shapeType: 'arrow', arrowHead: 'both', strokeStyle: 'dashed', name: 'Seta', x: 10, y: 10, width: 40, height: 20 },
    { id: '2', type: 'north_arrow', arrowStyle: 'star8', color: '#111111', name: 'Norte', x: 10, y: 10, width: 25, height: 25 },
    { id: '3', type: 'scale_bar', barStyle: 'double', showBox: true, name: 'Escala', x: 10, y: 10, width: 50, height: 25 },
    { id: '4', type: 'table_vertices', tableMode: 'vertices', crs: 'dms', name: 'Tabela', x: 10, y: 10, width: 80, height: 50 },
    { id: '5', type: 'text_block', name: 'Notas', columns: 2, textAlign: 'justify', x: 10, y: 10, width: 80, height: 40 },
    { id: '6', type: 'label', name: 'Título', textTransform: 'uppercase', fontStyle: 'italic', x: 10, y: 10, width: 80, height: 15 },
    { id: '7', type: 'legend', name: 'Legenda', showFeatureCount: true, showAreaHa: true, x: 10, y: 10, width: 70, height: 40 },
    { id: '8', type: 'title_block', name: 'Carimbo', properties: { customFields: [{ label: 'ART', value: '99' }] }, x: 10, y: 10, width: 90, height: 60 },
    { id: '9', type: 'image', name: 'Logo', opacity: 0.8, x: 10, y: 10, width: 40, height: 30 }
  ];
  for (const item of panelItems) {
    const html = PrintPropertiesPanel.render({
      paperSize: { width: 297, height: 210, label: 'A4 Landscape' },
      items: [item, { id: 'm1', type: 'map', scale: 10000, width: 100, height: 100, x: 0, y: 0 }],
      selectedItemId: item.id,
      selectedItemIds: new Set([item.id]),
      features: [samplePolygon],
      layers: sampleLayers,
      library: { filters: [], viewTemplates: [] }
    });
    const badStyles = (html.match(/style="[^"]*"/g) || []).filter(s => !s.startsWith('style="background: '));
    assert.strictEqual(badStyles.length, 0, `Sem style inline proibido em ${item.type}: ${badStyles.join(', ')}`);
    assert.ok(!/<select\b/.test(html) && !/<textarea\b/.test(html), `Usa web components do ui-kit em ${item.type}`);
  }
  console.log('✔ PrintPropertiesPanel (UI-kit e CSS puro validados em todos os tipos)');
}

console.log('\n🎉 TESTE DOS OBJETOS AVANÇADOS DAS PRANCHAS PASSOU 100%!');
