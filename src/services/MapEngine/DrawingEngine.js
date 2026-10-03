/* ==========================================================================
   ConecteMapas - DrawingEngine
   Responsabilidade Única: Máquina de estados CAD e ferramentas de vetorização.
   Decomposição Modular (SRP / SOLID):
   - DrawingMeasureHelper: Cotas, segmentos e tooltips de medição
   - DrawingSnappingHelper: Atração magnética e HUD de desenho
   - DrawingPenSelectHelper: Seleção espacial por lasso poligonal
   - DrawingShapeFinalizer: Conversão de buffers CAD em feições definitivas
   - DrawingClickHandler: Roteamento de cliques interativos do mapa
   ========================================================================== */

import L from 'leaflet';
import { DrawingMeasureHelper } from './DrawingMeasureHelper.js';
import { DrawingSnappingHelper } from './DrawingSnappingHelper.js';
import { DrawingShapeFinalizer } from './DrawingShapeFinalizer.js';
import { DrawingClickHandler } from './DrawingClickHandler.js';

export class DrawingEngine {
  constructor(mapEngine) {
    this.engine = mapEngine;
    this.map = mapEngine.map;
    this.activeTool = 'select';
    this.drawingPoints = [];
    this.tempLayer = null;
    this.measureTooltip = null;
    this._measureTextEl = null;
    this.vertexMarkers = L.layerGroup().addTo(this.map);
    this.snapMarker = null;
    this.lastCircleRadius = null;

    this._previewPoints = [];
    this._lastMoveLatLng = null;
    this._cumulativeMeasureDistance = 0;
    this._activeSnapLatLng = null;
    this.activeDrawingLayer = null;

    this.measureSegmentsLayer = L.layerGroup().addTo(this.map);
    this.measurePolygonLayer = null;
  }

  setActiveDrawingLayer(layer) {
    this.activeDrawingLayer = layer;
  }

  setTool(tool) {
    this.activeTool = tool;
    this.resetDrawingState();

    const container = document.getElementById(this.engine.containerId);
    if (container) {
      container.style.cursor = tool === 'select' ? '' : 'crosshair';
    }

    if (this.engine && typeof this.engine.notifyToolChange === 'function') {
      this.engine.notifyToolChange(tool);
    }
  }

  resetDrawingState() {
    this.drawingPoints = [];
    this._previewPoints = [];
    this._lastMoveLatLng = null;
    this._cumulativeMeasureDistance = 0;
    this.lastCircleRadius = null;
    this._activeSnapLatLng = null;

    if (this.tempLayer) {
      this.map.removeLayer(this.tempLayer);
      this.tempLayer = null;
    }
    if (this.vertexMarkers) {
      this.vertexMarkers.clearLayers();
    }
    if (this.snapMarker) {
      this.map.removeLayer(this.snapMarker);
      this.snapMarker = null;
    }
    if (this.measureTooltip) {
      this.map.removeLayer(this.measureTooltip);
      this.measureTooltip = null;
      this._measureTextEl = null;
    }
    if (this.measureSegmentsLayer) {
      this.measureSegmentsLayer.clearLayers();
    }
    if (this.measurePolygonLayer) {
      this.map.removeLayer(this.measurePolygonLayer);
      this.measurePolygonLayer = null;
    }
    this.updateDrawingHUD();
  }

  renderVertexHandles() {
    if (!this.vertexMarkers) return;
    this.vertexMarkers.clearLayers();
    if (this.measureSegmentsLayer) {
      this.measureSegmentsLayer.clearLayers();
    }

    if (this.activeTool === 'measure') {
      this.measurePolygonLayer = DrawingMeasureHelper.renderMeasureHandles(
        this.drawingPoints,
        this.vertexMarkers,
        this.measureSegmentsLayer,
        this.measurePolygonLayer,
        this.map,
        this.engine
      );
      return;
    }

    this.drawingPoints.forEach((pt, index) => {
      const isFirst = index === 0 && (this.activeTool === 'polygon' || this.activeTool === 'pen-select');
      const marker = L.circleMarker(pt, {
        radius: isFirst ? 6 : 4.5,
        color: isFirst ? '#00E08A' : '#ffffff',
        fillColor: isFirst ? '#00E08A' : '#141417',
        fillOpacity: 1,
        weight: isFirst ? 3 : 2
      });

      if (isFirst) {
        marker.bindTooltip('Clique para fechar forma', { direction: 'top', offset: [0, -6] });
        marker.on('click', (e) => {
          if (e) {
            L.DomEvent.stop(e);
            if (e.originalEvent) {
              e.originalEvent._cmFeatureClicked = true;
              e.originalEvent.stopPropagation();
              e.originalEvent.preventDefault();
            }
          }
          if (this.drawingPoints.length >= 3) {
            this.finalizeCurrentDrawing();
          }
        });
      }

      this.vertexMarkers.addLayer(marker);
    });
  }

  updateDrawingHUD() {
    DrawingSnappingHelper.updateDrawingHUD(
      this.activeTool,
      this.drawingPoints,
      this._cumulativeMeasureDistance,
      this.engine,
      () => this.finalizeCurrentDrawing(),
      () => {
        this.resetDrawingState();
        this.setTool('select');
      }
    );
  }

  finalizeCurrentDrawing() {
    return DrawingShapeFinalizer.finalize(this);
  }

