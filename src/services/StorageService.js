/* ==========================================================================
   ConecteMapas - StorageService (Intelligent Data Persistence)
   Persistência Híbrida Inteligente: LocalStorage (Boot Instantâneo) + IndexedDB (Gigabytes de Geometrias)
   Elimina erros de QuotaExceededError através de particionamento adaptativo.
   ========================================================================== */

const STORAGE_KEY = 'conectemapas_state_v1';
const PROJECTS_LIST_KEY = 'conectemapas_projects_meta_v1';
const DB_NAME = 'ConecteMapasDB';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

export class StorageService {
  /**
   * Inicializa o banco IndexedDB para armazenamento seguro de grandes volumes vetoriais
   */
  static async getDB() {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        resolve(null);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = () => resolve(null);
    });
  }

  /**
   * Salva o estado atual do projeto no LocalStorage e no IndexedDB com particionamento adaptativo
   * @param {Object} projectData
   */
  static saveProject(projectData) {
    try {
      const payload = {
        id: projectData.id || 'projeto_padrao',
        name: projectData.name || 'Novo Mapa Colaborativo',
        description: projectData.description || '',
        updatedAt: new Date().toISOString(),
        basemap: projectData.basemap || 'satelite',
        center: projectData.center || [-15.7942, -47.8822],
        zoom: projectData.zoom || 14,
        layers: Array.isArray(projectData.layers) ? projectData.layers : [],
        features: Array.isArray(projectData.features) ? projectData.features : [],
        auditLog: Array.isArray(projectData.auditLog) ? projectData.auditLog.slice(0, 100) : []
      };

      // 1. Sempre grava o dataset completo no IndexedDB (capacidade estendida de múltiplos GBs)
      this.saveToIndexedDB(payload);
      this.updateProjectsIndex(payload);

      // 2. Tenta persistência síncrona no LocalStorage
      try {
        const serialized = JSON.stringify(payload);
        // Se for menor que ~3MB, grava tudo no LocalStorage
        if (serialized.length < 3.5 * 1024 * 1024) {
          localStorage.setItem(STORAGE_KEY, serialized);
        } else {
          // Se for grande, grava apenas o manifesto leve no LocalStorage
          this.saveLightweightManifest(payload);
        }
      } catch (quotaErr) {
        // Se o LocalStorage estourar a cota (QuotaExceededError), grava o manifesto leve
        this.saveLightweightManifest(payload);
      }

      return true;
    } catch (e) {
      console.error('[StorageService] Erro ao salvar estado:', e);
      return false;
    }
  }

  /**
   * Grava apenas o manifesto essencial no LocalStorage
   */
  static saveLightweightManifest(payload) {
    try {
      const manifest = {
        id: payload.id,
        name: payload.name,
        description: payload.description,
        updatedAt: payload.updatedAt,
        basemap: payload.basemap,
        center: payload.center,
        zoom: payload.zoom,
        layers: payload.layers,
        isStoredInIndexedDB: true,
        featureCount: payload.features.length,
        auditLog: payload.auditLog.slice(0, 20)
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(manifest));
    } catch {
      // Ignora falha de localStorage se o navegador estiver completamente bloqueado
    }
  }

  /**
   * Carrega o estado síncrono inicial (rápido) do LocalStorage
   */
  static loadCurrentProject() {
    try {
      if (typeof localStorage === 'undefined') return null;
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed;
    } catch (e) {
      console.error('[StorageService] Erro ao carregar estado do LocalStorage:', e);
      return null;
    }
  }

  /**
   * Carrega o estado completo do IndexedDB (resiliente para grandes volumes geodésicos)
   */
  static async loadCurrentProjectAsync(projectId = 'projeto_padrao') {
    try {
      const db = await this.getDB();
      if (!db) return this.loadCurrentProject();

      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(projectId);

        req.onsuccess = () => {
          if (req.result && Array.isArray(req.result.features) && req.result.features.length > 0) {
            resolve(req.result);
          } else {
            resolve(this.loadCurrentProject());
          }
        };

        req.onerror = () => {
          resolve(this.loadCurrentProject());
        };
      });
    } catch {
      return this.loadCurrentProject();
    }
  }

  /**
   * Salva no IndexedDB como banco permanente de alta capacidade
   */
  static async saveToIndexedDB(project) {
    try {
      const db = await this.getDB();
      if (!db) return;
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(project);
    } catch (e) {
      console.warn('[StorageService] Falha no IndexedDB:', e);
    }
  }

  /**
   * Atualiza a lista de metadados dos projetos salvos
   */
  static updateProjectsIndex(project) {
    try {
      if (typeof localStorage === 'undefined') return;
      let list = this.listProjects();
      const existingIdx = list.findIndex(p => p.id === project.id);
      const meta = {
        id: project.id,
        name: project.name,
        updatedAt: project.updatedAt,
        featureCount: project.features ? project.features.length : 0,
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
    } catch {}
  }

  /**
   * Estima o espaço de armazenamento disponível na máquina do usuário
   */
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
