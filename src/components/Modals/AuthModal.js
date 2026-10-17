/* ==========================================================================
   ConecteMapas - AuthModal Component (SRP Encapsulated)
   Responsabilidade Única: Hub de Conta do Operador, Gestão Densa de Projetos (Workbench),
   Troca Segura de Senha e Fluxos de Autenticação / Convite.
   ========================================================================== */

import './AuthModal.css';
import { AuthService } from '../../services/Storage/AuthService.js';
import { AccessManager } from '../../services/Storage/AccessManager.js';
import { LocalStore } from '../../services/Storage/LocalStore.js';

const ERROR_STYLE = 'min-height: 16px; font-size: 11.5px; color: var(--ui-cor-erro, #ef4444);';
const HINT_STYLE = 'font-size: 11.5px; color: var(--ui-cor-texto-secundario, #888899); line-height: 1.4;';

export class AuthModal {
  /**
   * @param {Object} options
   * @param {Function} [options.onAuthenticated] chamado com o usuário após login/cadastro
   * @param {Function} [options.onInviteAccepted] chamado com {projectId, role} após aceitar convite logado
   * @param {string} [options.currentProjectId] ID do projeto aberto atualmente
   * @param {Function} [options.getCurrentProjectId] Getter dinâmico do projeto aberto
   */
  constructor(options = {}) {
    this.container = null;
    this.onAuthenticated = options.onAuthenticated || (() => {});
    this.onInviteAccepted = options.onInviteAccepted || (() => {});
    this.currentProjectId = options.currentProjectId || '';
    this.getCurrentProjectId = options.getCurrentProjectId || (() => this.currentProjectId);
    this.view = 'login';
    this.inviteCode = '';

    // Estado do Workbench de Projetos
    this.activeTab = 'projects'; // 'projects' | 'security'
    this.cachedProjects = [];
    this.projectFilter = 'all'; // 'all' | 'owner' | 'shared'
    this.searchQuery = '';
    this.selectedIndex = 0;
    this._keydownHandler = null;
  }

  escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  get activeProjectId() {
    return this.getCurrentProjectId ? this.getCurrentProjectId() : this.currentProjectId;
  }

  render(container) {
    this.container = container;
    this.container.innerHTML = `<ui-modal id="modal-auth" titulo="Conta" largura="640px"><div id="cm-auth-body"></div></ui-modal>`;

    AuthService.onChange(() => {
      if (this.container.querySelector('#modal-auth')?.aberto) {
        this.show(AuthService.isLoggedIn() ? 'account' : 'login');
      }
    });

    this.show(AuthService.isLoggedIn() ? 'account' : 'login');
  }

  get modal() {
    return this.container && this.container.querySelector('#modal-auth');
  }

  open(view) {
    this.show(view || (AuthService.isLoggedIn() ? 'account' : 'login'));
    if (this.modal) this.modal.abrir();
  }

  close() {
    if (this.modal) this.modal.fechar();
  }

  /** Abre o cadastro com o código do convite já preenchido (ou o aceite, se já logado). */
  openInvite(code) {
    this.inviteCode = code || '';
    this.open(AuthService.isLoggedIn() ? 'accept' : 'register');
  }

  show(view) {
    this.view = view;
    const body = this.container?.querySelector('#cm-auth-body');
    const modal = this.modal;
    if (!body || !modal) return;

    const titles = {
      login: 'Entrar na Conta',
      register: 'Criar Conta com Convite',
      account: 'Minha Conta · Hub do Operador',
      accept: 'Aceitar Convite para Projeto'
    };

    modal.setAttribute('titulo', titles[view] || 'Conta');
    if (view === 'account') {
      modal.setAttribute('largura', '640px');
    } else {
      modal.setAttribute('largura', '440px');
    }

    body.innerHTML = this[`_${view}View`]();
    this._bind(body);
  }

