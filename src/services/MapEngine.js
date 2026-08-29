/* ==========================================================================
   ConecteMapas - MapEngine
   Motor Cartográfico Avançado com Leaflet, Cálculos Geodésicos e Desenho
   ========================================================================== */

import L from 'leaflet';

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
    this.featureLayers = new Map(); // layerId -> L.FeatureGroup
    this.renderedFeatures = new Map(); // featureId -> L.Layer
    this.remoteCursors = new Map(); // userId -> L.Marker (custom cursor)

    // Estado do desenho
    this.activeTool = 'select'; // 'select' | 'point' | 'line' | 'polygon' | 'circle' | 'measure'
    this.drawingPoints = [];
    this.tempLayer = null;
    this.measureTooltip = null;

    // Callbacks
    this.onFeatureCreated = options.onFeatureCreated || (() => {});
    this.onFeatureSelected = options.onFeatureSelected || (() => {});
    this.onCursorMove = options.onCursorMove || (() => {});

    this.initMap();
  }

  initMap() {
    this.map = L.map(this.containerId, {
      center: this.options.center,
      zoom: this.options.zoom,
      maxZoom: 22,
      doubleClickZoom: false, // Desabilita zoom no duplo clique para permitir finalização limpa de polígonos e linhas
      zoomControl: false,
      attributionControl: false
    });

    // Reposiciona controles de zoom
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(this.map);

    this.vertexMarkers = L.layerGroup().addTo(this.map);
    this.initBaseLayers();
    this.bindEvents();
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
      this.handleDrawingMouseMove(e);
    });

    this.map.on('click', (e) => {
      this.handleDrawingClick(e);
    });

    this.map.on('dblclick', (e) => {
      this.handleDrawingDoubleClick(e);
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
      
      if (this.activeTool !== 'select') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.finalizeCurrentDrawing();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.resetDrawingState();
          this.setTool('select');
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
          e.preventDefault();
          this.undoLastVertex();
        }
      }
    });
  }

  setTool(tool) {
    this.activeTool = tool;
    this.resetDrawingState();

    const container = document.getElementById(this.containerId);
    if (container) {
      if (tool === 'select') {
        container.style.cursor = '';
      } else {
        container.style.cursor = 'crosshair';
      }
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
      this.activeTool = 'select';
      const container = document.getElementById(this.containerId);
      if (container) container.style.cursor = '';
      this.updateDrawingHUD();

      this.onFeatureCreated({
        type: 'LineString',
        coordinates: coords
      });
      return true;
    } else if (this.activeTool === 'polygon' && this.drawingPoints.length >= 3) {
      const coords = [...this.drawingPoints];
      this.resetDrawingState();
      this.activeTool = 'select';
      const container = document.getElementById(this.containerId);
      if (container) container.style.cursor = '';
      this.updateDrawingHUD();

      this.onFeatureCreated({
        type: 'Polygon',
        coordinates: coords
      });
      return true;
    } else if (this.activeTool === 'circle' && this.drawingPoints.length >= 1 && this.lastCircleRadius) {
      const center = this.drawingPoints[0];
      const radius = Math.round(this.lastCircleRadius);
      this.resetDrawingState();
      this.activeTool = 'select';
      const container = document.getElementById(this.containerId);
      if (container) container.style.cursor = '';
      this.updateDrawingHUD();

      this.onFeatureCreated({
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

  handleDrawingClick(e) {
    const latlng = [e.latlng.lat, e.latlng.lng];

    if (this.activeTool === 'point') {
      this.onFeatureCreated({
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
        const radius = this.calculateDistance(center, latlng);
        this.onFeatureCreated({
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

  handleDrawingMouseMove(e) {
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
      const radius = this.calculateDistance(center, currentLatLng);
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

  handleDrawingDoubleClick(e) {
    // Remove ponto duplicado criado pelo duplo clique rápido
    if (this.drawingPoints.length > 1) {
      const last = this.drawingPoints[this.drawingPoints.length - 1];
      const prev = this.drawingPoints[this.drawingPoints.length - 2];
      if (this.calculateDistance(last, prev) < 3) {
        this.drawingPoints.pop();
      }
    }
    this.finalizeCurrentDrawing();
  }

  updateMeasureTooltip(latlng, points = null) {
    const pts = points || this.drawingPoints;
    const distanceMeters = this.calculatePolylineLength(pts);
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

  /**
   * Renderiza e sincroniza a lista de feições no mapa
   */
  renderFeatures(features, layers) {
    // Remove camadas antigas
    this.featureLayers.forEach(layerGroup => this.map.removeLayer(layerGroup));
    this.featureLayers.clear();
    this.renderedFeatures.clear();

    const layerMap = new Map(layers.map(l => [l.id, l]));

    // Cria grupos para cada camada
    layers.forEach(layer => {
      const group = L.featureGroup();
      if (layer.visible !== false) {
        group.addTo(this.map);
      }
      this.featureLayers.set(layer.id, group);
    });

    // Renderiza cada feição
    features.forEach(feat => {
      const layerConfig = layerMap.get(feat.layerId) || { color: '#00E08A', opacity: 1, visible: true };
      const defaultColor = feat.color || layerConfig.color || '#00E08A';
      
      // Estilo Paramétrico Unificado (Retrocompatível com fallback)
      const style = {
        fillColor: feat.style?.fillColor || defaultColor,
        fillOpacity: feat.style?.fillOpacity !== undefined ? Number(feat.style.fillOpacity) : (layerConfig.opacity !== undefined ? 0.35 * layerConfig.opacity : 0.35),
        strokeColor: feat.style?.strokeColor || defaultColor,
        strokeWidth: feat.style?.strokeWidth !== undefined ? Number(feat.style.strokeWidth) : 2.5,
        strokeDashArray: feat.style?.strokeDashArray || null,
        markerIcon: feat.style?.markerIcon || 'pin',
        markerSize: feat.style?.markerSize !== undefined ? Number(feat.style.markerSize) : 24,
        markerRotation: feat.style?.markerRotation !== undefined ? Number(feat.style.markerRotation) : 0,
        showLabel: feat.style?.showLabel === true,
        labelField: feat.style?.labelField || 'name'
      };

      let leafLayer = null;

      // Normalização robusta de coordenadas (suporta tanto [lat, lng] quanto {lat, lng} serializados)
      let coords = feat.coordinates;
      if (feat.type === 'Point') {
        if (coords && coords.lat !== undefined) {
          coords = [coords.lat, coords.lng];
        }
      } else if (feat.type === 'Polygon' || feat.type === 'LineString') {
        if (Array.isArray(coords)) {
          coords = coords.map(pt => (pt && pt.lat !== undefined) ? [pt.lat, pt.lng] : pt);
        }
      } else if (feat.type === 'Circle') {
        if (coords && coords.lat !== undefined) {
          coords = [coords.lat, coords.lng];
        }
      }

      if (feat.type === 'Point' && coords) {
        const iconHtml = this.getMarkerSVG(
          style.markerIcon,
          style.fillColor,
          style.markerSize,
          style.markerRotation
        );

        const icon = L.divIcon({
          className: 'cm-custom-marker-icon',
          html: iconHtml,
          iconSize: [style.markerSize, style.markerSize],
          iconAnchor: [style.markerSize / 2, style.markerSize / 2]
        });

        leafLayer = L.marker(coords, { icon });
      } else if (feat.type === 'LineString' && coords && coords.length >= 2) {
        leafLayer = L.polyline(coords, {
          color: style.strokeColor,
          weight: style.strokeWidth,
          dashArray: style.strokeDashArray || undefined,
          opacity: 1
        });
      } else if (feat.type === 'Polygon' && coords && coords.length >= 3) {
        leafLayer = L.polygon(coords, {
          color: style.strokeColor,
          weight: style.strokeWidth,
          dashArray: style.strokeDashArray || undefined,
          fillColor: style.fillColor,
          fillOpacity: style.fillOpacity,
          opacity: 1
        });
      } else if (feat.type === 'Circle' && coords) {
        leafLayer = L.circle(coords, {
          radius: feat.radius || 500,
          color: style.strokeColor,
          weight: style.strokeWidth,
          dashArray: style.strokeDashArray || undefined,
          fillColor: style.fillColor,
          fillOpacity: style.fillOpacity,
          opacity: 1
        });
      }

      if (leafLayer) {
        // Vincula Rótulo Dinâmico no Mapa se habilitado
        if (style.showLabel) {
          let labelText = feat.name || 'Feição';
          if (style.labelField === 'category') {
            labelText = feat.category || feat.type;
          } else if (style.labelField === 'area' && feat.type === 'Polygon') {
            const a = this.calculatePolygonArea(coords);
            labelText = `${(a / 10000).toFixed(2)} ha`;
          } else if (style.labelField === 'extensao' && feat.type === 'LineString') {
            const l = this.calculatePolylineLength(coords);
            labelText = l > 1000 ? `${(l / 1000).toFixed(2)} km` : `${l.toFixed(0)} m`;
          }

          leafLayer.bindTooltip(
            `<span class="cm-map-feature-label">${this.escapeHtml(labelText)}</span>`,
            {
              permanent: true,
              direction: 'center',
              className: 'cm-map-label-tooltip',
              interactive: false
            }
          );
        }

        // Vincula Popup Customizado
        const popupHtml = this.createFeaturePopupHtml({ ...feat, coordinates: coords });
        leafLayer.bindPopup(popupHtml, { maxWidth: 280 });

        leafLayer.on('click', () => {
          this.onFeatureSelected(feat);
        });

        const targetGroup = this.featureLayers.get(feat.layerId);
        if (targetGroup) {
          targetGroup.addLayer(leafLayer);
        } else {
          leafLayer.addTo(this.map);
        }

        this.renderedFeatures.set(feat.id, leafLayer);
      }
    });
  }

  getMarkerSVG(iconName, color, size = 24, rotation = 0) {
    let glyph = '';
    if (iconName === 'tower') {
      glyph = `<path d="M12 2L6 22h12L12 2zM9 14h6M8 18h8M12 2v20" stroke="#ffffff" stroke-width="1.6" fill="none"/>`;
    } else if (iconName === 'tree') {
      glyph = `<path d="M12 2L5 12h4l-3 6h12l-3-6h4L12 2z" fill="#ffffff" fill-opacity="0.95"/><path d="M12 18v4" stroke="#ffffff" stroke-width="2"/>`;
    } else if (iconName === 'warning') {
      glyph = `<path d="M12 3L2 20h20L12 3z" stroke="#ffffff" stroke-width="1.8" fill="#ffffff" fill-opacity="0.25"/><path d="M12 9v5M12 17h.01" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>`;
    } else if (iconName === 'water') {
      glyph = `<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" fill="#ffffff" fill-opacity="0.9"/>`;
    } else if (iconName === 'boundary') {
      glyph = `<rect x="5" y="5" width="14" height="14" rx="2" stroke="#ffffff" stroke-width="2" fill="none"/><circle cx="12" cy="12" r="3" fill="#ffffff"/>`;
    } else {
      // Padrão 'pin'
      glyph = `<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#ffffff" fill-opacity="0.95"/><circle cx="12" cy="9" r="2.5" fill="${color}"/>`;
    }

    const half = size / 2;
    return `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        border: 2px solid #ffffff;
        border-radius: 50%;
        transform: rotate(${rotation}deg);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 0 12px ${color}99, 0 3px 8px rgba(0,0,0,0.6);
        cursor: pointer;
      ">
        <svg viewBox="0 0 24 24" style="width: ${Math.round(size * 0.65)}px; height: ${Math.round(size * 0.65)}px;" fill="none">
          ${glyph}
        </svg>
      </div>
    `;
  }

  escapeHtml(str) {
    if (typeof str !== 'string') return str == null ? '' : String(str);
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  createFeaturePopupHtml(feat) {
    let dimensionInfo = '';
    if (feat.type === 'LineString') {
      const len = this.calculatePolylineLength(feat.coordinates);
      dimensionInfo = `<div>Extensão: <strong>${len > 1000 ? (len/1000).toFixed(2) + ' km' : len.toFixed(1) + ' m'}</strong></div>`;
    } else if (feat.type === 'Polygon') {
      const area = this.calculatePolygonArea(feat.coordinates);
      const ha = (area / 10000).toFixed(2);
      dimensionInfo = `<div>Área: <strong>${ha} ha</strong> (${area.toFixed(0)} m²)</div>`;
    } else if (feat.type === 'Circle') {
      dimensionInfo = `<div>Raio: <strong>${feat.radius} m</strong></div>`;
    } else if (feat.type === 'Point') {
      dimensionInfo = `<div>Coordenadas: <strong>${feat.coordinates[0].toFixed(5)}, ${feat.coordinates[1].toFixed(5)}</strong></div>`;
    }

    const safeName = this.escapeHtml(feat.name || 'Sem nome');
    const safeCategory = this.escapeHtml(feat.category || feat.type || 'Geral');
    const safeDesc = feat.description ? this.escapeHtml(feat.description) : '';
    const safeAuthor = this.escapeHtml(feat.createdBy || 'Sistema');
    const safeColor = this.escapeHtml(feat.color || '#00E08A');

    return `
      <div class="cm-popup-card">
        <div class="cm-popup-header">
          <span class="cm-popup-title">${safeName}</span>
          <span style="font-size: 10px; background: ${safeColor}22; color: ${safeColor}; padding: 2px 6px; border-radius: 4px; font-weight: 600;">
            ${safeCategory}
          </span>
        </div>
        ${safeDesc ? `<div class="cm-popup-desc">${safeDesc}</div>` : ''}
        <div class="cm-popup-stats">
          ${dimensionInfo}
          <div>Autor: <strong>${safeAuthor}</strong></div>
        </div>
      </div>
    `;
  }

  zoomToFeature(featureId) {
    const layer = this.renderedFeatures.get(featureId);
    if (!layer) return;

    if (layer.getBounds) {
      this.map.fitBounds(layer.getBounds(), { padding: [60, 60], maxZoom: 17 });
    } else if (layer.getLatLng) {
      this.map.flyTo(layer.getLatLng(), 17, { duration: 1 });
    }

    layer.openPopup();
  }

  fitAllFeatures() {
    const allLayers = [];
    this.renderedFeatures.forEach(layer => allLayers.push(layer));
    if (allLayers.length > 0) {
      const group = L.featureGroup(allLayers);
      this.map.fitBounds(group.getBounds(), { padding: [50, 50], maxZoom: 18 });
    }
  }

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

  // --------------------------------------------------------------------------
  // Cálculos Geodésicos
  // --------------------------------------------------------------------------
  calculateDistance(p1, p2) {
    const R = 6371000; // Raio da Terra em metros
    const dLat = (p2[0] - p1[0]) * Math.PI / 180;
    const dLon = (p2[1] - p1[1]) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  calculatePolylineLength(coordinates) {
    let total = 0;
    for (let i = 0; i < coordinates.length - 1; i++) {
      total += this.calculateDistance(coordinates[i], coordinates[i+1]);
    }
    return total;
  }

  calculatePolygonArea(coords) {
    if (coords.length < 3) return 0;
    const R = 6378137;
    let total = 0;
    const len = coords.length;

    for (let i = 0; i < len; i++) {
      const lower = coords[i];
      const middle = coords[(i + 1) % len];
      const upper = coords[(i + 2) % len];

      const x1 = (middle[1] - lower[1]) * (Math.PI / 180);
      const y1 = (middle[0] - lower[0]) * (Math.PI / 180);
      const x2 = (upper[1] - middle[1]) * (Math.PI / 180);
      const y2 = (upper[0] - middle[0]) * (Math.PI / 180);

      total += (x1 * y2 - y1 * x2);
    }

    const area = Math.abs(total * (R * R) / 2);
    return isNaN(area) ? 0 : area;
  }
}
