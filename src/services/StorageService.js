/* ==========================================================================
   ConecteMapas - StorageService (Relational Intelligent Data Persistence)
   Arquitetura Normalizada (IndexedDB v3):
   - Store 'projects': Metadados estruturais do projeto (< 2 KB)
   - Store 'layers': Camadas isoladas indexadas por 'projectId' e 'order'
   - Store 'features': Feições particionadas indexadas por 'projectId' e 'layerId'
   - Store 'audit': Log de auditoria desacoplado indexado por 'projectId' e 'timestamp'
   - LocalStorage: Manifesto síncrono ultra-leve para inicialização de frame zero sem FOUC.
   ========================================================================== */

import { GeoCompressor } from './GeoCompressor.js';

const STORAGE_KEY = 'conectemapas_state_v1';
const PROJECTS_LIST_KEY = 'conectemapas_projects_meta_v1';
const DB_NAME = 'ConecteMapasDB';
const DB_VERSION = 3;
const STORE_PROJECTS = 'projects';
const STORE_LAYERS = 'layers';
const STORE_FEATURES = 'features';
const STORE_AUDIT = 'audit';

let _metaDebounceTimer = null;
let _pendingMetaPayload = null;
let _projectDebounceTimer = null;
let _pendingProjectPayload = null;

// Filas de Delta para Persistência Diferencial / Incremental (Dirty Tracking)
const _dirtyFeatures = new Map(); // id -> feature modificada/criada
const _deletedFeatureIds = new Set(); // ids das feições removidas
let _deltaDebounceTimer = null;

