/* ==========================================================================
   ConecteMapas - LocalStore
   Gerenciamento de armazenamento síncrono ultra-rápido (LocalStorage),
   manifesto de frame zero, tombstones locais, deltas pendentes e cursores.
   ========================================================================== */

import {
  STORAGE_KEY,
  PROJECTS_LIST_KEY,
  TOMBSTONES_KEY_PREFIX,
  PENDING_DELTAS_KEY_PREFIX,
  SYNC_CURSOR_KEY_PREFIX
} from './StorageConstants.js';

let _offlinePendingIds = null;
let _syncCursor = null;

export class LocalStore {
  /**
   * Reseta o cache em memória quando o projeto ativo for alterado
   */
  static resetProjectCache() {
    _syncCursor = null;
    _offlinePendingIds = null;
  }

  // ---- MANIFESTO SÍNCRONO (FRAME ZERO) ----

  static loadManifest() {
    try {
      if (typeof localStorage === 'undefined') return null;
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.features)) {
        parsed.features = [];
      }
      return parsed;
    } catch (e) {
      console.error('[LocalStore] Erro ao carregar manifesto do LocalStorage:', e);
      return null;
    }
  }

  static saveManifest(manifest) {
    if (typeof localStorage === 'undefined') return false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(manifest));
      return true;
    } catch (err) {
      console.warn('[LocalStore] Falha ao gravar manifesto no LocalStorage:', err);
      return false;
    }
  }

  static clearManifest() {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
    }
  }

  // ---- ÍNDICE DE PROJETOS ----

  static listProjects() {
    try {
      if (typeof localStorage === 'undefined') return [];
      const raw = localStorage.getItem(PROJECTS_LIST_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  static updateProjectsIndex(project) {
    try {
      if (typeof localStorage === 'undefined') return;
      let list = this.listProjects();
      const existingIdx = list.findIndex(p => p.id === project.id);
      const meta = {
        id: project.id,
        name: project.name,
        updatedAt: project.updatedAt || new Date().toISOString(),
        featureCount: project.featureCount !== undefined
          ? project.featureCount
          : (project.features ? project.features.length : 0),
        layerCount: project.layers ? project.layers.length : 0
      };

      if (existingIdx >= 0) {
        list[existingIdx] = meta;
      } else {
        list.unshift(meta);
      }
      localStorage.setItem(PROJECTS_LIST_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('[LocalStore] Falha ao atualizar índice de projetos:', e);
    }
  }

  // ---- TOMBSTONES LOCAIS ----

  static getLocalTombstones(projectId = 'projeto_padrao') {
    if (typeof localStorage === 'undefined') return new Set();
    try {
      const raw = localStorage.getItem(TOMBSTONES_KEY_PREFIX + projectId);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  }

  static addLocalTombstone(featureId, projectId = 'projeto_padrao') {
    if (!featureId || typeof localStorage === 'undefined') return;
    try {
      const set = this.getLocalTombstones(projectId);
      set.add(featureId);
      const arr = Array.from(set);
      if (arr.length > 2000) arr.splice(0, arr.length - 2000);
      localStorage.setItem(TOMBSTONES_KEY_PREFIX + projectId, JSON.stringify(arr));
    } catch {}
  }

  static removeLocalTombstone(featureId, projectId = 'projeto_padrao') {
    if (!featureId || typeof localStorage === 'undefined') return;
    try {
      const set = this.getLocalTombstones(projectId);
      if (set.has(featureId)) {
        set.delete(featureId);
        localStorage.setItem(TOMBSTONES_KEY_PREFIX + projectId, JSON.stringify(Array.from(set)));
      }
    } catch {}
  }

  static hasLocalTombstone(featureId, projectId = 'projeto_padrao') {
    return this.getLocalTombstones(projectId).has(featureId);
  }

  // ---- DELTAS PENDENTES (OFFLINE RETRY) ----

  static readPendingDeltas(projectId = 'projeto_padrao') {
    if (typeof localStorage === 'undefined') return { dirty: [], deleted: [] };
    try {
      const raw = localStorage.getItem(PENDING_DELTAS_KEY_PREFIX + projectId);
      if (!raw) return { dirty: [], deleted: [] };
      const parsed = JSON.parse(raw);
      return {
        dirty: Array.isArray(parsed.dirty) ? parsed.dirty : [],
        deleted: Array.isArray(parsed.deleted) ? parsed.deleted : []
      };
    } catch {
      return { dirty: [], deleted: [] };
    }
  }

  static mergeDeltas(base, toUpsert = [], toDelete = []) {
    const dirtyMap = new Map((base.dirty || []).map(f => [f.id, f]));
    const delSet = new Set(base.deleted || []);
    for (const id of toDelete) {
      if (id) {
        dirtyMap.delete(id);
        delSet.add(id);
      }
    }
    for (const f of toUpsert) {
      if (f && f.id) {
        delSet.delete(f.id);
        dirtyMap.set(f.id, f);
      }
    }
    return { dirty: Array.from(dirtyMap.values()), deleted: Array.from(delSet) };
  }

  static refreshOfflinePendingCache(projectId, currentProjectId, merged) {
    if (projectId !== currentProjectId) return;
    _offlinePendingIds = new Set([
      ...merged.dirty.map(f => f.id),
      ...merged.deleted
    ]);
  }

  static persistPendingDeltasWithItems(toUpsert = [], toDelete = [], projectId = 'projeto_padrao', currentProjectId = 'projeto_padrao') {
    if (typeof localStorage === 'undefined') return;
    try {
      const key = PENDING_DELTAS_KEY_PREFIX + projectId;
      const merged = this.mergeDeltas(this.readPendingDeltas(projectId), toUpsert, toDelete);

      if (merged.dirty.length === 0 && merged.deleted.length === 0) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(merged));
      }
      this.refreshOfflinePendingCache(projectId, currentProjectId, merged);
    } catch {}
  }

  static clearPendingDeltas(projectId = 'projeto_padrao', currentProjectId = 'projeto_padrao') {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.removeItem(PENDING_DELTAS_KEY_PREFIX + projectId);
      this.refreshOfflinePendingCache(projectId, currentProjectId, { dirty: [], deleted: [] });
    } catch {}
  }

  static getOfflinePendingIds(currentProjectId = 'projeto_padrao') {
    if (_offlinePendingIds === null) {
      const pending = this.readPendingDeltas(currentProjectId);
      _offlinePendingIds = new Set([...pending.dirty.map(f => f && f.id), ...pending.deleted].filter(Boolean));
    }
    return _offlinePendingIds;
  }

  // ---- CURSOR DE REVISÃO PERSISTIDO ----

  static loadSyncCursor(projectId = 'projeto_padrao') {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(SYNC_CURSOR_KEY_PREFIX + projectId);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && Number.isFinite(parsed.rev)) {
            return { rev: parsed.rev, id: typeof parsed.id === 'string' ? parsed.id : '' };
          }
        }
      }
    } catch {}
    return { rev: 0, id: '' };
  }

  static saveSyncCursor(projectId, cursor) {
    _syncCursor = { rev: cursor.rev, id: cursor.id || '' };
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SYNC_CURSOR_KEY_PREFIX + projectId, JSON.stringify(_syncCursor));
      }
    } catch {}
    return _syncCursor;
  }

  static getCachedSyncCursor(projectId = 'projeto_padrao') {
    if (!_syncCursor) {
      _syncCursor = this.loadSyncCursor(projectId);
    }
    return { ..._syncCursor };
  }
}
