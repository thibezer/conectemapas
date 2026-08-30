/* ==========================================================================
   ConecteMapas - FeatureRenderer
   Responsabilidade Única: Renderização de camadas vetoriais, estilos paramétricos,
   popups, rótulos e zoom/enquadramento de geometrias no Leaflet.
   ========================================================================== */

import L from 'leaflet';

export class FeatureRenderer {
  constructor(mapEngine) {
    this.engine = mapEngine;
    this.map = mapEngine.map;
  }

  renderFeatures(features, layers) {
    const layerMap = new Map(layers.map(l => [l.id, l]));

    // 1. Reconciliação dos L.featureGroup das camadas
    const currentLayerIds = new Set(layers.map(l => l.id));
    this.engine.featureLayers.forEach((group, layerId) => {
      if (!currentLayerIds.has(layerId)) {
        this.map.removeLayer(group);
        this.engine.featureLayers.delete(layerId);
      }
    });

    layers.forEach(layer => {
      let group = this.engine.featureLayers.get(layer.id);
      if (!group) {
        group = L.featureGroup();
        if (layer.visible !== false) {
          group.addTo(this.map);
        }
        this.engine.featureLayers.set(layer.id, group);
      } else {
        const isCurrentlyOnMap = this.map.hasLayer(group);
        if (layer.visible !== false && !isCurrentlyOnMap) {
          group.addTo(this.map);
        } else if (layer.visible === false && isCurrentlyOnMap) {
          this.map.removeLayer(group);
        }
      }
    });

    // 2. Remoção cirúrgica de feições excluídas ou invisíveis
    const activeFeatMap = new Map();
    features.forEach(f => {
      if (f.visible !== false) activeFeatMap.set(f.id, f);
    });

    this.engine.renderedFeatures.forEach((layerWrapper, featId) => {
      if (!activeFeatMap.has(featId)) {
        this.removeSingleFeature(featId);
      }
    });

    // 3. Renderização / Patching de cada feição ativa
    features.forEach(feat => {
      this.renderSingleFeature(feat, layers);
    });

    // 4. Ordenação Z-Index das camadas
    const reversedLayers = [...layers].reverse();
    reversedLayers.forEach(layer => {
      const group = this.engine.featureLayers.get(layer.id);
      if (group && layer.visible !== false && this.map.hasLayer(group)) {
        group.bringToFront();
      }
    });
  }

  renderSingleFeature(feat, layers) {
    if (!feat) return null;
    if (feat.visible === false) {
      this.removeSingleFeature(feat.id);
      return null;
    }

    const layerMap = Array.isArray(layers) ? new Map(layers.map(l => [l.id, l])) : null;
    const layerConfig = (layerMap ? layerMap.get(feat.layerId) : null) || { color: '#00E08A', opacity: 1, visible: true };
    if (layerConfig.visible === false) {
      this.removeSingleFeature(feat.id);
      return null;
    }

    const defaultColor = feat.color || layerConfig.color || '#00E08A';
    const layerOpacity = layerConfig.opacity !== undefined ? Number(layerConfig.opacity) : 1;
    
    const rawFillOpacity = feat.style?.fillOpacity !== undefined ? Number(feat.style.fillOpacity) : 0.35;
    const combinedFillOpacity = Math.max(0, Math.min(1, rawFillOpacity * layerOpacity));
    const strokeOpacity = layerOpacity;

    const style = {
      fillColor: feat.style?.fillColor || defaultColor,
      fillOpacity: combinedFillOpacity,
      strokeColor: feat.style?.strokeColor || defaultColor,
      strokeWidth: feat.style?.strokeWidth !== undefined ? Number(feat.style.strokeWidth) : 2.5,
      strokeDashArray: feat.style?.strokeDashArray || null,
      markerIcon: feat.style?.markerIcon || 'pin',
      markerSize: feat.style?.markerSize !== undefined ? Number(feat.style.markerSize) : 24,
      markerRotation: feat.style?.markerRotation !== undefined ? Number(feat.style.markerRotation) : 0,
      showLabel: feat.style?.showLabel === true,
      labelField: feat.style?.labelField || 'name',
      layerOpacity: layerOpacity
    };

    const coords = this.normalizeCoordinates(feat);
    let existingLayer = this.engine.renderedFeatures.get(feat.id);

    // Se o tipo mudou, recria
    if (existingLayer && existingLayer._cmType !== feat.type) {
      const oldGroup = this.engine.featureLayers.get(existingLayer._cmLayerId);
      if (oldGroup) oldGroup.removeLayer(existingLayer);
      else this.map.removeLayer(existingLayer);
      existingLayer = null;
    }

    if (!existingLayer) {
      // --- MOUNT: Cria nova camada Leaflet ---
      existingLayer = this.createLeafletLayer(feat, coords, style);
      if (existingLayer) {
        existingLayer._cmType = feat.type;
        existingLayer._cmLayerId = feat.layerId;

        existingLayer.on('click', () => {
          this.engine.onFeatureSelected(feat);
        });

        let targetGroup = this.engine.featureLayers.get(feat.layerId);
        if (!targetGroup) {
          targetGroup = L.featureGroup();
          if (layerConfig.visible !== false) targetGroup.addTo(this.map);
          this.engine.featureLayers.set(feat.layerId, targetGroup);
        }
        targetGroup.addLayer(existingLayer);
        this.engine.renderedFeatures.set(feat.id, existingLayer);
      }
    } else {
      // --- PATCH: Atualiza in-place sem destruir a camada ---
      this.patchLeafletLayer(existingLayer, feat, coords, style);
    }

    // Atualiza popup e labels
    if (existingLayer) {
      this.updatePopupAndTooltip(existingLayer, feat, coords, style);
    }

    return existingLayer;
  }

