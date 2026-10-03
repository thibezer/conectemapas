/* ==========================================================================
   ConecteMapas - ViewportCullingManager
   Gerenciamento de Culling Espacial de Viewport e Marcadores de Cluster
   ========================================================================== */

import L from 'leaflet';
import { GeometryVersionManager } from '../GeometryVersionManager.js';

export class ViewportCullingManager {
  static updateViewportCulling(renderer, forceRefresh = false) {
    if (!renderer.map || !renderer.allFeatures) return;

    if (renderer._cullingRaf) cancelAnimationFrame(renderer._cullingRaf);
    renderer._cullingRaf = requestAnimationFrame(() => {
      const bounds = renderer.map.getBounds();
      const currentZoom = renderer.map.getZoom();
      const zoomChanged = renderer._lastCullingZoom !== currentZoom;
      renderer._lastCullingZoom = currentZoom;

      const totalFeats = renderer.allFeatures.length;
      const isSmallDataset = totalFeats <= 300;

      // Para datasets pequenos (<=300 feições), mantém todos os vetores carregados para
      // eliminar pop-in e piscamento ao arrastar o mapa. Para datasets massivos, usa buffer de 75%.
      const queryResults = isSmallDataset
        ? renderer.allFeatures
        : renderer.engine.spatialIndex.query(bounds, 0.75);

      const visibleIdSet = new Set(queryResults.map(f => f.id));

      const selectedIdSet = new Set();
      if (renderer.engine.vertexEditor?.editingFeature?.id) {
        selectedIdSet.add(renderer.engine.vertexEditor.editingFeature.id);
        visibleIdSet.add(renderer.engine.vertexEditor.editingFeature.id);
      }
      if (renderer.engine.selectedFeatureId) {
        selectedIdSet.add(renderer.engine.selectedFeatureId);
        visibleIdSet.add(renderer.engine.selectedFeatureId);
      }
      if (renderer.engine.selectedFeatureIds && renderer.engine.selectedFeatureIds.size > 0) {
        renderer.engine.selectedFeatureIds.forEach(id => {
          selectedIdSet.add(id);
          visibleIdSet.add(id);
        });
      }

      const visibleVectors = [];
      const visiblePoints = [];

      queryResults.forEach(feat => {
        if (!feat || feat.visible === false || feat.is_deleted || feat._deleted || feat.deleted_at) return;
        const layerConfig = renderer.layerMap.get(feat.layerId);
        if (layerConfig && layerConfig.visible === false) return;

        const shouldRender = GeometryVersionManager.shouldRenderFeature(
          feat,
          renderer.allFeatures,
          renderer.engine.showPreviewGeometries,
          renderer.engine.individualPreviewToggles
        );
        if (!shouldRender) return;

        if (feat.type === 'Point') {
          visiblePoints.push(feat);
        } else {
          visibleVectors.push(feat);
        }
      });

      visibleVectors.forEach(feat => {
        const isRendered = renderer.engine.renderedFeatures.has(feat.id);
        // Se já está renderizado e o zoom não altera a geometria simplificada (zoom >= 12), evita re-render desnecessário
        if (isRendered && !forceRefresh) {
          if (!zoomChanged || currentZoom >= 12) return;
        }
        renderer.renderSingleFeature(feat);
      });

      // Pontos selecionados ou em edição NUNCA devem ser ocultados dentro de bolhas de cluster
      const pointsToCluster = [];
      const prioritySingles = [];
      visiblePoints.forEach(p => {
        if (selectedIdSet.has(p.id)) {
          prioritySingles.push(p);
        } else {
          pointsToCluster.push(p);
        }
      });

      let pointsChanged = false;
      if (!renderer._lastVisiblePointIds || renderer._lastVisiblePointIds.length !== pointsToCluster.length) {
        pointsChanged = true;
      } else {
        for (let i = 0; i < pointsToCluster.length; i++) {
          if (pointsToCluster[i].id !== renderer._lastVisiblePointIds[i]) {
            pointsChanged = true;
            break;
          }
        }
      }

      const needsClusterRecompute = zoomChanged ||
        pointsChanged ||
        renderer._lastClusterRevision !== renderer._clusterRevision ||
        forceRefresh ||
        !renderer._cachedClusters;

      let clusters, singles;
      if (!needsClusterRecompute) {
        clusters = renderer._cachedClusters || [];
        singles = [...prioritySingles, ...(renderer._cachedSingles || [])];
      } else {
        const computed = renderer.clusterEngine.computeClusters(pointsToCluster, renderer.map);
        clusters = computed.clusters;
        singles = [...prioritySingles, ...computed.singles];
        renderer._cachedClusters = computed.clusters;
        renderer._cachedSingles = computed.singles;
        renderer._lastVisiblePointIds = pointsToCluster.map(p => p.id);
        renderer._lastClusterRevision = renderer._clusterRevision;
        renderer._lastClusterZoom = currentZoom;
      }

      const activeClusterIdSet = new Set();
      const clusteredPointIdSet = new Set();

      clusters.forEach(cluster => {
        activeClusterIdSet.add(cluster.id);
        cluster.features.forEach(f => clusteredPointIdSet.add(f.id));
        this.renderClusterMarker(renderer, cluster);
      });

      singles.forEach(feat => {
        const isRendered = renderer.engine.renderedFeatures.has(feat.id);
        if (isRendered && !zoomChanged && !forceRefresh) return;
        renderer.renderSingleFeature(feat);
      });

      clusteredPointIdSet.forEach(featId => {
        // Nunca remove feição pontual se ela estiver selecionada
        if (!selectedIdSet.has(featId) && renderer.engine.renderedFeatures.has(featId)) {
          renderer.removeSingleFeature(featId);
        }
      });

      renderer.renderedClusters.forEach((marker, clusterId) => {
        if (!activeClusterIdSet.has(clusterId)) {
          this.removeClusterMarker(renderer, clusterId);
        }
      });

      renderer.engine.renderedFeatures.forEach((layer, featId) => {
        const featObj = renderer.featureMap.get(featId);
        const shouldRender = featObj ? GeometryVersionManager.shouldRenderFeature(
          featObj,
          renderer.allFeatures,
          renderer.engine.showPreviewGeometries,
          renderer.engine.individualPreviewToggles
        ) : true;
        const isHidden = featObj && (
          featObj.visible === false || 
          featObj.is_deleted ||
          featObj._deleted ||
          featObj.deleted_at ||
          !shouldRender || 
          renderer.layerMap.get(featObj.layerId)?.visible === false
        );
        const isClustered = clusteredPointIdSet.has(featId) && !selectedIdSet.has(featId);
        if (!visibleIdSet.has(featId) || isClustered || isHidden) {
          renderer.removeSingleFeature(featId);
        }
      });
    });
  }

