/* ==========================================================================
   ConecteMapas - StorageService (Fachada Unificada de Persistência)
   Decomposição Modular (SRP / SOLID):
   - LocalStore: Manifesto síncrono, tombstones locais, deltas offline e cursores
   - IndexedDbStore: 4 Object Stores relacionais ('projects', 'layers', 'features', 'audit')
   - CloudSyncEngine: Sincronização em tempo real com MySQL Hostinger LiteSpeed
   ========================================================================== */

import { LocalStore } from './Storage/LocalStore.js';
import { IndexedDbStore } from './Storage/IndexedDbStore.js';
import { DeltaQueue } from './Storage/DeltaQueue.js';
import { CloudSyncEngine } from './Storage/CloudSyncEngine.js';

let _currentProjectId = 'projeto_padrao';
let _metaDebounceTimer = null;
let _pendingMetaPayload = null;
let _projectDebounceTimer = null;
let _pendingProjectPayload = null;

export class StorageService {
  static setCurrentProjectId(id) {
    if (id && typeof id === 'string') {
      const clean = id.trim();
      if (clean !== _currentProjectId) {
        _currentProjectId = clean;
        LocalStore.resetProjectCache();
        CloudSyncEngine.resetProjectState();
      }
    }
  }

  static getCurrentProjectId() {
    return _currentProjectId;
  }

  static getClientId() {
    return CloudSyncEngine.getClientId();
  }

  static getSyncCursor() {
    return LocalStore.getCachedSyncCursor(_currentProjectId);
  }

  static hasPendingLocalChange(featureId) {
    return CloudSyncEngine.hasPendingLocalChange(featureId, _currentProjectId);
  }

  static hasPendingOfflineDeltas() {
    return CloudSyncEngine.hasPendingOfflineDeltas(_currentProjectId);
  }

  static getDB() {
    return IndexedDbStore.getDB();
  }

  static migrateLegacyDataIfNeeded(db, projectId = null) {
    return IndexedDbStore.migrateLegacyDataIfNeeded(db, projectId || _currentProjectId);
  }

  // ---- PERSISTÊNCIA DE METADADOS & PROJETO ----

  static saveMetadata(projectData) {
    if (!projectData) return false;
    try {
      const projId = projectData.id || _currentProjectId || 'projeto_padrao';
      const manifest = {
        id: projId,
        name: projectData.name || 'Levantamento Topográfico - Umuarama',
        description: projectData.description || '',
        updatedAt: new Date().toISOString(),
        basemap: projectData.basemap || 'google_satelite_puro',
        center: projectData.center || [-23.7661, -53.3206],
        zoom: projectData.zoom || 14,
        layers: Array.isArray(projectData.layers) ? projectData.layers : [],
        featureCount: projectData.featureCount !== undefined
          ? projectData.featureCount
          : (Array.isArray(projectData.features) ? projectData.features.length : 0),
        isStoredInIndexedDB: true
      };

      LocalStore.saveManifest(manifest);

      const projectRecord = {
        id: manifest.id,
        name: manifest.name,
        description: manifest.description,
        updatedAt: manifest.updatedAt,
        basemap: manifest.basemap,
        center: manifest.center,
        zoom: manifest.zoom,
        featureCount: manifest.featureCount
      };
      this.saveProjectRecord(projectRecord);
      LocalStore.updateProjectsIndex(manifest);

      if (Array.isArray(projectData.layers) && projectData.layers.length > 0) {
        this.saveLayersBatch(projectData.layers, manifest.id);
      }

      this.syncMetadataToCloudDebounced(projectData);
      return true;
    } catch (e) {
      console.error('[StorageService] Erro ao salvar metadados:', e);
      return false;
    }
  }

  static saveMetadataDebounced(projectData, delayMs = 300) {
    _pendingMetaPayload = projectData;
    if (_metaDebounceTimer) clearTimeout(_metaDebounceTimer);
    _metaDebounceTimer = setTimeout(() => {
      _metaDebounceTimer = null;
      if (_pendingMetaPayload) {
        this.saveMetadata(_pendingMetaPayload);
        _pendingMetaPayload = null;
      }
    }, delayMs);
  }

