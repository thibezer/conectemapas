import L from 'leaflet';
import { GeometrySimplifier } from '../GeometrySimplifier.js';
import { PointClusterEngine } from './PointClusterEngine.js';
import { GeometryVersionManager } from '../GeometryVersionManager.js';
import { SpatialIndex } from '../SpatialIndex.js';

export class FeatureRenderer {
  constructor(mapEngine) {
    this.engine = mapEngine;
    this.map = mapEngine.map;
    this.allFeatures = [];
    this.allLayers = [];
    this.layerMap = new Map();
    this.cullingThreshold = 60;
    this._cullingRaf = null;

    // Motor de Agrupamento Dinâmico por Escala e Proximidade em Pixels
    this.clusterEngine = new PointClusterEngine({ gridSize: 55, maxClusterZoom: 17 });
    this.renderedClusters = new Map(); // Map<clusterId, L.Marker>
    this.featureMap = new Map(); // Map<featId, Feature>
    this._lastCullingZoom = null;

    // Cache e Invalidação Inteligente de Clusters (Item 8)
    this._clusterRevision = 0;
    this._lastClusterRevision = -1;
    this._lastClusterZoom = null;
    this._lastVisiblePointIds = null;
    this._cachedClusters = null;
    this._cachedSingles = null;

    // Gerenciamento de Z-Index via Custom Panes (Item 11)
    this._createdPaneNames = new Set();
  }

  /**
   * Obtém ou cria um Leaflet Pane dedicado para a camada (CSS z-index acelerado por GPU)
   */
  getOrCreateLayerPane(layerId) {
    const paneName = `cm-layer-pane-${layerId}`;
    let pane = this.map ? this.map.getPane(paneName) : null;
    if (!pane && this.map) {
      pane = this.map.createPane(paneName);
      this._createdPaneNames.add(paneName);
    }
    return { paneName, pane };
  }

  /**
   * Remove o pane customizado de uma camada excluída
   */
  removeLayerPane(layerId) {
    const paneName = `cm-layer-pane-${layerId}`;
    const pane = this.map ? this.map.getPane(paneName) : null;
    if (pane && pane.parentNode) {
      pane.parentNode.removeChild(pane);
    }
    this._createdPaneNames.delete(paneName);
  }

  /**
   * Atualiza o CSS z-index de cada camada diretamente em seus Panes (O(m) CSS, sem tocar no DOM Leaflet)
   */
  updateLayerZIndexes(layers) {
    const layerList = layers || this.allLayers || [];
    const total = layerList.length;
    layerList.forEach((layer, index) => {
      const { pane } = this.getOrCreateLayerPane(layer.id);
      if (pane) {
        // Camada index 0 (topo no painel) recebe o maior z-index
        // Range: 410 a 590 (acima do overlayPane 400 e abaixo do markerPane 600)
        const zIndex = 410 + (total - index) * 5;
        pane.style.zIndex = String(zIndex);
      }
    });
  }

  /**
   * Invalida o cache de agrupamento quando posições ou feições pontuais são alteradas
   */
  invalidateClusterCache() {
    this._clusterRevision++;
  }

  /**
   * Sincroniza o array de camadas e o Map indexado por ID O(1)
   */
  _syncLayerMap(layers) {
    this.allLayers = layers || [];
    this.layerMap = new Map(this.allLayers.map(l => [l.id, l]));
  }

  renderFeatures(features, layers, forceRebuildIndex = false) {
    this.allFeatures = features || [];
    this.featureMap = new Map(this.allFeatures.map(f => [f.id, f]));
    this._syncLayerMap(layers);

    // Constrói o índice espacial de forma inteligente: só reconstrói se forçado ou tamanho alterado
    if (forceRebuildIndex || this.engine.spatialIndex.size !== this.allFeatures.length) {
      this.engine.spatialIndex.build(this.allFeatures, true);
    }

    // 1. Reconciliação dos L.featureGroup e Panes das camadas
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

    // 2. Remove imediatamente do mapa quaisquer feições e clusters antigos que foram excluídos
    const currentFeatureIds = new Set(this.allFeatures.map(f => f.id));
    this.engine.renderedFeatures.forEach((layer, featId) => {
      if (!currentFeatureIds.has(featId)) {
        this.removeSingleFeature(featId);
      }
    });
    this.clearAllClusters();

    // 3. Renderização inteligente com Agrupamento e Culling
    this.updateViewportCulling();

    // 4. Ordenação Z-Index das camadas via Leaflet Custom Panes (O(1) no compositor, sem bringToFront)
    this.updateLayerZIndexes(this.allLayers);
  }