  static renderClusterMarker(renderer, cluster) {
    let marker = renderer.renderedClusters.get(cluster.id);
    if (!marker) {
      const icon = renderer.clusterEngine.createClusterIcon(cluster);
      marker = L.marker(cluster.center, { icon, zIndexOffset: 1200 });
      marker._cmCluster = cluster;
      marker._lastCount = cluster.count;
      marker._lastColor = cluster.color;

      marker.on('click', (e) => {
        if (e && e.originalEvent) L.DomEvent.stopPropagation(e);
        if (cluster.bounds && cluster.bounds.isValid()) {
          const sw = cluster.bounds.getSouthWest();
          const ne = cluster.bounds.getNorthEast();
          if (sw.lat === ne.lat && sw.lng === ne.lng) {
            renderer.map.setView(cluster.center, Math.min(19, renderer.map.getZoom() + 2), { animate: true });
          } else {
            renderer.map.fitBounds(cluster.bounds.pad(0.35), {
              maxZoom: Math.min(18, renderer.map.getZoom() + 3),
              animate: true,
              duration: 0.5
            });
          }
        }
      });

      marker.bindTooltip(
        `<span style="font-weight: 700; font-size: 11px;">${cluster.count.toLocaleString('pt-BR')} feições agrupadas</span><br/><span style="font-size: 9.5px; color: #aaa;">Clique para aproximar</span>`,
        { direction: 'top', offset: [0, -18], opacity: 0.95 }
      );
      marker.addTo(renderer.map);
      renderer.renderedClusters.set(cluster.id, marker);
    } else {
      marker._cmCluster = cluster;
      if (marker._lastCount !== cluster.count || marker._lastColor !== cluster.color) {
        marker._lastCount = cluster.count;
        marker._lastColor = cluster.color;
        marker.setLatLng(cluster.center);
        marker.setIcon(renderer.clusterEngine.createClusterIcon(cluster));
      }
    }
    return marker;
  }

  static removeClusterMarker(renderer, clusterId) {
    const marker = renderer.renderedClusters.get(clusterId);
    if (marker) {
      marker.off();
      renderer.map.removeLayer(marker);
      renderer.renderedClusters.delete(clusterId);
    }
  }

  static clearAllClusters(renderer) {
    renderer.renderedClusters.forEach(marker => {
      marker.off();
      renderer.map.removeLayer(marker);
    });
    renderer.renderedClusters.clear();
    renderer._cachedClusters = null;
    renderer._cachedSingles = null;
    renderer._lastVisiblePointIds = null;
  }
}
