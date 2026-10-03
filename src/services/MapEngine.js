/* ==========================================================================
   ConecteMapas - MapEngine (Core Facade & Orchestrator)
   Motor Cartográfico com Leaflet, Aceleração Gráfica por Canvas, Ferramentas CAD
   ========================================================================== */

import L from 'leaflet';
import { DrawingEngine } from './MapEngine/DrawingEngine.js';
import { VertexEditor } from './MapEngine/VertexEditor.js';
import { FeatureRenderer } from './MapEngine/FeatureRenderer.js';
import { FeatureHitTester } from './MapEngine/FeatureHitTester.js';
import { FeaturePopupBuilder } from './MapEngine/FeaturePopupBuilder.js';
import { SpatialIndex } from './SpatialIndex.js';
import { SpatialAlgorithms } from './SpatialAlgorithms.js';
import { GeometryVersionManager } from './GeometryVersionManager.js';

export class MapEngine {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.options = {
      center: options.center || [-23.7661, -53.3206],
      zoom: options.zoom || 14,
      ...options
    };

    this.map = null;
    this.baseLayers = {};
    this.currentBaseLayer = null;
    this.featureLayers = new Map();
    this.renderedFeatures = new Map();
    this.remoteCursors = new Map();
    this.spatialIndex = new SpatialIndex();

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
    this._justBoxSelected = false;

    // Controle de Exibição de Geometrias Oficiais vs Prévias
    this.showPreviewGeometries = false;
    this.individualPreviewToggles = new Set();