  _loginView() {
    return `
      <form id="cm-auth-form" class="cm-auth-single-form" novalidate>
        <ui-campo-texto name="email" label="E-mail" tipo="email" obrigatorio></ui-campo-texto>
        <ui-campo-texto name="password" label="Senha" tipo="password" alternar-senha obrigatorio></ui-campo-texto>
        <div id="cm-auth-error" role="alert" style="${ERROR_STYLE}"></div>
        <ui-botao-primario inline type="submit" variante="primary" style="height: 34px; font-weight: 600;">Entrar</ui-botao-primario>
        <div class="cm-auth-form-footer">
          O cadastro é feito apenas por convite. Recebeu um código?
          <a href="#" id="cm-auth-go-register">Criar conta</a>.<br>
          Esqueceu a senha? Peça ao administrador para redefini-la.
        </div>
      </form>`;
  }

  _registerView() {
    return `
      <form id="cm-auth-form" class="cm-auth-single-form" novalidate>
        <ui-campo-texto name="code" label="Código do convite" value="${this.escapeHtml(this.inviteCode)}" obrigatorio></ui-campo-texto>
        <ui-campo-texto name="name" label="Nome Completo" obrigatorio></ui-campo-texto>
        <ui-campo-texto name="email" label="E-mail" tipo="email" obrigatorio></ui-campo-texto>
        <ui-campo-texto name="password" label="Senha" tipo="password" alternar-senha obrigatorio
          helper-text="De 8 a 72 caracteres, com letras e números."></ui-campo-texto>
        <div id="cm-auth-error" role="alert" style="${ERROR_STYLE}"></div>
        <ui-botao-primario inline type="submit" variante="primary" style="height: 34px; font-weight: 600;">Criar Conta</ui-botao-primario>
        <div class="cm-auth-form-footer">Já tem conta? <a href="#" id="cm-auth-go-login">Entrar</a>.</div>
      </form>`;
  }

  _acceptView() {
    const user = AuthService.getUser() || {};
    return `
      <form id="cm-auth-form" class="cm-auth-single-form" novalidate>
        <div style="${HINT_STYLE}">Você está conectado como <b>${this.escapeHtml(user.name)}</b> (${this.escapeHtml(user.email)}). Confirme o código de convite para ingressar no projeto.</div>
        <ui-campo-texto name="code" label="Código do convite" value="${this.escapeHtml(this.inviteCode)}" obrigatorio></ui-campo-texto>
        <div id="cm-auth-error" role="alert" style="${ERROR_STYLE}"></div>
        <ui-botao-primario inline type="submit" variante="primary" style="height: 34px; font-weight: 600;">Aceitar Convite</ui-botao-primario>
      </form>`;
  }

