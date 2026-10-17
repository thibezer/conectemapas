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
    this.activeTab = 'acessos';
    this.activeInviteType = 'email';
    this.currentAccessInfo = null;
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
   * Atualiza a seção "Quem tem acesso": lê permissões na nuvem e renderiza a lista.
   */
  async refreshAccessPanel() {
    const panel = this.container && this.container.querySelector('#cm-access-panel');
    if (!panel) return;
    const projectId = this.getProjectId();
    const info = await AccessManager.refresh(projectId);
    this.currentAccessInfo = info;

    const bannerContainer = this.container.querySelector('#cm-share-banner-slot');
    const inputLink = this.container.querySelector('#share-link-input');
    const copyBtn = this.container.querySelector('#btn-copy-share-link');
    const iframeInput = this.container.querySelector('#share-iframe-code');
    const iframeCopyBtn = this.container.querySelector('#btn-copy-iframe-code');
    const badgeSecurity = this.container.querySelector('#cm-share-badge-security');

    const updateMainLinks = (url) => {
      if (inputLink) {
        inputLink.setAttribute('value', url);
        inputLink.value = url;
      }
      if (copyBtn) copyBtn.setAttribute('copiar-texto', url);
      const embedHtml = `<iframe src="${url}" width="100%" height="600" frameborder="0"></iframe>`;
      if (iframeInput) {
        iframeInput.setAttribute('value', embedHtml);
        iframeInput.value = embedHtml;
      }
      if (iframeCopyBtn) iframeCopyBtn.setAttribute('copiar-texto', embedHtml);
    };

    if (!info) {
      if (badgeSecurity) badgeSecurity.innerHTML = `<span class="cm-share-sync-chip is-error">● Nuvem Indisponível</span>`;
      panel.innerHTML = `
        <div class="cm-share-empty-state">
          <span style="font-size: 16px;">⚠️</span>
          <span>Nuvem indisponível no momento. Não foi possível carregar a lista de permissões.</span>
        </div>`;
      return;
    }

    if (info.canClaim) {
      const openUrl = this.getShareUrl();
      updateMainLinks(openUrl);
      if (badgeSecurity) {
        badgeSecurity.innerHTML = `<ui-badge variante="alerta">🌐 Acesso Público</ui-badge>`;
      }
      if (bannerContainer) {
        bannerContainer.innerHTML = `
          <div class="cm-share-banner is-open">
            <span class="cm-share-banner-icon">🌐</span>
            <span><b>Projeto Aberto</b>: Qualquer pessoa com este link pode visualizar e editar o mapa. Você pode protegê-lo definindo uma chave de proprietário.</span>
          </div>`;
      }
      panel.innerHTML = `
        <div class="cm-form-card" style="border-color: rgba(234, 179, 8, 0.3); background: rgba(234, 179, 8, 0.05);">
          <div class="cm-form-header">
            <span class="cm-form-title" style="color: #fef08a;">
              🛡️ Proteger Projeto com Dono
            </span>
            <span class="cm-form-desc">
              ${AuthService.isLoggedIn() ? 'Você será cadastrado como o dono oficial do projeto vinculado à sua conta.' : 'Você pode reivindicar a posse agora mesmo gerando uma chave mestre de Dono.'}
            </span>
          </div>
          <div style="margin-top: 6px;">
            <ui-botao-primario inline id="btn-claim-project" variante="primary" style="height: 34px; font-size: 12px;">
              🔒 Proteger Projeto e Tornar-me Dono
            </ui-botao-primario>
          </div>
        </div>`;
      panel.querySelector('#btn-claim-project')?.addEventListener('click', () => this.claimProject());
      return;
    }

    if (!info.canManage) {
      const myUrl = AccessManager.buildShareUrl(projectId, AccessManager.getKey(projectId));
      updateMainLinks(myUrl);
      const roleLabel = { owner: 'Dono', editor: 'Editor', viewer: 'Leitor' }[info.role] || info.role || 'Convidado';
      if (badgeSecurity) {
        badgeSecurity.innerHTML = `<ui-badge variante="info">🔒 Acesso ${this.escapeHtml(roleLabel)}</ui-badge>`;
      }
      if (bannerContainer) {
        bannerContainer.innerHTML = `
          <div class="cm-share-banner is-protected">
            <span class="cm-share-banner-icon">🔒</span>
            <span>Seu papel no projeto: <b>${this.escapeHtml(roleLabel)}</b>. Somente o dono do projeto pode gerenciar e emitir novos acessos.</span>
          </div>`;
      }
      panel.innerHTML = `
        <div class="cm-share-empty-state">
          <span style="font-size: 16px;">👤</span>
          <span>Você está acessando como <b>${this.escapeHtml(roleLabel)}</b>. As permissões são gerenciadas pelo dono do projeto.</span>
        </div>`;
      return;
    }

    // Projeto protegido com o usuário atual como Dono
    try {
      const shareableUrl = await AccessManager.getShareableLink(projectId, 'viewer');
      if (shareableUrl) updateMainLinks(shareableUrl);
      if (badgeSecurity) {
        badgeSecurity.innerHTML = `<ui-badge variante="sucesso">🔒 Projeto Protegido</ui-badge>`;
      }
      if (bannerContainer) {
        bannerContainer.innerHTML = `
          <div class="cm-share-banner is-protected">
            <span class="cm-share-banner-icon">🔒</span>
            <span><b>Projeto Protegido</b>: O link principal inclui a permissão de visualização para que convidados abram o mapa diretamente sem conta.</span>
          </div>`;
      }
    } catch {}

    let access = [], members = [], invites = [];
    try { ({ access, members, invites } = await AccessManager.listAccess(projectId)); } catch {}

    const roleNames = { owner: 'Dono', editor: 'Editor', viewer: 'Leitor' };
    const me = AuthService.getUser();

    // Linhas de Membros com Conta
    const memberRows = members.map(m => {
      const isMe = me && me.id === m.id;
      const isOwner = m.role === 'owner';
      const badgeClass = isOwner ? 'cm-access-badge-owner' : (m.role === 'editor' ? 'cm-access-badge-editor' : 'cm-access-badge-viewer');
      return `
        <div class="cm-access-card">
          <div class="cm-access-card-left">
            <ui-avatar nome="${this.escapeHtml(m.name)}" tamanho="sm" status="online"></ui-avatar>
            <div class="cm-access-card-info">
              <span class="cm-access-card-title">${this.escapeHtml(m.name)}</span>
              <span class="cm-access-card-subtitle">${this.escapeHtml(m.email)}</span>
            </div>
          </div>
          <div class="cm-access-card-right">
            <span class="${badgeClass}">${this.escapeHtml(roleNames[m.role] || m.role)}</span>
            ${isOwner 
              ? `<span style="font-size: 11px; color: var(--cm-text-muted, #94a3b8);">${isMe ? 'você' : 'dono'}</span>`
              : `<button class="cm-share-revoke-btn cm-share-revoke" data-member-id="${Number(m.id)}" title="Remover este usuário">Remover</button>`
            }
          </div>
        </div>`;
    }).join('');

    // Linhas de Convites Pendentes
    const inviteRows = invites.map(i => {
      const badgeClass = i.role === 'editor' ? 'cm-access-badge-editor' : 'cm-access-badge-viewer';
      return `
        <div class="cm-access-card">
          <div class="cm-access-card-left">
            <span style="font-size: 16px; width: 28px; text-align: center;">✉️</span>
            <div class="cm-access-card-info">
              <span class="cm-access-card-title">Convite Pendente</span>
              <span class="cm-access-card-subtitle">${i.email ? this.escapeHtml(i.email) : 'Link público de cadastro (7 dias)'}</span>
            </div>
          </div>
          <div class="cm-access-card-right">
            <span class="${badgeClass}">${this.escapeHtml(roleNames[i.role] || i.role)}</span>
            <button class="cm-share-revoke-btn cm-share-revoke" data-invite-id="${this.escapeHtml(i.id)}" title="Cancelar este convite">Cancelar</button>
          </div>
        </div>`;
    }).join('');

    // Linhas de Chaves Avulsas para Convidados sem Conta
    const accessRows = access.map(a => {
      const revoked = !!a.revokedAt;
      const roleLabel = roleNames[a.role] || a.role;
      const badgeClass = a.role === 'owner' ? 'cm-access-badge-owner' : (a.role === 'editor' ? 'cm-access-badge-editor' : 'cm-access-badge-viewer');
      return `
        <div class="cm-access-card${revoked ? ' is-revoked' : ''}">
          <div class="cm-access-card-left">
            <span style="font-size: 16px; width: 28px; text-align: center;">🔗</span>
            <div class="cm-access-card-info">
              <span class="cm-access-card-title">${this.escapeHtml(a.label || 'Link Direto')}</span>
              <span class="cm-access-card-subtitle">${revoked ? 'Acesso Revogado' : 'Chave direta de convidado'}</span>
            </div>
          </div>
          <div class="cm-access-card-right">
            <span class="${badgeClass}">${this.escapeHtml(roleLabel)}</span>
            ${revoked 
              ? `<span style="font-size: 11px; color: var(--cm-text-muted, #94a3b8);">revogado</span>`
              : (a.role === 'owner' 
                  ? `<span style="font-size: 11px; color: var(--cm-text-muted, #94a3b8);">você</span>`
                  : `<button class="cm-share-revoke-btn cm-share-revoke" data-access-id="${this.escapeHtml(a.id)}" title="Revogar acesso deste link">Revogar</button>`
                )
            }
          </div>
        </div>`;
    }).join('');

    const totalCount = members.length + invites.length + access.filter(a => !a.revokedAt).length;
    this.updateTabCounters(totalCount);

    if (!memberRows && !inviteRows && !accessRows) {
      panel.innerHTML = `
        <div class="cm-share-empty-state">
          <span style="font-size: 18px;">👥</span>
          <span>Nenhum outro participante ou link avulso cadastrado.</span>
          <span style="font-size: 11px; color: var(--cm-text-muted, #64748b);">Use a aba "Convidar / Novo Link" para adicionar colaboradores.</span>
        </div>`;
    } else {
      panel.innerHTML = `
        <div class="cm-access-list-wrap">
          ${memberRows}
          ${inviteRows}
          ${accessRows}
        </div>`;
    }

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
  }

  updateTabCounters(count) {
    const tabAcessos = this.container?.querySelector('#cm-tab-label-acessos');
    if (tabAcessos) {
      tabAcessos.textContent = count > 0 ? `👥 Quem Tem Acesso (${count})` : '👥 Quem Tem Acesso';
    }
  }

  async claimProject() {
    const projectId = this.getProjectId();
    try {
      const data = await AccessManager.claimProject(projectId, 'Dono');
      await this.refreshAccessPanel();
      if (data.key) {
        this.showNewLink(AccessManager.buildShareUrl(projectId, data.key), 'Seu Link de Dono', 'Guarde este link seguro: por privacidade, a chave não será exibida novamente.');
      }
    } catch (e) {
      this.showNewLink('', 'Falha ao proteger projeto', e.message);
    }
  }

  async createInvite() {
    const projectId = this.getProjectId();
    const role = this.container.querySelector('#share-invite-role')?.value || 'editor';
    const email = (this.container.querySelector('#share-invite-email')?.value || '').trim();
    const btnInvite = this.container.querySelector('#btn-create-invite');
    
    if (btnInvite) btnInvite.setAttribute('disabled', 'true');
    try {
      const data = await AccessManager.createInvite(projectId, role, email);
      await this.refreshAccessPanel();
      this.showNewLink(
        AccessManager.buildInviteUrl(projectId, data.code),
        'Convite Criado com Sucesso',
        'Copie e envie o link abaixo para o colaborador realizar o cadastro (válido por 7 dias).'
      );
      const emailInput = this.container.querySelector('#share-invite-email');
      if (emailInput) {
        emailInput.value = '';
        emailInput.setAttribute('value', '');
      }
    } catch (e) {
      this.showNewLink('', 'Falha ao gerar convite', e.message);
    } finally {
      if (btnInvite) btnInvite.removeAttribute('disabled');
    }
  }

  async createShare() {
    const projectId = this.getProjectId();
    const role = this.container.querySelector('#share-new-role')?.value || 'viewer';
    const label = (this.container.querySelector('#share-new-label')?.value || '').trim();
    const btnShare = this.container.querySelector('#btn-create-share');

    if (btnShare) btnShare.setAttribute('disabled', 'true');
    try {
      const data = await AccessManager.createShare(projectId, role, label || 'Convidado');
      if (data && data.key) {
        AccessManager.cacheShareKey(projectId, role, data.key);
      }
      await this.refreshAccessPanel();
      const roleText = role === 'editor' ? 'Editor' : 'Leitor';
      this.showNewLink(
        AccessManager.buildShareUrl(projectId, data.key),
        `Link de ${roleText} Criado`,
        'Copie agora para compartilhar diretamente com quem não tem conta no sistema.'
      );
      const labelInput = this.container.querySelector('#share-new-label');
      if (labelInput) {
        labelInput.value = '';
        labelInput.setAttribute('value', '');
      }
    } catch (e) {
      this.showNewLink('', 'Falha ao gerar link', e.message);
    } finally {
      if (btnShare) btnShare.removeAttribute('disabled');
    }
  }

  showNewLink(url, title, subtitle = '') {
    const slot = this.container.querySelector('#cm-share-new-link');
    if (!slot) return;
    if (!url) {
      slot.innerHTML = `
        <div class="cm-share-banner is-open" style="border-color: rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.08); color: #fca5a5;">
          <span class="cm-share-banner-icon">⚠️</span>
          <span><b>${this.escapeHtml(title)}:</b> ${this.escapeHtml(subtitle)}</span>
        </div>`;
      return;
    }
    const safeUrl = this.escapeHtml(url);
    slot.innerHTML = `
      <div class="cm-share-flash-card">
        <div class="cm-share-flash-header">
          <span class="cm-share-flash-title">⚡ ${this.escapeHtml(title)}</span>
          <button id="btn-close-flash-card" style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 14px; padding: 2px 6px;">✕</button>
        </div>
        ${subtitle ? `<span class="cm-share-flash-hint">${this.escapeHtml(subtitle)}</span>` : ''}
        <div class="cm-share-hero-row" style="margin-top: 2px;">
          <ui-campo-texto value="${safeUrl}" readonly style="flex: 1; font-family: var(--cm-fonte-mono, monospace);"></ui-campo-texto>
          <ui-botao-primario 
            inline 
            variante="primary" 
            copiar-texto="${safeUrl}" 
            toast-sucesso="Novo link copiado com sucesso!"
            style="height: 34px; font-size: 11.5px; padding: 0 12px; flex-shrink: 0;">
            📋 Copiar Link
          </ui-botao-primario>
        </div>
      </div>`;

    slot.querySelector('#btn-close-flash-card')?.addEventListener('click', () => {
      slot.innerHTML = '';
    });
  }

  switchTab(tabKey) {
    this.activeTab = tabKey;
    const bodyAcessos = this.container.querySelector('#cm-tab-acessos');
    const bodyConvidar = this.container.querySelector('#cm-tab-convidar');
    const bodyEmbed = this.container.querySelector('#cm-tab-embed');

    if (bodyAcessos) bodyAcessos.style.display = tabKey === 'acessos' ? 'flex' : 'none';
    if (bodyConvidar) bodyConvidar.style.display = tabKey === 'convidar' ? 'flex' : 'none';
    if (bodyEmbed) bodyEmbed.style.display = tabKey === 'embed' ? 'flex' : 'none';
  }

  switchInviteType(type) {
    this.activeInviteType = type;
    const blockEmail = this.container.querySelector('#cm-invite-block-email');
    const blockLink = this.container.querySelector('#cm-invite-block-link');

    if (blockEmail) blockEmail.style.display = type === 'email' ? 'flex' : 'none';
    if (blockLink) blockLink.style.display = type === 'link' ? 'flex' : 'none';
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
    const projectName = this.getProjectName();

    this.container.innerHTML = `
      <ui-modal id="modal-share" titulo="Compartilhar Projeto em Nuvem" largura="580px">
        <div class="cm-share-container">

          <!-- Barra de Contexto: Nome do Projeto & Status de Conexão -->
          <div class="cm-share-topbar">
            <div class="cm-share-project-tag">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
              <span>${this.escapeHtml(projectName)}</span>
            </div>
            <div id="cm-share-sync-status" class="cm-share-sync-chip">
              ● Conectado ao MySQL Hostinger
            </div>
          </div>

          <!-- Hero Card: Link Principal & Cópia Rápida -->
          <div class="cm-share-hero-card">
            <div class="cm-share-hero-header">
              <span class="cm-share-hero-title">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
                Endereço de Acesso Direto
              </span>
              <div id="cm-share-badge-security" class="cm-share-hero-badges">
                <ui-badge variante="sucesso">🔒 Protegido</ui-badge>
              </div>
            </div>

            <div class="cm-share-hero-row">
              <ui-campo-texto 
                id="share-link-input" 
                value="${safeUrl}" 
                readonly 
                style="font-family: var(--cm-fonte-mono, monospace); font-size: 11.5px;">
              </ui-campo-texto>
              <ui-botao-primario 
                inline 
                id="btn-copy-share-link" 
                variante="primary" 
                class="cm-share-copy-btn" 
                copiar-texto="${safeUrl}" 
                toast-sucesso="Link do projeto copiado!">
                📋 Copiar
              </ui-botao-primario>
            </div>

            <div class="cm-share-hero-footer">
              <span>Sincronizado em tempo real com a nuvem Hostinger.</span>
              <ui-botao-primario 
                inline 
                id="btn-sync-before-share" 
                variante="secundario" 
                class="cm-share-sync-btn"
                title="Forçar salvamento manual agora">
                ☁️ Salvar Agora
              </ui-botao-primario>
            </div>
          </div>

          <!-- Banner de Status de Permissão Dinâmico -->
          <div id="cm-share-banner-slot"></div>

          <!-- Slot para exibição de link recém-criado -->
          <div id="cm-share-new-link"></div>

          <!-- Navegação por Abas Limpa com ui-segmented -->
          <div class="cm-share-segmented-wrap">
            <ui-segmented id="cm-share-tabs" tamanho="sm" largura-total valor="acessos">
              <span valor="acessos" id="cm-tab-label-acessos">👥 Quem Tem Acesso</span>
              <span valor="convidar">➕ Convidar / Novo Link</span>
              <span valor="embed">💻 Incorporar (Embed)</span>
            </ui-segmented>
          </div>

          <!-- ABA 1: Quem Tem Acesso -->
          <div id="cm-tab-acessos" class="cm-share-tab-body" style="display: flex;">
            <div id="cm-access-panel">
              <div class="cm-share-empty-state">
                <span>⏳ Carregando permissões do projeto…</span>
              </div>
            </div>
          </div>

          <!-- ABA 2: Convidar ou Gerar Novo Link -->
          <div id="cm-tab-convidar" class="cm-share-tab-body" style="display: none;">
            
            <!-- Sub-seletor do tipo de convite -->
            <div style="margin-bottom: 2px;">
              <ui-segmented id="cm-invite-type-selector" tamanho="sm" largura-total valor="email">
                <span valor="email">✉️ Por E-mail (Com Conta)</span>
                <span valor="link">🔗 Link Avulso (Sem Cadastro)</span>
              </ui-segmented>
            </div>

            <!-- Bloco 1: Convidar Colaborador com Conta -->
            <div id="cm-invite-block-email" class="cm-form-card" style="display: flex;">
              <div class="cm-form-header">
                <span class="cm-form-title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                  </svg>
                  Convidar Usuário Cadastrado
                </span>
                <span class="cm-form-desc">O colaborador receberá o convite associado à conta dele (válido por 7 dias).</span>
              </div>
              <div class="cm-form-grid">
                <ui-campo-texto 
                  id="share-invite-email" 
                  label="E-mail do Colaborador (opcional)" 
                  placeholder="exemplo@email.com" 
                  tipo="email">
                </ui-campo-texto>
                <ui-lista-flutuante id="share-invite-role" label="Permissão">
                  <option value="editor" selected>✏️ Editor</option>
                  <option value="viewer">👁️ Leitor</option>
                </ui-lista-flutuante>
              </div>
              <div class="cm-form-action-row">
                <ui-botao-primario inline id="btn-create-invite" variante="primary" style="height: 32px; font-size: 11.5px; padding: 0 14px;">
                  ✉️ Gerar Link de Convite
                </ui-botao-primario>
              </div>
            </div>

            <!-- Bloco 2: Link Direto para Convidados sem Conta -->
            <div id="cm-invite-block-link" class="cm-form-card" style="display: none;">
              <div class="cm-form-header">
                <span class="cm-form-title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                  </svg>
                  Link Direto com Chave (Sem Conta)
                </span>
                <span class="cm-form-desc">Gera um link seguro para visualização ou edição imediata no navegador, sem precisar de cadastro.</span>
              </div>
              <div class="cm-form-grid">
                <ui-campo-texto 
                  id="share-new-label" 
                  label="Para quem é este link?" 
                  placeholder="Ex: Engenharia de Campo, Fiscal, Cliente">
                </ui-campo-texto>
                <ui-lista-flutuante id="share-new-role" label="Permissão">
                  <option value="viewer" selected>👁️ Leitor</option>
                  <option value="editor">✏️ Editor</option>
                </ui-lista-flutuante>
              </div>
              <div class="cm-form-action-row">
                <ui-botao-primario inline id="btn-create-share" variante="secundario" style="height: 32px; font-size: 11.5px; padding: 0 14px;">
                  🔗 Gerar Link Direto
                </ui-botao-primario>
              </div>
            </div>

          </div>

          <!-- ABA 3: Incorporar Mapa (Iframe) -->
          <div id="cm-tab-embed" class="cm-share-tab-body" style="display: none;">
            <div class="cm-embed-card">
              <div class="cm-form-header">
                <span class="cm-form-title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="16 18 22 12 16 6"></polyline>
                    <polyline points="8 6 2 12 8 18"></polyline>
                  </svg>
                  Incorporar em Relatórios e Páginas Web
                </span>
                <span class="cm-form-desc">Insira este mapa interativo com suporte a pan, zoom e inspeção em relatórios HTML, intranets ou sites de clientes.</span>
              </div>
              <div class="cm-embed-preview">
                <span>&lt;iframe src="..." width="100%" height="600" frameborder="0"&gt;&lt;/iframe&gt;</span>
              </div>
              <div class="cm-share-hero-row">
                <ui-campo-texto 
                  id="share-iframe-code" 
                  value="${safeEmbed}" 
                  readonly 
                  style="font-family: var(--cm-fonte-mono, monospace); font-size: 11px;">
                </ui-campo-texto>
                <ui-botao-primario 
                  inline 
                  id="btn-copy-iframe-code" 
                  variante="primary" 
                  class="cm-share-copy-btn" 
                  copiar-texto="${safeEmbed}" 
                  toast-sucesso="Código HTML do Iframe copiado!">
                  📋 Copiar HTML
                </ui-botao-primario>
              </div>
            </div>
          </div>

        </div>

        <!-- Rodapé do Modal -->
        <div slot="rodape" class="cm-share-footer-wrap">
          <span class="cm-share-footer-sec">
            🔒 Transmissão SSL Criptografada
          </span>
          <ui-botao-primario inline variante="secundario" dismiss-modal style="height: 30px; font-size: 12px; padding: 0 16px;">
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
    const modal = this.container.querySelector('#modal-share');
    const statusChip = this.container.querySelector('#cm-share-sync-status');
    const btnSync = this.container.querySelector('#btn-sync-before-share');
    const inputLink = this.container.querySelector('#share-link-input');
    const copyBtn = this.container.querySelector('#btn-copy-share-link');
    const segmented = this.container.querySelector('#cm-share-tabs');
    const inviteTypeSegmented = this.container.querySelector('#cm-invite-type-selector');

    // Alternador de Abas Principais
    if (segmented) {
      const handleTab = (e) => {
        const val = e.detail?.valor || e.target?.value || e.target?.valor;
        if (val) this.switchTab(val);
      };
      segmented.addEventListener('ui-change', handleTab);
      segmented.addEventListener('change', handleTab);
    }

    // Alternador de Tipo de Convite (Sub-aba)
    if (inviteTypeSegmented) {
      const handleInviteType = (e) => {
        const val = e.detail?.valor || e.target?.value || e.target?.valor;
        if (val) this.switchInviteType(val);
      };
      inviteTypeSegmented.addEventListener('ui-change', handleInviteType);
      inviteTypeSegmented.addEventListener('change', handleInviteType);
    }

    // Ações de criação de convite e link
    this.container.querySelector('#btn-create-invite')?.addEventListener('click', () => this.createInvite());
    this.container.querySelector('#btn-create-share')?.addEventListener('click', () => this.createShare());

    // Evento ao abrir o modal
    modal?.addEventListener('ui-abrir', async () => {
      if (typeof this.onSyncBeforeShare === 'function') {
        if (statusChip) {
          statusChip.className = 'cm-share-sync-chip is-saving';
          statusChip.textContent = '⏳ Sincronizando...';
        }
        try {
          const res = await this.onSyncBeforeShare();
          if (res && res.success && statusChip) {
            statusChip.className = 'cm-share-sync-chip';
            statusChip.textContent = '● Conectado ao MySQL Hostinger';
          }
        } catch {}
      }
      await this.refreshAccessPanel();
    });

    // Botão de Sincronização Manual
    if (btnSync) {
      btnSync.addEventListener('click', async () => {
        if (typeof this.onSyncBeforeShare === 'function') {
          if (statusChip) {
            statusChip.className = 'cm-share-sync-chip is-saving';
            statusChip.textContent = '⏳ Salvando no MySQL...';
          }
          btnSync.setAttribute('disabled', 'true');
          try {
            const res = await this.onSyncBeforeShare();
            if (res && res.success) {
              if (statusChip) {
                statusChip.className = 'cm-share-sync-chip';
                statusChip.textContent = '✓ 100% Salvo na Nuvem';
              }
              const updatedUrl = this.getShareUrl();
              if (inputLink) inputLink.setAttribute('value', updatedUrl);
              if (copyBtn) copyBtn.setAttribute('copiar-texto', updatedUrl);
            } else {
              if (statusChip) {
                statusChip.className = 'cm-share-sync-chip is-error';
                statusChip.textContent = '⚠️ Falha: ' + (res?.error || 'Erro de rede');
              }
            }
          } catch (e) {
            if (statusChip) {
              statusChip.className = 'cm-share-sync-chip is-error';
              statusChip.textContent = '⚠️ Erro ao sincronizar';
            }
          } finally {
            btnSync.removeAttribute('disabled');
          }
        }
      });
    }
  }

  /**
   * Ajusta os estilos internos do Shadow DOM do ui-modal para proporções confortáveis
   */
  applyCompactModalStyles() {
    const modal = this.container.querySelector('#modal-share');
    if (modal && modal.shadowRoot) {
      const style = document.createElement('style');
      style.textContent = `
        .ui-modal__dialog {
          max-width: 580px !important;
          width: 95vw !important;
          border-radius: 12px !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.7), 0 4px 16px rgba(0, 224, 138, 0.06) !important;
          overflow: hidden !important;
        }
        .ui-modal__header {
          padding: 11px 18px !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
          background: rgba(255, 255, 255, 0.02) !important;
        }
        .ui-modal__titulo {
          font-size: 14px !important;
          font-weight: 600 !important;
          letter-spacing: -0.2px !important;
        }
        .ui-modal__close {
          font-size: 13px !important;
          padding: 2px 6px !important;
        }
        .ui-modal__body {
          padding: 16px 18px !important;
          max-height: calc(85vh - 110px) !important;
          overflow-y: auto !important;
          scrollbar-width: thin !important;
          scrollbar-color: rgba(255, 255, 255, 0.18) transparent !important;
        }
        .ui-modal__body::-webkit-scrollbar {
          width: 6px !important;
        }
        .ui-modal__body::-webkit-scrollbar-track {
          background: transparent !important;
        }
        .ui-modal__body::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.18) !important;
          border-radius: 3px !important;
        }
        .ui-modal__body::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.28) !important;
        }
        .ui-modal__footer {
          padding: 9px 18px !important;
          border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
          background: rgba(255, 255, 255, 0.015) !important;
        }
      `;
      modal.shadowRoot.appendChild(style);
    }
  }
}