  removeSingleFeature(featId) {
    const layer = this.engine.renderedFeatures.get(featId);
    if (layer) {
      const targetGroup = this.engine.featureLayers.get(layer._cmLayerId);
      if (targetGroup && targetGroup.hasLayer(layer)) {
        targetGroup.removeLayer(layer);
      } else if (this.map.hasLayer(layer)) {
        this.map.removeLayer(layer);
      }
      this.engine.renderedFeatures.delete(featId);
    }
  }

  normalizeCoordinates(feat) {
    let coords = feat.coordinates;
    if (feat.type === 'Point' && coords && coords.lat !== undefined) {
      return [coords.lat, coords.lng];
    } else if ((feat.type === 'Polygon' || feat.type === 'LineString') && Array.isArray(coords)) {
      if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
        return coords.map(ring => ring.map(pt => (pt && pt.lat !== undefined) ? [pt.lat, pt.lng] : pt));
      } else {
        return coords.map(pt => (pt && pt.lat !== undefined) ? [pt.lat, pt.lng] : pt);
      }
    } else if (feat.type === 'Circle' && coords && coords.lat !== undefined) {
      return [coords.lat, coords.lng];
    }
    return coords;
  }

  createLeafletLayer(feat, coords, style) {
    if (feat.type === 'Point' && coords) {
      const iconHtml = this.getMarkerSVG(style.markerIcon, style.fillColor, style.markerSize, style.markerRotation);
      const icon = L.divIcon({
        className: 'cm-custom-marker-icon',
        html: iconHtml,
        iconSize: [style.markerSize, style.markerSize],
        iconAnchor: [style.markerSize / 2, style.markerSize / 2]
      });
      return L.marker(coords, { icon, opacity: style.layerOpacity });
    } else if (feat.type === 'LineString' && coords && coords.length > 0) {
      return L.polyline(coords, {
        color: style.strokeColor,
        weight: style.strokeWidth,
        dashArray: style.strokeDashArray || undefined,
        opacity: style.layerOpacity
      });
    } else if (feat.type === 'Polygon' && coords && coords.length > 0) {
      return L.polygon(coords, {
        color: style.strokeColor,
        weight: style.strokeWidth,
        dashArray: style.strokeDashArray || undefined,
        fillColor: style.fillColor,
        fillOpacity: style.fillOpacity,
        opacity: style.layerOpacity
      });
    } else if (feat.type === 'Circle' && coords) {
      return L.circle(coords, {
        radius: feat.radius || 500,
        color: style.strokeColor,
        weight: style.strokeWidth,
        dashArray: style.strokeDashArray || undefined,
        fillColor: style.fillColor,
        fillOpacity: style.fillOpacity,
        opacity: style.layerOpacity
      });
    }
    return null;
  }

  patchLeafletLayer(layer, feat, coords, style) {
    // Migração de grupo se mudou de camada
    if (layer._cmLayerId !== feat.layerId) {
      const oldGroup = this.engine.featureLayers.get(layer._cmLayerId);
      if (oldGroup && oldGroup.hasLayer(layer)) {
        oldGroup.removeLayer(layer);
      }
      const newGroup = this.engine.featureLayers.get(feat.layerId);
      if (newGroup) {
        newGroup.addLayer(layer);
      }
      layer._cmLayerId = feat.layerId;
    }

    if (feat.type === 'Point' && coords) {
      layer.setLatLng(coords);
      layer.setOpacity(style.layerOpacity);
      const iconHtml = this.getMarkerSVG(style.markerIcon, style.fillColor, style.markerSize, style.markerRotation);
      const icon = L.divIcon({
        className: 'cm-custom-marker-icon',
        html: iconHtml,
        iconSize: [style.markerSize, style.markerSize],
        iconAnchor: [style.markerSize / 2, style.markerSize / 2]
      });
      layer.setIcon(icon);
    } else if (feat.type === 'LineString' && coords) {
      layer.setLatLngs(coords);
      layer.setStyle({
        color: style.strokeColor,
        weight: style.strokeWidth,
        dashArray: style.strokeDashArray || undefined,
        opacity: style.layerOpacity
      });
    } else if (feat.type === 'Polygon' && coords) {
      layer.setLatLngs(coords);
      layer.setStyle({
        color: style.strokeColor,
        weight: style.strokeWidth,
        dashArray: style.strokeDashArray || undefined,
        fillColor: style.fillColor,
        fillOpacity: style.fillOpacity,
        opacity: style.layerOpacity
      });
    } else if (feat.type === 'Circle' && coords) {
      layer.setLatLng(coords);
      if (feat.radius && layer.setRadius) {
        layer.setRadius(feat.radius);
      }
      layer.setStyle({
        color: style.strokeColor,
        weight: style.strokeWidth,
        dashArray: style.strokeDashArray || undefined,
        fillColor: style.fillColor,
        fillOpacity: style.fillOpacity,
        opacity: style.layerOpacity
      });
    }
  }

  updatePopupAndTooltip(leafLayer, feat, coords, style) {
    // Popup
    const popupHtml = this.createFeaturePopupHtml({ ...feat, coordinates: coords });
    if (leafLayer.getPopup()) {
      leafLayer.setPopupContent(popupHtml);
    } else {
      leafLayer.bindPopup(popupHtml, { maxWidth: 280 });
    }

    // Tooltip
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

      const tooltipContent = `<span class="cm-map-feature-label">${this.escapeHtml(labelText)}</span>`;
      if (leafLayer.getTooltip()) {
        leafLayer.setTooltipContent(tooltipContent);
      } else {
        leafLayer.bindTooltip(tooltipContent, { permanent: true, direction: 'center', className: 'cm-map-label-tooltip', interactive: false });
      }
    } else {
      if (leafLayer.getTooltip()) {
        leafLayer.unbindTooltip();
      }
    }
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
      glyph = `<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#ffffff" fill-opacity="0.95"/><circle cx="12" cy="9" r="2.5" fill="${color}"/>`;
    }

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
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
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
    const layer = this.engine.renderedFeatures.get(featureId);
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
    this.engine.renderedFeatures.forEach(layer => allLayers.push(layer));
    if (allLayers.length > 0) {
      const group = L.featureGroup(allLayers);
      this.map.fitBounds(group.getBounds(), { padding: [50, 50], maxZoom: 18 });
    }
  }

  fitLayer(layerId) {
    const group = this.engine.featureLayers.get(layerId);
    if (group && group.getLayers().length > 0) {
      this.map.fitBounds(group.getBounds(), { padding: [60, 60], maxZoom: 18 });
    }
  }

  calculateDistance(p1, p2) {
    const R = 6371000;
    const dLat = (p2[0] - p1[0]) * Math.PI / 180;
    const dLon = (p2[1] - p1[1]) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  calculatePolylineLength(coordinates) {
    if (!Array.isArray(coordinates) || coordinates.length === 0) return 0;
    if (Array.isArray(coordinates[0]) && Array.isArray(coordinates[0][0])) {
      return coordinates.reduce((sum, line) => sum + this.calculateSinglePolylineLength(line), 0);
    }
    return this.calculateSinglePolylineLength(coordinates);
  }

  calculateSinglePolylineLength(coordinates) {
    let total = 0;
    for (let i = 0; i < coordinates.length - 1; i++) {
      total += this.calculateDistance(coordinates[i], coordinates[i+1]);
    }
    return total;
  }

  calculatePolygonArea(coords) {
    if (!Array.isArray(coords) || coords.length === 0) return 0;
    if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
      return coords.reduce((sum, ring) => sum + this.calculateSinglePolygonArea(ring), 0);
    }
    return this.calculateSinglePolygonArea(coords);
  }

  calculateSinglePolygonArea(coords) {
    if (!Array.isArray(coords) || coords.length < 3) return 0;
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

  calculateBearing(p1, p2) {
    if (!p1 || !p2) return 0;
    const lat1 = p1[0] * Math.PI / 180;
    const lat2 = p2[0] * Math.PI / 180;
    const dLon = (p2[1] - p1[1]) * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  calculateSegments(coordinates, isClosed = false) {
    if (!Array.isArray(coordinates) || coordinates.length < 2) return [];
    const segments = [];
    const count = isClosed ? coordinates.length : coordinates.length - 1;
    for (let i = 0; i < count; i++) {
      const p1 = coordinates[i];
      const p2 = coordinates[(i + 1) % coordinates.length];
      if (!p1 || !p2) continue;
      segments.push({
        from: i + 1,
        to: (i + 1) % coordinates.length === 0 ? 1 : i + 2,
        distance: this.calculateDistance(p1, p2),
        azimuth: this.calculateBearing(p1, p2)
      });
    }
    return segments;
  }
}
