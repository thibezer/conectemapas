/* ==========================================================================
   ConecteMapas - StorageConstants
   Constantes de persistência local (IndexedDB / LocalStorage) e nuvem
   ========================================================================== */

export const STORAGE_KEY = 'conectemapas_state_v1';
export const PROJECTS_LIST_KEY = 'conectemapas_projects_meta_v1';

export const DB_NAME = 'ConecteMapasDB';
export const DB_VERSION = 3;

export const STORE_PROJECTS = 'projects';
export const STORE_LAYERS = 'layers';
export const STORE_FEATURES = 'features';
export const STORE_AUDIT = 'audit';

export const TOMBSTONES_KEY_PREFIX = 'cm_tombstones_';
export const PENDING_DELTAS_KEY_PREFIX = 'cm_pending_deltas_';
export const SYNC_CURSOR_KEY_PREFIX = 'cm_sync_cursor_';

export const DELTA_DEBOUNCE_MS = 120;
export const DELTA_MAX_WAIT_MS = 400;

export const CLOUD_API_URL = (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
  ? './api.php'
  : 'https://lavender-panther-702784.hostingersite.com/api.php';
