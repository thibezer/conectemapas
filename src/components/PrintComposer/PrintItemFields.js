/* ==========================================================================
   ConecteMapas - PrintItemFields
   Campos específicos de cada tipo de elemento da prancha, no contrato do
   <ui-painel-propriedades> do kit. Sem DOM: cada entrada traz a propriedade
   do kit (`prop`) e o que fazer quando ela muda (`apply`) ou é clicada (`run`).

   Entrada = { category, title, prop, apply?, run?, map?, refresh?, rebuild?, guard?, transient? }
   - apply(it, valor, composer): grava no item (o painel registra o histórico)
   - map: a mudança precisa reaplicar escala/rotação do mapa Leaflet
   - refresh: 'grid' redesenha a grade do mapa depois de gravar
   - rebuild: reconstrói o painel inteiro (há HTML legado que depende do valor)
   - guard(it, valor): false recusa a mudança (o painel volta ao valor do item)
   - transient: valor só do painel (não vai para o item nem para o histórico)
   O que o kit não cobre (texto multilinha, arquivo, lista da legenda) fica em
   PrintPropertiesPanel.renderLegacyFields.
   ========================================================================== */

import { PrintItemsManager } from './PrintItemsManager.js';
import { PrintTitleBlockRenderer } from './PrintTitleBlockRenderer.js';
import { PrintViewResolver } from './PrintViewResolver.js';
import { PrintFonts } from './PrintFonts.js';
import { BasemapCatalog } from '../../services/BasemapCatalog.js';
import { UIToast } from '@thibezer/ui-components-kit';

const num = (v, fallback) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : fallback);
const colorHex = (value, fallback) => (PrintItemsManager.parseColor(value) || { hex: fallback }).hex;
const options = (pairs) => pairs.map(([id, rotulo]) => ({ id, rotulo }));

