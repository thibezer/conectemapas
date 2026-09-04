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
    this.onCursorMove = options.onCursorMove || (() => {});

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
      attributionControl: false
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

    this.map.on('mousemove', (e) => {
      latestMouseMoveEvent = e;

      if (!mouseMovePending) {
        mouseMovePending = true;
        this._mouseMoveRafId = requestAnimationFrame(() => {
          mouseMovePending = false;
          this._mouseMoveRafId = null;
          if (latestMouseMoveEvent) {
            this.onCursorMove(latestMouseMoveEvent.latlng);
            // Só aciona o DrawingEngine se houver uma ferramenta CAD desenhando ativamente
            if (this.drawingEngine && this.drawingEngine.drawingPoints.length > 0) {
              this.drawingEngine.handleMouseMove(latestMouseMoveEvent);
            }
          }
        });
      }
    });

    this.map.on('click', (e) => {
      if (this.drawingEngine) this.drawingEngine.handleClick(e);
    });

    this.map.on('dblclick', () => {
      if (this.drawingEngine) this.drawingEngine.handleDoubleClick();
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
          this.drawingEngine.setTool('select');
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
          e.preventDefault();
          this.drawingEngine.undoLastVertex();
        }
      }
    };

    window.addEventListener('keydown', this._onKeyDown);
  }

  // --- Delegação de Ferramentas CAD ---
  get activeTool() { return this.drawingEngine.activeTool; }
  setTool(tool) { this.drawingEngine.setTool(tool); }
  resetDrawingState() { this.drawingEngine.resetDrawingState(); }
  finalizeCurrentDrawing() { return this.drawingEngine.finalizeCurrentDrawing(); }
  undoLastVertex() { return this.drawingEngine.undoLastVertex(); }

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

  selectFeature(featureId) {
    this.selectedFeatureId = featureId;
    if (this.selectedFeatureIds) {
      this.selectedFeatureIds.clear();
      if (featureId) this.selectedFeatureIds.add(featureId);
    }
    if (this.featureRenderer) {
      this.featureRenderer.updateViewportCulling();
    }
  }

  clearSelection() {
    this.selectedFeatureId = null;
    if (this.selectedFeatureIds) {
      this.selectedFeatureIds.clear();
    }
    if (this.featureRenderer) {
      this.featureRenderer.updateViewportCulling();
    }
  }

  zoomToFeature(featureId) { this.featureRenderer.zoomToFeature(featureId); }
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
