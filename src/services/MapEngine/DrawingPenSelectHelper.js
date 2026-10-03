/* ==========================================================================
   ConecteMapas - DrawingPenSelectHelper
   Algoritmo Ray-Casting e seleção espacial de feições por lasso poligonal.
   ========================================================================== */

export class DrawingPenSelectHelper {
  static isPointInside(pt, vs) {
    if (!pt || !Array.isArray(pt) || pt.length < 2) return false;
    const x = pt[1], y = pt[0];
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
      const xi = vs[i][1], yi = vs[i][0];
      const xj = vs[j][1], yj = vs[j][0];
      const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  static processPenSelection(polyCoords, allFeatures = [], layerMap = new Map()) {
    const selectedIds = [];

    allFeatures.forEach(feat => {
      if (!feat || !feat.coordinates || feat.visible === false) return;
      const layerConfig = layerMap.get(feat.layerId);
      if (layerConfig && layerConfig.visible === false) return;

      if (feat.type === 'Point' || feat.type === 'Circle') {
        const pt = Array.isArray(feat.coordinates) 
          ? feat.coordinates 
          : [feat.coordinates.lat ?? feat.coordinates.latitude, feat.coordinates.lng ?? feat.coordinates.longitude];
        if (this.isPointInside(pt, polyCoords)) {
          selectedIds.push(feat.id);
        }
      } else if ((feat.type === 'LineString' || feat.type === 'Polygon') && Array.isArray(feat.coordinates)) {
        const coordsList = feat.type === 'Polygon'
          ? (Array.isArray(feat.coordinates[0]) && Array.isArray(feat.coordinates[0][0]) ? feat.coordinates[0] : feat.coordinates)
          : feat.coordinates;

        const normalizedCoords = coordsList.map(c => {
          if (Array.isArray(c)) return c;
          if (c && typeof c === 'object') return [c.lat ?? c.latitude, c.lng ?? c.longitude];
          return null;
        }).filter(Boolean);

        const temPontoDentro = normalizedCoords.some(c => this.isPointInside(c, polyCoords));

        let centroDentro = false;
        if (feat.type === 'Polygon' && normalizedCoords.length >= 3) {
          let cLat = 0, cLng = 0;
          for (const c of normalizedCoords) {
            cLat += c[0];
            cLng += c[1];
          }
          const centroid = [cLat / normalizedCoords.length, cLng / normalizedCoords.length];
          centroDentro = this.isPointInside(centroid, polyCoords);
        }

        if (temPontoDentro || centroDentro) {
          selectedIds.push(feat.id);
        }
      }
    });

    return selectedIds;
  }
}