export class PrintItemFields {
  /** Entradas do elemento (vazio para tipos sem campos próprios); `locked` esconde as ações */
  static build(item, composer) {
    if (!item) return [];
    const locked = Boolean(item.locked);
    const out = [];
    const field = (category, title, prop, apply, flags = {}) => {
      out.push({ category, title, prop: { ...prop, somenteLeitura: locked || Boolean(prop.somenteLeitura) }, apply, ...flags });
    };
    const action = (category, title, id, rotulo, rotuloAcao, run, dica) => {
      if (locked) return;
      out.push({ category, title, prop: { id, rotulo, tipo: 'acao', valor: null, rotuloAcao, ...(dica ? { dica } : {}) }, run });
    };
    const text = (category, title, id, rotulo, valor, apply) => field(category, title, { id, rotulo, tipo: 'texto', valor }, apply);
    const check = (category, title, id, rotulo, valor, apply, extra = {}) => field(category, title, { id, rotulo, tipo: 'booleano', valor: Boolean(valor) }, apply, extra);
    const color = (category, title, id, rotulo, valor, apply) => field(category, title, { id, rotulo, tipo: 'cor', valor }, apply);
    const select = (category, title, id, rotulo, valor, opcoes, apply, extra = {}) => field(category, title, { id, rotulo, tipo: 'selecao', valor, opcoes }, apply, extra);
    const number = (category, title, id, rotulo, valor, o, apply, extra = {}) => field(category, title, {
      id, rotulo, tipo: 'numero', valor, casasDecimais: 0, passo: 1, ...o
    }, apply, extra);
    const font = (category, title, id) => select(category, title, id, 'Fonte', PrintFonts.normalize(item.fontFamily),
      PrintFonts.list().map(f => ({ id: f.id, rotulo: f.label })),
      (it, v) => { it.fontFamily = v === 'sans' && !it.fontFamily ? undefined : PrintFonts.normalize(v); });

    const type = item.type;
    if (type === 'map' || type === 'inset_map') this.mapFields(item, composer, { field, action, select, number, check });
    else if (type === 'north_arrow') {
      const C = 'seta', T = 'Rosa dos ventos';
      select(C, T, 'arrow_style', 'Estilo da seta', item.arrowStyle || 'classic', options([
        ['classic', 'Cartográfica clássica'], ['compass', 'Bússola / Rosa'], ['star8', 'Rosa 8 pontas'],
        ['technical', 'Alvo técnico (RET)'], ['modern', 'Moderna minimalista']
      ]), (it, v) => { it.arrowStyle = v; });
      color(C, T, 'arrow_color', 'Cor principal', colorHex(item.color, '#000000'), (it, v) => { it.color = v; });
      number(C, T, 'arrow_rot', 'Rotação (norte)', num(item.rotation, 0), { min: 0, max: 360, unidade: '°' }, (it, v) => { it.rotation = num(v, 0); });
    } else if (type === 'scale_bar') {
      const C = 'barra', T = 'Barra de escala';
      field(C, T, { id: 'sb_scale', rotulo: 'Escala (do mapa)', tipo: 'readonly', valor: `1:${Math.round(num(item.scale, 10000)).toLocaleString('pt-BR')}` });
      select(C, T, 'sb_style', 'Estilo da régua', item.barStyle || 'alternating', options([
        ['alternating', 'Barras alternadas'], ['double', 'Barra dupla (zebrada)'], ['line_ticks', 'Linha com marcas']
      ]), (it, v) => { it.barStyle = v; });
      number(C, T, 'sb_segments', 'Divisões', num(item.segments, 4), { min: 1, max: 8 }, (it, v) => { it.segments = Math.min(8, Math.max(1, Math.round(num(v, 4)))); });
      select(C, T, 'sb_units', 'Unidade', item.units || 'auto', options([['auto', 'Automática'], ['m', 'Metros (m)'], ['km', 'Quilômetros (km)']]), (it, v) => { it.units = v; });
      color(C, T, 'sb_color', 'Cor da barra', colorHex(item.barColor, '#000000'), (it, v) => { it.barColor = v; });
      check(C, T, 'sb_text', 'Escala numérica', item.showScaleText !== false, (it, v) => { it.showScaleText = Boolean(v); });
      check(C, T, 'sb_box', 'Caixa e moldura', item.showBox !== false, (it, v) => { it.showBox = Boolean(v); });
    } else if (type === 'legend') this.legendFields(item, composer, { text, check, color, select, number, font });
    else if (type === 'table_vertices') this.verticesFields(item, composer, { text, check, color, select, number, action });
    else if (type === 'text_block') this.textBlockFields(item, { text, check, color, select, number, font, action });
    else if (type === 'shape') this.shapeFields(item, { color, select, number });
    else if (type === 'image') {
      const C = 'imagem', T = 'Imagem';
      select(C, T, 'image_fit', 'Enquadramento', item.objectFit || 'contain', options([['contain', 'Conter (manter proporção)'], ['cover', 'Preencher (cortar excesso)']]), (it, v) => { it.objectFit = v; });
      number(C, T, 'image_opacity', 'Opacidade', Math.round((item.opacity == null ? 1 : num(item.opacity, 1)) * 100),
        { min: 10, max: 100, passo: 5, unidade: '%' }, (it, v) => { it.opacity = Math.max(10, Math.min(100, num(v, 100))) / 100; });
      number(C, T, 'image_strokew', 'Moldura', num(item.strokeWidth, 0), { min: 0, max: 10, passo: 0.5, casasDecimais: 1, unidade: 'px' }, (it, v) => { it.strokeWidth = Math.max(0, num(v, 0)); });
      color(C, T, 'image_stroke', 'Cor da moldura', colorHex(item.strokeColor, '#000000'), (it, v) => { it.strokeColor = v; });
      number(C, T, 'image_rot', 'Rotação', num(item.rotation, 0), { min: -360, max: 360, unidade: '°' }, (it, v) => { it.rotation = num(v, 0); });
      if (item.imageUrl) {
        action(C, T, 'image_clear', 'Imagem', 'Limpar imagem', (c, { updateCurrent }) => {
          updateCurrent(it => { it.imageUrl = ''; }, false, false, 'image_clear');
          c.updatePropertiesPanel();
        });
      }
    } else if (type === 'label') this.labelFields(item, { text, check, color, select, number, font });
    else if (type === 'title_block') this.titleBlockFields(item, composer, { text, check, color, number, action });
    return out;
  }

  /** Entrada pelo id da propriedade (para tratar `ui-propriedade-alterada` e `ui-acao-clique`) */
  static find(item, composer, id) {
    return this.build(item, composer).find(e => e.prop.id === id) || null;
  }

  /** Entradas agrupadas na ordem em que aparecem, no formato `categorias` do kit */
  static categories(item, composer) {
    const groups = new Map();
    this.build(item, composer).forEach(e => {
      if (!groups.has(e.category)) groups.set(e.category, { id: `item_${e.category}`, titulo: e.title, aberto: true, propriedades: [] });
      groups.get(e.category).propriedades.push(e.prop);
    });
    return [...groups.values()];
  }

