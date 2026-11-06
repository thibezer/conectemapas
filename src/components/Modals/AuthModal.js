/* ==========================================================================
   ConecteMapas - AuthModal Component (SRP Encapsulated)
   Responsabilidade Única: Conta do Operador (senha e sessão) e fluxos de
   autenticação / convite. A lista de projetos fica no ProjectsScreen.
   ========================================================================== */

import './AuthModal.css';
import { AuthService } from '../../services/Storage/AuthService.js';

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
    this.container.innerHTML = `<ui-modal id="modal-auth" titulo="Conta" largura="480px"><div id="cm-auth-body"></div></ui-modal>`;

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
      account: 'Minha Conta',
      accept: 'Aceitar Convite para Projeto'
    };

    modal.setAttribute('titulo', titles[view] || 'Conta');
    if (view === 'account') {
      modal.setAttribute('largura', '480px');
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

        <!-- 5. ABA 2: Segurança & Encerramento de Sessão -->
        <div id="cm-tab-panel-security" class="cm-auth-tab-panel" style="display: flex;">
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

  _bind(body) {
    if (this.view === 'account') {
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
