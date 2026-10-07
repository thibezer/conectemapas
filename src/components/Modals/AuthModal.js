/* ==========================================================================
   ConecteMapas - AuthModal
   Responsabilidade Única: entrar, criar conta (somente com convite),
   ver a conta e sair. Usa os componentes ui-* e o AuthService.
   ========================================================================== */

import { AuthService } from '../../services/Storage/AuthService.js';

const ERROR_STYLE = 'min-height: 16px; font-size: 11.5px; color: var(--ui-cor-erro, #ef4444);';
const HINT_STYLE = 'font-size: 11.5px; color: var(--ui-cor-texto-secundario, #888899); line-height: 1.4;';

export class AuthModal {
  /**
   * @param {Object} options
   * @param {Function} [options.onAuthenticated] chamado com o usuário após login/cadastro
   * @param {Function} [options.onInviteAccepted] chamado com {projectId, role} após aceitar convite logado
   */
  constructor(options = {}) {
    this.container = null;
    this.onAuthenticated = options.onAuthenticated || (() => {});
    this.onInviteAccepted = options.onInviteAccepted || (() => {});
    this.view = 'login';
    this.inviteCode = '';
  }

  escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  render(container) {
    this.container = container;
    this.container.innerHTML = `<ui-modal id="modal-auth" titulo="Conta"><div id="cm-auth-body"></div></ui-modal>`;
    AuthService.onChange(() => {
      if (this.container.querySelector('#modal-auth')?.aberto) this.show(AuthService.isLoggedIn() ? 'account' : 'login');
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
    const body = this.container.querySelector('#cm-auth-body');
    const modal = this.modal;
    if (!body || !modal) return;

    const titles = { login: 'Entrar', register: 'Criar conta com convite', account: 'Minha conta', accept: 'Aceitar convite' };
    modal.setAttribute('titulo', titles[view] || 'Conta');
    body.innerHTML = this[`_${view}View`]();
    this._bind(body);
  }

  _loginView() {
    return `
      <form id="cm-auth-form" style="display: flex; flex-direction: column; gap: 12px;" novalidate>
        <ui-campo-texto name="email" label="E-mail" tipo="email" obrigatorio></ui-campo-texto>
        <ui-campo-texto name="password" label="Senha" tipo="password" alternar-senha obrigatorio></ui-campo-texto>
        <div id="cm-auth-error" role="alert" style="${ERROR_STYLE}"></div>
        <ui-botao-primario type="submit" variante="primary">Entrar</ui-botao-primario>
        <div style="${HINT_STYLE}">
          O cadastro é feito apenas por convite. Recebeu um código?
          <a href="#" id="cm-auth-go-register">Criar conta</a>.
          Esqueceu a senha? Peça ao administrador para redefini-la.
        </div>
      </form>`;
  }

  _registerView() {
    return `
      <form id="cm-auth-form" style="display: flex; flex-direction: column; gap: 12px;" novalidate>
        <ui-campo-texto name="code" label="Código do convite" value="${this.escapeHtml(this.inviteCode)}" obrigatorio></ui-campo-texto>
        <ui-campo-texto name="name" label="Nome" obrigatorio></ui-campo-texto>
        <ui-campo-texto name="email" label="E-mail" tipo="email" obrigatorio></ui-campo-texto>
        <ui-campo-texto name="password" label="Senha" tipo="password" alternar-senha obrigatorio
          helper-text="De 8 a 72 caracteres, com letras e números."></ui-campo-texto>
        <div id="cm-auth-error" role="alert" style="${ERROR_STYLE}"></div>
        <ui-botao-primario type="submit" variante="primary">Criar conta</ui-botao-primario>
        <div style="${HINT_STYLE}">Já tem conta? <a href="#" id="cm-auth-go-login">Entrar</a>.</div>
      </form>`;
  }

  _acceptView() {
    return `
      <form id="cm-auth-form" style="display: flex; flex-direction: column; gap: 12px;" novalidate>
        <div style="${HINT_STYLE}">Você está logado como <b>${this.escapeHtml(AuthService.getUser()?.name)}</b>. Confirme o convite para entrar no projeto.</div>
        <ui-campo-texto name="code" label="Código do convite" value="${this.escapeHtml(this.inviteCode)}" obrigatorio></ui-campo-texto>
        <div id="cm-auth-error" role="alert" style="${ERROR_STYLE}"></div>
        <ui-botao-primario type="submit" variante="primary">Aceitar convite</ui-botao-primario>
      </form>`;
  }

  _accountView() {
    const user = AuthService.getUser() || {};
    return `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <ui-avatar nome="${this.escapeHtml(user.name)}" tamanho="md"></ui-avatar>
          <div><div style="font-weight: 600;">${this.escapeHtml(user.name)}</div>
          <div style="${HINT_STYLE}">${this.escapeHtml(user.email)}</div></div>
        </div>
        <form id="cm-auth-form" style="display: flex; flex-direction: column; gap: 10px;" novalidate>
          <span class="cm-share-label">Trocar senha</span>
          <ui-campo-texto name="current" label="Senha atual" tipo="password" alternar-senha obrigatorio></ui-campo-texto>
          <ui-campo-texto name="next" label="Nova senha" tipo="password" alternar-senha obrigatorio
            helper-text="De 8 a 72 caracteres, com letras e números. Os outros dispositivos serão desconectados."></ui-campo-texto>
          <div id="cm-auth-error" role="alert" style="${ERROR_STYLE}"></div>
          <ui-botao-primario type="submit" variante="secundario">Atualizar senha</ui-botao-primario>
        </form>
        <ui-botao-primario id="cm-auth-logout" variante="secundario">Sair da conta</ui-botao-primario>
      </div>`;
  }

  _bind(body) {
    body.querySelector('#cm-auth-go-register')?.addEventListener('click', (e) => { e.preventDefault(); this.show('register'); });
    body.querySelector('#cm-auth-go-login')?.addEventListener('click', (e) => { e.preventDefault(); this.show('login'); });
    body.querySelector('#cm-auth-logout')?.addEventListener('click', async () => {
      await AuthService.logout();
      this.show('login');
    });

    const form = body.querySelector('#cm-auth-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorBox = body.querySelector('#cm-auth-error');
      const submit = form.querySelector('[type="submit"]');
      const val = (name) => (form.querySelector(`[name="${name}"]`)?.value || '').trim();
      const rawVal = (name) => form.querySelector(`[name="${name}"]`)?.value || '';

      errorBox.textContent = '';
      submit?.setAttribute('carregando', '');
      try {
        if (this.view === 'login') {
          const user = await AuthService.login(val('email'), rawVal('password'));
          this.close();
          this.onAuthenticated(user);
        } else if (this.view === 'register') {
          const res = await AuthService.register({ code: val('code'), name: val('name'), email: val('email'), password: rawVal('password') });
          this.inviteCode = '';
          this.close();
          this.onAuthenticated(res.user);
          this.onInviteAccepted({ projectId: res.projectId, role: res.role });
        } else if (this.view === 'accept') {
          const res = await AuthService.acceptInvite(val('code'));
          this.inviteCode = '';
          this.close();
          this.onInviteAccepted({ projectId: res.projectId, role: res.role });
        } else if (this.view === 'account') {
          await AuthService.changePassword(rawVal('current'), rawVal('next'));
          form.reset?.();
          errorBox.style.color = 'var(--ui-cor-sucesso, #00E08A)';
          errorBox.textContent = 'Senha atualizada.';
        }
      } catch (err) {
        errorBox.style.color = '';
        errorBox.textContent = err.message || 'Não foi possível concluir.';
      } finally {
        submit?.removeAttribute('carregando');
      }
    });
  }
}
