/* ==========================================================================
   ConecteMapas - NewLayerModal Component
   Modal de criação de nova camada vetorial com thibezer/Componentes-UI
   ========================================================================== */

import './NewLayerModal.css';

const DEFAULT_PALETTE = [
  '#00E08A', // Verde ConecteMapas
  '#38bdf8', // Azul Celeste
  '#f59e0b', // Âmbar Topografia
  '#ec4899', // Rosa Destaque
  '#8b5cf6', // Roxo Geodésico
  '#ef4444', // Vermelho Alerta
  '#10b981', // Verde Florestal
  '#06b6d4', // Ciano Hidrografia
  '#f97316'  // Laranja Construção
];

export class NewLayerModal {
  constructor(options = {}) {
    this.onSave = options.onSave || (() => {});
    this.container = null;
    this.selectedColor = '#00E08A';
  }

  render(container) {
    this.container = container;
    this.container.innerHTML = `
      <ui-modal id="modal-new-layer" titulo="📁 Nova Camada Vetorial">
        <form id="form-new-layer" style="display: flex; flex-direction: column; gap: 16px;">
          <ui-campo-texto 
            id="new-layer-name" 
            name="name" 
            label="Nome da Camada" 
            placeholder="Ex: Divisas, Curvas de Nível, APP, Infraestrutura..." 
            obrigatorio>
          </ui-campo-texto>

          <div style="display: flex; flex-direction: column; gap: 6px;">
            <span style="font-size: 12px; color: var(--cm-text-muted, #94a3b8); font-weight: 500;">
              Cor Padrão e Simbologia
            </span>
            
            <div class="cm-new-layer-palette" id="new-layer-palette">
              ${DEFAULT_PALETTE.map((c, i) => `
                <button type="button" 
                  class="cm-new-layer-swatch ${i === 0 ? 'active' : ''}" 
                  data-color="${c}" 
                  style="background-color: ${c};" 
                  title="Selecionar cor ${c}">
                </button>
              `).join('')}
            </div>

            <div class="cm-new-layer-color-custom">
              <input type="color" id="new-layer-color" class="cm-new-layer-color-input" value="#00E08A" title="Personalizar cor" />
              <div style="display: flex; flex-direction: column;">
                <span style="font-size: 11px; color: var(--cm-text-muted, #94a3b8);">Cor Hexadecimal:</span>
                <span id="new-layer-hex" class="cm-new-layer-hex-badge">#00E08A</span>
              </div>
            </div>
          </div>
        </form>

        <div slot="rodape" style="display: flex; justify-content: flex-end; gap: 8px;">
          <ui-botao-primario inline variante="secundario" dismiss-modal style="height: 32px; font-size: 12px; padding: 0 14px;">
            Cancelar
          </ui-botao-primario>
          <ui-botao-primario inline id="btn-save-new-layer" variante="primary" style="height: 32px; font-size: 12px; padding: 0 16px;">
            Criar Camada
          </ui-botao-primario>
        </div>
      </ui-modal>
    `;

    this.bindEvents();
    this.applyCompactModalStyles();
  }

  open(defaultName = '') {
    const nameInput = document.getElementById('new-layer-name');
    const colorInput = document.getElementById('new-layer-color');
    const hexSpan = document.getElementById('new-layer-hex');

    if (nameInput) {
      nameInput.value = defaultName;
    }

    // Escolhe uma cor inicial variada
    const randomColor = DEFAULT_PALETTE[Math.floor(Math.random() * DEFAULT_PALETTE.length)];
    this.setColor(randomColor);

    const modal = document.getElementById('modal-new-layer');
    if (modal && modal.abrir) {
      modal.abrir();
      setTimeout(() => {
        if (nameInput && nameInput.focus) nameInput.focus();
      }, 150);
    }
  }

  setColor(color) {
    this.selectedColor = color;
    const colorInput = document.getElementById('new-layer-color');
    const hexSpan = document.getElementById('new-layer-hex');

    if (colorInput) colorInput.value = color;
    if (hexSpan) hexSpan.textContent = color.toUpperCase();

    if (this.container) {
      this.container.querySelectorAll('.cm-new-layer-swatch').forEach(swatch => {
        swatch.classList.toggle('active', swatch.getAttribute('data-color').toLowerCase() === color.toLowerCase());
      });
    }
  }

  bindEvents() {
    const modal = this.container.querySelector('#modal-new-layer');
    const form = this.container.querySelector('#form-new-layer');
    const btnSave = this.container.querySelector('#btn-save-new-layer');
    const nameInput = this.container.querySelector('#new-layer-name');
    const colorInput = this.container.querySelector('#new-layer-color');

    // Cliques na paleta rápida
    this.container.querySelectorAll('.cm-new-layer-swatch').forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        e.preventDefault();
        const color = swatch.getAttribute('data-color');
        this.setColor(color);
      });
    });

    // Mudança no input type="color" customizado
    if (colorInput) {
      colorInput.addEventListener('input', (e) => {
        this.setColor(e.target.value);
      });
    }

    const handleSave = (e) => {
      if (e) e.preventDefault();
      const name = nameInput ? nameInput.value.trim() : '';
      if (!name) {
        if (nameInput && nameInput.focus) nameInput.focus();
        return;
      }

      this.onSave({
        name,
        color: this.selectedColor || '#00E08A'
      });

      if (modal && modal.fechar) modal.fechar();
    };

    if (btnSave) btnSave.addEventListener('click', handleSave);
    if (form) form.addEventListener('submit', handleSave);
  }

  applyCompactModalStyles() {
    const modal = this.container.querySelector('#modal-new-layer');
    if (modal && modal.shadowRoot) {
      const style = document.createElement('style');
      style.textContent = `
        .ui-modal__dialog {
          max-width: 440px !important;
          border-radius: 10px !important;
        }
        .ui-modal__header {
          padding: 10px 16px !important;
        }
        .ui-modal__titulo {
          font-size: 14px !important;
          font-weight: 600 !important;
        }
        .ui-modal__body {
          padding: 14px 16px !important;
        }
        .ui-modal__footer {
          padding: 8px 16px !important;
        }
      `;
      modal.shadowRoot.appendChild(style);
    }
  }
}
