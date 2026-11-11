/* ==========================================================================
   ConecteMapas - GeometryNormalizer (Puro, Zero DOM)
   Fonte única de sanitização e normalização de coordenadas (profundidade 1..4)
   compartilhada entre thread principal, FeatureGeometryUtils e Web Worker.
   ========================================================================== */

export function openRing(pts) {
  if (!Array.isArray(pts) || pts.length < 3) return pts;
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (first && last && Math.abs(first[0] - last[0]) < 1e-7 && Math.abs(first[1] - last[1]) < 1e-7) {
    return pts.slice(0, -1);
  }
  return pts;
}

export function toLatLng(pt) {
  if (!pt) return null;
  let lat = NaN;
  let lng = NaN;
  if (Array.isArray(pt) && pt.length >= 2) {
    lat = Number(pt[0]);
    lng = Number(pt[1]);
  } else if (typeof pt === 'object') {
    lat = Number(pt.lat ?? pt.latitude);
    lng = Number(pt.lng ?? pt.longitude);
  }
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
}

function firstContent(arr) {
  if (!Array.isArray(arr)) return undefined;
  for (let i = 0; i < arr.length; i++) {
    const el = arr[i];
    if (el !== undefined && el !== null && (!Array.isArray(el) || el.length > 0)) {
      return el;
    }
  }
  return undefined;
}

function isVertex(v) {
  if (!v) return false;
  if (Array.isArray(v)) return v.length >= 2 && (typeof v[0] === 'number' || typeof v[0] === 'string');
  return typeof v === 'object' && ('lat' in v || 'latitude' in v);
}

export function normalizeCoordinates(coords, type) {
  if (!coords) return null;

  if (type === 'Point' || type === 'Circle' || type === 'Text') {
    return toLatLng(coords);
  }

  if ((type === 'Polygon' || type === 'LineString') && Array.isArray(coords)) {
    const isPoly = type === 'Polygon';
    const minPoints = isPoly ? 3 : 2;
    const normalizeRing = (ring) => {
      if (!Array.isArray(ring)) return null;
      const mapped = ring.map(toLatLng).filter(Boolean);
      const processed = isPoly ? openRing(mapped) : mapped;
      return processed.length >= minPoints ? processed : null;
    };

    const a0 = firstContent(coords);
    if (!a0) return null;

    // Profundidade 2: anel ou linha simples (aceita [lat, lng] e { lat, lng })
    if (isVertex(a0)) {
      return normalizeRing(coords);
    }

    if (Array.isArray(a0)) {
      const a1 = firstContent(a0);
      // Profundidade 4: MultiPolygon ([[[pt, ...], ...], ...])
      if (isPoly && Array.isArray(a1) && !isVertex(a1)) {
        const polys = coords
          .map((poly) => {
            if (!Array.isArray(poly)) return null;
            const rings = poly.map(normalizeRing).filter(Boolean);
            return rings.length > 0 ? rings : null;
          })
          .filter(Boolean);
        return polys.length > 0 ? polys : null;
      }

      // Profundidade 3: Polygon com furos ou MultiLineString
      const rings = coords.map(normalizeRing).filter(Boolean);
      return rings.length > 0 ? rings : null;
    }

    return normalizeRing(coords);
  }

  return coords;
}

export function normalizeFeatureBase(feat, fallbackColor = '#00E08A') {
  if (!feat) return feat;
  const defaultColor = feat.color || fallbackColor;
  return {
    ...feat,
    coordinates: normalizeCoordinates(feat.coordinates, feat.type),
    locked: feat.locked === true,
    style: {
      fillColor: feat.style?.fillColor || defaultColor,
      fillOpacity: feat.style?.fillOpacity !== undefined ? feat.style.fillOpacity : (feat.type === 'LineString' ? 1 : 0.35),
      strokeColor: feat.style?.strokeColor || defaultColor,
      strokeWidth: feat.style?.strokeWidth !== undefined ? feat.style.strokeWidth : 2.5,
      strokeDashArray: feat.style?.strokeDashArray || '',
      markerIcon: feat.style?.markerIcon || 'pin',
      markerSize: feat.style?.markerSize || 24,
      markerRotation: feat.style?.markerRotation || 0,
      showLabel: feat.style?.showLabel || false,
      labelField: feat.style?.labelField || 'name',
      ...(feat.style || {})
    },
    customAttributes: Array.isArray(feat.customAttributes) ? feat.customAttributes : [],
    history: Array.isArray(feat.history) ? feat.history.slice(0, 8) : []
  };
}
