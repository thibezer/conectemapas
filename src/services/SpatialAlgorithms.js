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
   * Une dois polígonos em um polígono único (ou MultiPolígono se desconexos)
   * @param {Array<[number, number]>} polyA
   * @param {Array<[number, number]>} polyB
   * @returns {{ success: boolean, type: string, coordinates: Array, reason?: string }}
   */
  static joinPolygons(polyA, polyB) {
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

    const rA = norm(polyA);
    const rB = norm(polyB);

    let sharedEdge = null;
    const TOL = 0.5; // tolerância em metros

    for (let i = 0; i < rA.length; i++) {
      const a1 = rA[i];
      const a2 = rA[(i + 1) % rA.length];

      for (let j = 0; j < rB.length; j++) {
        const b1 = rB[j];
        const b2 = rB[(j + 1) % rB.length];

        if (this.pointDistance(a1, b2) <= TOL && this.pointDistance(a2, b1) <= TOL) {
          sharedEdge = { idxA: i, idxB: j, sameDir: false };
          break;
        }
        if (this.pointDistance(a1, b1) <= TOL && this.pointDistance(a2, b2) <= TOL) {
          sharedEdge = { idxA: i, idxB: j, sameDir: true };
          break;
        }
      }
      if (sharedEdge) break;
    }

    if (sharedEdge) {
      const nA = rA.length;
      const nB = rB.length;
      const merged = [];

      for (let k = 0; k < nA - 1; k++) {
        const idx = (sharedEdge.idxA + 1 + k) % nA;
        merged.push(rA[idx]);
      }

      if (sharedEdge.sameDir) {
        for (let k = 0; k < nB - 1; k++) {
          const idx = (sharedEdge.idxB + nB - k) % nB;
          merged.push(rB[idx]);
        }
      } else {
        for (let k = 0; k < nB - 1; k++) {
          const idx = (sharedEdge.idxB + 1 + k) % nB;
          merged.push(rB[idx]);
        }
      }

      const cleaned = [];
      for (const pt of merged) {
        if (cleaned.length === 0 || this.pointDistance(cleaned[cleaned.length - 1], pt) > 0.05) {
          cleaned.push(pt);
        }
      }

      if (cleaned.length >= 3) {
        return {
          success: true,
          type: 'Polygon',
          coordinates: cleaned
        };
      }
    }

    return {
      success: true,
      type: 'MultiPolygon',
      coordinates: [rA, rB]
    };
  }

  /**
   * Une duas feições (sejam linhas ou polígonos)
   * @param {Object} featA
   * @param {Object} featB
   * @returns {{ success: boolean, type?: string, coordinates?: any, reason?: string }}
   */
  static joinFeatures(featA, featB) {
    if (!featA || !featB) {
      return { success: false, reason: 'Duas feições são necessárias para a junção.' };
    }

    if (featA.type === 'LineString' && featB.type === 'LineString') {
      const res = this.joinLines(featA.coordinates, featB.coordinates);
      return { ...res, type: 'LineString' };
    }

    if (featA.type === 'Polygon' && featB.type === 'Polygon') {
      return this.joinPolygons(featA.coordinates, featB.coordinates);
    }

    return {
      success: false,
      reason: 'As feições devem ser do mesmo tipo (ambas Linhas ou ambos Polígonos) para junção.'
    };
  }

  /**
   * Une N feições do mesmo tipo (todas Linhas ou todos Polígonos).
   * - strict (bridge=false): só une o que já está conectado (pontas coincidentes / aresta compartilhada).
   *   Se sobrar mais de um grupo, falha sem unir nada.
   * - bridge=true: une o que está conectado e liga o restante pelo par de pontos/vértices mais próximo,
   *   criando o trecho de junção (segmento reto em linhas; "ponte" de largura zero em polígonos).
   * @param {Array<Object>} features
   * @param {{bridge?: boolean, tolerance?: number}} [options] tolerance em metros
   * @returns {{ success: boolean, type?: string, coordinates?: Array, bridges?: number, bridgeLength?: number, reason?: string }}
   */
  static joinMany(features, { bridge = false, tolerance = 0.5 } = {}) {
    const list = (features || []).filter(Boolean);
    if (list.length < 2) {
      return { success: false, reason: 'Selecione pelo menos 2 feições para unir.' };
    }
    const types = new Set(list.map(f => f.type));
    if (types.size !== 1 || !(types.has('LineString') || types.has('Polygon'))) {
      return { success: false, reason: 'As feições devem ser todas Linhas ou todas Polígonos para junção.' };
    }
    return types.has('LineString')
      ? this._joinManyLines(list, bridge, tolerance)
      : this._joinManyPolygons(list, bridge, tolerance);
  }

  static _toLatLngList(coords) {
    return (coords || []).map(p => Array.isArray(p) ? [p[0], p[1]] : [p.lat, p.lng]);
  }

  static _joinManyLines(list, bridge, tol) {
    let chains = list.map(f => this._toLatLngList(f.coordinates)).filter(c => c.length >= 2);
    if (chains.length < 2) return { success: false, reason: 'Linhas inválidas para junção.' };

    let bridges = 0;
    let bridgeLength = 0;
    const maxGap = bridge ? Infinity : tol;

    while (chains.length > 1) {
      // Par de pontas mais próximo entre quaisquer duas cadeias
      let best = null;
      for (let i = 0; i < chains.length; i++) {
        for (let j = i + 1; j < chains.length; j++) {
          for (const endA of [true, false]) {
            for (const endB of [true, false]) {
              const pa = endA ? chains[i][chains[i].length - 1] : chains[i][0];
              const pb = endB ? chains[j][chains[j].length - 1] : chains[j][0];
              const d = this.pointDistance(pa, pb);
              if (!best || d < best.d) best = { i, j, endA, endB, d };
            }
          }
        }
      }
      if (!best || best.d > maxGap) break;

      // Orienta A para terminar na ponta escolhida e B para começar nela
      const a = best.endA ? chains[best.i] : [...chains[best.i]].reverse();
      const b = best.endB ? [...chains[best.j]].reverse() : chains[best.j];
      if (best.d > tol) {
        bridges++;
        bridgeLength += best.d;
      }
      const merged = best.d <= 0.05 ? [...a, ...b.slice(1)] : [...a, ...b];
      chains = chains.filter((_, idx) => idx !== best.i && idx !== best.j);
      chains.push(merged);
    }

    if (chains.length > 1) {
      return {
        success: false,
        reason: `${chains.length} grupos de linhas não estão conectados ponta com ponta. Use "Unir com Ponte" para ligá-los.`
      };
    }
    return { success: true, type: 'LineString', coordinates: chains[0], bridges, bridgeLength };
  }

  static _joinManyPolygons(list, bridge, tol) {
    let rings = list.map(f => this._toLatLngList(f.coordinates));
    if (rings.some(r => r.length < 3)) return { success: false, reason: 'Polígonos inválidos para junção.' };

    // 1) Une os que compartilham aresta, até não haver mais pares
    let progressed = true;
    while (progressed && rings.length > 1) {
      progressed = false;
      outer:
      for (let i = 0; i < rings.length; i++) {
        for (let j = i + 1; j < rings.length; j++) {
          const res = this.joinPolygons(rings[i], rings[j]);
          if (res.success && res.type === 'Polygon') {
            rings = rings.filter((_, idx) => idx !== i && idx !== j);
            rings.push(res.coordinates);
            progressed = true;
            break outer;
          }
        }
      }
    }

    let bridges = 0;
    let bridgeLength = 0;
    if (rings.length > 1) {
      if (!bridge) {
        return {
          success: false,
          reason: `${rings.length} grupos de polígonos não compartilham aresta. Use "Unir com Ponte" para ligá-los.`
        };
      }
      // 2) Liga os grupos restantes pelo par de vértices mais próximo (ponte de largura zero)
      while (rings.length > 1) {
        let best = null;
        for (let i = 0; i < rings.length; i++) {
          for (let j = i + 1; j < rings.length; j++) {
            for (let a = 0; a < rings[i].length; a++) {
              for (let b = 0; b < rings[j].length; b++) {
                const d = this.pointDistance(rings[i][a], rings[j][b]);
                if (!best || d < best.d) best = { i, j, a, b, d };
              }
            }
          }
        }
        const rot = (ring, k) => [...ring.slice(k), ...ring.slice(0, k), ring[k]];
        const merged = [...rot(rings[best.i], best.a), ...rot(rings[best.j], best.b)];
        bridges++;
        bridgeLength += best.d;
        rings = rings.filter((_, idx) => idx !== best.i && idx !== best.j);
        rings.push(merged);
      }
    }
    return { success: true, type: 'Polygon', coordinates: rings[0], bridges, bridgeLength };
  }
}


