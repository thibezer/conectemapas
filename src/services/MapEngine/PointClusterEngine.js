/* ==========================================================================
   ConecteMapas - PointClusterEngine
   Responsabilidade Única: Agrupamento dinâmico (Marker Clustering) de geometrias
   pontuais com base em escala de zoom e distância de colisão em pixels na tela.
   Elimina sobrecarga visual e saturação em mapas de grande e média escala.
   ========================================================================== */

import L from 'leaflet';

export class PointClusterEngine {
  constructor(options = {}) {
    this.gridSize = options.gridSize || 55; // Raio de agrupamento em pixels de tela
    this.maxClusterZoom = options.maxClusterZoom || 17; // A partir do zoom 17, desmembra em pontos individuais
  }

  /**
   * Agrupa feições pontuais visíveis para a escala atual do mapa
   * @param {Array} pointFeatures Lista de feições do tipo 'Point'
   * @param {L.Map} map Instância do mapa Leaflet
   * @returns {{ clusters: Array, singles: Array }}
   */
  computeClusters(pointFeatures, map) {
    if (!map || !Array.isArray(pointFeatures) || pointFeatures.length === 0) {
      return { clusters: [], singles: [] };
    }

    const zoom = map.getZoom();

    // Se o zoom for muito próximo (nível de lote/parcela) ou poucos pontos, exibe todos individuais
    if (zoom >= this.maxClusterZoom || pointFeatures.length <= 8) {
      return { clusters: [], singles: pointFeatures };
    }

    const clustersMap = new Map();
    const cellPixelSize = this.gridSize;

    for (let i = 0; i < pointFeatures.length; i++) {
      const feat = pointFeatures[i];
      let lat = null;
      let lng = null;

      if (Array.isArray(feat.coordinates)) {
        lat = Number(feat.coordinates[0]);
        lng = Number(feat.coordinates[1]);
      } else if (feat.coordinates && typeof feat.coordinates === 'object') {
        lat = Number(feat.coordinates.lat);
        lng = Number(feat.coordinates.lng);
      }

      if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) continue;

      // Projeta para pixels da camada no nível de zoom atual
      const pointPx = map.latLngToLayerPoint([lat, lng]);
      const cellX = Math.floor(pointPx.x / cellPixelSize);
      const cellY = Math.floor(pointPx.y / cellPixelSize);
      const cellKey = `${cellX}_${cellY}`;

      let cluster = clustersMap.get(cellKey);
      if (!cluster) {
        cluster = {
          id: `cluster-${cellKey}`,
          cellX,
          cellY,
          features: [feat],
          sumLat: lat,
          sumLng: lng,
          minLat: lat,
          maxLat: lat,
          minLng: lng,
          maxLng: lng,
          primaryColor: feat.color || feat.style?.fillColor || '#00E08A'
        };
        clustersMap.set(cellKey, cluster);
      } else {
        cluster.features.push(feat);
        cluster.sumLat += lat;
        cluster.sumLng += lng;
        if (lat < cluster.minLat) cluster.minLat = lat;
        if (lat > cluster.maxLat) cluster.maxLat = lat;
        if (lng < cluster.minLng) cluster.minLng = lng;
        if (lng > cluster.maxLng) cluster.maxLng = lng;
      }
    }

    const clusters = [];
    const singles = [];

    clustersMap.forEach((c) => {
      const count = c.features.length;
      if (count === 1) {
        singles.push(c.features[0]);
      } else {
        const centerLat = c.sumLat / count;
        const centerLng = c.sumLng / count;
        const bounds = L.latLngBounds([c.minLat, c.minLng], [c.maxLat, c.maxLng]);

        clusters.push({
          id: c.id,
          count,
          center: [centerLat, centerLng],
          bounds,
          features: c.features,
          color: c.primaryColor
        });
      }
    });

    return { clusters, singles };
  }

  /**
   * Gera o DivIcon HTML estilizado para o marcador de Cluster
   */
  createClusterIcon(cluster) {
    const count = cluster.count;
    let sizeClass = 'small';
    let sizePx = 34;

    if (count >= 100) {
      sizeClass = 'large';
      sizePx = 48;
    } else if (count >= 10) {
      sizeClass = 'medium';
      sizePx = 40;
    }

    const displayCount = count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count;
    const color = cluster.color || '#00E08A';

    const html = `
      <div class="cm-cluster-marker ${sizeClass}" style="--cluster-color: ${color};">
        <div class="cm-cluster-halo"></div>
        <div class="cm-cluster-core">
          <span class="cm-cluster-count">${displayCount}</span>
        </div>
      </div>
    `;

    return L.divIcon({
      className: 'cm-cluster-div-icon',
      html,
      iconSize: [sizePx, sizePx],
      iconAnchor: [sizePx / 2, sizePx / 2]
    });
  }
}
