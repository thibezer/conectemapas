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

/**
 * Endpoint da nuvem por ambiente (o banco de testes local nunca compartilha dados com a Hostinger):
 *  - VITE_CLOUD_API_URL definido (ex.: em .env.local): usa esse backend (staging/local), em qualquer ambiente.
 *  - Navegador servido pela própria hospedagem: './api.php' (produção).
 *  - Navegador em localhost/127.0.0.1 (npm run dev): nuvem DESATIVADA, só IndexedDB/localStorage.
 *  - Fora do navegador (testes em Node): host reservado .invalid, que nunca resolve.
 */
const envUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_CLOUD_API_URL) || '';
const hostname = (typeof window !== 'undefined' && window.location && window.location.hostname) || '';
const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname.endsWith('.localhost');

export const CLOUD_API_URL = envUrl
  || (hostname ? (isLocalHost ? '' : './api.php') : 'http://cloud.invalid/api.php');

/** false no desenvolvimento local sem VITE_CLOUD_API_URL: nada é enviado nem lido da nuvem. */
export const CLOUD_ENABLED = CLOUD_API_URL !== '';

/** fetch da nuvem: com a nuvem desativada falha na hora, como se estivesse offline (os fluxos de erro já cobrem isso). */
export function cloudFetch(url, init) {
  if (!CLOUD_ENABLED) return Promise.reject(new TypeError('Nuvem desativada neste ambiente (modo local de testes)'));
  return fetch(url, init);
}
