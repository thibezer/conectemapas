/* ==========================================================================
   ConecteMapas - GeoWorker (Background Thread Parser & Processor)
   Responsabilidade Única: Processamento assíncrono de parsing, serialização
   e normalização em lote de geometrias fora da thread principal.
   ========================================================================== */

function normalizeSingleFeature(feat, defaultColor = '#00E08A') {
  if (!feat) return feat;
  const color = feat.color || defaultColor;
  return {
    ...feat,
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
