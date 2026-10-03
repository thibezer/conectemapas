/* ==========================================================================
   ConecteMapas - GeometryLayerBuilder
   Criação e atualização in-place (Patching) das instâncias gráficas Leaflet
   (Polygon, Polyline, Circle, CircleMarker, Marker e Text) e Leaflet Panes.
   ========================================================================== */

import L from 'leaflet';
import { FeaturePopupBuilder } from './FeaturePopupBuilder.js';
import { FeatureGeometryUtils } from './FeatureGeometryUtils.js';

export class GeometryLayerBuilder {
  static getSubPaneType(type) {
    if (type === 'Polygon' || type === 'Circle') return 'poly';
    if (type === 'LineString') return 'line';
    if (type === 'Point') return 'point';
    if (type === 'Text') return 'text';
    return 'poly';
  }

  static getOrCreateLayerPane(map, createdPaneNames, layerId, type = 'poly') {
    const subType = this.getSubPaneType(type);
    const paneName = `cm-pane-${layerId}-${subType}`;
    let pane = map ? map.getPane(paneName) : null;
    if (!pane && map) {
      pane = map.createPane(paneName);
      if (createdPaneNames) createdPaneNames.add(paneName);
    }
    return { paneName, pane };
  }

  static removeLayerPane(map, createdPaneNames, layerId) {
    const types = ['poly', 'line', 'point', 'text'];
    types.forEach(t => {
      const paneName = `cm-pane-${layerId}-${t}`;
      const pane = map ? map.getPane(paneName) : null;
      if (pane && pane.parentNode) {
        pane.parentNode.removeChild(pane);
      }
      if (createdPaneNames) createdPaneNames.delete(paneName);
    });
    const legacyName = `cm-layer-pane-${layerId}`;
    const legacyPane = map ? map.getPane(legacyName) : null;
    if (legacyPane && legacyPane.parentNode) {
      legacyPane.parentNode.removeChild(legacyPane);
    }
    if (createdPaneNames) createdPaneNames.delete(legacyName);
  }

  static updateLayerZIndexes(map, createdPaneNames, layers) {
    if (!map) return;
    const layerList = layers || [];
    const total = layerList.length;
    layerList.forEach((layer, index) => {
      // zIndex base: camadas do topo da árvore de camadas ficam com maior prioridade visual
      const baseZ = 410 + (total - 1 - index) * 10;
      
      const poly = this.getOrCreateLayerPane(map, createdPaneNames, layer.id, 'Polygon').pane;
      if (poly) poly.style.zIndex = String(baseZ);

      const line = this.getOrCreateLayerPane(map, createdPaneNames, layer.id, 'LineString').pane;
      if (line) line.style.zIndex = String(baseZ + 2);

      const point = this.getOrCreateLayerPane(map, createdPaneNames, layer.id, 'Point').pane;
      if (point) point.style.zIndex = String(baseZ + 4);

      const text = this.getOrCreateLayerPane(map, createdPaneNames, layer.id, 'Text').pane;
      if (text) text.style.zIndex = String(baseZ + 6);
    });
  }