// Configuração de Conexão à Nuvem (Hostinger LiteSpeed / Apache MySQL)
const CLOUD_API_URL = (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
  ? './api.php'
  : 'https://lavender-panther-702784.hostingersite.com/api.php';

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
let _lastServerSyncTimestamp = null;

function yieldToMain() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

export class StorageService {
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

      // Tratamento de bloqueio multi-aba
      request.onblocked = () => {
        console.warn('[StorageService] Upgrade do IndexedDB aguardando fechamento de outras abas.');
      };

      request.onupgradeneeded = (e) => {
        const db = e.target.result;

        // 1. Store 'projects' (chave primária 'id')
        if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
          db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
        }

        // 2. Store 'layers' (chave primária 'id', índices 'projectId' e 'order')
        let layersStore;
        if (!db.objectStoreNames.contains(STORE_LAYERS)) {
          layersStore = db.createObjectStore(STORE_LAYERS, { keyPath: 'id' });
        } else {
          layersStore = e.target.transaction.objectStore(STORE_LAYERS);
        }
        if (!layersStore.indexNames.contains('projectId')) {
          layersStore.createIndex('projectId', 'projectId', { unique: false });
        }
        if (!layersStore.indexNames.contains('order')) {
          layersStore.createIndex('order', 'order', { unique: false });
        }

        // 3. Store 'features' (chave primária 'id', índices 'projectId' e 'layerId')
        let featuresStore;
        if (!db.objectStoreNames.contains(STORE_FEATURES)) {
          featuresStore = db.createObjectStore(STORE_FEATURES, { keyPath: 'id' });
        } else {
          featuresStore = e.target.transaction.objectStore(STORE_FEATURES);
        }
        if (!featuresStore.indexNames.contains('projectId')) {
          featuresStore.createIndex('projectId', 'projectId', { unique: false });
        }
        if (!featuresStore.indexNames.contains('layerId')) {
          featuresStore.createIndex('layerId', 'layerId', { unique: false });
        }

        // 4. Store 'audit' (chave primária 'id', índices 'projectId' e 'timestamp')
        let auditStore;
        if (!db.objectStoreNames.contains(STORE_AUDIT)) {
          auditStore = db.createObjectStore(STORE_AUDIT, { keyPath: 'id' });
        } else {
          auditStore = e.target.transaction.objectStore(STORE_AUDIT);
        }
        if (!auditStore.indexNames.contains('projectId')) {
          auditStore.createIndex('projectId', 'projectId', { unique: false });
        }
        if (!auditStore.indexNames.contains('timestamp')) {
          auditStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      request.onsuccess = (e) => {
        const db = e.target.result;
        // Permite que outras abas façam upgrade sem travar
        db.onversionchange = () => {
          db.close();
        };
        resolve(db);
      };

      request.onerror = (err) => {
        console.error('[StorageService] Erro ao abrir IndexedDB:', err);
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

          // 1. Migra camadas legadas embutidas no projeto para a store 'layers'
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

          // 2. Migra log de auditoria legado embutido para a store 'audit'
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

          // 3. Migra feições legadas embutidas no projeto para a store 'features'
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

  // ==========================================================================
  // METADADOS E MANIFESTO (PROJETOS & LOCALSTORAGE DUAL-PERSISTENCE)
  // ==========================================================================

  /**
   * Persiste o manifesto leve síncrono no LocalStorage e o metadado no IndexedDB
   * Respeita a Regra 2 do GEMINI.md (dual persistence para evitar flash de tela no boot)
   * @param {Object} projectData
   */
  static saveMetadata(projectData) {
    try {
      const manifest = {
        id: projectData.id || 'projeto_padrao',
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

      // 1. Grava manifesto síncrono ultra-rápido no LocalStorage
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(manifest));
        } catch (err) {
          console.warn('[StorageService] Falha ao gravar manifesto no LocalStorage:', err);
        }
      }

      // 2. Grava registro isolado do projeto no IndexedDB (sem features e sem auditLog)
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
      this.updateProjectsIndex(manifest);

      // 3. Se houver camadas no payload, sincroniza na store 'layers'
      if (Array.isArray(projectData.layers) && projectData.layers.length > 0) {
        this.saveLayersBatch(projectData.layers, manifest.id);
      }

      // 4. Sincronização em Nuvem (Hostinger LiteSpeed MySQL)
      this.syncMetadataToCloudDebounced(projectData);

      return true;
    } catch (e) {
      console.error('[StorageService] Erro ao salvar metadados:', e);
      return false;
    }
  }

  static saveMetadataDebounced(projectData, delayMs = 300) {
    _pendingMetaPayload = projectData;
    if (_metaDebounceTimer) {
      clearTimeout(_metaDebounceTimer);
    }
    _metaDebounceTimer = setTimeout(() => {
      _metaDebounceTimer = null;
      if (_pendingMetaPayload) {
        this.saveMetadata(_pendingMetaPayload);
        _pendingMetaPayload = null;
      }
    }, delayMs);
  }

  static async saveProjectRecord(projectRecord) {
    try {
      const db = await this.getDB();
      if (!db) return;
      const tx = db.transaction(STORE_PROJECTS, 'readwrite');
      tx.objectStore(STORE_PROJECTS).put(projectRecord);
    } catch (e) {
      console.warn('[StorageService] Erro ao gravar registro de projeto:', e);
    }
  }

  // ==========================================================================
  // CAMADAS (STORE 'layers' - CRUD GRANULAR RELACIONAL)
  // ==========================================================================

  /**
   * Salva ou atualiza uma única camada na store 'layers' (O(1), < 1 ms)
   * Sem resserializar o projeto nem outras camadas.
   * @param {Object} layer
   * @param {string} projectId
   */
  static async saveLayer(layer, projectId = 'projeto_padrao') {
    if (!layer || !layer.id) return;
    try {
      const db = await this.getDB();
      if (!db) return;
      const tx = db.transaction(STORE_LAYERS, 'readwrite');
      const store = tx.objectStore(STORE_LAYERS);
      store.put({
        ...layer,
        projectId,
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      console.warn('[StorageService] Erro ao salvar camada:', e);
    }
  }

  /**
   * Grava múltiplas camadas com ordenação na store 'layers'
   * @param {Array<Object>} layers
   * @param {string} projectId
   */
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
      console.warn('[StorageService] Erro ao salvar lote de camadas:', e);
    }
  }

  /**
   * Remove uma camada com salvaguarda de integridade referencial:
   * Migra feições órfãs para a camada de destino antes da exclusão.
   * @param {string} layerId
   * @param {string|null} fallbackLayerId
   * @param {string} projectId
   */
  static async deleteLayer(layerId, fallbackLayerId = null, projectId = 'projeto_padrao') {
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
            const updated = { ...cursor.value, layerId: fallbackLayerId };
            cursor.update(updated);
            cursor.continue();
          }
        };
      }
      layersStore.delete(layerId);
    } catch (e) {
      console.warn('[StorageService] Erro ao excluir camada com cascade:', e);
    }
  }

  // ==========================================================================
  // FEIÇÕES (STORE 'features' - PERSISTÊNCIA DIFERENCIAL & DELTA QUEUE)
  // ==========================================================================

  static queueFeatureUpsert(feature, projectId = 'projeto_padrao') {
    if (!feature || !feature.id) return;
    const compacted = GeoCompressor.compactFeatureForStorage(feature);
    _deletedFeatureIds.delete(feature.id);
    _dirtyFeatures.set(feature.id, { ...compacted, projectId });
    this.commitDeltasDebounced(350);
  }

  static queueFeaturesBulkUpsert(features, projectId = 'projeto_padrao') {
    if (!Array.isArray(features) || features.length === 0) return;
    for (let i = 0; i < features.length; i++) {
      const feat = features[i];
      if (feat && feat.id) {
        const compacted = GeoCompressor.compactFeatureForStorage(feat);
        _deletedFeatureIds.delete(feat.id);
        _dirtyFeatures.set(feat.id, { ...compacted, projectId });
      }
    }
    this.commitDeltasDebounced(350);
  }

  static queueFeatureDelete(featureId) {
    if (!featureId) return;
    _dirtyFeatures.delete(featureId);
    _deletedFeatureIds.add(featureId);
    this.commitDeltasDebounced(350);
  }

  static queueFeaturesBulkDelete(featureIds) {
    if (!Array.isArray(featureIds) || featureIds.length === 0) return;
    for (let i = 0; i < featureIds.length; i++) {
      const id = featureIds[i];
      if (id) {
        _dirtyFeatures.delete(id);
        _deletedFeatureIds.add(id);
      }
    }
    this.commitDeltasDebounced(350);
  }

  static commitDeltasDebounced(delayMs = 350) {
    if (_deltaDebounceTimer) {
      clearTimeout(_deltaDebounceTimer);
    }
    _deltaDebounceTimer = setTimeout(() => {
      _deltaDebounceTimer = null;
      this.commitDeltas();
    }, delayMs);
  }

  static async commitDeltas() {
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

    try {
      const db = await this.getDB();
      if (!db) return false;

      if (toUpsert.length + toDelete.length <= 5000) {
        const idbPromise = new Promise((resolve) => {
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
            console.warn('[StorageService] Falha na transação de deltas:', err);
            resolve(false);
          };
        });

        // Sincronização em nuvem assíncrona não-bloqueante
        this.syncDeltasToCloud(toUpsert, toDelete);

        return await idbPromise;
      }

      const chunkedResult = await this.executeDeltasChunked(db, toDelete, toUpsert, 10000);
      this.syncDeltasToCloud(toUpsert, toDelete);
      return chunkedResult;
    } catch (err) {
      console.warn('[StorageService] Erro ao commitar deltas no IndexedDB:', err);
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

  static applyDiff(oldFeatures, newFeatures, projectId = 'projeto_padrao') {
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

    if (toDelete.length > 0) this.queueFeaturesBulkDelete(toDelete);
    if (toUpsert.length > 0) this.queueFeaturesBulkUpsert(toUpsert, projectId);
  }

  static async saveFeature(feature, projectId = 'projeto_padrao') {
    this.queueFeatureUpsert(feature, projectId);
  }

  static async deleteFeature(featureId) {
    this.queueFeatureDelete(featureId);
  }

  static async saveFeaturesBatch(features, projectId = 'projeto_padrao') {
    if (!Array.isArray(features)) return;
    try {
      const db = await this.getDB();
      if (!db) return;

      if (features.length === 0) {
        await new Promise((resolve) => {
          const tx = db.transaction(STORE_FEATURES, 'readwrite');
          tx.objectStore(STORE_FEATURES).clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        });
        return;
      }

      if (features.length <= 5000) {
        await new Promise((resolve) => {
          const tx = db.transaction(STORE_FEATURES, 'readwrite');
          const store = tx.objectStore(STORE_FEATURES);
          store.clear();
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

      await new Promise((resolve) => {
        const tx = db.transaction(STORE_FEATURES, 'readwrite');
        tx.objectStore(STORE_FEATURES).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });

      // Transações agrupadas de alta vazão (10.000 itens) sem pausas artificiais
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
        if (i + CHUNK_SIZE < features.length) {
          await yieldToMain();
        }
      }
    } catch (e) {
      console.warn('[StorageService] Falha ao salvar lote de feições no IndexedDB:', e);
    }
  }

  // ==========================================================================
  // AUDITORIA (STORE 'audit' - APPEND-ONLY RELACIONAL)
  // ==========================================================================

  /**
   * Adiciona um registro de auditoria isolado na store 'audit' (O(1))
   * Sem inchar o registro do projeto.
   * @param {Object} entry
   * @param {string} projectId
   */
  static async logAudit(entry, projectId = 'projeto_padrao') {
    if (!entry) return;
    try {
      const db = await this.getDB();
      if (!db) return;
      const tx = db.transaction(STORE_AUDIT, 'readwrite');
      const store = tx.objectStore(STORE_AUDIT);
      const record = {
        id: entry.id || 'aud-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        projectId,
        timestamp: entry.timestamp || new Date().toISOString(),
        user: entry.user || 'Você',
        action: entry.action || '',
        detail: entry.detail || ''
      };
      store.put(record);
    } catch (e) {
      console.warn('[StorageService] Erro ao registrar auditoria:', e);
    }
  }

  /**
   * Recupera o log de auditoria do projeto ordenado do mais recente ao mais antigo
   * @param {string} projectId
   * @param {number} limit
   */
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
          // Ordena decrescente por timestamp
          list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
          resolve(list.slice(0, limit));
        };
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  // ==========================================================================
  // CARREGAMENTO E RECUPERAÇÃO DO ESTADO COMPLETO (RECOMPOSIÇÃO RELACIONAL)
  // ==========================================================================

  /**
   * Carrega o estado síncrono inicial (rápido) do LocalStorage para renderizar frame zero sem FOUC
   */
  static loadCurrentProject() {
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
      console.error('[StorageService] Erro ao carregar estado do LocalStorage:', e);
      return null;
    }
  }

  /**
   * Recompõe o estado completo de forma transparente a partir das 4 stores normalizadas:
   * 'projects', 'layers', 'features', 'audit'.
   * @param {string} projectId
   */
  static async loadCurrentProjectAsync(projectId = 'projeto_padrao') {
    try {
      const db = await this.getDB();
      if (!db) return this.loadCurrentProject();

      // Executa migração assíncrona se encontrar dados de versões legadas
      await this.migrateLegacyDataIfNeeded(db, projectId);

      return new Promise((resolve) => {
        const tx = db.transaction([STORE_PROJECTS, STORE_LAYERS, STORE_FEATURES, STORE_AUDIT], 'readonly');
        const projectsStore = tx.objectStore(STORE_PROJECTS);
        const layersStore = tx.objectStore(STORE_LAYERS);
        const featuresStore = tx.objectStore(STORE_FEATURES);
        const auditStore = tx.objectStore(STORE_AUDIT);

        const projectReq = projectsStore.get(projectId);
        const layersIndex = layersStore.index('projectId');
        const layersReq = layersIndex.getAll(projectId);
        const featuresIndex = featuresStore.index('projectId');
        const featuresReq = featuresIndex.getAll(projectId);
        const auditIndex = auditStore.index('projectId');
        const auditReq = auditIndex.getAll(projectId);

        tx.oncomplete = () => {
          const projectData = projectReq.result || StorageService.loadCurrentProject() || {};

          // 1. Recompõe Camadas normalizadas
          let layers = layersReq.result || [];
          if (layers.length > 0) {
            layers.sort((a, b) => (a.order || 0) - (b.order || 0));
            projectData.layers = layers;
          } else if (!Array.isArray(projectData.layers) || projectData.layers.length === 0) {
            const syncProject = StorageService.loadCurrentProject();
            projectData.layers = (syncProject && Array.isArray(syncProject.layers)) ? syncProject.layers : [];
          }

          // 2. Recompõe Feições normalizadas
          let features = featuresReq.result || [];
          // Fallback caso a feição ainda não tenha o projectId indexado
          if (features.length === 0) {
            try {
              const allTx = db.transaction(STORE_FEATURES, 'readonly');
              const allReq = allTx.objectStore(STORE_FEATURES).getAll();
              allReq.onsuccess = () => {
                const allFeats = allReq.result || [];
                // Respeita a Regra 1 do GEMINI.md
                projectData.features = Array.isArray(allFeats) ? allFeats : [];
              };
            } catch {
              projectData.features = [];
            }
          } else {
            // Respeita a Regra 1 do GEMINI.md: Se for array vazio [], respeitar e não voltar aos mocks
            projectData.features = Array.isArray(features) ? features : [];
          }

          // 3. Recompõe Log de Auditoria
          const audit = auditReq.result || [];
          audit.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
          projectData.auditLog = audit.slice(0, 100);

          resolve(projectData);
        };

        tx.onerror = () => {
          resolve(StorageService.loadCurrentProject());
        };
      });
    } catch {
      return this.loadCurrentProject();
    }
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
    if (_deltaDebounceTimer) {
      clearTimeout(_deltaDebounceTimer);
      _deltaDebounceTimer = null;
    }
    if (_projectDebounceTimer) {
      clearTimeout(_projectDebounceTimer);
      _projectDebounceTimer = null;
    }

    const dataToSave = _pendingProjectPayload || _pendingMetaPayload || fallbackData;
    if (dataToSave) {
      this.saveMetadata(dataToSave);
      _pendingProjectPayload = null;
      _pendingMetaPayload = null;
    }

    this.commitDeltas();
  }

  static updateProjectsIndex(project) {
    try {
      if (typeof localStorage === 'undefined') return;
      let list = this.listProjects();
      const existingIdx = list.findIndex(p => p.id === project.id);
      const meta = {
        id: project.id,
        name: project.name,
        updatedAt: project.updatedAt,
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
      console.warn('[StorageService] Falha ao atualizar índice:', e);
    }
  }

  static listProjects() {
    try {
      if (typeof localStorage === 'undefined') return [];
      const raw = localStorage.getItem(PROJECTS_LIST_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  static clearCurrentProject() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
      }
      this.getDB().then(db => {
        if (!db) return;
        const tx = db.transaction([STORE_PROJECTS, STORE_LAYERS, STORE_FEATURES, STORE_AUDIT], 'readwrite');
        tx.objectStore(STORE_PROJECTS).clear();
        tx.objectStore(STORE_LAYERS).clear();
        tx.objectStore(STORE_FEATURES).clear();
        tx.objectStore(STORE_AUDIT).clear();
      });
    } catch {}
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

  // ==========================================================================
  // CLOUD SYNC - INTEGRAÇÃO COM MYSQL HOSTINGER (u941736878_conectemapas)
  // ==========================================================================

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
      try { listener(status); } catch (e) { console.warn('[StorageService] Erro no listener de status da nuvem:', e); }
    }
  }

  /**
   * Testa a conectividade com o banco MySQL da Hostinger via api.php
   */
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

  /**
   * Envia metadados e camadas para a nuvem em background (debounced)
   */
  static syncMetadataToCloudDebounced(projectData, delayMs = 600) {
    if (_cloudMetaDebounceTimer) clearTimeout(_cloudMetaDebounceTimer);
    _cloudMetaDebounceTimer = setTimeout(() => {
      _cloudMetaDebounceTimer = null;
      this.syncMetadataToCloud(projectData);
    }, delayMs);
  }

  static async syncMetadataToCloud(projectData) {
    if (!projectData) return;
    try {
      _cloudStatus.syncing = true;
      this._notifyCloudStatus();

      const payload = {
        id: projectData.id || 'projeto_padrao',
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

      const res = await fetch(`${CLOUD_API_URL}?action=save_metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        _cloudStatus.connected = true;
        _cloudStatus.lastSyncedAt = new Date().toISOString();
        _cloudStatus.error = null;
      }
    } catch (err) {
      console.warn('[StorageService] Falha ao sincronizar metadados com Hostinger:', err);
      _cloudStatus.error = err.message;
    } finally {
      _cloudStatus.syncing = false;
      this._notifyCloudStatus();
    }
  }

  /**
   * Sincroniza deltas de feições na nuvem de forma assíncrona
   */
  static async syncDeltasToCloud(toUpsert, toDelete, projectId = 'projeto_padrao') {
    if ((!toUpsert || toUpsert.length === 0) && (!toDelete || toDelete.length === 0)) return;

    try {
      _cloudStatus.syncing = true;
      this._notifyCloudStatus();

      const payload = {
        projectId,
        toUpsert: toUpsert || [],
        toDelete: toDelete || []
      };

      const res = await fetch(`${CLOUD_API_URL}?action=sync_deltas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const resData = await res.json().catch(() => null);
        if (resData && resData.serverTime) {
          _lastServerSyncTimestamp = resData.serverTime;
        }
        _cloudStatus.connected = true;
        _cloudStatus.lastSyncedAt = new Date().toISOString();
        _cloudStatus.error = null;
      }
    } catch (err) {
      console.warn('[StorageService] Falha ao sincronizar deltas com Hostinger MySQL:', err);
      _cloudStatus.error = err.message;
    } finally {
      _cloudStatus.syncing = false;
      this._notifyCloudStatus();
    }
  }

  /**
   * Salva o projeto integralmente (metadados, camadas e todas as feições) no MySQL da Hostinger
   * @param {Object} projectData
   */
  static async saveProjectToCloud(projectData) {
    if (!projectData) return { success: false, error: 'Sem dados para salvar' };
    try {
      _cloudStatus.syncing = true;
      this._notifyCloudStatus();

      const payload = {
        id: projectData.id || 'projeto_padrao',
        name: projectData.name || 'Levantamento Topográfico - Umuarama',
        description: projectData.description || '',
        basemap: projectData.basemap || 'google_satelite_puro',
        center: projectData.center || [-23.7661, -53.3206],
        zoom: projectData.zoom || 14,
        layers: Array.isArray(projectData.layers) ? projectData.layers : [],
        features: Array.isArray(projectData.features) ? projectData.features : []
      };

      const res = await fetch(`${CLOUD_API_URL}?action=save_all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const result = await res.json();
      if (result && result.success) {
        if (result.serverTime) {
          _lastServerSyncTimestamp = result.serverTime;
        }
        _cloudStatus.connected = true;
        _cloudStatus.lastSyncedAt = new Date().toISOString();
        _cloudStatus.error = null;
        return { success: true, count: payload.features.length, message: result.message };
      } else {
        throw new Error(result?.error || 'Erro ao persistir no servidor');
      }
    } catch (err) {
      console.warn('[StorageService] Falha ao salvar projeto integral no MySQL Hostinger:', err);
      _cloudStatus.error = err.message;
      return { success: false, error: err.message };
    } finally {
      _cloudStatus.syncing = false;
      this._notifyCloudStatus();
    }
  }

  /**
   * Versão debounced do salvamento integral em nuvem
   */
  static syncProjectToCloudDebounced(projectData, delayMs = 1500) {
    if (_cloudMetaDebounceTimer) clearTimeout(_cloudMetaDebounceTimer);
    _cloudMetaDebounceTimer = setTimeout(() => {
      _cloudMetaDebounceTimer = null;
      this.saveProjectToCloud(projectData);
    }, delayMs);
  }

  /**
   * Carrega o projeto da nuvem (Hostinger MySQL)
   */
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

      if (data.serverTime) {
        _lastServerSyncTimestamp = data.serverTime;
      }

      _cloudStatus.connected = true;
      _cloudStatus.lastCheck = new Date().toISOString();
      this._notifyCloudStatus();

      return data;
    } catch (err) {
      console.warn('[StorageService] Nuvem indisponível para carregamento:', err);
      return null;
    }
  }

  /**
   * Retorna o timestamp da última sincronização com o servidor
   */
  static getLastServerSyncTimestamp() {
    return _lastServerSyncTimestamp;
  }

  /**
   * Define o timestamp de sincronização do servidor
   */
  static setLastServerSyncTimestamp(ts) {
    _lastServerSyncTimestamp = ts;
  }

  /**
   * Busca alterações remotas (deltas) na nuvem desde a última checagem
   * @param {string} projectId
   * @returns {Promise<{upserted: Array, deleted: Array, project: Object}|null>}
   */
  static async pullChangesFromCloud(projectId = 'projeto_padrao') {
    try {
      const sinceParam = _lastServerSyncTimestamp ? encodeURIComponent(_lastServerSyncTimestamp) : '';
      const url = `${CLOUD_API_URL}?action=pull_changes&projectId=${encodeURIComponent(projectId)}&since=${sinceParam}`;

      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        cache: 'no-cache'
      });

      if (!res.ok) return null;
      const data = await res.json();
      if (!data || !data.success) return null;

      if (data.serverTime) {
        _lastServerSyncTimestamp = data.serverTime;
      }

      _cloudStatus.connected = true;
      _cloudStatus.lastSyncedAt = new Date().toISOString();
      _cloudStatus.error = null;
      this._notifyCloudStatus();

      return {
        upserted: Array.isArray(data.upserted) ? data.upserted : [],
        deleted: Array.isArray(data.deleted) ? data.deleted : [],
        project: data.project || null
      };
    } catch (err) {
      // Falha silenciosa para não degradar a experiência em caso de oscilação momentânea
      return null;
    }
  }

  /**
   * Grava no IndexedDB local as alterações vindas da nuvem (remotas)
   * sem reenviá-las para o servidor (evita loops e ecos de sincronização)
   */
  static async applyRemoteChangesLocally(upserted = [], deletedIds = [], projectId = 'projeto_padrao') {
    if ((!upserted || upserted.length === 0) && (!deletedIds || deletedIds.length === 0)) return true;

    // Limpa das filas dirty locais para garantir que não haja feedback loop
    if (Array.isArray(deletedIds)) {
      for (const id of deletedIds) {
        _dirtyFeatures.delete(id);
        _deletedFeatureIds.delete(id);
      }
    }
    if (Array.isArray(upserted)) {
      for (const f of upserted) {
        if (f && f.id) {
          _dirtyFeatures.delete(f.id);
          _deletedFeatureIds.delete(f.id);
        }
      }
    }

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
      console.warn('[StorageService] Erro ao gravar alterações remotas no IndexedDB:', err);
      return false;
    }
  }
}

