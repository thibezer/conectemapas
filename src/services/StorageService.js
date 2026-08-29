/* ==========================================================================
   ConecteMapas - StorageService (Intelligent Data Persistence)
   Persistência Local Dupla: LocalStorage + IndexedDB Assíncrono com Auto-Sync
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
      if (!window.indexedDB) {
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
   * Salva o estado atual do projeto no LocalStorage e no IndexedDB
   * @param {Object} projectData
   */
  static saveProject(projectData) {
    try {
      const payload = {
        id: projectData.id || 'projeto_padrao',
        name: projectData.name || 'Novo Mapa Colaborativo',
        description: projectData.description || '',
        updatedAt: new Date().toISOString(),
        basemap: projectData.basemap || 'google_satelite',
        center: projectData.center || [-15.7942, -47.8822],
        zoom: projectData.zoom || 14,
        layers: Array.isArray(projectData.layers) ? projectData.layers : [],
        features: Array.isArray(projectData.features) ? projectData.features : [],
        auditLog: Array.isArray(projectData.auditLog) ? projectData.auditLog.slice(0, 100) : []
      };

      // 1. Persistência síncrona no LocalStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      this.updateProjectsIndex(payload);

      // 2. Persistência assíncrona no IndexedDB
      this.saveToIndexedDB(payload);

      return true;
    } catch (e) {
      console.error('[StorageService] Erro ao salvar estado local:', e);
      return false;
    }
  }

  /**
   * Carrega o estado ativo do LocalStorage
   */
  static loadCurrentProject() {
    try {
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
   * Salva no IndexedDB como backup resiliente
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
      const raw = localStorage.getItem(PROJECTS_LIST_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  static clearCurrentProject() {
    localStorage.removeItem(STORAGE_KEY);
  }
}
