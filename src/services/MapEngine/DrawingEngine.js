/* ==========================================================================
   ConecteMapas - DrawingEngine
   Responsabilidade Única: Máquina de estados CAD e ferramentas de vetorização.
   Decomposição Modular (SRP / SOLID):
   - DrawingMeasureHelper: Cotas, segmentos e tooltips de medição
   - DrawingSnappingHelper: Atração magnética e HUD de desenho
   - DrawingPenSelectHelper: Seleção espacial por lasso poligonal
   - DrawingShapeFinalizer: Conversão de buffers CAD em feições definitivas
   - DrawingClickHandler: Roteamento de cliques interativos do mapa
   - DrawingPenHelper: Matemática da Caneta (retas + curvas Bézier)
   ========================================================================== */

import L from 'leaflet';
import { DrawingMeasureHelper } from './DrawingMeasureHelper.js';
import { DrawingSnappingHelper } from './DrawingSnappingHelper.js';
import { DrawingShapeFinalizer } from './DrawingShapeFinalizer.js';
import { DrawingClickHandler } from './DrawingClickHandler.js';
import { ShapeGeometryGenerator } from './ShapeGeometryGenerator.js';
import { DrawingPenHelper } from './DrawingPenHelper.js';

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

    // Caneta: âncoras { p, hIn, hOut } espelhadas em drawingPoints (mesmo índice)
    this.penAnchors = [];
    this.penClosed = false;
    this._penDrag = null;

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
    this.penAnchors = [];
    this.penClosed = false;
    this._penDrag = null;

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
      const isFirst = index === 0 && (this.activeTool === 'polygon' || this.activeTool === 'pen-select' || (this.activeTool === 'pen' && this.drawingPoints.length >= 3));
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
            if (this.activeTool === 'pen') this.penClosed = true;
            this.finalizeCurrentDrawing();
          }
        });
      }

      this.vertexMarkers.addLayer(marker);
    });

    if (this.activeTool === 'pen') this._renderPenHandles();
  }

  // ------------------------------------------------------------------------
  // Caneta (retas + curvas): clique = âncora reta, clique e arraste = âncora curva
  // ------------------------------------------------------------------------

  /**
   * Erro máximo aceito ao achatar curvas: ~1/2 pixel na tela atual (entre 15 cm e 5 m).
   * Em zoom alto a curva é fina; em zoom baixo evita milhares de vértices desnecessários.
   */
  getPenTolerance() {
    const zoom = this.map.getZoom();
    const lat = this.map.getCenter().lat;
    const metersPerPixel = (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (256 * Math.pow(2, zoom));
    return Math.min(5, Math.max(0.15, metersPerPixel / 2));
  }

  /** Caminho achatado das âncoras atuais (+ segmento elástico até o cursor, se houver). */
  _penPreviewPath(cursor = null) {
    const anchors = cursor
      ? [...this.penAnchors, { p: cursor, hIn: null, hOut: null }]
      : this.penAnchors;
    return DrawingPenHelper.flattenPath(anchors, false, { tolerance: this.getPenTolerance() });
  }

  _updatePenPreview(cursor = null) {
    if (this.penAnchors.length === 0) return;
    const path = this._penPreviewPath(cursor);
    const activeStyles = this.engine.activeDrawingStyles || {};
    if (!this.tempLayer) {
      this.tempLayer = L.polyline(path, {
        color: activeStyles.strokeColor || '#ffffff',
        weight: 3,
        dashArray: '4, 4'
      }).addTo(this.map);
    } else {
      this.tempLayer.setLatLngs(path);
    }
  }

  /** Alças da última âncora (visíveis enquanto desenha, como na caneta do Illustrator). */
  _renderPenHandles() {
    const a = this.penAnchors[this.penAnchors.length - 1];
    if (!a || (!a.hIn && !a.hOut)) return;
    [a.hIn, a.hOut].forEach((h) => {
      if (!h) return;
      this.vertexMarkers.addLayer(L.polyline([a.p, h], { color: '#00E08A', weight: 1.5, interactive: false }));
      this.vertexMarkers.addLayer(L.circleMarker(h, {
        radius: 3.5, color: '#00E08A', fillColor: '#141417', fillOpacity: 1, weight: 2, interactive: false
      }));
    });
  }

  /** mousedown: cria âncora (reta por padrão; vira curva se o botão for arrastado) ou fecha no 1º ponto. */
  penPointerDown(e) {
    const latlng = this._activeSnapLatLng || [e.latlng.lat, e.latlng.lng];

    if (this.penAnchors.length >= 3) {
      const first = this.map.latLngToContainerPoint(this.penAnchors[0].p);
      const here = this.map.latLngToContainerPoint(latlng);
      if (Math.hypot(first.x - here.x, first.y - here.y) <= 10) {
        this.penClosed = true;
        this.engine._suppressNextClick = true;
        this.finalizeCurrentDrawing();
        return;
      }
    }

    this.penAnchors.push({ p: latlng, hIn: null, hOut: null });
    this.drawingPoints.push(latlng);
    this._previewPoints = [...this.drawingPoints, latlng];
    this._penDrag = { index: this.penAnchors.length - 1 };
    this.renderVertexHandles();
    this._updatePenPreview();
    this.updateDrawingHUD();
  }

  /** Arraste após o mousedown: define a alça de saída e espelha a de entrada. */
  penDragMove(latlng) {
    if (!this._penDrag) return false;
    const anchor = this.penAnchors[this._penDrag.index];
    if (!anchor) return false;
    const target = Array.isArray(latlng) ? latlng : [latlng.lat, latlng.lng];

    const a = this.map.latLngToContainerPoint(anchor.p);
    const t = this.map.latLngToContainerPoint(target);
    if (Math.hypot(a.x - t.x, a.y - t.y) < 4) {
      anchor.hOut = null;
      anchor.hIn = null;
    } else {
      anchor.hOut = target;
      anchor.hIn = DrawingPenHelper.mirror(anchor.p, target);
    }
    this.renderVertexHandles();
    this._updatePenPreview();
    return true;
  }

  penPointerUp(latlng = null) {
    if (!this._penDrag) return;
    if (latlng) this.penDragMove(latlng);
    this._penDrag = null;
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
      if (this.activeTool === 'pen') this.penAnchors.length = this.drawingPoints.length;
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
          this.tempLayer.setLatLngs(this.activeTool === 'pen' ? this._penPreviewPath() : this.drawingPoints);
        }
      }
      this.updateDrawingHUD();
      return true;
    }
    return false;
  }

  findNearbyVertex(mouseLatLng, maxPixelDistance = DrawingSnappingHelper.SNAP_PIXELS) {
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
    if (this.activeTool === 'pen' && this._penDrag) {
      this.penDragMove(e.latlng);
      return;
    }

    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    if (this._lastMoveLatLng) {
      if (Math.abs(this._lastMoveLatLng.lat - lat) < 1e-6 && Math.abs(this._lastMoveLatLng.lng - lng) < 1e-6) {
        return;
      }
    }
    this._lastMoveLatLng = { lat, lng };

    const snapped = this.findNearbyVertex(e.latlng);
    if (snapped) {
      this._activeSnapLatLng = snapped;
      if (!this.snapMarker) {
        this.snapMarker = L.circleMarker(snapped, {
          radius: 7,
          color: '#00E08A',
          fillColor: '#00E08A',
          fillOpacity: 0.45,
          weight: 2.5,
          dashArray: '3, 2',
          interactive: false,
          pane: 'markerPane'
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

    const activeStyles = this.engine.activeDrawingStyles || {};
    const strokeColor = activeStyles.strokeColor || '#ffffff';
    const fillColor = activeStyles.fillColor || this.activeDrawingLayer?.color || '#00E08A';
    const fillOpacity = activeStyles.fillOpacity !== undefined ? activeStyles.fillOpacity : 0.35;
    const strokeWidth = activeStyles.strokeWidth !== undefined ? activeStyles.strokeWidth : 2.5;

    if (this.activeTool === 'pen') {
      this._updatePenPreview(currentLatLng);
    } else if (this.activeTool === 'line' || this.activeTool === 'pen-select' || this.activeTool === 'polygon' || this.activeTool === 'split') {
      if (this.tempLayer) this.tempLayer.setLatLngs(this._previewPoints);
    } else if (this.activeTool === 'rectangle') {
      const p1 = this.drawingPoints[0];
      const p2 = currentLatLng;
      const minLat = Math.min(p1[0], p2[0]);
      const maxLat = Math.max(p1[0], p2[0]);
      const minLng = Math.min(p1[1], p2[1]);
      const maxLng = Math.max(p1[1], p2[1]);
      const rectCoords = [
        [maxLat, minLng],
        [maxLat, maxLng],
        [minLat, maxLng],
        [minLat, minLng]
      ];
      if (!this.tempLayer) {
        this.tempLayer = L.polygon(rectCoords, {
          color: strokeColor,
          fillColor: fillColor,
          fillOpacity,
          weight: strokeWidth,
          dashArray: '4, 4'
        }).addTo(this.map);
      } else {
        this.tempLayer.setLatLngs(rectCoords);
      }
    } else if (this.activeTool === 'ellipse') {
      const coords = ShapeGeometryGenerator.generateEllipse(this.drawingPoints[0], currentLatLng);
      if (!this.tempLayer) {
        this.tempLayer = L.polygon(coords, {
          color: strokeColor,
          fillColor: fillColor,
          fillOpacity,
          weight: strokeWidth,
          dashArray: '4, 4'
        }).addTo(this.map);
      } else {
        this.tempLayer.setLatLngs(coords);
      }
    } else if (this.activeTool === 'regular-polygon') {
      const coords = ShapeGeometryGenerator.generateRegularPolygon(this.drawingPoints[0], currentLatLng, 6);
      if (!this.tempLayer) {
        this.tempLayer = L.polygon(coords, {
          color: strokeColor,
          fillColor: fillColor,
          fillOpacity,
          weight: strokeWidth,
          dashArray: '4, 4'
        }).addTo(this.map);
      } else {
        this.tempLayer.setLatLngs(coords);
      }
    } else if (this.activeTool === 'star') {
      const coords = ShapeGeometryGenerator.generateStar(this.drawingPoints[0], currentLatLng, 5);
      if (!this.tempLayer) {
        this.tempLayer = L.polygon(coords, {
          color: strokeColor,
          fillColor: fillColor,
          fillOpacity,
          weight: strokeWidth,
          dashArray: '4, 4'
        }).addTo(this.map);
      } else {
        this.tempLayer.setLatLngs(coords);
      }
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
        this.tempLayer = L.circle(center, {
          radius,
          color: strokeColor,
          fillColor: fillColor,
          fillOpacity,
          weight: strokeWidth,
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
    if (this.activeTool === 'pen') this.penAnchors.length = this.drawingPoints.length;
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
