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
import { BatchActions } from '../../services/BatchActions.js';
import { UIToast } from '@thibezer/ui-components-kit';

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

// O editor 'linha' do kit desenha a amostra a partir do id (contínua, tracej…, pontilh…, traço-ponto)
const DASH_OPTIONS = [
  { id: 'continua', rotulo: 'Contínua', dash: '' },
  { id: 'tracejada', rotulo: 'Tracejada', dash: '5, 5' },
  { id: 'pontilhada', rotulo: 'Pontilhada', dash: '2, 4' },
  { id: 'traço-ponto', rotulo: 'Traço-ponto', dash: '10, 5, 2, 5' }
];

// Métricas gravadas nas propriedades (recalculadas a cada gravação): exibidas só em Geometria
const METRIC_KEYS = new Set(['Área (ha)', 'Área (m²)', 'Perímetro', 'Extensão', 'Raio', 'Área Coberta']);
// Campos internos geridos por outros controles do inspetor
const HIDDEN_PROP_KEYS = new Set(['radius', 'raio', 'visible', 'status', 'text']);

// Ações que alteram ou removem a feição: bloqueadas quando a feição está travada
const MUTATING_ACTIONS = new Set([
  'acao_promover_oficial', 'acao_editar_vertices', 'acao_simplificar', 'acao_adicionar_atributo', 'acao_inverter_cores'
]);

// Seleção múltipla: valor que difere entre as feições (o kit não tem estado "misto")
const VARIA_LABEL = 'Varia';
const VARIA_ID = '__varia__';
const BOOL_TRUE_ID = '__sim__';
const BOOL_FALSE_ID = '__nao__';