  // --- Mapa e mapa de localização ---------------------------------------------------------------
  static mapFields(item, composer, { field, action, select, number, check }) {
    const C = 'mapa', T = item.type === 'inset_map' ? 'Mapa de localização' : 'Mapa';
    const basemap = BasemapCatalog.normalize(composer.basemapFor ? composer.basemapFor(item)
      : (item.basemap || (item.type === 'inset_map' ? 'esri_light' : composer.currentBasemap)));
    const byTemplate = PrintViewResolver.isLockedByTemplate(item, composer.library, 'basemap');
    field(C, T, {
      id: 'map_basemap', rotulo: 'Camada base', tipo: 'selecao', valor: basemap,
      opcoes: BasemapCatalog.list().map(b => ({ id: b.id, rotulo: `${b.icon} ${b.name}${b.exportable ? '' : ' (pode não sair no PDF)'}` })),
      somenteLeitura: byTemplate, ...(byTemplate ? { dica: 'Controlado pelo modelo de vista' } : {})
    }, (it, v) => {
      it.basemap = v;
      const map = composer.leafletMaps?.get(it.id);
      if (map) composer.applyBasemapToMap(map, v);
    });
    number(C, T, 'map_scale', 'Escala (1:)', num(item.scale, 10000), { min: 100, passo: 500 },
      (it, v) => { it.scale = Math.max(100, num(v, 10000)); }, { map: true });
    number(C, T, 'map_rotation', 'Rotação', num(item.rotation, 0), { min: 0, max: 360, unidade: '°' },
      (it, v) => { it.rotation = num(v, 0); }, { map: true });
    check(C, T, 'map_grid', 'Grade de coordenadas', item.showGrid, (it, v) => { it.showGrid = Boolean(v); });
    if (item.showGrid) {
      select(C, T, 'map_grid_type', 'Tipo de grade', item.gridType === 'utm' ? 'utm' : 'dms',
        options([['dms', 'Geográfica (DMS)'], ['utm', 'Métrica UTM (m)']]), (it, v) => { it.gridType = v; }, { refresh: 'grid' });
      select(C, T, 'map_grid_format', 'Estilo da grade', item.gridFormat || 'crosses',
        options([['crosses', 'Cruzetas e ticks (+)'], ['lines', 'Linhas contínuas'], ['ticks', 'Apenas ticks nas bordas']]), (it, v) => { it.gridFormat = v; }, { refresh: 'grid' });
      select(C, T, 'map_grid_label_rot', 'Rótulos laterais', item.gridLabelRot || 'vertical',
        options([['vertical', 'Vertical (padrão ABNT/QGIS)'], ['horizontal', 'Horizontal']]), (it, v) => { it.gridLabelRot = v; }, { refresh: 'grid' });
    }
    action(C, T, 'map_pan', 'Enquadramento', 'Enquadrar terreno neste mapa', (c) => c.setInteractionMode('content_pan'));
    if (item.type !== 'map') return;

    const view = PrintViewResolver.effectiveView(item, composer.library);
    const layers = composer.layers || [];
    const hiddenLayers = view.followProject
      ? layers.filter(l => l.visible === false).length
      : layers.filter(l => view.layers?.[l.id]?.visible === false).length;
    const styled = Object.values(view.layers || {}).filter(o => o && (o.stroke || o.fill || o.halftone)).length;
    const activeFilters = (view.filters || []).filter(f => f.enabled !== false).length;
    const labels = Object.values(view.labels || {}).filter(l => l && l.show).length;
    const summary = [
      view.followProject ? 'espelha o mapa principal' : `${hiddenLayers} camada(s) oculta(s)`,
      styled ? `${styled} com gráficos próprios` : '',
      activeFilters ? `${activeFilters} filtro(s)` : '',
      labels ? `${labels} com rótulo` : ''
    ].filter(Boolean).join(' · ');
    const V = 'vista', VT = 'Vista do mapa';
    field(V, VT, { id: 'view_template', rotulo: 'Modelo', tipo: 'readonly', valor: view.template ? view.template.name : 'Sem modelo' });
    field(V, VT, { id: 'view_summary', rotulo: 'Resumo', tipo: 'readonly', valor: summary });
    action(V, VT, 'view_open', 'Visibilidade', 'Visibilidade/Gráficos (VV)', (c) => c.openVisibilityDialog(c.selectedItemId), 'Visibilidade e gráficos deste mapa (V V)');

    // Isolar/ocultar temporário e "Revelar ocultos": só na tela, não salvam nem exportam
    const temp = composer.tempViews?.get?.(item.id) || null;
    const revealing = Boolean(composer.revealHidden?.has?.(item.id));
    const TC = 'temporario', TT = 'Temporário (não sai no PDF)';
    const kept = composer.panelTransient?.temp_layer;
    const layerId = layers.some(l => String(l.id) === String(kept)) ? kept : layers[0]?.id;
    const currentLayer = (c, panel) => panel?.obterValor?.('temp_layer') ?? layerId;
    if (layers.length) {
      field(TC, TT, { id: 'temp_layer', rotulo: 'Camada', tipo: 'selecao', valor: layerId, opcoes: layers.map(l => ({ id: l.id, rotulo: l.name })) }, null, { transient: true });
      action(TC, TT, 'temp_isolate', 'Isolar', 'Mostrar só esta camada', (c, { panel }) => {
        const id = currentLayer(c, panel);
        if (id) c.setTempView(c.selectedItemId, { isolateLayers: new Set([id]) });
      });
      action(TC, TT, 'temp_hide', 'Ocultar', 'Esconder esta camada', (c, { panel }) => {
        const cur = c.tempViews.get(c.selectedItemId);
        const hide = new Set([...(cur?.hideLayers || []), currentLayer(c, panel)].filter(Boolean));
        c.setTempView(c.selectedItemId, { ...(cur || {}), hideLayers: hide });
      });
    }
    action(TC, TT, 'temp_isolate_feature', 'Feição', 'Isolar feição (clique no mapa)', async (c) => {
      const itemId = c.selectedItemId;
      const feat = await c.pickFeature(itemId, { message: 'Clique na feição que deve ficar sozinha no mapa (Esc cancela).' });
      if (feat) c.setTempView(itemId, { isolateFeatures: new Set([String(feat.id)]) });
    });
    action(TC, TT, 'temp_reveal', 'Ocultos', revealing ? '✓ Revelando ocultos' : 'Revelar ocultos', (c) => c.toggleRevealHidden(c.selectedItemId));
    if (temp) action(TC, TT, 'temp_reset', 'Restaurar', 'Voltar à vista salva', (c) => c.setTempView(c.selectedItemId, null));
  }

