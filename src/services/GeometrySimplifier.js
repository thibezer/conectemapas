/* ==========================================================================
   ConecteMapas - GeometrySimplifier (LOD - Douglas-Peucker)
   Responsabilidade Única: Generalização cartográfica e simplificação geométrica
   dinâmica não-destrutiva baseada no nível de zoom do Leaflet.
   ========================================================================== */

export class GeometrySimplifier {
  static getToleranceForZoom(zoom) {
    if (zoom <= 3) return 0.15;
    if (zoom <= 5) return 0.04;
    if (zoom <= 7) return 0.01;
    if (zoom <= 9) return 0.002;
    if (zoom <= 11) return 0.0004;
    return 0; // Zoom detalhado (sem simplificação)
  }

  static getSqDist(p1, p2) {
    const dx = p1[0] - p2[0];
    const dy = p1[1] - p2[1];
    return dx * dx + dy * dy;
  }

  static getSqSegDist(p, p1, p2) {
    let x = p1[0], y = p1[1];
    let dx = p2[0] - x, dy = p2[1] - y;

    if (dx !== 0 || dy !== 0) {
      const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) {
        x = p2[0];
        y = p2[1];
      } else if (t > 0) {
        x += dx * t;
        y += dy * t;
      }
    }

    dx = p[0] - x;
    dy = p[1] - y;
    return dx * dx + dy * dy;
  }

  static simplifyDPStep(points, first, last, sqTolerance, simplified) {
    let maxSqDist = sqTolerance;
    let index = -1;

    for (let i = first + 1; i < last; i++) {
      const sqDist = this.getSqSegDist(points[i], points[first], points[last]);
      if (sqDist > maxSqDist) {
        index = i;
        maxSqDist = sqDist;
      }
    }

    if (index > -1) {
      if (index - first > 1) this.simplifyDPStep(points, first, index, sqTolerance, simplified);
      simplified.push(points[index]);
      if (last - index > 1) this.simplifyDPStep(points, index, last, sqTolerance, simplified);
    }
  }

  static simplifyPoints(points, tolerance) {
    if (!Array.isArray(points) || points.length <= 2 || tolerance <= 0) return points;

    const sqTolerance = tolerance * tolerance;
    const last = points.length - 1;
    const simplified = [points[0]];

    this.simplifyDPStep(points, 0, last, sqTolerance, simplified);
    simplified.push(points[last]);

    return simplified;
  }

  static simplify(coords, type, zoom) {
    const tolerance = this.getToleranceForZoom(zoom);
    if (tolerance <= 0 || !Array.isArray(coords)) return coords;

    if (type === 'LineString') {
      return this.simplifyPoints(coords, tolerance);
    } else if (type === 'Polygon') {
      if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
        // Multi-ring ou Polígono com buracos
        return coords.map(ring => {
          const simplified = this.simplifyPoints(ring, tolerance);
          // Garante no mínimo triângulo fechado (4 pontos)
          return simplified.length >= 3 ? simplified : ring;
        });
      } else {
        const simplified = this.simplifyPoints(coords, tolerance);
        return simplified.length >= 3 ? simplified : coords;
      }
    }

    return coords;
  }
}
