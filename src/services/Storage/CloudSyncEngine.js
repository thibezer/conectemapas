/* ==========================================================================
   ConecteMapas - CloudSyncEngine
   Sincronização em nuvem e colaboração em tempo real (Hostinger LiteSpeed MySQL).
   Respeita a Regra 5 do GEMINI.md:
   - Cursor por revisão (rev, id), nunca por relógio
   - Edição local vence enquanto não confirmada (hasPendingLocalChange)
   - Envio serializado em fila única de POSTs (_enqueuePush)
   - keepalive só abaixo de 60 KB
   ========================================================================== */

import { GeoCompressor } from '../GeoCompressor.js';
import { CLOUD_API_URL, cloudFetch } from './StorageConstants.js';
import { LocalStore } from './LocalStore.js';
import { DeltaQueue } from './DeltaQueue.js';
import { AccessManager } from './AccessManager.js';
import { layersForCloud, layersForSignature, changedLayers, baselineFrom } from './LayerVisibility.js';
import { FeatureVisibility } from './FeatureVisibility.js';

function _resolveTabClientId() {
  const fresh = 'cli_' + (typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
    : Math.random().toString(36).substring(2, 12) + Date.now().toString(36));
  try {
    if (typeof sessionStorage !== 'undefined') {
      const existing = sessionStorage.getItem('cm_collab_client_id');
      if (existing && /^cli_[a-zA-Z0-9_-]{6,64}$/.test(existing)) return existing;
      sessionStorage.setItem('cm_collab_client_id', fresh);
    }
  } catch {}
  return fresh;
}

const _clientId = _resolveTabClientId();

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
  // `visible` (olhinho) é preferência local de cada operador: não viaja
  return FeatureVisibility.stripForCloud({ ...feat, properties: props });
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
const _projFeatureKey = (projectId, id) => `${projectId || 'projeto_padrao'}::${id}`;
let _offlineFlushPromise = null;
// Último metadado confirmado pela nuvem (por projeto): editar uma feição não muda
// nome/camadas, então reenviar o mesmo save_metadata só gasta rede e consultas no servidor.
const _lastMetaSig = new Map();
// Camadas como a nuvem as conhece (projeto -> id -> assinatura dos campos compartilhados):
// só o que o operador mudou é enviado, para uma cópia defasada não sobrescrever o colega.
const _layerBaseline = new Map();

// Versão do deploy e época de recarregamento forçado: detecta novo build ou comando remoto
const _clientAppVersion = typeof __APP_VERSION__ !== 'undefined' ? String(__APP_VERSION__) : 'dev';
let _knownServerVersion = null;
let _knownReloadEpoch = null;
const _reloadListeners = new Set();

function checkRemoteVersionSignals(data) {
  if (!data || typeof data !== 'object') return false;
  let shouldReload = false;
  let reason = '';

  if (typeof data.appVersion === 'string' && data.appVersion) {
    if (_knownServerVersion === null) {
      _knownServerVersion = data.appVersion;
      if (_clientAppVersion !== 'dev' && data.appVersion !== _clientAppVersion) {
        try {
          const guardKey = 'cm_reloaded_for_ver';
          if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(guardKey) !== data.appVersion) {
            sessionStorage.setItem(guardKey, data.appVersion);
            shouldReload = true;
            reason = 'deploy';
          }
        } catch {}
      }
    } else if (data.appVersion !== _knownServerVersion) {
      _knownServerVersion = data.appVersion;
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('cm_reloaded_for_ver', data.appVersion);
        }
      } catch {}
      shouldReload = true;
      reason = 'deploy';
    }
  }

  if (Number.isFinite(data.forceReloadEpoch)) {
    const epoch = Number(data.forceReloadEpoch);
    if (_knownReloadEpoch === null) {
      _knownReloadEpoch = epoch;
    } else if (epoch > _knownReloadEpoch) {
      _knownReloadEpoch = epoch;
      shouldReload = true;
      reason = reason || 'command';
    }
  }

  if (shouldReload) {
    for (const listener of _reloadListeners) {
      try { listener({ reason, appVersion: _knownServerVersion, epoch: _knownReloadEpoch }); } catch {}
    }
  }
  return shouldReload;
}

