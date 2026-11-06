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
   * @param {Function} options.onCreate async ({name, claim}) — cria e navega
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
    this._loadSeq = 0;
    this._headerObserver = null;
    this._returnFocus = null;
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
    this.root.tabIndex = -1;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', 'Projetos');
    container.appendChild(this.root);

    // Teclas dentro da tela não chegam aos atalhos globais do mapa (Delete, Ctrl+K da tabela, Esc do desenho...)
    this.root.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') this.close();
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.root.querySelector('#cm-ps-search')?.focus?.();
      }
    });

    // Saiu da conta com a tela aberta: fecha, sem mostrar projetos de quem acabou de sair
    AuthService.onChange(() => { if (!AuthService.isLoggedIn()) this.close(); });
  }

  async open() {
    if (!this.root) return;
    this._returnFocus = document.activeElement;
    this._trackHeader();
    this._draw();
    this.root.hidden = false;
    document.body.style.overflow = 'hidden';
    this.root.focus();
    await this._load();
  }

  close() {
    if (!this.root || this.root.hidden) return;
    this.root.hidden = true;
    this._headerObserver?.disconnect();
    document.body.style.overflow = '';
    this._returnFocus?.focus?.();
    this._returnFocus = null;
  }

  /** A tela começa logo abaixo do cabeçalho/ribbon do app (que fica sempre visível); acompanha o recolher do ribbon. */
  _trackHeader() {
    const header = document.getElementById('header-mount');
    const sync = () => { this.root.style.top = `${header ? Math.round(header.getBoundingClientRect().bottom) : 0}px`; };
    sync();
    this._headerObserver?.disconnect();
    if (header && typeof ResizeObserver !== 'undefined') {
      this._headerObserver = new ResizeObserver(sync);
      this._headerObserver.observe(header);
    }
  }

  _draw() {
    const user = AuthService.getUser() || { name: 'Visitante' };
    this.root.innerHTML = `
      <header class="cm-ps-top">
        <ui-botao-primario inline variante="ghost" data-act="close">← Voltar ao mapa</ui-botao-primario>
        <span class="cm-ps-brand">Projetos</span>
        <button type="button" class="cm-ps-avatar" data-act="account" title="Conta e segurança" aria-label="Conta e segurança">
          <ui-avatar nome="${this.esc(user.name)}" tamanho="sm"></ui-avatar>
        </button>
      </header>
      <main class="cm-ps-main">
        <section class="cm-ps-hero">
          <h1>O que vamos mapear hoje?</h1>
          <ui-botao-primario variante="primary" data-act="create" style="height: 44px; padding: 0 28px; font-weight: 700;">+ Criar projeto</ui-botao-primario>
        </section>
        <section class="cm-ps-bar">
          <div class="cm-ps-search">
            <ui-campo-texto id="cm-ps-search" placeholder="Buscar projetos (Ctrl+K)" value="${this.esc(this.query)}"></ui-campo-texto>
          </div>
          <ui-segmented id="cm-ps-filter" tamanho="sm" valor="${this.filter}">
            ${FILTERS.map(f => `<span valor="${f.id}">${f.label}</span>`).join('')}
          </ui-segmented>
        </section>
        <div class="cm-ps-error" role="alert" hidden></div>
        <section class="cm-ps-grid" id="cm-ps-grid"><div class="cm-ps-loading">Carregando projetos…</div></section>
      </main>`;

    this.root.querySelector('[data-act="close"]').addEventListener('click', () => this.close());
    this.root.querySelector('[data-act="account"]').addEventListener('click', () => this.onOpenAccount());
    this.root.querySelector('[data-act="create"]').addEventListener('click', () => this._create());

    const search = this.root.querySelector('#cm-ps-search');
    const onSearch = (e) => { this.query = e.target.value || ''; this._renderGrid(); };
    search.addEventListener('input', onSearch);
    search.addEventListener('change', onSearch);

    const seg = this.root.querySelector('#cm-ps-filter');
    const onFilter = (e) => {
      const val = e.detail?.valor || e.target?.value || e.target?.valor;
      if (FILTERS.some(f => f.id === val)) { this.filter = val; this._renderGrid(); }
    };
    seg.addEventListener('ui-change', onFilter);
    seg.addEventListener('change', onFilter);
  }

  async _load() {
    const seq = ++this._loadSeq;
    try {
      let list;
      try {
        list = await AuthService.listMyProjects();
      } catch (err) {
        const local = LocalStore.listProjects();
        if (!local || !local.length) throw err;
        list = local.map(p => ({ id: p.id, name: p.name || p.id, featureCount: p.featureCount || 0, updatedAt: p.updatedAt, role: 'owner' }));
      }
      if (seq !== this._loadSeq || !this.isOpen) return;
      this.projects = Array.isArray(list) ? list : [];
      this._renderGrid();
    } catch (err) {
      if (seq !== this._loadSeq || !this.isOpen) return;
      const grid = this.root.querySelector('#cm-ps-grid');
      if (!grid) return;
      grid.innerHTML = `<div class="cm-ps-empty">${this.esc(err.message || 'Falha ao carregar projetos.')}<br><ui-botao-primario inline variante="secundario" data-act="retry">Tentar novamente</ui-botao-primario></div>`;
      grid.querySelector('[data-act="retry"]')?.addEventListener('click', () => this._load());
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
      const name = String(p.name || p.id);
      const url = this.esc(AccessManager.buildShareUrl(p.id));
      const feats = Number(p.featureCount) || 0;
      const hue = [...String(p.id)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
      const date = this._fmtDate(p.updatedAt);
      return `
        <article class="cm-ps-card ${p.id === current ? 'is-current' : ''}" tabindex="0" data-id="${this.esc(p.id)}">
          <div class="cm-ps-thumb" style="--h:${hue}">
            <span>${this.esc([...name].slice(0, 2).join('').toUpperCase())}</span>
            ${p.id === current ? '<em class="cm-ps-tag">Aberto</em>' : ''}
            <a class="cm-ps-newtab" href="${url}" target="_blank" rel="noopener" title="Abrir em nova aba">↗</a>
          </div>
          <div class="cm-ps-info">
            <a class="cm-ps-open" href="${url}" title="${this.esc(name)}">${this.esc(name)}</a>
            <small>${this.esc(ROLES[p.role] || p.role || '')} · ${feats} ${feats === 1 ? 'feição' : 'feições'}${date ? ' · ' + this.esc(date) : ''}</small>
          </div>
        </article>`;
    }).join('');

    // O título é um link de verdade (Ctrl+clique, botão do meio); o clique no resto do card faz o mesmo
    const openProject = (id) => window.location.assign(AccessManager.buildShareUrl(id));
    grid.querySelectorAll('.cm-ps-card').forEach((card) => {
      const id = card.dataset.id;
      card.addEventListener('click', (e) => {
        if (id === current) { e.preventDefault(); this.close(); return; }
        if (!e.target.closest('a')) openProject(id);
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target === card) { id === current ? this.close() : openProject(id); }
      });
    });
  }

  async _create() {
    if (this.busy) return;
    const btn = this.root.querySelector('[data-act="create"]');
    const err = this.root.querySelector('.cm-ps-error');
    this.busy = true;
    btn.setAttribute('carregando', '');
    err.hidden = true;
    try {
      const name = await ProjectLifecycle.suggestName();
      // Logado: o projeto nasce com dono, senão não apareceria nesta lista (ela é por vínculo)
      await this.onCreate({ name, claim: true });
    } catch (e) {
      this.busy = false;
      btn.removeAttribute('carregando');
      err.textContent = e.message || 'Não foi possível criar o projeto.';
      err.hidden = false;
    }
  }
}