  _accountView() {
    const user = AuthService.getUser() || { name: 'Operador', email: '' };

    return `
      <div class="cm-auth-workbench">
        <!-- 1. Topo: Cartão do Operador e Status de Sessão -->
        <div class="cm-auth-header-card">
          <div class="cm-auth-user-info">
            <ui-avatar nome="${this.escapeHtml(user.name)}" tamanho="md"></ui-avatar>
            <div class="cm-auth-user-meta">
              <span class="cm-auth-user-name">${this.escapeHtml(user.name)}</span>
              <span class="cm-auth-user-email">${this.escapeHtml(user.email)}</span>
            </div>
          </div>
          <div class="cm-auth-session-badge">
            <span class="cm-auth-session-dot"></span>
            <span>Sessão Ativa</span>
          </div>
        </div>

        <!-- 2. Status Bar Horizontal (KPIs Operacionais do Operador) -->
        <div class="cm-auth-status-bar">
          <div class="cm-auth-status-item">
            <span class="cm-auth-status-label">Total de Projetos</span>
            <span class="cm-auth-status-val" id="cm-stat-total">Carregando…</span>
          </div>
          <div class="cm-auth-status-item">
            <span class="cm-auth-status-label">Feições no Banco</span>
            <span class="cm-auth-status-val" id="cm-stat-features">Carregando…</span>
          </div>
          <div class="cm-auth-status-item">
            <span class="cm-auth-status-label">Projeto Ativo no Mapa</span>
            <span class="cm-auth-status-val active-project" id="cm-stat-current">● Aberto</span>
          </div>
        </div>

        <!-- 3. Abas com ui-segmented para Separação Rígida de Contexto -->
        <div class="cm-auth-tabs-wrap">
          <ui-segmented id="cm-auth-tabs" tamanho="sm" largura-total valor="${this.activeTab}">
            <span valor="projects">📁 Meus Projetos (<span id="cm-tab-proj-count">0</span>)</span>
            <span valor="security">🛡️ Trocar Senha & Segurança</span>
          </ui-segmented>
        </div>

        <!-- 4. ABA 1: Central de Projetos (Workbench Densa) -->
        <div id="cm-tab-panel-projects" class="cm-auth-tab-panel" style="display: ${this.activeTab === 'projects' ? 'flex' : 'none'};">
          <div class="cm-auth-projects-toolbar">
            <div class="cm-auth-search-box">
              <ui-campo-texto 
                id="cm-auth-search-input" 
                placeholder="Buscar projeto por nome ou id... (Ctrl+K)" 
                value="${this.escapeHtml(this.searchQuery)}">
              </ui-campo-texto>
            </div>
            <div class="cm-auth-filter-pills" id="cm-auth-pills-group">
              <span class="cm-auth-pill ${this.projectFilter === 'all' ? 'is-active' : ''}" data-filter="all">Todos</span>
              <span class="cm-auth-pill ${this.projectFilter === 'owner' ? 'is-active' : ''}" data-filter="owner">Dono</span>
              <span class="cm-auth-pill ${this.projectFilter === 'shared' ? 'is-active' : ''}" data-filter="shared">Compartilhados</span>
            </div>
          </div>

          <div id="cm-auth-projects-box" class="cm-auth-projects-list">
            <!-- Skeleton Inicial -->
            <div class="cm-auth-skeleton-list">
              <div class="cm-auth-skeleton-row"></div>
              <div class="cm-auth-skeleton-row"></div>
              <div class="cm-auth-skeleton-row"></div>
              <div class="cm-auth-skeleton-row"></div>
            </div>
          </div>
        </div>

        <!-- 5. ABA 2: Segurança & Encerramento de Sessão -->
        <div id="cm-tab-panel-security" class="cm-auth-tab-panel" style="display: ${this.activeTab === 'security' ? 'flex' : 'none'};">
          <div class="cm-auth-card-section">
            <div class="cm-auth-card-title">
              <span>🔐 Trocar Senha de Acesso</span>
            </div>
            <form id="cm-auth-password-form" style="display: flex; flex-direction: column; gap: 10px;" novalidate>
              <ui-campo-texto name="current" label="Senha atual" tipo="password" alternar-senha obrigatorio></ui-campo-texto>
              <ui-campo-texto name="next" label="Nova senha" tipo="password" alternar-senha obrigatorio
                helper-text="De 8 a 72 caracteres, com letras e números. Os outros dispositivos serão desconectados."></ui-campo-texto>
              <ui-campo-texto name="confirm" label="Confirmar nova senha" tipo="password" alternar-senha obrigatorio></ui-campo-texto>
              
              <div id="cm-auth-error" role="alert" style="${ERROR_STYLE}"></div>

              <div style="display: flex; justify-content: flex-start; margin-top: 4px;">
                <ui-botao-primario inline type="submit" variante="primary" style="height: 32px; padding: 0 16px;">
                  Atualizar Senha
                </ui-botao-primario>
              </div>
            </form>
          </div>

          <!-- Zona de Encerramento com Salvaguarda de Confirmação -->
          <div class="cm-auth-card-section cm-auth-logout-zone">
            <div class="cm-auth-card-title" style="color: #f87171;">
              <span>🚪 Sessão do Operador</span>
            </div>
            <span style="${HINT_STYLE}">
              Ao sair, sua chave de sessão será revogada e este dispositivo precisará de login novamente.
            </span>

            <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 4px;">
              <ui-botao-primario inline id="cm-auth-logout-init" variante="secundario" style="height: 30px;">
                Sair da Conta
              </ui-botao-primario>
            </div>

            <!-- Caixa de confirmação de segurança (Regra 7 do ui-workbench) -->
            <div id="cm-auth-logout-confirm-box" class="cm-auth-logout-confirm">
              <span style="font-weight: 500;">Tem certeza que deseja desconectar de <b>${this.escapeHtml(user.name)}</b>?</span>
              <div class="cm-auth-logout-confirm-actions">
                <ui-botao-primario inline id="cm-auth-logout-cancel" variante="ghost" style="height: 26px; font-size: 11px;">
                  Cancelar
                </ui-botao-primario>
                <ui-botao-primario inline id="cm-auth-logout-confirm" variante="destrutivo" style="height: 26px; font-size: 11px;">
                  Sim, Desconectar
                </ui-botao-primario>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }

  async _loadMyProjects(body) {
    const box = body.querySelector('#cm-auth-projects-box');
    const statTotal = body.querySelector('#cm-stat-total');
    const statFeatures = body.querySelector('#cm-stat-features');
    const statCurrent = body.querySelector('#cm-stat-current');
    const tabCount = body.querySelector('#cm-tab-proj-count');

    try {
      let projects = [];
      try {
        projects = await AuthService.listMyProjects();
      } catch (cloudErr) {
        // Fallback resiliente para projetos locais caso a nuvem esteja offline ou em modo local de testes
        const localList = LocalStore.listProjects();
        if (localList && localList.length) {
          projects = localList.map(p => ({
            id: p.id,
            name: p.name || p.id,
            featureCount: p.featureCount || 0,
            updatedAt: p.updatedAt,
            role: 'owner'
          }));
        } else {
          throw cloudErr;
        }
      }
      if (!box || !box.isConnected) return;
      this.cachedProjects = Array.isArray(projects) ? projects : [];

      // Atualiza KPIs operacionais
      const totalCount = this.cachedProjects.length;
      const totalFeats = this.cachedProjects.reduce((acc, p) => acc + (Number(p.featureCount) || 0), 0);
      const activeProj = this.cachedProjects.find(p => p.id === this.activeProjectId);

      if (statTotal) statTotal.textContent = `${totalCount} ${totalCount === 1 ? 'projeto' : 'projetos'}`;
      if (statFeatures) statFeatures.textContent = `${totalFeats} ${totalFeats === 1 ? 'feição' : 'feições'}`;
      if (statCurrent) statCurrent.textContent = activeProj ? `● ${activeProj.name || activeProj.id}` : '● Nenhum';
      if (tabCount) tabCount.textContent = String(totalCount);

      this._renderProjectsList(body);
    } catch (err) {
      if (!box || !box.isConnected) return;
      box.innerHTML = `
        <div class="cm-auth-empty-state" style="border-color: rgba(239, 68, 68, 0.3);">
          <span class="cm-auth-empty-icon">⚠️</span>
          <span>${this.escapeHtml(err.message || 'Falha ao carregar lista de projetos.')}</span>
          <ui-botao-primario inline id="cm-auth-retry-projects" variante="secundario" style="margin-top: 4px; height: 26px; font-size: 11px;">
            Tentar Novamente
          </ui-botao-primario>
        </div>`;
      box.querySelector('#cm-auth-retry-projects')?.addEventListener('click', () => this._loadMyProjects(body));
    }
  }

  _renderProjectsList(body) {
    const box = body.querySelector('#cm-auth-projects-box');
    if (!box) return;

    // Filtra projetos conforme pesquisa e papel
    const query = (this.searchQuery || '').trim().toLowerCase();
    const filter = this.projectFilter;

    const filtered = this.cachedProjects.filter((p) => {
      // Filtro de Papel
      if (filter === 'owner' && p.role !== 'owner') return false;
      if (filter === 'shared' && p.role === 'owner') return false;

      // Filtro de Busca
      if (query) {
        const nameMatch = (p.name || '').toLowerCase().includes(query);
        const idMatch = (p.id || '').toLowerCase().includes(query);
        const roleMatch = (p.role || '').toLowerCase().includes(query);
        if (!nameMatch && !idMatch && !roleMatch) return false;
      }
      return true;
    });

    if (!filtered.length) {
      const isSearch = !!query || filter !== 'all';
      box.innerHTML = `
        <div class="cm-auth-empty-state">
          <span class="cm-auth-empty-icon">${isSearch ? '🔍' : '📁'}</span>
          <span>${isSearch ? 'Nenhum projeto encontrado para os filtros selecionados.' : 'Você ainda não participa de nenhum projeto.'}</span>
          ${isSearch ? `
            <ui-botao-primario inline id="cm-auth-clear-filters" variante="ghost" style="height: 24px; font-size: 11px;">
              Limpar Filtros
            </ui-botao-primario>
          ` : `
            <span style="${HINT_STYLE}">Aceite um código de convite ou crie um novo projeto para começar.</span>
          `}
        </div>`;

      box.querySelector('#cm-auth-clear-filters')?.addEventListener('click', () => {
        this.searchQuery = '';
        this.projectFilter = 'all';
        const searchInput = body.querySelector('#cm-auth-search-input');
        if (searchInput) searchInput.value = '';
        body.querySelectorAll('.cm-auth-pill').forEach(pill => {
          pill.classList.toggle('is-active', pill.getAttribute('data-filter') === 'all');
        });
        this._renderProjectsList(body);
      });
      return;
    }

    const rolesMap = {
      owner: { label: 'Dono', badge: 'primario' },
      editor: { label: 'Editor', badge: 'sucesso' },
      viewer: { label: 'Leitor', badge: 'neutro' }
    };

    const fmtDate = (d) => {
      if (!d) return '';
      const t = Date.parse(String(d).replace(' ', 'T'));
      return t ? new Date(t).toLocaleDateString('pt-BR') : '';
    };

    const currentId = this.activeProjectId;

    const rowsHtml = filtered.map((p, idx) => {
      const isCurrent = p.id === currentId;
      const isSelected = idx === this.selectedIndex;
      const shareUrl = AccessManager.buildShareUrl(p.id);
      const roleInfo = rolesMap[p.role] || { label: p.role, badge: 'neutro' };
      const feats = Number(p.featureCount) || 0;

      return `
        <div class="cm-auth-project-row ${isCurrent ? 'is-current' : ''} ${isSelected ? 'is-selected' : ''}" 
             data-proj-id="${this.escapeHtml(p.id)}" 
             data-proj-index="${idx}"
             tabindex="0"
             role="row">
          <div class="cm-auth-project-main">
            <div class="cm-auth-project-title-row">
              <a href="${this.escapeHtml(shareUrl)}" class="cm-auth-project-link" title="Abrir projeto ${this.escapeHtml(p.name || p.id)}">
                ${this.escapeHtml(p.name || p.id)}
              </a>
              ${isCurrent ? `<ui-badge variante="sucesso" style="font-size: 9.5px; padding: 1px 5px;">🟢 Aberto</ui-badge>` : ''}
            </div>
            <div class="cm-auth-project-meta-row">
              <ui-badge variante="${roleInfo.badge}" style="font-size: 9.5px; padding: 0 4px;">${roleInfo.label}</ui-badge>
              <span>•</span>
              <span>📊 ${feats} ${feats === 1 ? 'feição' : 'feições'}</span>
              <span>•</span>
              <span>📅 ${this.escapeHtml(fmtDate(p.updatedAt))}</span>
            </div>
          </div>
          <div class="cm-auth-project-actions">
            ${isCurrent ? `
              <ui-botao-primario inline variante="ghost" style="height: 26px; font-size: 11px; opacity: 0.7;" disabled>
                Em edição
              </ui-botao-primario>
            ` : `
              <ui-botao-primario inline variante="primary" class="cm-btn-switch-project" data-proj-id="${this.escapeHtml(p.id)}" style="height: 26px; font-size: 11px; padding: 0 10px;">
                Abrir
              </ui-botao-primario>
            `}
            <a href="${this.escapeHtml(shareUrl)}" target="_blank" class="cm-auth-pill" title="Abrir em nova aba" style="text-decoration: none; height: 24px; display: inline-flex; align-items: center; padding: 0 6px;">
              ↗
            </a>
            <ui-botao-primario 
              inline 
              variante="ghost" 
              title="Copiar link de acesso" 
              copiar-texto="${this.escapeHtml(shareUrl)}" 
              toast-sucesso="Link do projeto copiado!"
              style="height: 24px; padding: 0 6px; font-size: 11px;">
              📋
            </ui-botao-primario>
          </div>
        </div>`;
    }).join('');

    box.innerHTML = rowsHtml;

    // Ações das linhas
    box.querySelectorAll('.cm-btn-switch-project').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const pId = btn.getAttribute('data-proj-id');
        if (pId) window.location.assign(AccessManager.buildShareUrl(pId));
      });
    });

    box.querySelectorAll('.cm-auth-project-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('ui-botao-primario') || e.target.closest('a')) return;
        const idx = Number(row.getAttribute('data-proj-index'));
        if (!isNaN(idx)) {
          this.selectedIndex = idx;
          box.querySelectorAll('.cm-auth-project-row').forEach((r, i) => {
            r.classList.toggle('is-selected', i === idx);
          });
        }
      });
    });
  }

  _bind(body) {
    if (this.view === 'account') {
      this._loadMyProjects(body);

      // 1. Alternador de Abas (ui-segmented)
      const segmented = body.querySelector('#cm-auth-tabs');
      if (segmented) {
        const handleTab = (e) => {
          const val = e.detail?.valor || e.target?.value || e.target?.valor;
          if (val && (val === 'projects' || val === 'security')) {
            this.activeTab = val;
            const pProjects = body.querySelector('#cm-tab-panel-projects');
            const pSecurity = body.querySelector('#cm-tab-panel-security');
            if (pProjects) pProjects.style.display = val === 'projects' ? 'flex' : 'none';
            if (pSecurity) pSecurity.style.display = val === 'security' ? 'flex' : 'none';
          }
        };
        segmented.addEventListener('ui-change', handleTab);
        segmented.addEventListener('change', handleTab);
      }

      // 2. Busca Rápida e Filtros de Projetos
      const searchInput = body.querySelector('#cm-auth-search-input');
      if (searchInput) {
        const onSearch = (e) => {
          this.searchQuery = e.target.value || '';
          this.selectedIndex = 0;
          this._renderProjectsList(body);
        };
        searchInput.addEventListener('input', onSearch);
        searchInput.addEventListener('change', onSearch);
      }

      // Pills de filtro
      body.querySelectorAll('.cm-auth-pill[data-filter]').forEach(pill => {
        pill.addEventListener('click', () => {
          body.querySelectorAll('.cm-auth-pill[data-filter]').forEach(p => p.classList.remove('is-active'));
          pill.classList.add('is-active');
          this.projectFilter = pill.getAttribute('data-filter') || 'all';
          this.selectedIndex = 0;
          this._renderProjectsList(body);
        });
      });

      // 3. Atalhos de Teclado no padrão ui-workbench (Ctrl+K para busca, setas para navegar na lista)
      if (this._keydownHandler) {
        document.removeEventListener('keydown', this._keydownHandler);
      }

      this._keydownHandler = (e) => {
        // Se o modal não estiver aberto ou não for a aba de projetos, ignora
        if (!this.modal?.aberto || this.view !== 'account' || this.activeTab !== 'projects') return;

        // Ctrl+K: Focar busca
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          const inp = body.querySelector('#cm-auth-search-input');
          inp?.focus?.();
          return;
        }

        // Não intercepta teclas se o usuário estiver digitando em um input
        if (e.target.matches('input, textarea, [contenteditable]')) return;

        // Se modificador estiver ativo, não intercepta (Regra GEMINI.md)
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        const rows = body.querySelectorAll('.cm-auth-project-row');
        if (!rows.length) return;

        if (e.key === 'ArrowDown' || e.key.toLowerCase() === 'j') {
          e.preventDefault();
          this.selectedIndex = Math.min(this.selectedIndex + 1, rows.length - 1);
          rows.forEach((r, i) => r.classList.toggle('is-selected', i === this.selectedIndex));
          rows[this.selectedIndex]?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'k') {
          e.preventDefault();
          this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
          rows.forEach((r, i) => r.classList.toggle('is-selected', i === this.selectedIndex));
          rows[this.selectedIndex]?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') {
          const selectedRow = rows[this.selectedIndex];
          if (selectedRow) {
            e.preventDefault();
            const pId = selectedRow.getAttribute('data-proj-id');
            if (pId) window.location.assign(AccessManager.buildShareUrl(pId));
          }
        }
      };
      document.addEventListener('keydown', this._keydownHandler);

      // 4. Salvaguarda de Logout (Confirmação Inline - Regra 7)
      const btnLogoutInit = body.querySelector('#cm-auth-logout-init');
      const boxLogoutConfirm = body.querySelector('#cm-auth-logout-confirm-box');
      const btnLogoutCancel = body.querySelector('#cm-auth-logout-cancel');
      const btnLogoutConfirm = body.querySelector('#cm-auth-logout-confirm');

      if (btnLogoutInit && boxLogoutConfirm) {
        btnLogoutInit.addEventListener('click', () => {
          boxLogoutConfirm.style.display = 'flex';
          btnLogoutInit.style.display = 'none';
        });
      }

      if (btnLogoutCancel && boxLogoutConfirm && btnLogoutInit) {
        btnLogoutCancel.addEventListener('click', () => {
          boxLogoutConfirm.style.display = 'none';
          btnLogoutInit.style.display = 'inline-flex';
        });
      }

      if (btnLogoutConfirm) {
        btnLogoutConfirm.addEventListener('click', async () => {
          btnLogoutConfirm.setAttribute('carregando', '');
          try {
            await AuthService.logout();
            this.show('login');
          } finally {
            btnLogoutConfirm.removeAttribute('carregando');
          }
        });
      }

      // 5. Formulário de Troca de Senha com Confirmação e Validação
      const pwForm = body.querySelector('#cm-auth-password-form');
      if (pwForm) {
        pwForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const errorBox = body.querySelector('#cm-auth-error');
          const submitBtn = pwForm.querySelector('[type="submit"]');
          const current = (pwForm.querySelector('[name="current"]')?.value || '').trim();
          const next = (pwForm.querySelector('[name="next"]')?.value || '').trim();
          const confirm = (pwForm.querySelector('[name="confirm"]')?.value || '').trim();

          errorBox.textContent = '';
          errorBox.style.color = '';

          if (!current || !next) {
            errorBox.textContent = 'Informe a senha atual e a nova senha.';
            return;
          }

          if (next.length < 8 || next.length > 72) {
            errorBox.textContent = 'A nova senha deve ter entre 8 e 72 caracteres.';
            return;
          }

          if (confirm && next !== confirm) {
            errorBox.textContent = 'A confirmação de senha não coincide com a nova senha.';
            return;
          }

          submitBtn?.setAttribute('carregando', '');
          try {
            await AuthService.changePassword(current, next);
            pwForm.reset?.();
            errorBox.style.color = 'var(--ui-cor-sucesso, #00E08A)';
            errorBox.textContent = '✓ Senha atualizada com sucesso! Outros dispositivos foram desconectados.';
          } catch (err) {
            errorBox.style.color = 'var(--ui-cor-erro, #ef4444)';
            errorBox.textContent = err.message || 'Falha ao atualizar senha.';
          } finally {
            submitBtn?.removeAttribute('carregando');
          }
        });
      }
    }

    // Navegação simples entre login e registro
    body.querySelector('#cm-auth-go-register')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.show('register');
    });

    body.querySelector('#cm-auth-go-login')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.show('login');
    });

    // Submissão dos outros formulários (login, register, accept)
    const form = body.querySelector('#cm-auth-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorBox = body.querySelector('#cm-auth-error');
      const submit = form.querySelector('[type="submit"]');
      const val = (name) => (form.querySelector(`[name="${name}"]`)?.value || '').trim();
      const rawVal = (name) => form.querySelector(`[name="${name}"]`)?.value || '';

      errorBox.textContent = '';
      errorBox.style.color = '';
      submit?.setAttribute('carregando', '');

      try {
        if (this.view === 'login') {
          const user = await AuthService.login(val('email'), rawVal('password'));
          this.show('account');
          this.onAuthenticated(user);
        } else if (this.view === 'register') {
          const res = await AuthService.register({
            code: val('code'),
            name: val('name'),
            email: val('email'),
            password: rawVal('password')
          });
          this.inviteCode = '';
          this.close();
          this.onAuthenticated(res.user);
          this.onInviteAccepted({ projectId: res.projectId, role: res.role });
        } else if (this.view === 'accept') {
          const res = await AuthService.acceptInvite(val('code'));
          this.inviteCode = '';
          this.close();
          this.onInviteAccepted({ projectId: res.projectId, role: res.role });
        }
      } catch (err) {
        errorBox.style.color = 'var(--ui-cor-erro, #ef4444)';
        errorBox.textContent = err.message || 'Não foi possível concluir a ação.';
      } finally {
        submit?.removeAttribute('carregando');
      }
    });
  }
}
