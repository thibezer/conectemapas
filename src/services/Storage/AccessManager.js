/* ==========================================================================
   ConecteMapas - AccessManager
   Papéis de acesso (owner / editor / viewer) por chave de link.
   - A chave chega no fragmento da URL (#k=...), que o navegador nunca envia ao
     servidor; é guardada em localStorage por projeto e enviada em X-Project-Key.
   - Projeto sem dono ("aberto") funciona como antes; claimProject() o protege.
   ========================================================================== */

import { CLOUD_API_URL, cloudFetch } from './StorageConstants.js';
import { AuthService } from './AuthService.js';

const KEY_PREFIX = 'cm_access_key_';
const KEY_PATTERN = /^cmk_[a-f0-9]{32}$/;

const _roleByProject = new Map();
const _listeners = new Set();

function readStorage(name) {
  try { return typeof localStorage !== 'undefined' ? localStorage.getItem(name) : null; } catch { return null; }
}

function writeStorage(name, value) {
  try {
    if (typeof localStorage === 'undefined') return;
    if (value === null) localStorage.removeItem(name);
    else localStorage.setItem(name, value);
  } catch {}
}

export class AccessManager {
  static getKey(projectId) {
    const key = readStorage(KEY_PREFIX + projectId);
    return key && KEY_PATTERN.test(key) ? key : null;
  }

  static setKey(projectId, key) {
    writeStorage(KEY_PREFIX + projectId, key && KEY_PATTERN.test(key) ? key : null);
  }

