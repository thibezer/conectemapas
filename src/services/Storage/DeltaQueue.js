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

const _queuesByProject = new Map();
let _defaultProjectId = 'projeto_padrao';
let _onCommitCallback = null;

function _getQueue(projectId = null, create = false) {
  const pid = projectId || _defaultProjectId || 'projeto_padrao';
  let q = _queuesByProject.get(pid);
  if (!q && create) {
    q = { dirty: new Map(), deleted: new Set(), timer: null, firstQueuedAt: 0 };
    _queuesByProject.set(pid, q);
  }
  return { pid, q };
}

export class DeltaQueue {
  static setCurrentProjectId(projectId) {
    if (projectId && typeof projectId === 'string') {
      _defaultProjectId = projectId.trim() || 'projeto_padrao';
    }
  }

  static setCommitCallback(cb) {
    _onCommitCallback = cb;
  }

  static hasPendingLocalChange(featureId, projectId = null) {
    if (!featureId) return false;
    if (projectId) {
      const { q } = _getQueue(projectId, false);
      return !!(q && (q.dirty.has(featureId) || q.deleted.has(featureId)));
    }
    for (const q of _queuesByProject.values()) {
      if (q.dirty.has(featureId) || q.deleted.has(featureId)) return true;
    }
    return false;
  }

  static queueFeatureUpsert(feature, projectId = null) {
    if (!feature || !feature.id) return;
    const { pid, q } = _getQueue(projectId, true);
    const compacted = GeoCompressor.compactFeatureForStorage(feature);
    const item = { ...compacted, projectId: pid };
    q.deleted.delete(feature.id);
    q.dirty.set(feature.id, item);
    // Regravar uma feição excluída antes (ex.: desfazer a exclusão) tira a tombstone local
    LocalStore.removeLocalTombstone(feature.id, pid);
    LocalStore.persistPendingDeltasWithItems([item], [], pid, pid);
    this.commitDeltasDebounced(DELTA_DEBOUNCE_MS, pid);
  }

  static queueFeaturesBulkUpsert(features, projectId = null) {
    if (!Array.isArray(features) || features.length === 0) return;
    const { pid, q } = _getQueue(projectId, true);
    const ids = [];
    const items = [];
    for (let i = 0; i < features.length; i++) {
      const feat = features[i];
      if (feat && feat.id) {
        const compacted = GeoCompressor.compactFeatureForStorage(feat);
        const item = { ...compacted, projectId: pid };
        q.deleted.delete(feat.id);
        q.dirty.set(feat.id, item);
        ids.push(feat.id);
        items.push(item);
      }
    }
    LocalStore.removeLocalTombstones(ids, pid);
    if (items.length > 0) {
      LocalStore.persistPendingDeltasWithItems(items, [], pid, pid);
    }
    this.commitDeltasDebounced(DELTA_DEBOUNCE_MS, pid);
  }

  static queueFeatureDelete(featureId, projectId = null) {
    if (!featureId) return;
    const { pid, q } = _getQueue(projectId, true);
    q.dirty.delete(featureId);
    q.deleted.add(featureId);
    LocalStore.addLocalTombstone(featureId, pid);
    LocalStore.persistPendingDeltasWithItems([], [featureId], pid, pid);
    this.commitDeltasDebounced(DELTA_DEBOUNCE_MS, pid);
  }

  static async queueFeaturesBulkDelete(featureIds, projectId = null) {
    if (!Array.isArray(featureIds) || featureIds.length === 0) return;
    const { pid, q } = _getQueue(projectId, true);
    for (let i = 0; i < featureIds.length; i++) {
      const id = featureIds[i];
      if (id) {
        q.dirty.delete(id);
        q.deleted.add(id);
      }
    }
    LocalStore.addLocalTombstones(featureIds, pid);
    LocalStore.persistPendingDeltasWithItems([], featureIds, pid, pid);

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

    this.commitDeltasDebounced(100, pid);
  }

  static commitDeltasDebounced(delayMs = DELTA_DEBOUNCE_MS, projectId = null) {
    const { pid, q } = _getQueue(projectId, true);
    const now = Date.now();
    if (!q.firstQueuedAt) q.firstQueuedAt = now;
    if (q.timer) clearTimeout(q.timer);

    const maxWaitLeft = Math.max(0, DELTA_MAX_WAIT_MS - (now - q.firstQueuedAt));
    q.timer = setTimeout(() => {
      q.timer = null;
      this.commitDeltas(pid);
    }, Math.min(delayMs, maxWaitLeft));
  }

  static async commitDeltas(projectId = null, options = {}) {
    const { pid, q } = _getQueue(projectId, false);
    if (!q) return true;

    q.firstQueuedAt = 0;
    if (q.timer) {
      clearTimeout(q.timer);
      q.timer = null;
    }

    if (q.dirty.size === 0 && q.deleted.size === 0) {
      return true;
    }

    const toUpsert = Array.from(q.dirty.values());
    const toDelete = Array.from(q.deleted);
    q.dirty.clear();
    q.deleted.clear();

    let cloudPromise = null;
    if (typeof _onCommitCallback === 'function') {
      cloudPromise = Promise.resolve(_onCommitCallback(toUpsert, toDelete, pid)).catch(() => false);
    }

    const dbPromise = IndexedDbStore.commitDeltasToDb(toUpsert, toDelete);
    const ok = options && options.waitForCloud && cloudPromise
      ? (await Promise.all([dbPromise, cloudPromise]))[0]
      : await dbPromise;

    // No modo local (sem backend em nuvem), o IndexedDB é o destino final: evita acúmulo infinito em cm_pending_deltas_
    if (ok && !CLOUD_ENABLED && (toUpsert.length > 0 || toDelete.length > 0)) {
      LocalStore.removeConfirmedDeltas(
        toUpsert,
        toDelete,
        pid,
        pid,
        (id) => this.hasPendingLocalChange(id, pid)
      );
    }
    return ok;
  }

  /** Esquece o que está na fila sem gravar (projeto excluído). */
  static discardPending(projectId = null) {
    if (!projectId) {
      for (const [pid, q] of _queuesByProject.entries()) {
        if (q.timer) clearTimeout(q.timer);
        LocalStore.clearPendingDeltas(pid, pid);
      }
      _queuesByProject.clear();
      LocalStore.clearPendingDeltas(_defaultProjectId, _defaultProjectId);
      return;
    }
    const { pid, q } = _getQueue(projectId, false);
    if (q) {
      if (q.timer) clearTimeout(q.timer);
      _queuesByProject.delete(pid);
    }
    LocalStore.clearPendingDeltas(pid, pid);
  }

  static cancelTimers(projectId = null) {
    if (!projectId) {
      for (const q of _queuesByProject.values()) {
        if (q.timer) {
          clearTimeout(q.timer);
          q.timer = null;
        }
        q.firstQueuedAt = 0;
      }
      return;
    }
    const { q } = _getQueue(projectId, false);
    if (q) {
      if (q.timer) {
        clearTimeout(q.timer);
        q.timer = null;
      }
      q.firstQueuedAt = 0;
    }
  }
}
