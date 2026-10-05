/* ==========================================================================
   ConecteMapas - CloudSyncEngine
   Sincronização em nuvem e colaboração em tempo real (Hostinger LiteSpeed MySQL).
   Respeita a Regra 5 do GEMINI.md:
   - Cursor por revisão (rev, id), nunca por relógio
   - Edição local vence enquanto não confirmada (hasPendingLocalChange)
   - Envio serializado em fila única de POSTs (_enqueuePush)
   - keepalive só abaixo de 60 KB
   ========================================================================== */

import { CLOUD_API_URL } from './StorageConstants.js';
import { LocalStore } from './LocalStore.js';
import { DeltaQueue } from './DeltaQueue.js';

const _clientId = 'cli_' + (typeof crypto !== 'undefined' && crypto.randomUUID
  ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  : Math.random().toString(36).substring(2, 12) + Date.now().toString(36));

// Campos da feição que a API não possui como coluna: viajam empacotados em
// properties._cm e são restaurados no recebimento (compatível com o servidor atual).
const CLOUD_META_FIELDS = ['description', 'category', 'locked', 'status', 'customAttributes'];
const CLOUD_META_KEY = '_cm';

function packFeatureForCloud(feat) {
  if (!feat || typeof feat !== 'object') return feat;
  const meta = {};
  for (const key of CLOUD_META_FIELDS) {
    const val = feat[key];
    if (val === undefined || val === null || val === '' || val === false) continue;
    if (Array.isArray(val) && val.length === 0) continue;
    meta[key] = val;
  }
  const props = (feat.properties && typeof feat.properties === 'object' && !Array.isArray(feat.properties))
    ? { ...feat.properties }
    : {};
  delete props[CLOUD_META_KEY];
  if (Object.keys(meta).length > 0) props[CLOUD_META_KEY] = meta;
  return { ...feat, properties: props };
}

function unpackFeatureFromCloud(feat) {
  if (!feat || !feat.properties || typeof feat.properties !== 'object') return feat;
  const meta = feat.properties[CLOUD_META_KEY];
  if (!meta || typeof meta !== 'object') return feat;
  const props = { ...feat.properties };
  delete props[CLOUD_META_KEY];
  const restored = { ...feat, properties: props };
  for (const key of CLOUD_META_FIELDS) {
    if (meta[key] !== undefined) restored[key] = meta[key];
  }
  return restored;
}

let _cloudStatus = {
  connected: false,
  lastCheck: null,
  latencyMs: null,
  database: 'u941736878_conectemapas',
  syncing: false,
  lastSyncedAt: null,
  error: null
};
const _cloudStatusListeners = new Set();
let _cloudMetaDebounceTimer = null;
let _pendingMetaForCloud = null;
let _layerSyncInFlight = 0;
let _cloudProjectDebounceTimer = null;

let _pushChain = Promise.resolve();
const _inFlightCounts = new Map();
const _localWriteRev = new Map();
const _appliedRevs = new Map();
let _offlineFlushPromise = null;

// Conecta o callback do DeltaQueue para disparar o sync remoto
DeltaQueue.setCommitCallback((toUpsert, toDelete, projectId) => {
  CloudSyncEngine.syncDeltasToCloud(toUpsert, toDelete, projectId);
});

export { packFeatureForCloud, unpackFeatureFromCloud };

export class CloudSyncEngine {
  static getClientId() {
    return _clientId;
  }

  static getCloudStatus() {
    return { ..._cloudStatus };
  }

  static onCloudStatusChange(listener) {
    if (typeof listener === 'function') {
      _cloudStatusListeners.add(listener);
      try { listener(this.getCloudStatus()); } catch {}
    }
    return () => _cloudStatusListeners.delete(listener);
  }

  static _notifyCloudStatus() {
    const status = this.getCloudStatus();
    for (const listener of _cloudStatusListeners) {
      try { listener(status); } catch (e) {
        console.warn('[CloudSyncEngine] Erro no listener de status:', e);
      }
    }
  }

  static resetProjectState() {
    _localWriteRev.clear();
    _appliedRevs.clear();
  }

  static hasPendingLocalChange(featureId, currentProjectId = 'projeto_padrao') {
    if (!featureId) return false;
    return DeltaQueue.hasPendingLocalChange(featureId)
      || _inFlightCounts.has(featureId)
      || LocalStore.getOfflinePendingIds(currentProjectId).has(featureId);
  }

  static hasPendingOfflineDeltas(currentProjectId = 'projeto_padrao') {
    return LocalStore.getOfflinePendingIds(currentProjectId).size > 0;
  }

