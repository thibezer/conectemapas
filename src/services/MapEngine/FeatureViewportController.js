/* ==========================================================================
   ConecteMapas - FeatureViewportController
   Enquadramento de câmera (zoomToFeature, fitAllFeatures, fitLayer)
   e atualização rápida em lote de seleções visuais (refreshSelectionVisuals).
   ========================================================================== */

import L from 'leaflet';
import { SpatialIndex } from '../SpatialIndex.js';

export class FeatureViewportController {
  static zoomToFeature(renderer, featureId) {
    if (!featureId || !renderer.map) return;
    const feat = renderer.featureMap.get(featureId) || (renderer.allFeatures || []).find(f => f.id === featureId);
    if (!feat) return;

    const layerConfig = renderer.layerMap.get(feat.layerId);
    if (layerConfig && layerConfig.visible === false) {
      layerConfig.visible = true;
      if (renderer.engine.setLayerVisibility) {
        renderer.engine.setLayerVisibility(feat.layerId, true);
      }
    }
    if (feat.visible === false) {
      feat.visible = true;
      if (renderer.engine.updateFeature) {
        renderer.engine.updateFeature(feat);
      }
    }

    const bbox = SpatialIndex.computeBounds(feat);
    if (!bbox) return;

    renderer.renderSingleFeature(feat);

    const isSinglePoint = (bbox.minLat === bbox.maxLat && bbox.minLng === bbox.maxLng) ||
                          (Math.abs(bbox.maxLat - bbox.minLat) < 0.00002 && Math.abs(bbox.maxLng - bbox.minLng) < 0.00002);

    let moved = false;
    const onMoveEnd = () => {
      if (moved) return;
      moved = true;
      renderer.updateViewportCulling(true);
      const layer = renderer.engine.renderedFeatures.get(featureId);
      if (layer && typeof layer.openPopup === 'function') {
        try { layer.openPopup(); } catch {}
      }
    };

    renderer.map.once('moveend', onMoveEnd);
    setTimeout(() => {
      renderer.map.off('moveend', onMoveEnd);
      onMoveEnd();
    }, 750);

    if (isSinglePoint) {
      const centerLat = (bbox.minLat + bbox.maxLat) / 2;
      const centerLng = (bbox.minLng + bbox.maxLng) / 2;
      const targetZoom = Math.max(renderer.map.getZoom(), 17);
      renderer.map.flyTo([centerLat, centerLng], targetZoom, { duration: 0.6 });
    } else {
      const bounds = L.latLngBounds([bbox.minLat, bbox.minLng], [bbox.maxLat, bbox.maxLng]);
      if (bounds.isValid()) {
        renderer.map.fitBounds(bounds, { padding: [60, 60], maxZoom: 18, animate: true });
      }
    }
  }

