/* ==========================================================================
   ConecteMapas - FeaturePropertiesAdapter
   Responsabilidade Única: Mapeamento de feições GIS para o Web Component
   <ui-tabela-propriedades> da biblioteca Componentes-UI.

   Gravação: toda alteração passa por panel.commitFeatureEdit(), que parte da
   versão mais recente da feição no app (nunca da cópia exibida no painel).
   ========================================================================== */

import { SpatialAlgorithms } from '../../services/SpatialAlgorithms.js';
import { GeoFormats } from '../../services/GeoFormats.js';
import { GeometryVersionManager } from '../../services/GeometryVersionManager.js';
import { FeatureGeometryUtils } from '../../services/MapEngine/FeatureGeometryUtils.js';
import { UIToast } from 'ui-components-kit';

const COORD_DECIMALS = 8;

// Símbolos efetivamente desenhados pelo GeometryLayerBuilder ('pin' = marcador circular padrão)
const MARKER_ICON_OPTIONS = [
  { id: 'pin', rotulo: '⬤ Marcador Padrão' },
  { id: 'tower', rotulo: '🗼 Torre / Antena' },
  { id: 'tree', rotulo: '🌲 Árvore / Vegetação' },
  { id: 'warning', rotulo: '⚠️ Alerta / Risco' },
  { id: 'water', rotulo: '💧 Água / Hidrante' },
  { id: 'boundary', rotulo: '◼ Marco de Divisa' }
];

const DASH_OPTIONS = [
  { id: 'continuous', rotulo: 'Contínua —————' },
  { id: '5, 5', rotulo: 'Tracejada - - - -' },
  { id: '2, 4', rotulo: 'Pontilhada · · · ·' },
  { id: '10, 5, 2, 5', rotulo: 'Traço-Ponto — · — ·' }
];

// Atributos calculados da geometria: exibidos somente leitura (são recalculados a cada gravação)
const METRIC_KEYS = new Set(['Área (ha)', 'Área (m²)', 'Perímetro', 'Extensão', 'Raio', 'Área Coberta']);
// Campos internos geridos por outros controles do inspetor
const HIDDEN_PROP_KEYS = new Set(['radius', 'raio', 'visible', 'status', 'text']);

// Ações que alteram ou removem a feição: bloqueadas quando a feição está travada
const MUTATING_ACTIONS = new Set([
  'acao_promover_oficial', 'acao_editar_vertices', 'acao_simplificar', 'acao_excluir', 'acao_adicionar_atributo'
]);

function parseNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const n = parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export class FeaturePropertiesAdapter {
  /**
   * Traduz o tipo de geometria para rótulo legível em português.
   */
  static translateType(type) {
    return FeatureGeometryUtils.getTypeLabel(type);
  }

  /**
   * Converte a feição selecionada em tipos e categorias para o <ui-tabela-propriedades>.
   * @param {Object} panel - Instância do LayerPanel
   * @param {Object} feat - Feição selecionada
   * @returns {{ tipos: Array, categorias: Array }}
   */
  static gerarConfiguracao(panel, feat) {
    if (!feat) return { tipos: [], categorias: [] };

    const isLocked = feat.locked === true;
    const isPoly = feat.type === 'Polygon';
    const isCircle = feat.type === 'Circle';
    const isLine = feat.type === 'LineString';
    const isPoint = feat.type === 'Point';
    const isText = feat.type === 'Text';
    const coordinates = Array.isArray(feat.coordinates) ? feat.coordinates : [];
    const rings = FeatureGeometryUtils.getVertexRings(feat);
    const allFeatures = (panel.app && Array.isArray(panel.app.features)) ? panel.app.features : (panel.features || []);

    // 1. Cálculos Geodésicos (fonte única: FeatureGeometryUtils)
    let areaM2 = 0;
    let perimeterM = 0;
    let lengthM = 0;
    if (isPoly) {
      areaM2 = panel.calculatePolygonArea(coordinates);
      perimeterM = panel.calculatePolygonPerimeter(coordinates);
    } else if (isCircle) {
      areaM2 = Math.PI * Math.pow(Number(feat.radius) || 0, 2);
    } else if (isLine) {
      lengthM = panel.calculatePolylineLength(coordinates);
    }

    let refCoord = [0, 0];
    if ((isPoint || isText || isCircle) && coordinates.length >= 2 && !Array.isArray(coordinates[0])) {
      refCoord = [Number(coordinates[0]), Number(coordinates[1])];
    } else {
      const pts = rings.flatMap(r => r.points);
      if (pts.length > 0) {
        refCoord = [
          pts.reduce((acc, c) => acc + c[0], 0) / pts.length,
          pts.reduce((acc, c) => acc + c[1], 0) / pts.length
        ];
      }
    }
    const dmsLat = SpatialAlgorithms.ddToDms(refCoord[0], true);
    const dmsLng = SpatialAlgorithms.ddToDms(refCoord[1], false);

    // 2. Estilo (0 é valor válido: não usar "|| padrão")
    const defaultColor = feat.color || '#00E08A';
    const numOr = (v, fallback) => (v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : fallback);
    const style = {
      fillColor: feat.style?.fillColor || defaultColor,
      fillOpacity: numOr(feat.style?.fillOpacity, isLine ? 1 : 0.35),
      strokeColor: feat.style?.strokeColor || defaultColor,
      strokeWidth: numOr(feat.style?.strokeWidth, 2.5),
      strokeDashArray: feat.style?.strokeDashArray || '',
      markerIcon: feat.style?.markerIcon || 'pin',
      markerSize: numOr(feat.style?.markerSize, 24),
      markerRotation: numOr(feat.style?.markerRotation, 0),
      showLabel: feat.style?.showLabel === true,
      labelField: feat.style?.labelField || 'name'
    };

    const layerName = (panel.layers || []).find(l => l.id === feat.layerId)?.name || 'Padrão';

    // 3. Seletor de Tipos do Topo
    const tipos = [
      {
        id: feat.id,
        rotulo: `${feat.name || 'Sem Nome'} (${this.translateType(feat.type)})`,
        subtipo: `Camada: ${layerName} • ID: ${feat.id}`
      }
    ];

    const categorias = [];

    // --- Categoria 1: Identificação & Camada ---
    const linkedFeat = GeometryVersionManager.findLinkedFeature(feat, allFeatures);
    const featStatus = GeometryVersionManager.getFeatureStatus(feat);
    const hasOfficial = GeometryVersionManager.hasOfficialGeometry(feat, allFeatures);

    categorias.push({
      id: 'identificacao',
      titulo: '📌 Identificação & Camada',
      aberto: true,
      propriedades: [
        { id: 'name', rotulo: 'Nome do Elemento', tipo: 'texto', valor: feat.name || '', somenteLeitura: isLocked, placeholder: 'Insira o nome da feição' },
        { id: 'description', rotulo: 'Descrição', tipo: 'texto', valor: feat.description || '', somenteLeitura: isLocked, placeholder: 'Anotações técnicas' },
        {
          id: 'layerId',
          rotulo: 'Camada de Destino',
          tipo: 'selecao',
          valor: feat.layerId || '',
          somenteLeitura: isLocked,
          opcoes: (panel.layers || []).map(l => ({ id: l.id, rotulo: `📁 ${l.name}` }))
        },
        { id: 'locked', rotulo: 'Bloqueado', tipo: 'booleano', valor: isLocked },
        { id: 'visible', rotulo: 'Visível no Mapa', tipo: 'booleano', valor: feat.visible !== false, somenteLeitura: isLocked },
        {
          id: 'status_geodesico',
          rotulo: 'Status Geodésico',
          tipo: 'selecao',
          valor: featStatus || 'comum',
          somenteLeitura: isLocked,
          opcoes: [
            { id: 'oficial', rotulo: '🟢 Oficial (Homologada)' },
            { id: 'previa', rotulo: '🟡 Prévia (Proposta / Rascunho)' },
            { id: 'comum', rotulo: '⚪ Padrão / Neutro' }
          ]
        },
        ...(linkedFeat ? [{
          id: 'linked_feature_info',
          rotulo: 'Versão Vinculada',
          tipo: 'readonly',
          valor: `${linkedFeat.name || 'Elemento'} (${GeometryVersionManager.getFeatureStatus(linkedFeat) === 'oficial' ? '🟢 Oficial' : '🟡 Prévia'})`
        }] : []),
        ...(featStatus === 'previa' && !hasOfficial ? [{
          id: 'previa_aviso_info',
          rotulo: 'Modo de Exibição',
          tipo: 'readonly',
          valor: '🟡 Padrão (Sem Oficial Cadastrada)'
        }] : []),
        { id: 'id', rotulo: 'Identificador (ID)', tipo: 'readonly', valor: feat.id }
      ]
    });

    // --- Categoria 2: Dimensões & Geometria ---
    const fmt = (n, min, max) => n.toLocaleString('pt-BR', { minimumFractionDigits: min, maximumFractionDigits: max });
    const vertexCount = FeatureGeometryUtils.countVertices(feat);
    const geomProps = [
      { id: 'geom_type', rotulo: 'Tipo Geométrico', tipo: 'readonly', valor: this.translateType(feat.type) }
    ];

    if (isPoly) {
      geomProps.push(
        { id: 'area_ha', rotulo: 'Área (Hectares)', tipo: 'readonly', valor: `${fmt(areaM2 / 10000, 4, 4)} ha` },
        { id: 'area_m2', rotulo: 'Área (m²)', tipo: 'readonly', valor: `${fmt(areaM2, 2, 2)} m²` },
        { id: 'area_alqueire', rotulo: 'Área (Alqueire Paulista)', tipo: 'readonly', valor: `${fmt(areaM2 / 24200, 4, 4)} alq` },
        { id: 'perimetro_m', rotulo: 'Perímetro', tipo: 'readonly', valor: `${fmt(perimeterM, 2, 2)} m` },
        { id: 'vertices_qtd', rotulo: 'Vértices', tipo: 'readonly', valor: `${vertexCount} nós` }
      );
      if (rings.length > 1) {
        const holes = rings.filter(r => !r.label.toLowerCase().includes('externo')).length;
        const parts = rings.length - holes;
        geomProps.push({ id: 'partes_qtd', rotulo: 'Partes / Furos', tipo: 'readonly', valor: `${parts} parte(s) · ${holes} furo(s)` });
      }
    } else if (isLine) {
      geomProps.push(
        { id: 'comprimento_km', rotulo: 'Extensão (km)', tipo: 'readonly', valor: `${fmt(lengthM / 1000, 3, 3)} km` },
        { id: 'comprimento_m', rotulo: 'Extensão (m)', tipo: 'readonly', valor: `${fmt(lengthM, 2, 2)} m` },
        { id: 'vertices_qtd', rotulo: 'Vértices', tipo: 'readonly', valor: `${vertexCount} nós` }
      );
    } else if (isCircle) {
      const r = Number(feat.radius) || 0;
      geomProps.push(
        { id: 'radius', rotulo: 'Raio', tipo: 'numero', valor: r, unidade: 'm', casasDecimais: 2, somenteLeitura: isLocked },
        { id: 'diametro_m', rotulo: 'Diâmetro', tipo: 'readonly', valor: `${fmt(r * 2, 2, 2)} m` },
        { id: 'area_m2', rotulo: 'Área do Círculo', tipo: 'readonly', valor: `${fmt(areaM2, 2, 2)} m² (${fmt(areaM2 / 10000, 4, 4)} ha)` }
      );
    }

    if (isPoint || isText || isCircle) {
      geomProps.push(
        { id: 'lat_dd', rotulo: isCircle ? 'Centro — Latitude' : 'Latitude (DD)', tipo: 'numero', valor: refCoord[0], unidade: '°', casasDecimais: COORD_DECIMALS, somenteLeitura: isLocked },
        { id: 'lng_dd', rotulo: isCircle ? 'Centro — Longitude' : 'Longitude (DD)', tipo: 'numero', valor: refCoord[1], unidade: '°', casasDecimais: COORD_DECIMALS, somenteLeitura: isLocked },
        { id: 'coords_dms', rotulo: 'Coordenadas DMS', tipo: 'readonly', valor: `${dmsLat} | ${dmsLng}` }
      );
    } else if (rings.length > 0) {
      geomProps.push({ id: 'centroide_dms', rotulo: 'Centroide (DMS)', tipo: 'readonly', valor: `${dmsLat} | ${dmsLng}` });
    }

    categorias.push({ id: 'geometria', titulo: '📐 Dimensões & Geometria', aberto: true, propriedades: geomProps });

    // --- Categoria 3: Simbologia & Aparência ---
    const estiloProps = [];

    if (isPoly || isCircle) {
      estiloProps.push(
        { id: 'fillColor', rotulo: 'Preenchimento', tipo: 'cor', valor: style.fillColor, somenteLeitura: isLocked },
        { id: 'fillOpacity', rotulo: 'Opacidade Preenchimento', tipo: 'numero', valor: Math.round(style.fillOpacity * 100), unidade: '%', casasDecimais: 0, somenteLeitura: isLocked },
        { id: 'strokeColor', rotulo: 'Cor da Borda', tipo: 'cor', valor: style.strokeColor, somenteLeitura: isLocked },
        { id: 'strokeWidth', rotulo: 'Espessura da Borda', tipo: 'numero', valor: style.strokeWidth, unidade: 'px', casasDecimais: 1, somenteLeitura: isLocked },
        { id: 'strokeDashArray', rotulo: 'Padrão do Traço', tipo: 'selecao', valor: style.strokeDashArray || 'continuous', somenteLeitura: isLocked, opcoes: DASH_OPTIONS }
      );
    } else if (isLine) {
      estiloProps.push(
        { id: 'strokeColor', rotulo: 'Cor da Linha', tipo: 'cor', valor: style.strokeColor, somenteLeitura: isLocked },
        { id: 'strokeWidth', rotulo: 'Espessura da Linha', tipo: 'numero', valor: style.strokeWidth, unidade: 'px', casasDecimais: 1, somenteLeitura: isLocked },
        { id: 'strokeDashArray', rotulo: 'Padrão do Traço', tipo: 'selecao', valor: style.strokeDashArray || 'continuous', somenteLeitura: isLocked, opcoes: DASH_OPTIONS }
      );
    } else if (isPoint) {
      const iconValue = MARKER_ICON_OPTIONS.some(o => o.id === style.markerIcon) ? style.markerIcon : 'pin';
      estiloProps.push(
        { id: 'pointColor', rotulo: 'Cor do Marcador', tipo: 'cor', valor: style.fillColor || style.strokeColor, somenteLeitura: isLocked },
        { id: 'markerIcon', rotulo: 'Símbolo do Marcador', tipo: 'selecao', valor: iconValue, somenteLeitura: isLocked, opcoes: MARKER_ICON_OPTIONS },
        { id: 'markerSize', rotulo: 'Tamanho do Marcador', tipo: 'numero', valor: style.markerSize, unidade: 'px', casasDecimais: 0, somenteLeitura: isLocked },
        { id: 'markerRotation', rotulo: 'Ângulo de Rotação', tipo: 'numero', valor: style.markerRotation, unidade: '°', casasDecimais: 0, somenteLeitura: isLocked }
      );
    } else if (isText) {
      estiloProps.push(
        { id: 'text_content', rotulo: 'Texto', tipo: 'texto', valor: feat.properties?.text || feat.name || '', somenteLeitura: isLocked },
        { id: 'fontSize', rotulo: 'Tamanho da Fonte', tipo: 'numero', valor: numOr(feat.style?.fontSize, 13), unidade: 'px', casasDecimais: 0, somenteLeitura: isLocked },
        { id: 'textColor', rotulo: 'Cor do Texto', tipo: 'cor', valor: feat.style?.textColor || '#ffffff', somenteLeitura: isLocked }
      );
    }

    // Rótulos dinâmicos no mapa (o texto já é o próprio rótulo)
    if (!isText) {
      estiloProps.push(
        { id: 'showLabel', rotulo: 'Exibir Rótulo no Mapa', tipo: 'booleano', valor: style.showLabel === true, somenteLeitura: isLocked },
        {
          id: 'labelField',
          rotulo: 'Campo do Rótulo',
          tipo: 'selecao',
          valor: style.labelField || 'name',
          somenteLeitura: isLocked,
          opcoes: [
            { id: 'name', rotulo: 'Nome do Elemento' },
            { id: 'description', rotulo: 'Descrição' },
            { id: 'id', rotulo: 'ID do Elemento' },
            { id: 'category', rotulo: 'Categoria' },
            ...(isPoly ? [{ id: 'area', rotulo: 'Área (ha)' }] : []),
            ...(isLine ? [{ id: 'extensao', rotulo: 'Extensão' }] : [])
          ]
        }
      );
    }

    categorias.push({ id: 'simbologia', titulo: '🎨 Aparência & Simbologia', aberto: true, propriedades: estiloProps });

    // --- Categoria 4: Atributos GIS (Shapefile / Propriedades Customizadas) ---
    const attrProps = [];
    if (feat.properties && typeof feat.properties === 'object' && !Array.isArray(feat.properties)) {
      Object.entries(feat.properties).forEach(([key, val]) => {
        if (key.startsWith('_') || HIDDEN_PROP_KEYS.has(key) || (val !== null && typeof val === 'object')) return;
        if (METRIC_KEYS.has(key)) {
          attrProps.push({ id: `metric_${key}`, rotulo: `${key} (calculado)`, tipo: 'readonly', valor: String(val ?? '') });
        } else if (typeof val === 'number') {
          attrProps.push({ id: `prop_${key}`, rotulo: key, tipo: 'numero', valor: val, somenteLeitura: isLocked });
        } else if (typeof val === 'boolean') {
          attrProps.push({ id: `prop_${key}`, rotulo: key, tipo: 'booleano', valor: val, somenteLeitura: isLocked });
        } else {
          attrProps.push({ id: `prop_${key}`, rotulo: key, tipo: 'texto', valor: String(val ?? ''), somenteLeitura: isLocked });
        }
      });
    }

    if (Array.isArray(feat.customAttributes)) {
      feat.customAttributes.forEach((item, idx) => {
        if (item && item.key) {
          attrProps.push({ id: `custom_attr_${idx}`, rotulo: item.key, tipo: 'texto', valor: String(item.value ?? ''), somenteLeitura: isLocked });
        }
      });
    }

    const attrCount = attrProps.length;
    attrProps.push({
      id: 'acao_adicionar_atributo',
      rotulo: 'Novo Atributo',
      tipo: 'acao',
      valor: '+ Adicionar Campo',
      rotuloAcao: '+ Criar Atributo',
      somenteLeitura: isLocked,
      dica: 'Adiciona um novo campo de metadado personalizado'
    });

    categorias.push({
      id: 'atributos',
      titulo: `📋 Atributos (${attrCount})`,
      aberto: attrCount > 0,
      propriedades: attrProps
    });

    // --- Categoria 5: Operações Espaciais & CAD ---
    const acoesProps = [];

    if (linkedFeat) {
      if (featStatus === 'oficial') {
        acoesProps.push({ id: 'acao_alternar_versao_previa', rotulo: 'Versão Geométrica', tipo: 'acao', valor: 'Prévia', rotuloAcao: '🔄 Exibir Geometria Prévia', dica: `Alterna a visualização no mapa para a versão prévia ("${linkedFeat.name || 'Prévia'}")` });
      } else if (featStatus === 'previa') {
        acoesProps.push({ id: 'acao_alternar_versao_oficial', rotulo: 'Versão Geométrica', tipo: 'acao', valor: 'Oficial', rotuloAcao: '🔄 Exibir Geometria Oficial', dica: `Alterna a visualização no mapa para a versão oficial ("${linkedFeat.name || 'Oficial'}")` });
      }
    } else if (featStatus === 'previa' && !hasOfficial) {
      acoesProps.push({ id: 'acao_promover_oficial', rotulo: 'Versão Geométrica', tipo: 'acao', valor: 'Promover', rotuloAcao: '⭐️ Tornar Geometria Oficial', somenteLeitura: isLocked, dica: 'Define esta geometria como a versão oficial definitiva' });
    }

    acoesProps.push(
      { id: 'acao_enquadrar', rotulo: 'Localização', tipo: 'acao', valor: 'Centralizar', rotuloAcao: '🎯 Enquadrar Feição no Mapa', dica: 'Ajusta a câmera do mapa na geometria deste elemento' },
      { id: 'acao_buffer', rotulo: 'Amortecimento', tipo: 'acao', valor: 'Buffer 50m', rotuloAcao: '🔄 Criar Buffer (50m)', dica: 'Cria uma feição de amortecimento de 50 metros no mapa' },
      { id: 'acao_duplicar', rotulo: 'Clonagem', tipo: 'acao', valor: 'Duplicar', rotuloAcao: '📑 Duplicar Feição (+30m)', dica: 'Cria uma cópia do elemento deslocada em 30 metros' }
    );

    if (isPoly || isLine) {
      acoesProps.push(
        {
          id: 'acao_editar_vertices',
          rotulo: 'Edição Vetorial',
          tipo: 'acao',
          valor: panel.isVertexEditing ? 'Concluir' : 'Editar',
          rotuloAcao: panel.isVertexEditing ? '✔ Concluir Edição de Vértices' : '✏️ Editar Vértices no Mapa',
          somenteLeitura: isLocked,
          dica: 'Habilita alças arrastáveis em cada vértice no mapa'
        },
        { id: 'acao_simplificar', rotulo: 'Otimização', tipo: 'acao', valor: 'Simplificar', rotuloAcao: '📉 Simplificar Vértices (DP 5m)', somenteLeitura: isLocked, dica: 'Aplica algoritmo Douglas-Peucker com 5m de tolerância' }
      );
    }

    acoesProps.push(
      { id: 'acao_copiar_geojson', rotulo: 'Exportação', tipo: 'acao', valor: 'GeoJSON', rotuloAcao: '📋 Copiar GeoJSON', dica: 'Copia a geometria GeoJSON para a área de transferência' },
      { id: 'acao_copiar_wkt', rotulo: 'Exportação', tipo: 'acao', valor: 'WKT', rotuloAcao: '📋 Copiar WKT (CAD)', dica: 'Copia o texto Well-Known Text para CAD/GIS' },
      { id: 'acao_excluir', rotulo: 'Remoção', tipo: 'acao', valor: 'Excluir', rotuloAcao: '🗑️ Excluir Feição', somenteLeitura: isLocked, dica: 'Remove permanentemente esta feição do projeto' }
    );

    categorias.push({ id: 'acoes', titulo: '⚡ Operações Rápidas & CAD', aberto: true, propriedades: acoesProps });

    return { tipos, categorias };
  }

  /**
   * Pré-visualização de cor no mapa, sem gravar (usada enquanto o seletor é arrastado).
   */
  static previewAlteracao(panel, featId, propId, valor) {
    const engine = panel.app && panel.app.mapEngine;
    const latest = panel.getLatestFeature(featId);
    if (!engine || !latest || latest.locked === true) return;
    const preview = { ...latest, style: { ...(latest.style || {}) } };
    if (propId === 'fillColor') { preview.style.fillColor = valor; preview.color = valor; }
    else if (propId === 'strokeColor') preview.style.strokeColor = valor;
    else if (propId === 'pointColor') { preview.style.fillColor = valor; preview.style.strokeColor = valor; preview.color = valor; }
    else if (propId === 'textColor') preview.style.textColor = valor;
    engine.updateFeature(preview, panel.app.layers);
  }

  /**
   * Aplica a alteração de propriedade disparada pelo evento 'ui-propriedade-alterada'.
   * @param {Object} panel - Instância do LayerPanel
   * @param {string} featId - ID da feição
   * @param {string} propId - ID da propriedade alterada
   * @param {any} novoValor - Novo valor recebido
   */
  static aplicarAlteracao(panel, featId, propId, novoValor) {
    // Cores não alteram nenhum valor derivado: grava sem recriar a tabela (seletor pode seguir aberto)
    const rerender = !['fillColor', 'strokeColor', 'pointColor', 'textColor'].includes(propId);
    const latest = panel.getLatestFeature(featId) || panel.selectedFeature;
    if (!latest) return;

    // Feição travada: só o próprio bloqueio pode ser alterado
    if (latest.locked === true && propId !== 'locked') {
      UIToast.notificar({ tipo: 'alerta', titulo: 'Elemento Travado', mensagem: 'Desbloqueie o elemento para editar.', duracao: 2500 });
      panel.refreshSelectedFeature(latest, { immediate: true });
      return;
    }

    let statusLabel = null;
    let rejectedMessage = null;

    const saved = panel.commitFeatureEdit(featId, (draft) => {
      if (!draft.style) draft.style = {};
      if (!draft.properties || typeof draft.properties !== 'object' || Array.isArray(draft.properties)) draft.properties = {};

      switch (propId) {
        case 'name': {
          const name = String(novoValor ?? '').trim();
          if (!name) { rejectedMessage = 'O nome não pode ficar vazio.'; return false; }
          draft.name = name;
          return;
        }
        case 'description':
          draft.description = String(novoValor ?? '').trim();
          return;
        case 'layerId':
          if (!(panel.layers || []).some(l => l.id === novoValor)) return false;
          draft.layerId = String(novoValor);
          return;
        case 'locked':
          draft.locked = !!novoValor;
          return;
        case 'visible':
          draft.visible = !!novoValor;
          return;
        case 'radius': {
          const r = parseNumber(novoValor);
          if (r === null || r <= 0) { rejectedMessage = 'O raio deve ser maior que zero.'; return false; }
          draft.radius = r;
          return;
        }
        case 'lat_dd':
        case 'lng_dd': {
          const v = parseNumber(novoValor);
          const isLat = propId === 'lat_dd';
          const limit = isLat ? 90 : 180;
          if (v === null || Math.abs(v) > limit) { rejectedMessage = `${isLat ? 'Latitude' : 'Longitude'} deve estar entre -${limit} e ${limit}.`; return false; }
          if (!Array.isArray(draft.coordinates) || Array.isArray(draft.coordinates[0])) return false;
          draft.coordinates = [...draft.coordinates];
          draft.coordinates[isLat ? 0 : 1] = v;
          return;
        }
        case 'text_content': {
          const text = String(novoValor ?? '').trim();
          if (!text) { rejectedMessage = 'O texto não pode ficar vazio.'; return false; }
          const oldText = draft.properties.text || '';
          draft.properties.text = text;
          if (!draft.name || draft.name === oldText) draft.name = text;
          return;
        }
        case 'fontSize': {
          const n = parseNumber(novoValor);
          if (n === null) return false;
          draft.style.fontSize = clamp(Math.round(n), 8, 96);
          return;
        }
        case 'textColor':
          draft.style.textColor = novoValor;
          return;

        // Estilo Visual
        case 'fillColor':
          draft.style.fillColor = novoValor;
          draft.color = novoValor;
          return;
        case 'fillOpacity': {
          const n = parseNumber(novoValor);
          if (n === null) return false;
          draft.style.fillOpacity = clamp(n, 0, 100) / 100;
          return;
        }
        case 'strokeColor':
          draft.style.strokeColor = novoValor;
          return;
        case 'pointColor':
          draft.style.fillColor = novoValor;
          draft.style.strokeColor = novoValor;
          draft.color = novoValor;
          return;
        case 'strokeWidth': {
          const n = parseNumber(novoValor);
          if (n === null) return false;
          draft.style.strokeWidth = clamp(n, 0, 50);
          return;
        }
        case 'strokeDashArray':
          draft.style.strokeDashArray = novoValor === 'continuous' ? '' : novoValor;
          return;
        case 'markerIcon':
          draft.style.markerIcon = MARKER_ICON_OPTIONS.some(o => o.id === novoValor) ? novoValor : 'pin';
          return;
        case 'markerSize': {
          const n = parseNumber(novoValor);
          if (n === null) return false;
          draft.style.markerSize = clamp(Math.round(n), 8, 96);
          return;
        }
        case 'markerRotation': {
          const n = parseNumber(novoValor);
          if (n === null) return false;
          draft.style.markerRotation = ((Math.round(n) % 360) + 360) % 360;
          return;
        }
        case 'showLabel':
          draft.style.showLabel = !!novoValor;
          return;
        case 'labelField':
          draft.style.labelField = novoValor;
          return;
        case 'status_geodesico': {
          const s = novoValor === 'comum' ? null : novoValor;
          draft.status = s;
          if (s) draft.properties.status = s;
          else delete draft.properties.status;
          statusLabel = novoValor === 'oficial' ? 'Oficial' : (novoValor === 'previa' ? 'Prévia' : 'Padrão');
          return;
        }
        default:
          if (propId.startsWith('prop_')) {
            const key = propId.slice('prop_'.length);
            if (METRIC_KEYS.has(key)) return false;
            const previous = draft.properties[key];
            if (typeof previous === 'number') {
              const n = parseNumber(novoValor);
              if (n === null) { rejectedMessage = `"${key}" deve ser numérico.`; return false; }
              draft.properties[key] = n;
            } else {
              draft.properties[key] = novoValor;
            }
            return;
          }
          if (propId.startsWith('custom_attr_')) {
            const idx = parseInt(propId.slice('custom_attr_'.length), 10);
            if (!Array.isArray(draft.customAttributes) || !draft.customAttributes[idx]) return false;
            draft.customAttributes[idx].value = novoValor;
            return;
          }
          return false;
      }
    }, { rerender });

    if (!saved) {
      if (rejectedMessage) UIToast.notificar({ tipo: 'alerta', titulo: 'Valor Inválido', mensagem: rejectedMessage, duracao: 3000 });
      // Restaura o valor exibido na tabela
      panel.refreshSelectedFeature(panel.getLatestFeature(featId) || latest, { immediate: true });
      return;
    }

    if (statusLabel) {
      // O mapa decide oficial x prévia pelo status: atualiza depois de gravar
      if (panel.app && typeof panel.app.refreshMapAndTable === 'function') panel.app.refreshMapAndTable();
    }
  }

  /**
   * Trata o clique de ações embutidas na paleta de propriedades.
   * @param {Object} panel - Instância do LayerPanel
   * @param {string} featId - ID da feição
   * @param {string} acaoId - ID da ação acionada
   */
  static executarAcao(panel, featId, acaoId) {
    const feat = panel.getLatestFeature(featId) || panel.selectedFeature;
    if (!feat) return;

    if (feat.locked === true && MUTATING_ACTIONS.has(acaoId)) {
      UIToast.notificar({ tipo: 'alerta', titulo: 'Elemento Travado', mensagem: 'Desbloqueie o elemento antes desta operação.', duracao: 2500 });
      return;
    }

    switch (acaoId) {
      case 'acao_alternar_versao_previa':
      case 'acao_alternar_versao_oficial':
        if (panel.app && typeof panel.app.toggleFeatureGeometryVersion === 'function') {
          panel.app.toggleFeatureGeometryVersion(feat.id);
        }
        break;

      case 'acao_promover_oficial': {
        const saved = panel.commitFeatureEdit(featId, (draft) => {
          draft.status = 'oficial';
          draft.properties = { ...(draft.properties || {}), status: 'oficial' };
        });
        if (!saved) break;
        if (panel.app && typeof panel.app.refreshMapAndTable === 'function') panel.app.refreshMapAndTable();
        break;
      }

      case 'acao_enquadrar':
        panel.onFitFeature(feat.id);
        break;

      case 'acao_buffer': {
        const radius = 50;
        const bufferFeature = SpatialAlgorithms.generateBuffer(feat, radius);
        if (bufferFeature) {
          panel.onFeatureCreate(bufferFeature);
        }
        break;
      }

      case 'acao_duplicar': {
        const clone = SpatialAlgorithms.duplicateWithOffset(feat, 30);
        if (clone) {
          panel.onFeatureCreate(clone);
        }
        break;
      }

      case 'acao_editar_vertices':
        panel.toggleVertexEditing();
        break;

      case 'acao_simplificar': {
        const before = FeatureGeometryUtils.countVertices(feat);
        const isPoly = feat.type === 'Polygon';
        const minVertices = isPoly ? 3 : 2;
        const saved = panel.commitFeatureEdit(featId, (draft) => {
          // Simplifica cada anel/parte isoladamente, sem o vértice de fechamento duplicado
          let coords = draft.coordinates;
          for (const ring of FeatureGeometryUtils.getVertexRings(draft)) {
            const simplified = SpatialAlgorithms.simplifyDouglasPeucker(ring.points, 5, isPoly);
            if (Array.isArray(simplified) && simplified.length >= minVertices && simplified.length < ring.points.length) {
              coords = FeatureGeometryUtils.replaceRing(coords, ring.path, simplified, ring.closed);
            }
          }
          if (coords === draft.coordinates) return false;
          draft.coordinates = coords;
        });
        const reduced = saved ? before - FeatureGeometryUtils.countVertices(saved) : 0;
        UIToast.notificar({
          tipo: 'sucesso',
          titulo: 'Geometria Otimizada',
          mensagem: reduced > 0 ? `${reduced} vértices removidos (tolerância 5m).` : 'Geometria já possui quantidade ótima de vértices.',
          duracao: 2500
        });
        break;
      }

      case 'acao_copiar_geojson':
        this.copyToClipboard(GeoFormats.toGeoJSON([feat]), 'GeoJSON Copiado', 'GeoJSON copiado para a área de transferência.');
        break;

      case 'acao_copiar_wkt':
        this.copyToClipboard(GeoFormats.toWKT(feat), 'WKT Copiado', 'WKT copiado para a área de transferência.');
        break;

      case 'acao_excluir':
        this.confirmDelete(panel, featId);
        break;

      case 'acao_adicionar_atributo': {
        const chave = prompt('Informe o nome do novo atributo / campo:');
        if (!chave || !chave.trim()) return;
        const chaveLimpa = chave.trim();
        const exists = (Array.isArray(feat.customAttributes) && feat.customAttributes.some(a => a && a.key === chaveLimpa))
          || (feat.properties && Object.prototype.hasOwnProperty.call(feat.properties, chaveLimpa));
        if (exists) {
          UIToast.notificar({ tipo: 'alerta', titulo: 'Campo Existente', mensagem: `O atributo "${chaveLimpa}" já existe nesta feição.` });
          return;
        }
        const saved = panel.commitFeatureEdit(featId, (draft) => {
          draft.customAttributes = Array.isArray(draft.customAttributes) ? draft.customAttributes : [];
          draft.customAttributes.push({ key: chaveLimpa, value: '' });
        });
        break;
      }
    }
  }

  static confirmDelete(panel, featId) {
    const feat = panel.getLatestFeature(featId) || panel.selectedFeature;
    if (!feat) return;
    if (feat.locked === true) {
      UIToast.notificar({ tipo: 'alerta', titulo: 'Elemento Travado', mensagem: 'Desbloqueie o elemento antes de excluir.' });
      return;
    }
    if (confirm(`Deseja realmente excluir a feição "${feat.name || 'Sem Nome'}"?`)) {
      // O controlador notifica o painel (handleSelectedFeatureRemoved) após excluir
      panel.onDeleteFeature(feat.id);
    }
  }

  static copyToClipboard(text, titulo, mensagem) {
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      UIToast.notificar({ tipo: 'erro', titulo: 'Erro', mensagem: 'Área de transferência indisponível neste navegador.' });
      return;
    }
    navigator.clipboard.writeText(text)
      .then(() => UIToast.notificar({ tipo: 'sucesso', titulo, mensagem }))
      .catch(() => UIToast.notificar({ tipo: 'erro', titulo: 'Erro', mensagem: 'Não foi possível acessar a área de transferência.' }));
  }
}
