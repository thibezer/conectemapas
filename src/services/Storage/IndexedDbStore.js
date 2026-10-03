/* ==========================================================================
   ConecteMapas - IndexedDbStore
   Operações CRUD relacionais sobre as 4 Object Stores:
   'projects', 'layers', 'features', 'audit'.
   ========================================================================== */

import { GeoCompressor } from '../GeoCompressor.js';
import {
  STORE_PROJECTS,
  STORE_LAYERS,
  STORE_FEATURES,
  STORE_AUDIT
} from './StorageConstants.js';
import { LocalStore } from './LocalStore.js';
import { IndexedDbSchema } from './IndexedDbSchema.js';

function yieldToMain() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export class IndexedDbStore {
  static getDB() {
    return IndexedDbSchema.getDB();
  }

  static migrateLegacyDataIfNeeded(db, projectId = 'projeto_padrao') {
    return IndexedDbSchema.migrateLegacyDataIfNeeded(db, projectId);
  }

  static estimateStorage() {
    return IndexedDbSchema.estimateStorage();
  }

  static async saveProjectRecord(projectRecord) {
    try {
      const db = await this.getDB();
      if (!db) return;
      const tx = db.transaction(STORE_PROJECTS, 'readwrite');
      tx.objectStore(STORE_PROJECTS).put(projectRecord);
    } catch (e) {
      console.warn('[IndexedDbStore] Erro ao gravar registro de projeto:', e);
    }
  }

  static async saveLayer(layer, projectId = 'projeto_padrao') {
    if (!layer || !layer.id) return;
    try {
      const db = await this.getDB();
      if (!db) return;
      const tx = db.transaction(STORE_LAYERS, 'readwrite');
      tx.objectStore(STORE_LAYERS).put({
        ...layer,
        projectId,
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      console.warn('[IndexedDbStore] Erro ao salvar camada:', e);
    }
  }

  static async saveLayersBatch(layers, projectId = 'projeto_padrao') {
    if (!Array.isArray(layers)) return;
    try {
      const db = await this.getDB();
      if (!db) return;
      const tx = db.transaction(STORE_LAYERS, 'readwrite');
      const store = tx.objectStore(STORE_LAYERS);
      for (let i = 0; i < layers.length; i++) {
        const l = layers[i];
        if (l && l.id) {
          store.put({
            ...l,
            projectId,
            order: l.order !== undefined ? l.order : i,
            updatedAt: l.updatedAt || new Date().toISOString()
          });
        }
      }
    } catch (e) {
      console.warn('[IndexedDbStore] Erro ao salvar lote de camadas:', e);
    }
  }

  static async deleteLayer(layerId, fallbackLayerId = null) {
    if (!layerId) return;
    try {
      const db = await this.getDB();
      if (!db) return;
      const tx = db.transaction([STORE_LAYERS, STORE_FEATURES], 'readwrite');
      const layersStore = tx.objectStore(STORE_LAYERS);
      const featuresStore = tx.objectStore(STORE_FEATURES);

      if (fallbackLayerId) {
        const index = featuresStore.index('layerId');
        const req = index.openCursor(IDBKeyRange.only(layerId));
        req.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            cursor.update({ ...cursor.value, layerId: fallbackLayerId });
            cursor.continue();
          }
        };
      }
      layersStore.delete(layerId);
    } catch (e) {
      console.warn('[IndexedDbStore] Erro ao excluir camada com cascade:', e);
    }
  }

  static async saveFeatureDirect(feature, projectId = 'projeto_padrao') {
    if (!feature || !feature.id) return;
    try {
      const db = await this.getDB();
      if (db) {
        const compacted = GeoCompressor.compactFeatureForStorage(feature);
        const tx = db.transaction(STORE_FEATURES, 'readwrite');
        tx.objectStore(STORE_FEATURES).put({ ...compacted, projectId });
      }
    } catch (e) {
      console.warn('[IndexedDbStore] Erro ao gravar feição no IndexedDB:', e);
    }
  }

  static async deleteFeatureDirect(featureId) {
    if (!featureId) return;
    try {
      const db = await this.getDB();
      if (db) {
        const tx = db.transaction(STORE_FEATURES, 'readwrite');
        tx.objectStore(STORE_FEATURES).delete(featureId);
      }
    } catch (e) {
      console.warn('[IndexedDbStore] Erro ao deletar feição no IndexedDB:', e);
    }
  }

  static async saveFeaturesBatch(features, projectId = 'projeto_padrao') {
    if (!Array.isArray(features)) return;
    try {
      const db = await this.getDB();
      if (!db) return;

      await new Promise((resolve) => {
        const tx = db.transaction(STORE_FEATURES, 'readwrite');
        const store = tx.objectStore(STORE_FEATURES);
        const index = store.index('projectId');
        const req = index.openKeyCursor(IDBKeyRange.only(projectId));
        req.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            store.delete(cursor.primaryKey);
            cursor.continue();
          }
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });

      if (features.length === 0) return;

      if (features.length <= 5000) {
        await new Promise((resolve) => {
          const tx = db.transaction(STORE_FEATURES, 'readwrite');
          const store = tx.objectStore(STORE_FEATURES);
          for (let i = 0; i < features.length; i++) {
            const feat = features[i];
            if (feat && feat.id) {
              const compacted = GeoCompressor.compactFeatureForStorage(feat);
              store.put({ ...compacted, projectId });
            }
          }
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        });
        return;
      }

      const CHUNK_SIZE = 10000;
      for (let i = 0; i < features.length; i += CHUNK_SIZE) {
        const chunk = features.slice(i, i + CHUNK_SIZE);
        await new Promise((resolve) => {
          const tx = db.transaction(STORE_FEATURES, 'readwrite');
          const store = tx.objectStore(STORE_FEATURES);
          for (let j = 0; j < chunk.length; j++) {
            const feat = chunk[j];
            if (feat && feat.id) {
              const compacted = GeoCompressor.compactFeatureForStorage(feat);
              store.put({ ...compacted, projectId });
            }
          }
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        });
        await yieldToMain();
      }
    } catch (e) {
      console.warn('[IndexedDbStore] Erro ao salvar lote de feições:', e);
    }
  }

  static async commitDeltasToDb(toUpsert, toDelete) {
    try {
      const db = await this.getDB();
      if (!db) return false;

      if (toUpsert.length + toDelete.length <= 5000) {
        return await new Promise((resolve) => {
          const tx = db.transaction(STORE_FEATURES, 'readwrite');
          const store = tx.objectStore(STORE_FEATURES);
          for (let i = 0; i < toDelete.length; i++) {
            store.delete(toDelete[i]);
          }
          for (let i = 0; i < toUpsert.length; i++) {
            store.put(toUpsert[i]);
          }
          tx.oncomplete = () => resolve(true);
          tx.onerror = (err) => {
            console.warn('[IndexedDbStore] Falha na transação de deltas:', err);
            resolve(false);
          };
        });
      }

      return await this.executeDeltasChunked(db, toDelete, toUpsert, 10000);
    } catch (err) {
      console.warn('[IndexedDbStore] Erro ao commitar deltas no IndexedDB:', err);
      return false;
    }
  }

  static async executeDeltasChunked(db, toDelete, toUpsert, chunkSize = 10000) {
    for (let i = 0; i < toDelete.length; i += chunkSize) {
      const slice = toDelete.slice(i, i + chunkSize);
      await new Promise((resolve) => {
        const tx = db.transaction(STORE_FEATURES, 'readwrite');
        const store = tx.objectStore(STORE_FEATURES);
        for (let j = 0; j < slice.length; j++) {
          store.delete(slice[j]);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
      await yieldToMain();
    }

    for (let i = 0; i < toUpsert.length; i += chunkSize) {
      const slice = toUpsert.slice(i, i + chunkSize);
      await new Promise((resolve) => {
        const tx = db.transaction(STORE_FEATURES, 'readwrite');
        const store = tx.objectStore(STORE_FEATURES);
        for (let j = 0; j < slice.length; j++) {
          store.put(slice[j]);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
      await yieldToMain();
    }
    return true;
  }

  static async logAudit(entry, projectId = 'projeto_padrao') {
    return this.appendAudit(entry, projectId);
  }

  static async appendAudit(entry, projectId = 'projeto_padrao') {
    if (!entry) return;
    try {
      const db = await this.getDB();
      if (!db) return;
      const tx = db.transaction(STORE_AUDIT, 'readwrite');
      tx.objectStore(STORE_AUDIT).put({
        ...entry,
        id: entry.id || 'aud-' + Math.random().toString(36).substring(2, 9),
        projectId,
        timestamp: entry.timestamp || new Date().toISOString()
      });
    } catch (e) {
      console.warn('[IndexedDbStore] Erro ao registrar auditoria:', e);
    }
  }

  static async getAuditLog(projectId = 'projeto_padrao', limit = 100) {
    try {
      const db = await this.getDB();
      if (!db) return [];
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_AUDIT, 'readonly');
        const store = tx.objectStore(STORE_AUDIT);
        const index = store.index('projectId');
        const req = index.getAll(IDBKeyRange.only(projectId));
        req.onsuccess = () => {
          const list = req.result || [];
          list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
          resolve(list.slice(0, limit));
        };
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  static async loadCurrentProjectAsync(projectId = 'projeto_padrao') {
    try {
      const db = await this.getDB();
      if (!db) return LocalStore.loadManifest();

      await this.migrateLegacyDataIfNeeded(db, projectId);

      return new Promise((resolve) => {
        const tx = db.transaction([STORE_PROJECTS, STORE_LAYERS, STORE_FEATURES, STORE_AUDIT], 'readonly');
        const projectsStore = tx.objectStore(STORE_PROJECTS);
        const layersStore = tx.objectStore(STORE_LAYERS);
        const featuresStore = tx.objectStore(STORE_FEATURES);
        const auditStore = tx.objectStore(STORE_AUDIT);

        const projectReq = projectsStore.get(projectId);
        const layersReq = layersStore.index('projectId').getAll(projectId);
        const featuresReq = featuresStore.index('projectId').getAll(projectId);
        const auditReq = auditStore.index('projectId').getAll(projectId);

        tx.oncomplete = () => {
          const projectData = projectReq.result || LocalStore.loadManifest() || {};

          let layers = layersReq.result || [];
          if (layers.length > 0) {
            layers.sort((a, b) => (a.order || 0) - (b.order || 0));
            projectData.layers = layers;
          } else if (!Array.isArray(projectData.layers) || projectData.layers.length === 0) {
            const syncProject = LocalStore.loadManifest();
            projectData.layers = (syncProject && Array.isArray(syncProject.layers)) ? syncProject.layers : [];
          }

          let features = featuresReq.result || [];
          projectData.features = Array.isArray(features) ? features : [];

          const audit = auditReq.result || [];
          audit.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
          projectData.auditLog = audit.slice(0, 100);

          resolve(projectData);
        };

        tx.onerror = () => {
          resolve(LocalStore.loadManifest());
        };
      });
    } catch {
      return LocalStore.loadManifest();
    }
  }

  static async applyRemoteChangesLocally(upserted = [], deletedIds = [], projectId = 'projeto_padrao') {
    if ((!upserted || upserted.length === 0) && (!deletedIds || deletedIds.length === 0)) return true;

    try {
      const db = await this.getDB();
      if (!db) return false;

      return new Promise((resolve) => {
        const tx = db.transaction(STORE_FEATURES, 'readwrite');
        const store = tx.objectStore(STORE_FEATURES);

        if (Array.isArray(deletedIds)) {
          for (let i = 0; i < deletedIds.length; i++) {
            store.delete(deletedIds[i]);
          }
        }

        if (Array.isArray(upserted)) {
          for (let i = 0; i < upserted.length; i++) {
            const feat = upserted[i];
            if (feat && feat.id) {
              const compacted = GeoCompressor.compactFeatureForStorage(feat);
              store.put({ ...compacted, projectId });
            }
          }
        }

        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch (err) {
      console.warn('[IndexedDbStore] Erro ao gravar alterações remotas no IndexedDB:', err);
      return false;
    }
  }

  static async clearCurrentProject(projectId = 'projeto_padrao') {
    try {
      LocalStore.clearManifest();
      const db = await this.getDB();
      if (!db) return;
      const tx = db.transaction([STORE_PROJECTS, STORE_LAYERS, STORE_FEATURES, STORE_AUDIT], 'readwrite');
      tx.objectStore(STORE_PROJECTS).delete(projectId);

      const deleteByIndex = (storeName, indexName) => {
        const store = tx.objectStore(storeName);
        const req = store.index(indexName).openKeyCursor(IDBKeyRange.only(projectId));
        req.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            store.delete(cursor.primaryKey);
            cursor.continue();
          }
        };
      };

      deleteByIndex(STORE_LAYERS, 'projectId');
      deleteByIndex(STORE_FEATURES, 'projectId');
      deleteByIndex(STORE_AUDIT, 'projectId');
    } catch {}
  }
}
