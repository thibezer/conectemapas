/* ==========================================================================
   ConecteMapas - FeatureRenderer (Motor de Renderização Vetorial)
   Decomposição Modular (SRP / SOLID):
   - FeatureGeometryUtils: Cálculos espaciais, distâncias, áreas e normalização
   - FeaturePopupBuilder: Geração de popups informativos, labels e SVGs
   - GeometryLayerBuilder: Criação e patching de instâncias Leaflet e Panes
   - FeatureViewportController: Enquadramentos de câmera e seleção em lote
   - ViewportCullingManager: Culling espacial de viewport e clusters
   ========================================================================== */

import L from 'leaflet';
import { GeometrySimplifier } from '../GeometrySimplifier.js';
import { PointClusterEngine } from './PointClusterEngine.js';

import { FeatureGeometryUtils } from './FeatureGeometryUtils.js';
import { FeaturePopupBuilder } from './FeaturePopupBuilder.js';
import { GeometryLayerBuilder } from './GeometryLayerBuilder.js';
import { FeatureViewportController } from './FeatureViewportController.js';
import { ViewportCullingManager } from './ViewportCullingManager.js';

export class FeatureRenderer {
  constructor(mapEngine) {
    this.engine = mapEngine;
    this.map = mapEngine.map;
    this.allFeatures = [];
    this.allLayers = [];
    this.layerMap = new Map();
    this.cullingThreshold = 60;
    this._cullingRaf = null;

    this.clusterEngine = new PointClusterEngine({ gridSize: 55, maxClusterZoom: 17 });
    this.renderedClusters = new Map();
    this.featureMap = new Map();
    this._lastCullingZoom = null;

    this._clusterRevision = 0;
    this._lastClusterRevision = -1;
    this._lastClusterZoom = null;
    this._lastVisiblePointIds = null;
    this._cachedClusters = null;
    this._cachedSingles = null;

    this._createdPaneNames = new Set();
  }

  getOrCreateLayerPane(layerId) {
    return GeometryLayerBuilder.getOrCreateLayerPane(this.map, this._createdPaneNames, layerId);
  }

  removeLayerPane(layerId) {
    GeometryLayerBuilder.removeLayerPane(this.map, this._createdPaneNames, layerId);
  }

  updateLayerZIndexes(layers) {
    GeometryLayerBuilder.updateLayerZIndexes(this.map, this._createdPaneNames, layers || this.allLayers);
  }

  invalidateClusterCache() {
    this._clusterRevision++;
  }

  _syncLayerMap(layers) {
    this.allLayers = layers || [];
    this.layerMap = new Map(this.allLayers.map(l => [l.id, l]));
  }