  static createLeafletLayer(feat, coords, style, isSelected, paneName, onTextUpdated) {
    if (feat.type === 'Text' && coords) {
      const text = feat.properties?.text || feat.name || 'Texto';
      const fontSize = feat.style?.fontSize || 13;
      const textColor = feat.style?.textColor || '#ffffff';
      const bgColor = feat.style?.backgroundColor || 'rgba(15, 23, 42, 0.88)';
      const borderColor = isSelected ? '#38bdf8' : (feat.style?.borderColor || 'rgba(255, 255, 255, 0.25)');
      const haloClass = feat.style?.halo ? 'cm-map-text-halo' : '';

      const html = `<div class="cm-map-text-badge ${haloClass} ${isSelected ? 'cm-map-text-selected' : ''}" style="font-size: ${fontSize}px; color: ${textColor}; background: ${bgColor}; border-color: ${borderColor};">${FeatureGeometryUtils.escapeHtml(text)}</div>`;
      const icon = L.divIcon({
        className: 'cm-map-text-container',
        html,
        iconSize: null,
        iconAnchor: [0, 0]
      });

      const marker = L.marker(coords, {
        icon,
        draggable: true,
        pane: paneName
      });

      marker.on('dragend', (e) => {
        const newPos = e.target.getLatLng();
        feat.coordinates = [newPos.lat, newPos.lng];
        if (typeof onTextUpdated === 'function') {
          onTextUpdated(feat);
        }
      });

      return marker;
    } else if (feat.type === 'Point' && coords) {
      const isCustomSvgIcon = ['tower', 'tree', 'warning', 'water', 'boundary'].includes(style.markerIcon);
      if (!isCustomSvgIcon) {
        const radius = Math.max(5, Math.round((style.markerSize || 24) / 3.2));
        return L.circleMarker(coords, {
          radius,
          fillColor: style.fillColor,
          fillOpacity: style.fillOpacity !== undefined ? style.fillOpacity : 0.85,
          color: isSelected ? '#38bdf8' : '#ffffff',
          weight: isSelected ? 4 : 2,
          opacity: style.layerOpacity,
          pane: paneName
        });
      }

      const iconHtml = FeaturePopupBuilder.getMarkerSVG(style.markerIcon, style.fillColor, style.markerSize, style.markerRotation);
      const icon = L.divIcon({
        className: 'cm-custom-marker-icon',
        html: iconHtml,
        iconSize: [style.markerSize, style.markerSize],
        iconAnchor: [style.markerSize / 2, style.markerSize / 2]
      });
      return L.marker(coords, { icon, opacity: style.layerOpacity, pane: paneName });
    } else if (feat.type === 'LineString' && coords && coords.length > 0) {
      return L.polyline(coords, {
        color: style.strokeColor,
        weight: style.strokeWidth,
        dashArray: style.strokeDashArray || undefined,
        opacity: style.layerOpacity,
        pane: paneName
      });
    } else if (feat.type === 'Polygon' && coords && coords.length > 0) {
      return L.polygon(coords, {
        color: style.strokeColor,
        weight: style.strokeWidth,
        dashArray: style.strokeDashArray || undefined,
        fillColor: style.fillColor,
        fillOpacity: style.fillOpacity,
        opacity: style.layerOpacity,
        pane: paneName
      });
    } else if (feat.type === 'Circle' && coords) {
      return L.circle(coords, {
        radius: feat.radius || 500,
        color: style.strokeColor,
        weight: style.strokeWidth,
        dashArray: style.strokeDashArray || undefined,
        fillColor: style.fillColor,
        fillOpacity: style.fillOpacity,
        opacity: style.layerOpacity,
        pane: paneName
      });
    }
    return null;
  }

  static patchLeafletLayer(layer, feat, coords, style, isSelected = false) {
    if (feat.type === 'Text' && coords) {
      layer.setLatLng(coords);
      const text = feat.properties?.text || feat.name || 'Texto';
      const fontSize = feat.style?.fontSize || 13;
      const textColor = feat.style?.textColor || '#ffffff';
      const bgColor = feat.style?.backgroundColor || 'rgba(15, 23, 42, 0.88)';
      const borderColor = isSelected ? '#38bdf8' : (feat.style?.borderColor || 'rgba(255, 255, 255, 0.25)');
      const haloClass = feat.style?.halo ? 'cm-map-text-halo' : '';

      const html = `<div class="cm-map-text-badge ${haloClass} ${isSelected ? 'cm-map-text-selected' : ''}" style="font-size: ${fontSize}px; color: ${textColor}; background: ${bgColor}; border-color: ${borderColor};">${FeatureGeometryUtils.escapeHtml(text)}</div>`;
      const icon = L.divIcon({
        className: 'cm-map-text-container',
        html,
        iconSize: null,
        iconAnchor: [0, 0]
      });
      layer.setIcon(icon);
    } else if (feat.type === 'Point' && coords) {
      if (layer instanceof L.CircleMarker) {
        layer.setLatLng(coords);
        const radius = Math.max(5, Math.round((style.markerSize || 24) / 3.2));
        layer.setStyle({
          radius,
          fillColor: style.fillColor,
          fillOpacity: style.fillOpacity !== undefined ? style.fillOpacity : 0.85,
          color: isSelected ? '#38bdf8' : '#ffffff',
          weight: isSelected ? 4 : 2,
          opacity: style.layerOpacity
        });
      } else if (layer.setIcon) {
        layer.setLatLng(coords);
        layer.setOpacity(style.layerOpacity);
        const iconHtml = FeaturePopupBuilder.getMarkerSVG(style.markerIcon, style.fillColor, style.markerSize, style.markerRotation);
        const icon = L.divIcon({
          className: 'cm-custom-marker-icon',
          html: iconHtml,
          iconSize: [style.markerSize, style.markerSize],
          iconAnchor: [style.markerSize / 2, style.markerSize / 2]
        });
        layer.setIcon(icon);
      }
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

    if (layer._path) {
      layer._path.classList.toggle('cm-feature-selected', isSelected);
    }
    if (layer._icon) {
      layer._icon.classList.toggle('cm-feature-selected-marker', isSelected);
      layer._icon.classList.toggle('cm-marker-selected', isSelected);
    }
  }
}
