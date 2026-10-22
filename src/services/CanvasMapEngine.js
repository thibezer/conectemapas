/* ==========================================================================
   ConecteMapas - CanvasMapEngine
   Motor cartográfico do app (substituiu o antigo MapEngine, removido), apoiado no <ui-canvas-cad> (ui-components-kit).
   O componente é dono do mapa e faz: renderização de feições, culling/clusters, hit-test,
   seleção (clique, caixa, laço), popup, snap, edição de vértices, ferramentas de desenho,
   medição, divisão, conta-gotas, versões oficial × prévia e cursores remotos.

   Este adaptador só traduz:
   - feições do app ({ type, coordinates, style, ... }) <-> Feicao do componente;
   - métodos do MapEngine -> métodos do componente;
   - eventos `cad-*` -> callbacks (onFeatureCreated, onFeaturesSelected, ...).
   Os consumidores (HeaderBar, ContextMenu, controllers...) não mudam.
   ========================================================================== */

import L from 'leaflet';
import { UIToast } from '@thibezer/ui-components-kit';
import { CanvasHost } from './MapEngine/CanvasHost.js';
import { FeatureGeometryUtils } from './MapEngine/FeatureGeometryUtils.js';
import { GeometryVersionManager } from './GeometryVersionManager.js';
import { SpatialIndex } from './SpatialIndex.js';

/** Ferramenta do app -> ferramenta do componente (`select` = nenhuma). */
const TOOL_TO_KIT = {
  point: 'ponto',
  text: 'texto',
  line: 'linha',
  polygon: 'poligono',
  rectangle: 'retangulo',
  ellipse: 'elipse',
  'regular-polygon': 'poligono-regular',
  star: 'estrela',
  circle: 'circulo',
  pen: 'caneta',
  'pen-select': 'selecao-laco',
  split: 'dividir',
  measure: 'medir-distancia',
  eyedropper: 'conta-gotas'
};
const KIT_TO_TOOL = Object.fromEntries(Object.entries(TOOL_TO_KIT).map(([app, kit]) => [kit, app]));
KIT_TO_TOOL['medir-area'] = 'measure';

/** Ação do popup do componente -> ação que o app já entende. */
const POPUP_ACTION = {
  inspecionar: 'inspect',
  zoom: 'zoom',
  vertices: 'edit-vertex',
  copiar: 'copy-coords'
};

const SPLIT_FAIL_MESSAGE = {
  'nenhum-poligono': 'Nenhum polígono encontrado sob a linha de corte ou a linha não cruzou de uma borda a outra.',
  'sem-intersecao': 'A linha de corte precisa atravessar o polígono de uma borda a outra.',
  bloqueada: 'O polígono está bloqueado.',
  'poligono-com-furos': 'Polígonos com furos são divididos pela tabela de vértices do Inspetor.',
  'geometria-invalida': 'Geometria inválida para a divisão.'
};

const SVG_MARKER_ICONS = new Set(['tower', 'tree', 'warning', 'water', 'boundary']);
const HIDDEN_PROPERTIES = new Set([
  'Área (ha)', 'Área (m²)', 'Perímetro', 'Extensão', 'Raio', 'Área Coberta', 'radius', 'raio', 'visible', 'text'
]);
const Z_INDEX_BASE = 410;
const Z_INDEX_STEP = 10;
const MAX_INCREMENTAL_CHANGES = 20;

export class CanvasMapEngine {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.options = {
      center: options.center || [-23.7661, -53.3206],
      zoom: options.zoom || 14,
      ...options
    };

    this.map = null;
    this.host = null;
    this.baseLayers = {};
    this.currentBaseLayer = null;
    this.currentBasemapName = null;

    this.onFeatureCreated = options.onFeatureCreated || (() => {});
    this.onFeatureUpdated = options.onFeatureUpdated || (() => {});
    this.onFeatureSelected = options.onFeatureSelected || (() => {});
    this.onFeaturesSelected = options.onFeaturesSelected || (() => {});
    this.onCursorMove = options.onCursorMove || (() => {});
    this.onToolChange = options.onToolChange || (() => {});
    this.onContextMenu = options.onContextMenu || (() => {});
    this.onTextPromptRequested = options.onTextPromptRequested || (() => {});
    this.onFeatureAction = options.onFeatureAction || (() => {});

    this.selectedFeatureId = null;
    this.selectedFeatureIds = new Set();
    this.snappingEnabled = true;
    // Zoom/enquadramento por conta própria (selecionar, importar, abrir projeto). Os botões de enquadrar
    // continuam funcionando sempre. Preferência do operador, guardada neste navegador.
    this.autoZoomEnabled = typeof localStorage !== 'undefined' ? (localStorage.getItem('cm_auto_zoom') !== 'false') : true;
    this.activeDrawingStyles = {};
    this.activeDrawingLayer = null;

    this.showPreviewGeometries = false;
    this.individualPreviewToggles = new Set();
    this.popupEnabled = typeof localStorage !== 'undefined' ? (localStorage.getItem('cm_feature_popup_enabled') === 'true') : false;

    this._tool = 'select';
    this._features = [];
    this._featureMap = new Map();
    this._layers = [];
    this._layerMap = new Map();
    /** id da feição -> { ref, layerId, layerSig, entidadeId } do que já está no componente */
    this._applied = new Map();
    this._vertexCallback = null;
    this._remoteCursors = new Set();
    this._cursorRaf = null;
    this._disposers = [];

    this._initMap();
    this._bindKitEvents();
    this._bindMapEvents();

