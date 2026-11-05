/* ==========================================================================
   ConecteMapas - WktConverter
   Responsabilidade Única: Serialização OGC Well-Known Text (WKT)
   ========================================================================== */

import { FeatureGeometryUtils } from '../MapEngine/FeatureGeometryUtils.js';

export class WktConverter {
  /**
   * Converte uma feição isolada para WKT (Well-Known Text)
   * Suporta Point, LineString, Polygon (com furos e multipolígonos), Circle e Text.
   * @param {Object} feature
   * @returns {string}
   */
  static toWKT(feature) {
    if (!feature || !feature.coordinates) return '';
    const type = feature.type;
    const coords = feature.coordinates;

    const isValidPoint = (pt) => Array.isArray(pt) && pt.length >= 2 && Number.isFinite(pt[0]) && Number.isFinite(pt[1]);
    const formatPt = (pt) => `${pt[1]} ${pt[0]}`;

    if (type === 'Point') {
      if (!isValidPoint(coords)) return '';
      return `POINT(${formatPt(coords)})`;
    }

    if (type === 'Text') {
      if (!isValidPoint(coords)) return '';
      const textLabel = feature.text || feature.properties?.text || feature.name || '';
      return textLabel
        ? `POINT(${formatPt(coords)}) /* TEXT "${textLabel}" */`
        : `POINT(${formatPt(coords)})`;
    }

    if (type === 'Circle') {
      if (!isValidPoint(coords)) return '';
      return `POINT(${formatPt(coords)}) /* BUFFER ${feature.radius || 0}m */`;
    }

    if (type === 'LineString') {
      if (!Array.isArray(coords) || coords.length === 0) return '';
      const isMulti = Array.isArray(coords[0]) && Array.isArray(coords[0][0]);
      if (isMulti) {
        const linesWkt = coords
          .map(line => {
            const validPts = line.filter(isValidPoint);
            return validPts.length >= 2 ? `(${validPts.map(formatPt).join(', ')})` : null;
          })
          .filter(Boolean);
        if (linesWkt.length === 0) return '';
        return `MULTILINESTRING(${linesWkt.join(', ')})`;
      } else {
        const validPts = coords.filter(isValidPoint);
        if (validPts.length < 2) return '';
        return `LINESTRING(${validPts.map(formatPt).join(', ')})`;
      }
    }

    if (type === 'Polygon') {
      if (!Array.isArray(coords) || coords.length === 0) return '';
      const closeRing = (ring) => {
        const valid = ring.filter(isValidPoint);
        if (valid.length < 3) return null;
        const pts = valid.map(c => [c[0], c[1]]);
        const first = pts[0];
        const last = pts[pts.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          pts.push([first[0], first[1]]);
        }
        return `(${pts.map(formatPt).join(', ')})`;
      };

      const polygonList = FeatureGeometryUtils.toPolygonList(coords);
      if (!polygonList || polygonList.length === 0) return '';

      if (polygonList.length === 1) {
        const ringsWkt = polygonList[0].map(closeRing).filter(Boolean);
        if (ringsWkt.length === 0) return '';
        return `POLYGON(${ringsWkt.join(', ')})`;
      } else {
        const polysWkt = polygonList
          .map(poly => {
            const rings = poly.map(closeRing).filter(Boolean);
            return rings.length > 0 ? `(${rings.join(', ')})` : null;
          })
          .filter(Boolean);
        if (polysWkt.length === 0) return '';
        return `MULTIPOLYGON(${polysWkt.join(', ')})`;
      }
    }

    return '';
  }
}
