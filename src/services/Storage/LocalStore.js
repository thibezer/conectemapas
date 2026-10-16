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
const _tombstoneCache = new Map();

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

  /** Manifesto só se for deste projeto (o manifesto é único; outro projeto aberto antes não pode vazar). */
  static loadManifestFor(projectId) {
    const manifest = this.loadManifest();
    return manifest && (!manifest.id || manifest.id === projectId) ? manifest : null;
  }

  /** Apaga as chaves síncronas do projeto: manifesto (se for dele), índice, tombstones, fila offline e cursor. */
  static purgeProject(projectId) {
    if (!projectId || typeof localStorage === 'undefined') return;
    try {
      const manifest = this.loadManifest();
      if (manifest && manifest.id === projectId) this.clearManifest();
      const list = this.listProjects().filter(p => p && p.id !== projectId);
      localStorage.setItem(PROJECTS_LIST_KEY, JSON.stringify(list));
      localStorage.removeItem(TOMBSTONES_KEY_PREFIX + projectId);
      _tombstoneCache.delete(projectId);
      localStorage.removeItem(PENDING_DELTAS_KEY_PREFIX + projectId);
      localStorage.removeItem(SYNC_CURSOR_KEY_PREFIX + projectId);
    } catch (e) {
      console.warn('[LocalStore] Falha ao limpar dados locais do projeto:', e);
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

  // Cache por projeto: só refaz o parse quando o texto gravado mudou (outra aba, testes),
  // evitando JSON.parse de até 2000 ids a cada consulta/gravação.
  static getLocalTombstones(projectId = 'projeto_padrao') {
    if (typeof localStorage === 'undefined') return new Set();
    try {
      const raw = localStorage.getItem(TOMBSTONES_KEY_PREFIX + projectId);
      const cached = _tombstoneCache.get(projectId);
      if (cached && cached.raw === raw) return cached.set;
      const set = raw ? new Set(JSON.parse(raw)) : new Set();
      _tombstoneCache.set(projectId, { raw, set });
      return set;
    } catch {
      return new Set();
    }
  }

  static _writeTombstones(projectId, set) {
    const arr = Array.from(set);
    if (arr.length > 2000) arr.splice(0, arr.length - 2000);
    const trimmed = arr.length !== set.size ? new Set(arr) : set;
    const raw = JSON.stringify(arr);
    localStorage.setItem(TOMBSTONES_KEY_PREFIX + projectId, raw);
    _tombstoneCache.set(projectId, { raw, set: trimmed });
  }

  static addLocalTombstone(featureId, projectId = 'projeto_padrao') {
    this.addLocalTombstones([featureId], projectId);
  }

  /** Marca vários ids com uma única gravação (exclusão em lote). */
  static addLocalTombstones(featureIds, projectId = 'projeto_padrao') {
    if (!Array.isArray(featureIds) || featureIds.length === 0 || typeof localStorage === 'undefined') return;
    try {
      const set = new Set(this.getLocalTombstones(projectId));
      let added = false;
      for (const id of featureIds) {
        if (id && !set.has(id)) { set.add(id); added = true; }
      }
      if (added) this._writeTombstones(projectId, set);
    } catch {}
  }

  static removeLocalTombstone(featureId, projectId = 'projeto_padrao') {
    this.removeLocalTombstones([featureId], projectId);
  }

  static removeLocalTombstones(featureIds, projectId = 'projeto_padrao') {
    if (!Array.isArray(featureIds) || featureIds.length === 0 || typeof localStorage === 'undefined') return;
    try {
      const current = this.getLocalTombstones(projectId);
      if (current.size === 0) return;
      let hit = false;
      for (const id of featureIds) {
        if (current.has(id)) { hit = true; break; }
      }
      if (!hit) return;
      const set = new Set(current);
      for (const id of featureIds) set.delete(id);
      this._writeTombstones(projectId, set);
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
