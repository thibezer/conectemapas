/* ==========================================================================
   ConecteMapas - GeoWorker (Background Thread Parser & Processor)
   Responsabilidade Única: Processamento assíncrono de parsing, serialização
   e normalização em lote de geometrias fora da thread principal.
   ========================================================================== */

function normalizeCoordinates(coords, type) {
  if (!coords) return coords;
  if (type === 'Point' || type === 'Circle') {
    if (typeof coords === 'object' && !Array.isArray(coords) && coords.lat !== undefined) {
      return [Number(coords.lat), Number(coords.lng)];
    }
    if (Array.isArray(coords) && coords.length >= 2) {
      return [Number(coords[0]), Number(coords[1])];
    }
    return coords;
  }
  if ((type === 'Polygon' || type === 'LineString') && Array.isArray(coords)) {
    if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
      return coords.map(ring => ring.map(pt => (pt && typeof pt === 'object' && !Array.isArray(pt) && pt.lat !== undefined) ? [Number(pt.lat), Number(pt.lng)] : pt));
    }
    return coords.map(pt => (pt && typeof pt === 'object' && !Array.isArray(pt) && pt.lat !== undefined) ? [Number(pt.lat), Number(pt.lng)] : pt);
  }
  return coords;
}

function normalizeSingleFeature(feat, defaultColor = '#00E08A') {
  if (!feat) return feat;
  const color = feat.color || defaultColor;
  return {
    ...feat,
    coordinates: normalizeCoordinates(feat.coordinates, feat.type),
    locked: feat.locked === true,
    style: {
      fillColor: feat.style?.fillColor || color,
      fillOpacity: feat.style?.fillOpacity !== undefined ? feat.style.fillOpacity : (feat.type === 'LineString' ? 1 : 0.35),
      strokeColor: feat.style?.strokeColor || color,
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

self.onmessage = async (e) => {
  const { id, type, jsonString, features } = e.data;

  try {
    if (type === 'parse_json') {
      const parsed = JSON.parse(jsonString);
      self.postMessage({ id, success: true, data: parsed });
    } else if (type === 'normalize_features') {
      if (!Array.isArray(features)) {
        self.postMessage({ id, success: true, data: [] });
        return;
      }
      const len = features.length;
      const normalized = new Array(len);
      for (let i = 0; i < len; i++) {
        normalized[i] = normalizeSingleFeature(features[i]);
      }
      self.postMessage({ id, success: true, data: normalized });
    } else {
      self.postMessage({ id, success: false, error: 'Operação não suportada' });
    }
  } catch (err) {
    self.postMessage({ id, success: false, error: err.message });
  }
};
