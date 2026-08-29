/* ==========================================================================
   ConecteMapas - ProjectTemplatesModal Component (SRP Module)
   Responsabilidade Única: Apresentação e seleção de templates pré-configurados
   de projetos temáticos de engenharia, topografia, meio ambiente e urbanismo.
   ========================================================================== */

import './ProjectTemplatesModal.css';
import { PROJECT_TEMPLATES } from '../../services/MockData.js';

export class ProjectTemplatesModal {
  /**
   * @param {Object} options
   * @param {Function} options.onSelectTemplate - Callback ao escolher um modelo
   */
  constructor(options = {}) {
    this.onSelectTemplate = options.onSelectTemplate || (() => {});
    this.container = null;
  }

  /**
   * Renderiza o modal de templates
   * @param {HTMLElement} container
   */
  render(container) {
    this.container = container;
    this.container.innerHTML = `
      <ui-modal id="modal-templates" titulo="📁 Modelos de Projeto">
        <div class="cm-templates-container">
          <p class="cm-templates-subtitle">
            Selecione um preset para configurar instantaneamente camadas, simbologias e enquadramento geográfico:
          </p>

          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${PROJECT_TEMPLATES.map(tpl => `
              <div class="cm-template-card" data-template-id="${tpl.id}">
                <!-- Topo: Ícone, Título, Badge e Botão Carregar -->
                <div class="cm-template-card-top">
                  <div class="cm-template-card-title-group">
                    <div class="cm-template-icon">${tpl.icon || '📐'}</div>
                    <span class="cm-template-title">${tpl.title}</span>
                    <span class="cm-template-badge">${tpl.badge}</span>
                  </div>

                  <ui-botao-primario 
                    inline 
                    variante="primary" 
                    class="cm-template-load-btn" 
                    data-btn-template="${tpl.id}" 
                    dismiss-modal>
                    Carregar
                  </ui-botao-primario>
                </div>

                <!-- Descrição -->
                <p class="cm-template-desc">${tpl.description}</p>

                <!-- Linha de Camadas Pré-configuradas -->
                <div class="cm-template-layers-row">
                  ${tpl.layers.map(l => `
                    <span class="cm-template-layer-tag">
                      <span class="cm-template-layer-dot" style="background-color: ${l.color};"></span>
                      ${l.name}
                    </span>
                  `).join('')}
                </div>
              </div>
            `).join('')}
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
    this.bindEvents();
  }

  /**
   * Ajusta os estilos internos do Shadow DOM do ui-modal para cabeçalho baixo e bordas equilibradas
   */
  applyCompactModalStyles() {
    const modal = this.container.querySelector('#modal-templates');
    if (modal && modal.shadowRoot) {
      const style = document.createElement('style');
      style.textContent = `
        .ui-modal__dialog {
          max-width: 600px !important;
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

  /**
   * Vincula eventos de seleção dos templates
   */
  bindEvents() {
    if (!this.container) return;

    // Clique no botão "Carregar"
    this.container.querySelectorAll('[data-btn-template]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-btn-template');
        this.selectTemplateById(id);
      });
    });

    // Clique no card completo
    this.container.querySelectorAll('.cm-template-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-template-id');
        this.selectTemplateById(id);
        const modal = document.getElementById('modal-templates');
        if (modal && modal.fechar) modal.fechar();
      });
    });
  }

  /**
   * Executa a seleção do template por ID
   * @param {string} id
   */
  selectTemplateById(id) {
    const tpl = PROJECT_TEMPLATES.find(t => t.id === id);
    if (tpl) {
      this.onSelectTemplate(tpl);
    }
  }
}
