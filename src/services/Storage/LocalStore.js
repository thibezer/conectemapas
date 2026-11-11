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

const _offlinePendingIdsByProject = new Map();
const _syncCursorByProject = new Map();
const _tombstoneCache = new Map();

// Fila em memória de deltas pendentes ainda não gravados no localStorage
const PENDING_WRITE_DELAY_MS = 250;
const _queuedPendingWrites = new Map();
let _queuedPendingTimer = null;

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  const flushOnLeave = () => LocalStore.flushQueuedPendingWrites();
  window.addEventListener('pagehide', flushOnLeave);
  window.addEventListener('beforeunload', flushOnLeave);
}

export class LocalStore {
  /**
   * Reseta o cache em memória quando o projeto ativo for alterado
   */
  static resetProjectCache() {
    _syncCursorByProject.clear();
    _offlinePendingIdsByProject.clear();
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
    // Grava antes o que ainda está só na fila em memória (leitura sempre consistente)
    this.flushQueuedPendingWrites();
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
    _offlinePendingIdsByProject.set(projectId, new Set([
      ...merged.dirty.map(f => f.id),
      ...merged.deleted
    ]));
  }

  /**
   * Enfileira deltas para o localStorage. A gravação é agrupada (uma só por ~250 ms e no
   * fechamento da aba): reler/regravar todo o JSON pendente a cada edição travava o canvas
   * em projetos com muitas feições.
   */
  static persistPendingDeltasWithItems(toUpsert = [], toDelete = [], projectId = 'projeto_padrao', currentProjectId = 'projeto_padrao') {
    if (typeof localStorage === 'undefined') return;
    try {
      let q = _queuedPendingWrites.get(projectId);
      if (!q) {
        q = { upsert: new Map(), del: new Set() };
        _queuedPendingWrites.set(projectId, q);
      }
      for (const id of toDelete || []) {
        if (!id) continue;
        q.upsert.delete(id);
        q.del.add(id);
      }
      for (const f of toUpsert || []) {
        if (f && f.id) {
          q.del.delete(f.id);
          q.upsert.set(f.id, f);
        }
      }
      // Mantém o cache de ids pendentes atualizado sem reler o localStorage
      const ids = _offlinePendingIdsByProject.get(projectId);
      if (ids) {
        for (const f of toUpsert || []) if (f && f.id) ids.add(f.id);
        for (const id of toDelete || []) if (id) ids.add(id);
      }
      if (!_queuedPendingTimer) {
        _queuedPendingTimer = setTimeout(() => this.flushQueuedPendingWrites(), PENDING_WRITE_DELAY_MS);
      }
    } catch {}
  }

  /** Grava de uma vez tudo que está na fila em memória. */
  static flushQueuedPendingWrites() {
    if (_queuedPendingTimer) {
      clearTimeout(_queuedPendingTimer);
      _queuedPendingTimer = null;
    }
    if (_queuedPendingWrites.size === 0 || typeof localStorage === 'undefined') return;
    const batches = Array.from(_queuedPendingWrites.entries());
    _queuedPendingWrites.clear();
    for (const [projectId, q] of batches) {
      const key = PENDING_DELTAS_KEY_PREFIX + projectId;
      let merged = null;
      try {
        merged = this.mergeDeltas(this.readPendingDeltas(projectId), Array.from(q.upsert.values()), Array.from(q.del));
        if (merged.dirty.length === 0 && merged.deleted.length === 0) {
          localStorage.removeItem(key);
        } else {
          localStorage.setItem(key, JSON.stringify(merged));
        }
        this.refreshOfflinePendingCache(projectId, projectId, merged);
      } catch (err) {
        if (merged) {
          // Mantém o rastreamento em memória mesmo se o localStorage atingir cota máxima
          this.refreshOfflinePendingCache(projectId, projectId, merged);
        }
        console.warn('[LocalStore] Falha ao persistir pendências em localStorage:', err?.name || err);
      }
    }
  }

  static clearPendingDeltas(projectId = 'projeto_padrao', currentProjectId = 'projeto_padrao') {
    if (typeof localStorage === 'undefined') return;
    _queuedPendingWrites.delete(projectId);
    try {
      localStorage.removeItem(PENDING_DELTAS_KEY_PREFIX + projectId);
      this.refreshOfflinePendingCache(projectId, currentProjectId, { dirty: [], deleted: [] });
    } catch {}
  }

