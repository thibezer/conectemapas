/* ==========================================================================
   ConecteMapas - GeoWorker (Background Thread Parser & Processor)
   Responsabilidade Única: Processamento assíncrono de parsing, serialização
   e normalização em lote de geometrias fora da thread principal.
   ========================================================================== */

import { normalizeFeatureBase } from '../MapEngine/GeometryNormalizer.js';

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
      const normalized = [];
      for (let i = 0; i < features.length; i++) {
        const norm = normalizeFeatureBase(features[i]);
        if (norm && norm.coordinates !== null) {
          normalized.push(norm);
        }
      }
      self.postMessage({ id, success: true, data: normalized });
    } else {
      self.postMessage({ id, success: false, error: 'Operação não suportada' });
    }
  } catch (err) {
    self.postMessage({ id, success: false, error: err.message });
  }
};
