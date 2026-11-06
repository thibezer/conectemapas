/* ==========================================================================
   ConecteMapas - ProjectsScreen
   Responsabilidade Única: tela cheia de projetos (padrão "home" do Canva):
   criar um projeto novo e abrir os existentes. Conta/senha ficam no AuthModal.
   ========================================================================== */

import './ProjectsScreen.css';
import { AuthService } from '../../services/Storage/AuthService.js';
import { AccessManager } from '../../services/Storage/AccessManager.js';
import { LocalStore } from '../../services/Storage/LocalStore.js';
import { ProjectLifecycle } from '../../services/Storage/ProjectLifecycle.js';

const ROLES = { owner: 'Dono', editor: 'Editor', viewer: 'Leitor' };
const FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'owner', label: 'Meus' },
  { id: 'shared', label: 'Compartilhados' }
];

export class ProjectsScreen {
  /**
   * @param {Object} options
   * @param {Function} options.getCurrentProjectId () => id do projeto aberto
   * @param {Function} options.onCreate async ({name}) — cria e navega
   * @param {Function} options.onOpenAccount abre o modal de conta/segurança
   */
  constructor(options = {}) {
    this.getCurrentProjectId = options.getCurrentProjectId || (() => '');
    this.onCreate = options.onCreate || (async () => {});
    this.onOpenAccount = options.onOpenAccount || (() => {});
    this.root = null;
    this.projects = [];
    this.filter = 'all';
    this.query = '';
    this.busy = false;
    this._onKey = (e) => {
      if (!this.isOpen) return;
      if (e.key === 'Escape') this.close();
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.root.querySelector('.cm-ps-search input')?.focus();
      }
    };
  }

  get isOpen() {
    return !!this.root && !this.root.hidden;
  }

  esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  render(container) {
    this.root = document.createElement('div');
    this.root.className = 'cm-ps';
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', 'Projetos');
    container.appendChild(this.root);
    document.addEventListener('keydown', this._onKey);
  }

  async open() {
    if (!this.root) return;
    this._draw();
    this.root.hidden = false;
    document.body.style.overflow = 'hidden';
    await this._load();
  }

  close() {
    if (!this.root) return;
    this.root.hidden = true;
    document.body.style.overflow = '';
  }

  _draw() {
    const user = AuthService.getUser() || { name: 'Visitante' };
    const initials = (user.name || '?').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    this.root.innerHTML = `
      <header class="cm-ps-top">
        <button type="button" class="cm-ps-back" data-act="close">← Voltar ao mapa</button>
        <span class="cm-ps-brand">Projetos</span>
        <button type="button" class="cm-ps-avatar" data-act="account" title="Conta e segurança">${this.esc(initials)}</button>
      </header>
      <main class="cm-ps-main">
        <section class="cm-ps-hero">
          <h1>O que vamos mapear hoje?</h1>
          <button type="button" class="cm-ps-create" data-act="create">
            <span class="cm-ps-plus">+</span> Criar projeto
          </button>
        </section>
        <section class="cm-ps-bar">
          <label class="cm-ps-search"><input type="search" placeholder="Buscar projetos (Ctrl+K)" value="${this.esc(this.query)}"></label>
          <div class="cm-ps-chips">
            ${FILTERS.map(f => `<button type="button" class="cm-ps-chip ${f.id === this.filter ? 'is-active' : ''}" data-filter="${f.id}">${f.label}</button>`).join('')}
          </div>
        </section>
        <div class="cm-ps-error" role="alert" hidden></div>
        <section class="cm-ps-grid" id="cm-ps-grid"><div class="cm-ps-loading">Carregando projetos…</div></section>
      </main>`;

    this.root.querySelector('[data-act="close"]').addEventListener('click', () => this.close());
    this.root.querySelector('[data-act="account"]').addEventListener('click', () => this.onOpenAccount());
    this.root.querySelector('[data-act="create"]').addEventListener('click', () => this._create());
    this.root.querySelector('.cm-ps-search input').addEventListener('input', (e) => {
      this.query = e.target.value || '';
      this._renderGrid();
    });
    this.root.querySelectorAll('.cm-ps-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        this.filter = chip.dataset.filter;
        this.root.querySelectorAll('.cm-ps-chip').forEach(c => c.classList.toggle('is-active', c === chip));
        this._renderGrid();
      });
    });
  }

  async _load() {
    try {
      let list;
      try {
        list = await AuthService.listMyProjects();
      } catch (err) {
        const local = LocalStore.listProjects();
        if (!local || !local.length) throw err;
        list = local.map(p => ({ id: p.id, name: p.name || p.id, featureCount: p.featureCount || 0, updatedAt: p.updatedAt, role: 'owner' }));
      }
      this.projects = Array.isArray(list) ? list : [];
      this._renderGrid();
    } catch (err) {
      const grid = this.root.querySelector('#cm-ps-grid');
      if (grid) grid.innerHTML = `<div class="cm-ps-empty">${this.esc(err.message || 'Falha ao carregar projetos.')}<br><button type="button" class="cm-ps-chip" data-act="retry">Tentar novamente</button></div>`;
      grid?.querySelector('[data-act="retry"]')?.addEventListener('click', () => this._load());
    }
  }

  _filtered() {
    const q = this.query.trim().toLowerCase();
    return this.projects.filter((p) => {
      if (this.filter === 'owner' && p.role !== 'owner') return false;
      if (this.filter === 'shared' && p.role === 'owner') return false;
      return !q || (p.name || '').toLowerCase().includes(q) || (p.id || '').toLowerCase().includes(q);
    });
  }

  _fmtDate(d) {
    if (!d) return '';
    const t = Date.parse(String(d).replace(' ', 'T'));
    return t ? new Date(t).toLocaleDateString('pt-BR') : '';
  }

  _renderGrid() {
    const grid = this.root.querySelector('#cm-ps-grid');
    if (!grid) return;
    const items = this._filtered();
    if (!items.length) {
      grid.innerHTML = `<div class="cm-ps-empty">${this.projects.length ? 'Nenhum projeto encontrado.' : 'Você ainda não tem projetos. Crie o primeiro acima.'}</div>`;
      return;
    }
    const current = this.getCurrentProjectId();
    grid.innerHTML = items.map((p) => {
      const name = p.name || p.id;
      const feats = Number(p.featureCount) || 0;
      const hue = [...String(p.id)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
      const isCurrent = p.id === current;
      return `
        <article class="cm-ps-card ${isCurrent ? 'is-current' : ''}" tabindex="0" data-id="${this.esc(p.id)}">
          <div class="cm-ps-thumb" style="--h:${hue}">
            <span>${this.esc(name.slice(0, 2).toUpperCase())}</span>
            ${isCurrent ? '<em class="cm-ps-tag">Aberto</em>' : ''}
            <a class="cm-ps-newtab" href="${this.esc(AccessManager.buildShareUrl(p.id))}" target="_blank" rel="noopener" title="Abrir em nova aba">↗</a>
          </div>
          <div class="cm-ps-info">
            <strong title="${this.esc(name)}">${this.esc(name)}</strong>
            <small>${this.esc(ROLES[p.role] || p.role || '')} · ${feats} ${feats === 1 ? 'feição' : 'feições'}${p.updatedAt ? ' · ' + this.esc(this._fmtDate(p.updatedAt)) : ''}</small>
          </div>
        </article>`;
    }).join('');

    const openProject = (id) => {
      if (id === current) { this.close(); return; }
      window.location.assign(AccessManager.buildShareUrl(id));
    };
    grid.querySelectorAll('.cm-ps-card').forEach((card) => {
      card.addEventListener('click', (e) => { if (!e.target.closest('a')) openProject(card.dataset.id); });
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter') openProject(card.dataset.id); });
    });
  }

  async _create() {
    if (this.busy) return;
    const btn = this.root.querySelector('[data-act="create"]');
    const err = this.root.querySelector('.cm-ps-error');
    this.busy = true;
    btn.disabled = true;
    btn.textContent = 'Criando…';
    err.hidden = true;
    try {
      const name = await ProjectLifecycle.suggestName();
      await this.onCreate({ name });
    } catch (e) {
      this.busy = false;
      btn.disabled = false;
      btn.innerHTML = '<span class="cm-ps-plus">+</span> Criar projeto';
      err.textContent = e.message || 'Não foi possível criar o projeto.';
      err.hidden = false;
    }
  }
}