  static fitAllFeatures(renderer) {
    if (!renderer.map) return;
    const bounds = L.latLngBounds([]);
    const features = renderer.allFeatures || [];
    let count = 0;
    features.forEach(f => {
      if (f.visible === false) return;
      const layerConfig = renderer.layerMap.get(f.layerId);
      if (layerConfig && layerConfig.visible === false) return;
      const bbox = SpatialIndex.computeBounds(f);
      if (bbox) {
        bounds.extend([bbox.minLat, bbox.minLng]);
        bounds.extend([bbox.maxLat, bbox.maxLng]);
        count++;
      }
    });
    if (count === 0 || !bounds.isValid()) return;

    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    if (ne.equals(sw) || (Math.abs(ne.lat - sw.lat) < 0.00002 && Math.abs(ne.lng - sw.lng) < 0.00002)) {
      renderer.map.flyTo([ne.lat, ne.lng], Math.max(renderer.map.getZoom(), 17), { duration: 0.6 });
    } else {
      renderer.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18, animate: true });
    }
  }

  static fitLayer(renderer, layerId) {
    if (!layerId || !renderer.map) return;
    const layerConfig = renderer.layerMap.get(layerId);
    if (layerConfig && layerConfig.visible === false) {
      layerConfig.visible = true;
      if (renderer.engine.setLayerVisibility) {
        renderer.engine.setLayerVisibility(layerId, true);
      }
    }
    const bounds = L.latLngBounds([]);
    const features = renderer.allFeatures || [];
    let count = 0;
    features.forEach(f => {
      if (f.layerId !== layerId || f.visible === false) return;
      const bbox = SpatialIndex.computeBounds(f);
      if (bbox) {
        bounds.extend([bbox.minLat, bbox.minLng]);
        bounds.extend([bbox.maxLat, bbox.maxLng]);
        count++;
      }
    });
    if (count === 0 || !bounds.isValid()) return;

    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    if (ne.equals(sw) || (Math.abs(ne.lat - sw.lat) < 0.00002 && Math.abs(ne.lng - sw.lng) < 0.00002)) {
      renderer.map.flyTo([ne.lat, ne.lng], Math.max(renderer.map.getZoom(), 17), { duration: 0.6 });
    } else {
      renderer.map.fitBounds(bounds, { padding: [60, 60], maxZoom: 18, animate: true });
    }
  }

  static refreshSelectionVisuals(renderer, prevSelectedIds, newSelectedIds) {
    const prevSet = prevSelectedIds instanceof Set ? prevSelectedIds : new Set(prevSelectedIds || []);
    const newSet = newSelectedIds instanceof Set ? newSelectedIds : new Set(newSelectedIds || []);

    const changedIds = new Set();
    for (const id of prevSet) {
      if (!newSet.has(id)) changedIds.add(id);
    }
    for (const id of newSet) {
      if (!prevSet.has(id)) changedIds.add(id);
    }

    if (changedIds.size === 0) return;

    const bounds = renderer.map ? renderer.map.getBounds() : null;
    let pointClustersNeedRedraw = false;

    const applyVisual = (featId) => {
      const feat = renderer.featureMap.get(featId) || (renderer.allFeatures || []).find(f => f.id === featId);
      if (!feat) return;

      const layer = renderer.engine?.renderedFeatures?.get(featId);
      const isSelected = newSet.has(featId);

      const layerConfig = renderer.layerMap.get(feat.layerId) || { color: '#00E08A', opacity: 1, visible: true };
      const defaultColor = feat.color || layerConfig.color || '#00E08A';
      const layerOpacity = layerConfig.opacity !== undefined ? Number(layerConfig.opacity) : 1;
      const rawFillOpacity = feat.style?.fillOpacity !== undefined ? Number(feat.style.fillOpacity) : 0.35;
      const combinedFillOpacity = Math.max(0, Math.min(1, rawFillOpacity * layerOpacity));
      const strokeWidth = feat.style?.strokeWidth !== undefined ? Number(feat.style.strokeWidth) : 2.5;

      if (layer) {
        if (typeof layer.setStyle === 'function') {
          const targetColor = isSelected ? '#38bdf8' : (feat.style?.strokeColor || defaultColor);
          const targetWidth = isSelected ? Math.max(3.8, strokeWidth + 1.8) : strokeWidth;
          const targetFillOpacity = (isSelected && (feat.type === 'Polygon' || feat.type === 'Circle'))
            ? Math.min(1, combinedFillOpacity + 0.18)
            : combinedFillOpacity;
          const targetFillColor = feat.style?.fillColor || defaultColor;

          layer.setStyle({
            color: targetColor,
            weight: targetWidth,
            fillColor: targetFillColor,
            fillOpacity: targetFillOpacity
          });

          if (isSelected && typeof layer.bringToFront === 'function') {
            layer.bringToFront();
          }
        } else if (layer instanceof L.Marker) {
          const el = layer.getElement ? layer.getElement() : layer._icon;
          if (el) {
            if (isSelected) {
              el.classList.add('cm-marker-selected');
              el.style.filter = 'drop-shadow(0 0 6px #38bdf8)';
            } else {
              el.classList.remove('cm-marker-selected');
              el.style.filter = '';
            }
          }
        }
      }

      if (feat.type === 'Point') {
        pointClustersNeedRedraw = true;
      }
    };

    const changedArr = Array.from(changedIds);
    if (changedArr.length > 150) {
      const insideBounds = [];
      const outsideBounds = [];

      for (const featId of changedArr) {
        const feat = renderer.featureMap.get(featId);
        if (feat && bounds && this._isFeatureInBounds(feat, bounds)) {
          insideBounds.push(featId);
        } else {
          outsideBounds.push(featId);
        }
      }

      for (const id of insideBounds) applyVisual(id);

      if (outsideBounds.length > 0) {
        let i = 0;
        const chunk = 100;
        const processChunk = () => {
          const limit = Math.min(i + chunk, outsideBounds.length);
          for (; i < limit; i++) applyVisual(outsideBounds[i]);
          if (i < outsideBounds.length) {
            requestAnimationFrame(processChunk);
          } else if (pointClustersNeedRedraw && renderer.clusterEngine) {
            renderer.clusterEngine.redraw();
          }
        };
        requestAnimationFrame(processChunk);
      }
    } else {
      for (const id of changedArr) applyVisual(id);
      if (pointClustersNeedRedraw && renderer.clusterEngine) {
        renderer.clusterEngine.redraw();
      }
    }
  }

  static _isFeatureInBounds(feat, bounds) {
    if (!feat || !bounds) return true;
    if (feat.type === 'Point' && Array.isArray(feat.coordinates) && feat.coordinates.length >= 2) {
      return bounds.contains(L.latLng(feat.coordinates[0], feat.coordinates[1]));
    }
    return true;
  }
}