function sameValue(prop, a, b) {
  if (prop.tipo === 'numero' && prop.casasDecimais !== undefined && Number.isFinite(Number(a)) && Number.isFinite(Number(b))) {
    return Number(a).toFixed(prop.casasDecimais) === Number(b).toFixed(prop.casasDecimais);
  }
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

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
   * @param {{multi?: boolean}} [options] multi: parte de uma seleção múltipla (sem vínculo de
   *   versões, vértices, azimutes e operações, que são de uma feição só)
   * @returns {{ tipos: Array, categorias: Array }}
   */
  static gerarConfiguracao(panel, feat, { multi = false } = {}) {
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

    const rawFill = feat.style?.fillColor;
    const isFillNone = rawFill === 'none' || rawFill === 'transparent';
    const effectiveFillColor = isFillNone ? (feat.style?._lastFillColor || feat.color || '#00E08A') : (rawFill || defaultColor);

    const rawStroke = feat.style?.strokeColor;
    const isStrokeNone = rawStroke === 'none' || rawStroke === 'transparent';
    const effectiveStrokeColor = isStrokeNone ? (feat.style?._lastStrokeColor || '#ffffff') : (rawStroke || (isLine ? defaultColor : '#ffffff'));

    const style = {
      fillColor: isFillNone ? 'none' : effectiveFillColor,
      effectiveFillColor,
      fillOpacity: numOr(feat.style?.fillOpacity, isLine ? 1 : 0.35),
      strokeColor: isStrokeNone ? 'none' : effectiveStrokeColor,
      effectiveStrokeColor,
      strokeWidth: numOr(feat.style?.strokeWidth, 2.5),
      strokeDashArray: feat.style?.strokeDashArray || '',
      markerIcon: feat.style?.markerIcon || 'pin',
      markerSize: numOr(feat.style?.markerSize, 24),
      markerRotation: numOr(feat.style?.markerRotation, 0),
      showLabel: feat.style?.showLabel === true,
      labelField: feat.style?.labelField || 'name'
    };

    // Nome, tipo e ID já estão no cartão do topo: sem seletor de tipo na tabela
    const tipos = [];
    const categorias = [];

    // --- Categoria 1: Identificação (nome e bloqueio ficam no cartão do topo) ---
    // Vínculo oficial × prévia é por feição (e varre o projeto): fica fora da seleção múltipla
    const linkedFeat = multi ? null : GeometryVersionManager.findLinkedFeature(feat, allFeatures);
    const featStatus = GeometryVersionManager.getFeatureStatus(feat);
    const hasOfficial = multi || GeometryVersionManager.hasOfficialGeometry(feat, allFeatures);

    categorias.push({
      id: 'identificacao',
      titulo: '📌 Identificação',
      aberto: true,
      propriedades: [
        // Uma feição: o nome fica no cartão do topo
        ...(multi ? [{ id: 'name', rotulo: 'Nome', tipo: 'texto', valor: feat.name || '', somenteLeitura: isLocked, placeholder: 'Sem nome' }] : []),
        { id: 'description', rotulo: 'Descrição', tipo: 'texto', valor: feat.description || '', somenteLeitura: isLocked, placeholder: 'Anotações técnicas' },
        {
          id: 'layerId',
          rotulo: 'Camada',
          tipo: 'selecao',
          valor: feat.layerId || '',
          somenteLeitura: isLocked,
          opcoes: (panel.layers || []).map(l => ({ id: l.id, rotulo: l.name }))
        },
        { id: 'visible', rotulo: 'Visível no mapa', tipo: 'booleano', valor: feat.visible !== false, somenteLeitura: isLocked },
        {
          id: 'status_geodesico',
          rotulo: 'Status geodésico',
          tipo: 'selecao',
          valor: featStatus || 'comum',
          somenteLeitura: isLocked,
          opcoes: [
            { id: 'oficial', rotulo: '🟢 Oficial (homologada)' },
            { id: 'previa', rotulo: '🟡 Prévia (proposta)' },
            { id: 'comum', rotulo: '⚪ Padrão' }
          ]
        },
        ...(linkedFeat ? [{
          id: 'linked_feature_info',
          rotulo: 'Versão vinculada',
          tipo: 'readonly',
          valor: `${linkedFeat.name || 'Elemento'} (${GeometryVersionManager.getFeatureStatus(linkedFeat) === 'oficial' ? '🟢 Oficial' : '🟡 Prévia'})`
        }] : []),
        ...(featStatus === 'previa' && !hasOfficial ? [{
          id: 'previa_aviso_info',
          rotulo: 'Exibição',
          tipo: 'readonly',
          valor: '🟡 Prévia sem oficial cadastrada'
        }] : []),
        ...(multi ? [] : [{ id: 'id', rotulo: 'ID', tipo: 'readonly', valor: feat.id }])
      ]
    });

    // --- Categoria 2: Geometria ---
    const fmt = (n, min, max) => n.toLocaleString('pt-BR', { minimumFractionDigits: min, maximumFractionDigits: max });
    const fmtLength = (m) => (m >= 1000 ? `${fmt(m, 2, 2)} m · ${fmt(m / 1000, 3, 3)} km` : `${fmt(m, 2, 2)} m`);
    const vertexCount = FeatureGeometryUtils.countVertices(feat);
    const geomProps = [
      { id: 'geom_type', rotulo: 'Tipo', tipo: 'readonly', valor: this.translateType(feat.type) }
    ];

    if (isPoly) {
      geomProps.push(
        { id: 'area_ha', rotulo: 'Área (ha)', tipo: 'readonly', valor: `${fmt(areaM2 / 10000, 4, 4)} ha` },
        { id: 'area_m2', rotulo: 'Área (m²)', tipo: 'readonly', valor: `${fmt(areaM2, 2, 2)} m²` },
        { id: 'area_alqueire', rotulo: 'Área (alqueire SP)', tipo: 'readonly', valor: `${fmt(areaM2 / 24200, 4, 4)} alq` },
        { id: 'perimetro_m', rotulo: 'Perímetro', tipo: 'readonly', valor: fmtLength(perimeterM) }
      );
      if (rings.length > 1) {
        const holes = rings.filter(r => !r.label.toLowerCase().includes('externo')).length;
        const parts = rings.length - holes;
        geomProps.push({ id: 'partes_qtd', rotulo: 'Partes / furos', tipo: 'readonly', valor: `${parts} parte(s) · ${holes} furo(s)` });
      }
    } else if (isLine) {
      geomProps.push({ id: 'comprimento_m', rotulo: 'Extensão', tipo: 'readonly', valor: fmtLength(lengthM) });
    } else if (isCircle) {
      const r = Number(feat.radius) || 0;
      geomProps.push(
        { id: 'radius', rotulo: 'Raio', tipo: 'numero', valor: r, unidade: 'm', casasDecimais: 2, somenteLeitura: isLocked },
        { id: 'diametro_m', rotulo: 'Diâmetro', tipo: 'readonly', valor: `${fmt(r * 2, 2, 2)} m` },
        { id: 'area_m2', rotulo: 'Área', tipo: 'readonly', valor: `${fmt(areaM2 / 10000, 4, 4)} ha · ${fmt(areaM2, 2, 2)} m²` }
      );
    }

    if (isPoint || isText || isCircle) {
      geomProps.push(
        { id: 'lat_dd', rotulo: isCircle ? 'Centro · latitude' : 'Latitude', tipo: 'numero', valor: refCoord[0], unidade: '°', casasDecimais: COORD_DECIMALS, somenteLeitura: isLocked },
        { id: 'lng_dd', rotulo: isCircle ? 'Centro · longitude' : 'Longitude', tipo: 'numero', valor: refCoord[1], unidade: '°', casasDecimais: COORD_DECIMALS, somenteLeitura: isLocked },
        { id: 'coords_dms', rotulo: 'Em DMS', tipo: 'readonly', valor: `${dmsLat} | ${dmsLng}` }
      );
    } else if (rings.length > 0) {
      geomProps.push({ id: 'centroide_dms', rotulo: 'Centroide (DMS)', tipo: 'readonly', valor: `${dmsLat} | ${dmsLng}` });
    }

    categorias.push({ id: 'geometria', titulo: '📐 Geometria', aberto: true, propriedades: geomProps });

    // --- Categoria 2.1: Vértices (coordenadas editáveis por anel) e Azimutes ---
    if (rings.length > 0 && !multi) {
      categorias.push({
        id: 'vertices',
        titulo: `📍 Vértices (${vertexCount})`,
        aberto: false,
        propriedades: this.buildVertexProps(rings, feat.type, isLocked)
      });
      // Azimutes só fazem sentido para geometria de parte única (anel externo ou linha simples)
      const segments = rings.length === 1 ? FeatureGeometryUtils.calculateSegments(rings[0].points, isPoly) : [];
      if (segments.length > 0) {
        categorias.push({
          id: 'azimutes',
          titulo: '🧭 Azimutes e distâncias',
          aberto: false,
          propriedades: segments.map((seg, i) => ({
            id: `seg_${i}`,
            rotulo: `V${seg.from} → V${seg.to}`,
            tipo: 'readonly',
            valor: `${this.formatAzimuth(seg.azimuth)} · ${seg.distance >= 1000 ? `${fmt(seg.distance / 1000, 3, 3)} km` : `${fmt(seg.distance, 2, 2)} m`}`
          }))
        });
      }
    }

    // --- Categoria 3: Aparência ---
    const estiloProps = [];
    const dashValue = DASH_OPTIONS.find(o => o.dash === style.strokeDashArray)?.id || style.strokeDashArray;
    const strokeRows = (noun) => [
      { id: 'strokeColor', rotulo: `Cor da ${noun}`, tipo: 'cor', valor: style.effectiveStrokeColor, somenteLeitura: isLocked },
      { id: 'strokeWidth', rotulo: 'Espessura', tipo: 'numero', valor: style.strokeWidth, unidade: 'px', casasDecimais: 1, somenteLeitura: isLocked },
      { id: 'strokeDashArray', rotulo: 'Traço', tipo: 'linha', valor: dashValue, somenteLeitura: isLocked, opcoes: DASH_OPTIONS.map(({ id, rotulo }) => ({ id, rotulo })) }
    ];

    if (isPoly || isCircle) {
      estiloProps.push(
        { id: 'fillEnabled', rotulo: 'Preenchimento', tipo: 'booleano', valor: !isFillNone, somenteLeitura: isLocked },
        ...(!isFillNone ? [
          { id: 'fillColor', rotulo: 'Cor do preenchimento', tipo: 'cor', valor: style.effectiveFillColor, somenteLeitura: isLocked },
          { id: 'fillOpacity', rotulo: 'Opacidade', tipo: 'numero', valor: Math.round(style.fillOpacity * 100), unidade: '%', casasDecimais: 0, somenteLeitura: isLocked }
        ] : []),
        { id: 'strokeEnabled', rotulo: 'Borda', tipo: 'booleano', valor: !isStrokeNone, somenteLeitura: isLocked },
        ...(!isStrokeNone ? strokeRows('borda') : []),
        { id: 'acao_inverter_cores', rotulo: 'Cores', tipo: 'acao', valor: 'Inverter', rotuloAcao: '⇄ Inverter', somenteLeitura: isLocked, dica: 'Troca a cor do preenchimento pela da borda (Shift+X)' }
      );
    } else if (isLine) {
      estiloProps.push(
        { id: 'strokeEnabled', rotulo: 'Linha visível', tipo: 'booleano', valor: !isStrokeNone, somenteLeitura: isLocked },
        ...(!isStrokeNone ? strokeRows('linha') : [])
      );
    } else if (isPoint) {
      const iconValue = MARKER_ICON_OPTIONS.some(o => o.id === style.markerIcon) ? style.markerIcon : 'pin';
      estiloProps.push(
        { id: 'pointColor', rotulo: 'Cor', tipo: 'cor', valor: style.fillColor || style.strokeColor, somenteLeitura: isLocked },
        { id: 'markerIcon', rotulo: 'Símbolo', tipo: 'selecao', valor: iconValue, somenteLeitura: isLocked, opcoes: MARKER_ICON_OPTIONS },
        { id: 'markerSize', rotulo: 'Tamanho', tipo: 'numero', valor: style.markerSize, unidade: 'px', casasDecimais: 0, somenteLeitura: isLocked },
        { id: 'markerRotation', rotulo: 'Rotação', tipo: 'numero', valor: style.markerRotation, unidade: '°', casasDecimais: 0, somenteLeitura: isLocked }
      );
    } else if (isText) {
      estiloProps.push(
        { id: 'text_content', rotulo: 'Texto', tipo: 'texto', valor: feat.properties?.text || feat.name || '', somenteLeitura: isLocked },
        { id: 'fontSize', rotulo: 'Tamanho da fonte', tipo: 'numero', valor: numOr(feat.style?.fontSize, 13), unidade: 'px', casasDecimais: 0, somenteLeitura: isLocked },
        { id: 'textColor', rotulo: 'Cor do texto', tipo: 'cor', valor: feat.style?.textColor || '#ffffff', somenteLeitura: isLocked }
      );
    }

    // Rótulos dinâmicos no mapa (o texto já é o próprio rótulo); o campo só aparece com o rótulo ligado
    if (!isText) {
      estiloProps.push({ id: 'showLabel', rotulo: 'Rótulo no mapa', tipo: 'booleano', valor: style.showLabel === true, somenteLeitura: isLocked });
      if (style.showLabel === true) {
        estiloProps.push({
          id: 'labelField',
          rotulo: 'Texto do rótulo',
          tipo: 'selecao',
          valor: style.labelField || 'name',
          somenteLeitura: isLocked,
          opcoes: [
            { id: 'name', rotulo: 'Nome' },
            { id: 'description', rotulo: 'Descrição' },
            { id: 'id', rotulo: 'ID' },
            { id: 'category', rotulo: 'Categoria' },
            ...(isPoly ? [{ id: 'area', rotulo: 'Área (ha)' }] : []),
            ...(isLine ? [{ id: 'extensao', rotulo: 'Extensão' }] : [])
          ]
        });
      }
    }

    categorias.push({ id: 'simbologia', titulo: '🎨 Aparência', aberto: true, propriedades: estiloProps });

    // --- Categoria 4: Atributos GIS (Shapefile / propriedades personalizadas) ---
    // As métricas gravadas (Área, Perímetro…) já aparecem em Geometria
    const attrProps = [];
    if (feat.properties && typeof feat.properties === 'object' && !Array.isArray(feat.properties)) {
      Object.entries(feat.properties).forEach(([key, val]) => {
        if (key.startsWith('_') || HIDDEN_PROP_KEYS.has(key) || METRIC_KEYS.has(key) || (val !== null && typeof val === 'object')) return;
        if (typeof val === 'number') {
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
          attrProps.push({ id: multi ? `custom_key_${item.key}` : `custom_attr_${idx}`, rotulo: item.key, tipo: 'texto', valor: String(item.value ?? ''), somenteLeitura: isLocked });
        }
      });
    }

    const attrCount = attrProps.length;
    if (!isLocked) {
      attrProps.push({
        id: 'acao_adicionar_atributo',
        rotulo: 'Novo campo',
        tipo: 'acao',
        valor: 'Adicionar',
        rotuloAcao: '+ Adicionar',
        dica: multi ? 'Cria um atributo personalizado em todas as feições selecionadas' : 'Cria um atributo personalizado nesta feição'
      });
    }

    categorias.push({
      id: 'atributos',
      titulo: attrCount > 0 ? `📋 Atributos (${attrCount})` : '📋 Atributos',
      aberto: attrCount > 0,
      propriedades: attrProps
    });

    // --- Categoria 5: Operações (enquadrar e excluir ficam no cartão do topo) ---
    // Seleção múltipla monta as próprias operações (gerarConfiguracaoMulti)
    if (multi) return { tipos, categorias: this.applyCategoryOpenState(panel, categorias) };
    const acoesProps = [];

    if (linkedFeat) {
      if (featStatus === 'oficial') {
        acoesProps.push({ id: 'acao_alternar_versao_previa', rotulo: 'Versão', tipo: 'acao', valor: 'Prévia', rotuloAcao: '🔄 Exibir prévia', dica: `Mostra no mapa a versão prévia ("${linkedFeat.name || 'Prévia'}")` });
      } else if (featStatus === 'previa') {
        acoesProps.push({ id: 'acao_alternar_versao_oficial', rotulo: 'Versão', tipo: 'acao', valor: 'Oficial', rotuloAcao: '🔄 Exibir oficial', dica: `Mostra no mapa a versão oficial ("${linkedFeat.name || 'Oficial'}")` });
      }
    } else if (featStatus === 'previa' && !hasOfficial) {
      acoesProps.push({ id: 'acao_promover_oficial', rotulo: 'Versão', tipo: 'acao', valor: 'Promover', rotuloAcao: '⭐ Tornar oficial', somenteLeitura: isLocked, dica: 'Define esta geometria como a versão oficial' });
    }

    if (isPoly || isLine || isCircle) {
      acoesProps.push({
        id: 'acao_editar_vertices',
        rotulo: isCircle ? 'Centro e raio' : 'Vértices',
        tipo: 'acao',
        valor: panel.isVertexEditing ? 'Concluir' : 'Editar',
        rotuloAcao: panel.isVertexEditing ? '✔ Concluir edição' : '✏️ Editar no mapa',
        somenteLeitura: isLocked,
        dica: isCircle ? 'Alças no centro (mover) e na borda (raio)' : 'Alças arrastáveis em cada vértice'
      });
      if (!isCircle) {
        acoesProps.push({ id: 'acao_simplificar', rotulo: 'Simplificar', tipo: 'acao', valor: 'Simplificar', rotuloAcao: '📉 Tolerância 5 m', somenteLeitura: isLocked, dica: 'Remove vértices redundantes (Douglas-Peucker, 5 m)' });
      }
    }

    const bufRadius = Number.isFinite(panel._bufferRadius) && panel._bufferRadius > 0 ? panel._bufferRadius : 50;
    acoesProps.push(
      { id: 'buffer_distancia', rotulo: 'Raio Buffer', tipo: 'numero', valor: bufRadius, unidade: 'm', casasDecimais: 1, somenteLeitura: isLocked, dica: 'Distância em metros para criar a zona de amortecimento' },
      { id: 'acao_buffer', rotulo: 'Buffer', tipo: 'acao', valor: `Criar ${bufRadius} m`, rotuloAcao: `◎ Criar ${bufRadius} m`, somenteLeitura: isLocked, dica: 'Gera zona de amortecimento geodésica com o raio definido' },
      { id: 'acao_duplicar', rotulo: 'Duplicar', tipo: 'acao', valor: 'Duplicar', rotuloAcao: '📑 Cópia a 30 m', dica: 'Cria uma cópia deslocada 30 m' },
      { id: 'acao_copiar_geojson', rotulo: 'GeoJSON', tipo: 'acao', valor: 'GeoJSON', rotuloAcao: '📋 Copiar', dica: 'Copia a feição em GeoJSON' },
      { id: 'acao_copiar_wkt', rotulo: 'WKT', tipo: 'acao', valor: 'WKT', rotuloAcao: '📋 Copiar', dica: 'Copia a geometria em WKT (CAD/GIS)' }
    );

    categorias.push({ id: 'acoes', titulo: '⚡ Operações', aberto: true, propriedades: acoesProps });

    return { tipos, categorias: this.applyCategoryOpenState(panel, categorias) };
  }

  /**
   * Tabela de propriedades de várias feições do mesmo tipo: só entram as linhas que todas
   * têm; valor igual em todas é exibido, valor diferente aparece como "Varia".
   * @param {Object} panel - Instância do LayerPanel
   * @param {Object[]} feats - Feições selecionadas (mesmo tipo)
   * @returns {{ tipos: Array, categorias: Array }}
   */
  static gerarConfiguracaoMulti(panel, feats) {
    const list = (feats || []).filter(Boolean);
    if (list.length === 0) return { tipos: [], categorias: [] };

    const [first, ...rest] = list.map(f => this.gerarConfiguracao(panel, f, { multi: true }).categorias);
    const categorias = [];
    for (const cat of first) {
      const peerCats = rest.map(cats => cats.find(c => c.id === cat.id));
      if (peerCats.some(c => !c)) continue;
      const propriedades = [];
      for (const prop of cat.propriedades) {
        const rows = [prop, ...peerCats.map(c => c.propriedades.find(p => p.id === prop.id))];
        if (rows.some(p => !p || p.tipo !== prop.tipo || p.rotulo !== prop.rotulo)) continue;
        // Bloqueadas são puladas na gravação: a linha só fica somente leitura se todas forem
        const merged = { ...prop, somenteLeitura: rows.every(p => p.somenteLeitura === true) };
        propriedades.push(rows.every(p => sameValue(prop, p.valor, prop.valor)) ? merged : this.asVaria(merged));
      }
      if (propriedades.length === 0) continue;
      // Contadores do título ("Atributos (3)") são por feição
      categorias.push({ ...cat, titulo: cat.titulo.replace(/\s*\(\d+\)$/, ''), propriedades });
    }

    // Totais da seleção no topo da Geometria
    const type = list[0].type;
    const fmt = (n, min, max) => n.toLocaleString('pt-BR', { minimumFractionDigits: min, maximumFractionDigits: max });
    const fmtLength = (m) => (m >= 1000 ? `${fmt(m, 2, 2)} m · ${fmt(m / 1000, 3, 3)} km` : `${fmt(m, 2, 2)} m`);
    const coordsOf = (f) => (Array.isArray(f.coordinates) ? f.coordinates : []);
    const totals = [{ id: 'multi_qtd', rotulo: 'Selecionadas', tipo: 'readonly', valor: `${list.length} feições` }];
    if (type === 'Polygon' || type === 'Circle') {
      const area = list.reduce((acc, f) => acc + (type === 'Circle'
        ? Math.PI * Math.pow(Number(f.radius) || 0, 2)
        : panel.calculatePolygonArea(coordsOf(f))), 0);
      totals.push({ id: 'multi_area', rotulo: 'Área total', tipo: 'readonly', valor: `${fmt(area / 10000, 4, 4)} ha · ${fmt(area, 2, 2)} m²` });
    }
    if (type === 'Polygon') {
      const perimeter = list.reduce((acc, f) => acc + panel.calculatePolygonPerimeter(coordsOf(f)), 0);
      totals.push({ id: 'multi_perimetro', rotulo: 'Perímetro total', tipo: 'readonly', valor: fmtLength(perimeter) });
    } else if (type === 'LineString') {
      const length = list.reduce((acc, f) => acc + panel.calculatePolylineLength(coordsOf(f)), 0);
      totals.push({ id: 'multi_extensao', rotulo: 'Extensão total', tipo: 'readonly', valor: fmtLength(length) });
    }
    const geom = categorias.find(c => c.id === 'geometria');
    if (geom) geom.propriedades.unshift(...totals);
    else categorias.unshift({ id: 'geometria', titulo: '📐 Geometria', aberto: true, propriedades: totals });

    const attrs = categorias.find(c => c.id === 'atributos');
    if (attrs) {
      const count = attrs.propriedades.filter(p => p.tipo !== 'acao').length;
      if (count > 0) attrs.titulo = `📋 Atributos (${count})`;
    }

    // Operações que valem para o conjunto (as de uma feição só ficam de fora)
    const allLocked = list.every(f => f.locked === true);
    const acoesProps = [];
    if (type === 'Polygon' || type === 'LineString') {
      acoesProps.push({ id: 'acao_simplificar', rotulo: 'Simplificar', tipo: 'acao', valor: 'Simplificar', rotuloAcao: '📉 Tolerância 5 m', somenteLeitura: allLocked, dica: 'Remove vértices redundantes de todas (Douglas-Peucker, 5 m)' });
    }
    acoesProps.push({ id: 'acao_copiar_geojson', rotulo: 'GeoJSON', tipo: 'acao', valor: 'GeoJSON', rotuloAcao: '📋 Copiar', dica: 'Copia as feições selecionadas em GeoJSON' });
    categorias.push({ id: 'acoes', titulo: '⚡ Operações', aberto: true, propriedades: acoesProps });

    return { tipos: [], categorias: this.applyCategoryOpenState(panel, categorias) };
  }

  /** Linha cujo valor difere entre as feições selecionadas: mostra "Varia" no editor do kit. */
  static asVaria(prop) {
    if (prop.tipo === 'acao') return prop;
    if (prop.somenteLeitura || prop.tipo === 'readonly') return { ...prop, valor: VARIA_LABEL };
    switch (prop.tipo) {
      case 'numero':
        return { ...prop, valor: null, placeholder: VARIA_LABEL };
      case 'cor':
        return { ...prop, valor: 'transparent', textoAmostra: VARIA_LABEL };
      case 'booleano':
        return {
          ...prop,
          tipo: 'selecao',
          valor: VARIA_ID,
          opcoes: [{ id: VARIA_ID, rotulo: VARIA_LABEL }, { id: BOOL_TRUE_ID, rotulo: 'Sim' }, { id: BOOL_FALSE_ID, rotulo: 'Não' }]
        };
      case 'selecao':
      case 'linha':
        return { ...prop, valor: VARIA_ID, opcoes: [{ id: VARIA_ID, rotulo: VARIA_LABEL }, ...(prop.opcoes || [])] };
      default:
        return { ...prop, valor: '', placeholder: VARIA_LABEL };
    }
  }

  // Cada edição recria a tabela: mantém as categorias como o usuário as deixou
  static applyCategoryOpenState(panel, categorias) {
    const openState = panel._inspectorCategoryOpen || {};
    categorias.forEach(cat => {
      if (typeof openState[cat.id] === 'boolean') cat.aberto = openState[cat.id];
    });
    return categorias;
  }

  /**
   * Linhas de latitude/longitude de cada vértice (ids `vtx_<anel>_<vértice>_<eixo>`)
   * e, quando o anel permite, uma seleção para remover um vértice (`vtx_remover_<anel>`).
   */
  static buildVertexProps(rings, type, isLocked) {
    const minVertices = type === 'Polygon' ? 3 : 2;
    const multi = rings.length > 1;
    const props = [];
    rings.forEach((ring, ri) => {
      const prefix = multi ? `${ring.label} · ` : '';
      const [latLabel, lngLabel] = multi ? ['Lat', 'Lng'] : ['Latitude', 'Longitude'];
      ring.points.forEach((pt, vi) => {
        props.push(
          { id: `vtx_${ri}_${vi}_0`, rotulo: `${prefix}V${vi + 1} · ${latLabel}`, tipo: 'numero', valor: Number(pt[0]), unidade: '°', casasDecimais: COORD_DECIMALS, somenteLeitura: isLocked },
          { id: `vtx_${ri}_${vi}_1`, rotulo: `${prefix}V${vi + 1} · ${lngLabel}`, tipo: 'numero', valor: Number(pt[1]), unidade: '°', casasDecimais: COORD_DECIMALS, somenteLeitura: isLocked }
        );
      });
      if (!isLocked && ring.points.length > minVertices) {
        props.push({
          id: `vtx_remover_${ri}`,
          rotulo: `${prefix}Remover vértice`,
          tipo: 'selecao',
          valor: '',
          opcoes: [{ id: '', rotulo: 'Escolha…' }, ...ring.points.map((_, vi) => ({ id: String(vi), rotulo: `V${vi + 1}` }))],
          dica: 'Remove o vértice escolhido (Ctrl+Z desfaz)'
        });
      }
    });
    return props;
  }

  // Azimute em graus, minutos e segundos (convenção topográfica)
  static formatAzimuth(deg) {
    const total = Math.round(((deg % 360) + 360) % 360 * 3600);
    const d = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${d}°${String(m).padStart(2, '0')}'${String(s).padStart(2, '0')}"`;
  }

  /**
   * Edita a coordenada de um vértice ou remove um vértice (ids gerados por buildVertexProps).
   * Retorna false quando a alteração não se aplica; rejeições informam `reject(msg)`.
   */
  static applyVertexEdit(draft, propId, novoValor, reject) {
    const remove = propId.match(/^vtx_remover_(\d+)$/);
    const edit = propId.match(/^vtx_(\d+)_(\d+)_([01])$/);
    if (!remove && !edit) return false;
    const ringIdx = parseInt((remove || edit)[1], 10);
    const ring = FeatureGeometryUtils.getVertexRings(draft)[ringIdx];
    if (!ring) return false;

    if (remove) {
      if (novoValor === '' || novoValor === null || novoValor === undefined) return false;
      const vIdx = parseInt(novoValor, 10);
      const minVertices = draft.type === 'Polygon' ? 3 : 2;
      if (!ring.points[vIdx]) return false;
      if (ring.points.length <= minVertices) {
        reject(draft.type === 'Polygon' ? 'Cada anel precisa de no mínimo 3 vértices.' : 'Linhas precisam de no mínimo 2 vértices.');
        return false;
      }
      const points = ring.points.filter((_, i) => i !== vIdx);
      draft.coordinates = FeatureGeometryUtils.replaceRing(draft.coordinates, ring.path, points, ring.closed);
      return true;
    }

    const vIdx = parseInt(edit[2], 10);
    const axis = parseInt(edit[3], 10);
    const val = parseNumber(novoValor);
    const limit = axis === 0 ? 90 : 180;
    if (val === null || Math.abs(val) > limit) {
      reject(`${axis === 0 ? 'Latitude' : 'Longitude'} deve estar entre -${limit} e ${limit}.`);
      return false;
    }
    if (!ring.points[vIdx]) return false;
    // Coordenadas novas (nunca mutar no lugar): FeatureQuery cacheia pela referência
    const points = ring.points.map(p => [...p]);
    points[vIdx][axis] = val;
    draft.coordinates = FeatureGeometryUtils.replaceRing(draft.coordinates, ring.path, points, ring.closed);
    draft.coordinates = FeatureGeometryUtils.mergeCoincidentVertices(draft.coordinates, draft.type);
    return true;
  }

  /**
   * Pré-visualização de cor no mapa, sem gravar (usada enquanto o seletor é arrastado).
   */
  static previewAlteracao(panel, featId, propId, valor) {
    const engine = panel.app && panel.app.mapEngine;
    const latest = panel.getLatestFeature(featId);
    if (!engine || !latest || latest.locked === true) return;
    const preview = { ...latest, style: { ...(latest.style || {}) } };
    if (propId === 'fillColor') { preview.style.fillColor = valor; }
    else if (propId === 'strokeColor') { preview.style.strokeColor = valor; }
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
    if (propId === 'buffer_distancia') {
      const val = parseNumber(novoValor);
      if (val !== null && val > 0) {
        panel._bufferRadius = val;
        panel.refreshInspector();
      }
      return;
    }

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

    const ctx = { rejectedMessage: null, statusLabel: null };
    const saved = panel.commitFeatureEdit(featId, (draft) => this.applyToDraft(panel, draft, propId, novoValor, ctx), { rerender });

    if (!saved) {
      if (ctx.rejectedMessage) UIToast.notificar({ tipo: 'alerta', titulo: 'Valor Inválido', mensagem: ctx.rejectedMessage, duracao: 3000 });
      // Restaura o valor exibido na tabela
      panel.refreshSelectedFeature(panel.getLatestFeature(featId) || latest, { immediate: true });
      return;
    }

    if (ctx.statusLabel) {
      // O mapa decide oficial x prévia pelo status: atualiza depois de gravar
      if (panel.app && typeof panel.app.refreshMapAndTable === 'function') panel.app.refreshMapAndTable();
    }
  }

  /**
   * Aplica a alteração de uma propriedade do inspetor ao rascunho de uma feição
   * (a inspecionada ou cada uma das selecionadas). Retornar false cancela;
   * a mensagem de rejeição e o novo status vão em `ctx`.
   */
  static applyToDraft(panel, draft, propId, novoValor, ctx = {}) {
    if (!draft.style) draft.style = {};
    if (!draft.properties || typeof draft.properties !== 'object' || Array.isArray(draft.properties)) draft.properties = {};

    switch (propId) {
      case 'name': {
        const name = String(novoValor ?? '').trim();
        if (!name) { ctx.rejectedMessage = 'O nome não pode ficar vazio.'; return false; }
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
        if (r === null || r <= 0) { ctx.rejectedMessage = 'O raio deve ser maior que zero.'; return false; }
        draft.radius = r;
        return;
      }
      case 'lat_dd':
      case 'lng_dd': {
        const v = parseNumber(novoValor);
        const isLat = propId === 'lat_dd';
        const limit = isLat ? 90 : 180;
        if (v === null || Math.abs(v) > limit) { ctx.rejectedMessage = `${isLat ? 'Latitude' : 'Longitude'} deve estar entre -${limit} e ${limit}.`; return false; }
        if (!Array.isArray(draft.coordinates) || Array.isArray(draft.coordinates[0])) return false;
        draft.coordinates = [...draft.coordinates];
        draft.coordinates[isLat ? 0 : 1] = v;
        return;
      }
      case 'text_content': {
        const text = String(novoValor ?? '').trim();
        if (!text) { ctx.rejectedMessage = 'O texto não pode ficar vazio.'; return false; }
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
      case 'fillEnabled': {
        const enabled = Boolean(novoValor);
        if (!enabled) {
          if (draft.style.fillColor && draft.style.fillColor !== 'none' && draft.style.fillColor !== 'transparent') {
            draft.style._lastFillColor = draft.style.fillColor;
          }
          draft.style.fillColor = 'none';
        } else {
          draft.style.fillColor = draft.style._lastFillColor || draft.color || '#00E08A';
        }
        return;
      }
      case 'fillColor': {
        draft.style.fillColor = novoValor;
        if (novoValor && novoValor !== 'none' && novoValor !== 'transparent') {
          draft.style._lastFillColor = novoValor;
        }
        return;
      }
      case 'fillOpacity': {
        const n = parseNumber(novoValor);
        if (n === null) return false;
        draft.style.fillOpacity = clamp(n, 0, 100) / 100;
        return;
      }
      case 'strokeEnabled': {
        const enabled = Boolean(novoValor);
        if (!enabled) {
          if (draft.style.strokeColor && draft.style.strokeColor !== 'none' && draft.style.strokeColor !== 'transparent') {
            draft.style._lastStrokeColor = draft.style.strokeColor;
          }
          draft.style.strokeColor = 'none';
        } else {
          draft.style.strokeColor = draft.style._lastStrokeColor || '#ffffff';
        }
        return;
      }
      case 'strokeColor': {
        draft.style.strokeColor = novoValor;
        if (novoValor && novoValor !== 'none' && novoValor !== 'transparent') {
          draft.style._lastStrokeColor = novoValor;
        }
        return;
      }
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
      case 'strokeDashArray': {
        // id da lista; um padrão fora dela (ex.: '6, 4' da medição) é mantido como está
        const option = DASH_OPTIONS.find(o => o.id === novoValor);
        draft.style.strokeDashArray = option ? option.dash : (novoValor === 'continuous' ? '' : String(novoValor ?? ''));
        return;
      }
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
        ctx.statusLabel = novoValor === 'oficial' ? 'Oficial' : (novoValor === 'previa' ? 'Prévia' : 'Padrão');
        return;
      }
      default:
        if (propId.startsWith('vtx_')) {
          if (!this.applyVertexEdit(draft, propId, novoValor, (msg) => { ctx.rejectedMessage = msg; })) return false;
          return;
        }
        if (propId.startsWith('prop_')) {
          const key = propId.slice('prop_'.length);
          if (METRIC_KEYS.has(key)) return false;
          const previous = draft.properties[key];
          if (typeof previous === 'number') {
            const n = parseNumber(novoValor);
            if (n === null) { ctx.rejectedMessage = `"${key}" deve ser numérico.`; return false; }
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
        // Várias feições: o mesmo campo pode estar em posições diferentes de cada uma
        if (propId.startsWith('custom_key_')) {
          const key = propId.slice('custom_key_'.length);
          const item = Array.isArray(draft.customAttributes) ? draft.customAttributes.find(a => a && a.key === key) : null;
          if (!item) return false;
          item.value = novoValor;
          return;
        }
        return false;
    }
  }

  /**
   * Aplica a alteração a todas as feições selecionadas, num único passo de histórico
   * (BatchActions). Bloqueadas são puladas; feições que já tinham o valor não são regravadas.
   * @param {Object} panel - Instância do LayerPanel
   * @param {string[]} ids - IDs das feições selecionadas
   * @param {string} propId - ID da propriedade alterada
   * @param {any} novoValor - Novo valor recebido
   */
  static aplicarAlteracaoMulti(panel, ids, propId, novoValor) {
    const app = panel.app;
    // "Varia" escolhido de novo ou número apagado: nada a gravar
    if (!app || novoValor === VARIA_ID || novoValor === null || novoValor === undefined) {
      panel.refreshInspector();
      return;
    }
    const valor = novoValor === BOOL_TRUE_ID ? true : (novoValor === BOOL_FALSE_ID ? false : novoValor);
    const ctx = { rejectedMessage: null, statusLabel: null };
    const res = BatchActions.edit(app, ids, 'Editar propriedades', (draft, original) => {
      if (this.applyToDraft(panel, draft, propId, valor, ctx) === false) return false;
      return JSON.stringify(draft) !== JSON.stringify(original);
    });

    if (res.changed === 0 && ctx.rejectedMessage) {
      UIToast.notificar({ tipo: 'alerta', titulo: 'Valor Inválido', mensagem: ctx.rejectedMessage, duracao: 3000 });
    } else if (res.locked > 0) {
      UIToast.notificar({ tipo: 'alerta', titulo: 'Elementos Travados', mensagem: `${res.locked} feição(ões) bloqueada(s) não foram alteradas.`, duracao: 3000 });
    }
    panel.refreshInspector();
  }

  /** Pré-visualização de cor em todas as feições selecionadas, sem gravar. */
  static previewAlteracaoMulti(panel, ids, propId, valor) {
    ids.forEach(id => this.previewAlteracao(panel, id, propId, valor));
  }

  /**
   * Ações da paleta com várias feições selecionadas (as de lote passam por app.batchActions).
   * @param {Object} panel - Instância do LayerPanel
   * @param {string[]} ids - IDs das feições selecionadas
   * @param {string} acaoId - ID da ação acionada
   */
  static executarAcaoMulti(panel, ids, acaoId) {
    const app = panel.app;
    if (!app) return;
    const feats = ids.map(id => panel.getLatestFeature(id)).filter(Boolean);
    if (feats.length === 0) return;

    switch (acaoId) {
      case 'acao_inverter_cores':
        if (app.batchActions) app.batchActions.invertColors(ids);
        else BatchActions.invertColors(app, ids);
        break;

      case 'acao_simplificar':
        if (app.batchActions) app.batchActions.simplify(ids);
        else BatchActions.simplify(app, ids);
        break;

      case 'acao_copiar_geojson':
        this.copyToClipboard(GeoFormats.toGeoJSON(feats), 'GeoJSON Copiado', `${feats.length} feições copiadas em GeoJSON.`);
        return;

      case 'acao_adicionar_atributo': {
        const chave = prompt('Informe o nome do novo atributo / campo:');
        if (!chave || !chave.trim()) return;
        const chaveLimpa = chave.trim();
        const res = BatchActions.edit(app, ids, `Atributo "${chaveLimpa}"`, (draft) => {
          const exists = (Array.isArray(draft.customAttributes) && draft.customAttributes.some(a => a && a.key === chaveLimpa))
            || (draft.properties && Object.prototype.hasOwnProperty.call(draft.properties, chaveLimpa));
          if (exists) return false;
          draft.customAttributes = Array.isArray(draft.customAttributes) ? draft.customAttributes : [];
          draft.customAttributes.push({ key: chaveLimpa, value: '' });
          return true;
        });
        if (res.changed === 0) {
          UIToast.notificar({ tipo: 'alerta', titulo: 'Campo Existente', mensagem: `O atributo "${chaveLimpa}" já existe nas feições selecionadas.` });
        }
        break;
      }

      default:
        return;
    }
    panel.refreshInspector();
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

      case 'acao_buffer': {
        const radius = Number.isFinite(panel._bufferRadius) && panel._bufferRadius > 0 ? panel._bufferRadius : 50;
        const bufferFeature = SpatialAlgorithms.generateBuffer(feat, radius);
        if (bufferFeature) {
          const created = panel.onFeatureCreate(bufferFeature);
          if (created && panel.app?.mapEngine) {
            panel.app.mapEngine.selectFeature(created.id);
          }
          UIToast.notificar({
            tipo: 'sucesso',
            titulo: 'Buffer Criado',
            mensagem: `Zona de amortecimento de ${radius} m gerada para "${feat.name || 'Feição'}".`,
            duracao: 3500
          });
        } else {
          UIToast.notificar({
            tipo: 'alerta',
            titulo: 'Falha no Buffer',
            mensagem: 'Não foi possível gerar a zona de amortecimento para esta feição.',
            duracao: 4000
          });
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

      case 'acao_inverter_cores':
        panel.commitFeatureEdit(featId, (draft) => {
          if (!draft.style) draft.style = {};
          const oldFill = draft.style.fillColor !== undefined ? draft.style.fillColor : (draft.color || '#00E08A');
          const oldStroke = draft.style.strokeColor !== undefined ? draft.style.strokeColor : '#ffffff';
          draft.style.fillColor = oldStroke;
          draft.style.strokeColor = oldFill;
          if (oldStroke !== 'none') draft.color = oldStroke;
        });
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
