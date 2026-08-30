/* ==========================================================================
   ConecteMapas - MapEngine (Core Facade & Orchestrator)
   Motor Cartográfico com Leaflet, Aceleração Gráfica por Canvas, Ferramentas CAD
   ========================================================================== */

import L from 'leaflet';
import { DrawingEngine } from './MapEngine/DrawingEngine.js';
import { VertexEditor } from './MapEngine/VertexEditor.js';
import { FeatureRenderer } from './MapEngine/FeatureRenderer.js';

export class MapEngine {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.options = {
      center: options.center || [-15.7942, -47.8822],
      zoom: options.zoom || 14,
      ...options
    };

    this.map = null;
    this.baseLayers = {};
    this.currentBaseLayer = null;
    this.featureLayers = new Map();
    this.renderedFeatures = new Map();
    this.remoteCursors = new Map();

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
      google_satelite: L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        maxNativeZoom: 20,
        maxZoom: 22,
        attribution: '© Google Maps'
      }),
      satelite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxNativeZoom: 18,
        maxZoom: 22,
        attribution: 'Esri Satellite'
      }),
      osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxNativeZoom: 19,
        maxZoom: 22,
        attribution: '© OpenStreetMap'
      }),
      topografia: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxNativeZoom: 17,
        maxZoom: 22,
        attribution: 'OpenTopoMap'
      }),
      dark: L.layerGroup([
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
          maxNativeZoom: 16,
          maxZoom: 22,
          attribution: 'Esri Dark Gray'
        }),
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
          maxNativeZoom: 16,
          maxZoom: 22
        })
      ])
    };

    this.setBaseLayer('google_satelite');
  }

  setBaseLayer(name) {
    if (this.currentBaseLayer) {
      this.map.removeLayer(this.currentBaseLayer);
    }
    const target = this.baseLayers[name] || this.baseLayers.google_satelite;
    target.addTo(this.map);
    this.currentBaseLayer = target;
  }

  bindEvents() {
    this.map.on('mousemove', (e) => {
      this.onCursorMove(e.latlng);
      this.drawingEngine.handleMouseMove(e);
    });

    this.map.on('click', (e) => {
      this.drawingEngine.handleClick(e);
    });

    this.map.on('dblclick', () => {
      this.drawingEngine.handleDoubleClick();
    });

    window.addEventListener('keydown', (e) => {
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
      
      if (this.drawingEngine.activeTool !== 'select') {
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
    });
  }

  // --- Delegação de Ferramentas CAD ---
  get activeTool() { return this.drawingEngine.activeTool; }
  setTool(tool) { this.drawingEngine.setTool(tool); }
  resetDrawingState() { this.drawingEngine.resetDrawingState(); }
  finalizeCurrentDrawing() { return this.drawingEngine.finalizeCurrentDrawing(); }
  undoLastVertex() { return this.drawingEngine.undoLastVertex(); }

  // --- Delegação de Renderização & Estilos ---
  renderFeatures(features, layers) { this.featureRenderer.renderFeatures(features, layers); }
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
}