  static _postJson(action, payload) {
    const body = JSON.stringify(payload);
    return fetch(`${CLOUD_API_URL}?action=${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: body.length < 60000
    });
  }

  static _enqueuePush(ids, task) {
    for (const id of ids) {
      _inFlightCounts.set(id, (_inFlightCounts.get(id) || 0) + 1);
    }
    const run = async () => {
      try {
        return await task();
      } finally {
        for (const id of ids) {
          const n = (_inFlightCounts.get(id) || 1) - 1;
          if (n <= 0) _inFlightCounts.delete(id);
          else _inFlightCounts.set(id, n);
        }
      }
    };
    const p = _pushChain.then(run, run);
    _pushChain = p.catch(() => {});
    return p;
  }

  static async checkCloudConnection() {
    try {
      const start = performance.now();
      const res = await fetch(`${CLOUD_API_URL}?action=status`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        cache: 'no-cache'
      });

      if (res.ok) {
        const data = await res.json();
        const latency = Math.round(performance.now() - start);
        _cloudStatus = {
          connected: data.status === 'connected',
          lastCheck: new Date().toISOString(),
          latencyMs: latency,
          database: data.database || 'u941736878_conectemapas',
          server: data.server || 'srv1180.hstgr.io',
          mysqlVersion: data.mysql_version,
          counts: data.counts || null,
          syncing: false,
          lastSyncedAt: _cloudStatus.lastSyncedAt || new Date().toISOString(),
          error: null
        };
      } else {
        _cloudStatus.connected = false;
        _cloudStatus.error = `HTTP ${res.status}`;
      }
    } catch (err) {
      _cloudStatus.connected = false;
      _cloudStatus.error = err.message || 'Falha de rede';
    } finally {
      this._notifyCloudStatus();
    }
    return this.getCloudStatus();
  }

  static syncDeltasToCloud(toUpsert, toDelete, projectId = 'projeto_padrao') {
    const upserts = Array.isArray(toUpsert) ? toUpsert : [];
    const deletes = Array.isArray(toDelete) ? toDelete : [];
    if (upserts.length === 0 && deletes.length === 0) return Promise.resolve(true);

    const ids = [...upserts.map(f => f && f.id).filter(Boolean), ...deletes];
    return this._enqueuePush(ids, () => this._pushDeltas(upserts, deletes, projectId));
  }

  static async _pushDeltas(toUpsert, toDelete, projectId) {
    const merged = LocalStore.mergeDeltas(LocalStore.readPendingDeltas(projectId), toUpsert, toDelete);
    if (merged.dirty.length === 0 && merged.deleted.length === 0) return true;

    try {
      _cloudStatus.syncing = true;
      this._notifyCloudStatus();

      const res = await this._postJson('sync_deltas', {
        projectId,
        clientId: _clientId,
        toUpsert: merged.dirty.map(packFeatureForCloud),
        toDelete: merged.deleted
      });

      if (res.status === 409) {
        // Trava anti-exclusão em massa do servidor: não reenfileira (evitaria loop infinito)
        LocalStore.clearPendingDeltas(projectId, projectId);
        _cloudStatus.error = 'Exclusão em massa bloqueada pelo servidor';
        console.warn('[CloudSyncEngine] Exclusão em massa bloqueada pelo servidor; nuvem preservada.');
        return false;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const resData = await res.json().catch(() => null);
      if (resData && Number.isFinite(resData.rev)) {
        for (const f of merged.dirty) _localWriteRev.set(f.id, resData.rev);
        for (const id of merged.deleted) _localWriteRev.set(id, resData.rev);
      }
      _cloudStatus.connected = true;
      _cloudStatus.lastSyncedAt = new Date().toISOString();
      _cloudStatus.error = null;
      LocalStore.clearPendingDeltas(projectId, projectId);
      return true;
    } catch (err) {
      console.warn('[CloudSyncEngine] Falha ao sincronizar deltas com nuvem (armazenado offline):', err);
      _cloudStatus.connected = false;
      _cloudStatus.error = err.message || 'Falha de rede';
      LocalStore.persistPendingDeltasWithItems(merged.dirty, merged.deleted, projectId, projectId);
      return false;
    } finally {
      _cloudStatus.syncing = false;
      this._notifyCloudStatus();
    }
  }

  static async flushPendingOfflineDeltas(projectId = 'projeto_padrao') {
    if (typeof localStorage === 'undefined') return true;
    const pending = LocalStore.readPendingDeltas(projectId);
    if (pending.dirty.length === 0 && pending.deleted.length === 0) return true;

    if (_offlineFlushPromise) return await _offlineFlushPromise;
    _offlineFlushPromise = this.syncDeltasToCloud(pending.dirty, pending.deleted, projectId);
    try {
      return await _offlineFlushPromise;
    } finally {
      _offlineFlushPromise = null;
    }
  }

  // Camadas/pastas editadas localmente e ainda não confirmadas pela nuvem.
  // Persistido em localStorage para sobreviver a um F5 antes do envio terminar.
  static _layerDirtyKey(projectId) {
    return `cm_layers_dirty_${projectId || 'projeto_padrao'}`;
  }

  static hasPendingLayerSync(projectId = 'projeto_padrao') {
    if (_cloudMetaDebounceTimer || _layerSyncInFlight > 0) return true;
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem(this._layerDirtyKey(projectId)) === '1';
    } catch {
      return false;
    }
  }

  static hasLayerSyncActive() {
    return !!_cloudMetaDebounceTimer || _layerSyncInFlight > 0;
  }

  static _setLayerDirty(projectId, dirty) {
    try {
      if (typeof localStorage === 'undefined') return;
      if (dirty) localStorage.setItem(this._layerDirtyKey(projectId), '1');
      else localStorage.removeItem(this._layerDirtyKey(projectId));
    } catch {}
  }

  static syncMetadataToCloudDebounced(projectData, delayMs = 400) {
    if (!projectData) return;
    _pendingMetaForCloud = projectData;
    this._setLayerDirty(projectData.id, true);
    if (_cloudMetaDebounceTimer) clearTimeout(_cloudMetaDebounceTimer);
    _cloudMetaDebounceTimer = setTimeout(() => {
      _cloudMetaDebounceTimer = null;
      const payload = _pendingMetaForCloud;
      _pendingMetaForCloud = null;
      this.syncMetadataToCloud(payload);
    }, delayMs);
  }

  /** Envia já o metadado pendente (usado ao fechar/recarregar a página). */
  static flushMetadataToCloud() {
    if (!_cloudMetaDebounceTimer) return;
    clearTimeout(_cloudMetaDebounceTimer);
    _cloudMetaDebounceTimer = null;
    const payload = _pendingMetaForCloud;
    _pendingMetaForCloud = null;
    if (payload) this.syncMetadataToCloud(payload);
  }

  static async syncMetadataToCloud(projectData) {
    if (!projectData) return;
    const dirtyProjectId = projectData.id || 'projeto_padrao';
    _layerSyncInFlight++;
    try {
      _cloudStatus.syncing = true;
      this._notifyCloudStatus();

      const projId = projectData.id || 'projeto_padrao';
      const payload = {
        id: projId,
        clientId: _clientId,
        name: projectData.name || 'Levantamento Topográfico - Umuarama',
        description: projectData.description || '',
        basemap: projectData.basemap || 'google_satelite_puro',
        center: projectData.center || [-23.7661, -53.3206],
        zoom: projectData.zoom || 14,
        featureCount: projectData.featureCount !== undefined
          ? projectData.featureCount
          : (Array.isArray(projectData.features) ? projectData.features.length : 0),
        layers: Array.isArray(projectData.layers) ? projectData.layers : []
      };

      const res = await this._postJson('save_metadata', payload);
      if (res.ok) {
        _cloudStatus.connected = true;
        _cloudStatus.lastSyncedAt = new Date().toISOString();
        _cloudStatus.error = null;
        // Só limpa se nenhuma edição mais nova ficou na fila durante o envio
        if (!_cloudMetaDebounceTimer) this._setLayerDirty(dirtyProjectId, false);
      }
    } catch (err) {
      console.warn('[CloudSyncEngine] Falha ao sincronizar metadados:', err);
      _cloudStatus.error = err.message;
    } finally {
      _layerSyncInFlight--;
      _cloudStatus.syncing = false;
      this._notifyCloudStatus();
    }
  }

  static saveProjectToCloud(projectData) {
    if (!projectData) return Promise.resolve({ success: false, error: 'Sem dados para salvar' });
    const ids = Array.isArray(projectData.features)
      ? projectData.features.map(f => f && f.id).filter(Boolean)
      : [];
    return this._enqueuePush(ids, () => this._saveProjectToCloudNow(projectData));
  }

  static async _saveProjectToCloudNow(projectData) {
    try {
      _cloudStatus.syncing = true;
      this._notifyCloudStatus();

      const projId = projectData.id || 'projeto_padrao';
      const cursor = LocalStore.loadSyncCursor(projId);
      const payload = {
        id: projId,
        clientId: _clientId,
        baseRev: cursor.rev || 0,
        name: projectData.name || 'Levantamento Topográfico - Umuarama',
        description: projectData.description || '',
        basemap: projectData.basemap || 'google_satelite_puro',
        center: projectData.center || [-23.7661, -53.3206],
        zoom: projectData.zoom || 14,
        layers: Array.isArray(projectData.layers) ? projectData.layers : [],
        features: Array.isArray(projectData.features) ? projectData.features.map(packFeatureForCloud) : []
      };

      const res = await fetch(`${CLOUD_API_URL}?action=save_all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const result = await res.json();
      if (result && result.success) {
        _cloudStatus.connected = true;
        _cloudStatus.lastSyncedAt = new Date().toISOString();
        _cloudStatus.error = null;
        return { success: true, count: payload.features.length, skipped: result.skipped || 0, message: result.message };
      } else {
        throw new Error(result?.error || 'Erro ao persistir no servidor');
      }
    } catch (err) {
      console.warn('[CloudSyncEngine] Falha ao salvar projeto integral:', err);
      _cloudStatus.error = err.message;
      return { success: false, error: err.message };
    } finally {
      _cloudStatus.syncing = false;
      this._notifyCloudStatus();
    }
  }

