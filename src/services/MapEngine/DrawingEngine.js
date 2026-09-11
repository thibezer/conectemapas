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
    this.snapMarker = null;
    this.lastCircleRadius = null;

    // Otimizações de mousemove & memória (Item 9)
    this._previewPoints = [];
    this._lastMoveLatLng = null;
    this._cumulativeMeasureDistance = 0;
    this._activeSnapLatLng = null;
    this.activeDrawingLayer = null;
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
      <span class="cm-cad-hud-hint">• <strong>[Enter]</strong> ou <strong>[Espaço]</strong> conclui</span>
      <span class="cm-cad-hud-hint">• <strong>[Ctrl+Z]</strong> ou <strong>[Botão Direito]</strong> desfaz</span>
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
    const layerId = this.activeDrawingLayer ? this.activeDrawingLayer.id : undefined;
    const color = this.activeDrawingLayer ? this.activeDrawingLayer.color : undefined;

    if (this.activeTool === 'line' && this.drawingPoints.length >= 2) {
      const coords = [...this.drawingPoints];
      this.resetDrawingState();
      this.setTool('select');

      this.engine.onFeatureCreated({
        type: 'LineString',
        coordinates: coords,
        layerId,
        color
      });
      return true;
    } else if (this.activeTool === 'polygon' && this.drawingPoints.length >= 3) {
      const coords = [...this.drawingPoints];
      this.resetDrawingState();
      this.setTool('select');

      this.engine.onFeatureCreated({
        type: 'Polygon',
        coordinates: coords,
        layerId,
        color
      });
      return true;
    } else if (this.activeTool === 'circle' && this.drawingPoints.length >= 1 && this.lastCircleRadius && this.lastCircleRadius >= 2) {
      const center = this.drawingPoints[0];
      const radius = Math.round(this.lastCircleRadius);
      this.resetDrawingState();
      this.setTool('select');

      this.engine.onFeatureCreated({
        type: 'Circle',
        coordinates: center,
        radius,
        layerId,
        color
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

  findNearbyVertex(mouseLatLng, maxPixelDistance = 14) {
    if (!this.map || !mouseLatLng) return null;
    const mousePt = this.map.latLngToContainerPoint(mouseLatLng);

    // 1. Prioridade: Primeiro ponto do polígono em desenho (para fechamento fácil e perfeito)
    if (this.activeTool === 'polygon' && this.drawingPoints.length >= 3) {
      const firstPt = this.drawingPoints[0];
      const p1 = this.map.latLngToContainerPoint(firstPt);
      if (Math.hypot(mousePt.x - p1.x, mousePt.y - p1.y) <= maxPixelDistance) {
        return firstPt;
      }
    }

    // 2. Vértices de feições visíveis no viewport
    if (this.engine.featureRenderer && this.engine.featureRenderer.allFeatures) {
      const bounds = this.map.getBounds();
      const visibleFeatures = this.engine.spatialIndex 
        ? this.engine.spatialIndex.query(bounds, 0.05)
        : this.engine.featureRenderer.allFeatures;

      for (const feat of visibleFeatures) {
        if (!feat || feat.visible === false) continue;
        if (feat.type === 'Point' && feat.coordinates) {
          const pt = [feat.coordinates[0], feat.coordinates[1]];
          const p = this.map.latLngToContainerPoint(pt);
          if (Math.hypot(mousePt.x - p.x, mousePt.y - p.y) <= maxPixelDistance) {
            return pt;
          }
        } else if ((feat.type === 'LineString' || feat.type === 'Polygon') && Array.isArray(feat.coordinates)) {
          for (const vertex of feat.coordinates) {
            if (!vertex) continue;
            const pt = (vertex.lat !== undefined) ? [vertex.lat, vertex.lng] : vertex;
            const p = this.map.latLngToContainerPoint(pt);
            if (Math.hypot(mousePt.x - p.x, mousePt.y - p.y) <= maxPixelDistance) {
              return pt;
            }
          }
        }
      }
    }

    return null;
  }

  handleClick(e) {
    const rawLatLng = [e.latlng.lat, e.latlng.lng];
    const latlng = this._activeSnapLatLng || rawLatLng;
    const activeColor = this.activeDrawingLayer?.color || '#00E08A';
    const activeLayerId = this.activeDrawingLayer?.id;

    if (this.activeTool === 'point') {
      this.resetDrawingState();
      this.setTool('select');
      this.engine.onFeatureCreated({
        type: 'Point',
        coordinates: latlng,
        layerId: activeLayerId,
        color: activeColor
      });
    } else if (this.activeTool === 'line') {
      this.drawingPoints.push(latlng);
      this._previewPoints = [...this.drawingPoints, latlng];
      this.renderVertexHandles();
      if (!this.tempLayer) {
        this.tempLayer = L.polyline(this.drawingPoints, {
          color: activeColor,
          weight: 3,
          dashArray: '4, 4'
        }).addTo(this.map);
      } else {
        this.tempLayer.setLatLngs(this.drawingPoints);
      }
      this.updateDrawingHUD();
    } else if (this.activeTool === 'polygon') {
      // Se clicou no primeiro vértice para fechar com 3+ pontos
      if (this.drawingPoints.length >= 3 && this._activeSnapLatLng && 
          this._activeSnapLatLng[0] === this.drawingPoints[0][0] && 
          this._activeSnapLatLng[1] === this.drawingPoints[0][1]) {
        this.finalizeCurrentDrawing();
        return;
      }

      this.drawingPoints.push(latlng);
      this._previewPoints = [...this.drawingPoints, latlng];
      this.renderVertexHandles();
      if (!this.tempLayer) {
        this.tempLayer = L.polygon(this.drawingPoints, {
          color: activeColor,
          fillColor: activeColor,
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
        if (radius < 2) {
          return;
        }
        this.resetDrawingState();
        this.setTool('select');
        this.engine.onFeatureCreated({
          type: 'Circle',
          coordinates: center,
          radius: Math.round(radius),
          layerId: activeLayerId,
          color: activeColor
        });
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
    if (this.activeTool === 'select') return;

    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    // Filtro de micro-movimento: evita disparar atualizações SVG para variações sub-pixel
    if (this._lastMoveLatLng) {
      if (Math.abs(this._lastMoveLatLng.lat - lat) < 1e-6 && Math.abs(this._lastMoveLatLng.lng - lng) < 1e-6) {
        return;
      }
    }
    this._lastMoveLatLng = { lat, lng };

    // Snapping Magnético inteligente
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

    if (this.drawingPoints.length === 0) return;
    if (this.activeTool === 'point') return;

    const currentLatLng = this._activeSnapLatLng || [lat, lng];

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
        const distPx = Math.hypot(pLast.x - pPrev.x, pLast.y - pPrev.y);
        if (distPx < 16) {
          this.drawingPoints.pop();
        }
      } else if (this.engine.calculateDistance(last, prev) < 2) {
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
