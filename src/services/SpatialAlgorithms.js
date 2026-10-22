/* ==========================================================================
   ConecteMapas - SpatialAlgorithms Service (SRP Module)
   Algoritmos Geodésicos e Topográficos:
   - Simplificação Douglas-Peucker com Salvaguarda Topológica
   - Buffer Paramétrico (Pontos, Linhas e Polígonos)
   - Conversor de Unidades Agrárias e Geodésicas
   - Conversor de Coordenadas DD <-> DMS
   - Duplicação Geodésica com Offset
   ========================================================================== */

import { Geodesy } from './Geodesy.js';

export class SpatialAlgorithms {
  /**
   * Converte metros em aproximação de graus de latitude
   */
  static metersToDegreesLat(meters, lat = null) {
    return meters / (lat === null ? 111139 : Geodesy.metersPerDegree(lat).lat);
  }

  /**
   * Converte metros em aproximação de graus de longitude na latitude dada
   */
  static metersToDegreesLng(meters, lat) {
    return meters / Math.max(Geodesy.metersPerDegree(lat).lng, 1);
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
   * Gera Polígono de Buffer / Amortecimento Geodésico Rigoroso (Pontos, Círculos, Linhas e Polígonos).
   * Utiliza projeção tangencial métrica local (WGS84) e cálculo vetorial com caps e miter limit.
   *
   * @param {Object} feature Feição de origem
   * @param {number} radiusMeters Raio do buffer em metros (pode ser positivo para expansão ou negativo para retração)
   * @returns {Object|null} Nova feição de buffer (Polygon ou Circle)
   */
  static generateBuffer(feature, radiusMeters = 50) {
    if (!feature || !Number.isFinite(radiusMeters) || radiusMeters === 0) return null;
    const type = feature.type;
    const targetLayerId = feature.layerId || 'layer-topografia';
    const absRadius = Math.abs(radiusMeters);
    const radiusStr = `${radiusMeters > 0 ? '+' : ''}${radiusMeters} m`;

    // 1. Ponto ou Texto -> Círculo geodésico
    if (type === 'Point' || type === 'Text') {
      const coord = Array.isArray(feature.coordinates) && Number.isFinite(feature.coordinates[0])
        ? [Number(feature.coordinates[0]), Number(feature.coordinates[1])]
        : null;
      if (!coord) return null;

      return {
        id: `feat-buffer-${Date.now()}`,
        name: `Buffer ${feature.name || 'Ponto'} (${absRadius}m)`,
        layerId: targetLayerId,
        type: 'Circle',
        coordinates: coord,
        radius: absRadius,
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
          'Raio do Buffer': `${absRadius} m`,
          'Elemento Origem': feature.name || 'Ponto'
        },
        createdBy: 'Buffer Espacial',
        createdAt: new Date().toISOString()
      };
    }

    // 2. Círculo -> Expansão de Círculo
    if (type === 'Circle') {
      const currentRadius = Number(feature.radius) || 0;
      const newRadius = Math.max(1, currentRadius + radiusMeters);
      const coord = Array.isArray(feature.coordinates) && Number.isFinite(feature.coordinates[0])
        ? [Number(feature.coordinates[0]), Number(feature.coordinates[1])]
        : null;
      if (!coord) return null;

      return {
        id: `feat-buffer-${Date.now()}`,
        name: `Buffer ${feature.name || 'Círculo'} (${radiusStr})`,
        layerId: targetLayerId,
        type: 'Circle',
        coordinates: coord,
        radius: newRadius,
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
          'Raio do Buffer': `${newRadius} m`,
          'Variação': radiusStr,
          'Elemento Origem': feature.name || 'Círculo'
        },
        createdBy: 'Buffer Espacial',
        createdAt: new Date().toISOString()
      };
    }

    // 3. Linhas e Polígonos -> Polígono com caps e miter limit
    const rawCoords = feature.coordinates;
    if (!Array.isArray(rawCoords) || rawCoords.length === 0) return null;

    const isMulti = Array.isArray(rawCoords[0]) && Array.isArray(rawCoords[0][0]);
    const inputRing = isMulti ? rawCoords[0] : rawCoords;
    if (!Array.isArray(inputRing) || inputRing.length < (type === 'Polygon' ? 3 : 2)) return null;

