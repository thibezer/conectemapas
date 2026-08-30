/* ==========================================================================
   ConecteMapas - WktConverter
   Responsabilidade Única: Serialização OGC Well-Known Text (WKT)
   ========================================================================== */

export class WktConverter {
  /**
   * Converte uma feição isolada para WKT (Well-Known Text)
   * @param {Object} feature
   * @returns {string}
   */
  static toWKT(feature) {
    if (!feature || !feature.coordinates) return '';
    const type = feature.type;
    const coords = feature.coordinates;

    if (type === 'Point') {
      return `POINT(${coords[1]} ${coords[0]})`;
    } else if (type === 'LineString') {
      const pts = coords.map(c => `${c[1]} ${c[0]}`).join(', ');
      return `LINESTRING(${pts})`;
    } else if (type === 'Polygon') {
      const ring = coords.map(c => `${c[1]} ${c[0]}`);
      if (ring.length > 0 && ring[0] !== ring[ring.length - 1]) {
        ring.push(ring[0]);
      }
      return `POLYGON((${ring.join(', ')}))`;
    } else if (type === 'Circle') {
      return `POINT(${coords[1]} ${coords[0]}) /* BUFFER ${feature.radius || 0}m */`;
    }
    return '';
  }
}
