/* ==========================================================================
   ConecteMapas - FeatureGeometryUtils
   Cálculos geodésicos puros (área esférica com furos/multipolígonos, extensão Haversine,
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

  static formatLength(m) {
    return m > 1000 ? (m / 1000).toFixed(2) + ' km' : m.toFixed(1) + ' m';
  }

  /**
   * Atributos métricos derivados da geometria, gravados em feat.properties
   * (exibidos na tabela de atributos e exportados no DBF/GeoJSON).
   * @returns {Object} apenas as chaves aplicáveis ao tipo da feição
   */
  static computeMetricProperties(feat) {
    if (!feat) return {};
    if (feat.type === 'Polygon' && Array.isArray(feat.coordinates)) {
      const areaM2 = this.calculatePolygonArea(feat.coordinates);
      return {
        'Área (ha)': (areaM2 / 10000).toFixed(4) + ' ha',
        'Área (m²)': areaM2.toFixed(1) + ' m²',
        'Perímetro': this.formatLength(this.calculatePolygonPerimeter(feat.coordinates))
      };
    }
    if (feat.type === 'LineString' && Array.isArray(feat.coordinates)) {
      return { 'Extensão': this.formatLength(this.calculatePolylineLength(feat.coordinates)) };
    }
    if (feat.type === 'Circle' && feat.radius) {
      const r = Number(feat.radius);
      return {
        'Raio': `${r} m`,
        'Área Coberta': `${((Math.PI * r * r) / 10000).toFixed(4)} ha`
      };
    }
    return {};
  }

  /**
   * Profundidade de aninhamento das coordenadas:
   * 1 = ponto [lat,lng] | 2 = anel/linha [[lat,lng],...] |
   * 3 = polígono com furos / multilinha [[[lat,lng],...],...] | 4 = multipolígono
   */
  static coordinateDepth(coords) {
    let depth = 0;
    let node = coords;
    while (Array.isArray(node)) {
      depth++;
      node = node[0];
    }
    return depth;
  }

  /**
   * Polígonos como lista de anéis: [[externo, furo1, ...], ...] (sempre profundidade 4).
   */
  static toPolygonList(coords) {
    const depth = this.coordinateDepth(coords);
    if (depth === 2) return [[coords]];
    if (depth === 3) return [coords];
    if (depth === 4) return coords;
    return [];
  }

  /**
   * Lista os anéis/partes editáveis de uma linha ou polígono, com caminho de acesso.
   * Os pontos são devolvidos SEM o vértice de fechamento duplicado.
   * @returns {Array<{path: number[], label: string, points: Array, closed: boolean}>}
   */
  static getVertexRings(feat) {
    if (!feat || !Array.isArray(feat.coordinates)) return [];
    const isPoly = feat.type === 'Polygon';
    if (!isPoly && feat.type !== 'LineString') return [];
    const coords = feat.coordinates;
    const depth = this.coordinateDepth(coords);
    const make = (ring, path, label) => {
      const opened = isPoly ? this.openRing(ring) : ring;
      return { path, label, points: opened, closed: isPoly && opened.length !== ring.length };
    };
    if (depth === 2) return [make(coords, [], isPoly ? 'Anel externo' : 'Linha')];
    if (depth === 3) {
      return coords.map((ring, ri) => make(ring, [ri], isPoly ? (ri === 0 ? 'Anel externo' : `Furo ${ri}`) : `Parte ${ri + 1}`));
    }
    if (depth === 4 && isPoly) {
      const out = [];
      coords.forEach((poly, pi) => poly.forEach((ring, ri) => {
        out.push(make(ring, [pi, ri], `Parte ${pi + 1} · ${ri === 0 ? 'externo' : `furo ${ri}`}`));
      }));
      return out;
    }
    return [];
  }

  /** Total de vértices distintos (sem os pontos de fechamento duplicados). */
  static countVertices(feat) {
    if (feat && (feat.type === 'Point' || feat.type === 'Text' || feat.type === 'Circle')) return 1;
    return this.getVertexRings(feat).reduce((sum, r) => sum + r.points.length, 0);
  }

  /**
   * Devolve coordenadas novas com um anel substituído (mantendo o fechamento original).
   * @param {Array} coords coordenadas originais (não são alteradas)
   * @param {number[]} path caminho do anel retornado por getVertexRings
   * @param {Array} newOpenPoints pontos do anel sem fechamento
   * @param {boolean} closed se o anel original era fechado
   */
  static replaceRing(coords, path, newOpenPoints, closed) {
    const ring = closed && newOpenPoints.length > 0 ? [...newOpenPoints, [...newOpenPoints[0]]] : newOpenPoints;
    const clone = JSON.parse(JSON.stringify(coords));
    if (path.length === 0) return ring;
    if (path.length === 1) {
      clone[path[0]] = ring;
      return clone;
    }
    clone[path[0]][path[1]] = ring;
    return clone;
  }

  /** Remove o vértice de fechamento duplicado de um anel (primeiro == último). */
  static openRing(ring) {
    if (!Array.isArray(ring) || ring.length < 2) return ring || [];
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first && last && Math.abs(first[0] - last[0]) < 1e-9 && Math.abs(first[1] - last[1]) < 1e-9) {
      return ring.slice(0, -1);
    }
    return ring;
  }

  /**
   * Perímetro de polígono: soma de todos os anéis (externos e furos), incluindo o lado de fechamento.
   */
  static calculatePolygonPerimeter(coords) {
    if (!Array.isArray(coords) || coords.length === 0) return 0;
    const ringLength = (ring) => {
      const pts = this.openRing(ring);
      if (pts.length < 2) return 0;
      return this.calculateSinglePolylineLength(pts) + this.calculateDistance(pts[pts.length - 1], pts[0]);
    };
    return this.toPolygonList(coords).reduce(
      (sum, poly) => sum + poly.reduce((s, ring) => s + ringLength(ring), 0),
      0
    );
  }

  static normalizeCoordinates(feat) {
    if (!feat || !feat.coordinates) return null;
    let coords = feat.coordinates;

    const toLatLng = (pt) => {
      if (!pt) return null;
      let lat = null, lng = null;
      if (Array.isArray(pt) && pt.length >= 2) {
        lat = Number(pt[0]);
        lng = Number(pt[1]);
      } else if (typeof pt === 'object') {
        lat = Number(pt.lat ?? pt.latitude);
        lng = Number(pt.lng ?? pt.longitude);
      }
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return [lat, lng];
      }
      return null;
    };

    if (feat.type === 'Point' || feat.type === 'Text' || feat.type === 'Circle') {
      return toLatLng(coords);
    }

    if ((feat.type === 'Polygon' || feat.type === 'LineString') && Array.isArray(coords)) {
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
        const mapped = coords.map(ring => {
          if (!Array.isArray(ring)) return [];
          const validRing = ring.map(toLatLng).filter(Boolean);
          return feat.type === 'Polygon' ? openRing(validRing) : validRing;
        }).filter(r => r.length >= (feat.type === 'Polygon' ? 3 : 2));
        return mapped.length > 0 ? mapped : null;
      } else {
        const mapped = coords.map(toLatLng).filter(Boolean);
        const processed = feat.type === 'Polygon' ? openRing(mapped) : mapped;
        const minPoints = feat.type === 'Polygon' ? 3 : 2;
        return processed.length >= minPoints ? processed : null;
      }
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

  /**
   * Área geodésica em m² (aproximação esférica, mesmo método do geojson-area / Leaflet.draw).
   * Furos são subtraídos e multipolígonos somados.
   */
  static calculatePolygonArea(coords) {
    if (!Array.isArray(coords) || coords.length === 0) return 0;
    let total = 0;
    for (const poly of this.toPolygonList(coords)) {
      if (!Array.isArray(poly) || poly.length === 0) continue;
      const outer = this.calculateSinglePolygonArea(poly[0]);
      const holes = poly.slice(1).reduce((sum, ring) => sum + this.calculateSinglePolygonArea(ring), 0);
      total += Math.max(0, outer - holes);
    }
    return total;
  }

  /**
   * Área de um único anel [[lat,lng],...] (aberto ou fechado).
   * Σ (λ[i+1] − λ[i−1]) · sen(φ[i]) · R² / 2, com R² = M·N (raio gaussiano do
   * elipsoide WGS84/SIRGAS 2000 na latitude média do anel). Para lotes e glebas o
   * resultado acompanha a área elipsoidal do QGIS com erro bem abaixo de 0,1%.
   */
  static calculateSinglePolygonArea(ring) {
    const pts = this.openRing(ring);
    const len = pts.length;
    if (len < 3) return 0;
    const rad = Math.PI / 180;
    let total = 0;
    let latSum = 0;
    for (let i = 0; i < len; i++) {
      const prev = pts[(i - 1 + len) % len];
      const curr = pts[i];
      const next = pts[(i + 1) % len];
      total += (next[1] - prev[1]) * rad * Math.sin(curr[0] * rad);
      latSum += curr[0];
    }
    const area = Math.abs(total * this._gaussianRadiusSquared(latSum / len) / 2);
    return Number.isFinite(area) ? area : 0;
  }

  /** M·N do elipsoide GRS80/WGS84 na latitude informada (graus). */
  static _gaussianRadiusSquared(latDeg) {
    const a = 6378137;
    const e2 = 0.00669438002290;
    const sinLat = Math.sin(latDeg * Math.PI / 180);
    const w = 1 - e2 * sinLat * sinLat;
    const N = a / Math.sqrt(w);
    const M = a * (1 - e2) / Math.pow(w, 1.5);
    return M * N;
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
