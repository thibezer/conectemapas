/* ==========================================================================
   ConecteMapas - DeltaQueue
   Gerenciamento de buffer local de deltas de feições (Dirty Tracking),
   agrupamento com debounce/max-wait e aplicação em lote.
   ========================================================================== */

import { GeoCompressor } from '../GeoCompressor.js';
import {
  DELTA_DEBOUNCE_MS,
  DELTA_MAX_WAIT_MS
} from './StorageConstants.js';
import { LocalStore } from './LocalStore.js';
import { CLOUD_ENABLED } from './StorageConstants.js';
import { IndexedDbStore } from './IndexedDbStore.js';

const _dirtyFeatures = new Map();
const _deletedFeatureIds = new Set();
let _deltaDebounceTimer = null;
let _deltaFirstQueuedAt = 0;
let _onCommitCallback = null;

export class DeltaQueue {
  static setCommitCallback(cb) {
    _onCommitCallback = cb;
  }

  static hasPendingLocalChange(featureId) {
    if (!featureId) return false;
    return _dirtyFeatures.has(featureId) || _deletedFeatureIds.has(featureId);
  }

  static queueFeatureUpsert(feature, projectId = 'projeto_padrao') {
    if (!feature || !feature.id) return;
    const compacted = GeoCompressor.compactFeatureForStorage(feature);
    const item = { ...compacted, projectId };
    _deletedFeatureIds.delete(feature.id);
    _dirtyFeatures.set(feature.id, item);
    // Regravar uma feição excluída antes (ex.: desfazer a exclusão) tira a tombstone local
    LocalStore.removeLocalTombstone(feature.id, projectId);
    LocalStore.persistPendingDeltasWithItems([item], [], projectId, projectId);
    this.commitDeltasDebounced(DELTA_DEBOUNCE_MS, projectId);
  }

  static queueFeaturesBulkUpsert(features, projectId = 'projeto_padrao') {
    if (!Array.isArray(features) || features.length === 0) return;
    const ids = [];
    const items = [];
    for (let i = 0; i < features.length; i++) {
      const feat = features[i];
      if (feat && feat.id) {
        const compacted = GeoCompressor.compactFeatureForStorage(feat);
        const item = { ...compacted, projectId };
        _deletedFeatureIds.delete(feat.id);
        _dirtyFeatures.set(feat.id, item);
        ids.push(feat.id);
        items.push(item);
      }
    }
    LocalStore.removeLocalTombstones(ids, projectId);
    if (items.length > 0) {
      LocalStore.persistPendingDeltasWithItems(items, [], projectId, projectId);
    }
    this.commitDeltasDebounced(DELTA_DEBOUNCE_MS, projectId);
  }

  static queueFeatureDelete(featureId, projectId = 'projeto_padrao') {
    if (!featureId) return;
    _dirtyFeatures.delete(featureId);
    _deletedFeatureIds.add(featureId);
    LocalStore.addLocalTombstone(featureId, projectId);
    LocalStore.persistPendingDeltasWithItems([], [featureId], projectId, projectId);
    this.commitDeltasDebounced(DELTA_DEBOUNCE_MS, projectId);
  }

  static async queueFeaturesBulkDelete(featureIds, projectId = 'projeto_padrao') {
    if (!Array.isArray(featureIds) || featureIds.length === 0) return;
    for (let i = 0; i < featureIds.length; i++) {
      const id = featureIds[i];
      if (id) {
        _dirtyFeatures.delete(id);
        _deletedFeatureIds.add(id);
      }
    }
    LocalStore.addLocalTombstones(featureIds, projectId);
    LocalStore.persistPendingDeltasWithItems([], featureIds, projectId, projectId);

    try {
      const db = await IndexedDbStore.getDB();
      if (db) {
        await new Promise((resolve) => {
          const tx = db.transaction('features', 'readwrite');
          const store = tx.objectStore('features');
          for (const id of featureIds) {
            store.delete(id);
          }
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
          tx.onabort = () => resolve(false);
        });
      }
    } catch (e) {
      console.warn('[DeltaQueue] Erro ao deletar lote do IndexedDB:', e);
    }

    this.commitDeltasDebounced(100, projectId);
  }

  static commitDeltasDebounced(delayMs = DELTA_DEBOUNCE_MS, projectId = 'projeto_padrao') {
    const now = Date.now();
    if (!_deltaFirstQueuedAt) _deltaFirstQueuedAt = now;
    if (_deltaDebounceTimer) clearTimeout(_deltaDebounceTimer);

    const maxWaitLeft = Math.max(0, DELTA_MAX_WAIT_MS - (now - _deltaFirstQueuedAt));
    _deltaDebounceTimer = setTimeout(() => {
      _deltaDebounceTimer = null;
      this.commitDeltas(projectId);
    }, Math.min(delayMs, maxWaitLeft));
  }

  static async commitDeltas(projectId = 'projeto_padrao') {
    _deltaFirstQueuedAt = 0;
    if (_deltaDebounceTimer) {
      clearTimeout(_deltaDebounceTimer);
      _deltaDebounceTimer = null;
    }

    if (_dirtyFeatures.size === 0 && _deletedFeatureIds.size === 0) {
      return true;
    }

    const toUpsert = Array.from(_dirtyFeatures.values());
    const toDelete = Array.from(_deletedFeatureIds);
    _dirtyFeatures.clear();
    _deletedFeatureIds.clear();

    if (typeof _onCommitCallback === 'function') {
      _onCommitCallback(toUpsert, toDelete, projectId);
    }

    const ok = await IndexedDbStore.commitDeltasToDb(toUpsert, toDelete);
    // No modo local (sem backend em nuvem), o IndexedDB é o destino final: evita acúmulo infinito em cm_pending_deltas_
    if (ok && !CLOUD_ENABLED && (toUpsert.length > 0 || toDelete.length > 0)) {
      LocalStore.removeConfirmedDeltas(
        toUpsert,
        toDelete,
        projectId,
        projectId,
        (id) => this.hasPendingLocalChange(id)
      );
    }
    return ok;
  }

  /** Esquece o que está na fila sem gravar (projeto excluído). */
  static discardPending(projectId = 'projeto_padrao') {
    this.cancelTimers();
    _dirtyFeatures.clear();
    _deletedFeatureIds.clear();
    LocalStore.clearPendingDeltas(projectId, projectId);
  }

  static cancelTimers() {
    if (_deltaDebounceTimer) {
      clearTimeout(_deltaDebounceTimer);
      _deltaDebounceTimer = null;
    }
    _deltaFirstQueuedAt = 0;
  }
}
