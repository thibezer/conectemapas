/* ==========================================================================
   ConecteMapas - IndexedDbSchema
   Inicialização, esquemas das 4 Object Stores e migrações do IndexedDB v3
   ========================================================================== */

import {
  DB_NAME,
  DB_VERSION,
  STORE_PROJECTS,
  STORE_LAYERS,
  STORE_FEATURES,
  STORE_AUDIT
} from './StorageConstants.js';

export class IndexedDbSchema {
  /**
   * Inicializa o banco IndexedDB (v3) com Object Stores normalizadas e índices relacionais
   */
  static async getDB() {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        resolve(null);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onblocked = () => {
        console.warn('[IndexedDbSchema] Upgrade do IndexedDB aguardando fechamento de outras abas.');
      };

      request.onupgradeneeded = (e) => {
        const db = e.target.result;

        if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
          db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
        }

        let layersStore = db.objectStoreNames.contains(STORE_LAYERS)
          ? e.target.transaction.objectStore(STORE_LAYERS)
          : db.createObjectStore(STORE_LAYERS, { keyPath: 'id' });
        if (!layersStore.indexNames.contains('projectId')) {
          layersStore.createIndex('projectId', 'projectId', { unique: false });
        }
        if (!layersStore.indexNames.contains('order')) {
          layersStore.createIndex('order', 'order', { unique: false });
        }

        let featuresStore = db.objectStoreNames.contains(STORE_FEATURES)
          ? e.target.transaction.objectStore(STORE_FEATURES)
          : db.createObjectStore(STORE_FEATURES, { keyPath: 'id' });
        if (!featuresStore.indexNames.contains('projectId')) {
          featuresStore.createIndex('projectId', 'projectId', { unique: false });
        }
        if (!featuresStore.indexNames.contains('layerId')) {
          featuresStore.createIndex('layerId', 'layerId', { unique: false });
        }

        let auditStore = db.objectStoreNames.contains(STORE_AUDIT)
          ? e.target.transaction.objectStore(STORE_AUDIT)
          : db.createObjectStore(STORE_AUDIT, { keyPath: 'id' });
        if (!auditStore.indexNames.contains('projectId')) {
          auditStore.createIndex('projectId', 'projectId', { unique: false });
        }
        if (!auditStore.indexNames.contains('timestamp')) {
          auditStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      request.onsuccess = (e) => {
        const db = e.target.result;
        db.onversionchange = () => {
          db.close();
        };
        resolve(db);
      };

      request.onerror = (err) => {
        console.error('[IndexedDbSchema] Erro ao abrir IndexedDB:', err);
        resolve(null);
      };
    });
  }

  /**
   * Migração de dados legados (DML) executada de forma assíncrona segura fora de onupgradeneeded
   */
  static async migrateLegacyDataIfNeeded(db, projectId = 'projeto_padrao') {
    return new Promise((resolve) => {
      try {
        const tx = db.transaction([STORE_PROJECTS, STORE_LAYERS, STORE_FEATURES, STORE_AUDIT], 'readwrite');
        const projectsStore = tx.objectStore(STORE_PROJECTS);
        const layersStore = tx.objectStore(STORE_LAYERS);
        const featuresStore = tx.objectStore(STORE_FEATURES);
        const auditStore = tx.objectStore(STORE_AUDIT);

        const projectReq = projectsStore.get(projectId);
        projectReq.onsuccess = () => {
          const project = projectReq.result;
          if (!project) {
            resolve(false);
            return;
          }

          let migrated = false;

          if (Array.isArray(project.layers) && project.layers.length > 0) {
            project.layers.forEach((layer, idx) => {
              if (layer && layer.id) {
                layersStore.put({
                  ...layer,
                  projectId,
                  order: layer.order !== undefined ? layer.order : idx,
                  updatedAt: layer.updatedAt || new Date().toISOString()
                });
              }
            });
            delete project.layers;
            migrated = true;
          }

          if (Array.isArray(project.auditLog) && project.auditLog.length > 0) {
            project.auditLog.forEach(entry => {
              if (entry) {
                const entryId = entry.id || 'aud-' + Math.random().toString(36).substring(2, 9);
                auditStore.put({
                  ...entry,
                  id: entryId,
                  projectId
                });
              }
            });
            delete project.auditLog;
            migrated = true;
          }

          if (Array.isArray(project.features) && project.features.length > 0) {
            const TEST_MOCK_IDS = new Set(['feat-m01', 'feat-m02', 'feat-app-01', 'feat-quadra-a', 'feat-rota-01', 'feat-buffer-01']);
            project.features.forEach(f => {
              if (f && f.id && !TEST_MOCK_IDS.has(f.id)) {
                featuresStore.put({
                  ...f,
                  projectId
                });
              }
            });
            delete project.features;
            migrated = true;
          }

          if (migrated) {
            projectsStore.put(project);
          }
        };

        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  static async estimateStorage() {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        const usageMB = (estimate.usage / (1024 * 1024)).toFixed(1);
        const quotaMB = (estimate.quota / (1024 * 1024)).toFixed(1);
        const quotaGB = (estimate.quota / (1024 * 1024 * 1024)).toFixed(1);
        const percent = ((estimate.usage / estimate.quota) * 100).toFixed(1);
        return {
          usageMB,
          quotaMB,
          quotaGB,
          percent,
          text: `${usageMB} MB usados de ${quotaGB} GB disponíveis (${percent}%)`
        };
      } catch {}
    }
    return null;
  }
}
