/* ==========================================================================
   ConecteMapas - AuthService
   Conta de usuário: login, cadastro por convite, logout e troca de senha.
   O token de sessão (opaco, revogável no servidor) fica em localStorage e viaja
   no header X-Auth-Token; a senha nunca é guardada no navegador.
   ========================================================================== */

import { CLOUD_API_URL } from './StorageConstants.js';

const TOKEN_KEY = 'cm_auth_token';
const USER_KEY = 'cm_auth_user';
const TOKEN_PATTERN = /^cms_[a-f0-9]{64}$/;

const _listeners = new Set();
let _user = null;

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

try {
  _user = JSON.parse(readStorage(USER_KEY) || 'null');
} catch {
  _user = null;
}

export class AuthService {
  static getToken() {
    const token = readStorage(TOKEN_KEY);
    return token && TOKEN_PATTERN.test(token) ? token : null;
  }

  static getUser() {
    return this.getToken() ? _user : null;
  }

  static isLoggedIn() {
    return !!this.getUser();
  }

  static onChange(listener) {
    _listeners.add(listener);
    return () => _listeners.delete(listener);
  }

  static _setSession(token, user) {
    _user = user || null;
    writeStorage(TOKEN_KEY, token || null);
    writeStorage(USER_KEY, user ? JSON.stringify(user) : null);
    for (const l of _listeners) {
      try { l(_user); } catch {}
    }
  }

  static async _post(action, payload) {
    const token = this.getToken();
    const res = await fetch(`${CLOUD_API_URL}?action=${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Auth-Token': token } : {}) },
      body: JSON.stringify(payload || {})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 && data.code === 'login_required') this._setSession(null, null);
      const err = new Error(data.error || `HTTP ${res.status}`);
      err.code = data.code;
      err.status = res.status;
      throw err;
    }
    return data;
  }

  static async login(email, password) {
    const data = await this._post('auth_login', { email, password });
    this._setSession(data.token, data.user);
    return data.user;
  }

  /** Cria a conta a partir de um convite; já entra logado e devolve o projeto/papel do convite. */
  static async register({ code, name, email, password }) {
    const data = await this._post('auth_register', { code, name, email, password });
    this._setSession(data.token, data.user);
    return { user: data.user, projectId: data.projectId, role: data.role };
  }

  static async acceptInvite(code) {
    return this._post('accept_invite', { code });
  }

  static async changePassword(current, next) {
    await this._post('auth_change_password', { current, new: next });
  }

  static async logout() {
    try { await this._post('auth_logout', {}); } catch {}
    this._setSession(null, null);
  }

  /** Revalida a sessão no servidor (token revogado, conta bloqueada ou expirada). */
  static async refresh() {
    const token = this.getToken();
    if (!token) return null;
    try {
      const res = await fetch(`${CLOUD_API_URL}?action=auth_me`, { headers: { 'X-Auth-Token': token }, cache: 'no-cache' });
      if (!res.ok) return this.getUser();
      const data = await res.json();
      if (data.user) this._setSession(token, data.user);
      else this._setSession(null, null);
      return data.user || null;
    } catch {
      return this.getUser();
    }
  }
}