  // --- Legenda ----------------------------------------------------------------------------------
  static legendFields(item, composer, { text, check, color, select, number, font }) {
    const C = 'legenda', T = 'Legenda';
    text(C, T, 'legend_title', 'Título (vazio = sem título)', item.title ?? PrintItemsManager.DEFAULT_LEGEND_TITLE, (it, v) => { it.title = String(v); });
    select(C, T, 'legend_columns', 'Colunas', Math.min(3, Math.max(1, num(item.legendColumns, 1))), [{ id: 1, rotulo: '1' }, { id: 2, rotulo: '2' }, { id: 3, rotulo: '3' }],
      (it, v) => { it.legendColumns = Math.min(3, Math.max(1, parseInt(v, 10) || 1)); });
    font(C, T, 'legend_font');
    const maps = (composer.items || []).filter(i => i.type === 'map');
    if (maps.length > 1) {
      const mapItem = PrintItemsManager.legendMapItem(item, composer.items || []);
      select(C, T, 'legend_map', 'Mapa vinculado', mapItem?.id || '', maps.map(m => ({ id: m.id, rotulo: m.name || 'Mapa' })),
        (it, v) => { it.mapItemId = v; }, { rebuild: true });
    }
    const K = 'conteudo', KT = 'Conteúdo e métricas';
    check(K, KT, 'legend_count', 'Contagem de feições', item.showFeatureCount, (it, v) => { it.showFeatureCount = Boolean(v); });
    check(K, KT, 'legend_area', 'Soma de área (ha)', item.showAreaHa, (it, v) => { it.showAreaHa = Boolean(v); });
    const B = 'caixa', BT = 'Aparência da caixa';
    check(B, BT, 'legend_hdr_bg', 'Faixa de fundo no título', item.showHeaderBg !== false, (it, v) => { it.showHeaderBg = Boolean(v); });
    color(B, BT, 'legend_hdr_color', 'Cor do cabeçalho', colorHex(item.headerColor, '#000000'), (it, v) => { it.headerColor = v; });
    check(B, BT, 'legend_border', 'Moldura ao redor', item.showBorder !== false, (it, v) => { it.showBorder = Boolean(v); });
    number(B, BT, 'legend_alpha', 'Opacidade do fundo', Math.round((item.bgOpacity == null ? 0.95 : num(item.bgOpacity, 0.95)) * 100),
      { min: 0, max: 100, passo: 5, unidade: '%' }, (it, v) => { it.bgOpacity = Math.max(0, Math.min(100, num(v, 0))) / 100; });
  }

