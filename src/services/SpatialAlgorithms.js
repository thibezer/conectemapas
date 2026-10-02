/* ==========================================================================
   ConecteMapas - SpatialAlgorithms Service (SRP Module)
   Algoritmos Geodésicos e Topográficos:
   - Simplificação Douglas-Peucker com Salvaguarda Topológica
   - Buffer Paramétrico (Pontos, Linhas e Polígonos)
   - Conversor de Unidades Agrárias e Geodésicas
   - Conversor de Coordenadas DD <-> DMS
   - Duplicação Geodésica com Offset
   ========================================================================== */

export class SpatialAlgorithms {
  /**
   * Converte metros em aproximação de graus de latitude
   */
  static metersToDegreesLat(meters) {
    return meters / 111139;
  }

  /**
   * Converte metros em aproximação de graus de longitude na latitude dada
   */
  static metersToDegreesLng(meters, lat) {
    const rad = (lat * Math.PI) / 180;
    const cosLat = Math.cos(rad);
    return meters / (111139 * (cosLat === 0 ? 0.0001 : cosLat));
  }

  /**
   * Distância euclidiana em metros entre dois pontos geodésicos
   */
  static pointDistance(p1, p2) {
    const R = 6371000;
    const dLat = ((p2[0] - p1[0]) * Math.PI) / 180;
    const dLon = ((p2[1] - p1[1]) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((p1[0] * Math.PI) / 180) *
        Math.cos((p2[0] * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /**
   * Distância de um ponto P a um segmento de reta AB (em metros)
   */
  static perpendicularDistance(p, a, b) {
    const distAB = this.pointDistance(a, b);
    if (distAB === 0) return this.pointDistance(p, a);

    // Projeção em coordenadas métricas locais
    const latM = 111139;
    const lngM = 111139 * Math.cos((a[0] * Math.PI) / 180);

    const px = (p[1] - a[1]) * lngM;
    const py = (p[0] - a[0]) * latM;
    const bx = (b[1] - a[1]) * lngM;
    const by = (b[0] - a[0]) * latM;

    const t = Math.max(0, Math.min(1, (px * bx + py * by) / (bx * bx + by * by)));
    const projX = t * bx;
    const projY = t * by;

    const dx = px - projX;
    const dy = py - projY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Algoritmo de Douglas-Peucker com salvaguarda de anel mínimo
   * @param {Array<[number, number]>} coords Lista de pontos [lat, lng]
   * @param {number} toleranceMeters Tolerância em metros (ex: 5m, 10m)
   * @param {boolean} isPolygon Se é polígono fechado
   * @returns {Array<[number, number]>}
   */
  /**
   * Algoritmo de Douglas-Peucker com salvaguarda de anel mínimo
   * @param {Array} coords Lista de pontos [lat, lng] ou múltiplos anéis
   * @param {number} toleranceMeters Tolerância em metros (ex: 5m, 10m)
   * @param {boolean} isPolygon Se é polígono fechado
   * @returns {Array}
   */
  static simplifyDouglasPeucker(coords, toleranceMeters = 5, isPolygon = false) {
    if (!Array.isArray(coords) || coords.length === 0) {
      return coords;
    }

    // Se for MultiPolygon / Multi-anéis, simplifica cada anel individualmente
    if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
      return coords.map(ring => this.simplifyDouglasPeucker(ring, toleranceMeters, isPolygon));
    }

    if (coords.length <= (isPolygon ? 3 : 2)) {
      return coords;
    }

    const minNodes = isPolygon ? 3 : 2;

    const dpRecursive = (points, epsilon) => {
      if (points.length <= 2) return points;

      let maxDist = 0;
      let index = 0;
      const end = points.length - 1;

      for (let i = 1; i < end; i++) {
        const d = this.perpendicularDistance(points[i], points[0], points[end]);
        if (d > maxDist) {
          index = i;
          maxDist = d;
        }
      }

      if (maxDist > epsilon) {
        const recResults1 = dpRecursive(points.slice(0, index + 1), epsilon);
        const recResults2 = dpRecursive(points.slice(index), epsilon);
        return recResults1.slice(0, recResults1.length - 1).concat(recResults2);
      } else {
        return [points[0], points[end]];
      }
    };

    let result = dpRecursive(coords, toleranceMeters);

    // Salvaguarda: se a simplificação ficou abaixo do mínimo exigido pela topologia
    if (result.length < minNodes) {
      return coords.slice(0, minNodes);
    }

    return result;
  }

  /**
   * Gera Polígono de Buffer / Amortecimento Geodésico
   * @param {Object} feature Feição de origem
   * @param {number} radiusMeters Raio do buffer em metros
   * @returns {Object} Nova feição de buffer (Polygon ou Circle)
   */
  static generateBuffer(feature, radiusMeters = 50) {
    if (!feature) return null;
    const type = feature.type;
    const targetLayerId = feature.layerId || 'layer-topografia';

    if (type === 'Point') {
      // Gera círculo com o raio especificado
      return {
        id: `feat-buffer-${Date.now()}`,
        name: `Buffer ${feature.name} (${radiusMeters}m)`,
        layerId: targetLayerId,
        type: 'Circle',
        coordinates: [feature.coordinates[0], feature.coordinates[1]],
        radius: radiusMeters,
        category: 'Zona de Amortecimento',
        color: '#38bdf8',
        style: {
          fillColor: '#38bdf8',
          fillOpacity: 0.25,
          strokeColor: '#0284c7',
          strokeWidth: 2,
          strokeDashArray: '4, 4',
          markerIcon: 'pin',
          markerSize: 24,
          markerRotation: 0,
          showLabel: true,
          labelField: 'name'
        },
        properties: {
          'Raio do Buffer': `${radiusMeters} m`,
          'Elemento Origem': feature.name
        },
        createdBy: 'Buffer Espacial',
        createdAt: new Date().toISOString()
      };
    }

    // Para Linhas e Polígonos: expande a envoltória geodésica
    const coords = feature.coordinates;
    const isMulti = Array.isArray(coords[0]) && Array.isArray(coords[0][0]);
    const flatPoints = isMulti ? coords.flat() : coords;

    let bufferPoints = [];

    if ((type === 'Polygon' || type === 'LineString') && flatPoints.length > 0) {
      const centerLat = flatPoints.reduce((acc, c) => acc + c[0], 0) / flatPoints.length;
      const centerLng = flatPoints.reduce((acc, c) => acc + c[1], 0) / flatPoints.length;

      const dLat = this.metersToDegreesLat(radiusMeters);
      const dLng = this.metersToDegreesLng(radiusMeters, centerLat);

      const offsetRing = (ring) => ring.map(([lat, lng]) => {
        const dirLat = lat - centerLat;
        const dirLng = lng - centerLng;
        const len = Math.sqrt(dirLat * dirLat + dirLng * dirLng) || 1;
        const normLat = dirLat / len;
        const normLng = dirLng / len;
        return [lat + normLat * dLat, lng + normLng * dLng];
      });

      if (isMulti) {
        bufferPoints = coords.map(ring => offsetRing(ring));
      } else {
        bufferPoints = offsetRing(coords);
      }
    }

    return {
      id: `feat-buffer-${Date.now()}`,
      name: `Buffer ${feature.name} (${radiusMeters}m)`,
      layerId: targetLayerId,
      type: 'Polygon',
      coordinates: bufferPoints.length > 0 ? bufferPoints : coords,
      category: 'Zona de Amortecimento',
      color: '#38bdf8',
      style: {
        fillColor: '#38bdf8',
        fillOpacity: 0.25,
        strokeColor: '#0284c7',
        strokeWidth: 2,
        strokeDashArray: '4, 4',
        markerIcon: 'pin',
        markerSize: 24,
        markerRotation: 0,
        showLabel: true,
        labelField: 'name'
      },
      properties: {
        'Raio do Buffer': `${radiusMeters} m`,
        'Elemento Origem': feature.name
      },
      createdBy: 'Buffer Espacial',
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Clona uma feição aplicando um deslocamento (offset) geodésico
   * @param {Object} feature
   * @param {number} offsetMeters
   */
  static duplicateWithOffset(feature, offsetMeters = 30) {
    if (!feature) return null;

    let refLat = 0;
    if (feature.type === 'Point' || feature.type === 'Circle') {
      refLat = feature.coordinates[0];
    } else if (Array.isArray(feature.coordinates) && feature.coordinates[0]) {
      const isMulti = Array.isArray(feature.coordinates[0]) && Array.isArray(feature.coordinates[0][0]);
      refLat = isMulti ? feature.coordinates[0][0][0] : feature.coordinates[0][0];
    }

    const dLat = this.metersToDegreesLat(offsetMeters);
    const dLng = this.metersToDegreesLng(offsetMeters, refLat);

    let newCoordinates;
    if (feature.type === 'Point' || feature.type === 'Circle') {
      newCoordinates = [feature.coordinates[0] + dLat, feature.coordinates[1] + dLng];
    } else if (Array.isArray(feature.coordinates)) {
      const isMulti = Array.isArray(feature.coordinates[0]) && Array.isArray(feature.coordinates[0][0]);
      if (isMulti) {
        newCoordinates = feature.coordinates.map(ring => ring.map(([lat, lng]) => [lat + dLat, lng + dLng]));
      } else {
        newCoordinates = feature.coordinates.map(([lat, lng]) => [lat + dLat, lng + dLng]);
      }
    }

    return {
      ...JSON.parse(JSON.stringify(feature)),
      id: `feat-clone-${Date.now()}`,
      name: `${feature.name} (Cópia)`,
      coordinates: newCoordinates,
      createdAt: new Date().toISOString(),
      createdBy: 'Duplicação'
    };
  }

  /**
   * Conversor de Áreas Agrárias e Métricas
   * @param {number} m2 Área em metros quadrados
   */
  static convertArea(m2) {
    const safeM2 = Math.max(0, Number(m2) || 0);
    return {
      m2: safeM2.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' m²',
      ha: (safeM2 / 10000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + ' ha',
      alqueirePaulista: (safeM2 / 24200).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 }) + ' alq. (SP)',
      alqueireMineiro: (safeM2 / 48400).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 }) + ' alq. (MG/GO)',
      alqueireBaiano: (safeM2 / 96800).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 }) + ' alq. (BA)',
      acres: (safeM2 / 4046.86).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 }) + ' ac'
    };
  }

  /**
   * Conversor de Extensões Lineares
   * @param {number} meters Comprimento em metros
   */
  static convertLength(meters) {
    const safeM = Math.max(0, Number(meters) || 0);
    return {
      meters: safeM.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' m',
      km: (safeM / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + ' km',
      miles: (safeM / 1609.344).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 }) + ' mi',
      feet: (safeM * 3.28084).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' ft'
    };
  }

  /**
   * Converte Decimal Degrees (DD) para Graus, Minutos e Segundos (DMS)
   * @param {number} dd
   * @param {boolean} isLat
   */
  static ddToDms(dd, isLat = true) {
    if (isNaN(dd)) return '-';
    const direction = isLat ? (dd >= 0 ? 'N' : 'S') : (dd >= 0 ? 'E' : 'W');
    const abs = Math.abs(dd);
    const deg = Math.floor(abs);
    const minFloat = (abs - deg) * 60;
    const min = Math.floor(minFloat);
    const sec = ((minFloat - min) * 60).toFixed(2);
    return `${deg}° ${min}' ${sec}" ${direction}`;
  }

  /**
   * Converte Graus, Minutos e Segundos (DMS) para Decimal Degrees (DD)
   * Formato esperado: 15 47 39.12 S ou 15°47'39.12"S
   */
  static dmsToDd(dmsStr) {
    if (!dmsStr) return NaN;
    const clean = dmsStr.toUpperCase().replace(/[°'"]/g, ' ').trim();
    const parts = clean.split(/\s+/);
    if (parts.length < 3) return NaN;

    const deg = parseFloat(parts[0]);
    const min = parseFloat(parts[1]);
    const sec = parseFloat(parts[2]);
    const dir = parts[3] || parts[2].slice(-1);

    let dd = deg + min / 60 + sec / 3600;
    if (dir === 'S' || dir === 'W' || dir === 'O') {
      dd = -dd;
    }
    return dd;
  }

  /**
   * Testa se um segmento de reta (lat1, lng1) -> (lat2, lng2) intersecta ou está contido em uma caixa delimitadora.
   * Algoritmo paramétrico Liang-Barsky (precisão exata O(1)).
   */
  static segmentIntersectsBox(lat1, lng1, lat2, lng2, south, north, west, east) {
    // 1. Se qualquer vértice estiver dentro da caixa
    if ((lat1 >= south && lat1 <= north && lng1 >= west && lng1 <= east) ||
        (lat2 >= south && lat2 <= north && lng2 >= west && lng2 <= east)) {
      return true;
    }

    // 2. Rejeição rápida se ambos os vértices estiverem inteiramente de um mesmo lado externo
    if ((lat1 < south && lat2 < south) ||
        (lat1 > north && lat2 > north) ||
        (lng1 < west && lng2 < west) ||
        (lng1 > east && lng2 > east)) {
      return false;
    }

    // 3. Recorte paramétrico Liang-Barsky
    const dLng = lng2 - lng1;
    const dLat = lat2 - lat1;
    const p = [-dLng, dLng, -dLat, dLat];
    const q = [lng1 - west, east - lng1, lat1 - south, north - lat1];

    let u1 = 0;
    let u2 = 1;

    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) {
        if (q[i] < 0) return false;
      } else {
        const t = q[i] / p[i];
        if (p[i] < 0) {
          if (t > u2) return false;
          if (t > u1) u1 = t;
        } else {
          if (t < u1) return false;
          if (t < u2) u2 = t;
        }
      }
    }

    return u1 <= u2;
  }

  /**
   * Testa se um ponto [lat, lng] está contido em um anel de polígono (Ray Casting / Jordan Curve)
   */
  static isPointInPolygon(point, ring) {
    if (!point || !Array.isArray(ring) || ring.length < 3) return false;
    const y = point[0], x = point[1];
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const ptI = ring[i];
      const ptJ = ring[j];
      if (!ptI || !ptJ) continue;
      const yi = ptI[0], xi = ptI[1];
      const yj = ptJ[0], xj = ptJ[1];
      const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * Testa interseção geométrica exata (Narrow-Phase) entre uma feição e um LatLngBounds
   * Impede falsos positivos causados pelo Axis-Aligned Bounding Box (AABB).
   * @param {Object} feat Feição a ser testada
   * @param {Object} bounds LatLngBounds
   * @param {Object} [map] Instância Leaflet (opcional para teste de tolerância visual de marcadores)
   * @param {Object} [pixelBox] { minX, minY, maxX, maxY } (opcional)
   * @returns {boolean}
   */
  static featureIntersectsBounds(feat, bounds, map = null, pixelBox = null) {
    if (!feat || !bounds) return false;

    const south = typeof bounds.getSouth === 'function' ? bounds.getSouth() : (bounds.minLat ?? bounds.south);
    const north = typeof bounds.getNorth === 'function' ? bounds.getNorth() : (bounds.maxLat ?? bounds.north);
    const west = typeof bounds.getWest === 'function' ? bounds.getWest() : (bounds.minLng ?? bounds.west);
    const east = typeof bounds.getEast === 'function' ? bounds.getEast() : (bounds.maxLng ?? bounds.east);

    const type = feat.type || feat.geometry?.type || 'Point';
    const coords = feat.coordinates || feat.geometry?.coordinates;
    if (!coords) return false;

    const getPointLatLng = (c) => {
      if (!c) return null;
      if (Array.isArray(c) && c.length >= 2) return [Number(c[0]), Number(c[1])];
      if (typeof c === 'object') return [Number(c.lat ?? c.latitude), Number(c.lng ?? c.longitude)];
      return null;
    };

    if (type === 'Point' || type === 'Text') {
      const pt = getPointLatLng(coords);
      if (!pt || isNaN(pt[0]) || isNaN(pt[1])) return false;

      // 1. Verificação geográfica direta
      if (pt[0] >= south && pt[0] <= north && pt[1] >= west && pt[1] <= east) {
        return true;
      }

      // 2. Se a caixa na tela tocar o ícone visual do marcador
      if (map && pixelBox && typeof map.latLngToContainerPoint === 'function') {
        try {
          const screenPt = map.latLngToContainerPoint(pt);
          const iconSize = feat.style?.markerSize ? Number(feat.style.markerSize) : 24;
          const radius = Math.max(6, iconSize / 2);
          const iconTouchesBox = !(
            screenPt.x + radius < pixelBox.minX ||
            screenPt.x - radius > pixelBox.maxX ||
            screenPt.y + radius < pixelBox.minY ||
            screenPt.y - radius > pixelBox.maxY
          );
          if (iconTouchesBox) return true;
        } catch (_) {}
      }

      return false;
    }

    if (type === 'Circle') {
      const center = getPointLatLng(coords);
      if (!center || isNaN(center[0]) || isNaN(center[1])) return false;
      const radiusMeters = Number(feat.radius) || 500;

      // Ponto na caixa mais próximo do centro do círculo
      const closestLat = Math.max(south, Math.min(north, center[0]));
      const closestLng = Math.max(west, Math.min(east, center[1]));
      const dist = this.pointDistance(center, [closestLat, closestLng]);

      return dist <= radiusMeters;
    }

    if (type === 'LineString' && Array.isArray(coords)) {
      const lines = (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) ? coords : [coords];

      for (const line of lines) {
        if (!Array.isArray(line) || line.length < 2) continue;
        for (let i = 0; i < line.length - 1; i++) {
          const p1 = getPointLatLng(line[i]);
          const p2 = getPointLatLng(line[i + 1]);
          if (!p1 || !p2) continue;
          if (p1[0] === p2[0] && p1[1] === p2[1]) continue;
          if (this.segmentIntersectsBox(p1[0], p1[1], p2[0], p2[1], south, north, west, east)) {
            return true;
          }
        }
      }
      return false;
    }

    if (type === 'Polygon' && Array.isArray(coords)) {
      let rings = [];
      if (Array.isArray(coords[0]) && Array.isArray(coords[0][0]) && Array.isArray(coords[0][0][0])) {
        rings = coords.flat(1);
      } else if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
        rings = coords;
      } else {
        rings = [coords];
      }

      const boxCenter = [(south + north) / 2, (west + east) / 2];

      for (const rawRing of rings) {
        if (!Array.isArray(rawRing) || rawRing.length < 3) continue;
        const ring = rawRing.map(getPointLatLng).filter(Boolean);
        if (ring.length < 3) continue;

        // 1. Algum vértice do polígono está dentro da caixa de seleção?
        for (const pt of ring) {
          if (pt[0] >= south && pt[0] <= north && pt[1] >= west && pt[1] <= east) {
            return true;
          }
        }

        // 2. Alguma aresta do polígono cruza as bordas da caixa de seleção?
        for (let i = 0; i < ring.length; i++) {
          const next = (i + 1) % ring.length;
          const p1 = ring[i];
          const p2 = ring[next];
          if (p1[0] === p2[0] && p1[1] === p2[1]) continue;
          if (this.segmentIntersectsBox(p1[0], p1[1], p2[0], p2[1], south, north, west, east)) {
            return true;
          }
        }

        // 3. A caixa de seleção está inteiramente contida dentro do anel do polígono?
        if (this.isPointInPolygon(boxCenter, ring)) {
          return true;
        }
      }

      return false;
    }

    return false;
  }
}

