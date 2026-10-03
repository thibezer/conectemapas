/* ==========================================================================
   ConecteMapas - FeatureGeometryUtils
   Cálculos geodésicos puros (área Shoelace esferoidal, extensão Haversine,
   azimute/bearing, segmentos) e normalização de coordenadas Leaflet.
   ========================================================================== */

export class FeatureGeometryUtils {
  static escapeHtml(str) {
    if (typeof str !== 'string') return str == null ? '' : String(str);
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  static getTypeLabel(type) {
    const labels = {
      Polygon: 'Polígono',
      LineString: 'Linha',
      Point: 'Ponto',
      Circle: 'Círculo',
      Text: 'Texto'
    };
    return labels[type] || type || 'Feição';
  }

  /**
   * Perímetro de polígono somando o fechamento de cada anel (anel aberto ou fechado).
   */
  static calculatePolygonPerimeter(coords) {
    if (!Array.isArray(coords) || coords.length === 0) return 0;
    const ringLength = (ring) => {
      if (!Array.isArray(ring) || ring.length < 2) return 0;
      let total = this.calculateSinglePolylineLength(ring);
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) total += this.calculateDistance(last, first);
      return total;
    };
    // Anel simples [[lat,lng],...] | anéis [[[lat,lng],...],...] | multipolígono (um nível a mais)
    if (!Array.isArray(coords[0][0])) return ringLength(coords);
    if (!Array.isArray(coords[0][0][0])) return ringLength(coords[0]);
    return coords.reduce((sum, poly) => sum + ringLength(poly[0]), 0);
  }

  static normalizeCoordinates(feat) {
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

  static calculateDistance(p1, p2) {
    const R = 6371000;
    const dLat = (p2[0] - p1[0]) * Math.PI / 180;
    const dLon = (p2[1] - p1[1]) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  static calculatePolylineLength(coordinates) {
    if (!Array.isArray(coordinates) || coordinates.length === 0) return 0;
    if (Array.isArray(coordinates[0]) && Array.isArray(coordinates[0][0])) {
      return coordinates.reduce((sum, line) => sum + this.calculateSinglePolylineLength(line), 0);
    }
    return this.calculateSinglePolylineLength(coordinates);
  }

  static calculateSinglePolylineLength(coordinates) {
    let total = 0;
    for (let i = 0; i < coordinates.length - 1; i++) {
      total += this.calculateDistance(coordinates[i], coordinates[i + 1]);
    }
    return total;
  }

  static calculatePolygonArea(coords) {
    if (!Array.isArray(coords) || coords.length === 0) return 0;
    if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
      return coords.reduce((sum, ring) => sum + this.calculateSinglePolygonArea(ring), 0);
    }
    return this.calculateSinglePolygonArea(coords);
  }

  static calculateSinglePolygonArea(coords) {
    if (!Array.isArray(coords) || coords.length < 3) return 0;
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

  static calculateBearing(p1, p2) {
    if (!p1 || !p2) return 0;
    const lat1 = p1[0] * Math.PI / 180;
    const lat2 = p2[0] * Math.PI / 180;
    const dLon = (p2[1] - p1[1]) * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  static calculateSegments(coordinates, isClosed = false) {
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