  static syncProjectToCloudDebounced(projectData, delayMs = 1500) {
    if (_cloudProjectDebounceTimer) clearTimeout(_cloudProjectDebounceTimer);
    _cloudProjectDebounceTimer = setTimeout(() => {
      _cloudProjectDebounceTimer = null;
      this.saveProjectToCloud(projectData);
    }, delayMs);
  }

  static async loadProjectFromCloud(projectId = 'projeto_padrao') {
    try {
      const res = await fetch(`${CLOUD_API_URL}?action=load&projectId=${encodeURIComponent(projectId)}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        cache: 'no-cache'
      });

      if (!res.ok) return null;
      const data = await res.json();
      if (!data || !data.exists) return null;

      if (Number.isFinite(data.rev)) {
        LocalStore.saveSyncCursor(projectId, { rev: data.rev, id: '' });
      }
      if (Array.isArray(data.features)) {
        data.features = data.features.map(unpackFeatureFromCloud);
      }

      _cloudStatus.connected = true;
      _cloudStatus.lastCheck = new Date().toISOString();
      this._notifyCloudStatus();
      return data;
    } catch (err) {
      console.warn('[CloudSyncEngine] Nuvem indisponível para carregamento:', err);
      return null;
    }
  }

  static async pullChangesFromCloud(projectId = 'projeto_padrao', presence = null) {
    try {
      const cursor = LocalStore.loadSyncCursor(projectId);
      const params = new URLSearchParams({
        action: 'pull_changes',
        projectId,
        sinceRev: String(cursor.rev),
        sinceId: cursor.id || '',
        clientId: _clientId
      });
      if (presence) {
        if (presence.name) params.set('userName', presence.name);
        if (presence.color) params.set('userColor', presence.color);
        if (Number.isFinite(presence.lat) && Number.isFinite(presence.lng)) {
          params.set('lat', presence.lat.toFixed(6));
          params.set('lng', presence.lng.toFixed(6));
        }
      }

      const res = await fetch(`${CLOUD_API_URL}?${params.toString()}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        cache: 'no-cache'
      });

      if (!res.ok) return null;
      const data = await res.json();
      if (!data || !data.success) return null;

      _cloudStatus.connected = true;
      _cloudStatus.lastSyncedAt = new Date().toISOString();
      _cloudStatus.error = null;
      this._notifyCloudStatus();

      const layers = Array.isArray(data.layers) ? data.layers : [];

      if (!Array.isArray(data.changes)) {
        return {
          upserted: Array.isArray(data.upserted) ? data.upserted.map(unpackFeatureFromCloud) : [],
          deleted: Array.isArray(data.deleted) ? data.deleted : [],
          layers,
          project: data.project || null,
          presence: null,
          hasMore: false
        };
      }

      if (data.reset) {
        _localWriteRev.clear();
        _appliedRevs.clear();
      }

      const upserted = [];
      const deleted = [];
      let heldCursor = null;
      let prev = data.reset ? { rev: 0, id: '' } : cursor;

      for (const ch of data.changes) {
        if (!ch || !ch.id) continue;
        const here = { rev: ch.rev, id: ch.id };

        const ownRev = _localWriteRev.get(ch.id);
        if (ownRev !== undefined && ownRev > ch.rev) {
          prev = here;
          continue;
        }
        if (this.hasPendingLocalChange(ch.id, projectId)) {
          if (!heldCursor) heldCursor = prev;
          prev = here;
          continue;
        }
        if (_appliedRevs.get(ch.id) === ch.rev) {
          prev = here;
          continue;
        }

        _appliedRevs.set(ch.id, ch.rev);
        if (ch.deleted) deleted.push(ch.id);
        else if (ch.feature) upserted.push(unpackFeatureFromCloud(ch.feature));
        prev = here;
      }

      const serverCursor = data.cursor && Number.isFinite(data.cursor.rev)
        ? data.cursor
        : { rev: Number(data.rev) || 0, id: '' };
      LocalStore.saveSyncCursor(projectId, heldCursor || serverCursor);

      return {
        upserted,
        deleted,
        layers,
        project: data.project || null,
        presence: Array.isArray(data.presence) ? data.presence : null,
        hasMore: !!data.hasMore && !heldCursor
      };
    } catch {
      return null;
    }
  }
}
