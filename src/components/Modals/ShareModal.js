/* ==========================================================================
   ConecteMapas - ShareModal Component (SRP Module)
   Responsabilidade Única: Gerenciamento do modal de compartilhamento
   da sessão colaborativa em tempo real, links diretos, permissões e embed.
   ========================================================================== */

import './ShareModal.css';

export class ShareModal {
  constructor() {
    this.container = null;
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

  /**
   * Renderiza o modal de compartilhamento
   * @param {HTMLElement} container
   */
  render(container) {
    this.container = container;
    const currentUrl = window.location.href;
    const safeUrl = this.escapeHtml(currentUrl);
    const rawEmbed = `<iframe src="${currentUrl}" width="100%" height="600" frameborder="0"></iframe>`;
    const safeEmbed = this.escapeHtml(rawEmbed);

    this.container.innerHTML = `
      <ui-modal id="modal-share" titulo="🔗 Compartilhar Sessão">
        <div class="cm-share-container">
          <!-- Banner Informativo Compacto -->
          <div class="cm-share-banner">
            <span class="cm-share-banner-icon">✓</span>
            <span>Qualquer pessoa com o link poderá visualizar e colaborar no mapa em tempo real.</span>
          </div>

          <!-- Seção: Link Direto da Sala -->
          <div class="cm-share-section">
            <span class="cm-share-label">Link da Sessão Colaborativa</span>
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

          <div class="cm-share-divider"></div>

          <!-- Seção: Permissões de Acesso -->
          <div class="cm-share-section">
            <span class="cm-share-label">Nível de Acesso Padrão</span>
            <ui-lista-flutuante id="share-permission-select" label="Permissão">
              <option value="editor" selected>✏️ Editor (Pode desenhar e editar geometrias)</option>
              <option value="viewer">👁️ Leitor (Apenas visualização)</option>
              <option value="admin">⭐ Administrador (Acesso total)</option>
            </ui-lista-flutuante>
          </div>

          <div class="cm-share-divider"></div>

          <!-- Seção: Código Embed (Iframe) -->
          <div class="cm-share-section">
            <span class="cm-share-label">Incorporar no seu Site (Iframe)</span>
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

    this.applyCompactModalStyles();
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
