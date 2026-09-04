/* ==========================================================================
   ConecteMapas - ShareModal Component (SRP Module)
   Responsabilidade Única: Gerenciamento do modal de compartilhamento
   da sessão colaborativa em tempo real, links diretos, permissões e embed.
   ========================================================================== */

import './ShareModal.css';

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
            <span>Qualquer pessoa com este link acessará o mapa com todas as camadas e feições salvas no MySQL da Hostinger.</span>
          </div>

          <!-- Seção: Sincronização & Link Direto -->
          <div class="cm-share-section">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span class="cm-share-label">Link do Projeto Público</span>
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

          <!-- Seção: Permissões de Acesso -->
          <div class="cm-share-section">
            <span class="cm-share-label">Nível de Acesso Padrão</span>
            <ui-lista-flutuante id="share-permission-select" label="Permissão">
              <option value="editor" selected>✏️ Editor (Pode visualizar, desenhar e exportar)</option>
              <option value="viewer">👁️ Leitor (Apenas visualização)</option>
            </ui-lista-flutuante>
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
  }

  bindEvents() {
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
