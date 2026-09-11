/* ==========================================================================
   ConecteMapas - MapEngine (Core Facade & Orchestrator)
   Motor Cartográfico com Leaflet, Aceleração Gráfica por Canvas, Ferramentas CAD
   ========================================================================== */

import L from 'leaflet';
import { DrawingEngine } from './MapEngine/DrawingEngine.js';
import { VertexEditor } from './MapEngine/VertexEditor.js';
import { FeatureRenderer } from './MapEngine/FeatureRenderer.js';
import { SpatialIndex } from './SpatialIndex.js';

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
    this.onFeatureSelected = options.onFeatureSelected || (() => {});
    this.onFeaturesSelected = options.onFeaturesSelected || (() => {});
    this.onCursorMove = options.onCursorMove || (() => {});
    this.onToolChange = options.onToolChange || (() => {});
    this.onContextMenu = options.onContextMenu || (() => {});

    this.selectedFeatureId = null;
    this.selectedFeatureIds = new Set();

    this.initMap();
    this.drawingEngine = new DrawingEngine(this);
    this.vertexEditor = new VertexEditor(this);
    this.featureRenderer = new FeatureRenderer(this);
    this.bindEvents();
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

        if (!this._isBoxSelecting && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
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

          const matchedFeatures = this.findFeaturesInBounds(boxBounds);
          this.handleBoxSelectionResult(matchedFeatures, this._boxSelectModifiers);

          this._selectionBoxEl.remove();
          this._selectionBoxEl = null;
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
        // Se clicou em área vazia do mapa (não em uma feição e não foi drag de seleção)
        if (!e.originalEvent || !e.originalEvent._cmFeatureClicked) {
          this.clearSelection();
          if (this.onFeaturesSelected) {
            this.onFeaturesSelected([]);
          } else if (this.onFeatureSelected) {
            this.onFeatureSelected(null);
          }
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
      const feature = e.originalEvent?._cmFeatureRightClicked || null;
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
    return this.featureRenderer.updateFeature(feat, layers || this.featureRenderer.allLayers);
  }
  removeFeature(featId) {
    this.spatialIndex.remove(featId);
    this.featureRenderer.removeFeature(featId);
  }

  findFeaturesInBounds(bounds) {
    if (!bounds || !this.featureRenderer) return [];

    const validLayers = new Set(
      (this.featureRenderer.allLayers || [])
        .filter(l => l.visible !== false)
        .map(l => l.id)
    );

    const candidates = this.spatialIndex.query(bounds, 0) || [];
    const results = [];
    const seen = new Set();

    candidates.forEach(feat => {
      if (!feat || !feat.id || seen.has(feat.id)) return;
      if (feat.visible === false || !validLayers.has(feat.layerId)) return;

      if (this.spatialIndex.intersects(feat, bounds, 0)) {
        seen.add(feat.id);
        results.push(feat);
      }
    });

    return results;
  }

  handleBoxSelectionResult(matchedFeatures, { shift = false, ctrl = false } = {}) {
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
      this.featureRenderer.updateViewportCulling();
    }

    if (this.onFeaturesSelected) {
      const selectedList = this.featureRenderer.allFeatures.filter(f => this.selectedFeatureIds.has(f.id));
      this.onFeaturesSelected(selectedList);
    }
  }

  selectFeatures(featureIds = []) {
    this.selectedFeatureIds.clear();
    (featureIds || []).forEach(id => this.selectedFeatureIds.add(id));
    this.selectedFeatureId = featureIds.length === 1 ? featureIds[0] : null;
    if (this.featureRenderer) {
      this.featureRenderer.updateViewportCulling();
    }
    const selectedList = this.getSelectedFeatures();
    if (this.onFeaturesSelected) this.onFeaturesSelected(selectedList);
    if (this.onFeatureSelected) this.onFeatureSelected(selectedList[0] || null);
  }

  selectFeature(featureId) {
    this.selectedFeatureId = featureId;
    if (this.selectedFeatureIds) {
      this.selectedFeatureIds.clear();
      if (featureId) this.selectedFeatureIds.add(featureId);
    }
    if (this.featureRenderer) {
      this.featureRenderer.updateViewportCulling();
    }
    const selectedList = this.getSelectedFeatures();
    if (this.onFeaturesSelected) this.onFeaturesSelected(selectedList);
    if (this.onFeatureSelected) this.onFeatureSelected(selectedList[0] || null);
  }

  clearSelection() {
    this.selectedFeatureId = null;
    if (this.selectedFeatureIds) {
      this.selectedFeatureIds.clear();
    }
    if (this.featureRenderer) {
      this.featureRenderer.updateViewportCulling();
    }
    if (this.onFeaturesSelected) this.onFeaturesSelected([]);
    if (this.onFeatureSelected) this.onFeatureSelected(null);
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
      const raw = this.featureRenderer.normalizeCoordinates(f);
      if (f.type === 'Point' && raw) bounds.extend(raw);
      else if (Array.isArray(raw)) bounds.extend(raw.flat(2));
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
      const icon = L.divIcon({
        className: 'cm-remote-cursor-container',
        html: `
          <div class="cm-remote-cursor">
            <svg class="cm-remote-cursor-icon" viewBox="0 0 24 24" fill="${user.color || '#00E08A'}">
              <path d="M4 0l16 12.279-6.951 1.17 4.325 8.817-3.596 1.734-4.35-8.879-5.428 5.439z"/>
            </svg>
            <span class="cm-remote-cursor-badge" style="background: ${user.color || '#00E08A'};">
              ${user.name}
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