    // Shim: o resto do app pergunta se há edição de vértices em curso
    this.vertexEditor = {
      isEditing: () => Boolean(this.host && this.host.editandoVertices),
      get editingFeature() { return null; },
      stopEditing: () => this.stopVertexEditing()
    };
  }

  // ------------------------------------------------------------------------
  // Mapa e mapas base
  // ------------------------------------------------------------------------

  _initMap() {
    const { host, map } = CanvasHost.mount(this.containerId);
    this.host = host;
    this.map = map;

    this.map.getContainer().classList.add('cm-tool-select');
    this.map.setMaxZoom(22);
    this.map.setView(this.options.center, this.options.zoom, { animate: false });
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    // O app já trata a tecla S (atalho + toast + botão da barra); o componente não deve alternar de novo
    host.definirAtalhoSnap(false);
    this._updatePopupMargins();

    this._initBaseLayers();
  }

  _initBaseLayers() {
    this.baseLayers = {
      google_satelite_puro: L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxNativeZoom: 20, maxZoom: 22, attribution: '© Google Maps (Satélite Puro)', crossOrigin: true
      }),
      google_satelite: L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        maxNativeZoom: 20, maxZoom: 22, attribution: '© Google Maps (Híbrido)', crossOrigin: true
      }),
      satelite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxNativeZoom: 18, maxZoom: 22, attribution: 'Esri Satellite', crossOrigin: true
      }),
      osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxNativeZoom: 19, maxZoom: 22, attribution: '© OpenStreetMap', crossOrigin: true
      }),
      topografia: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxNativeZoom: 17, maxZoom: 22, attribution: 'OpenTopoMap', crossOrigin: true
      }),
      dark: L.layerGroup([
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
          maxNativeZoom: 16, maxZoom: 22, attribution: 'Esri Dark Gray', crossOrigin: true
        }),
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
          maxNativeZoom: 16, maxZoom: 22, crossOrigin: true
        })
      ])
    };

    this.setBaseLayer(this.options.initialBasemap !== undefined ? this.options.initialBasemap : 'google_satelite');
  }

  setBaseLayer(name) {
    if (this.currentBaseLayer) {
      this.map.removeLayer(this.currentBaseLayer);
      this.currentBaseLayer = null;
    }
    const container = this.map ? this.map.getContainer() : null;
    if (!name || name === 'none') {
      if (container) container.classList.add('cm-no-basemap');
      this.currentBasemapName = 'none';
      return;
    }
    if (container) container.classList.remove('cm-no-basemap');
    const target = this.baseLayers[name];
    if (target) {
      target.addTo(this.map);
      this.currentBaseLayer = target;
      this.currentBasemapName = name;
    }
  }

  // ------------------------------------------------------------------------
  // Eventos do componente -> callbacks do app
  // ------------------------------------------------------------------------

  _on(type, handler) {
    this.host.addEventListener(type, handler);
    this._disposers.push(() => this.host.removeEventListener(type, handler));
  }

  _bindKitEvents() {
    this._on('cad-selecao', (e) => {
      const features = (e.detail.feicoes || []).map(f => this._featureMap.get(f.id)).filter(Boolean);
      this.selectedFeatureIds = new Set(features.map(f => f.id));
      this.selectedFeatureId = features.length === 1 ? features[0].id : null;
      // O componente abre o popup logo depois deste evento: ajusta o auto-pan antes
      this._updatePopupMargins();
      this.onFeaturesSelected(features);

      // Se popups automáticos estiverem desativados (padrão), fecha o popup na mesma rodada
      if (!this.popupEnabled) {
        queueMicrotask(() => {
          this.closeFeaturePopup();
        });
      }
    });

    this._on('cad-feicao-selecionada', (e) => {
      const feicao = e.detail.feicao;
      this.onFeatureSelected(feicao ? (this._featureMap.get(feicao.id) || null) : null);
    });

    this._on('cad-feicao-acao', (e) => {
      const feat = this._featureMap.get(e.detail.feicao?.id);
      const action = POPUP_ACTION[e.detail.acao];
      if (feat && action) this.onFeatureAction(action, feat);
    });

    this._on('cad-feicao-menu', (e) => {
      const { feicao, coordenada, x, y } = e.detail;
      const latlng = L.latLng(coordenada[0], coordenada[1]);
      this.onContextMenu({
        latlng,
        point: this.map.latLngToContainerPoint(latlng),
        originalEvent: { clientX: x, clientY: y, preventDefault() {}, stopPropagation() {} },
        feature: feicao ? (this._featureMap.get(feicao.id) || null) : null
      });
    });

    this._on('cad-feicao-hover', (e) => {
      const container = this.map ? this.map.getContainer() : null;
      if (container) container.classList.toggle('cm-feature-hover', Boolean(e.detail.feicao) && this._tool === 'select');
    });

    this._on('cad-ferramenta', (e) => this._syncToolState(KIT_TO_TOOL[e.detail.ferramenta] || 'select'));

    this._on('cad-snap', (e) => {
      this.snappingEnabled = Boolean(e.detail.ligado);
      if (typeof this.onSnappingChange === 'function') this.onSnappingChange(this.snappingEnabled);
    });

    this._on('cad-feicao-criada', (e) => this._handleKitCreated(e.detail));
    this._on('cad-medicao', (e) => this._handleKitMeasure(e.detail));
    this._on('cad-feicao-dividida', (e) => this._handleKitSplit(e.detail));
    this._on('cad-divisao-falhou', (e) => {
      this.host.definirFerramenta(null);
      if (typeof this.onSplitFailed === 'function') this.onSplitFailed(SPLIT_FAIL_MESSAGE[e.detail.motivo]);
    });
    this._on('cad-conta-gotas', (e) => {
      const feat = e.detail.feicao ? this._featureMap.get(e.detail.feicao.id) : null;
      this.host.definirFerramenta(null);
      if (feat && typeof this.onEyedropperSampled === 'function') this.onEyedropperSampled(feat, null);
    });

    this._on('cad-feicao-atualizada', (e) => this._handleKitUpdated(e.detail));
    this._on('cad-edicao-concluida', () => { this._vertexCallback = null; });
    this._on('cad-edicao-recusada', (e) => this._notifyEditRefused(e.detail.motivo));
    this._on('cad-desenho-recusado', (e) => {
      if (e.detail.motivo === 'camada-bloqueada') {
        UIToast.notificar({ tipo: 'alerta', titulo: 'Camada bloqueada', mensagem: 'Desbloqueie a camada ativa para desenhar nela.', duracao: 2500 });
      }
    });
  }

  _bindMapEvents() {
    let pending = false;
    let last = null;
    const onMove = (e) => {
      last = e;
      if (pending) return;
      pending = true;
      this._cursorRaf = requestAnimationFrame(() => {
        pending = false;
        this._cursorRaf = null;
        if (last) this.onCursorMove(last.latlng);
      });
    };
    this.map.on('mousemove', onMove);
    this._disposers.push(() => this.map && this.map.off('mousemove', onMove));
  }

  _syncToolState(tool) {
    if (tool === this._tool) return;
    this._tool = tool;
    const container = this.map ? this.map.getContainer() : null;
    if (container) {
      container.classList.toggle('cm-tool-select', tool === 'select');
      if (tool !== 'select') container.classList.remove('cm-feature-hover');
    }
    this.onToolChange(tool);
  }

  _notifyEditRefused(motivo) {
    const text = {
      'poligono-com-furos': 'Polígonos com furos ou multipartes são editados pela tabela de vértices do Inspetor.',
      'tipo-nao-suportado': 'Este tipo de feição não tem vértices editáveis no mapa.',
      'muitos-vertices': 'Geometria com vértices demais para editar no mapa; use a tabela de vértices do Inspetor.'
    }[motivo];
    if (!text) return; // 'bloqueada': o app sempre ignorou em silêncio
    UIToast.notificar({
      tipo: 'alerta',
      titulo: motivo === 'poligono-com-furos' ? 'Geometria com Múltiplas Partes' : 'Edição não disponível',
      mensagem: text,
      duracao: 4000
    });
  }

  /** O painel lateral flutua sobre o mapa: o auto-pan do popup precisa desviar dele também. */
  _updatePopupMargins() {
    if (!this.host) return;
    const direita = this._rightOverlayPadding();
    this.host.definirMargensPopup({ topo: 76, base: 40, esquerda: 24, direita });
    // HUDs de desenho e edição de vértices ficam no topo (ver CanvasHost): centralizam na área livre,
    // fora da barra de ferramentas à esquerda e do painel lateral à direita
    this.host.definirMargensHud?.({ topo: 44, esquerda: 72, direita });
  }

  _rightOverlayPadding() {
    const base = 24;
    const panel = typeof document !== 'undefined' ? document.getElementById('cm-sidebar-panel') : null;
    if (!panel || !this.map || panel.classList.contains('collapsed')) return base;
    const mapRect = this.map.getContainer().getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    if (panelRect.width === 0 || panelRect.left >= mapRect.right) return base;
    return Math.max(base, Math.round(mapRect.right - panelRect.left) + 16);
  }

  // ------------------------------------------------------------------------
  // Conversão feição do app <-> Feicao do componente
  // ------------------------------------------------------------------------

  _layerSignature(layer) {
    return `${layer?.color || ''}|${layer?.locked ? 1 : 0}`;
  }

  _isDeleted(feat) {
    return Boolean(feat.is_deleted || feat._deleted || feat.deleted_at);
  }

  _geometryOf(feat) {
    const n = FeatureGeometryUtils.normalizeCoordinates(feat);
    if (!n) return null;
    switch (feat.type) {
      case 'Point':
        return { tipo: 'Point', coordenada: n };
      case 'Text':
        return { tipo: 'Text', coordenada: n, texto: String(feat.properties?.text ?? feat.name ?? '').trim() || 'Texto' };
      case 'Circle':
        return { tipo: 'Circle', centro: n, raioMetros: Number(feat.radius) > 0 ? Number(feat.radius) : 500 };
      case 'LineString': {
        const multi = Array.isArray(n[0]) && Array.isArray(n[0][0]);
        return { tipo: 'LineString', coordenadas: multi ? n[0] : n };
      }
      case 'Polygon': {
        const multi = Array.isArray(n[0]) && Array.isArray(n[0][0]);
        return { tipo: 'Polygon', aneis: multi ? n : [n] };
      }
      default:
        return null;
    }
  }

  _styleOf(feat, layer) {
    const s = feat.style || {};
    const base = feat.color || layer?.color || '#00E08A';
    const isText = feat.type === 'Text';
    const isFillNone = s.fillColor === 'none' || s.fillColor === 'transparent';
    const isStrokeNone = s.strokeColor === 'none' || s.strokeColor === 'transparent';
    const stroke = isText
      ? (s.textColor || '#ffffff')
      : (isStrokeNone
          ? 'none'
          : (s.strokeColor || (feat.type === 'LineString' ? base : (s.fillColor && !isFillNone ? '#ffffff' : base))));
    const fill = isFillNone ? 'none' : (s.fillColor || base);
    return {
      corTraco: stroke,
      corPreenchimento: fill,
      opacidadePreenchimento: isFillNone ? 0 : (s.fillOpacity !== undefined ? Number(s.fillOpacity) : 0.35),
      espessuraTraco: isStrokeNone ? 0 : (s.strokeWidth !== undefined ? Number(s.strokeWidth) : 2.5),
      dashArray: s.strokeDashArray || undefined,
      icone: SVG_MARKER_ICONS.has(s.markerIcon) ? s.markerIcon : undefined,
      tamanhoIcone: s.markerSize !== undefined ? Number(s.markerSize) : 24,
      rotacaoIcone: s.markerRotation !== undefined ? Number(s.markerRotation) : 0,
      mostrarRotulo: s.showLabel === true,
      campoRotulo: s.labelField || 'name',
      halo: Boolean(s.halo),
      tamanhoFonte: s.fontSize !== undefined ? Number(s.fontSize) : undefined
    };
  }

  /** Feição do app -> objeto aceito pelo componente (ou null se a geometria é inválida). */
  _toFeicao(feat, layer, entidadeId) {
    if (!feat || !feat.id) return null;
    const geometria = this._geometryOf(feat);
    if (!geometria) return null;

    // Métricas gravadas no app (área, perímetro...) o componente já calcula e mostra no popup
    const propriedades = {};
    for (const [key, value] of Object.entries(feat.properties || {})) {
      if (!HIDDEN_PROPERTIES.has(key) && !key.startsWith('_')) propriedades[key] = value;
    }
    if (feat.name !== undefined) propriedades.name = feat.name;
    if (feat.category !== undefined) propriedades.category = feat.category;
    if (feat.description !== undefined) propriedades.description = feat.description;
    if (feat.createdBy !== undefined) propriedades.author = feat.createdBy;
    if (feat.createdAt !== undefined) propriedades.created_at = feat.createdAt;

    const status = GeometryVersionManager.getFeatureStatus(feat);
    const out = {
      id: String(feat.id),
      geometria,
      estilo: this._styleOf(feat, layer),
      propriedades,
      bloqueada: feat.locked === true || layer?.locked === true,
      excluida: feat.visible === false || this._isDeleted(feat)
    };
    if (status) out.status = status;
    if (entidadeId) out.entidadeId = entidadeId;
    return out;
  }

  /** Agrupa a geometria oficial e as prévias da mesma coisa (mesmos vínculos do GeometryVersionManager). */
  _computeEntities(features) {
    const parent = new Map();
    const find = (k) => {
      let r = k;
      while (parent.get(r) !== r) r = parent.get(r);
      let cur = k;
      while (parent.get(cur) !== r) { const next = parent.get(cur); parent.set(cur, r); cur = next; }
      return r;
    };
    const union = (a, b) => {
      if (!parent.has(a)) parent.set(a, a);
      if (!parent.has(b)) parent.set(b, b);
      parent.set(find(a), find(b));
    };

    const versioned = [];
    for (const f of features) {
      if (!GeometryVersionManager.getFeatureStatus(f)) continue;
      versioned.push(f);
      const p = f.properties || {};
      const self = `id:${f.id}`;
      union(self, self);
      for (const link of [p.linkedId, p.officialId, p.previaId, p.parentId]) if (link) union(self, `id:${link}`);
      for (const key of ['codigo', 'id_imovel', 'matricula', 'refId']) if (p[key]) union(self, `${key}:${p[key]}`);
    }

    const groups = new Map();
    for (const f of versioned) {
      const root = find(`id:${f.id}`);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(f);
    }
    const result = new Map();
    for (const members of groups.values()) {
      if (members.length < 2) continue;
      const official = members.find(m => GeometryVersionManager.isOfficial(m));
      const entity = String((official || members.slice().sort((a, b) => String(a.id).localeCompare(String(b.id)))[0]).id);
      members.forEach(m => result.set(m.id, entity));
    }
    return result;
  }

  _zIndexFor(index, total) {
    return Z_INDEX_BASE + (total - 1 - index) * Z_INDEX_STEP;
  }

  // ------------------------------------------------------------------------
  // Renderização de feições e camadas
  // ------------------------------------------------------------------------

  /**
   * Sincroniza o componente com a lista do app. Só envia o que mudou (referência da feição,
   * cor/bloqueio da camada ou vínculo oficial × prévia); camadas muito alteradas são redefinidas por inteiro.
   */
  renderFeatures(features, layers) {
    this._features = features ? features.slice() : [];
    this._featureMap = new Map(this._features.map(f => [f.id, f]));
    this._layers = layers || [];
    this._layerMap = new Map(this._layers.map(l => [l.id, l]));
    const entities = this._computeEntities(this._features);

    // camadas que deixaram de existir
    const currentLayerIds = new Set(this._layers.map(l => l.id));
    const knownLayerIds = new Set([...this._applied.values()].map(a => a.layerId));
    for (const layerId of knownLayerIds) {
      if (currentLayerIds.has(layerId)) continue;
      this.host.definirFeicoes(layerId, []);
      this.host.setLayerVisibility(layerId, false);
      for (const [id, a] of this._applied) if (a.layerId === layerId) this._applied.delete(id);
    }

    const byLayer = new Map(this._layers.map(l => [l.id, []]));
    for (const f of this._features) {
      if (this._isDeleted(f)) continue;
      const list = byLayer.get(f.layerId);
      if (list) list.push(f);
    }

    const total = this._layers.length;
    this._layers.forEach((layer, index) => {
      this._syncLayer(layer, byLayer.get(layer.id) || [], entities, this._zIndexFor(index, total));
    });
  }

  _syncLayer(layer, list, entities, zIndex) {
    const sig = this._layerSignature(layer);
    const options = { nome: layer.name, zIndex, opacidade: layer.opacity !== undefined ? Number(layer.opacity) : 1, interativo: layer.locked !== true };

    const present = new Set(list.map(f => f.id));
    const previous = [...this._applied].filter(([, a]) => a.layerId === layer.id);
    const removed = previous.filter(([id]) => !present.has(id)).map(([id]) => id);
    const changed = list.filter(f => {
      const a = this._applied.get(f.id);
      return !a || a.layerId !== layer.id || a.ref !== f || a.layerSig !== sig || a.entidadeId !== entities.get(f.id);
    });

    // Cada operação incremental do componente regrava a lista da camada (O(N)): acima de poucas
    // mudanças, redefinir a camada de uma vez é mais barato.
    const layerKnown = previous.length > 0;
    const heavy = !layerKnown || (removed.length + changed.length) > MAX_INCREMENTAL_CHANGES;

    if (heavy) {
      const converted = [];
      for (const f of list) {
        const feicao = this._toFeicao(f, layer, entities.get(f.id));
        if (feicao) converted.push(feicao);
      }
      for (const id of removed) this._applied.delete(id);
      this.host.definirFeicoes(layer.id, converted.map(c => ({ ...c, camadaId: layer.id })), options);
      for (const f of list) this._applied.set(f.id, { ref: f, layerId: layer.id, layerSig: sig, entidadeId: entities.get(f.id) });
    } else {
      this._applyLayerOptions(layer.id, options);
      for (const id of removed) {
        this.host.removerFeicao(layer.id, id);
        this._applied.delete(id);
      }
      for (const f of changed) this._pushFeature(f, layer, entities.get(f.id), sig);
    }

    this.host.setLayerVisibility(layer.id, layer.visible !== false);
    this.host.getLayerManager().setLayerBlocked(layer.id, layer.locked === true);
  }

  /** Nome, ordem, opacidade e interatividade da camada, sem tocar nas feições. */
  _applyLayerOptions(layerId, options) {
    const lm = this.host.getLayerManager();
    const def = lm.getLayerDef(layerId);
    if (!def) {
      this.host.definirFeicoes(layerId, [], options);
      return;
    }
    if (def.nome !== options.nome) def.nome = options.nome;
    if (def.interativo !== options.interativo) def.interativo = options.interativo;
    if (def.zIndex !== options.zIndex) lm.setLayerZIndex(layerId, options.zIndex);
    if (def.opacidade !== options.opacidade) lm.setLayerOpacity(layerId, options.opacidade);
  }

  /** Envia uma feição ao componente (adiciona ou substitui, trocando de camada se preciso). */
  _pushFeature(feat, layer, entidadeId, sig) {
    const layerId = layer ? layer.id : feat.layerId;
    const previous = this._applied.get(feat.id);
    if (previous && previous.layerId !== layerId) this.host.removerFeicao(previous.layerId, feat.id);

    const feicao = this._toFeicao(feat, layer, entidadeId);
    if (!feicao) {
      if (previous) this.host.removerFeicao(previous.layerId, feat.id);
      this._applied.delete(feat.id);
      return null;
    }
    // adicionarFeicao substitui pelo id: atributos apagados no app não ficam para trás no componente
    this.host.adicionarFeicao(layerId, feicao, layer ? { nome: layer.name } : undefined);
    this._applied.set(feat.id, { ref: feat, layerId, layerSig: sig ?? this._layerSignature(layer), entidadeId });
    return feicao;
  }

  addFeature(feat, layers) {
    return this.updateFeature(feat, layers);
  }

  updateFeature(feat, layers) {
    if (!feat || !feat.id) return;
    if (layers && layers !== this._layers) {
      this._layers = layers;
      this._layerMap = new Map(layers.map(l => [l.id, l]));
    }
    const index = this._features.findIndex(f => f.id === feat.id);
    if (index >= 0) this._features[index] = feat;
    else this._features.push(feat);
    this._featureMap.set(feat.id, feat);

    if (this._isDeleted(feat)) {
      this.removeFeature(feat.id);
      return;
    }
    const layer = this._layerMap.get(feat.layerId);
    const status = GeometryVersionManager.getFeatureStatus(feat);
    if (status || this._applied.get(feat.id)?.entidadeId) {
      // o vínculo oficial × prévia pode mudar para os pares: recalcula e reenvia só o que mudou
      this.renderFeatures(this._features, this._layers);
      return;
    }
    this._pushFeature(feat, layer, undefined);
  }

  removeFeature(featId) {
    const applied = this._applied.get(featId);
    this._featureMap.delete(featId);
    const index = this._features.findIndex(f => f.id === featId);
    if (index >= 0) this._features.splice(index, 1);
    if (applied) {
      this.host.removerFeicao(applied.layerId, featId);
      this._applied.delete(featId);
    }
    this.selectedFeatureIds.delete(featId);
    if (this.selectedFeatureId === featId) this.selectedFeatureId = null;
  }

  setLayerVisibility(layerId, isVisible) {
    const layer = this._layerMap.get(layerId);
    if (layer) layer.visible = isVisible;
    this.host.setLayerVisibility(layerId, isVisible !== false);
  }

  setLayerOpacity(layerId, opacity) {
    const layer = this._layerMap.get(layerId);
    if (layer) layer.opacity = opacity;
    this.host.setLayerOpacity(layerId, Number(opacity));
  }

  setLayerColor(layerId, color) {
    const layer = this._layerMap.get(layerId);
    if (!layer) return;
    layer.color = color;
    this.renderFeatures(this._features, this._layers);
  }

  reorderLayers(layers) {
    this._layers = layers || [];
    this._layerMap = new Map(this._layers.map(l => [l.id, l]));
    const lm = this.host.getLayerManager();
    const total = this._layers.length;
    this._layers.forEach((layer, index) => lm.setLayerZIndex(layer.id, this._zIndexFor(index, total)));
  }

  // ------------------------------------------------------------------------
  // Seleção e popup
  // ------------------------------------------------------------------------

  _ref(id) {
    const feat = this._featureMap.get(id);
    const applied = this._applied.get(id);
    const camadaId = applied?.layerId || feat?.layerId;
    return camadaId ? { camadaId, id: String(id) } : null;
  }

  selectFeature(featureId) {
    if (!featureId) return this.clearSelection();
    this.selectFeatures([featureId]);
  }

  selectFeatures(featureIds = []) {
    const refs = (featureIds || []).map(id => this._ref(id)).filter(Boolean);
    this.host.selecionarFeicoes(refs, false);
    // Seleção vinda de fora (árvore, tabela, atalho) não abre o popup do mapa
    this.host.fecharPopupFeicao();
  }

  toggleFeatureSelection(featureId) {
    const ref = this._ref(featureId);
    if (!ref) return;
    this.host.alternarSelecaoFeicao(ref.camadaId, ref.id);
  }

  clearSelection() {
    this.host.limparSelecaoFeicoes();
    this.host.fecharPopupFeicao();
  }

  getSelectedFeatures() {
    return [...this.selectedFeatureIds].map(id => this._featureMap.get(id)).filter(Boolean);
  }

  closeFeaturePopup() {
    this.host?.fecharPopupFeicao?.();
  }

  setFeaturePopupEnabled(enabled) {
    this.popupEnabled = Boolean(enabled);
    try {
      localStorage.setItem('cm_feature_popup_enabled', String(this.popupEnabled));
    } catch {}
    if (!this.popupEnabled) {
      this.closeFeaturePopup();
    }
    return this.popupEnabled;
  }

  toggleFeaturePopupEnabled() {
    return this.setFeaturePopupEnabled(!this.popupEnabled);
  }

  isFeaturePopupEnabled() {
    return Boolean(this.popupEnabled);
  }

  openFeaturePopup(featureId) {
    if (!featureId) return;
    const feat = this._featureMap?.get(featureId);
    const ref = this._ref?.(featureId);
    if (!feat || !ref) return;
    this._updatePopupMargins?.();
    this.host?.selecionarFeicoes?.([ref], true);
  }

  // ------------------------------------------------------------------------
  // Ferramentas de desenho
  // ------------------------------------------------------------------------

  get activeTool() { return this._tool; }

  get isDrawing() {
    return this._tool !== 'select' && this.host.nosDesenho > 0;
  }

  /** Compatível com quem só lê `.length`: um item por vértice já colocado. */
  get drawingPoints() {
    return this.isDrawing ? new Array(this.host.nosDesenho).fill(null) : [];
  }

  _drawingLayerId() {
    return this.activeDrawingLayer?.id || this._layers[0]?.id || null;
  }

  _pushDrawingContext() {
    const layerId = this._drawingLayerId();
    this.host.definirCamadaDesenho(layerId);
    const s = this.activeDrawingStyles || {};
    const estilo = {};
    if (s.strokeColor !== undefined) estilo.corTraco = s.strokeColor;
    if (s.fillColor !== undefined) estilo.corPreenchimento = s.fillColor;
    else if (this.activeDrawingLayer?.color) estilo.corPreenchimento = this.activeDrawingLayer.color;
    if (s.fillColor === 'none' || s.fillColor === 'transparent') estilo.opacidadePreenchimento = 0;
    else if (s.fillOpacity !== undefined) estilo.opacidadePreenchimento = Number(s.fillOpacity);
    if (s.strokeColor === 'none' || s.strokeColor === 'transparent') estilo.espessuraTraco = 0;
    else if (s.strokeWidth !== undefined) estilo.espessuraTraco = Number(s.strokeWidth);
    this.host.definirEstiloDesenho(estilo);
  }

  setTool(tool, startAt = null) {
    if (!tool || tool === 'select') {
      this.host.definirFerramenta(null);
      this._syncToolState('select');
      return;
    }
    const kitTool = TOOL_TO_KIT[tool];
    if (!kitTool) {
      this.host.definirFerramenta(null);
      this._syncToolState('select');
      return;
    }
    this._pushDrawingContext();
    const options = startAt ? { iniciarEm: startAt } : undefined;
    const result = this.host.definirFerramenta(kitTool, options);
    if (!result.ok) {
      // recusada (sem camada, camada bloqueada...): mantém `select` e devolve a barra ao estado real
      this.host.definirFerramenta(null);
      this._tool = 'select';
      this.onToolChange('select');
      return;
    }
    this._syncToolState(tool);
  }

  /** Liga a ferramenta já com o primeiro vértice na coordenada (menu de contexto: "iniciar aqui"). */
  startTool(tool, latlng) {
    if (!latlng) return this.setTool(tool);
    const lat = latlng.lat !== undefined ? latlng.lat : latlng[0];
    const lng = latlng.lng !== undefined ? latlng.lng : latlng[1];
    this.setTool(tool, [lat, lng]);
  }

  notifyToolChange(tool) { this.onToolChange(tool); }

  /** Reinicia a figura em andamento mantendo a ferramenta. */
  resetDrawingState() {
    const tool = this._tool;
    if (tool === 'select') return;
    this.host.definirFerramenta(null);
    this.setTool(tool);
  }

  undoLastVertex() { return this.host.desfazerVerticeDesenho(); }

  setSnappingEnabled(enabled) {
    this.host.definirSnap(Boolean(enabled));
    this.snappingEnabled = this.host.snapLigado;
    return this.snappingEnabled;
  }

  setAutoZoomEnabled(enabled) {
    this.autoZoomEnabled = !!enabled;
    try { localStorage.setItem('cm_auto_zoom', String(this.autoZoomEnabled)); } catch { /* sem armazenamento */ }
    return this.autoZoomEnabled;
  }

  toggleSnapping() {
    return this.setSnappingEnabled(!this.host.snapLigado);
  }

  setActiveDrawingLayer(layer) {
    this.activeDrawingLayer = layer;
    if (this._tool !== 'select') this._pushDrawingContext();
  }

  setActiveDrawingStyles(styles) {
    this.activeDrawingStyles = { ...(this.activeDrawingStyles || {}), ...styles };
    if (this._tool !== 'select') this._pushDrawingContext();
  }

  // ------------------------------------------------------------------------
  // Feição desenhada / medida / dividida -> callbacks do app
  // ------------------------------------------------------------------------

  _shapeStyle() {
    const s = this.activeDrawingStyles || {};
    const isFillNone = s.fillColor === 'none' || s.fillColor === 'transparent';
    const isStrokeNone = s.strokeColor === 'none' || s.strokeColor === 'transparent';
    return {
      fillColor: isFillNone ? 'none' : (s.fillColor || this.activeDrawingLayer?.color || '#00E08A'),
      strokeColor: isStrokeNone ? 'none' : (s.strokeColor || '#ffffff'),
      fillOpacity: isFillNone ? 0 : (s.fillOpacity !== undefined ? s.fillOpacity : 0.35),
      strokeWidth: isStrokeNone ? 0 : (s.strokeWidth !== undefined ? s.strokeWidth : 2.5)
    };
  }

  /** O componente já adicionou a feição na própria camada; o app decide o que fazer (nome, modal, gravação). */
  _handleKitCreated({ camadaId, feicao }) {
    this.host.removerFeicao(camadaId, feicao.id);
    const g = feicao.geometria;
    const shape = this._shapeStyle();
    const layerId = camadaId;
    let raw = null;

    if (g.tipo === 'Point') {
      raw = {
        type: 'Point', coordinates: g.coordenada, layerId, color: shape.strokeColor,
        style: { fillColor: shape.fillColor, strokeColor: shape.strokeColor, fillOpacity: 1, markerSize: 24 }
      };
    } else if (g.tipo === 'LineString') {
      raw = {
        type: 'LineString', coordinates: g.coordenadas, layerId, color: shape.strokeColor,
        style: { strokeColor: shape.strokeColor, strokeWidth: shape.strokeWidth }
      };
    } else if (g.tipo === 'Polygon') {
      raw = { type: 'Polygon', coordinates: g.aneis[0], layerId, color: shape.strokeColor, style: { ...shape } };
    } else if (g.tipo === 'Circle') {
      raw = { type: 'Circle', coordinates: g.centro, radius: Math.round(g.raioMetros), layerId, color: shape.strokeColor, style: { ...shape } };
    } else if (g.tipo === 'Text') {
      raw = {
        type: 'Text', coordinates: g.coordenada, layerId, name: g.texto, properties: { text: g.texto },
        style: { fontSize: 13, textColor: '#ffffff', backgroundColor: 'rgba(15, 23, 42, 0.88)' }
      };
    }
    if (!raw) return;
    if (raw.type === 'Polygon' || raw.type === 'LineString') {
      raw.coordinates = FeatureGeometryUtils.mergeCoincidentVertices(raw.coordinates, raw.type);
    }

    // Regra do GEMINI.md: limpar o desenho, voltar para `select` e só então avisar o app
    this.host.definirFerramenta(null);
    this._syncToolState('select');
    this.onFeatureCreated(raw);
  }

  _handleKitMeasure(info) {
    const coords = info.pontos.map(p => [p[0], p[1]]);
    if (coords.length < 2) return;
    const total = this.calculatePolylineLength(coords);
    const distText = total > 1000 ? `${(total / 1000).toFixed(2)} km` : `${total.toFixed(1)} m`;
    const segs = this.calculateSegments(coords);
    const segText = segs.map((s, i) => `T${i + 1}: ${s.distance > 1000 ? (s.distance / 1000).toFixed(2) + 'km' : s.distance.toFixed(1) + 'm'}`).join(', ');

    let areaM2 = 0;
    if (coords.length >= 3) areaM2 = this.calculatePolygonArea(coords);

    this.host.limparMedicao();
    this.host.definirFerramenta(null);
    this._syncToolState('select');

    this.onFeatureCreated({
      type: 'LineString',
      coordinates: coords,
      name: `Medição (${distText})`,
      category: 'Medição & Cotas',
      layerId: this._drawingLayerId(),
      color: '#f59e0b',
      properties: {
        'Extensão Total': distText,
        'Vértices': coords.length,
        'Trechos': segText,
        ...(areaM2 > 0 ? { 'Área Delimitada': `${(areaM2 / 10000).toFixed(2)} ha`, 'Área (m²)': areaM2.toFixed(1) + ' m²' } : {})
      },
      style: { strokeColor: '#f59e0b', strokeWidth: 3, strokeDashArray: '6, 4', showLabel: true, labelField: 'extensao' }
    });
  }

  _handleKitSplit({ origem, partes }) {
    // As partes criadas pelo componente são descartadas: o app gera as próprias feições (ids, nomes, gravação)
    partes.forEach(p => this.host.removerFeicao(p.camadaId, p.id));
    const target = this._featureMap.get(origem.id);
    const polygons = partes.map(p => p.geometria.aneis[0]);
    this.host.definirFerramenta(null);
    this._syncToolState('select');
    if (target && typeof this.onFeatureSplit === 'function') this.onFeatureSplit(target, polygons, null);
  }

  /** Geometria do componente -> coordenadas no formato do app. */
  _coordinatesOf(feicao) {
    const g = feicao.geometria;
    switch (g.tipo) {
      case 'Point':
      case 'Text': return g.coordenada;
      case 'Circle': return g.centro;
      case 'LineString': return g.coordenadas;
      case 'Polygon': return g.aneis.length === 1 ? g.aneis[0] : g.aneis;
      default: return null;
    }
  }

  _handleKitUpdated({ feicao }) {
    const original = this._featureMap.get(feicao.id);
    if (!original) return;
    const coordinates = this._coordinatesOf(feicao);
    if (!coordinates) return;
    const updated = { ...original, coordinates };
    // vértice arrastado exatamente sobre o vizinho vira um só (a forma fecha); o app devolve a geometria ao componente
    if (updated.type === 'Polygon' || updated.type === 'LineString') {
      updated.coordinates = FeatureGeometryUtils.mergeCoincidentVertices(coordinates, updated.type);
    }
    // a alça de borda do círculo muda o raio, não as coordenadas
    if (feicao.geometria.tipo === 'Circle') updated.radius = Math.round(feicao.geometria.raioMetros * 100) / 100;
    if (this._vertexCallback && this.host.editandoVertices) this._vertexCallback(updated);
    else this.onFeatureUpdated(updated);
  }

  // ------------------------------------------------------------------------
  // Edição de vértices
  // ------------------------------------------------------------------------

  startVertexEditing(feature, onUpdated) {
    if (!feature || feature.locked) return;
    this._vertexCallback = onUpdated || null;
    const ref = this._ref(feature.id);
    if (!ref) return;
    const result = this.host.editarVertices(ref.camadaId, ref.id);
    if (!result.ok) this._vertexCallback = null;
  }

  stopVertexEditing() {
    this._vertexCallback = null;
    this.host.pararEdicaoVertices();
  }

  // ------------------------------------------------------------------------
  // Câmera
  // ------------------------------------------------------------------------

  zoomToFeature(featureId) {
    const feat = this._featureMap.get(featureId);
    if (!feat) return;
    const layer = this._layerMap.get(feat.layerId);
    if (layer && layer.visible === false) {
      layer.visible = true;
      this.setLayerVisibility(feat.layerId, true);
    }
    if (feat.visible === false) {
      feat.visible = true;
      this.updateFeature(feat);
    }
    const ref = this._ref(featureId);
    if (ref) this.host.zoomParaFeicao(ref.camadaId, ref.id);
  }

  /**
   * Traz a feição para a tela só se ela estiver fora da vista, sem mexer no zoom.
   * Usado ao selecionar pela tabela/teclado, para não "pular" o mapa a cada seleção.
   */
  revealFeature(featureId) {
    if (!this.autoZoomEnabled) return;
    const feat = this._featureMap.get(featureId);
    const b = feat && SpatialIndex.computeBounds(feat);
    if (!b || !this.map) return;
    const center = L.latLng((b.minLat + b.maxLat) / 2, (b.minLng + b.maxLng) / 2);
    if (this.map.getBounds().contains(center)) return;
    this.map.panTo(center, { animate: true, duration: 0.3 });
  }

  zoomToFeatures(features = []) {
    if (!features || features.length === 0) return;
    if (features.length === 1) return this.zoomToFeature(features[0].id);
    const refs = features.map(f => this._ref(f.id)).filter(Boolean);
    if (refs.length) this.host.zoomParaFeicoes(refs);
  }

  fitAllFeatures() { this.host.ajustarTudo(); }

  fitLayer(layerId) {
    const layer = this._layerMap.get(layerId);
    if (layer && layer.visible === false) {
      layer.visible = true;
      this.setLayerVisibility(layerId, true);
    }
    this.host.ajustarCamada(layerId);
  }

  // ------------------------------------------------------------------------
  // Versões de geometria (oficial × prévia)
  // ------------------------------------------------------------------------

  setGlobalShowPreviews(showPreviews) {
    this.showPreviewGeometries = Boolean(showPreviews);
    this.host.definirPreviasGlobais(this.showPreviewGeometries);
  }

  toggleIndividualPreview(featureId) {
    const ref = this._ref(featureId);
    if (!ref) return false;
    const active = this.host.alternarPrevia(ref.camadaId, ref.id);
    if (active) this.individualPreviewToggles.add(featureId);
    else this.individualPreviewToggles.delete(featureId);
    return Boolean(active);
  }

  isFeaturePreviewActive(feat) {
    if (!feat) return false;
    if (this.showPreviewGeometries) return true;
    const ref = this._ref(feat.id);
    return ref ? this.host.previaSolicitada(ref.camadaId, ref.id) : false;
  }

  // ------------------------------------------------------------------------
  // Cálculos geodésicos (sem mapa)
  // ------------------------------------------------------------------------

  calculateDistance(p1, p2) { return FeatureGeometryUtils.calculateDistance(p1, p2); }
  calculatePolylineLength(coords) { return FeatureGeometryUtils.calculatePolylineLength(coords); }
  calculatePolygonArea(coords) { return FeatureGeometryUtils.calculatePolygonArea(coords); }
  calculateBearing(p1, p2) { return FeatureGeometryUtils.calculateBearing(p1, p2); }
  calculateSegments(coords, isClosed = false) { return FeatureGeometryUtils.calculateSegments(coords, isClosed); }

  // ------------------------------------------------------------------------
  // Colaboração
  // ------------------------------------------------------------------------

  updateRemoteCursor(user, latlng) {
    if (!user || !latlng || isNaN(latlng[0]) || isNaN(latlng[1])) return;
    this._remoteCursors.add(user.id);
    this.host.atualizarCursorRemoto({ id: String(user.id), nome: user.name || 'Colaborador', cor: user.color }, latlng);
  }

  removeRemoteCursor(userId) {
    this._remoteCursors.delete(userId);
    this.host.removerCursorRemoto(String(userId));
  }

  // ------------------------------------------------------------------------
  // Ciclo de vida
  // ------------------------------------------------------------------------

  destroy() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    if (this._cursorRaf) {
      cancelAnimationFrame(this._cursorRaf);
      this._cursorRaf = null;
    }
    this._disposers.forEach(dispose => dispose());
    this._disposers = [];

    if (this.currentBaseLayer && this.map) {
      this.map.removeLayer(this.currentBaseLayer);
      this.currentBaseLayer = null;
    }
    this.baseLayers = {};

    const host = this.host;
    this.host = null;
    this.map = null;
    this._applied.clear();
    this._featureMap.clear();
    this._features = [];
    CanvasHost.dispose(host);
  }
}
