/* ==========================================================================
   ConecteMapas - ProjectModal
   Responsabilidade Única: criar um projeto novo e excluir o projeto aberto,
   com confirmação digitando o nome.
   As ações em si ficam no ProjectActionsController (via callbacks).
   ========================================================================== */

import './ProjectModal.css';
import { ProjectLifecycle } from '../../services/Storage/ProjectLifecycle.js';

export class ProjectModal {
  /**
   * @param {Object} options
   * @param {Function} options.getProject () => {id, name} do projeto aberto
   * @param {Function} options.getDeletePermission () => {allowed, reason}
   * @param {Function} options.getClaimMode () => 'offer' (logado, com nuvem) | 'anonymous' | 'local'
   * @param {Function} options.onCreate async ({name, claim}) — cria e navega
   * @param {Function} options.onDelete async () — exclui e navega
   */
  constructor(options = {}) {
    this.getProject = options.getProject || (() => ({ id: '', name: '' }));
    this.getDeletePermission = options.getDeletePermission || (() => ({ allowed: false, reason: '' }));
    this.getClaimMode = options.getClaimMode || (() => 'local');
    this.onCreate = options.onCreate || (async () => {});
    this.onDelete = options.onDelete || (async () => {});
    this.container = null;
    this.view = 'manage';
    this.busy = false;
  }

  escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  render(container) {
    this.container = container;
    this.container.innerHTML = `<ui-modal id="modal-project" titulo="Projeto"><div id="cm-project-body" class="cm-project-modal"></div></ui-modal>`;
  }

  get modal() {
    return this.container && this.container.querySelector('#modal-project');
  }

  /** Painel do projeto: novo ou excluir. */
  open() {
    this.show('manage');
    this.modal?.abrir();
  }

  openCreate() {
    this.show('create');
    this.modal?.abrir();
    setTimeout(() => this.container?.querySelector('[name="name"]')?.focus?.(), 150);
  }

  openDelete() {
    this.show('delete');
    this.modal?.abrir();
  }

  close() {
    this.modal?.fechar();
  }

  show(view) {
    this.view = view;
    const body = this.container && this.container.querySelector('#cm-project-body');
    const modal = this.modal;
    if (!body || !modal) return;
    const titles = { manage: 'Projeto', create: 'Novo projeto', delete: 'Excluir projeto' };
    modal.setAttribute('titulo', titles[view] || 'Projeto');
    body.innerHTML = this[`_${view}View`]();
    this._bind(body);
  }

  _manageView() {
    const { id, name } = this.getProject();
    const perm = this.getDeletePermission();
    return `
      <div class="cm-project-section">
        <span class="cm-project-label">Projeto aberto</span>
        <div class="cm-project-current-name">${this.escapeHtml(name)}</div>
        <div class="cm-project-hint">ID: <code>${this.escapeHtml(id)}</code></div>
      </div>
      <ui-botao-primario id="cm-project-go-create" variante="primary">Novo projeto</ui-botao-primario>
      <div class="cm-project-section cm-project-danger">
        <span class="cm-project-label">Zona de perigo</span>
        <div class="cm-project-hint">Excluir apaga o projeto, camadas, feições, histórico e acessos para todos os membros. Não dá para desfazer.</div>
        <ui-botao-primario id="cm-project-go-delete" variante="destrutivo" ${perm.allowed ? '' : 'disabled'}>Excluir projeto…</ui-botao-primario>
        ${perm.allowed ? '' : `<div class="cm-project-hint" id="cm-project-delete-reason">${this.escapeHtml(perm.reason)}</div>`}
      </div>`;
  }

  _createView() {
    const claimMode = this.getClaimMode();
    const claimBlock = {
      offer: '<ui-checkbox name="claim" label="Tornar-me dono (restringir acesso apenas a convidados)"></ui-checkbox>',
      anonymous: '<div class="cm-project-hint">Sem login, o projeto fica aberto a quem tiver o link. Entre na sua conta para ser o dono, ou proteja-o depois em Compartilhar.</div>',
      local: '<div class="cm-project-hint">Modo local de testes: o projeto fica só neste navegador.</div>'
    }[claimMode] || '';
    return `
      <form id="cm-project-form" class="cm-project-form" novalidate>
        <ui-campo-texto name="name" label="Nome do projeto" maxlength="120" obrigatorio></ui-campo-texto>
        ${claimBlock}
        <div id="cm-project-error" class="cm-project-error" role="alert"></div>
        <ui-botao-primario type="submit" variante="primary">Criar e abrir</ui-botao-primario>
        <div class="cm-project-hint">O projeto aberto agora não é alterado. <a href="#" id="cm-project-back">Voltar</a></div>
      </form>`;
  }

  _deleteView() {
    const { name } = this.getProject();
    return `
      <form id="cm-project-form" class="cm-project-form" novalidate>
        <div class="cm-project-warning">
          Isto apaga <b>definitivamente</b> o projeto <b>${this.escapeHtml(name)}</b>: camadas, feições, histórico,
          membros, convites e links de acesso. Ninguém mais conseguirá abri-lo.
        </div>
        <ui-campo-texto name="confirm" label="Digite o nome do projeto para confirmar" placeholder="${this.escapeHtml(name)}" autocomplete="off"></ui-campo-texto>
        <div id="cm-project-error" class="cm-project-error" role="alert"></div>
        <ui-botao-primario type="submit" id="cm-project-delete-submit" variante="destrutivo" disabled>Excluir definitivamente</ui-botao-primario>
        <div class="cm-project-hint"><a href="#" id="cm-project-back">Voltar</a></div>
      </form>`;
  }

  _bind(body) {
    body.querySelector('#cm-project-go-create')?.addEventListener('click', () => this.openCreate());
    body.querySelector('#cm-project-go-delete')?.addEventListener('click', () => {
      if (this.getDeletePermission().allowed) this.show('delete');
    });
    body.querySelector('#cm-project-back')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.show('manage');
    });

    const form = body.querySelector('#cm-project-form');
    if (!form) return;
    const submit = form.querySelector('[type="submit"]');
    const errorBox = body.querySelector('#cm-project-error');
    const field = (name) => form.querySelector(`[name="${name}"]`);

    if (this.view === 'delete') {
      const sync = () => submit?.toggleAttribute('disabled', !ProjectLifecycle.deletionConfirmed(field('confirm')?.value, this.getProject().name));
      field('confirm')?.addEventListener('ui-input', sync);
      field('confirm')?.addEventListener('input', sync);
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (this.busy) return;
      errorBox.textContent = '';
      try {
        if (this.view === 'create') {
          const name = ProjectLifecycle.normalizeName(field('name')?.value);
          if (!name) throw new Error('Informe o nome do projeto.');
          const claimBox = field('claim');
          const claim = !!(claimBox && (claimBox.marcado ?? claimBox.checked));
          this._setBusy(submit, true);
          await this.onCreate({ name, claim });
        } else if (this.view === 'delete') {
          if (!ProjectLifecycle.deletionConfirmed(field('confirm')?.value, this.getProject().name)) {
            throw new Error('O nome digitado não confere.');
          }
          this._setBusy(submit, true);
          await this.onDelete();
        }
      } catch (err) {
        this._setBusy(submit, false);
        errorBox.textContent = err.message || 'Não foi possível concluir.';
      }
    });
  }

  _setBusy(submit, busy) {
    this.busy = busy;
    if (busy) submit?.setAttribute('carregando', '');
    else submit?.removeAttribute('carregando');
  }
}