  renderFeatures(features, layers, forceRebuildIndex = false) {
    this.allFeatures = features || [];
    this.featureMap = new Map(this.allFeatures.map(f => [f.id, f]));
    this._syncLayerMap(layers);

    if (forceRebuildIndex || this.engine.spatialIndex.size !== this.allFeatures.length) {
      this.engine.spatialIndex.build(this.allFeatures, true);
    }

    const currentLayerIds = new Set(this.allLayers.map(l => l.id));
    this.engine.featureLayers.forEach((group, layerId) => {
      if (!currentLayerIds.has(layerId)) {
        this.map.removeLayer(group);
        this.engine.featureLayers.delete(layerId);
        this.removeLayerPane(layerId);
      }
    });

    this.allLayers.forEach(layer => {
      const { paneName } = this.getOrCreateLayerPane(layer.id);
      let group = this.engine.featureLayers.get(layer.id);
      if (!group) {
        group = L.featureGroup([], { pane: paneName });
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

    const currentFeatureIds = new Set(this.allFeatures.map(f => f.id));
    this.engine.renderedFeatures.forEach((layer, featId) => {
      if (!currentFeatureIds.has(featId)) {
        this.removeSingleFeature(featId);
      }
    });
    this.clearAllClusters();

    this.updateViewportCulling();
    this.updateLayerZIndexes(this.allLayers);
  }

  setLayerVisibility(layerId, isVisible) {
    const layer = this.layerMap.get(layerId);
    if (layer) layer.visible = isVisible;

    const group = this.engine.featureLayers.get(layerId);
    if (group) {
      if (isVisible && !this.map.hasLayer(group)) {
        group.addTo(this.map);
      } else if (!isVisible && this.map.hasLayer(group)) {
        this.map.removeLayer(group);
      }
    }

    if (!isVisible) {
      this.engine.renderedFeatures.forEach((leafLayer, featId) => {
        if (leafLayer._cmLayerId === layerId) {
          this.removeSingleFeature(featId);
        }
      });
    }

    this.updateViewportCulling(true);
  }

  setLayerOpacity(layerId, opacity) {
    const layer = this.layerMap.get(layerId);
    if (layer) layer.opacity = opacity;

    const numOpacity = Number(opacity);
    const group = this.engine.featureLayers.get(layerId);
    if (!group) return;

    group.eachLayer(leafLayer => {
      if (typeof leafLayer.setOpacity === 'function') {
        leafLayer.setOpacity(numOpacity);
      }
      if (typeof leafLayer.setStyle === 'function') {
        const feat = leafLayer._cmFeature;
        const baseFillOpacity = feat?.style?.fillOpacity !== undefined ? Number(feat.style.fillOpacity) : 0.35;
        leafLayer.setStyle({
          opacity: numOpacity,
          fillOpacity: baseFillOpacity * numOpacity
        });
      }
    });
  }

  setLayerColor(layerId, color) {
    const layer = this.layerMap.get(layerId);
    if (layer) layer.color = color;

    const group = this.engine.featureLayers.get(layerId);
    if (group) {
      group.eachLayer(leafLayer => {
        if (typeof leafLayer.setStyle === 'function') {
          leafLayer.setStyle({ color, fillColor: color });
        } else if (leafLayer._cmType === 'Point' && typeof leafLayer.setIcon === 'function') {
          const feat = leafLayer._cmFeature;
          const iconName = feat?.style?.markerIcon || 'pin';
          const size = feat?.style?.markerSize || 24;
          const rotation = feat?.style?.markerRotation || 0;
          const iconHtml = FeaturePopupBuilder.getMarkerSVG(iconName, color, size, rotation);
          leafLayer.setIcon(L.divIcon({
            className: 'cm-custom-marker-icon',
            html: iconHtml,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2]
          }));
        }
      });
    }

    this.renderedClusters.forEach(marker => {
      const cluster = marker._cmCluster;
      if (cluster && Array.isArray(cluster.features)) {
        const hasPointFromLayer = cluster.features.some(f => f.layerId === layerId);
        if (hasPointFromLayer) {
          cluster.color = color;
          marker._lastColor = color;
          marker.setIcon(this.clusterEngine.createClusterIcon(cluster));
        }
      }
    });

    if (this._cachedClusters) {
      this._cachedClusters.forEach(cluster => {
        if (cluster.features && cluster.features.some(f => f.layerId === layerId)) {
          cluster.color = color;
        }
      });
    }
  }

  updateViewportCulling(forceRefresh = false) {
    ViewportCullingManager.updateViewportCulling(this, forceRefresh);
  }

  renderClusterMarker(cluster) {
    return ViewportCullingManager.renderClusterMarker(this, cluster);
  }

  removeClusterMarker(clusterId) {
    ViewportCullingManager.removeClusterMarker(this, clusterId);
  }

  clearAllClusters() {
    ViewportCullingManager.clearAllClusters(this);
  }

  renderSingleFeature(feat, layers) {
    if (!feat) return null;
    if (feat.visible === false) {
      this.removeSingleFeature(feat.id);
      return null;
    }

    if (layers && layers !== this.allLayers) {
      this._syncLayerMap(layers);
    }

    const layerConfig = this.layerMap.get(feat.layerId) || { color: '#00E08A', opacity: 1, visible: true };
    if (layerConfig.visible === false) {
      this.removeSingleFeature(feat.id);
      return null;
    }

    const defaultColor = feat.color || layerConfig.color || '#00E08A';
    const layerOpacity = layerConfig.opacity !== undefined ? Number(layerConfig.opacity) : 1;
    const rawFillOpacity = feat.style?.fillOpacity !== undefined ? Number(feat.style.fillOpacity) : 0.35;
    const combinedFillOpacity = Math.max(0, Math.min(1, rawFillOpacity * layerOpacity));

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

    const isSelected = (this.engine.selectedFeatureId === feat.id) || 
                       (this.engine.selectedFeatureIds && this.engine.selectedFeatureIds.has(feat.id));
    if (isSelected) {
      style.strokeWidth = Math.max(3.8, style.strokeWidth + 1.8);
      style.strokeColor = '#38bdf8';
      if (feat.type === 'Polygon' || feat.type === 'Circle') {
        style.fillOpacity = Math.min(1, style.fillOpacity + 0.18);
      }
    }

    const rawCoords = FeatureGeometryUtils.normalizeCoordinates(feat);
    const zoom = this.map ? this.map.getZoom() : 14;
    const coords = GeometrySimplifier.simplify(rawCoords, feat.type, zoom);
    let existingLayer = this.engine.renderedFeatures.get(feat.id);

    const isSvgMarker = existingLayer instanceof L.Marker;
    const wantsSvgMarker = feat.type === 'Point' && ['tower', 'tree', 'warning', 'water', 'boundary'].includes(style.markerIcon);
    const markerKindMismatch = feat.type === 'Point' && existingLayer && (isSvgMarker !== wantsSvgMarker);

    if (existingLayer && (existingLayer._cmType !== feat.type || markerKindMismatch)) {
      const oldGroup = this.engine.featureLayers.get(existingLayer._cmLayerId);
      if (oldGroup) oldGroup.removeLayer(existingLayer);
      else this.map.removeLayer(existingLayer);
      existingLayer = null;
    }

    if (!existingLayer) {
      const { paneName } = this.getOrCreateLayerPane(feat.layerId);
      existingLayer = GeometryLayerBuilder.createLeafletLayer(feat, coords, style, isSelected, paneName, (f) => {
        if (this.engine.onFeatureUpdated) this.engine.onFeatureUpdated(f);
      });

      if (existingLayer) {
        existingLayer._cmType = feat.type;
        existingLayer._cmLayerId = feat.layerId;
        existingLayer._cmFeature = feat;

        // Só dispara para marcadores DOM (ícones SVG e textos): os paths em canvas são
        // resolvidos pelo FeatureHitTester no clique do mapa.
        existingLayer.on('click', (e) => {
          if (this.engine._justBoxSelected) return;
          if (this.engine.activeTool !== 'select') {
            if (this.engine.drawingEngine) this.engine.drawingEngine.handleClick(e);
            return;
          }
          if (e && e.originalEvent) e.originalEvent._cmFeatureClicked = true;
          const current = existingLayer._cmFeature || feat;
          this.engine.handleFeatureClick(current, e && e.originalEvent, e && e.latlng);
        });

        existingLayer.on('contextmenu', (e) => {
          if (e && e.originalEvent) e.originalEvent._cmFeatureRightClicked = existingLayer._cmFeature || feat;
        });

        if (existingLayer._path) existingLayer._path.classList.toggle('cm-feature-selected', isSelected);
        if (existingLayer._icon) existingLayer._icon.classList.toggle('cm-feature-selected-marker', isSelected);

        let targetGroup = this.engine.featureLayers.get(feat.layerId);
        if (!targetGroup) {
          targetGroup = L.featureGroup([], { pane: paneName });
          if (layerConfig.visible !== false) targetGroup.addTo(this.map);
          this.engine.featureLayers.set(feat.layerId, targetGroup);
        }
        targetGroup.addLayer(existingLayer);
        this.engine.renderedFeatures.set(feat.id, existingLayer);
      }
    } else {
      existingLayer._cmFeature = feat;
      if (existingLayer._cmLayerId !== feat.layerId) {
        const oldGroup = this.engine.featureLayers.get(existingLayer._cmLayerId);
        if (oldGroup && oldGroup.hasLayer(existingLayer)) oldGroup.removeLayer(existingLayer);
        let targetGroup = this.engine.featureLayers.get(feat.layerId);
        if (!targetGroup) {
          const { paneName } = this.getOrCreateLayerPane(feat.layerId);
          targetGroup = L.featureGroup([], { pane: paneName });
          if (layerConfig.visible !== false) targetGroup.addTo(this.map);
          this.engine.featureLayers.set(feat.layerId, targetGroup);
        }
        targetGroup.addLayer(existingLayer);
        existingLayer._cmLayerId = feat.layerId;
      }
      GeometryLayerBuilder.patchLeafletLayer(existingLayer, feat, coords, style, isSelected);
    }

    if (existingLayer) {
      FeaturePopupBuilder.updatePopupAndTooltip(existingLayer, feat, rawCoords, style);
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
    return FeatureGeometryUtils.normalizeCoordinates(feat);
  }

  createLeafletLayer(feat, coords, style, isSelected = false) {
    const { paneName } = this.getOrCreateLayerPane(feat.layerId);
    return GeometryLayerBuilder.createLeafletLayer(feat, coords, style, isSelected, paneName, (f) => {
      if (this.engine.onFeatureUpdated) this.engine.onFeatureUpdated(f);
    });
  }

  patchLeafletLayer(layer, feat, coords, style, isSelected = false) {
    GeometryLayerBuilder.patchLeafletLayer(layer, feat, coords, style, isSelected);
  }

  updatePopupAndTooltip(leafLayer, feat, rawCoords, style) {
    FeaturePopupBuilder.updatePopupAndTooltip(leafLayer, feat, rawCoords, style);
  }

  getMarkerSVG(iconName, color, size = 24, rotation = 0) {
    return FeaturePopupBuilder.getMarkerSVG(iconName, color, size, rotation);
  }

  escapeHtml(str) {
    return FeatureGeometryUtils.escapeHtml(str);
  }

  createFeaturePopupHtml(feat) {
    return FeaturePopupBuilder.createFeaturePopupHtml(feat);
  }

  zoomToFeature(featureId) {
    FeatureViewportController.zoomToFeature(this, featureId);
  }

  fitAllFeatures() {
    FeatureViewportController.fitAllFeatures(this);
  }

  fitLayer(layerId) {
    FeatureViewportController.fitLayer(this, layerId);
  }

  refreshSelectionVisuals(prevSelectedIds, newSelectedIds) {
    FeatureViewportController.refreshSelectionVisuals(this, prevSelectedIds, newSelectedIds);
  }

  calculateDistance(p1, p2) {
    return FeatureGeometryUtils.calculateDistance(p1, p2);
  }

  calculatePolylineLength(coordinates) {
    return FeatureGeometryUtils.calculatePolylineLength(coordinates);
  }

  calculatePolygonArea(coords) {
    return FeatureGeometryUtils.calculatePolygonArea(coords);
  }

  calculateBearing(p1, p2) {
    return FeatureGeometryUtils.calculateBearing(p1, p2);
  }

  calculateSegments(coordinates, isClosed = false) {
    return FeatureGeometryUtils.calculateSegments(coordinates, isClosed);
  }

  destroy() {
    if (this._cullingRaf) {
      cancelAnimationFrame(this._cullingRaf);
      this._cullingRaf = null;
    }
    this.clearAllClusters();
    this.renderedClusters.clear();
    this.allFeatures = [];
    this.featureMap.clear();
    this.layerMap.clear();

    if (this.map && this._createdPaneNames) {
      this._createdPaneNames.forEach(paneName => {
        const pane = this.map.getPane(paneName);
        if (pane && pane.parentNode) {
          pane.parentNode.removeChild(pane);
        }
      });
      this._createdPaneNames.clear();
    }
    this.map = null;
    this.engine = null;
  }
}
