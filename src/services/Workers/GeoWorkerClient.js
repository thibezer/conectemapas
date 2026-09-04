/* ==========================================================================
   ConecteMapas - GeoWorkerClient
   Responsabilidade Única: Cliente assíncrono para despachar operações pesadas
   para o Web Worker com fallback resiliente para main-thread se desativado.
   ========================================================================== */

import { normalizeFeature } from '../MockData.js';

export class GeoWorkerClient {
  constructor() {
    this.worker = null;
    this.pendingCalls = new Map();
    this.callIdCounter = 0;
    this.initWorker();
  }

  initWorker() {
    try {
      if (typeof Worker !== 'undefined') {
        this.worker = new Worker(new URL('./geoWorker.js', import.meta.url), { type: 'module' });
        this.worker.onmessage = (e) => {
          const { id, success, data, error } = e.data;
          const promiseObj = this.pendingCalls.get(id);
          if (promiseObj) {
            this.pendingCalls.delete(id);
            if (success) {
              promiseObj.resolve(data);
            } else {
              promiseObj.reject(new Error(error));
            }
          }
        };

        this.worker.onerror = (err) => {
          console.warn('[GeoWorkerClient] Erro no Worker:', err);
        };
      }
    } catch (e) {
      console.warn('[GeoWorkerClient] Web Worker não suportado ou bloqueado neste ambiente. Usando fallback.', e);
      this.worker = null;
    }
  }

  parseJSONAsync(jsonString) {
    if (!this.worker) {
      // Fallback síncrono caso Worker não esteja disponível
      return Promise.resolve(JSON.parse(jsonString));
    }

    const id = ++this.callIdCounter;
    return new Promise((resolve, reject) => {
      this.pendingCalls.set(id, { resolve, reject });
      this.worker.postMessage({ id, type: 'parse_json', jsonString });
    });
  }

  normalizeFeaturesAsync(features) {
    if (!Array.isArray(features) || features.length === 0) {
      return Promise.resolve([]);
    }

    if (!this.worker) {
      // Fallback síncrono resiliente caso Worker não esteja disponível
      return Promise.resolve(features.map(f => normalizeFeature(f)));
    }

    const id = ++this.callIdCounter;
    return new Promise((resolve, reject) => {
      this.pendingCalls.set(id, { resolve, reject });
      this.worker.postMessage({ id, type: 'normalize_features', features });
    });
  }

  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingCalls.clear();
  }
}

export const geoWorkerClient = new GeoWorkerClient();
