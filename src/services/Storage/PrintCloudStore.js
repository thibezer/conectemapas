/* ==========================================================================
   ConecteMapas - PrintCloudStore
   Responsabilidade Única: chamadas das ações print_* do api.php (pranchas, trava de
   edição por prancha e biblioteca de filtros/modelos). Sem estado de tela: quem
   coordena é o PrintCloudSync. `fetchImpl` permite testar sem rede.
   ========================================================================== */

import { CLOUD_API_URL, CLOUD_ENABLED, cloudFetch } from './StorageConstants.js';
import { AccessManager } from './AccessManager.js';

/**
 * Pranchas e biblioteca viajam como texto JSON (o PHP não decodifica: objetos vazios
 * virariam listas). Aqui o texto vira objeto de novo.
 */
const parseJson = (text) => {
  if (typeof text !== 'string' || !text) return null;
  try {
    const v = JSON.parse(text);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch (e) {
    return null;
  }
};
const rowOut = (row) => (row ? { ...row, sheet: parseJson(row.sheetJson) } : null);
const libraryOut = (lib) => (lib ? { rev: lib.rev, clientId: lib.clientId, data: parseJson(lib.json) } : null);

export class PrintCloudStore {
  constructor({ projectId, clientId, getUserName = () => '', fetchImpl = null, baseUrl = CLOUD_API_URL, headers = null } = {}) {
    this.projectId = projectId;
    this.clientId = clientId;
    this.getUserName = getUserName;
    this.baseUrl = baseUrl;
    this.fetch = fetchImpl || cloudFetch;
    this.headers = headers || ((extra) => AccessManager.headers(projectId, extra));
  }

  static get enabled() {
    return CLOUD_ENABLED;
  }

  async _post(action, body, { keepalive = false } = {}) {
    const payload = JSON.stringify({ projectId: this.projectId, clientId: this.clientId, userName: this.getUserName() || '', ...body });
    const res = await this.fetch(`${this.baseUrl}?action=${action}`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: payload,
      keepalive: keepalive && payload.length < 60000
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, data };
  }

  /** { rev, sheets: [{ id, order, rev, deleted, sheet }], locks: [{ sheetId, clientId, userName, ttl }], library } */
  async changes(sinceRev = 0) {
    const res = await this.fetch(`${this.baseUrl}?action=print_changes&projectId=${encodeURIComponent(this.projectId)}&sinceRev=${Number(sinceRev) || 0}`, {
      method: 'GET',
      headers: this.headers({ Accept: 'application/json' }),
      cache: 'no-store'
    });
    if (!res.ok) throw Object.assign(new Error(`print_changes ${res.status}`), { status: res.status });
    const data = await res.json();
    return { ...data, sheets: (data.sheets || []).map(rowOut), library: libraryOut(data.library) };
  }

  /** Pega/renova a trava: { ok } ou { ok: false, holder } (423) */
  async lock(sheetId) {
    const r = await this._post('print_lock', { sheetId });
    if (r.status === 423) return { ok: false, holder: r.data.holder || 'Outro operador' };
    return { ok: r.ok, status: r.status };
  }

  async release(sheetId, { keepalive = false } = {}) {
    return this._post('print_lock', { sheetId, op: 'release' }, { keepalive });
  }

  /** { ok, rev } | { conflict: serverRow } | { locked: holder } */
  async saveSheet(sheet, order, baseRev) {
    const r = await this._post('print_save_sheet', { sheetJson: JSON.stringify(sheet), order, baseRev: baseRev ?? null });
    if (r.status === 423) return { ok: false, locked: r.data.holder || 'Outro operador' };
    if (r.status === 409) return { ok: false, conflict: rowOut(r.data.sheet) };
    if (!r.ok) return { ok: false, status: r.status, error: r.data.error };
    return { ok: true, rev: r.data.rev };
  }

  async deleteSheet(sheetId) {
    const r = await this._post('print_delete_sheet', { sheetId });
    if (r.status === 423) return { ok: false, locked: r.data.holder || 'Outro operador' };
    return { ok: r.ok, rev: r.data.rev };
  }

  /** { ok, rev } | { conflict: { data, rev } } */
  async saveLibrary(library, baseRev) {
    const payload = { filters: library?.filters || [], viewTemplates: library?.viewTemplates || [] };
    const r = await this._post('print_save_library', { libraryJson: JSON.stringify(payload), baseRev: baseRev ?? null });
    if (r.status === 409) return { ok: false, conflict: libraryOut(r.data.library) };
    return { ok: r.ok, rev: r.data.rev };
  }
}
