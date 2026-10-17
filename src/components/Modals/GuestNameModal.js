/* ==========================================================================
   ConecteMapas - GuestNameModal (SRP)
   Pede o nome de um convidado sem conta, para que os demais operadores
   saibam quem está no mapa. O nome fica gravado no dispositivo (GuestIdentity).
   ========================================================================== */

import { GuestIdentity, GUEST_NAME_MIN, GUEST_NAME_MAX } from '../../services/Storage/GuestIdentity.js';

export class GuestNameModal {
  /**
   * @param {Object} options
   * @param {Function} [options.onNameSet] chamado com o nome gravado
   * @param {Function} [options.onOpenLogin] chamado quando o convidado escolhe entrar numa conta
   */
  constructor(options = {}) {
    this.onNameSet = options.onNameSet || (() => {});
    this.onOpenLogin = options.onOpenLogin || (() => {});
    this.container = null;
  }

  render(container) {
    this.container = container;
    this.container.innerHTML = `
      <ui-modal id="modal-guest-name" titulo="Como podemos te chamar?" largura="400px" bloquear-fechamento>
        <form id="cm-guest-form" class="cm-auth-single-form" novalidate>
          <p style="margin: 0 0 8px; font-size: 12px; line-height: 1.45; color: var(--ui-cor-texto-secundario, #888899);">
            Você está no mapa como convidado. Seu nome aparece para os outros operadores
            e fica salvo neste dispositivo até você entrar numa conta.
          </p>
          <ui-campo-texto name="guest-name" label="Seu nome" maxlength="${GUEST_NAME_MAX}" obrigatorio></ui-campo-texto>
          <div id="cm-guest-error" role="alert" style="min-height: 16px; font-size: 11.5px; color: var(--ui-cor-erro, #ef4444);"></div>
          <ui-botao-primario inline type="submit" variante="primary" style="height: 34px; font-weight: 600;">Continuar</ui-botao-primario>
          <div class="cm-auth-form-footer">Já tem conta? <a href="#" id="cm-guest-login">Entrar</a>.</div>
        </form>
      </ui-modal>`;

    const form = this.container.querySelector('#cm-guest-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const field = form.querySelector('[name="guest-name"]');
      const name = GuestIdentity.setName(field?.value);
      if (!name) {
        this.container.querySelector('#cm-guest-error').textContent =
          `Digite um nome com pelo menos ${GUEST_NAME_MIN} caracteres.`;
        return;
      }
      this.close();
      this.onNameSet(name);
    });
    this.container.querySelector('#cm-guest-login').addEventListener('click', (e) => {
      e.preventDefault();
      this.close();
      this.onOpenLogin();
    });
  }

  get modal() {
    return this.container && this.container.querySelector('#modal-guest-name');
  }

  open() {
    const field = this.container?.querySelector('[name="guest-name"]');
    if (field) field.value = '';
    this.modal?.setAttribute('bloquear-fechamento', '');
    this.modal?.abrir();
    setTimeout(() => field?.focus?.(), 50);
  }

  close() {
    // bloquear-fechamento também barra o fechar() programático
    this.modal?.removeAttribute('bloquear-fechamento');
    this.modal?.fechar();
  }
}