    this.initMap();
    this.drawingEngine = new DrawingEngine(this);
    this.vertexEditor = new VertexEditor(this);
    this.featureRenderer = new FeatureRenderer(this);
    this.hitTester = new FeatureHitTester(this);
    this._featurePopup = null;
    this._popupFeatureId = null;
    this.bindEvents();
  }

  setGlobalShowPreviews(showPreviews) {
    this.showPreviewGeometries = !!showPreviews;
    if (this.featureRenderer) {
      this.featureRenderer.updateViewportCulling(true);
    }
  }

  toggleGlobalShowPreviews() {
    this.showPreviewGeometries = !this.showPreviewGeometries;
    if (this.featureRenderer) {
      this.featureRenderer.updateViewportCulling(true);
    }
    return this.showPreviewGeometries;
  }

  toggleIndividualPreview(featureId) {
    if (!featureId) return false;
    let isActive = false;
    if (this.individualPreviewToggles.has(featureId)) {
      this.individualPreviewToggles.delete(featureId);
      isActive = false;
    } else {
      this.individualPreviewToggles.add(featureId);
      isActive = true;
    }
    if (this.featureRenderer) {
      this.featureRenderer.updateViewportCulling(true);
    }
    return isActive;
  }

  isFeaturePreviewActive(feat) {
    if (!feat) return false;
    if (this.showPreviewGeometries) return true;
    return this.individualPreviewToggles.has(feat.id);
  }

  initMap() {
    this.map = L.map(this.containerId, {
      center: this.options.center,
      zoom: this.options.zoom,
      maxZoom: 22,
      preferCanvas: true, // Aceleração gráfica por GPU via Canvas para milhares de vetores
      doubleClickZoom: false,
      zoomControl: false,
      attributionControl: false,
      dragging: false // Desativa arrasto pelo botão esquerdo, liberando-o para a caixa de seleção
    });

    L.control.zoom({ position: 'bottomright' }).addTo(this.map);
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(this.map);

    this.initBaseLayers();
  }

  initBaseLayers() {
    this.baseLayers = {
      google_satelite_puro: L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxNativeZoom: 20,
        maxZoom: 22,
        attribution: '© Google Maps (Satélite Puro)',
        crossOrigin: true
      }),
      google_satelite: L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        maxNativeZoom: 20,
        maxZoom: 22,
        attribution: '© Google Maps (Híbrido)',
        crossOrigin: true
      }),
      satelite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxNativeZoom: 18,
        maxZoom: 22,
        attribution: 'Esri Satellite',
        crossOrigin: true
      }),
      osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxNativeZoom: 19,
        maxZoom: 22,
        attribution: '© OpenStreetMap',
        crossOrigin: true
      }),
      topografia: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxNativeZoom: 17,
        maxZoom: 22,
        attribution: 'OpenTopoMap',
        crossOrigin: true
      }),
      dark: L.layerGroup([
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
          maxNativeZoom: 16,
          maxZoom: 22,
          attribution: 'Esri Dark Gray',
          crossOrigin: true
        }),
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
          maxNativeZoom: 16,
          maxZoom: 22,
          crossOrigin: true
        })
      ])
    };

    if (this.options.initialBasemap !== undefined) {
      this.setBaseLayer(this.options.initialBasemap);
    } else {
      this.setBaseLayer('google_satelite');
    }
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

  bindEvents() {
    let mouseMovePending = false;
    let latestMouseMoveEvent = null;
    this._mouseMoveRafId = null;

    const mapContainer = this.map.getContainer();

    // --------------------------------------------------------------------------
    // 1. PAN COM A RODINHA DO MOUSE (Middle Click / Wheel Button Pan)
    // --------------------------------------------------------------------------
    this._isMiddlePanning = false;
    this._middlePanStart = null;

    mapContainer.addEventListener('auxclick', (e) => {
      if (e.button === 1) e.preventDefault();
    });

    mapContainer.addEventListener('mousedown', (e) => {
      if (e.button === 1) { // Rodinha do mouse
        e.preventDefault();
        e.stopPropagation();
        this._isMiddlePanning = true;
        this._middlePanStart = { x: e.clientX, y: e.clientY };
        mapContainer.style.cursor = 'grabbing';
        document.body.style.cursor = 'grabbing';
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this._isMiddlePanning && this._middlePanStart) {
        e.preventDefault();
        const dx = e.clientX - this._middlePanStart.x;
        const dy = e.clientY - this._middlePanStart.y;
        if (dx !== 0 || dy !== 0) {
          this.map.panBy([-dx, -dy], { animate: false });
          this._middlePanStart = { x: e.clientX, y: e.clientY };
        }
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (this._isMiddlePanning && (e.button === 1 || e.buttons === 0)) {
        this._isMiddlePanning = false;
        this._middlePanStart = null;
        mapContainer.style.cursor = this.activeTool === 'select' ? '' : 'crosshair';
        document.body.style.cursor = '';
      }
    });

    // --------------------------------------------------------------------------
    // 2. CAIXA DE SELEÇÃO COM O BOTÃO ESQUERDO (Left Click Marquee Selection Box)
    // --------------------------------------------------------------------------
    this._isBoxSelecting = false;
    this._boxSelectStart = null;
    this._selectionBoxEl = null;

    mapContainer.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (this.activeTool !== 'select') return;

      const isControl = e.target.closest('.leaflet-control, .cm-map-hud, .cm-sidebar, button, input, select, a');
      if (isControl) return;

      this._boxSelectStart = { x: e.clientX, y: e.clientY };
      this._boxSelectModifiers = { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey };
      this._isBoxSelecting = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (this._boxSelectStart && this.activeTool === 'select') {
        const dx = e.clientX - this._boxSelectStart.x;
        const dy = e.clientY - this._boxSelectStart.y;

        if (!this._isBoxSelecting && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
          this._isBoxSelecting = true;
          if (!this._selectionBoxEl) {
            this._selectionBoxEl = document.createElement('div');
            this._selectionBoxEl.className = 'cm-selection-box';
            mapContainer.appendChild(this._selectionBoxEl);
          }
        }

        if (this._isBoxSelecting && this._selectionBoxEl) {
          const rect = mapContainer.getBoundingClientRect();
          const startX = this._boxSelectStart.x - rect.left;
          const startY = this._boxSelectStart.y - rect.top;
          const currentX = e.clientX - rect.left;
          const currentY = e.clientY - rect.top;

          const left = Math.max(0, Math.min(startX, currentX));
          const top = Math.max(0, Math.min(startY, currentY));
          const width = Math.min(rect.width - left, Math.abs(currentX - startX));
          const height = Math.min(rect.height - top, Math.abs(currentY - startY));

          this._selectionBoxEl.style.left = `${left}px`;
          this._selectionBoxEl.style.top = `${top}px`;
          this._selectionBoxEl.style.width = `${width}px`;
          this._selectionBoxEl.style.height = `${height}px`;
          this._selectionBoxEl.style.display = 'block';
        }
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0 && this._boxSelectStart) {
        if (this._isBoxSelecting && this._selectionBoxEl) {
          const rect = mapContainer.getBoundingClientRect();
          const startX = this._boxSelectStart.x - rect.left;
          const startY = this._boxSelectStart.y - rect.top;
          const endX = e.clientX - rect.left;
          const endY = e.clientY - rect.top;

          const minX = Math.min(startX, endX);
          const maxX = Math.max(startX, endX);
          const minY = Math.min(startY, endY);
          const maxY = Math.max(startY, endY);

          const nw = this.map.containerPointToLatLng([minX, minY]);
          const se = this.map.containerPointToLatLng([maxX, maxY]);
          const boxBounds = L.latLngBounds(nw, se);
          const pixelBox = { minX, minY, maxX, maxY };

          const matchedFeatures = this.findFeaturesInBounds(boxBounds, pixelBox);
          this.handleBoxSelectionResult(matchedFeatures, this._boxSelectModifiers);

          this._selectionBoxEl.remove();
          this._selectionBoxEl = null;
          this._justBoxSelected = true;
          setTimeout(() => { this._justBoxSelected = false; }, 250);
        }

        this._isBoxSelecting = false;
        this._boxSelectStart = null;
      }
    });

    // --------------------------------------------------------------------------
    // 3. CURSOR E DESENHO CAD
    // --------------------------------------------------------------------------
    this.map.on('mousemove', (e) => {
      latestMouseMoveEvent = e;

      if (!mouseMovePending) {
        mouseMovePending = true;
        this._mouseMoveRafId = requestAnimationFrame(() => {
          mouseMovePending = false;
          this._mouseMoveRafId = null;
          if (latestMouseMoveEvent) {
            this.onCursorMove(latestMouseMoveEvent.latlng);
            this._updateHoverCursor(latestMouseMoveEvent.latlng);
            // Aciona o DrawingEngine se houver uma ferramenta CAD ativa
            if (this.drawingEngine && this.drawingEngine.activeTool !== 'select') {
              this.drawingEngine.handleMouseMove(latestMouseMoveEvent);
            }
          }
        });
      }
    });

    this.map.on('click', (e) => {
      if (this.drawingEngine && this.drawingEngine.activeTool !== 'select') {
        this.drawingEngine.handleClick(e);
      } else if (this.activeTool === 'select') {
        if (this._justBoxSelected) {
          this._justBoxSelected = false;
          return;
        }
        // Marcadores DOM já trataram o próprio clique
        if (e.originalEvent && e.originalEvent._cmFeatureClicked) return;

        // Hit-test unificado sobre todas as camadas visíveis (os canvases não recebem eventos)
        const hit = this.hitTester.pickForClick(e.latlng);
        if (hit) {
          this.handleFeatureClick(hit, e.originalEvent, e.latlng);
        } else {
          this.clearSelection();
        }
      }
    });

    this.map.on('dblclick', () => {
      if (this.drawingEngine) this.drawingEngine.handleDoubleClick();
    });

    this.map.on('contextmenu', (e) => {
      if (e && e.originalEvent) {
        e.originalEvent.preventDefault();
      }

      // Se estiver desenhando com uma ferramenta CAD ativa
      if (this.drawingEngine && this.drawingEngine.activeTool !== 'select') {
        const tool = this.drawingEngine.activeTool;
        const pts = this.drawingEngine.drawingPoints;
        const minPts = tool === 'polygon' ? 3 : (tool === 'line' || tool === 'measure' ? 2 : 1);
        if (pts.length >= minPts) {
          this.drawingEngine.finalizeCurrentDrawing();
        } else if (pts.length > 0) {
          this.drawingEngine.undoLastVertex();
        } else {
          this.setTool('select');
        }
        return;
      }

      // Modo Select / Normal: Aciona Menu de Contexto CAD/GIS
      const feature = e.originalEvent?._cmFeatureRightClicked || this.hitTester.pickTop(e.latlng) || null;
      if (this.onContextMenu) {
        this.onContextMenu({
          latlng: e.latlng,
          point: e.containerPoint,
          originalEvent: e.originalEvent,
          feature
        });
      }
    });

    this.map.on('moveend zoomend', () => {
      if (this.featureRenderer) {
        this.featureRenderer.updateViewportCulling();
      }
    });

    this._onKeyDown = (e) => {
      const path = e.composedPath ? e.composedPath() : [e.target];
      const isInput = path.some(el => 
        el && el.tagName && (
          el.tagName === 'INPUT' || 
          el.tagName === 'TEXTAREA' || 
          el.tagName === 'SELECT' || 
          el.tagName.toLowerCase().includes('campo-texto') ||
          el.tagName.toLowerCase().includes('lista-flutuante') ||
          el.isContentEditable
        )
      );
      if (isInput) return;
      
      if (this.drawingEngine && this.drawingEngine.activeTool !== 'select') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.drawingEngine.finalizeCurrentDrawing();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.drawingEngine.resetDrawingState();
          this.setTool('select');
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
          e.preventDefault();
          this.drawingEngine.undoLastVertex();
        }
      }
    };

    window.addEventListener('keydown', this._onKeyDown);
  }

  // --- Delegação de Ferramentas CAD ---
  get activeTool() { return this.drawingEngine ? this.drawingEngine.activeTool : 'select'; }
  get isDrawing() { 
    return Boolean(this.drawingEngine && this.drawingEngine.activeTool !== 'select' && this.drawingEngine.drawingPoints.length > 0); 
  }
  get drawingPoints() { 
    return this.drawingEngine ? this.drawingEngine.drawingPoints : []; 
  }
  setTool(tool) { 
    if (this.drawingEngine) {
      this.drawingEngine.setTool(tool); 
      if (this.onToolChange) {
        this.onToolChange(tool);
      }
    }
  }
  notifyToolChange(tool) {
    if (this.onToolChange) {
      this.onToolChange(tool);
    }
  }
  resetDrawingState() { this.drawingEngine.resetDrawingState(); }
  finalizeCurrentDrawing() { return this.drawingEngine.finalizeCurrentDrawing(); }
  undoLastVertex() { return this.drawingEngine.undoLastVertex(); }
  setActiveDrawingLayer(layer) {
    if (this.drawingEngine && typeof this.drawingEngine.setActiveDrawingLayer === 'function') {
      this.drawingEngine.setActiveDrawingLayer(layer);
    }
  }

  // --- Delegação de Renderização & Estilos Granulares ---
  renderFeatures(features, layers, forceRebuildIndex = false) { 
    this.featureRenderer.renderFeatures(features, layers, forceRebuildIndex); 
  }
  setLayerVisibility(layerId, isVisible) { this.featureRenderer.setLayerVisibility(layerId, isVisible); }
  setLayerOpacity(layerId, opacity) { this.featureRenderer.setLayerOpacity(layerId, opacity); }
  setLayerColor(layerId, color) { this.featureRenderer.setLayerColor(layerId, color); }
  reorderLayers(layers) { this.featureRenderer.reorderLayers(layers); }
  addFeature(feat, layers) {
    if (feat) this.spatialIndex.insert(feat);
    return this.featureRenderer.addFeature(feat, layers || this.featureRenderer.allLayers);
  }
  updateFeature(feat, layers) {
    if (feat) this.spatialIndex.update(feat);
    const result = this.featureRenderer.updateFeature(feat, layers || this.featureRenderer.allLayers);
    this.refreshFeaturePopup(feat);
    return result;
  }
  removeFeature(featId) {
    if (featId === this._popupFeatureId) this.closeFeaturePopup();
    this.spatialIndex.remove(featId);
    this.featureRenderer.removeFeature(featId);
  }

  findFeaturesInBounds(bounds, pixelBox = null) {
    if (!bounds || !this.featureRenderer) return [];

    const validLayers = new Set(
      (this.featureRenderer.allLayers || [])
        .filter(l => l.visible !== false)
        .map(l => l.id)
    );

    const allFeatures = this.featureRenderer.allFeatures || [];
    const candidates = this.spatialIndex.query(bounds, 0) || [];
    const results = [];
    const seen = new Set();

    candidates.forEach(feat => {
      if (!feat || !feat.id || seen.has(feat.id)) return;
      if (feat.visible === false || !validLayers.has(feat.layerId)) return;

      // Salvaguarda: Não seleciona geometrias prévias ocultas se houver geometria oficial ativa
      const shouldRender = GeometryVersionManager.shouldRenderFeature(
        feat,
        allFeatures,
        this.showPreviewGeometries,
        this.individualPreviewToggles
      );
      if (!shouldRender) return;

      // Narrow-Phase Geometric Testing: Exige toque/interseção geométrica real
      if (SpatialAlgorithms.featureIntersectsBounds(feat, bounds, this.map, pixelBox)) {
        seen.add(feat.id);
        results.push(feat);
      }
    });

    return results;
  }

  handleBoxSelectionResult(matchedFeatures, { shift = false, ctrl = false } = {}) {
    const prevSelectedIds = new Set(this.selectedFeatureIds);

    if (shift || ctrl) {
      matchedFeatures.forEach(f => this.selectedFeatureIds.add(f.id));
    } else {
      this.selectedFeatureIds.clear();
      matchedFeatures.forEach(f => this.selectedFeatureIds.add(f.id));
    }

    this.selectedFeatureId = this.selectedFeatureIds.size === 1
      ? Array.from(this.selectedFeatureIds)[0]
      : null;

    if (this.featureRenderer) {
      this.featureRenderer.refreshSelectionVisuals(prevSelectedIds, this.selectedFeatureIds);
    }
    this._syncPopupWithSelection();

    if (this.onFeaturesSelected) {
      const selectedList = this.featureRenderer.allFeatures.filter(f => this.selectedFeatureIds.has(f.id));
      this.onFeaturesSelected(selectedList);
    }
  }

  selectFeatures(featureIds = []) {
    const prevSelectedIds = new Set(this.selectedFeatureIds);
    this.selectedFeatureIds.clear();
    (featureIds || []).forEach(id => this.selectedFeatureIds.add(id));
    this.selectedFeatureId = featureIds.length === 1 ? featureIds[0] : null;
    if (this.featureRenderer) {
      this.featureRenderer.refreshSelectionVisuals(prevSelectedIds, this.selectedFeatureIds);
    }
    this._syncPopupWithSelection();
    const selectedList = this.getSelectedFeatures();
    if (this.onFeaturesSelected) this.onFeaturesSelected(selectedList);
    if (this.onFeatureSelected) this.onFeatureSelected(selectedList[0] || null);
  }

  selectFeature(featureId) {
    const prevSelectedIds = new Set(this.selectedFeatureIds);
    this.selectedFeatureId = featureId;
    if (this.selectedFeatureIds) {
      this.selectedFeatureIds.clear();
      if (featureId) this.selectedFeatureIds.add(featureId);
    }
    if (this.featureRenderer) {
      this.featureRenderer.refreshSelectionVisuals(prevSelectedIds, this.selectedFeatureIds);
    }
    this._syncPopupWithSelection();
    const selectedList = this.getSelectedFeatures();
    if (this.onFeaturesSelected) this.onFeaturesSelected(selectedList);
    if (this.onFeatureSelected) this.onFeatureSelected(selectedList[0] || null);
  }

  toggleFeatureSelection(featureId) {
    if (!featureId) return;
    if (!this.selectedFeatureIds) {
      this.selectedFeatureIds = new Set();
    }
    const prevSelectedIds = new Set(this.selectedFeatureIds);
    if (this.selectedFeatureIds.has(featureId)) {
      this.selectedFeatureIds.delete(featureId);
    } else {
      this.selectedFeatureIds.add(featureId);
    }

    this.selectedFeatureId = this.selectedFeatureIds.size === 1
      ? Array.from(this.selectedFeatureIds)[0]
      : null;

    if (this.featureRenderer) {
      this.featureRenderer.refreshSelectionVisuals(prevSelectedIds, this.selectedFeatureIds);
    }
    this._syncPopupWithSelection();
    const selectedList = this.getSelectedFeatures();
    if (this.onFeaturesSelected) this.onFeaturesSelected(selectedList);
    if (this.onFeatureSelected) this.onFeatureSelected(selectedList[0] || null);
  }

  clearSelection() {
    const prevSelectedIds = new Set(this.selectedFeatureIds);
    this.selectedFeatureId = null;
    if (this.selectedFeatureIds) {
      this.selectedFeatureIds.clear();
    }
    if (this.featureRenderer) {
      this.featureRenderer.refreshSelectionVisuals(prevSelectedIds, new Set());
    }
    this.closeFeaturePopup();
    if (this.onFeaturesSelected) this.onFeaturesSelected([]);
    if (this.onFeatureSelected) this.onFeatureSelected(null);
  }

  /**
   * Clique simples em uma feição (via hit-test ou marcador DOM).
   * Shift/Ctrl alternam a feição na seleção múltipla; clique simples seleciona e abre o popup.
   */
  handleFeatureClick(feat, originalEvent = null, latlng = null) {
    if (!feat) return;
    const isMulti = !!(originalEvent && (originalEvent.shiftKey || originalEvent.ctrlKey || originalEvent.metaKey));
    if (isMulti) {
      this.toggleFeatureSelection(feat.id);
      return;
    }
    this.selectFeature(feat.id);
    this.openFeaturePopup(feat, latlng);
  }

  // --- Popup informativo da feição (instância única, aberta sob demanda) ---
  openFeaturePopup(feat, latlng = null) {
    if (!feat || !this.map) return;
    const layerConfig = this.featureRenderer?.layerMap?.get(feat.layerId) || null;
    const anchor = (feat.type === 'Point' || feat.type === 'Text' || feat.type === 'Circle' || !latlng)
      ? this._featureAnchor(feat, latlng)
      : latlng;
    if (!anchor) return;

    if (!this._featurePopup) {
      this._featurePopup = L.popup({
        className: 'cm-feature-popup',
        maxWidth: 340,
        minWidth: 260,
        // Topo: barra flutuante de seleção (HUD); base: barra da tabela de atributos
        autoPanPaddingTopLeft: [24, 76],
        autoPanPaddingBottomRight: [24, 40],
        closeButton: true
      });
      this._featurePopup.on('remove', () => { this._popupFeatureId = null; });
    }

    this._popupFeatureId = feat.id;
    this._featurePopup
      .setLatLng(anchor)
      .setContent(FeaturePopupBuilder.createFeaturePopupHtml(feat, layerConfig))
      .openOn(this.map);
    this._bindPopupActions(feat.id);
  }

  closeFeaturePopup() {
    if (this._featurePopup && this.map && this.map.hasLayer(this._featurePopup)) {
      this.map.closePopup(this._featurePopup);
    }
    this._popupFeatureId = null;
  }

  /** Atualiza o conteúdo do popup aberto quando a feição exibida muda (edição, sync remoto). */
  refreshFeaturePopup(feat) {
    if (!feat || feat.id !== this._popupFeatureId || !this._featurePopup) return;
    const layerConfig = this.featureRenderer?.layerMap?.get(feat.layerId) || null;
    this._featurePopup.setContent(FeaturePopupBuilder.createFeaturePopupHtml(feat, layerConfig));
    this._bindPopupActions(feat.id);
  }

  _syncPopupWithSelection() {
    if (!this._popupFeatureId) return;
    const ids = this.selectedFeatureIds;
    if (!ids || ids.size !== 1 || !ids.has(this._popupFeatureId)) {
      this.closeFeaturePopup();
    }
  }

  _featureAnchor(feat, fallback) {
    const leafLayer = this.renderedFeatures.get(feat.id);
    if (leafLayer && typeof leafLayer.getLatLng === 'function') return leafLayer.getLatLng();
    if (leafLayer && typeof leafLayer.getBounds === 'function') {
      const b = leafLayer.getBounds();
      if (b && b.isValid()) return b.getCenter();
    }
    return fallback;
  }

  _bindPopupActions(featureId) {
    const el = this._featurePopup && this._featurePopup.getElement();
    if (!el || el._cmActionsBound) return;
    el._cmActionsBound = true;
    L.DomEvent.disableClickPropagation(el);
    el.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-popup-action]');
      if (!btn) return;
      const id = this._popupFeatureId;
      const feat = id ? (this.featureRenderer?.featureMap?.get(id) || null) : null;
      if (feat) this.onFeatureAction(btn.getAttribute('data-popup-action'), feat);
    });
  }

  _updateHoverCursor(latlng) {
    const container = this.map ? this.map.getContainer() : null;
    if (!container) return;
    const canHover = this.activeTool === 'select' && !this._isBoxSelecting && !this._isMiddlePanning;
    const over = canHover && !!this.hitTester.pickTop(latlng);
    container.classList.toggle('cm-feature-hover', over);
  }

  getSelectedFeatures() {
    if (!this.selectedFeatureIds || this.selectedFeatureIds.size === 0) {
      if (this.selectedFeatureId) {
        const f = this.featureRenderer?.allFeatures?.find(x => x.id === this.selectedFeatureId);
        return f ? [f] : [];
      }
      return [];
    }
    return (this.featureRenderer?.allFeatures || []).filter(f => this.selectedFeatureIds.has(f.id));
  }

  zoomToFeature(featureId) { this.featureRenderer.zoomToFeature(featureId); }

  zoomToFeatures(features = []) {
    if (!features || features.length === 0) return;
    if (features.length === 1) {
      this.zoomToFeature(features[0].id);
      return;
    }
    const bounds = L.latLngBounds([]);
    features.forEach(f => {
      const bbox = SpatialIndex.computeBounds(f);
      if (bbox) {
        bounds.extend([bbox.minLat, bbox.minLng]);
        bounds.extend([bbox.maxLat, bbox.maxLng]);
      }
    });
    if (bounds.isValid() && this.map) {
      this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
    }
  }

  fitAllFeatures() { this.featureRenderer.fitAllFeatures(); }
  fitLayer(layerId) { this.featureRenderer.fitLayer(layerId); }

  // --- Delegação de Cálculos Geodésicos ---
  calculateDistance(p1, p2) { return this.featureRenderer.calculateDistance(p1, p2); }
  calculatePolylineLength(coords) { return this.featureRenderer.calculatePolylineLength(coords); }
  calculatePolygonArea(coords) { return this.featureRenderer.calculatePolygonArea(coords); }
  calculateBearing(p1, p2) { return this.featureRenderer.calculateBearing(p1, p2); }
  calculateSegments(coords, isClosed) { return this.featureRenderer.calculateSegments(coords, isClosed); }

  // --- Delegação do Editor de Vértices ---
  startVertexEditing(feature, onUpdated) { this.vertexEditor.startEditing(feature, onUpdated); }
  stopVertexEditing() { this.vertexEditor.stopEditing(); }

  // --- Cursores Remotos ---
  updateRemoteCursor(user, latlng) {
    if (!latlng || isNaN(latlng[0]) || isNaN(latlng[1])) return;

    let cursor = this.remoteCursors.get(user.id);
    if (!cursor) {
      // Nome e cor chegam de outros operadores pela rede: nunca interpolar sem sanitizar
      const color = /^#[0-9a-fA-F]{3,8}$/.test(user.color || '') ? user.color : '#00E08A';
      const safeName = String(user.name || 'Colaborador')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      const icon = L.divIcon({
        className: 'cm-remote-cursor-container',
        html: `
          <div class="cm-remote-cursor">
            <svg class="cm-remote-cursor-icon" viewBox="0 0 24 24" fill="${color}">
              <path d="M4 0l16 12.279-6.951 1.17 4.325 8.817-3.596 1.734-4.35-8.879-5.428 5.439z"/>
            </svg>
            <span class="cm-remote-cursor-badge" style="background: ${color};">
              ${safeName}
            </span>
          </div>
        `
      });

      cursor = L.marker(latlng, { icon, interactive: false }).addTo(this.map);
      this.remoteCursors.set(user.id, cursor);
    } else {
      cursor.setLatLng(latlng);
    }
  }

  removeRemoteCursor(userId) {
    const cursor = this.remoteCursors.get(userId);
    if (!cursor) return;
    if (this.map && this.map.hasLayer(cursor)) {
      this.map.removeLayer(cursor);
    }
    this.remoteCursors.delete(userId);
  }

  /**
   * Ciclo de Vida: Destrói completamente o MapEngine, liberando listeners de janela,
   * cancelando animações pendentes (RAFs), limpando memória e removendo a instância do Leaflet.
   */
  destroy() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    // 1. Desvincula listeners globais da janela
    if (this._onKeyDown) {
      window.removeEventListener('keydown', this._onKeyDown);
      this._onKeyDown = null;
    }

    // 2. Cancela animações e RAFs pendentes
    if (this._mouseMoveRafId) {
      cancelAnimationFrame(this._mouseMoveRafId);
      this._mouseMoveRafId = null;
    }

    // 3. Destrói sub-motores especializados
    if (this.drawingEngine && typeof this.drawingEngine.destroy === 'function') {
      this.drawingEngine.destroy();
      this.drawingEngine = null;
    }

    if (this.vertexEditor && typeof this.vertexEditor.destroy === 'function') {
      this.vertexEditor.destroy();
      this.vertexEditor = null;
    }

    if (this.featureRenderer && typeof this.featureRenderer.destroy === 'function') {
      this.featureRenderer.destroy();
      this.featureRenderer = null;
    }

    // 4. Limpa cursores remotos colaborativos
    this.remoteCursors.forEach(marker => {
      if (this.map && this.map.hasLayer(marker)) {
        this.map.removeLayer(marker);
      }
    });
    this.remoteCursors.clear();

    // 5. Limpa feature layers e camadas adicionadas
    this.featureLayers.forEach(group => {
      group.clearLayers();
      if (this.map && this.map.hasLayer(group)) {
        this.map.removeLayer(group);
      }
    });
    this.featureLayers.clear();
    this.renderedFeatures.clear();

    // 6. Limpa camadas base
    if (this.currentBaseLayer && this.map) {
      this.map.removeLayer(this.currentBaseLayer);
      this.currentBaseLayer = null;
    }
    this.baseLayers = {};

    // 7. Limpa índice espacial
    if (this.spatialIndex) {
      this.spatialIndex.clear();
      this.spatialIndex = null;
    }

    // 8. Remove o mapa Leaflet e desanexa listeners do container
    if (this.map) {
      this.map.off();
      this.map.remove();
      this.map = null;
    }
  }
}