  static saveProjectRecord(projectRecord) {
    return IndexedDbStore.saveProjectRecord(projectRecord);
  }

  static saveProject(projectData) {
    this.saveMetadata(projectData);
    this.commitDeltas();
    return true;
  }

  static saveProjectDebounced(projectData, delayMs = 350) {
    this.saveMetadataDebounced(projectData, delayMs);
    this.commitDeltasDebounced(delayMs);
  }

  static flushSync(fallbackData = null) {
    if (_metaDebounceTimer) {
      clearTimeout(_metaDebounceTimer);
      _metaDebounceTimer = null;
    }
    if (_projectDebounceTimer) {
      clearTimeout(_projectDebounceTimer);
      _projectDebounceTimer = null;
    }
    DeltaQueue.cancelTimers();

    const dataToSave = _pendingProjectPayload || _pendingMetaPayload || fallbackData;
    if (dataToSave) {
      this.saveMetadata(dataToSave);
      _pendingProjectPayload = null;
      _pendingMetaPayload = null;
    }

    this.commitDeltas();
    CloudSyncEngine.flushMetadataToCloud();
  }

  static hasPendingLayerSync() {
    return CloudSyncEngine.hasPendingLayerSync(_currentProjectId);
  }

  static hasLayerSyncActive() {
    return CloudSyncEngine.hasLayerSyncActive();
  }

  static loadCurrentProject() {
    return LocalStore.loadManifest();
  }

  static loadCurrentProjectAsync(projectId = null) {
    return IndexedDbStore.loadCurrentProjectAsync(projectId || _currentProjectId);
  }

  static updateProjectsIndex(project) {
    return LocalStore.updateProjectsIndex(project);
  }

  static listProjects() {
    return LocalStore.listProjects();
  }

  static clearCurrentProject() {
    return IndexedDbStore.clearCurrentProject(_currentProjectId);
  }

  static estimateStorage() {
    return IndexedDbStore.estimateStorage();
  }

  // ---- CAMADAS ----

  static saveLayer(layer, projectId = null) {
    return IndexedDbStore.saveLayer(layer, projectId || _currentProjectId);
  }

  static saveLayersBatch(layers, projectId = null) {
    return IndexedDbStore.saveLayersBatch(layers, projectId || _currentProjectId);
  }

  static deleteLayer(layerId, fallbackLayerId = null, projectId = null) {
    return IndexedDbStore.deleteLayer(layerId, fallbackLayerId, projectId || _currentProjectId);
  }

  // ---- FEIÇÕES E DELTAS ----

  static queueFeatureUpsert(feature, projectId = null) {
    return DeltaQueue.queueFeatureUpsert(feature, projectId || _currentProjectId);
  }

  static queueFeaturesBulkUpsert(features, projectId = null) {
    return DeltaQueue.queueFeaturesBulkUpsert(features, projectId || _currentProjectId);
  }

  static queueFeatureDelete(featureId) {
    return DeltaQueue.queueFeatureDelete(featureId, _currentProjectId);
  }

  static queueFeaturesBulkDelete(featureIds, projectId = null) {
    return DeltaQueue.queueFeaturesBulkDelete(featureIds, projectId || _currentProjectId);
  }

  static commitDeltasDebounced(delayMs) {
    return DeltaQueue.commitDeltasDebounced(delayMs, _currentProjectId);
  }

  static commitDeltas() {
    return DeltaQueue.commitDeltas(_currentProjectId);
  }

  static executeDeltasChunked(db, toDelete, toUpsert, chunkSize = 10000) {
    return IndexedDbStore.executeDeltasChunked(db, toDelete, toUpsert, chunkSize);
  }

  static hasLocalTombstone(featureId, projectId = null) {
    return LocalStore.hasLocalTombstone(featureId, projectId || _currentProjectId);
  }

  static async saveFeature(feature, projectId = null) {
    if (!feature || !feature.id) return;
    const projId = projectId || _currentProjectId || 'projeto_padrao';
    LocalStore.removeLocalTombstone(feature.id, projId);
    this.queueFeatureUpsert(feature, projId);
    await IndexedDbStore.saveFeatureDirect(feature, projId);
  }