  // --- Tabela de vértices e quadro de áreas -------------------------------------------------------
  static verticesFields(item, composer, { text, check, color, select, number, action }) {
    const C = 'tabela', T = 'Tabela';
    const mode = item.tableMode === 'areas' ? 'areas' : 'vertices';
    const crs = item.crs === 'dms' ? 'dms' : 'utm';
    select(C, T, 'vert_mode', 'Modo', mode, options([['vertices', 'Tabela de vértices (geodésica)'], ['areas', 'Quadro resumo de áreas']]),
      (it, v) => { it.tableMode = v; }, { rebuild: true });
    text(C, T, 'vert_title', 'Título (opcional)', item.title || '', (it, v) => { it.title = String(v); });
    if (mode === 'vertices') {
      const polygons = (composer.features || []).filter(f => ['polygon', 'multipolygon', 'linestring', 'line'].includes((f.type || '').toLowerCase()));
      select(C, T, 'vert_feature', 'Feição de referência', item.targetFeatureId || '',
        [{ id: '', rotulo: '— Automático (1º polígono) —' }, ...polygons.map(f => ({ id: f.id, rotulo: f.name || String(f.id) }))],
        (it, v) => { it.targetFeatureId = v || null; });
      select(C, T, 'vert_crs', 'Sistema (CRS)', crs, options([['utm', 'UTM SIRGAS 2000 (m)'], ['dms', "Geográficas (G°M'S\")"]]),
        (it, v) => { it.crs = v; it.columns = null; });
      select(C, T, 'vert_segfmt', '1ª coluna', item.segmentFormat || 'vertex', options([['vertex', 'Ponto (V01)'], ['segment', 'Segmento (V01 → V02)']]),
        (it, v) => { it.segmentFormat = v; });
      text(C, T, 'vert_prefix', 'Prefixo dos vértices', item.vertexPrefix || 'V', (it, v) => { it.vertexPrefix = String(v); });

      const colDefs = crs === 'dms'
        ? [['name', 'Vértice'], ['latDms', 'Latitude'], ['lngDms', 'Longitude'], ['azimuth', 'Azimute'], ['distance', 'Distância']]
        : [['name', 'Vértice'], ['northing', 'Norte (Y)'], ['easting', 'Leste (X)'], ['azimuth', 'Azimute'], ['distance', 'Distância']];
      const active = Array.isArray(item.columns) && item.columns.length ? item.columns : colDefs.map(([k]) => k);
      const activeSet = new Set(active);
      colDefs.forEach(([k, label]) => {
        check('colunas', 'Colunas visíveis', `vert_col:${k}`, label, activeSet.has(k), (it, v) => {
          const keep = new Set(Array.isArray(it.columns) && it.columns.length ? it.columns : colDefs.map(([key]) => key));
          if (v) keep.add(k); else keep.delete(k);
          it.columns = colDefs.map(([key]) => key).filter(key => keep.has(key));
        }, {
          // Sempre sobra ao menos uma coluna
          guard: (it, v) => v || activeSet.size > 1 || !activeSet.has(k)
        });
      });
      const R = 'intervalo', RT = 'Intervalo / paginação';
      number(R, RT, 'vert_start', 'Vértice inicial', num(item.startVertex, 1), { min: 1 }, (it, v) => { it.startVertex = Math.max(1, parseInt(v, 10) || 1); });
      number(R, RT, 'vert_end', 'Vértice final (0 = fim)', num(item.endVertex, 0), { min: 0 }, (it, v) => { it.endVertex = Math.max(0, parseInt(v, 10) || 0); });
      action(R, RT, 'vert_split', 'Continuação', 'Dividir em tabela de continuação', (c) => {
        const created = c.splitVerticesTableContinuation?.(c.selectedItemId);
        if (!created) UIToast.notificar({ tipo: 'info', titulo: 'Tabela já completa', mensagem: 'Todos os vértices exibidos já cabem na tabela atual.', duracao: 2500 });
      }, 'Cria uma segunda tabela ao lado com os vértices que não couberam');
    }
    const A = 'tabela_aparencia', AT = 'Aparência da tabela';
    color(A, AT, 'vert_hdr_color', 'Cor do cabeçalho', colorHex(item.headerBgColor, '#000000'), (it, v) => { it.headerBgColor = v; });
    check(A, AT, 'vert_footer', 'Rodapé (área / perímetro)', item.showFooter !== false, (it, v) => { it.showFooter = Boolean(v); });
  }

