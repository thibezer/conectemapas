/* ==========================================================================
   ConecteMapas - ProjectsScreen
   Tela inicial de projetos: busca, filtros, ordenação, criação nomeada,
   renomeação inline, cópia de link, saída de compartilhados e exclusão segura.
   ========================================================================== */

if (typeof window !== 'undefined' && !globalThis.process?.versions?.node) {
  import('./ProjectsScreen.css');
}

import { UIToast } from '@thibezer/ui-components-kit';
import { AuthService } from '../../services/Storage/AuthService.js';
import { AccessManager } from '../../services/Storage/AccessManager.js';
import { LocalStore } from '../../services/Storage/LocalStore.js';
import { ProjectLifecycle } from '../../services/Storage/ProjectLifecycle.js';
import { CLOUD_ENABLED } from '../../services/Storage/StorageConstants.js';
import { copyToClipboardWithToast } from '../../utils/toastHelpers.js';

const VIEW_MODE_KEY = 'cm_ps_view_mode';

const PALETTE = [
  { a: '#166534', b: '#052e16', accent: '#4ade80' },
  { a: '#0f766e', b: '#042f2e', accent: '#2dd4bf' },
  { a: '#1d4ed8', b: '#172554', accent: '#60a5fa' },
  { a: '#0369a1', b: '#082f49', accent: '#38bdf8' },
  { a: '#7e22ce', b: '#3b0764', accent: '#c084fc' },
  { a: '#be185d', b: '#500724', accent: '#f472b6' },
  { a: '#b45309', b: '#451a03', accent: '#fbbf24' },
  { a: '#3f6212', b: '#1a2e05', accent: '#a3e635' }
];

const STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'as', 'os',
  'em', 'no', 'na', 'nos', 'nas', 'para', 'por', 'com'
]);

const ROMAN_DIGITS = {
  I: '1', II: '2', III: '3', IV: '4', V: '5',
  VI: '6', VII: '7', VIII: '8', IX: '9', X: '10'
};

const ROLE_LABELS = {
  owner: 'Dono',
  editor: 'Editor',
  viewer: 'Leitor'
};

const ICONS = {
  plus: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
  refresh: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>`,
  invite: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>`,
  grid: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
  list: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>`,
  copy: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  external: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14L21 3"/></svg>`,
  edit: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
  trash: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  leave: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  folderEmpty: `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`
};

function loadSavedViewMode() {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(VIEW_MODE_KEY);
      if (saved === 'list' || saved === 'grid') return saved;
    }
  } catch {}
  return 'grid';
}

function saveViewMode(mode) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(VIEW_MODE_KEY, mode);
  } catch {}
}

export class ProjectsScreen {
  constructor(options = {}) {
    this.getCurrentProjectId = options.getCurrentProjectId || (() => 'projeto_padrao');
    this.getCurrentProject = options.getCurrentProject || null;
    this.onCreate = options.onCreate || (async () => {});
    this.onRename = options.onRename || null;
    this.onDelete = options.onDelete || null;
    this.onLeave = options.onLeave || null;
    this.onOpenAccount = options.onOpenAccount || (() => {});
    this.onOpenInvite = options.onOpenInvite || null;
    this.onOpenProject = options.onOpenProject || ((id) => {
      if (typeof window !== 'undefined') window.location.assign(AccessManager.buildShareUrl(id));
    });

    this.root = null;
    this.projects = [];
    this.filter = 'all';
    this.sort = 'recent';
    this.viewMode = loadSavedViewMode();
    this.query = '';
    this.newName = '';
    this.loading = false;
    this.creating = false;
    this.busyId = '';
    this.editingId = '';
    this.editingName = '';
    this.confirmingDeleteId = '';
    this.confirmDeleteTyped = '';
    this.confirmingLeaveId = '';
    this.error = '';
    this.offlineFallback = false;
    this.isOpen = false;
    this._bodyOverflow = '';
    this._headerResizeObserver = null;
    this._unsubAuth = AuthService.onChange(() => {
      if (this.isOpen) this._load();
    });
  }

