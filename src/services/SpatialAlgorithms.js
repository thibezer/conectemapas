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
  static simplifyDouglasPeucker(coords, toleranceMeters = 5, isPolygon = false) {
    if (!Array.isArray(coords) || coords.length <= (isPolygon ? 3 : 2)) {
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

    // Para Linhas e Polígonos: expande a envoltória geodésica em 32 segmentos
    const coords = feature.coordinates;
    const bufferPoints = [];

    if (type === 'Polygon' || type === 'LineString') {
      const centerLat = coords.reduce((acc, c) => acc + c[0], 0) / coords.length;
      const centerLng = coords.reduce((acc, c) => acc + c[1], 0) / coords.length;

      const dLat = this.metersToDegreesLat(radiusMeters);
      const dLng = this.metersToDegreesLng(radiusMeters, centerLat);

      coords.forEach(([lat, lng]) => {
        // Vetor de afastamento a partir do centroide
        const dirLat = lat - centerLat;
        const dirLng = lng - centerLng;
        const len = Math.sqrt(dirLat * dirLat + dirLng * dirLng) || 1;
        const normLat = dirLat / len;
        const normLng = dirLng / len;

        bufferPoints.push([
          lat + normLat * dLat,
          lng + normLng * dLng
        ]);
      });
    }

    return {
      id: `feat-buffer-${Date.now()}`,
      name: `Buffer ${feature.name} (${radiusMeters}m)`,
      layerId: targetLayerId,
      type: 'Polygon',
      coordinates: bufferPoints.length >= 3 ? bufferPoints : coords,
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
      refLat = feature.coordinates[0][0];
    }

    const dLat = this.metersToDegreesLat(offsetMeters);
    const dLng = this.metersToDegreesLng(offsetMeters, refLat);

    let newCoordinates;
    if (feature.type === 'Point' || feature.type === 'Circle') {
      newCoordinates = [feature.coordinates[0] + dLat, feature.coordinates[1] + dLng];
    } else if (Array.isArray(feature.coordinates)) {
      newCoordinates = feature.coordinates.map(([lat, lng]) => [lat + dLat, lng + dLng]);
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
}