  undoLastVertex() {
    if (this.drawingPoints.length > 0) {
      this.drawingPoints.pop();
      if (this.activeTool === 'measure') {
        this._cumulativeMeasureDistance = this.engine.calculatePolylineLength(this.drawingPoints);
      }
      this._previewPoints = [...this.drawingPoints];
      this.renderVertexHandles();

      if (this.drawingPoints.length === 0) {
        if (this.tempLayer) {
          this.map.removeLayer(this.tempLayer);
          this.tempLayer = null;
        }
        if (this.measureTooltip) {
          this.map.removeLayer(this.measureTooltip);
          this.measureTooltip = null;
          this._measureTextEl = null;
        }
      } else {
        if (this.tempLayer) {
          this.tempLayer.setLatLngs(this.drawingPoints);
        }
      }
      this.updateDrawingHUD();
      return true;
    }
    return false;
  }

  findNearbyVertex(mouseLatLng, maxPixelDistance = 14) {
    return DrawingSnappingHelper.findNearbyVertex(
      this.map,
      mouseLatLng,
      this.activeTool,
      this.drawingPoints,
      this.engine,
      maxPixelDistance
    );
  }

  handleClick(e) {
    DrawingClickHandler.handleClick(this, e);
  }

  handleMouseMove(e) {
    if (this.activeTool === 'select') return;

    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    if (this._lastMoveLatLng) {
      if (Math.abs(this._lastMoveLatLng.lat - lat) < 1e-6 && Math.abs(this._lastMoveLatLng.lng - lng) < 1e-6) {
        return;
      }
    }
    this._lastMoveLatLng = { lat, lng };

    const snapped = this.findNearbyVertex(e.latlng, 14);
    if (snapped) {
      this._activeSnapLatLng = snapped;
      if (!this.snapMarker) {
        this.snapMarker = L.circleMarker(snapped, {
          radius: 7,
          color: '#00E08A',
          fillColor: 'transparent',
          weight: 2.5,
          dashArray: '3, 3',
          interactive: false
        }).addTo(this.map);
      } else {
        this.snapMarker.setLatLng(snapped);
      }
    } else {
      this._activeSnapLatLng = null;
      if (this.snapMarker) {
        this.map.removeLayer(this.snapMarker);
        this.snapMarker = null;
      }
    }

    if (this.drawingPoints.length === 0 || this.activeTool === 'point') return;

    const currentLatLng = this._activeSnapLatLng || [lat, lng];

    if (this._previewPoints.length !== this.drawingPoints.length + 1) {
      this._previewPoints = [...this.drawingPoints, currentLatLng];
    } else {
      this._previewPoints[this._previewPoints.length - 1] = currentLatLng;
    }

    if (this.activeTool === 'line' || this.activeTool === 'pen-select' || this.activeTool === 'polygon') {
      if (this.tempLayer) this.tempLayer.setLatLngs(this._previewPoints);
    } else if (this.activeTool === 'measure') {
      if (this.tempLayer) this.tempLayer.setLatLngs(this._previewPoints);
      this.updateMeasureTooltip(e.latlng, currentLatLng);
    } else if (this.activeTool === 'circle') {
      const center = this.drawingPoints[0];
      const radius = this.engine.calculateDistance(center, currentLatLng);
      if (this.lastCircleRadius !== null && Math.abs(this.lastCircleRadius - radius) < 0.2) {
        return;
      }
      this.lastCircleRadius = radius;
      if (!this.tempLayer) {
        const circleColor = this.activeDrawingLayer?.color || '#8b5cf6';
        this.tempLayer = L.circle(center, {
          radius,
          color: circleColor,
          fillColor: circleColor,
          fillOpacity: 0.25,
          weight: 2,
          dashArray: '4, 4'
        }).addTo(this.map);
      } else {
        this.tempLayer.setRadius(radius);
      }
    }
  }

  handleDoubleClick() {
    if (this.drawingPoints.length > 1) {
      const last = this.drawingPoints[this.drawingPoints.length - 1];
      const prev = this.drawingPoints[this.drawingPoints.length - 2];
      if (this.map) {
        const pLast = this.map.latLngToContainerPoint(last);
        const pPrev = this.map.latLngToContainerPoint(prev);
        if (Math.hypot(pLast.x - pPrev.x, pLast.y - pPrev.y) < 16) {
          this.drawingPoints.pop();
        }
      } else if (this.engine.calculateDistance(last, prev) < 2) {
        this.drawingPoints.pop();
      }
    }
    this.finalizeCurrentDrawing();
  }

  updateMeasureTooltip(latlng, currentLatLng = null) {
    this.measureTooltip = DrawingMeasureHelper.updateMeasureTooltip(
      this.map,
      this.measureTooltip,
      latlng,
      this.drawingPoints,
      currentLatLng,
      this._cumulativeMeasureDistance,
      this.engine
    );
  }

  destroy() {
    this.resetDrawingState();
    if (this.vertexMarkers) {
      this.vertexMarkers.clearLayers();
      if (this.map && this.map.hasLayer(this.vertexMarkers)) {
        this.map.removeLayer(this.vertexMarkers);
      }
      this.vertexMarkers = null;
    }
    if (this.measureSegmentsLayer) {
      this.measureSegmentsLayer.clearLayers();
      if (this.map && this.map.hasLayer(this.measureSegmentsLayer)) {
        this.map.removeLayer(this.measureSegmentsLayer);
      }
      this.measureSegmentsLayer = null;
    }
    if (this.measurePolygonLayer) {
      if (this.map && this.map.hasLayer(this.measurePolygonLayer)) {
        this.map.removeLayer(this.measurePolygonLayer);
      }
      this.measurePolygonLayer = null;
    }
    const hud = document.getElementById('cm-cad-hud');
    if (hud) hud.remove();
    this.map = null;
    this.engine = null;
  }
}