function metadataSignature(data) {
  return JSON.stringify([
    // Olhinho (visible), opacidade e mapa base são preferências do operador: não são mudança do projeto
    data.name || '', data.description || '',
    layersForSignature(data.layers)
  ]);
}

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

  static resetProjectState(projectId = null) {
    if (!projectId) {
      _localWriteRev.clear();
      _appliedRevs.clear();
      _lastMetaSig.clear();
      return;
    }
    const prefix = `${projectId}::`;
    for (const k of _localWriteRev.keys()) {
      if (k.startsWith(prefix)) _localWriteRev.delete(k);
    }
    for (const k of _appliedRevs.keys()) {
      if (k.startsWith(prefix)) _appliedRevs.delete(k);
    }
    _lastMetaSig.delete(projectId);
  }

  static waitForPushIdle() {
    return _pushChain.catch(() => true).then(() => true);
  }

  static getAppVersion() {
    return _clientAppVersion;
  }

  static onRemoteReloadRequired(listener) {
    if (typeof listener === 'function') _reloadListeners.add(listener);
    return () => _reloadListeners.delete(listener);
  }

  static async triggerForceReloadAll(projectId = 'projeto_padrao') {
    const res = await this._postJson('force_reload', { projectId, clientId: _clientId });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    if (data && Number.isFinite(data.forceReloadEpoch)) {
      _knownReloadEpoch = Number(data.forceReloadEpoch);
    }
    return data;
  }

  static hasPendingLocalChange(featureId, currentProjectId = 'projeto_padrao') {
    if (!featureId) return false;
    return DeltaQueue.hasPendingLocalChange(featureId, currentProjectId)
      || _inFlightCounts.has(_projFeatureKey(currentProjectId, featureId))
      || LocalStore.getOfflinePendingIds(currentProjectId).has(featureId);
  }

  static hasPendingOfflineDeltas(currentProjectId = 'projeto_padrao') {
    return LocalStore.getOfflinePendingIds(currentProjectId).size > 0;
  }

  static _postJson(action, payload) {
    const body = JSON.stringify(payload);
    return cloudFetch(`${CLOUD_API_URL}?action=${action}`, {
      method: 'POST',
      headers: AccessManager.headers(payload.projectId || payload.id, { 'Content-Type': 'application/json' }),
      body,
      keepalive: body.length < 60000
    });
  }

  static _enqueuePush(ids, task, projectId = 'projeto_padrao') {
    const keys = (ids || []).map(id => _projFeatureKey(projectId, id));
    for (const key of keys) {
      _inFlightCounts.set(key, (_inFlightCounts.get(key) || 0) + 1);
    }
    const run = async () => {
      try {
        return await task();
      } finally {
        for (const key of keys) {
          const n = (_inFlightCounts.get(key) || 1) - 1;
          if (n <= 0) _inFlightCounts.delete(key);
          else _inFlightCounts.set(key, n);
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
      const res = await cloudFetch(`${CLOUD_API_URL}?action=status`, {
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
    return this._enqueuePush(ids, () => this._pushDeltas(upserts, deletes, projectId), projectId);
  }

  static async _pushDeltas(toUpsert, toDelete, projectId) {
    const merged = LocalStore.mergeDeltas(LocalStore.readPendingDeltas(projectId), toUpsert, toDelete);
    if (merged.dirty.length === 0 && merged.deleted.length === 0) return true;

    try {
      _cloudStatus.syncing = true;
      this._notifyCloudStatus();

      const BATCH_CHUNK_SIZE = 500; // o servidor processa em blocos de 500; menos idas e voltas em lotes grandes
      const dirtyChunks = [];
      for (let i = 0; i < merged.dirty.length; i += BATCH_CHUNK_SIZE) {
        dirtyChunks.push(merged.dirty.slice(i, i + BATCH_CHUNK_SIZE));
      }
      if (dirtyChunks.length === 0) dirtyChunks.push([]);

      for (let c = 0; c < dirtyChunks.length; c++) {
        const chunkDirty = dirtyChunks[c];
        const chunkDelete = c === 0 ? merged.deleted : [];

        const res = await this._postJson('sync_deltas', {
          projectId,
          clientId: _clientId,
          toUpsert: chunkDirty.map(packFeatureForCloud),
          toDelete: chunkDelete,
          allowMassDelete: true
        });

        if (res.status === 409) {
          // Trava anti-exclusão em massa do servidor: não reenfileira (evitaria loop infinito)
          LocalStore.clearPendingDeltas(projectId, projectId);
          _cloudStatus.error = 'Exclusão em massa bloqueada pelo servidor';
          console.warn('[CloudSyncEngine] Exclusão em massa bloqueada pelo servidor; nuvem preservada.');
          return false;
        }
        if (res.status === 401 || res.status === 403 || res.status === 410) {
          // Sem permissão de escrita (ou projeto excluído): reenviar nunca vai funcionar, então descarta a fila local
          AccessManager.handleDenied(projectId, res.status, await res.json().catch(() => null));
          LocalStore.clearPendingDeltas(projectId, projectId);
          _cloudStatus.error = 'Sem permissão de edição neste projeto';
          return false;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const resData = await res.json().catch(() => null);
        if (resData && Number.isFinite(resData.rev)) {
          for (const f of chunkDirty) _localWriteRev.set(_projFeatureKey(projectId, f.id), resData.rev);
          for (const id of chunkDelete) _localWriteRev.set(_projFeatureKey(projectId, id), resData.rev);
        }
      }

      _cloudStatus.connected = true;
      _cloudStatus.lastSyncedAt = new Date().toISOString();
      _cloudStatus.error = null;
      LocalStore.removeConfirmedDeltas(
        merged.dirty,
        merged.deleted,
        projectId,
        projectId,
        (id) => DeltaQueue.hasPendingLocalChange(id, projectId)
      );
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

  /**
   * Registra a assinatura atual dos metadados como já confirmada pela nuvem
   * (usado ao hidratar/aplicar dados remotos para não disparar eco de save_metadata).
   */
  static markMetadataSynced(projectData) {
    if (!projectData) return;
    const projId = projectData.id || 'projeto_padrao';
    if (this.hasPendingLayerSync(projId)) return;
    _lastMetaSig.set(projId, metadataSignature(projectData));
    _layerBaseline.set(projId, baselineFrom(projectData.layers));
  }

  static syncMetadataToCloudDebounced(projectData, delayMs = 400) {
    if (!projectData) return;
    const projId = projectData.id || 'projeto_padrao';
    // Nada mudou desde o último envio confirmado e não há envio em curso/agendado: não reenvia
    if (!_cloudMetaDebounceTimer && _layerSyncInFlight === 0
        && _lastMetaSig.get(projId) === metadataSignature(projectData)) {
      return;
    }
    _pendingMetaForCloud = projectData;
    this._setLayerDirty(projId, true);
    if (_cloudMetaDebounceTimer) clearTimeout(_cloudMetaDebounceTimer);
    _cloudMetaDebounceTimer = setTimeout(() => {
      _cloudMetaDebounceTimer = null;
      const payload = _pendingMetaForCloud;
      _pendingMetaForCloud = null;
      this.syncMetadataToCloud(payload);
    }, delayMs);
  }

  /** Descarta o metadado agendado sem enviá-lo (projeto excluído). */
  static cancelPendingMetadata() {
    if (_cloudMetaDebounceTimer) clearTimeout(_cloudMetaDebounceTimer);
    _cloudMetaDebounceTimer = null;
    _pendingMetaForCloud = null;
    if (_cloudProjectDebounceTimer) clearTimeout(_cloudProjectDebounceTimer);
    _cloudProjectDebounceTimer = null;
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

  // Exclusões de camada pendentes (offline/falha): reenviadas na próxima oportunidade
  static _pendingLayerDeletes(projectId) {
    try {
      const raw = JSON.parse(localStorage.getItem(`cm_pending_layer_deletes_${projectId}`) || '[]');
      return Array.isArray(raw) ? raw.filter(id => typeof id === 'string' && id) : [];
    } catch {
      return [];
    }
  }

  static _setPendingLayerDeletes(projectId, ids) {
    try {
      const key = `cm_pending_layer_deletes_${projectId}`;
      if (ids.length) localStorage.setItem(key, JSON.stringify(ids));
      else localStorage.removeItem(key);
    } catch {}
  }

  static deleteLayersInCloud(projectId, layerIds) {
    const pid = projectId || 'projeto_padrao';
    const merged = new Set(this._pendingLayerDeletes(pid));
    (Array.isArray(layerIds) ? layerIds : [layerIds]).forEach(id => { if (id) merged.add(String(id)); });
    this._setPendingLayerDeletes(pid, [...merged]);
    return this.flushLayerDeletes(pid);
  }

  static flushLayerDeletes(projectId) {
    const pid = projectId || 'projeto_padrao';
    if (this._pendingLayerDeletes(pid).length === 0) return Promise.resolve();
    return this._enqueuePush([], async () => {
      const ids = this._pendingLayerDeletes(pid);
      if (ids.length === 0) return;
      try {
        const res = await this._postJson('delete_layer', { projectId: pid, clientId: _clientId, layerIds: ids });
        if (res.status === 401 || res.status === 403 || res.status === 410) {
          AccessManager.handleDenied(pid, res.status, await res.json().catch(() => null));
          this._setPendingLayerDeletes(pid, []);
        } else if (res.ok) {
          // Mantém só o que foi marcado para exclusão durante o envio
          const sent = new Set(ids);
          this._setPendingLayerDeletes(pid, this._pendingLayerDeletes(pid).filter(id => !sent.has(id)));
        }
      } catch (err) {
        console.warn('[CloudSyncEngine] Exclusão de camada pendente (offline):', err);
      }
    });
  }

  static syncMetadataToCloud(projectData) {
    if (!projectData || !projectData.name) return Promise.resolve();
    const dirtyProjectId = projectData.id || 'projeto_padrao';
    this.flushLayerDeletes(dirtyProjectId);
    return this._enqueuePush([], () => this._syncMetadataToCloudNow(projectData, dirtyProjectId));
  }

  static async _syncMetadataToCloudNow(projectData, dirtyProjectId) {
    _layerSyncInFlight++;
    try {
      _cloudStatus.syncing = true;
      this._notifyCloudStatus();

      const projId = projectData.id || 'projeto_padrao';
      // Só as camadas que ESTE operador mudou (a posição na lista vira `order` se a camada não tiver)
      const allLayers = Array.isArray(projectData.layers) ? projectData.layers : [];
      const sentLayers = changedLayers(allLayers, _layerBaseline.get(projId));
      const payload = {
        id: projId,
        clientId: _clientId,
        name: projectData.name,
        description: projectData.description || '',
        basemap: projectData.basemap || 'google_satelite_puro',
        center: projectData.center || [-23.7661, -53.3206],
        zoom: projectData.zoom || 14,
        featureCount: projectData.featureCount !== undefined
          ? projectData.featureCount
          : (Array.isArray(projectData.features) ? projectData.features.length : 0),
        layers: layersForCloud(sentLayers.map(l => (l && l.order === undefined ? { ...l, order: allLayers.indexOf(l) } : l)))
      };

      const sentSig = metadataSignature(projectData);
      const res = await this._postJson('save_metadata', payload);
      if (res.status === 401 || res.status === 403 || res.status === 410) {
        AccessManager.handleDenied(projId, res.status, await res.json().catch(() => null));
        this._setLayerDirty(dirtyProjectId, false);
        _cloudStatus.error = 'Sem permissão de edição neste projeto';
      } else if (res.ok) {
        _cloudStatus.connected = true;
        _cloudStatus.lastSyncedAt = new Date().toISOString();
        _cloudStatus.error = null;
        _lastMetaSig.set(projId, sentSig);
        _layerBaseline.set(projId, baselineFrom(sentLayers, _layerBaseline.get(projId)));
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
    if (!projectData || !projectData.name) return Promise.resolve({ success: false, error: 'Sem dados para salvar' });
    const ids = Array.isArray(projectData.features)
      ? projectData.features.map(f => f && f.id).filter(Boolean)
      : [];
    const projId = projectData.id || 'projeto_padrao';
    return this._enqueuePush(ids, () => this._saveProjectToCloudNow(projectData), projId);
  }

  static async _saveProjectToCloudNow(projectData) {
    try {
      _cloudStatus.syncing = true;
      this._notifyCloudStatus();

      const projId = projectData.id || 'projeto_padrao';
      const cursor = LocalStore.loadSyncCursor(projId);
      const rawFeatures = Array.isArray(projectData.features) ? projectData.features : [];
      const sentCompacted = rawFeatures
        .filter(f => f && f.id)
        .map(f => ({ ...GeoCompressor.compactFeatureForStorage(f), projectId: projId }));
      const payload = {
        id: projId,
        clientId: _clientId,
        baseRev: cursor.rev || 0,
        name: projectData.name,
        description: projectData.description || '',
        basemap: projectData.basemap || 'google_satelite_puro',
        center: projectData.center || [-23.7661, -53.3206],
        zoom: projectData.zoom || 14,
        layers: layersForCloud(projectData.layers),
        features: rawFeatures.map(packFeatureForCloud)
      };

      const res = await cloudFetch(`${CLOUD_API_URL}?action=save_all`, {
        method: 'POST',
        headers: AccessManager.headers(projId, { 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload)
      });

      if (res.status === 401 || res.status === 403 || res.status === 410) {
        AccessManager.handleDenied(projId, res.status, await res.json().catch(() => null));
        throw new Error('Sem permissão de edição neste projeto');
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const result = await res.json();
      if (result && result.success) {
        _cloudStatus.connected = true;
        _cloudStatus.lastSyncedAt = new Date().toISOString();
        _cloudStatus.error = null;
        if (Number.isFinite(Number(result.rev))) {
          const rev = Number(result.rev);
          for (const f of sentCompacted) {
            const key = _projFeatureKey(projId, f.id);
            _localWriteRev.set(key, Math.max(_localWriteRev.get(key) || 0, rev));
          }
          if (cursor.rev === 0 && (result.skipped || 0) === 0 && rev > 0) {
            LocalStore.saveSyncCursor(projId, { rev, id: '' });
          }
        }
        LocalStore.removeConfirmedDeltas(
          sentCompacted,
          [],
          projId,
          projId,
          (id) => DeltaQueue.hasPendingLocalChange(id, projId) || (_inFlightCounts.get(_projFeatureKey(projId, id)) || 0) > 1
        );
        return { success: true, count: payload.features.length, skipped: result.skipped || 0, rev: result.rev, message: result.message };
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
      const res = await cloudFetch(`${CLOUD_API_URL}?action=load&projectId=${encodeURIComponent(projectId)}`, {
        method: 'GET',
        headers: AccessManager.headers(projectId, { 'Accept': 'application/json' }),
        cache: 'no-cache'
      });

      if (!res.ok) {
        AccessManager.handleDenied(projectId, res.status, await res.json().catch(() => null));
        return null;
      }
      const data = await res.json();
      if (data && data.exists === false) return { exists: false }; // a nuvem respondeu: o projeto não existe lá
      if (!data || !data.exists) return null;

      if (Number.isFinite(data.rev)) {
        LocalStore.saveSyncCursor(projectId, { rev: data.rev, id: '' });
      }
      if (Array.isArray(data.features)) {
        data.features = data.features.map(unpackFeatureFromCloud);
      }
      if (!this.hasPendingLayerSync(projectId) && data.project) {
        _layerBaseline.set(projectId, baselineFrom(data.layers));
        _lastMetaSig.set(projectId, metadataSignature({
          id: projectId,
          name: data.project.name,
          description: data.project.description,
          basemap: data.project.basemap,
          layers: data.layers
        }));
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

  /**
   * Envia o heartbeat de presença e retorna a lista de operadores online sem
   * avançar o cursor de feições (usado enquanto o operador está desenhando).
   */
  static async pingPresence(projectId = 'projeto_padrao', presence = null) {
    try {
      const params = new URLSearchParams({
        action: 'pull_changes',
        projectId,
        presenceOnly: '1',
        clientId: _clientId,
        v: _clientAppVersion
      });
      if (presence) {
        if (presence.name) params.set('userName', presence.name);
        if (presence.color) params.set('userColor', presence.color);
        if (Number.isFinite(presence.lat) && Number.isFinite(presence.lng)) {
          params.set('lat', presence.lat.toFixed(6));
          params.set('lng', presence.lng.toFixed(6));
        }
      }
      const res = await cloudFetch(`${CLOUD_API_URL}?${params.toString()}`, {
        method: 'GET',
        headers: AccessManager.headers(projectId, { 'Accept': 'application/json' }),
        cache: 'no-cache'
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data || !data.success) return null;
      if (data.role) AccessManager.setRole(projectId, data.role);
      checkRemoteVersionSignals(data);
      return Array.isArray(data.presence) ? data.presence : null;
    } catch {
      return null;
    }
  }

  static async _fetchPullPage(projectId, cursor, presence = null) {
    const params = new URLSearchParams({
      action: 'pull_changes',
      projectId,
      sinceRev: String(cursor.rev),
      sinceId: cursor.id || '',
      clientId: _clientId,
      v: _clientAppVersion
    });
    if (presence) {
      if (presence.name) params.set('userName', presence.name);
      if (presence.color) params.set('userColor', presence.color);
      if (Number.isFinite(presence.lat) && Number.isFinite(presence.lng)) {
        params.set('lat', presence.lat.toFixed(6));
        params.set('lng', presence.lng.toFixed(6));
      }
    }

    const res = await cloudFetch(`${CLOUD_API_URL}?${params.toString()}`, {
      method: 'GET',
      headers: AccessManager.headers(projectId, { 'Accept': 'application/json' }),
      cache: 'no-cache'
    });

    if (!res.ok) {
      AccessManager.handleDenied(projectId, res.status, await res.json().catch(() => null));
      return null;
    }
    const data = await res.json();
    if (!data || !data.success) return null;
    if (data.role) AccessManager.setRole(projectId, data.role);
    checkRemoteVersionSignals(data);
    return data;
  }

  static async pullChangesFromCloud(projectId = 'projeto_padrao', presence = null) {
    try {
      const savedCursor = LocalStore.loadSyncCursor(projectId);
      const firstPage = await this._fetchPullPage(projectId, savedCursor, presence);
      if (!firstPage) return null;

      const wasConnected = _cloudStatus.connected;
      const hadError = _cloudStatus.error !== null;
      _cloudStatus.connected = true;
      _cloudStatus.lastSyncedAt = new Date().toISOString();
      _cloudStatus.error = null;
      if (!wasConnected || hadError) {
        this._notifyCloudStatus();
      }

      if (!Array.isArray(firstPage.changes)) {
        return {
          upserted: Array.isArray(firstPage.upserted) ? firstPage.upserted.map(unpackFeatureFromCloud) : [],
          deleted: Array.isArray(firstPage.deleted) ? firstPage.deleted : [],
          layers: Array.isArray(firstPage.layers) ? firstPage.layers : [],
          audit: Array.isArray(firstPage.audit) ? firstPage.audit : [],
          chat: Array.isArray(firstPage.chat) ? firstPage.chat : [],
          project: firstPage.project || null,
          presence: null,
          hasMore: false
        };
      }

      const upserted = [];
      const deleted = [];
      const layersById = new Map();
      const extraLayers = [];
      const auditSeen = new Set();
      const audit = [];
      const chatSeen = new Set();
      const chat = [];
      let heldCursor = null;
      let pageData = firstPage;
      let pageStartCursor = savedCursor;
      const MAX_HELD_PAGES = 20;

      for (let pageIdx = 0; pageIdx < MAX_HELD_PAGES && pageData; pageIdx++) {
        if (Array.isArray(pageData.layers)) {
          for (const l of pageData.layers) {
            if (l && l.id) layersById.set(l.id, l);
            else if (l) extraLayers.push(l);
          }
        }
        if (Array.isArray(pageData.audit)) {
          for (const a of pageData.audit) {
            const key = a?.id || JSON.stringify(a);
            if (!auditSeen.has(key)) { auditSeen.add(key); audit.push(a); }
          }
        }
        if (Array.isArray(pageData.chat)) {
          for (const c of pageData.chat) {
            const key = c?.id || JSON.stringify(c);
            if (!chatSeen.has(key)) { chatSeen.add(key); chat.push(c); }
          }
        }

        if (pageData.reset) {
          this.resetProjectState(projectId);
        }

        let prev = pageData.reset ? { rev: 0, id: '' } : pageStartCursor;
        const changes = Array.isArray(pageData.changes) ? pageData.changes : [];
        for (const ch of changes) {
          if (!ch || !ch.id) continue;
          const here = { rev: ch.rev, id: ch.id };
          const key = _projFeatureKey(projectId, ch.id);

          const ownRev = _localWriteRev.get(key);
          if (ownRev !== undefined && ownRev > ch.rev) {
            prev = here;
            continue;
          }
          if (this.hasPendingLocalChange(ch.id, projectId)) {
            if (!heldCursor) heldCursor = prev;
            prev = here;
            continue;
          }
          if (_appliedRevs.get(key) === ch.rev) {
            prev = here;
            continue;
          }

          _appliedRevs.set(key, ch.rev);
          if (ch.deleted) deleted.push(ch.id);
          else if (ch.feature) upserted.push(unpackFeatureFromCloud(ch.feature));
          prev = here;
        }

        const serverCursor = pageData.cursor && Number.isFinite(pageData.cursor.rev)
          ? pageData.cursor
          : { rev: Number(pageData.rev) || 0, id: '' };

        if (!heldCursor) {
          LocalStore.saveSyncCursor(projectId, serverCursor);
          return {
            upserted,
            deleted,
            layers: [...layersById.values(), ...extraLayers],
            audit,
            chat,
            project: pageData.project || firstPage.project || null,
            presence: Array.isArray(firstPage.presence) ? firstPage.presence : null,
            hasMore: !!pageData.hasMore
          };
        }

        // Há pendência local retendo heldCursor: não avançar o cursor persistido, mas drenar páginas restantes
        if (!pageData.hasMore || (serverCursor.rev === pageStartCursor.rev && serverCursor.id === pageStartCursor.id)) {
          LocalStore.saveSyncCursor(projectId, heldCursor);
          return {
            upserted,
            deleted,
            layers: [...layersById.values(), ...extraLayers],
            audit,
            chat,
            project: pageData.project || firstPage.project || null,
            presence: Array.isArray(firstPage.presence) ? firstPage.presence : null,
            hasMore: false
          };
        }

        pageStartCursor = serverCursor;
        pageData = (pageIdx + 1 < MAX_HELD_PAGES)
          ? await this._fetchPullPage(projectId, pageStartCursor, null)
          : null;
      }

      LocalStore.saveSyncCursor(projectId, heldCursor || savedCursor);
      return {
        upserted,
        deleted,
        layers: [...layersById.values(), ...extraLayers],
        audit,
        chat,
        project: pageData?.project || firstPage.project || null,
        presence: Array.isArray(firstPage.presence) ? firstPage.presence : null,
        hasMore: false
      };
    } catch {
      return null;
    }
  }

  static pushAuditToCloud(entry, projectId = 'projeto_padrao') {
    if (!entry || !entry.action) return Promise.resolve(false);
    const pid = projectId || 'projeto_padrao';
    return this._enqueuePush([], async () => {
      try {
        const res = await this._postJson('log_audit', {
          projectId: pid,
          clientId: _clientId,
          id: entry.id,
          action: entry.action,
          detail: entry.detail || entry.details || '',
          user: entry.user || 'Operador',
          timestamp: entry.timestamp || '',
          createdAt: entry.createdAt || Date.now()
        });
        return res.ok;
      } catch {
        return false;
      }
    });
  }

  static sendChatToCloud(message, projectId = 'projeto_padrao') {
    if (!message || !message.text) return Promise.resolve(false);
    const pid = projectId || 'projeto_padrao';
    return this._enqueuePush([], async () => {
      try {
        const res = await this._postJson('send_chat', {
          projectId: pid,
          clientId: _clientId,
          id: message.id,
          text: message.text,
          user: message.user,
          coordinates: message.coordinates || null,
          timestamp: message.timestamp || '',
          createdAt: message.createdAt || Date.now()
        });
        return res.ok;
      } catch {
        return false;
      }
    });
  }
}