  /**
   * Remove da fila de deltas pendentes apenas o que foi efetivamente confirmado pela nuvem,
   * preservando qualquer nova edição ou exclusão enfileirada enquanto o envio estava em trânsito.
   */
  static removeConfirmedDeltas(confirmedUpsert = [], confirmedDelete = [], projectId = 'projeto_padrao', currentProjectId = 'projeto_padrao', isStillDirtyFn = null) {
    if (typeof localStorage === 'undefined') return;
    try {
      const key = PENDING_DELTAS_KEY_PREFIX + projectId;
      const current = this.readPendingDeltas(projectId);
      if (current.dirty.length === 0 && current.deleted.length === 0) {
        this.refreshOfflinePendingCache(projectId, currentProjectId, { dirty: [], deleted: [] });
        return;
      }

      const confirmedUpsertById = new Map((confirmedUpsert || []).filter(f => f && f.id).map(f => [f.id, f]));
      const confirmedDeleteSet = new Set((confirmedDelete || []).filter(Boolean));

      const remainingDirty = current.dirty.filter((f) => {
        if (!f || !f.id) return false;
        if (typeof isStillDirtyFn === 'function' && isStillDirtyFn(f.id)) return true;
        if (!confirmedUpsertById.has(f.id)) return true;
        const sent = confirmedUpsertById.get(f.id);
        return !this._sameFeatureState(f, sent);
      });

      const remainingDeleted = current.deleted.filter((id) => {
        if (!id) return false;
        if (typeof isStillDirtyFn === 'function' && isStillDirtyFn(id)) return true;
        return !confirmedDeleteSet.has(id);
      });

      const next = { dirty: remainingDirty, deleted: remainingDeleted };
      if (next.dirty.length === 0 && next.deleted.length === 0) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(next));
      }
      this.refreshOfflinePendingCache(projectId, currentProjectId, next);
    } catch {}
  }

  static _coordsEqual(a, b) {
    if (a === b) return true;
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      const va = a[i];
      const vb = b[i];
      if (va === vb) continue;
      if (Array.isArray(va)) {
        if (!this._coordsEqual(va, vb)) return false;
      } else if (va !== vb) {
        return false;
      }
    }
    return true;
  }

  static _sameFeatureState(a, b) {
    if (a === b) return true;
    if (!a || !b) return false;
    if (
      a.name !== b.name ||
      a.type !== b.type ||
      a.layerId !== b.layerId ||
      a.color !== b.color ||
      a.status !== b.status ||
      !!a.locked !== !!b.locked ||
      a.visible !== b.visible ||
      a.radius !== b.radius ||
      a.description !== b.description ||
      a.category !== b.category ||
      a.updatedAt !== b.updatedAt
    ) {
      return false;
    }
    if (a.style !== b.style && JSON.stringify(a.style || null) !== JSON.stringify(b.style || null)) return false;
    if (a.properties !== b.properties && JSON.stringify(a.properties || null) !== JSON.stringify(b.properties || null)) return false;
    return this._coordsEqual(a.coordinates, b.coordinates);
  }

  static getOfflinePendingIds(currentProjectId = 'projeto_padrao') {
    if (!_offlinePendingIdsByProject.has(currentProjectId)) {
      const pending = this.readPendingDeltas(currentProjectId);
      _offlinePendingIdsByProject.set(currentProjectId, new Set([...pending.dirty.map(f => f && f.id), ...pending.deleted].filter(Boolean)));
    }
    return _offlinePendingIdsByProject.get(currentProjectId);
  }

  // ---- CURSOR DE REVISÃO PERSISTIDO ----

  static loadSyncCursor(projectId = 'projeto_padrao') {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(SYNC_CURSOR_KEY_PREFIX + projectId);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && Number.isFinite(parsed.rev)) {
            const cursor = { rev: parsed.rev, id: typeof parsed.id === 'string' ? parsed.id : '' };
            _syncCursorByProject.set(projectId, cursor);
            return cursor;
          }
        }
      }
    } catch {}
    const zero = { rev: 0, id: '' };
    _syncCursorByProject.set(projectId, zero);
    return zero;
  }

  static saveSyncCursor(projectId, cursor) {
    const clean = { rev: cursor.rev, id: cursor.id || '' };
    _syncCursorByProject.set(projectId, clean);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SYNC_CURSOR_KEY_PREFIX + projectId, JSON.stringify(clean));
      }
    } catch {}
    return clean;
  }

  static getCachedSyncCursor(projectId = 'projeto_padrao') {
    if (!_syncCursorByProject.has(projectId)) {
      return this.loadSyncCursor(projectId);
    }
    return { ..._syncCursorByProject.get(projectId) };
  }

  // ---- HISTÓRICO LOCAL DO CHAT DA EQUIPE ----

  static loadChatMessages(projectId = 'projeto_padrao') {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(`cm_chat_messages_${projectId}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        }
      }
    } catch {}
    return [];
  }

  static saveChatMessages(messages = [], projectId = 'projeto_padrao') {
    try {
      if (typeof localStorage !== 'undefined') {
        const list = Array.isArray(messages) ? messages.slice(-100) : [];
        localStorage.setItem(`cm_chat_messages_${projectId}`, JSON.stringify(list));
      }
    } catch {}
  }
}
