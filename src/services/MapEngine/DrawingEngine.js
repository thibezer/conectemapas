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
    this.vertexMarkers = L.layerGroup().addTo(this.map);
    this.lastCircleRadius = null;
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
      this.renderVertexHandles();

      if (this.drawingPoints.length === 0) {
        if (this.tempLayer) {
          this.map.removeLayer(this.tempLayer);
          this.tempLayer = null;
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
      this.drawingPoints.push(latlng);
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

    const currentLatLng = [e.latlng.lat, e.latlng.lng];
    const previewPoints = [...this.drawingPoints, currentLatLng];

    if (this.activeTool === 'line' || this.activeTool === 'measure') {
      if (this.tempLayer) this.tempLayer.setLatLngs(previewPoints);
      if (this.activeTool === 'measure') {
        this.updateMeasureTooltip(e.latlng, previewPoints);
      }
    } else if (this.activeTool === 'polygon') {
      if (this.tempLayer) this.tempLayer.setLatLngs(previewPoints);
    } else if (this.activeTool === 'circle') {
      const center = this.drawingPoints[0];
      const radius = this.engine.calculateDistance(center, currentLatLng);
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

  updateMeasureTooltip(latlng, points = null) {
    const pts = points || this.drawingPoints;
    const distanceMeters = this.engine.calculatePolylineLength(pts);
    const distText = distanceMeters > 1000 
      ? `${(distanceMeters / 1000).toFixed(2)} km`
      : `${distanceMeters.toFixed(1)} m`;

    const html = `<div style="background: rgba(0,0,0,0.85); color: #ffb86c; font-family: monospace; font-size: 11px; padding: 4px 8px; border-radius: 4px; border: 1px solid #ffb86c;">📏 Distância: ${distText}</div>`;

    if (!this.measureTooltip) {
      this.measureTooltip = L.popup({
        closeButton: false,
        offset: [0, -10],
        className: 'cm-measure-popup'
      })
      .setLatLng(latlng)
      .setContent(html)
      .openOn(this.map);
    } else {
      this.measureTooltip.setLatLng(latlng).setContent(html);
    }
  }
}
