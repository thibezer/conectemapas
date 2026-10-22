/* ==========================================================================
   ConecteMapas - Geodesy
   Geodésia elipsoidal pura (GRS80 / SIRGAS 2000): distância e azimute geodésicos
   entre dois pontos [lat, lng] pela fórmula inversa de Vincenty (precisão sub-milimétrica).
   Fonte única para distância/azimute; não usar Haversine para medidas de projeto.
   ========================================================================== */

const A = 6378137;
const F = 1 / 298.257222101;
const B = A * (1 - F);
const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const R_MEDIO = 6371008.8;

/** Haversine esférico: só como último recurso (pontos quase antípodas, onde Vincenty não converge). */
function haversineFallback(p1, p2) {
  const dLat = (p2[0] - p1[0]) * RAD;
  const dLon = (p2[1] - p1[1]) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(p1[0] * RAD) * Math.cos(p2[0] * RAD) * Math.sin(dLon / 2) ** 2;
  const distance = 2 * R_MEDIO * Math.asin(Math.min(1, Math.sqrt(h)));
  const y = Math.sin(dLon) * Math.cos(p2[0] * RAD);
  const x = Math.cos(p1[0] * RAD) * Math.sin(p2[0] * RAD) - Math.sin(p1[0] * RAD) * Math.cos(p2[0] * RAD) * Math.cos(dLon);
  return { distance, azimuth: (Math.atan2(y, x) * DEG + 360) % 360 };
}

export class Geodesy {
  /**
   * Problema geodésico inverso no elipsoide GRS80.
   * @param {[number, number]} p1 [lat, lng] em graus
   * @param {[number, number]} p2 [lat, lng] em graus
   * @returns {{distance: number, azimuth: number}} metros e azimute inicial (0–360°, a partir do norte)
   */
  static inverse(p1, p2) {
    if (p1[0] === p2[0] && p1[1] === p2[1]) return { distance: 0, azimuth: 0 };

    const L = (p2[1] - p1[1]) * RAD;
    const U1 = Math.atan((1 - F) * Math.tan(p1[0] * RAD));
    const U2 = Math.atan((1 - F) * Math.tan(p2[0] * RAD));
    const sinU1 = Math.sin(U1), cosU1 = Math.cos(U1);
    const sinU2 = Math.sin(U2), cosU2 = Math.cos(U2);

    let lambda = L;
    let sinSigma = 0, cosSigma = 0, sigma = 0, cos2Alpha = 0, cos2SigmaM = 0;
    let converged = false;

    for (let i = 0; i < 100; i++) {
      const sinL = Math.sin(lambda), cosL = Math.cos(lambda);
      sinSigma = Math.hypot(cosU2 * sinL, cosU1 * sinU2 - sinU1 * cosU2 * cosL);
      if (sinSigma === 0) return { distance: 0, azimuth: 0 };
      cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosL;
      sigma = Math.atan2(sinSigma, cosSigma);
      const sinAlpha = cosU1 * cosU2 * sinL / sinSigma;
      cos2Alpha = 1 - sinAlpha * sinAlpha;
      cos2SigmaM = cos2Alpha === 0 ? 0 : cosSigma - 2 * sinU1 * sinU2 / cos2Alpha;
      const C = F / 16 * cos2Alpha * (4 + F * (4 - 3 * cos2Alpha));
      const prev = lambda;
      lambda = L + (1 - C) * F * sinAlpha *
        (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));
      if (Math.abs(lambda - prev) < 1e-12) { converged = true; break; }
    }

    if (!converged || !Number.isFinite(sigma)) return haversineFallback(p1, p2);

    const u2 = cos2Alpha * (A * A - B * B) / (B * B);
    const k1 = 1 + u2 / 16384 * (4096 + u2 * (-768 + u2 * (320 - 175 * u2)));
    const k2 = u2 / 1024 * (256 + u2 * (-128 + u2 * (74 - 47 * u2)));
    const deltaSigma = k2 * sinSigma * (cos2SigmaM + k2 / 4 *
      (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
        k2 / 6 * cos2SigmaM * (-3 + 4 * sinSigma * sinSigma) * (-3 + 4 * cos2SigmaM * cos2SigmaM)));

    const distance = B * k1 * (sigma - deltaSigma);
    const azimuth = Math.atan2(cosU2 * Math.sin(lambda), cosU1 * sinU2 - sinU1 * cosU2 * Math.cos(lambda));
    return { distance, azimuth: (azimuth * DEG + 360) % 360 };
  }

  /**
   * Metros por grau de latitude e de longitude na latitude dada (raios de curvatura M e N do GRS80).
   * Serve para deslocamentos locais pequenos (buffer, cópia com deslocamento), no lugar de uma esfera.
   * @param {number} latDeg latitude em graus
   * @returns {{lat: number, lng: number}}
   */
  static metersPerDegree(latDeg) {
    const e2 = F * (2 - F);
    const sin = Math.sin(latDeg * RAD);
    const w = 1 - e2 * sin * sin;
    const N = A / Math.sqrt(w);
    const M = A * (1 - e2) / (w * Math.sqrt(w));
    return { lat: M * RAD, lng: N * Math.cos(latDeg * RAD) * RAD };
  }

  /** Distância geodésica em metros. */
  static distance(p1, p2) {
    return this.inverse(p1, p2).distance;
  }

  /** Azimute geodésico inicial (graus, 0–360, a partir do norte verdadeiro). */
  static azimuth(p1, p2) {
    return this.inverse(p1, p2).azimuth;
  }
}
