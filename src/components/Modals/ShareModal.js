/* ==========================================================================
   ConecteMapas - ShareModal Component (SRP Module)
   Responsabilidade Única: Gerenciamento do modal de compartilhamento
   da sessão colaborativa em tempo real, links diretos, permissões e embed.
   ========================================================================== */

import './ShareModal.css';
import { AccessManager } from '../../services/Storage/AccessManager.js';
import { AuthService } from '../../services/Storage/AuthService.js';

export class ShareModal {
  constructor(options = {}) {
    this.container = null;
    this.getProjectId = options.getProjectId || (() => 'projeto_padrao');
    this.getProjectName = options.getProjectName || (() => 'Novo Mapa');
    this.onSyncBeforeShare = options.onSyncBeforeShare || null;
  }

  escapeHtml(str) {
    if (typeof str !== 'string') return str == null ? '' : String(str);
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  getShareUrl() {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
    const projectId = this.getProjectId();
    return `${origin}${pathname}?project=${encodeURIComponent(projectId)}`;
  }

  /**
   * Seção "Quem tem acesso": projeto aberto (qualquer um edita) ou protegido por chaves.
   * Só o dono emite/revoga links; chaves novas aparecem uma única vez (o servidor guarda só o hash).
   */
  async refreshAccessPanel() {
    const panel = this.container && this.container.querySelector('#cm-access-panel');
    if (!panel) return;
    const projectId = this.getProjectId();
    const info = await AccessManager.refresh(projectId);

    if (!info) {
      panel.innerHTML = '<span class="cm-share-hint">Nuvem indisponível: não foi possível ler as permissões.</span>';
      return;
    }
    if (info.canClaim) {
      panel.innerHTML = `
        <div class="cm-share-hint">⚠️ Projeto <b>aberto</b>: qualquer pessoa com o endereço pode ver e editar.
          ${AuthService.isLoggedIn() ? 'Você será o dono pela sua conta.' : 'Entre na sua conta antes para ser o dono por ela; sem conta, será criado um link de dono.'}</div>
        <ui-botao-primario inline id="btn-claim-project" variante="primary" style="height: 32px; font-size: 12px;">
          🔒 Proteger projeto e tornar-me dono
        </ui-botao-primario>`;
      panel.querySelector('#btn-claim-project').addEventListener('click', () => this.claimProject());
      return;
    }
    if (!info.canManage) {
      panel.innerHTML = `<div class="cm-share-hint">Seu acesso: <b>${this.escapeHtml(info.role || 'nenhum')}</b>. Só o dono gerencia acessos.</div>`;
      return;
    }

    let access = [], members = [], invites = [];
    try { ({ access, members, invites } = await AccessManager.listAccess(projectId)); } catch {}
    const roleNames = { owner: 'Dono', editor: 'Editor', viewer: 'Leitor' };
    const me = AuthService.getUser();
    const memberRows = members.map(m => `<div class="cm-access-row">
        <span class="cm-access-role">${this.escapeHtml(roleNames[m.role] || m.role)}</span>
        <span class="cm-access-label">${this.escapeHtml(m.name)} · ${this.escapeHtml(m.email)}</span>
        ${m.role === 'owner' ? `<span class="cm-share-hint">${me && me.id === m.id ? 'você' : 'dono'}</span>`
          : `<button class="cm-share-revoke" data-member-id="${Number(m.id)}">Remover</button>`}</div>`).join('');
    const inviteRows = invites.map(i => `<div class="cm-access-row">
        <span class="cm-access-role">${this.escapeHtml(roleNames[i.role] || i.role)}</span>
        <span class="cm-access-label">Convite pendente${i.email ? ' · ' + this.escapeHtml(i.email) : ''}</span>
        <button class="cm-share-revoke" data-invite-id="${this.escapeHtml(i.id)}">Cancelar</button></div>`).join('');
    const rows = access.map(a => {
      const revoked = !!a.revokedAt;
      const roleLabel = { owner: 'Dono', editor: 'Editor', viewer: 'Leitor' }[a.role] || a.role;
      const action = revoked ? '<span class="cm-share-hint">revogado</span>'
        : a.role === 'owner' ? '<span class="cm-share-hint">você</span>'
        : `<button class="cm-share-revoke" data-access-id="${this.escapeHtml(a.id)}">Revogar</button>`;
      return `<div class="cm-access-row${revoked ? ' is-revoked' : ''}">
        <span class="cm-access-role">${this.escapeHtml(roleLabel)}</span>
        <span class="cm-access-label">${this.escapeHtml(a.label || '—')}</span>${action}</div>`;
    }).join('');

    panel.innerHTML = `
      <div class="cm-access-list">${memberRows}${inviteRows}${rows}</div>
      <span class="cm-share-label">Convidar pessoa com conta (cadastro só por convite, válido por 7 dias)</span>
      <div class="cm-share-input-row">
        <ui-lista-flutuante id="share-invite-role" label="Papel">
          <option value="editor" selected>✏️ Editor</option>
          <option value="viewer">👁️ Leitor</option>
        </ui-lista-flutuante>
        <ui-campo-texto id="share-invite-email" placeholder="E-mail (opcional, trava o convite)"></ui-campo-texto>
        <ui-botao-primario inline id="btn-create-invite" variante="primary" class="cm-share-copy-btn">Convidar</ui-botao-primario>
      </div>
      <span class="cm-share-label">Link para convidados sem conta</span>
      <div class="cm-share-input-row">
        <ui-lista-flutuante id="share-new-role" label="Papel">
          <option value="viewer" selected>👁️ Leitor (só visualiza)</option>
          <option value="editor">✏️ Editor (desenha e edita)</option>
        </ui-lista-flutuante>
        <ui-campo-texto id="share-new-label" placeholder="Para quem? (ex.: Maria)"></ui-campo-texto>
        <ui-botao-primario inline id="btn-create-share" variante="primary" class="cm-share-copy-btn">Gerar link</ui-botao-primario>
      </div>
      <div id="cm-share-new-link"></div>`;

    panel.querySelectorAll('.cm-share-revoke').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          if (btn.dataset.memberId) await AccessManager.revokeMember(projectId, Number(btn.dataset.memberId));
          else if (btn.dataset.inviteId) await AccessManager.revokeInvite(projectId, btn.dataset.inviteId);
          else await AccessManager.revokeAccess(projectId, btn.dataset.accessId);
        } catch {}
        this.refreshAccessPanel();
      });
    });
    panel.querySelector('#btn-create-invite').addEventListener('click', () => this.createInvite());
    panel.querySelector('#btn-create-share').addEventListener('click', () => this.createShare());
  }

  async claimProject() {
    const projectId = this.getProjectId();
    try {
      const data = await AccessManager.claimProject(projectId, 'Dono');
      await this.refreshAccessPanel();
      if (data.key) this.showNewLink(AccessManager.buildShareUrl(projectId, data.key), 'Seu link de dono (guarde-o: não será exibido de novo)');
    } catch (e) {
      this.showNewLink('', 'Falha ao proteger: ' + e.message);
    }
  }

  async createInvite() {
    const projectId = this.getProjectId();
    const role = this.container.querySelector('#share-invite-role')?.value || 'editor';
    const email = (this.container.querySelector('#share-invite-email')?.value || '').trim();
    try {
      const data = await AccessManager.createInvite(projectId, role, email);
      await this.refreshAccessPanel();
      this.showNewLink(AccessManager.buildInviteUrl(projectId, data.code), 'Link de convite (envie à pessoa; não será exibido de novo)');
    } catch (e) {
      this.showNewLink('', 'Falha ao convidar: ' + e.message);
    }
  }

  async createShare() {
    const projectId = this.getProjectId();
    const role = this.container.querySelector('#share-new-role')?.value || 'viewer';
    const label = this.container.querySelector('#share-new-label')?.value || '';
    try {
      const data = await AccessManager.createShare(projectId, role, label);
      await this.refreshAccessPanel();
      const title = role === 'editor' ? 'Link de editor' : 'Link de leitor';
      this.showNewLink(AccessManager.buildShareUrl(projectId, data.key), `${title} (copie agora: não será exibido de novo)`);
    } catch (e) {
      this.showNewLink('', 'Falha ao gerar link: ' + e.message);
    }
  }

  showNewLink(url, title) {
    const slot = this.container.querySelector('#cm-share-new-link');
    if (!slot) return;
    slot.innerHTML = `<span class="cm-share-label">${this.escapeHtml(title)}</span>` + (url ? `
      <div class="cm-share-input-row">
        <ui-campo-texto value="${this.escapeHtml(url)}" readonly></ui-campo-texto>
        <ui-botao-primario inline variante="secundario" class="cm-share-copy-btn"
          copiar-texto="${this.escapeHtml(url)}" toast-sucesso="Link copiado!">📋 Copiar</ui-botao-primario>
      </div>` : '');
  }

  /**
   * Renderiza o modal de compartilhamento
   * @param {HTMLElement} container
   */
  render(container) {
    this.container = container;
    const currentUrl = this.getShareUrl();
    const safeUrl = this.escapeHtml(currentUrl);
    const rawEmbed = `<iframe src="${currentUrl}" width="100%" height="600" frameborder="0"></iframe>`;
    const safeEmbed = this.escapeHtml(rawEmbed);

    this.container.innerHTML = `
      <ui-modal id="modal-share" titulo="🔗 Compartilhar Projeto em Nuvem">
        <div class="cm-share-container">
          <!-- Banner Informativo Compacto -->
          <div class="cm-share-banner">
            <span class="cm-share-banner-icon">☁️</span>
            <span>Projeto aberto: quem tiver este endereço acessa. Depois de proteger o projeto, só entram links de acesso gerados abaixo.</span>
          </div>

          <!-- Seção: Sincronização & Link Direto -->
          <div class="cm-share-section">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span class="cm-share-label">Endereço do Projeto</span>
              <span id="cm-share-sync-status" style="font-size: 10.5px; color: var(--cm-primary); font-family: var(--cm-fonte-mono);">
                ● Conectado ao MySQL Hostinger
              </span>
            </div>
            <div class="cm-share-input-row">
              <ui-campo-texto 
                id="share-link-input" 
                value="${safeUrl}" 
                readonly>
              </ui-campo-texto>
              <ui-botao-primario 
                inline 
                id="btn-copy-share-link" 
                variante="primary" 
                class="cm-share-copy-btn" 
                copiar-texto="${safeUrl}" 
                toast-sucesso="Link copiado para a área de transferência!">
                📋 Copiar
              </ui-botao-primario>
            </div>
          </div>

          <!-- Botão de Sincronização Pré-Compartilhamento -->
          <div style="margin-top: 4px;">
            <ui-botao-primario 
              inline 
              id="btn-sync-before-share" 
              variante="secundario" 
              style="width: 100%; height: 36px; font-weight: 600; font-size: 12px;">
              ☁️ Salvar Alterações na Nuvem Hostinger Agora
            </ui-botao-primario>
          </div>

          <div class="cm-share-divider"></div>

          <!-- Seção: Quem tem acesso (papéis reais, aplicados pelo servidor) -->
          <div class="cm-share-section">
            <span class="cm-share-label">Quem tem acesso</span>
            <div id="cm-access-panel"><span class="cm-share-hint">Carregando permissões…</span></div>
          </div>

          <div class="cm-share-divider"></div>

          <!-- Seção: Código Embed (Iframe) -->
          <div class="cm-share-section">
            <span class="cm-share-label">Incorporar no seu Site ou Relatório (Iframe)</span>
            <div class="cm-share-input-row">
              <ui-campo-texto 
                id="share-iframe-code" 
                value="${safeEmbed}" 
                readonly>
              </ui-campo-texto>
              <ui-botao-primario 
                inline 
                id="btn-copy-iframe-code" 
                variante="secundario" 
                class="cm-share-copy-btn" 
                copiar-texto="${safeEmbed}" 
                toast-sucesso="Código HTML copiado!">
                📋 Copiar HTML
              </ui-botao-primario>
            </div>
          </div>
        </div>

        <div slot="rodape" style="display: flex; justify-content: flex-end; gap: 8px;">
          <ui-botao-primario inline variante="secundario" dismiss-modal style="height: 30px; font-size: 12px; padding: 0 12px;">
            Fechar
          </ui-botao-primario>
        </div>
      </ui-modal>
    `;

    this.bindEvents();
    this.applyCompactModalStyles();
    this.refreshAccessPanel();
  }

  bindEvents() {
    // Permissões mudam com login/convites: relê sempre que o modal abre
    this.container.querySelector('#modal-share')?.addEventListener('ui-abrir', () => this.refreshAccessPanel());

    const btnSync = this.container.querySelector('#btn-sync-before-share');
    const statusSpan = this.container.querySelector('#cm-share-sync-status');
    const inputLink = this.container.querySelector('#share-link-input');
    const copyBtn = this.container.querySelector('#btn-copy-share-link');

    if (btnSync) {
      btnSync.addEventListener('click', async () => {
        if (typeof this.onSyncBeforeShare === 'function') {
          if (statusSpan) statusSpan.textContent = '⏳ Salvando no MySQL...';
          btnSync.setAttribute('disabled', 'true');
          try {
            const res = await this.onSyncBeforeShare();
            if (res && res.success) {
              if (statusSpan) statusSpan.textContent = '✓ 100% Salvo na Nuvem';
              const updatedUrl = this.getShareUrl();
              if (inputLink) inputLink.setAttribute('value', updatedUrl);
              if (copyBtn) copyBtn.setAttribute('copiar-texto', updatedUrl);
            } else {
              if (statusSpan) statusSpan.textContent = '⚠️ Falha: ' + (res?.error || 'Erro de rede');
            }
          } catch (e) {
            if (statusSpan) statusSpan.textContent = '⚠️ Erro ao sincronizar';
          } finally {
            btnSync.removeAttribute('disabled');
          }
        }
      });
    }
  }

  /**
   * Ajusta os estilos internos do Shadow DOM do ui-modal para cabeçalho baixo e bordas equilibradas
   */
  applyCompactModalStyles() {
    const modal = this.container.querySelector('#modal-share');
    if (modal && modal.shadowRoot) {
      const style = document.createElement('style');
      style.textContent = `
        .ui-modal__dialog {
          max-width: 520px !important;
          border-radius: 10px !important;
        }
        .ui-modal__header {
          padding: 9px 14px !important;
        }
        .ui-modal__titulo {
          font-size: 13.5px !important;
          font-weight: 600 !important;
        }
        .ui-modal__close {
          font-size: 13px !important;
          padding: 2px 6px !important;
        }
        .ui-modal__body {
          padding: 12px 14px !important;
        }
        .ui-modal__footer {
          padding: 7px 14px !important;
        }
      `;
      modal.shadowRoot.appendChild(style);
    }
  }
}