  /**
   * Gera iniciais inteligentes (2 caracteres) evitando colisões como "PR" em "Projeto ...".
   * Ex.: "Projeto Loteamento Urbano" -> "LU"; "Projeto de Paisagismo II" -> "P2".
   */
  static computeInitials(name) {
    const rawTokens = String(name || '')
      .trim()
      .split(/[\s\-_/.,;:()]+/)
      .filter(Boolean);
    if (rawTokens.length === 0) return 'PM';

    let tokens = rawTokens.filter(t => !STOPWORDS.has(t.toLowerCase()));
    if (tokens.length === 0) tokens = rawTokens;

    if (tokens.length >= 3 && /^projetos?$/i.test(tokens[0])) {
      tokens = tokens.slice(1);
    }

    const firstChar = (word) => {
      const clean = word.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]/g, '');
      return (clean[0] || word[0] || 'P').toUpperCase();
    };

    if (tokens.length >= 2) {
      const c1 = firstChar(tokens[0]);
      const secondUpper = tokens[1].toUpperCase();
      const c2 = ROMAN_DIGITS[secondUpper] || firstChar(tokens[1]);
      return (c1 + c2).slice(0, 2);
    }

    const singleClean = tokens[0]
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase();
    return (singleClean.slice(0, 2) || 'PM').padEnd(2, singleClean[0] || 'M');
  }

  /** Índice determinístico de tema para diferenciar visualmente os projetos. */
  static themeIndex(id, name = '') {
    const key = `${String(id || '')}|${String(name || '')}`;
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
    return Math.abs(h) % PALETTE.length;
  }

  static formatFeatureCount(n) {
    const count = Math.max(0, Number(n) || 0);
    const formatted = count.toLocaleString('pt-BR');
    return `${formatted} ${count === 1 ? 'feição' : 'feições'}`;
  }

  static formatDate(d, nowMs = Date.now()) {
    if (!d) return '';
    const str = String(d).trim();
    const isoLike = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(str) ? str.replace(' ', 'T') : str;
    const date = new Date(isoLike);
    if (Number.isNaN(date.getTime())) return '';

    const now = new Date(nowMs);
    const sameDay = (a, b) => a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();

    const diffMs = now.getTime() - date.getTime();
    if (sameDay(date, now)) {
      if (diffMs >= 0 && diffMs < 60_000) return 'Agora';
      const hh = String(date.getHours()).padStart(2, '0');
      const mm = String(date.getMinutes()).padStart(2, '0');
      return `Hoje às ${hh}:${mm}`;
    }

    const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const diffDays = Math.round((startNow - startDate) / 86_400_000);
    if (diffDays === 1) return 'Ontem';
    if (diffDays >= 2 && diffDays <= 6) return `Há ${diffDays} dias`;

    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  static parseTimestamp(d) {
    if (!d) return 0;
    const str = String(d).trim();
    const isoLike = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(str) ? str.replace(' ', 'T') : str;
    const ms = Date.parse(isoLike);
    return Number.isNaN(ms) ? 0 : ms;
  }

  /** Calcula totais por aba para exibir contadores sem alterar a filtragem. */
  computeCounts(projects = this.projects) {
    let mine = 0;
    let shared = 0;
    for (const p of projects) {
      if (!p.role || p.role === 'owner') mine++;
      else shared++;
    }
    return { all: projects.length, mine, shared };
  }

  /** Filtra e ordena projetos de forma pura (facilita testes em Node). */
  getFilteredProjects() {
    const q = this.query.trim().toLowerCase();
    const currentId = this._resolveCurrentProject().id;

    const list = this.projects.filter((p) => {
      const isMine = !p.role || p.role === 'owner';
      if (this.filter === 'mine' && !isMine) return false;
      if (this.filter === 'shared' && isMine) return false;
      if (q && !String(p.name || '').toLowerCase().includes(q) && !String(p.id || '').toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (this.sort === 'name') {
        return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR', { sensitivity: 'base' });
      }
      if (this.sort === 'features') {
        const diff = (Number(b.featureCount) || 0) - (Number(a.featureCount) || 0);
        if (diff !== 0) return diff;
        return ProjectsScreen.parseTimestamp(b.updatedAt) - ProjectsScreen.parseTimestamp(a.updatedAt);
      }
      // 'recent': mantém o projeto aberto sempre em destaque no topo
      if (a.id === currentId && b.id !== currentId) return -1;
      if (b.id === currentId && a.id !== currentId) return 1;
      const tDiff = ProjectsScreen.parseTimestamp(b.updatedAt) - ProjectsScreen.parseTimestamp(a.updatedAt);
      if (tDiff !== 0) return tDiff;
      return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR', { sensitivity: 'base' });
    });

    return list;
  }

  _resolveCurrentProject() {
    if (typeof this.getCurrentProject === 'function') {
      const info = this.getCurrentProject();
      if (info && info.id) return info;
    }
    return { id: this.getCurrentProjectId(), name: '' };
  }

  render(container) {
    if (!container) return;
    this.root = document.createElement('div');
    this.root.className = 'cm-projects-screen';
    this.root.setAttribute('aria-hidden', 'true');
    this.root.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        if (this.editingId || this.confirmingDeleteId || this.confirmingLeaveId) {
          this.editingId = '';
          this.confirmingDeleteId = '';
          this.confirmDeleteTyped = '';
          this.confirmingLeaveId = '';
          this._renderContent();
        } else {
          this.close();
        }
      }
    });
    container.appendChild(this.root);
    this._trackHeader();
    this._syncOpenState();
    this._renderContent();
  }

  _trackHeader() {
    if (typeof document === 'undefined' || !this.root) return;
    const header = document.getElementById('header-mount');
    const sync = () => {
      if (!this.root) return;
      const top = header ? header.getBoundingClientRect().bottom : 0;
      this.root.style.top = `${Math.max(0, Math.round(top))}px`;
    };
    sync();
    if (header && typeof ResizeObserver !== 'undefined') {
      this._headerResizeObserver = new ResizeObserver(sync);
      this._headerResizeObserver.observe(header);
    }
  }

  open() {
    this.isOpen = true;
    this._syncOpenState();
    this._renderContent();
    this._load();
  }

  close() {
    this.isOpen = false;
    this.editingId = '';
    this.confirmingDeleteId = '';
    this.confirmDeleteTyped = '';
    this.confirmingLeaveId = '';
    this._syncOpenState();
  }

  _syncOpenState() {
    if (!this.root) return;
    this.root.classList.toggle('is-open', this.isOpen);
    this.root.setAttribute('aria-hidden', this.isOpen ? 'false' : 'true');
    if (typeof document !== 'undefined' && document.body) {
      if (this.isOpen) {
        this._bodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = this._bodyOverflow || '';
      }
    }
  }

  async _load() {
    this.loading = true;
    this.error = '';
    this.offlineFallback = false;
    this._renderContent();

    let list = [];
    const loggedIn = CLOUD_ENABLED && AuthService.isLoggedIn();
    if (loggedIn) {
      try {
        list = await AuthService.listMyProjects();
      } catch (err) {
        this.offlineFallback = true;
        this.error = `${err.message || 'Falha ao carregar projetos da nuvem'} — exibindo cópias locais.`;
        list = LocalStore.listProjects().map(p => ({ ...p, role: p.role || 'owner' }));
      }
    } else {
      list = LocalStore.listProjects().map(p => ({ ...p, role: p.role || 'owner' }));
    }

    this.projects = this._mergeCurrentProject(Array.isArray(list) ? list : []);
    this.loading = false;
    this._renderContent();
  }

  _mergeCurrentProject(list) {
    const cur = this._resolveCurrentProject();
    const out = list.map(p => ({
      id: p.id,
      name: p.name || 'Projeto sem nome',
      featureCount: Number(p.featureCount) || 0,
      updatedAt: p.updatedAt || '',
      role: p.role || 'owner'
    }));
    if (!cur?.id) return out;

    const idx = out.findIndex(p => p.id === cur.id);
    if (idx >= 0) {
      if (cur.name) out[idx].name = cur.name;
      if (cur.featureCount !== undefined && cur.featureCount !== null) {
        out[idx].featureCount = Number(cur.featureCount) || 0;
      }
    } else {
      out.unshift({
        id: cur.id,
        name: cur.name || 'Projeto Atual',
        featureCount: Number(cur.featureCount) || 0,
        updatedAt: new Date().toISOString(),
        role: cur.role || 'owner'
      });
    }
    return out;
  }

  esc(v) {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  _renderContent() {
    if (!this.root) return;
    const user = AuthService.getUser();
    const counts = this.computeCounts(this.projects);
    const totalFeatures = this.projects.reduce((sum, p) => sum + (Number(p.featureCount) || 0), 0);
    const isLocalMode = !CLOUD_ENABLED || !AuthService.isLoggedIn();

    const filterOpts = [
      { id: 'all', label: `Todos (${counts.all})` },
      { id: 'mine', label: `Meus (${counts.mine})` },
      { id: 'shared', label: `Compartilhados (${counts.shared})` }
    ];

    this.root.innerHTML = `
      <div class="cm-ps-top">
        <div class="cm-ps-top-left">
          <ui-botao-primario inline id="cm-ps-back" variante="ghost">&larr; Voltar ao mapa</ui-botao-primario>
          <span class="cm-ps-title">Projetos</span>
          <span class="cm-ps-kpi">
            <strong>${counts.all}</strong> ${counts.all === 1 ? 'projeto' : 'projetos'}
            &middot; <strong>${totalFeatures.toLocaleString('pt-BR')}</strong> feições
          </span>
        </div>
        <div class="cm-ps-top-actions">
          ${this.onOpenInvite && CLOUD_ENABLED ? `
            <ui-botao-primario inline id="cm-ps-invite" variante="secundario">
              ${ICONS.invite} Código de convite
            </ui-botao-primario>
          ` : ''}
          <ui-botao-primario inline id="cm-ps-refresh" variante="ghost" ${this.loading ? 'disabled' : ''}>
            ${ICONS.refresh} Atualizar
          </ui-botao-primario>
          <button type="button" id="cm-ps-account" class="cm-ps-user-pill" title="${user ? 'Gerenciar conta' : 'Entrar na conta'}">
            <ui-avatar nome="${this.esc(user?.name || 'Local')}" tamanho="sm"></ui-avatar>
            <span>${this.esc(user?.name || (CLOUD_ENABLED ? 'Entrar na conta' : 'Modo local'))}</span>
          </button>
        </div>
      </div>

      <div class="cm-ps-body">
        <div class="cm-ps-hero">
          <div class="cm-ps-hero-copy">
            <h1>O que vamos mapear hoje?</h1>
            <p>${isLocalMode
              ? 'Seus projetos salvos neste navegador. Dê um nome e comece um novo levantamento.'
              : 'Crie um mapa novo ou retome seus levantamentos e projetos compartilhados.'}</p>
          </div>
          <form id="cm-ps-create-form" class="cm-ps-create-form">
            <div class="cm-ps-create-input">
              <ui-campo-texto id="cm-ps-new-name" label="" placeholder="Nome do novo projeto (ex: Gleba Santa Maria)..." valor="${this.esc(this.newName)}"></ui-campo-texto>
            </div>
            <ui-botao-primario inline id="cm-ps-create" type="submit" variante="primary" ${this.creating ? 'carregando disabled' : ''}>
              ${ICONS.plus} Criar projeto
            </ui-botao-primario>
          </form>
        </div>

        <div class="cm-ps-controls">
          <div class="cm-ps-search">
            <ui-campo-texto id="cm-ps-search" label="" placeholder="Buscar por nome ou ID..." valor="${this.esc(this.query)}"></ui-campo-texto>
          </div>
          <div class="cm-ps-controls-right">
            <ui-segmented id="cm-ps-filter" valor="${this.filter}" opcoes='${this.esc(JSON.stringify(filterOpts))}'></ui-segmented>
            <select id="cm-ps-sort" class="cm-ps-select" aria-label="Ordenar projetos">
              <option value="recent" ${this.sort === 'recent' ? 'selected' : ''}>Mais recentes</option>
              <option value="name" ${this.sort === 'name' ? 'selected' : ''}>Nome (A–Z)</option>
              <option value="features" ${this.sort === 'features' ? 'selected' : ''}>Mais feições</option>
            </select>
            <div class="cm-ps-view-toggle" role="group" aria-label="Modo de visualização">
              <button type="button" id="cm-ps-view-grid" class="cm-ps-icon-btn ${this.viewMode === 'grid' ? 'is-active' : ''}" title="Visualização em grade" aria-pressed="${this.viewMode === 'grid'}">
                ${ICONS.grid}
              </button>
              <button type="button" id="cm-ps-view-list" class="cm-ps-icon-btn ${this.viewMode === 'list' ? 'is-active' : ''}" title="Visualização em lista" aria-pressed="${this.viewMode === 'list'}">
                ${ICONS.list}
              </button>
            </div>
          </div>
        </div>

        <div id="cm-ps-list-slot"></div>
      </div>
    `;

    this._renderListSlot();
    this._bindTopAndControls();
  }

  /** Re-renderiza apenas a lista de cards/vazio sem perder o foco do campo de busca. */
  _renderListSlot() {
    const slot = this.root?.querySelector('#cm-ps-list-slot');
    if (!slot) return;

    const currentId = this._resolveCurrentProject().id;
    const list = this.getFilteredProjects();
    let html = '';

    if (this.error) {
      html += `<div class="cm-ps-banner ${this.offlineFallback ? 'is-warn' : 'is-error'}">${this.esc(this.error)}</div>`;
    }

    if (this.loading && this.projects.length === 0) {
      html += `<div class="cm-ps-empty">Carregando seus projetos...</div>`;
    } else if (list.length === 0) {
      const hasSearchOrFilter = this.query.trim() !== '' || this.filter !== 'all';
      html += `
        <div class="cm-ps-empty">
          <div class="cm-ps-empty-icon">${ICONS.folderEmpty}</div>
          <div class="cm-ps-empty-title">${hasSearchOrFilter ? 'Nenhum projeto encontrado para esse filtro' : 'Você ainda não tem outros projetos salvos'}</div>
          <div class="cm-ps-empty-sub">${hasSearchOrFilter
            ? 'Tente limpar a busca ou alternar a aba de filtros.'
            : 'Digite um nome acima e clique em "Criar projeto" para começar.'}</div>
          ${hasSearchOrFilter ? `<ui-botao-primario inline id="cm-ps-clear-filters" variante="secundario">Limpar filtros</ui-botao-primario>` : ''}
        </div>
      `;
    } else {
      html += `<div class="cm-ps-grid ${this.viewMode === 'list' ? 'is-list' : ''}">${list.map(p => this._card(p, currentId)).join('')}</div>`;
    }

    slot.innerHTML = html;
    this._bindCardEvents();
  }

  _card(p, currentId) {
    const palette = PALETTE[ProjectsScreen.themeIndex(p.id, p.name)];
    const initials = ProjectsScreen.computeInitials(p.name);
    const isCurrent = p.id === currentId;
    const isOwner = !p.role || p.role === 'owner';
    const canEdit = isOwner || p.role === 'editor';
    const canDelete = ProjectLifecycle.canDelete(p.id, isOwner ? 'owner' : (p.role || 'viewer')).allowed && Boolean(this.onDelete);
    const canLeave = !isOwner && Boolean(p.role) && Boolean(this.onLeave);
    const isBusy = this.busyId === p.id;
    const isEditing = this.editingId === p.id;
    const isDeleting = this.confirmingDeleteId === p.id;
    const isLeaving = this.confirmingLeaveId === p.id;

    const featCount = Number(p.featureCount) || 0;
    const dateLabel = ProjectsScreen.formatDate(p.updatedAt);
    const metaParts = [ProjectsScreen.formatFeatureCount(featCount)];
    if (dateLabel) metaParts.push(dateLabel);
    const meta = metaParts.join(' · ');

    const roleLabel = ROLE_LABELS[p.role] || 'Editor';
    const roleClass = isOwner ? 'is-owner' : (p.role === 'viewer' ? 'is-viewer' : 'is-editor');
    const safeUrl = this.esc(AccessManager.buildShareUrl(p.id));
    const safeId = this.esc(p.id);
    const deleteReady = featCount === 0 || ProjectLifecycle.deletionConfirmed(this.confirmDeleteTyped, p.name);

    return `
      <article class="cm-ps-card ${isCurrent ? 'is-current' : ''} ${isBusy ? 'is-busy' : ''}"
               data-project-id="${safeId}"
               style="--cm-card-a:${palette.a}; --cm-card-b:${palette.b}; --cm-card-accent:${palette.accent}">
        <button type="button" class="cm-ps-thumb" data-open-id="${safeId}" title="${isCurrent ? 'Voltar ao mapa aberto' : 'Abrir projeto'}">
          <div class="cm-ps-thumb-grid" aria-hidden="true"></div>
          ${isCurrent ? '<span class="cm-ps-badge-open">Aberto</span>' : ''}
          <span class="cm-ps-role-badge ${roleClass}">${this.esc(roleLabel)}</span>
          <span class="cm-ps-initials">${this.esc(initials)}</span>
        </button>

        <div class="cm-ps-card-content">
          <div class="cm-ps-info">
            ${isEditing ? `
              <form class="cm-ps-inline-rename" data-rename-form="${safeId}">
                <input type="text" class="cm-ps-inline-input" data-rename-input="${safeId}" value="${this.esc(this.editingName)}" maxlength="80" aria-label="Novo nome do projeto" />
                <div class="cm-ps-inline-btns">
                  <ui-botao-primario inline type="submit" variante="primary" ${isBusy ? 'carregando disabled' : ''}>Salvar</ui-botao-primario>
                  <ui-botao-primario inline type="button" data-cancel-rename="${safeId}" variante="ghost">Cancelar</ui-botao-primario>
                </div>
              </form>
            ` : `
              <div class="cm-ps-name-row">
                <button type="button" class="cm-ps-name" data-open-id="${safeId}" title="${this.esc(p.name)}">${this.esc(p.name)}</button>
              </div>
              <div class="cm-ps-meta">${this.esc(meta)}</div>
            `}
          </div>

          <div class="cm-ps-card-actions" aria-label="Ações do projeto">
            <button type="button" class="cm-ps-act-btn" data-copy-id="${safeId}" title="Copiar link do projeto">${ICONS.copy}</button>
            <a class="cm-ps-act-btn" href="${safeUrl}" target="_blank" rel="noopener" title="Abrir em nova aba">${ICONS.external}</a>
            ${canEdit && this.onRename ? `
              <button type="button" class="cm-ps-act-btn" data-rename-id="${safeId}" title="Renomear projeto" ${isBusy ? 'disabled' : ''}>${ICONS.edit}</button>
            ` : ''}
            ${canDelete ? `
              <button type="button" class="cm-ps-act-btn is-danger" data-delete-id="${safeId}" title="Excluir projeto" ${isBusy ? 'disabled' : ''}>${ICONS.trash}</button>
            ` : ''}
            ${canLeave ? `
              <button type="button" class="cm-ps-act-btn is-danger" data-leave-id="${safeId}" title="Sair do projeto compartilhado" ${isBusy ? 'disabled' : ''}>${ICONS.leave}</button>
            ` : ''}
          </div>
        </div>

        ${isDeleting ? `
          <div class="cm-ps-confirm-box is-danger">
            <div class="cm-ps-confirm-text">
              ${featCount === 0
                ? 'Excluir este projeto vazio permanentemente?'
                : `Este projeto tem ${ProjectsScreen.formatFeatureCount(featCount)}. Digite <strong>${this.esc(p.name)}</strong> para excluir:`}
            </div>
            ${featCount > 0 ? `
              <input type="text" class="cm-ps-confirm-input" data-delete-input="${safeId}" value="${this.esc(this.confirmDeleteTyped)}" placeholder="${this.esc(p.name)}" />
            ` : ''}
            <div class="cm-ps-confirm-btns">
              <ui-botao-primario inline type="button" data-confirm-delete="${safeId}" variante="destrutivo" ${(!deleteReady || isBusy) ? 'disabled' : ''} ${isBusy ? 'carregando' : ''}>Excluir</ui-botao-primario>
              <ui-botao-primario inline type="button" data-cancel-confirm="${safeId}" variante="ghost">Cancelar</ui-botao-primario>
            </div>
          </div>
        ` : ''}

        ${isLeaving ? `
          <div class="cm-ps-confirm-box">
            <div class="cm-ps-confirm-text">Sair do projeto <strong>${this.esc(p.name)}</strong>? Ele continuará acessível ao dono.</div>
            <div class="cm-ps-confirm-btns">
              <ui-botao-primario inline type="button" data-confirm-leave="${safeId}" variante="destrutivo" ${isBusy ? 'carregando disabled' : ''}>Sair</ui-botao-primario>
              <ui-botao-primario inline type="button" data-cancel-confirm="${safeId}" variante="ghost">Cancelar</ui-botao-primario>
            </div>
          </div>
        ` : ''}
      </article>
    `;
  }

  _bindTopAndControls() {
    if (!this.root) return;
    this.root.querySelector('#cm-ps-back')?.addEventListener('click', () => this.close());
    this.root.querySelector('#cm-ps-account')?.addEventListener('click', () => this.onOpenAccount());
    this.root.querySelector('#cm-ps-invite')?.addEventListener('click', () => this.onOpenInvite && this.onOpenInvite());
    this.root.querySelector('#cm-ps-refresh')?.addEventListener('click', () => this._load());

    const newNameInput = this.root.querySelector('#cm-ps-new-name');
    const syncNewName = (e) => {
      this.newName = e.detail?.valor ?? e.target?.valor ?? e.target?.value ?? '';
    };
    newNameInput?.addEventListener('ui-input', syncNewName);
    newNameInput?.addEventListener('input', syncNewName);

    this.root.querySelector('#cm-ps-create-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this._createProject();
    });
    this.root.querySelector('#cm-ps-create')?.addEventListener('click', (e) => {
      e.preventDefault();
      this._createProject();
    });

    const search = this.root.querySelector('#cm-ps-search');
    const syncSearch = (e) => {
      this.query = e.detail?.valor ?? e.target?.valor ?? e.target?.value ?? '';
      this._renderListSlot();
    };
    search?.addEventListener('ui-input', syncSearch);
    search?.addEventListener('input', syncSearch);
    search?.addEventListener('change', syncSearch);

    const seg = this.root.querySelector('#cm-ps-filter');
    const syncFilter = (e) => {
      const next = e.detail?.valor ?? seg?.valor;
      if (next && next !== this.filter) {
        this.filter = next;
        this._renderListSlot();
      }
    };
    seg?.addEventListener('ui-change', syncFilter);
    seg?.addEventListener('change', syncFilter);

    this.root.querySelector('#cm-ps-sort')?.addEventListener('change', (e) => {
      this.sort = e.target.value || 'recent';
      this._renderListSlot();
    });

    this.root.querySelector('#cm-ps-view-grid')?.addEventListener('click', () => this._setViewMode('grid'));
    this.root.querySelector('#cm-ps-view-list')?.addEventListener('click', () => this._setViewMode('list'));
  }

  _setViewMode(mode) {
    if (mode !== 'grid' && mode !== 'list') return;
    this.viewMode = mode;
    saveViewMode(mode);
    const gridBtn = this.root?.querySelector('#cm-ps-view-grid');
    const listBtn = this.root?.querySelector('#cm-ps-view-list');
    gridBtn?.classList.toggle('is-active', mode === 'grid');
    listBtn?.classList.toggle('is-active', mode === 'list');
    gridBtn?.setAttribute('aria-pressed', String(mode === 'grid'));
    listBtn?.setAttribute('aria-pressed', String(mode === 'list'));
    this._renderListSlot();
  }

  _bindCardEvents() {
    const slot = this.root?.querySelector('#cm-ps-list-slot');
    if (!slot) return;

    slot.querySelector('#cm-ps-clear-filters')?.addEventListener('click', () => {
      this.query = '';
      this.filter = 'all';
      this._renderContent();
    });

    slot.querySelectorAll('[data-open-id]').forEach((el) => {
      el.addEventListener('click', () => {
        if (this.busyId || this.editingId) return;
        const id = el.dataset.openId;
        if (!id) return;
        if (id === this._resolveCurrentProject().id) {
          this.close();
          return;
        }
        this.onOpenProject(id);
      });
    });

    slot.querySelectorAll('[data-copy-id]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = el.dataset.copyId;
        if (!id) return;
        copyToClipboardWithToast(AccessManager.buildShareUrl(id), 'Link do projeto copiado!');
      });
    });

    slot.querySelectorAll('[data-rename-id]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = el.dataset.renameId;
        const proj = this.projects.find(p => p.id === id);
        if (!proj) return;
        this.confirmingDeleteId = '';
        this.confirmingLeaveId = '';
        this.editingId = id;
        this.editingName = proj.name || '';
        this._renderListSlot();
        const input = slot.querySelector(`[data-rename-input="${CSS?.escape ? CSS.escape(id) : id}"]`);
        input?.focus();
        input?.select();
      });
    });

    slot.querySelectorAll('[data-rename-input]').forEach((input) => {
      input.addEventListener('input', () => {
        this.editingName = input.value;
      });
    });

    slot.querySelectorAll('[data-cancel-rename]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.editingId = '';
        this.editingName = '';
        this._renderListSlot();
      });
    });

    slot.querySelectorAll('[data-rename-form]').forEach((form) => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this._commitRename(form.dataset.renameForm);
      });
    });

    slot.querySelectorAll('[data-delete-id]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = el.dataset.deleteId;
        this.editingId = '';
        this.confirmingLeaveId = '';
        this.confirmingDeleteId = this.confirmingDeleteId === id ? '' : id;
        this.confirmDeleteTyped = '';
        this._renderListSlot();
        if (this.confirmingDeleteId) {
          slot.querySelector(`[data-delete-input="${CSS?.escape ? CSS.escape(id) : id}"]`)?.focus();
        }
      });
    });

    slot.querySelectorAll('[data-delete-input]').forEach((input) => {
      input.addEventListener('input', () => {
        this.confirmDeleteTyped = input.value;
        const id = input.dataset.deleteInput;
        const proj = this.projects.find(p => p.id === id);
        const btn = slot.querySelector(`[data-confirm-delete="${CSS?.escape ? CSS.escape(id) : id}"]`);
        if (btn && proj) {
          btn.disabled = !ProjectLifecycle.deletionConfirmed(this.confirmDeleteTyped, proj.name);
        }
      });
    });

    slot.querySelectorAll('[data-confirm-delete]').forEach((btn) => {
      btn.addEventListener('click', () => this._commitDelete(btn.dataset.confirmDelete));
    });

    slot.querySelectorAll('[data-leave-id]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = el.dataset.leaveId;
        this.editingId = '';
        this.confirmingDeleteId = '';
        this.confirmingLeaveId = this.confirmingLeaveId === id ? '' : id;
        this._renderListSlot();
      });
    });

    slot.querySelectorAll('[data-confirm-leave]').forEach((btn) => {
      btn.addEventListener('click', () => this._commitLeave(btn.dataset.confirmLeave));
    });

    slot.querySelectorAll('[data-cancel-confirm]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.confirmingDeleteId = '';
        this.confirmDeleteTyped = '';
        this.confirmingLeaveId = '';
        this._renderListSlot();
      });
    });
  }

  async _createProject() {
    if (this.creating) return;
    const raw = this.newName;
    const clean = ProjectLifecycle.normalizeName(raw);
    if (raw.trim() && !clean) {
      this.error = 'Informe um nome válido para o projeto.';
      this._renderListSlot();
      return;
    }

    this.creating = true;
    this.error = '';
    this._renderContent();
    try {
      const name = clean || await ProjectLifecycle.suggestName();
      await this.onCreate({ name, claim: CLOUD_ENABLED && AuthService.isLoggedIn() });
      this.newName = '';
    } catch (err) {
      this.error = err.message || 'Falha ao criar projeto.';
    } finally {
      this.creating = false;
      this._renderContent();
    }
  }

  async _commitRename(projectId) {
    if (!projectId || this.busyId || !this.onRename) return;
    const clean = ProjectLifecycle.normalizeName(this.editingName);
    if (!clean) {
      UIToast.notificar({ tipo: 'alerta', titulo: 'Nome inválido', mensagem: 'Informe um nome para o projeto.', duracao: 2500 });
      return;
    }

    this.busyId = projectId;
    this._renderListSlot();
    try {
      const savedName = await this.onRename(projectId, clean);
      const item = this.projects.find(p => p.id === projectId);
      if (item) {
        item.name = savedName || clean;
        item.updatedAt = new Date().toISOString();
      }
      this.editingId = '';
      this.editingName = '';
    } catch (err) {
      UIToast.notificar({ tipo: 'erro', titulo: 'Erro ao renomear', mensagem: err.message || 'Não foi possível renomear.', duracao: 3500 });
    } finally {
      this.busyId = '';
      this._renderListSlot();
    }
  }

  async _commitDelete(projectId) {
    if (!projectId || this.busyId || !this.onDelete) return;
    const proj = this.projects.find(p => p.id === projectId);
    if (!proj) return;
    if ((Number(proj.featureCount) || 0) > 0 && !ProjectLifecycle.deletionConfirmed(this.confirmDeleteTyped, proj.name)) {
      return;
    }

    this.busyId = projectId;
    this._renderListSlot();
    try {
      await this.onDelete(projectId);
      this.projects = this.projects.filter(p => p.id !== projectId);
      this.confirmingDeleteId = '';
      this.confirmDeleteTyped = '';
    } catch (err) {
      UIToast.notificar({ tipo: 'erro', titulo: 'Erro ao excluir', mensagem: err.message || 'Não foi possível excluir o projeto.', duracao: 3500 });
    } finally {
      this.busyId = '';
      this._renderContent();
    }
  }

  async _commitLeave(projectId) {
    if (!projectId || this.busyId || !this.onLeave) return;
    this.busyId = projectId;
    this._renderListSlot();
    try {
      await this.onLeave(projectId);
      this.projects = this.projects.filter(p => p.id !== projectId);
      this.confirmingLeaveId = '';
      UIToast.notificar({
        tipo: 'sucesso',
        titulo: 'Você saiu do projeto',
        mensagem: 'O projeto foi removido da sua lista.',
        duracao: 2800
      });
    } catch (err) {
      UIToast.notificar({ tipo: 'erro', titulo: 'Erro ao sair', mensagem: err.message || 'Não foi possível sair do projeto.', duracao: 3500 });
    } finally {
      this.busyId = '';
      this._renderContent();
    }
  }
}