  /**
   * Altera a visibilidade de uma camada diretamente no Leaflet sem reprocessar o índice espacial (O(1))
   */
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

    // Reavalia culling e clusters de pontos visíveis com forceRefresh
    this.updateViewportCulling(true);
  }

  /**
   * Altera a opacidade de uma camada in-place nas instâncias Leaflet sem tocar no índice espacial (O(k))
   */
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

  /**
   * Altera a cor de uma camada in-place nas instâncias Leaflet (O(k))
   * O cluster não é recalculado: apenas os estilos dos marcadores e clusters existentes
   * são atualizados diretamente na tela.
   */
  setLayerColor(layerId, color) {
    const layer = this.layerMap.get(layerId);
    if (layer) layer.color = color;

    // 1. Atualiza feições vetoriais e pontos individuais da camada
    const group = this.engine.featureLayers.get(layerId);
    if (group) {
      group.eachLayer(leafLayer => {
        if (typeof leafLayer.setStyle === 'function') {
          leafLayer.setStyle({
            color: color,
            fillColor: color
          });
        } else if (leafLayer._cmType === 'Point' && typeof leafLayer.setIcon === 'function') {
          const feat = leafLayer._cmFeature;
          const iconName = feat?.style?.markerIcon || 'pin';
          const size = feat?.style?.markerSize || 24;
          const rotation = feat?.style?.markerRotation || 0;
          const iconHtml = this.getMarkerSVG(iconName, color, size, rotation);
          leafLayer.setIcon(L.divIcon({
            className: 'cm-custom-marker-icon',
            html: iconHtml,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2]
          }));
        }
      });
    }

    // 2. Atualiza clusters ativos in-place (sem recomputar partições geométricas)
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

    // 3. Atualiza dados no cache para preservar a cor sem recomputação
    if (this._cachedClusters) {
      this._cachedClusters.forEach(cluster => {
        if (cluster.features && cluster.features.some(f => f.layerId === layerId)) {
          cluster.color = color;
        }
      });
    }
  }

  /**
   * Reorganiza o Z-Index das camadas no Leaflet instantaneamente via Panes (O(m) CSS / O(1) DOM)
   * Elimina completamente manipulação de nós DOM do bringToFront()
   */
  reorderLayers(layers) {
    this._syncLayerMap(layers);
    this.updateLayerZIndexes(this.allLayers);
  }


  /**
   * Adiciona feição ao motor respeitando o culling espacial:
   * Se estiver fora do viewport atual, indexa em O(1) mas não toca no Leaflet.
   */
  addFeature(feat, layers) {
    if (!feat || !feat.id) return;
    if (feat.type === 'Point') {
      this.invalidateClusterCache();
    }
    if (layers && layers !== this.allLayers) {
      this._syncLayerMap(layers);
    }
    if (!this.featureMap.has(feat.id)) {
      this.allFeatures.push(feat);
      this.featureMap.set(feat.id, feat);
    } else {
      this.featureMap.set(feat.id, feat);
      const idx = this.allFeatures.findIndex(f => f.id === feat.id);
      if (idx >= 0) this.allFeatures[idx] = feat;
    }

    const bounds = this.map ? this.map.getBounds() : null;
    const isVisibleInViewport = bounds ? this.engine.spatialIndex.intersects(feat, bounds, 0.20) : true;

    if (isVisibleInViewport && feat.visible !== false) {
      this.renderSingleFeature(feat, layers);
    }
  }

  /**
   * Atualiza feição in-place respeitando o culling espacial:
   * Monta se entrou na visão, desmembra se saiu, ou atualiza in-place se permanece.
   */
  updateFeature(feat, layers) {
    if (!feat || !feat.id) return;
    if (feat.type === 'Point') {
      this.invalidateClusterCache();
    }
    if (layers && layers !== this.allLayers) {
      this._syncLayerMap(layers);
    }
    this.featureMap.set(feat.id, feat);
    const idx = this.allFeatures.findIndex(f => f.id === feat.id);
    if (idx >= 0) this.allFeatures[idx] = feat;
    else this.allFeatures.push(feat);

    if (this.engine && this.engine.spatialIndex) {
      this.engine.spatialIndex.update(feat);
    }

    const bounds = this.map ? this.map.getBounds() : null;
    const isVisibleInViewport = bounds ? this.engine.spatialIndex.intersects(feat, bounds, 0.20) : true;
    const shouldRender = GeometryVersionManager.shouldRenderFeature(
      feat,
      this.allFeatures,
      this.engine.showPreviewGeometries,
      this.engine.individualPreviewToggles
    );

    if (isVisibleInViewport && feat.visible !== false && shouldRender) {
      this.renderSingleFeature(feat, layers);
    } else {
      this.removeSingleFeature(feat.id);
    }
  }

  /**
   * Remove feição do motor e do mapa
   */
  removeFeature(featId) {
    const feat = this.featureMap.get(featId);
    if (!feat || feat.type === 'Point') {
      this.invalidateClusterCache();
    }
    this.featureMap.delete(featId);
    const idx = this.allFeatures.findIndex(f => f.id === featId);
    if (idx >= 0) this.allFeatures.splice(idx, 1);
    if (this.engine && this.engine.spatialIndex) {
      this.engine.spatialIndex.remove(featId);
    }
    this.removeSingleFeature(featId);
  }

  /**
   * CULLING ESPACIAL COMO CORAÇÃO DO MOTOR:
   * Diferencial de Viewport (Diffing):
   * - Em Pans: feições já renderizadas que permanecem na visão NÃO sofrem nenhum reprocessamento (0 ms overhead).
   * - Apenas feições que entram são montadas, e que saem são desmontadas.
   * - Em Zooms: recalculam-se clusters e LOD dinâmico.
   */
  updateViewportCulling(forceRefresh = false) {
    if (!this.map || !this.allFeatures) return;

    if (this._cullingRaf) cancelAnimationFrame(this._cullingRaf);
    this._cullingRaf = requestAnimationFrame(() => {
      const bounds = this.map.getBounds();
      const currentZoom = this.map.getZoom();
      const zoomChanged = this._lastCullingZoom !== currentZoom;
      this._lastCullingZoom = currentZoom;

      const visibleFeats = this.engine.spatialIndex.query(bounds, 0.20);
      const visibleIdSet = new Set(visibleFeats.map(f => f.id));

      // Protege feição em edição no VertexEditor ou selecionada
      if (this.engine.vertexEditor?.editingFeature?.id) {
        visibleIdSet.add(this.engine.vertexEditor.editingFeature.id);
      }
      if (this.engine.selectedFeatureId) {
        visibleIdSet.add(this.engine.selectedFeatureId);
      }
      if (this.engine.selectedFeatureIds && this.engine.selectedFeatureIds.size > 0) {
        this.engine.selectedFeatureIds.forEach(id => visibleIdSet.add(id));
      }

      // 1. Separa vetores (polígonos, linhas) de pontos
      const visibleVectors = [];
      const visiblePoints = [];

      visibleFeats.forEach(feat => {
        if (feat.visible === false) return;
        const layerConfig = this.layerMap.get(feat.layerId);
        if (layerConfig && layerConfig.visible === false) return;

        // Regra de Negócio: Geometria Oficial vs Prévia
        const shouldRender = GeometryVersionManager.shouldRenderFeature(
          feat,
          this.allFeatures,
          this.engine.showPreviewGeometries,
          this.engine.individualPreviewToggles
        );
        if (!shouldRender) return;

        if (feat.type === 'Point') {
          visiblePoints.push(feat);
        } else {
          visibleVectors.push(feat);
        }
      });

      // 2. Renderização seletiva de vetores (com Viewport Diffing)
      visibleVectors.forEach(feat => {
        const isRendered = this.engine.renderedFeatures.has(feat.id);
        // Se já está na tela e o zoom não mudou: PULA (0 overhead de reconciliação!)
        if (isRendered && !zoomChanged && !forceRefresh) {
          return;
        }
        this.renderSingleFeature(feat);
      });

      // 3. Agrupamento Dinâmico de Pontos (Marker Clustering por Escala)
      // O cluster só é recalculado quando:
      // - O nível de zoom mudou (zoomChanged)
      // - A lista de pontos visíveis mudou (entraram ou saíram do viewport)
      // - Pontos foram adicionados, removidos ou tiveram coordenadas alteradas (_clusterRevision)
      // - forceRefresh foi solicitado
      let pointsChanged = false;
      if (!this._lastVisiblePointIds || this._lastVisiblePointIds.length !== visiblePoints.length) {
        pointsChanged = true;
      } else {
        for (let i = 0; i < visiblePoints.length; i++) {
          if (visiblePoints[i].id !== this._lastVisiblePointIds[i]) {
            pointsChanged = true;
            break;
          }
        }
      }

      const needsClusterRecompute = zoomChanged ||
        pointsChanged ||
        this._lastClusterRevision !== this._clusterRevision ||
        forceRefresh ||
        !this._cachedClusters;

      let clusters, singles;
      if (!needsClusterRecompute) {
        clusters = this._cachedClusters;
        singles = this._cachedSingles;
      } else {
        const computed = this.clusterEngine.computeClusters(visiblePoints, this.map);
        clusters = computed.clusters;
        singles = computed.singles;
        this._cachedClusters = clusters;
        this._cachedSingles = singles;
        this._lastVisiblePointIds = visiblePoints.map(p => p.id);
        this._lastClusterRevision = this._clusterRevision;
        this._lastClusterZoom = currentZoom;
      }

      const activeClusterIdSet = new Set();
      const clusteredPointIdSet = new Set();

      // Renderiza marcadores de cluster
      clusters.forEach(cluster => {
        activeClusterIdSet.add(cluster.id);
        cluster.features.forEach(f => clusteredPointIdSet.add(f.id));
        this.renderClusterMarker(cluster);
      });

      // Renderiza pontos isolados
      singles.forEach(feat => {
        const isRendered = this.engine.renderedFeatures.has(feat.id);
        if (isRendered && !zoomChanged && !forceRefresh) {
          return;
        }
        this.renderSingleFeature(feat);
      });

      // 4. Remove do mapa pontos que foram absorvidos em clusters
      clusteredPointIdSet.forEach(featId => {
        if (this.engine.renderedFeatures.has(featId)) {
          this.removeSingleFeature(featId);
        }
      });

      // 5. Remove clusters antigos que não existem mais neste zoom
      this.renderedClusters.forEach((marker, clusterId) => {
        if (!activeClusterIdSet.has(clusterId)) {
          this.removeClusterMarker(clusterId);
        }
      });

      // 6. Remove do Leaflet feições que saíram do campo de visão (Culling Exit) ou que estão ocultas
      this.engine.renderedFeatures.forEach((layer, featId) => {
        const featObj = this.featureMap.get(featId);
        const shouldRender = featObj ? GeometryVersionManager.shouldRenderFeature(
          featObj,
          this.allFeatures,
          this.engine.showPreviewGeometries,
          this.engine.individualPreviewToggles
        ) : true;
        const isHidden = featObj && (
          featObj.visible === false || 
          !shouldRender || 
          this.layerMap.get(featObj.layerId)?.visible === false
        );
        if (!visibleIdSet.has(featId) || clusteredPointIdSet.has(featId) || isHidden) {
          this.removeSingleFeature(featId);
        }
      });
    });
  }

  /**
   * Re-renderiza APENAS as feições que mudaram de estado de seleção.
   * Muito mais eficiente que forceRefresh=true no updateViewportCulling,
   * pois toca somente as K feições afetadas em O(K) em vez de todo o viewport.
   *
   * @param {Set<string>} prevSelectedIds - IDs que estavam selecionados antes
   * @param {Set<string>} nextSelectedIds - IDs que estão selecionados agora
   */
  refreshSelectionVisuals(prevSelectedIds = new Set(), nextSelectedIds = new Set()) {
    // União de todos os IDs que mudaram de estado (saíram ou entraram na seleção)
    const toRefresh = new Set([...prevSelectedIds, ...nextSelectedIds]);
    if (toRefresh.size === 0) return;

    toRefresh.forEach(id => {
      const feat = this.featureMap.get(id);
      if (!feat) return;
      if (feat.visible === false) return;
      const layerConfig = this.layerMap.get(feat.layerId);
      if (layerConfig && layerConfig.visible === false) return;
      // Força re-render desta feição individualmente com o novo estado de seleção
      this.renderSingleFeature(feat);
    });
  }

  /**
   * Renderiza ou atualiza o marcador visual de Cluster
   */
  renderClusterMarker(cluster) {

    let marker = this.renderedClusters.get(cluster.id);

    if (!marker) {
      const icon = this.clusterEngine.createClusterIcon(cluster);
      marker = L.marker(cluster.center, {
        icon,
        zIndexOffset: 1200
      });
      marker._cmCluster = cluster;
      marker._lastCount = cluster.count;
      marker._lastColor = cluster.color;

      marker.on('click', (e) => {
        if (e && e.originalEvent) {
          L.DomEvent.stopPropagation(e);
        }
        if (cluster.bounds && cluster.bounds.isValid()) {
          const sw = cluster.bounds.getSouthWest();
          const ne = cluster.bounds.getNorthEast();
          // Se todos os pontos do cluster estiverem nas mesmas coordenadas exatas
          if (sw.lat === ne.lat && sw.lng === ne.lng) {
            this.map.setView(cluster.center, Math.min(19, this.map.getZoom() + 2), { animate: true });
          } else {
            this.map.fitBounds(cluster.bounds.pad(0.35), {
              maxZoom: Math.min(18, this.map.getZoom() + 3),
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

      marker.addTo(this.map);
      this.renderedClusters.set(cluster.id, marker);
    } else {
      marker._cmCluster = cluster;
      // Atualiza coordenadas ou ícone apenas se tiver havido alteração de contagem ou cor
      if (marker._lastCount !== cluster.count || marker._lastColor !== cluster.color) {
        marker._lastCount = cluster.count;
        marker._lastColor = cluster.color;
        marker.setLatLng(cluster.center);
        marker.setIcon(this.clusterEngine.createClusterIcon(cluster));
      }
    }

    return marker;
  }

  removeClusterMarker(clusterId) {
    const marker = this.renderedClusters.get(clusterId);
    if (marker) {
      marker.off();
      this.map.removeLayer(marker);
      this.renderedClusters.delete(clusterId);
    }
  }

  clearAllClusters() {
    this.renderedClusters.forEach(marker => {
      marker.off();
      this.map.removeLayer(marker);
    });
    this.renderedClusters.clear();
    this._cachedClusters = null;
    this._cachedSingles = null;
    this._lastVisiblePointIds = null;
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
      style.strokeColor = '#38bdf8'; // Ciano CAD de destaque de seleção
      if (feat.type === 'Polygon' || feat.type === 'Circle') {
        style.fillOpacity = Math.min(1, style.fillOpacity + 0.18);
      }
    }

    const rawCoords = this.normalizeCoordinates(feat);
    const zoom = this.map ? this.map.getZoom() : 14;
    // LOD dinâmico não-destrutivo para renderização ultrarrápida
    const coords = GeometrySimplifier.simplify(rawCoords, feat.type, zoom);
    let existingLayer = this.engine.renderedFeatures.get(feat.id);

    // Se o tipo mudou ou o subtipo de marcador pontual (Canvas CircleMarker vs DOM SVG) mudou, recria
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
      // --- MOUNT: Cria nova camada Leaflet ---
      existingLayer = this.createLeafletLayer(feat, coords, style, isSelected);
      if (existingLayer) {
        existingLayer._cmType = feat.type;
        existingLayer._cmLayerId = feat.layerId;
        existingLayer._cmFeature = feat;

        existingLayer.on('click', (e) => {
          if (this.engine._justBoxSelected) return;
          if (this.engine.activeTool !== 'select') {
            if (this.engine.drawingEngine) {
              this.engine.drawingEngine.handleClick(e);
            }
            return;
          }
          if (e && e.originalEvent) {
            e.originalEvent._cmFeatureClicked = true;
          }
          const isMulti = e && e.originalEvent && (e.originalEvent.shiftKey || e.originalEvent.ctrlKey || e.originalEvent.metaKey);
          if (isMulti) {
            this.engine.toggleFeatureSelection(feat.id);
          } else {
            this.engine.selectFeature(feat.id);
          }
        });

        existingLayer.on('contextmenu', (e) => {
          if (e && e.originalEvent) {
            e.originalEvent._cmFeatureRightClicked = feat;
          }
        });

        if (existingLayer._path) {
          existingLayer._path.classList.toggle('cm-feature-selected', isSelected);
        }
        if (existingLayer._icon) {
          existingLayer._icon.classList.toggle('cm-feature-selected-marker', isSelected);
        }

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
      existingLayer._cmFeature = feat;

      // Se a camada da feição foi alterada, move o elemento para o featureGroup da nova camada
      if (existingLayer._cmLayerId !== feat.layerId) {
        const oldGroup = this.engine.featureLayers.get(existingLayer._cmLayerId);
        if (oldGroup && oldGroup.hasLayer(existingLayer)) {
          oldGroup.removeLayer(existingLayer);
        }
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

      this.patchLeafletLayer(existingLayer, feat, coords, style, isSelected);
    }


    // Atualiza popup e labels usando a geometria original precisa (rawCoords),
    // garantindo que cálculo de área (Shoelace) e extensão nunca variem com a câmera/zoom
    if (existingLayer) {
      this.updatePopupAndTooltip(existingLayer, feat, rawCoords, style);
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
    if ((feat.type === 'Point' || feat.type === 'Text') && coords && coords.lat !== undefined) {
      return [coords.lat, coords.lng];
    } else if ((feat.type === 'Polygon' || feat.type === 'LineString') && Array.isArray(coords)) {
      const openRing = (pts) => {
        if (!Array.isArray(pts) || pts.length < 3) return pts;
        const first = pts[0];
        const last = pts[pts.length - 1];
        if (first && last && Math.abs(first[0] - last[0]) < 1e-7 && Math.abs(first[1] - last[1]) < 1e-7) {
          return pts.slice(0, -1);
        }
        return pts;
      };

      if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
        const mapped = coords.map(ring => ring.map(pt => (pt && pt.lat !== undefined) ? [pt.lat, pt.lng] : pt));
        return feat.type === 'Polygon' ? mapped.map(openRing) : mapped;
      } else {
        const mapped = coords.map(pt => (pt && pt.lat !== undefined) ? [pt.lat, pt.lng] : pt);
        return feat.type === 'Polygon' ? openRing(mapped) : mapped;
      }
    } else if (feat.type === 'Circle' && coords && coords.lat !== undefined) {
      return [coords.lat, coords.lng];
    }
    return coords;
  }

  createLeafletLayer(feat, coords, style, isSelected = false) {
    const paneName = this.getOrCreateLayerPane(feat.layerId).paneName;

    if (feat.type === 'Text' && coords) {
      const text = feat.properties?.text || feat.name || 'Texto';
      const fontSize = feat.style?.fontSize || 13;
      const textColor = feat.style?.textColor || '#ffffff';
      const bgColor = feat.style?.backgroundColor || 'rgba(15, 23, 42, 0.88)';
      const borderColor = isSelected ? '#38bdf8' : (feat.style?.borderColor || 'rgba(255, 255, 255, 0.25)');
      const haloClass = feat.style?.halo ? 'cm-map-text-halo' : '';

      const html = `<div class="cm-map-text-badge ${haloClass} ${isSelected ? 'cm-map-text-selected' : ''}" style="font-size: ${fontSize}px; color: ${textColor}; background: ${bgColor}; border-color: ${borderColor};">${this.escapeHtml(text)}</div>`;
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
        if (this.engine.onFeatureUpdated) {
          this.engine.onFeatureUpdated(feat);
        }
      });

      return marker;
    } else if (feat.type === 'Point' && coords) {
      const isCustomSvgIcon = ['tower', 'tree', 'warning', 'water', 'boundary'].includes(style.markerIcon);
      if (!isCustomSvgIcon) {
        // Canvas CircleMarker de alta performance (Zero nós DOM adicionais)
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

      const iconHtml = this.getMarkerSVG(style.markerIcon, style.fillColor, style.markerSize, style.markerRotation);
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

  patchLeafletLayer(layer, feat, coords, style, isSelected = false) {
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

    if (feat.type === 'Text' && coords) {
      layer.setLatLng(coords);
      const text = feat.properties?.text || feat.name || 'Texto';
      const fontSize = feat.style?.fontSize || 13;
      const textColor = feat.style?.textColor || '#ffffff';
      const bgColor = feat.style?.backgroundColor || 'rgba(15, 23, 42, 0.88)';
      const borderColor = isSelected ? '#38bdf8' : (feat.style?.borderColor || 'rgba(255, 255, 255, 0.25)');
      const haloClass = feat.style?.halo ? 'cm-map-text-halo' : '';

      const html = `<div class="cm-map-text-badge ${haloClass} ${isSelected ? 'cm-map-text-selected' : ''}" style="font-size: ${fontSize}px; color: ${textColor}; background: ${bgColor}; border-color: ${borderColor};">${this.escapeHtml(text)}</div>`;
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
        const iconHtml = this.getMarkerSVG(style.markerIcon, style.fillColor, style.markerSize, style.markerRotation);
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
    }
  }

  updatePopupAndTooltip(leafLayer, feat, rawCoords, style) {
    // Popup Lazy (QGIS-like): O HTML e os cálculos de área/perímetro só rodam sob demanda no clique com geometria precisa
    const getPopupContent = () => this.createFeaturePopupHtml({ ...feat, coordinates: rawCoords });
    if (leafLayer.getPopup()) {
      leafLayer.setPopupContent(getPopupContent);
    } else {
      leafLayer.bindPopup(getPopupContent, { maxWidth: 280 });
    }

    // Tooltip com geometria exata
    if (style.showLabel) {
      let labelText = feat.name || 'Feição';
      if (style.labelField === 'category') {
        labelText = feat.category || feat.type;
      } else if (style.labelField === 'area' && feat.type === 'Polygon') {
        const a = this.calculatePolygonArea(rawCoords);
        labelText = `${(a / 10000).toFixed(2)} ha`;
      } else if (style.labelField === 'extensao' && feat.type === 'LineString') {
        const l = this.calculatePolylineLength(rawCoords);
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
    } else if (feat.type === 'Text') {
      dimensionInfo = `<div>Rótulo: <strong>${this.escapeHtml(feat.properties?.text || feat.name)}</strong></div>`;
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
    if (!featureId) return;
    const feat = this.featureMap.get(featureId) || (this.allFeatures || []).find(f => f.id === featureId);
    if (!feat) return;

    // Se a camada da feição ou a própria feição estiverem ocultas, reativa a visibilidade
    const layerConfig = this.layerMap.get(feat.layerId);
    if (layerConfig && layerConfig.visible === false) {
      layerConfig.visible = true;
      if (this.engine.setLayerVisibility) {
        this.engine.setLayerVisibility(feat.layerId, true);
      }
    }
    if (feat.visible === false) {
      feat.visible = true;
      if (this.engine.updateFeature) {
        this.engine.updateFeature(feat);
      }
    }

    // Calcula os limites reais matematicamente direto da geometria
    const bbox = SpatialIndex.computeBounds(feat);
    if (!bbox) return;

    // Garante a renderização gráfica da feição mesmo que estivesse fora do viewport culling
    this.renderSingleFeature(feat);

    const isSinglePoint = (bbox.minLat === bbox.maxLat && bbox.minLng === bbox.maxLng) ||
                          (Math.abs(bbox.maxLat - bbox.minLat) < 0.00002 && Math.abs(bbox.maxLng - bbox.minLng) < 0.00002);

    let moved = false;
    const onMoveEnd = () => {
      if (moved) return;
      moved = true;
      this.updateViewportCulling(true);
      const layer = this.engine.renderedFeatures.get(featureId);
      if (layer && typeof layer.openPopup === 'function') {
        try { layer.openPopup(); } catch (e) {}
      }
    };

    this.map.once('moveend', onMoveEnd);
    setTimeout(() => {
      this.map.off('moveend', onMoveEnd);
      onMoveEnd();
    }, 750);

    if (isSinglePoint) {
      // Ponto único ou marco
      const centerLat = (bbox.minLat + bbox.maxLat) / 2;
      const centerLng = (bbox.minLng + bbox.maxLng) / 2;
      const targetZoom = Math.max(this.map.getZoom(), 17);
      this.map.flyTo([centerLat, centerLng], targetZoom, { duration: 0.6 });
    } else {
      // Polígono, linha ou feição com extensão espacial
      const bounds = L.latLngBounds([bbox.minLat, bbox.minLng], [bbox.maxLat, bbox.maxLng]);
      if (bounds.isValid()) {
        this.map.fitBounds(bounds, { padding: [60, 60], maxZoom: 18, animate: true });
      }
    }
  }

  fitAllFeatures() {
    const bounds = L.latLngBounds([]);
    const features = this.allFeatures || [];
    let count = 0;
    features.forEach(f => {
      if (f.visible === false) return;
      const layerConfig = this.layerMap.get(f.layerId);
      if (layerConfig && layerConfig.visible === false) return;
      const bbox = SpatialIndex.computeBounds(f);
      if (bbox) {
        bounds.extend([bbox.minLat, bbox.minLng]);
        bounds.extend([bbox.maxLat, bbox.maxLng]);
        count++;
      }
    });
    if (count === 0 || !bounds.isValid() || !this.map) return;

    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    if (ne.equals(sw) || (Math.abs(ne.lat - sw.lat) < 0.00002 && Math.abs(ne.lng - sw.lng) < 0.00002)) {
      this.map.flyTo([ne.lat, ne.lng], Math.max(this.map.getZoom(), 17), { duration: 0.6 });
    } else {
      this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18, animate: true });
    }
  }

  fitLayer(layerId) {
    if (!layerId) return;
    const layerConfig = this.layerMap.get(layerId);
    if (layerConfig && layerConfig.visible === false) {
      layerConfig.visible = true;
      if (this.engine.setLayerVisibility) {
        this.engine.setLayerVisibility(layerId, true);
      }
    }
    const bounds = L.latLngBounds([]);
    const features = this.allFeatures || [];
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
    if (count === 0 || !bounds.isValid() || !this.map) return;

    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    if (ne.equals(sw) || (Math.abs(ne.lat - sw.lat) < 0.00002 && Math.abs(ne.lng - sw.lng) < 0.00002)) {
      this.map.flyTo([ne.lat, ne.lng], Math.max(this.map.getZoom(), 17), { duration: 0.6 });
    } else {
      this.map.fitBounds(bounds, { padding: [60, 60], maxZoom: 18, animate: true });
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
    // Se o polígono vier fechado (primeiro ponto igual ao último), remove o último duplicado para a fórmula Shoelace
    let pts = coords;
    if (coords.length > 3) {
      const first = coords[0];
      const last = coords[coords.length - 1];
      if (first && last && Math.abs(first[0] - last[0]) < 1e-7 && Math.abs(first[1] - last[1]) < 1e-7) {
        pts = coords.slice(0, -1);
      }
    }
    if (pts.length < 3) return 0;

    const R = 6378137;
    let total = 0;
    const len = pts.length;
    for (let i = 0; i < len; i++) {
      const lower = pts[i];
      const middle = pts[(i + 1) % len];
      const upper = pts[(i + 2) % len];
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

  /**
   * Atualiza visualmente o destaque (highlight) das feições selecionadas instantaneamente
   * sem precisar redesenhar o mapa ou disparar eventos de zoom.
   * @param {Set<string>|Array<string>} prevSelectedIds
   * @param {Set<string>|Array<string>} newSelectedIds
   */
  refreshSelectionVisuals(prevSelectedIds, newSelectedIds) {
    const prevSet = prevSelectedIds instanceof Set ? prevSelectedIds : new Set(prevSelectedIds || []);
    const newSet = newSelectedIds instanceof Set ? newSelectedIds : new Set(newSelectedIds || []);

    // Identifica todos os IDs cujo estado de seleção mudou
    const changedIds = new Set();
    for (const id of prevSet) {
      if (!newSet.has(id)) changedIds.add(id);
    }
    for (const id of newSet) {
      if (!prevSet.has(id)) changedIds.add(id);
    }

    if (changedIds.size === 0) return;

    const bounds = this.map ? this.map.getBounds() : null;
    let pointClustersNeedRedraw = false;

    // Função interna para aplicar estilo em uma feição
    const applyVisual = (featId) => {
      const feat = this.featureMap.get(featId) || (this.allFeatures || []).find(f => f.id === featId);
      if (!feat) return;

      const layer = this.engine?.renderedFeatures?.get(featId);
      const isSelected = newSet.has(featId);

      const layerConfig = this.layerMap.get(feat.layerId) || { color: '#00E08A', opacity: 1, visible: true };
      const defaultColor = feat.color || layerConfig.color || '#00E08A';
      const layerOpacity = layerConfig.opacity !== undefined ? Number(layerConfig.opacity) : 1;
      const rawFillOpacity = feat.style?.fillOpacity !== undefined ? Number(feat.style.fillOpacity) : 0.35;
      const combinedFillOpacity = Math.max(0, Math.min(1, rawFillOpacity * layerOpacity));
      const strokeWidth = feat.style?.strokeWidth !== undefined ? Number(feat.style.strokeWidth) : 2.5;

      if (layer) {
        if (typeof layer.setStyle === 'function') {
          // L.Path (Polygon, Polyline, Circle, CircleMarker)
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
          // L.Marker (DOM SVG)
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

    // Salvaguarda de Performance para seleções massivas (>150 feições)
    const changedArr = Array.from(changedIds);
    if (changedArr.length > 150) {
      const insideBounds = [];
      const outsideBounds = [];

      for (const featId of changedArr) {
        const feat = this.featureMap.get(featId);
        if (feat && bounds && this._isFeatureInBounds(feat, bounds)) {
          insideBounds.push(featId);
        } else {
          outsideBounds.push(featId);
        }
      }

      for (const id of insideBounds) {
        applyVisual(id);
      }

      if (outsideBounds.length > 0) {
        let i = 0;
        const chunk = 100;
        const processChunk = () => {
          const limit = Math.min(i + chunk, outsideBounds.length);
          for (; i < limit; i++) {
            applyVisual(outsideBounds[i]);
          }
          if (i < outsideBounds.length) {
            requestAnimationFrame(processChunk);
          } else if (pointClustersNeedRedraw && this.clusterEngine) {
            this.clusterEngine.redraw();
          }
        };
        requestAnimationFrame(processChunk);
      }
    } else {
      for (const id of changedArr) {
        applyVisual(id);
      }
      if (pointClustersNeedRedraw && this.clusterEngine) {
        this.clusterEngine.redraw();
      }
    }
  }

  /**
   * Helper para checagem rápida de intersecção com a viewport
   */
  _isFeatureInBounds(feat, bounds) {
    if (!feat || !bounds) return true;
    if (feat.type === 'Point' && Array.isArray(feat.coordinates) && feat.coordinates.length >= 2) {
      return bounds.contains(L.latLng(feat.coordinates[0], feat.coordinates[1]));
    }
    return true;
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