  // --- Bloco de notas ---------------------------------------------------------------------------
  static textBlockFields(item, { text, check, color, select, number, font, action }) {
    const C = 'texto', T = 'Bloco de texto';
    text(C, T, 'text_title', 'Título do bloco', item.title || '', (it, v) => { it.title = String(v); });
    check(C, T, 'text_show_title', 'Exibir título', item.showTitle !== false, (it, v) => { it.showTitle = Boolean(v); });
    action(C, T, 'text_memorial', 'Memorial', 'Gerar memorial descritivo ABNT', (c, { updateCurrent }) => {
      const memorial = PrintItemsManager.generateDescriptiveMemorial(c.features, null);
      updateCurrent(it => { it.title = 'MEMORIAL DESCRITIVO'; it.text = memorial; }, false, false, 'text_memorial');
      c.updatePropertiesPanel();
      UIToast.notificar({ tipo: 'sucesso', titulo: 'Memorial Gerado', mensagem: 'Memorial descritivo ABNT preenchido a partir da feição.', duracao: 2500 });
    }, 'Gera o memorial descritivo ABNT a partir das feições do projeto');
    const Y = 'texto_tipo', YT = 'Tipografia e layout';
    number(Y, YT, 'text_size', 'Tamanho da fonte', num(item.fontSize, 7.5), { min: 5, max: 18, passo: 0.5, casasDecimais: 1, unidade: 'pt' }, (it, v) => { it.fontSize = num(v, 7.5); });
    font(Y, YT, 'text_font');
    select(Y, YT, 'text_align', 'Alinhamento', item.textAlign || 'left', options([['left', 'À esquerda'], ['justify', 'Justificado'], ['center', 'Centralizado'], ['right', 'À direita']]), (it, v) => { it.textAlign = v; });
    select(Y, YT, 'text_cols', 'Colunas de texto', Number(item.columns) === 2 ? 2 : 1, [{ id: 1, rotulo: '1' }, { id: 2, rotulo: '2' }], (it, v) => { it.columns = parseInt(v, 10) === 2 ? 2 : 1; });
    const K = 'texto_cores', KT = 'Cores e moldura';
    color(K, KT, 'text_color', 'Cor do texto', colorHex(item.textColor, '#1f2937'), (it, v) => { it.textColor = v; });
    color(K, KT, 'text_hdr_color', 'Cor do cabeçalho', colorHex(item.headerColor, '#111827'), (it, v) => { it.headerColor = v; });
    check(K, KT, 'text_border', 'Borda ao redor', item.showBorder !== false, (it, v) => { it.showBorder = Boolean(v); });
  }

  // --- Forma ------------------------------------------------------------------------------------
  static shapeFields(item, { color, select, number }) {
    const C = 'forma', T = 'Forma';
    const stype = item.shapeType || 'rect';
    select(C, T, 'shape_type', 'Tipo de forma', stype, PrintItemsManager.SHAPE_TYPES.map(t => ({ id: t.value, rotulo: t.label })), (it, v) => { it.shapeType = v; });
    if (stype === 'arrow') {
      select(C, T, 'shape_arrowhead', 'Pontas da seta', item.arrowHead || 'end', options([['end', 'Ponta única (→)'], ['both', 'Dupla (↔)']]), (it, v) => { it.arrowHead = v; });
    }
    number(C, T, 'shape_rot', 'Rotação', num(item.rotation, 0), { min: -360, max: 360, unidade: '°' }, (it, v) => { it.rotation = num(v, 0); });
    const A = 'forma_aparencia', AT = 'Aparência';
    const fill = PrintItemsManager.parseColor(item.fillColor) || { hex: '#ffffff', alpha: 0.4 };
    const curFill = (it) => PrintItemsManager.parseColor(it.fillColor) || { hex: '#ffffff', alpha: 0.4 };
    color(A, AT, 'shape_fill', 'Cor de preenchimento', fill.hex, (it, v) => { it.fillColor = PrintItemsManager.toRgba(v, curFill(it).alpha); });
    number(A, AT, 'shape_fill_alpha', 'Opacidade do preenchimento', Math.round(fill.alpha * 100), { min: 0, max: 100, passo: 5, unidade: '%' },
      (it, v) => { it.fillColor = PrintItemsManager.toRgba(curFill(it).hex, Math.max(0, Math.min(100, num(v, 0))) / 100); });
    color(A, AT, 'shape_stroke', 'Cor do contorno', colorHex(item.strokeColor, '#000000'), (it, v) => { it.strokeColor = v; });
    select(A, AT, 'shape_strokestyle', 'Estilo do traço', item.strokeStyle || 'solid', PrintItemsManager.STROKE_STYLES.map(s => ({ id: s.value, rotulo: s.label })), (it, v) => { it.strokeStyle = v; });
    number(A, AT, 'shape_strokew', 'Espessura', item.strokeWidth == null ? 1.5 : num(item.strokeWidth, 0), { min: 0, max: 15, passo: 0.5, casasDecimais: 1, unidade: 'px' }, (it, v) => { it.strokeWidth = num(v, 0); });
    number(A, AT, 'shape_radius', 'Raio dos cantos', num(item.borderRadius, 0), { min: 0, max: 60, unidade: 'px' }, (it, v) => { it.borderRadius = Math.max(0, num(v, 0)); });
  }