    const pts = [];
    for (const p of inputRing) {
      if (Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])) {
        if (pts.length > 0) {
          const prev = pts[pts.length - 1];
          if (Math.abs(prev[0] - p[0]) < 1e-9 && Math.abs(prev[1] - p[1]) < 1e-9) continue;
        }
        pts.push([Number(p[0]), Number(p[1])]);
      }
    }

    if (pts.length < (type === 'Polygon' ? 3 : 2)) return null;

    // Remove vértice de fechamento duplicado no polígono para cálculo vetorial
    if (type === 'Polygon' && pts.length >= 3) {
      const first = pts[0];
      const last = pts[pts.length - 1];
      if (Math.abs(first[0] - last[0]) < 1e-7 && Math.abs(first[1] - last[1]) < 1e-7) {
        pts.pop();
      }
    }

    if (pts.length < (type === 'Polygon' ? 3 : 2)) return null;

    // Plano métrico tangencial local no elipsoide GRS80: metros por grau reais (M e N) na latitude da origem
    const lat0 = pts[0][0];
    const lon0 = pts[0][1];
    const perDeg = Geodesy.metersPerDegree(lat0);

    const toMeters = ([lat, lng]) => [
      (lng - lon0) * perDeg.lng,
      (lat - lat0) * perDeg.lat
    ];

    const toLatLng = ([x, y]) => [
      lat0 + y / perDeg.lat,
      lon0 + x / perDeg.lng
    ];

    const ptsM = pts.map(toMeters);
    const d = radiusMeters;
    let bufferM = [];

    // Normal unitária perpendicular à esquerda do segmento [A -> B]
    const leftNormal = (p1, p2) => {
      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      const len = Math.hypot(dx, dy) || 1;
      return [-dy / len, dx / len];
    };

    // Arco semicircular entre angStart e angEnd
    const arcPoints = (center, r, angStart, angEnd, steps = 16) => {
      const res = [];
      for (let s = 0; s <= steps; s++) {
        const ang = angStart + ((angEnd - angStart) * s) / steps;
        res.push([center[0] + r * Math.cos(ang), center[1] + r * Math.sin(ang)]);
      }
      return res;
    };

    // Offset paralelo com miter limit
    const offsetPolyline = (points, dist, isClosed) => {
      const n = points.length;
      const out = [];
      for (let i = 0; i < n; i++) {
        const prev = isClosed ? points[(i - 1 + n) % n] : points[Math.max(0, i - 1)];
        const curr = points[i];
        const next = isClosed ? points[(i + 1) % n] : points[Math.min(n - 1, i + 1)];

        const nPrev = i === 0 && !isClosed ? leftNormal(curr, next) : leftNormal(prev, curr);
        const nNext = i === n - 1 && !isClosed ? leftNormal(prev, curr) : leftNormal(curr, next);

        let ux = nPrev[0] + nNext[0];
        let uy = nPrev[1] + nNext[1];
        const uLen = Math.hypot(ux, uy);

        if (uLen < 1e-9) {
          out.push([curr[0] + nPrev[0] * dist, curr[1] + nPrev[1] * dist]);
          continue;
        }

        ux /= uLen;
        uy /= uLen;
        const dot = ux * nPrev[0] + uy * nPrev[1];
        const miter = Math.min(1 / Math.max(dot, 0.5), 2.0);

        out.push([curr[0] + ux * dist * miter, curr[1] + uy * dist * miter]);
      }
      return out;
    };

    if (type === 'LineString') {
      if (ptsM.length < 2) return null;
      const dist = Math.abs(d);

      const leftSide = offsetPolyline(ptsM, dist, false);
      const reversedPts = [...ptsM].reverse();
      const rightSide = offsetPolyline(reversedPts, dist, false);

      const pLast = ptsM[ptsM.length - 1];
      const pPenult = ptsM[ptsM.length - 2];
      const angEnd = Math.atan2(pLast[1] - pPenult[1], pLast[0] - pPenult[0]);

      const pFirst = ptsM[0];
      const pSecond = ptsM[1];
      const angStart = Math.atan2(pFirst[1] - pSecond[1], pFirst[0] - pSecond[0]);

      const endCap = arcPoints(pLast, dist, angEnd + Math.PI / 2, angEnd - Math.PI / 2, 16);
      const startCap = arcPoints(pFirst, dist, angStart + Math.PI / 2, angStart - Math.PI / 2, 16);

      bufferM = [...leftSide, ...endCap, ...rightSide, ...startCap];
    } else if (type === 'Polygon') {
      if (ptsM.length < 3) return null;

      let area = 0;
      for (let i = 0; i < ptsM.length; i++) {
        const p1 = ptsM[i];
        const p2 = ptsM[(i + 1) % ptsM.length];
        area += (p2[0] - p1[0]) * (p2[1] + p1[1]);
      }
      const orientedPts = area > 0 ? ptsM : [...ptsM].reverse();
      bufferM = offsetPolyline(orientedPts, d, true);

      if (bufferM.length < 3) return null;
    }

    if (bufferM.length < 3) return null;

    const bufferLatLng = bufferM.map(toLatLng);

    // Garante fechamento do polígono
    const f0 = bufferLatLng[0];
    const flast = bufferLatLng[bufferLatLng.length - 1];
    if (Math.abs(f0[0] - flast[0]) > 1e-7 || Math.abs(f0[1] - flast[1]) > 1e-7) {
      bufferLatLng.push([f0[0], f0[1]]);
    }

    return {
      id: `feat-buffer-${Date.now()}`,
      name: `Buffer ${feature.name || 'Geometria'} (${absRadius}m)`,
      layerId: targetLayerId,
      type: 'Polygon',
      coordinates: bufferLatLng,
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
        'Raio do Buffer': `${absRadius} m`,
        'Elemento Origem': feature.name || 'Geometria'
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

    const dLat = this.metersToDegreesLat(offsetMeters, refLat);
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

  /**
   * Divide uma geometria poligonal em duas partes através de uma linha de corte (Split / Faca)
   * @param {Array<[number, number]>} polyCoords Coordenadas do anel externo do polígono [lat, lng]
   * @param {Array<[number, number]>} lineCoords Coordenadas da linha de corte [lat, lng]
   * @returns {{ success: boolean, polygons?: Array<Array<[number, number]>>, reason?: string }}
   */
  static splitPolygonWithLine(polyCoords, lineCoords) {
    if (!Array.isArray(polyCoords) || polyCoords.length < 3) {
      return { success: false, reason: 'Polígono inválido para divisão.' };
    }
    if (!Array.isArray(lineCoords) || lineCoords.length < 2) {
      return { success: false, reason: 'A linha de corte precisa conter pelo menos 2 pontos.' };
    }

    // Normaliza polígono (remove duplicata final se houver)
    const ring = polyCoords.map(p => Array.isArray(p) ? [p[0], p[1]] : [p.lat, p.lng]);
    if (ring.length > 3 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) {
      ring.pop();
    }
    if (ring.length < 3) {
      return { success: false, reason: 'Polígono com menos de 3 vértices válidos.' };
    }

    const n = ring.length;
    const intersections = [];

    // Interseção entre segmento P1P2 e segmento L1L2
    const getSegIntersection = (p1, p2, l1, l2) => {
      const x1 = p1[1], y1 = p1[0]; // lng, lat
      const x2 = p2[1], y2 = p2[0];
      const x3 = l1[1], y3 = l1[0];
      const x4 = l2[1], y4 = l2[0];

      const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
      if (Math.abs(denom) < 1e-12) return null;

      const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
      const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

      if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        return {
          point: [y1 + t * (y2 - y1), x1 + t * (x2 - x1)],
          t
        };
      }
      return null;
    };

    // Percorre cada aresta do polígono e verifica interseções com a linha de corte
    for (let i = 0; i < n; i++) {
      const p1 = ring[i];
      const p2 = ring[(i + 1) % n];

      for (let j = 0; j < lineCoords.length - 1; j++) {
        const l1 = lineCoords[j];
        const l2 = lineCoords[j + 1];

        const inter = getSegIntersection(p1, p2, l1, l2);
        if (inter) {
          intersections.push({
            edgeIndex: i,
            point: inter.point,
            t: inter.t,
            lineSegIndex: j
          });
        }
      }
    }

    if (intersections.length < 2) {
      return { 
        success: false, 
        reason: 'A linha de corte precisa cruzar o polígono de uma borda a outra (mínimo de 2 interseções).' 
      };
    }

    // Ordena interseções pela primeira ocorrência na aresta
    intersections.sort((a, b) => a.edgeIndex - b.edgeIndex || a.t - b.t);

    const int1 = intersections[0];
    const int2 = intersections[intersections.length - 1];

    if (int1.edgeIndex === int2.edgeIndex && Math.abs(int1.t - int2.t) < 1e-5) {
      return { success: false, reason: 'Interseções idênticas na mesma aresta.' };
    }

    // Monta o Polígono 1: int1 -> vértices entre edgeIndex1 e edgeIndex2 -> int2 -> int1
    const poly1 = [int1.point];
    let curr = (int1.edgeIndex + 1) % n;
    while (curr !== (int2.edgeIndex + 1) % n) {
      poly1.push(ring[curr]);
      curr = (curr + 1) % n;
    }
    poly1.push(int2.point);

    // Monta o Polígono 2: int2 -> vértices de edgeIndex2 até edgeIndex1 -> int1 -> int2
    const poly2 = [int2.point];
    curr = (int2.edgeIndex + 1) % n;
    while (curr !== (int1.edgeIndex + 1) % n) {
      poly2.push(ring[curr]);
      curr = (curr + 1) % n;
    }
    poly2.push(int1.point);

    const cleanRing = (pRing) => {
      const res = [];
      for (let i = 0; i < pRing.length; i++) {
        const pt = pRing[i];
        if (res.length === 0 || 
            Math.abs(res[res.length - 1][0] - pt[0]) > 1e-7 || 
            Math.abs(res[res.length - 1][1] - pt[1]) > 1e-7) {
          res.push(pt);
        }
      }
      return res;
    };

    const finalPoly1 = cleanRing(poly1);
    const finalPoly2 = cleanRing(poly2);

    if (finalPoly1.length < 3 || finalPoly2.length < 3) {
      return { success: false, reason: 'A divisão gerou polígonos degenerados.' };
    }

    return {
      success: true,
      polygons: [finalPoly1, finalPoly2]
    };
  }

  /**
   * Une duas linhas (LineString) conectando as pontas mais próximas
   * @param {Array<[number, number]>} coordsA
   * @param {Array<[number, number]>} coordsB
   * @returns {{ success: boolean, coordinates?: Array<[number, number]>, reason?: string }}
   */
  static joinLines(coordsA, coordsB) {
    if (!Array.isArray(coordsA) || coordsA.length < 2 || !Array.isArray(coordsB) || coordsB.length < 2) {
      return { success: false, reason: 'Linhas inválidas para junção.' };
    }

    const norm = (arr) => arr.map(p => Array.isArray(p) ? [p[0], p[1]] : [p.lat, p.lng]);
    const a = norm(coordsA);
    const b = norm(coordsB);

    const startA = a[0];
    const endA = a[a.length - 1];
    const startB = b[0];
    const endB = b[b.length - 1];

    const d1 = this.pointDistance(endA, startB); // A -> B
    const d2 = this.pointDistance(endA, endB);   // A -> reverse(B)
    const d3 = this.pointDistance(startA, endB); // B -> A
    const d4 = this.pointDistance(startA, startB); // reverse(A) -> B

    const minD = Math.min(d1, d2, d3, d4);
    let result = [];

    if (minD === d1) {
      result = [...a, ...b];
    } else if (minD === d2) {
      result = [...a, ...[...b].reverse()];
    } else if (minD === d3) {
      result = [...b, ...a];
    } else {
      result = [...[...a].reverse(), ...b];
    }

    const cleaned = [];
    for (const pt of result) {
      if (cleaned.length === 0 || this.pointDistance(cleaned[cleaned.length - 1], pt) > 0.05) {
        cleaned.push(pt);
      }
    }

    return {
      success: true,
      coordinates: cleaned
    };
  }

  /**
   * Une dois polígonos em um polígono único (ou MultiPolígono se desconexos).
   * Suporta:
   * - Arestas compartilhadas simples e múltiplas contíguas
   * - Nós em T (vértices colineares / subdivisão na aresta de contato)
   * - Sobreposição parcial (overlap)
   * - Tolerância geodésica configurável (metros)
   * @param {Array<[number, number]>} polyA
   * @param {Array<[number, number]>} polyB
   * @param {number} [tolerance=0.5] tolerância em metros
   * @returns {{ success: boolean, type: string, coordinates: Array, reason?: string }}
   */
  static joinPolygons(polyA, polyB, tolerance = 0.5) {
    if (!Array.isArray(polyA) || polyA.length < 3 || !Array.isArray(polyB) || polyB.length < 3) {
      return { success: false, reason: 'Polígonos inválidos para junção.' };
    }

    const norm = (ring) => {
      const res = ring.map(p => Array.isArray(p) ? [p[0], p[1]] : [p.lat, p.lng]);
      if (res.length > 3 && res[0][0] === res[res.length - 1][0] && res[0][1] === res[res.length - 1][1]) {
        res.pop();
      }
      return res;
    };

    const rA_latlng = norm(polyA);
    const rB_latlng = norm(polyB);
    if (rA_latlng.length < 3 || rB_latlng.length < 3) {
      return { success: false, reason: 'Polígono com menos de 3 vértices válidos.' };
    }

    const tol = Number(tolerance) > 0 ? Number(tolerance) : 0.5;

    // Projeção métrica local em torno do baricentro conjunto
    const allPts = [...rA_latlng, ...rB_latlng];
    const centerLat = allPts.reduce((acc, p) => acc + p[0], 0) / allPts.length;
    const centerLng = allPts.reduce((acc, p) => acc + p[1], 0) / allPts.length;
    const latM = 111139;
    const lngM = 111139 * Math.cos((centerLat * Math.PI) / 180);

    const toM = (p) => [(p[0] - centerLat) * latM, (p[1] - centerLng) * lngM];
    const toLatLng = (p) => [centerLat + p[0] / latM, centerLng + p[1] / lngM];

    let rA = this._ensureCCW(rA_latlng.map(toM));
    let rB = this._ensureCCW(rB_latlng.map(toM));

    // 1. Compatibilizar vértices existentes próximos (snap mútuo dentro de tol)
    for (let i = 0; i < rA.length; i++) {
      for (let j = 0; j < rB.length; j++) {
        if (Math.hypot(rA[i][0] - rB[j][0], rA[i][1] - rB[j][1]) <= tol) {
          rB[j] = [rA[i][0], rA[i][1]];
        }
      }
    }

    // 2. Inserir nós em T (vértices de um polígono colineares sobre arestas do outro)
    const insertNodesOnEdges = (ringTarget, ringSource) => {
      const result = [];
      for (let i = 0; i < ringTarget.length; i++) {
        const p1 = ringTarget[i];
        const p2 = ringTarget[(i + 1) % ringTarget.length];
        result.push(p1);

        const toInsert = [];
        for (const sPt of ringSource) {
          const { d, t, proj } = this._perpDistToSegment2D(sPt, p1, p2);
          if (d <= tol && t > 1e-4 && t < 1 - 1e-4) {
            toInsert.push({ pt: proj, t });
          }
        }
        toInsert.sort((a, b) => a.t - b.t);
        for (const item of toInsert) {
          if (Math.hypot(result[result.length - 1][0] - item.pt[0], result[result.length - 1][1] - item.pt[1]) > tol) {
            result.push(item.pt);
          }
        }
      }
      return result;
    };

    rA = insertNodesOnEdges(rA, rB);
    rB = insertNodesOnEdges(rB, rA);

    // 3. Interseções entre segmentos (para tratar sobreposição/overlap)
    const insertIntersections = (ring1, ring2) => {
      const res1 = [...ring1];
      const res2 = [...ring2];
      for (let i = 0; i < res1.length; i++) {
        const p1 = res1[i];
        const p2 = res1[(i + 1) % res1.length];
        for (let j = 0; j < res2.length; j++) {
          const q1 = res2[j];
          const q2 = res2[(j + 1) % res2.length];
          const inter = this._segIntersection2D(p1, p2, q1, q2);
          if (inter) {
            res1.splice(i + 1, 0, inter);
            res2.splice(j + 1, 0, inter);
            i--;
            break;
          }
        }
      }
      return { res1, res2 };
    };

    const inters = insertIntersections(rA, rB);
    rA = inters.res1;
    rB = inters.res2;

    // Snap final para alinhar pontos de interseção/contato
    for (let i = 0; i < rA.length; i++) {
      for (let j = 0; j < rB.length; j++) {
        if (Math.hypot(rA[i][0] - rB[j][0], rA[i][1] - rB[j][1]) <= tol) {
          rB[j] = [rA[i][0], rA[i][1]];
        }
      }
    }

    // 4. Classificação das arestas de A e B
    const isEdgeMatch = (p1, p2, q1, q2) => {
      const d1 = Math.hypot(p1[0] - q1[0], p1[1] - q1[1]);
      const d2 = Math.hypot(p2[0] - q2[0], p2[1] - q2[1]);
      const d3 = Math.hypot(p1[0] - q2[0], p1[1] - q2[1]);
      const d4 = Math.hypot(p2[0] - q1[0], p2[1] - q1[1]);
      return (d1 <= tol && d2 <= tol) || (d3 <= tol && d4 <= tol);
    };

    const edgesA = [];
    for (let i = 0; i < rA.length; i++) {
      const p1 = rA[i], p2 = rA[(i + 1) % rA.length];
      if (Math.hypot(p1[0] - p2[0], p1[1] - p2[1]) <= tol) continue;
      edgesA.push({ p1, p2 });
    }

    const edgesB = [];
    for (let j = 0; j < rB.length; j++) {
      const q1 = rB[j], q2 = rB[(j + 1) % rB.length];
      if (Math.hypot(q1[0] - q2[0], q1[1] - q2[1]) <= tol) continue;
      edgesB.push({ p1: q1, p2: q2 });
    }

    const isSharedA = new Array(edgesA.length).fill(false);
    const isSharedB = new Array(edgesB.length).fill(false);

    for (let i = 0; i < edgesA.length; i++) {
      for (let j = 0; j < edgesB.length; j++) {
        if (isEdgeMatch(edgesA[i].p1, edgesA[i].p2, edgesB[j].p1, edgesB[j].p2)) {
          isSharedA[i] = true;
          isSharedB[j] = true;
        }
      }
    }

    const sharedCount = isSharedA.filter(Boolean).length;

    // Segmentos do contorno externo (exclui compartilhados e internos ao outro polígono)
    const outerEdges = [];
    for (let i = 0; i < edgesA.length; i++) {
      if (isSharedA[i]) continue;
      const mid = [(edgesA[i].p1[0] + edgesA[i].p2[0]) / 2, (edgesA[i].p1[1] + edgesA[i].p2[1]) / 2];
      if (!this._isPointInPolygon2D(mid, rB)) {
        outerEdges.push({ ...edgesA[i] });
      }
    }

    for (let j = 0; j < edgesB.length; j++) {
      if (isSharedB[j]) continue;
      const mid = [(edgesB[j].p1[0] + edgesB[j].p2[0]) / 2, (edgesB[j].p1[1] + edgesB[j].p2[1]) / 2];
      if (!this._isPointInPolygon2D(mid, rA)) {
        outerEdges.push({ ...edgesB[j] });
      }
    }

    // Se não há arestas compartilhadas nem sobreposição, permanecem desconexos
    if (sharedCount === 0 && outerEdges.length === edgesA.length + edgesB.length) {
      return {
        success: true,
        type: 'MultiPolygon',
        coordinates: [rA_latlng, rB_latlng]
      };
    }

    // Se um polígono contém o outro inteiramente ou são idênticos
    if (outerEdges.length < 3) {
      const aInB = rA.every(p => this._isPointInPolygon2D(p, rB));
      const bInA = rB.every(p => this._isPointInPolygon2D(p, rA));
      if (aInB) return { success: true, type: 'Polygon', coordinates: rB_latlng };
      if (bInA) return { success: true, type: 'Polygon', coordinates: rA_latlng };
    }

    // 5. Encadeamento das arestas externas para formar o polígono unificado
    if (outerEdges.length >= 3) {
      const chain = [];
      const used = new Array(outerEdges.length).fill(false);
      chain.push(outerEdges[0].p1);
      let currPt = outerEdges[0].p2;
      chain.push(currPt);
      used[0] = true;

      for (let step = 1; step < outerEdges.length; step++) {
        let nextIdx = -1;
        let reverseNext = false;
        let bestDist = Infinity;

        for (let k = 0; k < outerEdges.length; k++) {
          if (used[k]) continue;
          const dDirect = Math.hypot(currPt[0] - outerEdges[k].p1[0], currPt[1] - outerEdges[k].p1[1]);
          const dRev = Math.hypot(currPt[0] - outerEdges[k].p2[0], currPt[1] - outerEdges[k].p2[1]);
          if (dDirect <= tol && dDirect < bestDist) {
            bestDist = dDirect;
            nextIdx = k;
            reverseNext = false;
          } else if (dRev <= tol && dRev < bestDist) {
            bestDist = dRev;
            nextIdx = k;
            reverseNext = true;
          }
        }

        if (nextIdx === -1) break;

        used[nextIdx] = true;
        currPt = reverseNext ? outerEdges[nextIdx].p1 : outerEdges[nextIdx].p2;
        chain.push(currPt);

        if (Math.hypot(currPt[0] - chain[0][0], currPt[1] - chain[0][1]) <= tol) {
          break;
        }
      }

      if (chain.length > 3 && Math.hypot(chain[0][0] - chain[chain.length - 1][0], chain[0][1] - chain[chain.length - 1][1]) <= tol) {
        chain.pop();
      }

      const cleaned = [];
      for (const pt of chain) {
        if (cleaned.length === 0 || Math.hypot(cleaned[cleaned.length - 1][0] - pt[0], cleaned[cleaned.length - 1][1] - pt[1]) > 0.05) {
          cleaned.push(pt);
        }
      }

      const simplified = this._cleanCollinearNodes(cleaned, 0.05);

      if (simplified.length >= 3) {
        return {
          success: true,
          type: 'Polygon',
          coordinates: simplified.map(toLatLng)
        };
      }
    }

    return {
      success: true,
      type: 'MultiPolygon',
      coordinates: [rA_latlng, rB_latlng]
    };
  }

  /** Distância perpendicular 2D métrica a segmento */
  static _perpDistToSegment2D(p, a, b) {
    const dy = b[0] - a[0];
    const dx = b[1] - a[1];
    const lenSq = dy * dy + dx * dx;
    if (lenSq === 0) return { d: Math.hypot(p[0] - a[0], p[1] - a[1]), t: 0, proj: a };
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dy + (p[1] - a[1]) * dx) / lenSq));
    const proj = [a[0] + t * dy, a[1] + t * dx];
    return { d: Math.hypot(p[0] - proj[0], p[1] - proj[1]), t, proj };
  }

  /** Interseção 2D métrica entre dois segmentos */
  static _segIntersection2D(p1, p2, q1, q2) {
    const y1 = p1[0], x1 = p1[1];
    const y2 = p2[0], x2 = p2[1];
    const y3 = q1[0], x3 = q1[1];
    const y4 = q2[0], x4 = q2[1];

    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 1e-10) return null;

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

    if (t > 1e-4 && t < 1 - 1e-4 && u > 1e-4 && u < 1 - 1e-4) {
      return [y1 + t * (y2 - y1), x1 + t * (x2 - x1)];
    }
    return null;
  }

  /** Ray casting 2D métrico */
  static _isPointInPolygon2D(pt, ring) {
    let inside = false;
    const y = pt[0], x = pt[1];
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const yi = ring[i][0], xi = ring[i][1];
      const yj = ring[j][0], xj = ring[j][1];
      const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi || 1e-12) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /** Garante sentido anti-horário (CCW) para polígonos */
  static _ensureCCW(pts) {
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
      const next = (i + 1) % pts.length;
      a += pts[i][1] * pts[next][0] - pts[next][1] * pts[i][0];
    }
    return a < 0 ? [...pts].reverse() : [...pts];
  }

  /** Remove vértices estritamente colineares consecutivos */
  static _cleanCollinearNodes(pts, tol = 0.05) {
    if (pts.length <= 3) return pts;
    const res = [];
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const prev = pts[(i - 1 + n) % n];
      const curr = pts[i];
      const next = pts[(i + 1) % n];
      const { d } = this._perpDistToSegment2D(curr, prev, next);
      if (d > tol) {
        res.push(curr);
      }
    }
    return res.length >= 3 ? res : pts;
  }

  /**
   * Une duas feições (sejam linhas ou polígonos)
   * @param {Object} featA
   * @param {Object} featB
   * @param {Object} [options]
   * @returns {{ success: boolean, type?: string, coordinates?: any, reason?: string }}
   */
  static joinFeatures(featA, featB, options = {}) {
    if (!featA || !featB) {
      return { success: false, reason: 'Duas feições são necessárias para a junção.' };
    }

    if (featA.type === 'LineString' && featB.type === 'LineString') {
      const res = this.joinLines(featA.coordinates, featB.coordinates);
      return { ...res, type: 'LineString' };
    }

    if (featA.type === 'Polygon' && featB.type === 'Polygon') {
      return this.joinPolygons(featA.coordinates, featB.coordinates, options.tolerance || 0.5);
    }

    return {
      success: false,
      reason: 'As feições devem ser do mesmo tipo (ambas Linhas ou ambos Polígonos) para junção.'
    };
  }

  /**
   * Une N feições selecionadas. Suporta:
   * - Peças não juntáveis selecionadas no meio de juntáveis (são preservadas intactas sem causar erro).
   * - Seleção mista com linhas e polígonos (cada grupo juntável é processado).
   * - strict (bridge=false): une o que se toca e mantém desconectados intactos.
   * - bridge=true: une também desconectados criando trechos de ponte.
   * @param {Array<Object>} features
   * @param {{bridge?: boolean, tolerance?: number}} [options] tolerance em metros
   * @returns {{ success: boolean, results?: Array<{type: string, coordinates: Array, sources: number[]}>,
   *   type?: string, coordinates?: Array, bridges?: number, bridgeLength?: number, consumedSources?: number[], unmergedCount?: number, reason?: string }}
   */
  static joinMany(features, { bridge = false, tolerance = 0.5 } = {}) {
    const rawList = (features || []).filter(Boolean);
    if (rawList.length < 2) {
      return { success: false, reason: 'Selecione pelo menos 2 feições para unir.' };
    }

    // Segrega candidatos válidos por tipo preservando os índices originais
    const lineCandidates = [];
    const polyCandidates = [];
    let ignoredCount = 0;

    rawList.forEach((f, origIdx) => {
      const type = f.type;
      const coords = f.coordinates;
      if (type === 'LineString' && Array.isArray(coords) && coords.length >= 2) {
        lineCandidates.push({ feature: f, origIdx });
      } else if (type === 'Polygon' && Array.isArray(coords) && coords.length >= 3) {
        polyCandidates.push({ feature: f, origIdx });
      } else {
        ignoredCount++;
      }
    });

    const results = [];
    let totalBridges = 0;
    let totalBridgeLength = 0;
    const consumedOrigIndices = new Set();

    // 1. Processa Linhas (se houver pelo menos 2 candidatas)
    if (lineCandidates.length >= 2) {
      const lineFeats = lineCandidates.map(c => c.feature);
      const lineRes = this._joinManyLines(lineFeats, bridge, tolerance);
      if (lineRes.success && lineRes.results?.length > 0) {
        totalBridges += lineRes.bridges || 0;
        totalBridgeLength += lineRes.bridgeLength || 0;
        lineRes.results.forEach(r => {
          const origSources = r.sources.map(localIdx => lineCandidates[localIdx].origIdx);
          origSources.forEach(idx => consumedOrigIndices.add(idx));
          results.push({
            type: r.type,
            coordinates: r.coordinates,
            sources: origSources
          });
        });
      }
    }

    // 2. Processa Polígonos (se houver pelo menos 2 candidatos)
    if (polyCandidates.length >= 2) {
      const polyFeats = polyCandidates.map(c => c.feature);
      const polyRes = this._joinManyPolygons(polyFeats, bridge, tolerance);
      if (polyRes.success && polyRes.results?.length > 0) {
        totalBridges += polyRes.bridges || 0;
        totalBridgeLength += polyRes.bridgeLength || 0;
        polyRes.results.forEach(r => {
          const origSources = r.sources.map(localIdx => polyCandidates[localIdx].origIdx);
          origSources.forEach(idx => consumedOrigIndices.add(idx));
          results.push({
            type: r.type,
            coordinates: r.coordinates,
            sources: origSources
          });
        });
      }
    }

    if (results.length === 0) {
      if (lineCandidates.length < 2 && polyCandidates.length < 2) {
        return {
          success: false,
          reason: 'Nenhuma combinação de feições juntáveis encontrada (selecione pelo menos 2 linhas ou 2 polígonos).'
        };
      }
      return {
        success: false,
        reason: 'Nenhuma das feições selecionadas está conectada entre si. Use "Unir com Ponte [Shift+J]" para ligá-las.'
      };
    }

    const res = {
      success: true,
      results,
      bridges: totalBridges,
      bridgeLength: totalBridgeLength,
      consumedSources: Array.from(consumedOrigIndices),
      unmergedCount: rawList.length - consumedOrigIndices.size
    };

    if (results.length === 1) {
      res.type = results[0].type;
      res.coordinates = results[0].coordinates;
    }
    return res;
  }

  static _toLatLngList(coords) {
    return (coords || []).map(p => Array.isArray(p) ? [p[0], p[1]] : [p.lat, p.lng]);
  }

  static _joinManyLines(list, bridge, tol) {
    let chains = list
      .map((f, i) => ({ pts: this._toLatLngList(f.coordinates), src: [i] }))
      .filter(c => c.pts.length >= 2);
    if (chains.length < 2) return { success: false, reason: 'Linhas inválidas para junção.' };

    const closedRings = [];
    let bridges = 0;
    let bridgeLength = 0;
    const maxGap = bridge ? Infinity : tol;
    const isRing = (pts) => pts.length >= 4 && this.pointDistance(pts[0], pts[pts.length - 1]) <= tol;
    // Cadeia que já nasce fechada (ex.: anel desenhado) e com mais de uma fonte vira anel
    const settle = (c) => {
      if (c.src.length > 1 && isRing(c.pts)) {
        closedRings.push(c);
        return false;
      }
      return true;
    };
    chains = chains.filter(settle);

    while (chains.length > 1) {
      let best = null;
      for (let i = 0; i < chains.length; i++) {
        for (let j = i + 1; j < chains.length; j++) {
          for (const endA of [true, false]) {
            for (const endB of [true, false]) {
              const pa = endA ? chains[i].pts[chains[i].pts.length - 1] : chains[i].pts[0];
              const pb = endB ? chains[j].pts[chains[j].pts.length - 1] : chains[j].pts[0];
              const d = this.pointDistance(pa, pb);
              if (!best || d < best.d) best = { i, j, endA, endB, d };
            }
          }
        }
      }
      if (!best || best.d > maxGap) break;

      const a = best.endA ? chains[best.i].pts : [...chains[best.i].pts].reverse();
      const b = best.endB ? [...chains[best.j].pts].reverse() : chains[best.j].pts;
      if (best.d > tol) {
        bridges++;
        bridgeLength += best.d;
      }
      // Solda nó se dentro da tolerância de contato
      const merged = {
        pts: best.d <= tol ? [...a, ...b.slice(1)] : [...a, ...b],
        src: [...chains[best.i].src, ...chains[best.j].src]
      };
      chains = chains.filter((_, idx) => idx !== best.i && idx !== best.j);
      if (settle(merged)) chains.push(merged);
    }

    const results = [];
    for (const ring of closedRings) {
      results.push({ type: 'Polygon', coordinates: ring.pts.slice(0, -1), sources: ring.src });
    }
    for (const c of chains) {
      if (c.src.length > 1) results.push({ type: 'LineString', coordinates: c.pts, sources: c.src });
    }

    if (results.length === 0) {
      return {
        success: false,
        reason: 'Nenhuma das linhas selecionadas está conectada ponta com ponta a outra. Use "Unir com Ponte" para ligá-las.'
      };
    }
    return { success: true, results, bridges, bridgeLength };
  }

  static _joinManyPolygons(list, bridge, tol) {
    let groups = list
      .map((f, i) => ({ ring: this._toLatLngList(f.coordinates), src: [i] }))
      .filter(g => g.ring.length >= 3);
    if (groups.length < 2) return { success: false, reason: 'Polígonos insuficientes ou inválidos para junção.' };

    // 1) Une os que compartilham aresta ou sobrepõem, até não haver mais pares
    let progressed = true;
    while (progressed && groups.length > 1) {
      progressed = false;
      outer:
      for (let i = 0; i < groups.length; i++) {
        for (let j = i + 1; j < groups.length; j++) {
          const res = this.joinPolygons(groups[i].ring, groups[j].ring, tol);
          if (res.success && res.type === 'Polygon') {
            const merged = { ring: res.coordinates, src: [...groups[i].src, ...groups[j].src] };
            groups = groups.filter((_, idx) => idx !== i && idx !== j);
            groups.push(merged);
            progressed = true;
            break outer;
          }
        }
      }
    }

    // 2) Com ponte: liga os grupos restantes pelo par de vértices mais próximo (largura zero)
    let bridges = 0;
    let bridgeLength = 0;
    if (bridge) {
      while (groups.length > 1) {
        let best = null;
        for (let i = 0; i < groups.length; i++) {
          for (let j = i + 1; j < groups.length; j++) {
            for (let a = 0; a < groups[i].ring.length; a++) {
              for (let b = 0; b < groups[j].ring.length; b++) {
                const d = this.pointDistance(groups[i].ring[a], groups[j].ring[b]);
                if (!best || d < best.d) best = { i, j, a, b, d };
              }
            }
          }
        }
        if (!best) break;
        const rot = (ring, k) => [...ring.slice(k), ...ring.slice(0, k), ring[k]];
        const merged = {
          ring: [...rot(groups[best.i].ring, best.a), ...rot(groups[best.j].ring, best.b)],
          src: [...groups[best.i].src, ...groups[best.j].src]
        };
        bridges++;
        bridgeLength += best.d;
        groups = groups.filter((_, idx) => idx !== best.i && idx !== best.j);
        groups.push(merged);
      }
    }

    const results = groups
      .filter(g => g.src.length > 1)
      .map(g => ({ type: 'Polygon', coordinates: g.ring, sources: g.src }));
    if (results.length === 0) {
      return {
        success: false,
        reason: 'Nenhum dos polígonos selecionados compartilha aresta ou sobreposição com outro. Use "Unir com Ponte" para ligá-los.'
      };
    }
    return { success: true, results, bridges, bridgeLength };
  }
}