  /**
   * Lê #k=<chave> da URL, guarda para o projeto e remove o fragmento da barra de endereço.
   */
  static adoptKeyFromUrl(projectId) {
    if (typeof window === 'undefined' || !window.location.hash) return false;
    const key = new URLSearchParams(window.location.hash.slice(1)).get('k');
    if (!key || !KEY_PATTERN.test(key)) return false;
    this.setKey(projectId, key);
    try {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch {}
    return true;
  }

  static headers(projectId, extra = {}) {
    const key = this.getKey(projectId);
    const token = AuthService.getToken();
    return { ...extra, ...(key ? { 'X-Project-Key': key } : {}), ...(token ? { 'X-Auth-Token': token } : {}) };
  }

  static getRole(projectId) {
    return _roleByProject.get(projectId) || null;
  }

  static canWrite(projectId) {
    const role = this.getRole(projectId);
    return role === null || role === 'editor' || role === 'owner';
  }

  static setRole(projectId, role) {
    if (_roleByProject.get(projectId) === role) return;
    _roleByProject.set(projectId, role);
    for (const l of _listeners) {
      try { l(projectId, role); } catch {}
    }
  }

  static onRoleChange(listener) {
    _listeners.add(listener);
    return () => _listeners.delete(listener);
  }

  /** Ajusta o papel conforme uma resposta de erro do servidor (401/403 com code; 410 = projeto excluído). */
  static handleDenied(projectId, status, body) {
    const code = body && body.code;
    if (status === 410 && code === 'project_deleted') {
      this.setRole(projectId, 'deleted');
      return true;
    }
    if (status !== 401 && status !== 403) return false;
    if (code === 'insufficient_role') this.setRole(projectId, body.role || 'viewer');
    else if (code === 'key_required' || code === 'invalid_key' || code === 'not_a_member' || code === 'forbidden') this.setRole(projectId, 'none');
    return true;
  }

  static async _call(action, projectId, { method = 'GET', payload = null } = {}) {
    const qs = method === 'GET' ? `&projectId=${encodeURIComponent(projectId)}` : '';
    const res = await cloudFetch(`${CLOUD_API_URL}?action=${action}${qs}`, {
      method,
      headers: this.headers(projectId, payload ? { 'Content-Type': 'application/json' } : { Accept: 'application/json' }),
      body: payload ? JSON.stringify({ projectId, ...payload }) : undefined,
      cache: 'no-cache'
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      this.handleDenied(projectId, res.status, data);
      const err = new Error(data.error || `HTTP ${res.status}`);
      err.code = data.code;
      throw err;
    }
    return data;
  }

  /** Consulta o papel efetivo; null se a nuvem estiver indisponível. */
  static async refresh(projectId) {
    try {
      const info = await this._call('access_info', projectId);
      this.setRole(projectId, info.deleted ? 'deleted' : (info.role || 'none'));
      return info;
    } catch {
      return null;
    }
  }

  /** @param {string} [name] nome inicial, usado só se o projeto ainda não existir na nuvem */
  static async claimProject(projectId, label, name) {
    const data = await this._call('claim_project', projectId, { method: 'POST', payload: name ? { label, name } : { label } });
    this.setKey(projectId, data.key);
    this.setRole(projectId, 'owner');
    return data;
  }

  static async createShare(projectId, role, label) {
    return this._call('create_share', projectId, { method: 'POST', payload: { role, label } });
  }

  /** @returns {{access: Array, members: Array, invites: Array}} */
  static async listAccess(projectId) {
    const data = await this._call('list_access', projectId);
    return { access: data.access || [], members: data.members || [], invites: data.invites || [] };
  }

  static async createInvite(projectId, role, email) {
    return this._call('create_invite', projectId, { method: 'POST', payload: { role, email } });
  }

  static async revokeMember(projectId, userId) {
    return this._call('revoke_member', projectId, { method: 'POST', payload: { userId } });
  }

  static async revokeInvite(projectId, inviteId) {
    return this._call('revoke_invite', projectId, { method: 'POST', payload: { inviteId } });
  }

  /** Link de convite por conta: leva o código no fragmento; o app o troca por cadastro/aceite. */
  static buildInviteUrl(projectId, code) {
    return `${this.buildShareUrl(projectId)}#invite=${code}`;
  }

  /** Lê #invite=<código> da URL e remove o fragmento. */
  static takeInviteFromUrl() {
    if (typeof window === 'undefined' || !window.location.hash) return null;
    const code = new URLSearchParams(window.location.hash.slice(1)).get('invite');
    if (!code || !/^cmi_[a-f0-9]{32}$/.test(code)) return null;
    try {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch {}
    return code;
  }

  /** Exclusão definitiva (só o dono). Em caso de sucesso o papel local vira 'deleted'. */
  static async deleteProject(projectId) {
    const data = await this._call('delete_project', projectId, { method: 'POST', payload: {} });
    this.setRole(projectId, 'deleted');
    return data;
  }

  static async revokeAccess(projectId, accessId) {
    return this._call('revoke_access', projectId, { method: 'POST', payload: { accessId } });
  }

  static getCachedShareKey(projectId, role) {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(`cm_cached_share_${projectId}_${role}`) : null;
    } catch {
      return null;
    }
  }

  static cacheShareKey(projectId, role, key) {
    try {
      if (typeof localStorage !== 'undefined' && key) {
        localStorage.setItem(`cm_cached_share_${projectId}_${role}`, key);
      }
    } catch {}
  }

  /**
   * Obtém a URL funcional para compartilhamento:
   * - Se o projeto for aberto (qualquer um acessa), devolve a URL base do projeto.
   * - Se o projeto for protegido e formos o dono, garante/utiliza uma chave de acesso (leitor/editor).
   */
  static async getShareableLink(projectId, preferredRole = 'viewer') {
    const info = await this.refresh(projectId);
    if (!info || info.canClaim) {
      return this.buildShareUrl(projectId);
    }
    if (info.canManage) {
      const cached = this.getCachedShareKey(projectId, preferredRole);
      if (cached) return this.buildShareUrl(projectId, cached);

      try {
        const created = await this.createShare(projectId, preferredRole, `Link ${preferredRole === 'editor' ? 'Editor' : 'Leitor'}`);
        if (created && created.key) {
          this.cacheShareKey(projectId, preferredRole, created.key);
          return this.buildShareUrl(projectId, created.key);
        }
      } catch (e) {
        console.warn('[AccessManager] Falha ao gerar chave compartilhável:', e);
      }
    }
    const myKey = this.getKey(projectId);
    return this.buildShareUrl(projectId, myKey);
  }

  /** Link de compartilhamento: a chave vai no fragmento, fora de logs de servidor. */
  static buildShareUrl(projectId, key = null) {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
    const base = `${origin}${pathname}?project=${encodeURIComponent(projectId)}`;
    return key ? `${base}#k=${key}` : base;
  }
}