  // --- Rótulo -----------------------------------------------------------------------------------
  static labelFields(item, { text, check, color, select, number, font }) {
    const C = 'rotulo', T = 'Rótulo';
    text(C, T, 'label_text', 'Texto (duplo clique edita na folha)', item.text || '', (it, v) => { it.text = String(v); });
    const Y = 'rotulo_tipo', YT = 'Tipografia';
    number(Y, YT, 'label_size', 'Tamanho', num(item.fontSize, 10), { min: 5, max: 72, unidade: 'pt' }, (it, v) => { it.fontSize = num(v, 10); });
    number(Y, YT, 'label_ls', 'Espaço entre letras', num(item.letterSpacing, 0), { min: 0, max: 20, passo: 0.5, casasDecimais: 1, unidade: 'px' }, (it, v) => { it.letterSpacing = Math.max(0, num(v, 0)); });
    font(Y, YT, 'label_font');
    select(Y, YT, 'label_weight', 'Peso', item.fontWeight || 'bold', options([['bold', 'Negrito'], ['normal', 'Normal']]), (it, v) => { it.fontWeight = v; });
    select(Y, YT, 'label_style', 'Estilo', item.fontStyle === 'italic' ? 'italic' : 'normal', options([['normal', 'Regular'], ['italic', 'Itálico']]), (it, v) => { it.fontStyle = v; });
    select(Y, YT, 'label_transform', 'Caixa do texto', item.textTransform || 'none', options([['none', 'Como digitado'], ['uppercase', 'MAIÚSCULAS'], ['lowercase', 'minúsculas']]), (it, v) => { it.textTransform = v; });
    select(Y, YT, 'label_align', 'Alinhamento horizontal', item.textAlign || 'center', options([['center', 'Centro'], ['left', 'Esquerda'], ['right', 'Direita']]), (it, v) => { it.textAlign = v; });
    select(Y, YT, 'label_valign', 'Alinhamento vertical', item.verticalAlign || 'middle', options([['middle', 'Meio'], ['top', 'Topo'], ['bottom', 'Base']]), (it, v) => { it.verticalAlign = v; });
    const K = 'rotulo_cores', KT = 'Cores, caixa e rotação';
    color(K, KT, 'label_color', 'Cor do texto', colorHex(item.textColor, '#000000'), (it, v) => { it.textColor = v; });
    check(K, KT, 'label_bg_on', 'Fundo colorido', Boolean(item.fillColor), (it, v) => { it.fillColor = v ? (it.fillColor || '#ffffff') : ''; });
    color(K, KT, 'label_fill', 'Cor do fundo', colorHex(item.fillColor, '#ffffff'), (it, v) => { it.fillColor = v; });
    number(K, KT, 'label_strokew', 'Borda', num(item.strokeWidth, 0), { min: 0, max: 8, passo: 0.5, casasDecimais: 1, unidade: 'px' }, (it, v) => { it.strokeWidth = Math.max(0, num(v, 0)); });
    color(K, KT, 'label_stroke', 'Cor da borda', colorHex(item.strokeColor, '#000000'), (it, v) => { it.strokeColor = v; });
    number(K, KT, 'label_rot', 'Rotação', num(item.rotation, 0), { min: -360, max: 360, unidade: '°' }, (it, v) => { it.rotation = num(v, 0); });
  }

