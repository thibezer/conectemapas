/* ==========================================================================
   ConecteMapas - DrawingEngine
   Responsabilidade Única: Ferramentas CAD de desenho vetorial (Ponto, Linha,
   Polígono, Círculo, Medição), HUD dinâmico e buffers temporários.
   ========================================================================== */

import L from 'leaflet';

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
    this.lastCircleRadius = null;

    // Otimizações de mousemove & memória (Item 9)
    this._previewPoints = [];
    this._lastMoveLatLng = null;
    this._cumulativeMeasureDistance = 0;
  }

  setTool(tool) {
    this.activeTool = tool;
    this.resetDrawingState();

    const container = document.getElementById(this.engine.containerId);
    if (container) {
      container.style.cursor = tool === 'select' ? '' : 'crosshair';
    }
  }

  resetDrawingState() {
    this.drawingPoints = [];
    this._previewPoints = [];
    this._lastMoveLatLng = null;
    this._cumulativeMeasureDistance = 0;
    this.lastCircleRadius = null;

    if (this.tempLayer) {
      this.map.removeLayer(this.tempLayer);
      this.tempLayer = null;
    }
    if (this.vertexMarkers) {
      this.vertexMarkers.clearLayers();
    }
    if (this.measureTooltip) {
      this.map.removeLayer(this.measureTooltip);
      this.measureTooltip = null;
      this._measureTextEl = null;
    }
    this.updateDrawingHUD();
  }

  renderVertexHandles() {
    if (!this.vertexMarkers) return;
    this.vertexMarkers.clearLayers();

    this.drawingPoints.forEach((pt, index) => {
      const isFirst = index === 0 && this.activeTool === 'polygon';
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
          L.DomEvent.stopPropagation(e);
          if (this.drawingPoints.length >= 3) {
            this.finalizeCurrentDrawing();
          }
        });
      }

      this.vertexMarkers.addLayer(marker);
    });
  }

  updateDrawingHUD() {
    let hud = document.getElementById('cm-cad-hud');
    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'cm-cad-hud';
      hud.className = 'cm-cad-hud';
      document.body.appendChild(hud);
    }

    if (this.activeTool === 'select' || (this.drawingPoints.length === 0 && this.activeTool !== 'point')) {
      hud.style.display = 'none';
      return;
    }

    hud.style.display = 'flex';
    const count = this.drawingPoints.length;
    let toolName = 'Forma';
    let minPts = 2;
    if (this.activeTool === 'line') { toolName = 'Linha'; minPts = 2; }
    if (this.activeTool === 'polygon') { toolName = 'Polígono'; minPts = 3; }
    if (this.activeTool === 'circle') { toolName = 'Círculo'; minPts = 1; }
    if (this.activeTool === 'measure') { toolName = 'Medição'; minPts = 2; }

    const canFinish = count >= minPts;

    hud.innerHTML = `
      <span class="cm-cad-hud-pulse"></span>
      <span><strong>${toolName}:</strong> ${count} vértice(s) adicionado(s)</span>
      <span class="cm-cad-hud-hint">• Pressione <strong>[Enter]</strong> ou <strong>[Espaço]</strong> para concluir</span>
      <span class="cm-cad-hud-hint">• <strong>[Ctrl+Z]</strong> desfaz vértice</span>
      <span class="cm-cad-hud-hint">• <strong>[Esc]</strong> cancela</span>
      ${canFinish ? `<button id="btn-cad-finish" class="cm-cad-finish-btn">✔ Concluir Forma</button>` : ''}
    `;

    const finishBtn = hud.querySelector('#btn-cad-finish');
    if (finishBtn) {
      finishBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.finalizeCurrentDrawing();
      });
    }
  }

  finalizeCurrentDrawing() {
    if (this.activeTool === 'line' && this.drawingPoints.length >= 2) {
      const coords = [...this.drawingPoints];
      this.resetDrawingState();
      this.setTool('select');

      this.engine.onFeatureCreated({
        type: 'LineString',
        coordinates: coords
      });
      return true;
    } else if (this.activeTool === 'polygon' && this.drawingPoints.length >= 3) {
      const coords = [...this.drawingPoints];
      this.resetDrawingState();
      this.setTool('select');

      this.engine.onFeatureCreated({
        type: 'Polygon',
        coordinates: coords
      });
      return true;
    } else if (this.activeTool === 'circle' && this.drawingPoints.length >= 1 && this.lastCircleRadius) {
      const center = this.drawingPoints[0];
      const radius = Math.round(this.lastCircleRadius);
      this.resetDrawingState();
      this.setTool('select');

      this.engine.onFeatureCreated({
        type: 'Circle',
        coordinates: center,
        radius
      });
      return true;
    } else if (this.activeTool === 'measure' && this.drawingPoints.length >= 2) {
      this.resetDrawingState();
      this.setTool('select');
      return true;
    }
    return false;
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

  handleClick(e) {
    const latlng = [e.latlng.lat, e.latlng.lng];

    if (this.activeTool === 'point') {
      this.engine.onFeatureCreated({
        type: 'Point',
        coordinates: latlng
      });
      this.setTool('select');
    } else if (this.activeTool === 'line') {
      this.drawingPoints.push(latlng);
      this._previewPoints = [...this.drawingPoints, latlng];
      this.renderVertexHandles();
      if (!this.tempLayer) {
        this.tempLayer = L.polyline(this.drawingPoints, {
          color: '#00E08A',
          weight: 3,
          dashArray: '4, 4'
        }).addTo(this.map);
      } else {
        this.tempLayer.setLatLngs(this.drawingPoints);
      }
      this.updateDrawingHUD();
    } else if (this.activeTool === 'polygon') {
      this.drawingPoints.push(latlng);
      this._previewPoints = [...this.drawingPoints, latlng];
      this.renderVertexHandles();
      if (!this.tempLayer) {
        this.tempLayer = L.polygon(this.drawingPoints, {
          color: '#00E08A',
          fillColor: '#00E08A',
          fillOpacity: 0.35,
          weight: 2,
          dashArray: '4, 4'
        }).addTo(this.map);
      } else {
        this.tempLayer.setLatLngs(this.drawingPoints);
      }
      this.updateDrawingHUD();
    } else if (this.activeTool === 'circle') {
      if (this.drawingPoints.length === 0) {
        this.drawingPoints.push(latlng);
        this._previewPoints = [...this.drawingPoints, latlng];
        this.renderVertexHandles();
        this.updateDrawingHUD();
      } else {
        const center = this.drawingPoints[0];
        const radius = this.engine.calculateDistance(center, latlng);
        this.engine.onFeatureCreated({
          type: 'Circle',
          coordinates: center,
          radius: Math.round(radius)
        });
        this.resetDrawingState();
        this.setTool('select');
      }
    } else if (this.activeTool === 'measure') {
      if (this.drawingPoints.length > 0) {
        const prev = this.drawingPoints[this.drawingPoints.length - 1];
        this._cumulativeMeasureDistance += this.engine.calculateDistance(prev, latlng);
      } else {
        this._cumulativeMeasureDistance = 0;
      }
      this.drawingPoints.push(latlng);
      this._previewPoints = [...this.drawingPoints, latlng];
      this.renderVertexHandles();
      if (!this.tempLayer) {
        this.tempLayer = L.polyline(this.drawingPoints, {
          color: '#ffb86c',
          weight: 3
        }).addTo(this.map);
      } else {
        this.tempLayer.setLatLngs(this.drawingPoints);
      }
      this.updateMeasureTooltip(e.latlng);
      this.updateDrawingHUD();
    }
  }

  handleMouseMove(e) {
    if (this.drawingPoints.length === 0) return;
    if (this.activeTool === 'select' || this.activeTool === 'point') return;

    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    // Filtro de micro-movimento: evita disparar atualizações SVG para variações sub-pixel
    if (this._lastMoveLatLng) {
      if (Math.abs(this._lastMoveLatLng.lat - lat) < 1e-6 && Math.abs(this._lastMoveLatLng.lng - lng) < 1e-6) {
        return;
      }
    }
    this._lastMoveLatLng = { lat, lng };

    const currentLatLng = [lat, lng];

    // Reutilização do array de preview in-place sem alocação contínua de memória
    if (this._previewPoints.length !== this.drawingPoints.length + 1) {
      this._previewPoints = [...this.drawingPoints, currentLatLng];
    } else {
      this._previewPoints[this._previewPoints.length - 1] = currentLatLng;
    }

    if (this.activeTool === 'line') {
      if (this.tempLayer) this.tempLayer.setLatLngs(this._previewPoints);
    } else if (this.activeTool === 'polygon') {
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
        this.tempLayer = L.circle(center, {
          radius,
          color: '#8b5cf6',
          fillColor: '#8b5cf6',
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
      if (this.engine.calculateDistance(last, prev) < 3) {
        this.drawingPoints.pop();
      }
    }
    this.finalizeCurrentDrawing();
  }

  updateMeasureTooltip(latlng, currentLatLng = null) {
    let distanceMeters = 0;
    if (currentLatLng && this.drawingPoints.length > 0) {
      const lastFixedPoint = this.drawingPoints[this.drawingPoints.length - 1];
      distanceMeters = this._cumulativeMeasureDistance + this.engine.calculateDistance(lastFixedPoint, currentLatLng);
    } else {
      distanceMeters = this._cumulativeMeasureDistance || this.engine.calculatePolylineLength(this.drawingPoints);
    }

    const distText = distanceMeters > 1000 
      ? `${(distanceMeters / 1000).toFixed(2)} km`
      : `${distanceMeters.toFixed(1)} m`;

    if (!this.measureTooltip) {
      const container = document.createElement('div');
      container.className = 'cm-measure-tooltip-box';
      container.style.cssText = 'background: rgba(0,0,0,0.85); color: #ffb86c; font-family: monospace; font-size: 11px; padding: 4px 8px; border-radius: 4px; border: 1px solid #ffb86c; white-space: nowrap;';
      container.innerHTML = `📏 Distância: <span class="cm-measure-text">${distText}</span>`;
      this._measureTextEl = container.querySelector('.cm-measure-text');

      this.measureTooltip = L.popup({
        closeButton: false,
        offset: [0, -10],
        className: 'cm-measure-popup'
      })
      .setLatLng(latlng)
      .setContent(container)
      .openOn(this.map);
    } else {
      this.measureTooltip.setLatLng(latlng);
      if (this._measureTextEl) {
        this._measureTextEl.textContent = distText;
      }
    }
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
    const hud = document.getElementById('cm-cad-hud');
    if (hud) hud.remove();
    this.map = null;
    this.engine = null;
  }
}
