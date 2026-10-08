/* ==========================================================================
   ConecteMapas - ShapeGeometryGenerator (SRP Module)
   Geração paramétrica de formas geométricas:
   - Elipses (36 vértices geodésicos)
   - Polígonos Regulares (Hexágonos, Octógonos, Triângulos)
   - Estrelas Geométricas
   ========================================================================== */

export class ShapeGeometryGenerator {
  /**
   * Gera uma elipse a partir do centro e ponto da extremidade
   * @param {[number, number]} center [lat, lng]
   * @param {[number, number]} edge [lat, lng]
   * @returns {Array<[number, number]>}
   */
  static generateEllipse(center, edge) {
    const rLat = Math.abs(edge[0] - center[0]);
    const rLng = Math.abs(edge[1] - center[1]);
    const points = [];
    const steps = 36;
    for (let i = 0; i < steps; i++) {
      const theta = (i * 2 * Math.PI) / steps;
      points.push([
        center[0] + rLat * Math.sin(theta),
        center[1] + rLng * Math.cos(theta)
      ]);
    }
    return points;
  }

  /**
   * Gera um polígono regular (padrão: 6 lados / hexágono)
   * @param {[number, number]} center [lat, lng]
   * @param {[number, number]} edge [lat, lng]
   * @param {number} sides Número de lados (ex: 6)
   * @returns {Array<[number, number]>}
   */
  static generateRegularPolygon(center, edge, sides = 6) {
    const lat0 = center[0];
    const lng0 = center[1];
    const lat1 = edge[0];
    const lng1 = edge[1];
    const cosLat = Math.cos((lat0 * Math.PI) / 180) || 1;
    const dLat = (lat1 - lat0);
    const dLng = (lng1 - lng0) * cosLat;
    const R = Math.hypot(dLat, dLng);
    const startAngle = Math.atan2(dLat, dLng);

    const points = [];
    for (let i = 0; i < sides; i++) {
      const angle = startAngle + (i * 2 * Math.PI) / sides;
      points.push([
        lat0 + R * Math.sin(angle),
        lng0 + (R * Math.cos(angle)) / cosLat
      ]);
    }
    return points;
  }

  /**
   * Gera uma estrela de 5 pontas a partir do centro e raio externo
   * @param {[number, number]} center [lat, lng]
   * @param {[number, number]} edge [lat, lng]
   * @param {number} pointsCount Número de pontas (ex: 5)
   * @returns {Array<[number, number]>}
   */
  static generateStar(center, edge, pointsCount = 5) {
    const lat0 = center[0];
    const lng0 = center[1];
    const lat1 = edge[0];
    const lng1 = edge[1];
    const cosLat = Math.cos((lat0 * Math.PI) / 180) || 1;
    const dLat = (lat1 - lat0);
    const dLng = (lng1 - lng0) * cosLat;
    const rOuter = Math.hypot(dLat, dLng);
    const rInner = rOuter * 0.45;
    const startAngle = Math.atan2(dLat, dLng);

    const points = [];
    const totalVertices = pointsCount * 2;
    for (let i = 0; i < totalVertices; i++) {
      const r = i % 2 === 0 ? rOuter : rInner;
      const angle = startAngle + (i * 2 * Math.PI) / totalVertices;
      points.push([
        lat0 + r * Math.sin(angle),
        lng0 + (r * Math.cos(angle)) / cosLat
      ]);
    }
    return points;
  }
}