  // --- Carimbo técnico ABNT ---------------------------------------------------------------------
  static titleBlockFields(item, composer, { text, check, color, number, action }) {
    const p = item.properties || {};
    const set = (key) => (it, v) => { it.properties = it.properties || {}; it.properties[key] = v; };
    const mapScale = composer.items.find(i => i.type === 'map')?.scale;
    const C = 'carimbo', T = 'Dados do carimbo';
    [
      ['tb_header', 'Título da prancha', 'headerTitle'], ['tb_proj', 'Projeto / obra', 'projectName'],
      ['tb_client', 'Proprietário / cliente', 'client'], ['tb_author', 'Responsável técnico', 'author'],
      ['tb_art', 'ART / registro', 'art'], ['tb_datum', 'Sistema geodésico / projeção', 'datum']
    ].forEach(([id, label, key]) => text(C, T, id, label, p[key] || '', set(key)));
    // Digitar uma escala própria desliga o acompanhamento automático do mapa
    text(C, T, 'tb_scale', 'Texto de escala', PrintItemsManager.titleBlockScaleText(p, mapScale), (it, v) => {
      it.properties = it.properties || {};
      it.properties.scaleText = String(v);
      it.properties.scaleAuto = false;
    });
    check(C, T, 'tb_scale_auto', 'Acompanhar a escala do mapa', PrintItemsManager.isTitleBlockScaleAuto(p), (it, v) => {
      it.properties = it.properties || {};
      // Ao desligar, congela o texto que está à mostra (não volta para um valor antigo)
      if (!v) it.properties.scaleText = PrintItemsManager.titleBlockScaleText(it.properties, mapScale);
      it.properties.scaleAuto = Boolean(v);
    });
    text(C, T, 'tb_area', 'Área e perímetro', p.areaPerimeter || '', set('areaPerimeter'));
    action(C, T, 'tb_calc_area', 'Calcular', '⚡ Calcular das feições', (c, { updateCurrent }) => {
      const data = PrintItemsManager.extractVerticesData(c.features);
      if (!(data.totalAreaM2 > 0)) return;
      const txt = `${data.totalAreaM2.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} m² (${data.totalAreaHa.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ha) | P: ${data.totalPerimeter.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} m`;
      updateCurrent(it => set('areaPerimeter')(it, txt), false, false, 'tb_calc_area');
      c.updatePropertiesPanel();
    });
    [
      ['tb_loc', 'Localização / imóvel', 'location'], ['tb_date', 'Data da planta', 'date'],
      ['tb_drawn', 'Desenhista / projetista (opcional)', 'drawnBy'], ['tb_doc', 'Nº do desenho (opcional)', 'docNumber'],
      ['tb_rev', 'Revisão (opcional)', 'revision']
    ].forEach(([id, label, key]) => text(C, T, id, label, p[key] || '', set(key)));
    check(C, T, 'tb_signature', 'Campo de assinatura', p.showSignature === true, (it, v) => set('showSignature')(it, Boolean(v)));

    const F = 'carimbo_campos', FT = 'Campos personalizados';
    const custom = Array.isArray(p.customFields) ? p.customFields : [];
    const edit = (idx, key) => (it, v) => {
      const list = it.properties?.customFields;
      if (Array.isArray(list) && list[idx]) list[idx][key] = String(v);
    };
    custom.forEach((cf, idx) => {
      text(F, FT, `tb_cf_label:${idx}`, `Rótulo ${idx + 1}`, cf.label || '', edit(idx, 'label'));
      text(F, FT, `tb_cf_val:${idx}`, `Valor ${idx + 1}`, cf.value || '', edit(idx, 'value'));
      action(F, FT, `tb_cf_del:${idx}`, `Campo ${idx + 1}`, 'Remover campo', (c, { updateCurrent }) => {
        updateCurrent(it => { if (Array.isArray(it.properties?.customFields)) it.properties.customFields.splice(idx, 1); }, false, false, `tb_cf_del:${idx}`);
        c.updatePropertiesPanel();
      });
    });
    action(F, FT, 'tb_add_custom', 'Novo', '+ Adicionar campo personalizado', (c, { updateCurrent }) => {
      updateCurrent(it => {
        it.properties = it.properties || {};
        const list = Array.isArray(it.properties.customFields) ? [...it.properties.customFields] : [];
        list.push({ label: `Campo ${list.length + 1}`, value: '' });
        it.properties.customFields = list;
      }, false, false, 'tb_add_custom');
      c.updatePropertiesPanel();
    });

    const A = 'carimbo_aparencia', AT = 'Aparência do carimbo';
    color(A, AT, 'tb_accent', 'Cor do cabeçalho', colorHex(p.accentColor, '#000000'), set('accentColor'));
    action(A, AT, 'tb_fit_height', 'Altura', 'Ajustar altura ao conteúdo', (c, { updateCurrent }) => {
      updateCurrent(it => {
        if (it.type !== 'title_block') return;
        // Cresce/encolhe ancorado na borda mais próxima (o carimbo costuma ficar embaixo)
        const anchorBottom = it.y + it.height / 2 > c.paperSize.height / 2;
        const bottom = it.y + it.height;
        it.height = PrintTitleBlockRenderer.idealHeightMm(it, c.projectName);
        if (anchorBottom) it.y = bottom - it.height;
        PrintItemsManager.clampItemToPaper(it, c.paperSize);
      }, false, true, 'tb_fit_height');
      c.updatePropertiesPanel();
    }, 'Ajusta a altura do carimbo ao número de campos');
    action(A, AT, 'tb_sync', 'Projeto', 'Sincronizar com o projeto', (c) => {
      const it = c.items.find(i => i.id === c.selectedItemId);
      if (!it || it.type !== 'title_block' || it.locked) return;
      const updated = PrintItemsManager.syncTitleBlockWithProject(it, c);
      if (updated && updated.length > 0) {
        c.refreshItemContent(it);
        c.updatePropertiesPanel();
        c.pushHistoryState('Sincronizar Selo ABNT');
        UIToast.notificar({ tipo: 'sucesso', titulo: 'Selo ABNT Atualizado', mensagem: `Campos sincronizados: ${updated.join(', ')}.`, duracao: 3000 });
      }
    }, 'Sincroniza projeto, escala, área e data com os dados atuais');
  }
}