  static async deleteFeature(featureId, projectId = null) {
    if (!featureId) return;
    const projId = projectId || _currentProjectId || 'projeto_padrao';
    this.queueFeatureDelete(featureId);
    LocalStore.addLocalTombstone(featureId, projId);
    LocalStore.persistPendingDeltasWithItems([], [featureId], projId, _currentProjectId);
    await IndexedDbStore.deleteFeatureDirect(featureId);
    this.commitDeltasDebounced(100);
  }

  static async saveFeaturesBatch(features, projectId = null) {
    return IndexedDbStore.saveFeaturesBatch(features, projectId || _currentProjectId);
  }

  static applyDiff(oldFeatures, newFeatures, projectId = null) {
    const projId = projectId || _currentProjectId || 'projeto_padrao';
    const oldMap = new Map((oldFeatures || []).map(f => [f.id, f]));
    const newMap = new Map((newFeatures || []).map(f => [f.id, f]));

    const toDelete = [];
    const toUpsert = [];

    for (const [id] of oldMap) {
      if (!newMap.has(id)) {
        toDelete.push(id);
      }
    }

    for (const [id, newFeat] of newMap) {
      const oldFeat = oldMap.get(id);
      if (!oldFeat || oldFeat !== newFeat) {
        toUpsert.push(newFeat);
      }
    }

    if (toDelete.length > 0) this.queueFeaturesBulkDelete(toDelete, projId);
    if (toUpsert.length > 0) this.queueFeaturesBulkUpsert(toUpsert, projId);
  }

  // ---- AUDITORIA ----

  static logAudit(entry, projectId = null) {
    return IndexedDbStore.logAudit(entry, projectId || _currentProjectId);
  }

  static appendAudit(entry, projectId = null) {
    return IndexedDbStore.appendAudit(entry, projectId || _currentProjectId);
  }

  static getAuditLog(projectId = null, limit = 100) {
    return IndexedDbStore.getAuditLog(projectId || _currentProjectId, limit);
  }

  // ---- CLOUD & SYNC ----

  static getCloudStatus() {
    return CloudSyncEngine.getCloudStatus();
  }

  static onCloudStatusChange(listener) {
    return CloudSyncEngine.onCloudStatusChange(listener);
  }

  static checkCloudConnection() {
    return CloudSyncEngine.checkCloudConnection();
  }

  static syncMetadataToCloudDebounced(projectData, delayMs = 400) {
    return CloudSyncEngine.syncMetadataToCloudDebounced(projectData, delayMs);
  }

  static syncMetadataToCloud(projectData) {
    return CloudSyncEngine.syncMetadataToCloud(projectData);
  }

  static _postJson(action, payload) {
    return CloudSyncEngine._postJson(action, payload);
  }

  static _enqueuePush(ids, task) {
    return CloudSyncEngine._enqueuePush(ids, task);
  }

  static syncDeltasToCloud(toUpsert, toDelete, projectId = null) {
    return CloudSyncEngine.syncDeltasToCloud(toUpsert, toDelete, projectId || _currentProjectId);
  }

  static saveProjectToCloud(projectData) {
    return CloudSyncEngine.saveProjectToCloud(projectData);
  }

  static syncProjectToCloudDebounced(projectData, delayMs = 1500) {
    return CloudSyncEngine.syncProjectToCloudDebounced(projectData, delayMs);
  }

  static loadProjectFromCloud(projectId = null) {
    return CloudSyncEngine.loadProjectFromCloud(projectId || _currentProjectId);
  }

  static pullChangesFromCloud(projectId = null, presence = null) {
    return CloudSyncEngine.pullChangesFromCloud(projectId || _currentProjectId, presence);
  }

  static applyRemoteChangesLocally(upserted = [], deletedIds = [], projectId = null) {
    return IndexedDbStore.applyRemoteChangesLocally(upserted, deletedIds, projectId || _currentProjectId);
  }

  static flushPendingOfflineDeltas(projectId = null) {
    return CloudSyncEngine.flushPendingOfflineDeltas(projectId || _currentProjectId);
  }
}

// Listener de conectividade de rede
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    StorageService.flushPendingOfflineDeltas();
    StorageService.checkCloudConnection();
  });
}
