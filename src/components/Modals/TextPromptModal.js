/* ==========================================================================
   ConecteMapas - TextPromptModal Component
   Modal profissional para inserção e parametrização de textos/rótulos no mapa
   ========================================================================== */

import './TextPromptModal.css';
import { normalizeFeature } from '../../services/MockData.js';

export class TextPromptModal {
  constructor(options = {}) {
    this.layers = options.layers || [];
    this.activeLayerId = options.activeLayerId || (this.layers[0]?.id || null);
    this.pendingLatLng = null;
    this.onSave = options.onSave || (() => {});
    this.onCancel = options.onCancel || (() => {});

    // Estado do estilo do texto
    this.currentFontSize = 14;
    this.currentTextColor = '#ffffff';
    this.currentBgStyle = 'dark'; // 'dark' | 'transparent' | 'light'
    this.currentBorderColor = 'rgba(255, 255, 255, 0.25)';
  }

  setActiveLayerId(layerId) {
    this.activeLayerId = layerId;
    const select = document.getElementById('text-feat-layer');
    if (select && layerId) {
      select.value = layerId;
    }
  }

  updateLayers(layers) {
    this.layers = layers || [];
    const select = document.getElementById('text-feat-layer');
    if (select) {
      select.innerHTML = this.layers.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
    }
  }

  render(container) {
    container.innerHTML = `
      <ui-modal id="modal-text-prompt" titulo="🔤 Inserir Texto / Rótulo no Mapa">
        <div class="cm-text-modal-content">
          <ui-campo-texto 
            id="text-feat-input" 
            name="text" 
            label="Conteúdo do Rótulo" 
            placeholder="Ex: Área de Preservação, Gleba B, Marco de Divisa..." 
            obrigatorio>
          </ui-campo-texto>

          <div class="cm-text-style-grid">
            <ui-lista-flutuante id="text-feat-size" name="size" label="Tamanho da Fonte">
              <option value="11">11px - Pequeno / Cota</option>
              <option value="14" selected>14px - Padrão</option>
              <option value="18">18px - Médio / Destaque</option>
              <option value="22">22px - Grande / Título</option>
              <option value="28">28px - Extra Grande</option>
            </ui-lista-flutuante>

            <ui-lista-flutuante id="text-feat-bg" name="bgStyle" label="Estilo de Fundo">
              <option value="dark" selected>Escuro Translúcido (Ideal Satélite)</option>
              <option value="transparent">Transparente (Apenas Texto)</option>
              <option value="light">Fundo Branco Claro</option>
            </ui-lista-flutuante>
          </div>

          <div>
            <label style="font-size: 12px; color: var(--cm-text-muted, #94a3b8); font-weight: 500; display: block; margin-bottom: 4px;">
              Cor do Texto
            </label>
            <div class="cm-color-presets-row" id="text-color-presets">
              <button type="button" class="cm-color-swatch active" data-color="#ffffff" style="background: #ffffff;" title="Branco"></button>
              <button type="button" class="cm-color-swatch" data-color="#facc15" style="background: #facc15;" title="Amarelo"></button>
              <button type="button" class="cm-color-swatch" data-color="#38bdf8" style="background: #38bdf8;" title="Ciano"></button>
              <button type="button" class="cm-color-swatch" data-color="#00E08A" style="background: #00E08A;" title="Verde Esmeralda"></button>
              <button type="button" class="cm-color-swatch" data-color="#fb923c" style="background: #fb923c;" title="Laranja"></button>
              <button type="button" class="cm-color-swatch" data-color="#f87171" style="background: #f87171;" title="Vermelho"></button>
              <button type="button" class="cm-color-swatch" data-color="#c084fc" style="background: #c084fc;" title="Roxo Claro"></button>
            </div>
          </div>

          <ui-lista-flutuante id="text-feat-layer" name="layerId" label="Camada de Destino">
            ${this.layers.map(l => `
              <option value="${l.id}">${l.name}</option>
            `).join('')}
          </ui-lista-flutuante>

          <div>
            <span style="font-size: 11px; color: var(--cm-text-muted, #94a3b8); display: block; margin-bottom: 4px;">
              Pré-visualização no mapa:
            </span>
            <div class="cm-text-preview-box">
              <div id="text-preview-badge" class="cm-map-text-badge" style="font-size: 14px; color: #ffffff; background: rgba(15, 23, 42, 0.88); border-color: rgba(255, 255, 255, 0.25);">
                Texto de Exemplo
              </div>
            </div>
          </div>
        </div>

        <div slot="rodape" style="display: flex; justify-content: flex-end; gap: 8px;">
          <ui-botao-primario inline variante="secundario" id="btn-cancel-text" dismiss-modal style="height: 30px;">
            Cancelar
          </ui-botao-primario>
          <ui-botao-primario inline id="btn-save-text" variante="primary" style="height: 30px;">
            Inserir no Mapa
          </ui-botao-primario>
        </div>
      </ui-modal>
    `;

    this.bindEvents(container);
  }

  updatePreview() {
    const textInput = document.getElementById('text-feat-input');
    const previewEl = document.getElementById('text-preview-badge');
    if (!previewEl) return;

    const text = textInput?.value?.trim() || 'Texto de Exemplo';
    previewEl.textContent = text;
    previewEl.style.fontSize = `${this.currentFontSize}px`;
    previewEl.style.color = this.currentTextColor;

    if (this.currentBgStyle === 'dark') {
      previewEl.style.background = 'rgba(15, 23, 42, 0.88)';
      previewEl.style.borderColor = 'rgba(255, 255, 255, 0.25)';
      previewEl.classList.remove('cm-map-text-halo');
    } else if (this.currentBgStyle === 'transparent') {
      previewEl.style.background = 'transparent';
      previewEl.style.borderColor = 'transparent';
      previewEl.classList.add('cm-map-text-halo');
    } else if (this.currentBgStyle === 'light') {
      previewEl.style.background = 'rgba(255, 255, 255, 0.92)';
      previewEl.style.borderColor = 'rgba(0, 0, 0, 0.2)';
      previewEl.style.color = this.currentTextColor === '#ffffff' ? '#0f172a' : this.currentTextColor;
      previewEl.classList.remove('cm-map-text-halo');
    }
  }

  openWithLocation(latlng) {
    this.pendingLatLng = latlng;
    const textInput = document.getElementById('text-feat-input');
    if (textInput) {
      textInput.value = '';
    }

    const layerSelect = document.getElementById('text-feat-layer');
    if (layerSelect && this.activeLayerId) {
      layerSelect.value = this.activeLayerId;
    }

    this.updatePreview();

    const modal = document.getElementById('modal-text-prompt');
    if (modal && modal.abrir) {
      modal.abrir();
      setTimeout(() => {
        const inputInner = textInput?.shadowRoot?.querySelector('input') || textInput;
        if (inputInner && typeof inputInner.focus === 'function') {
          inputInner.focus();
        }
      }, 120);
    }
  }

  bindEvents(container) {
    const modal = container.querySelector('#modal-text-prompt');
    const textInput = container.querySelector('#text-feat-input');
    const sizeSelect = container.querySelector('#text-feat-size');
    const bgSelect = container.querySelector('#text-feat-bg');
    const colorSwatches = container.querySelectorAll('.cm-color-swatch');
    const btnSave = container.querySelector('#btn-save-text');
    const btnCancel = container.querySelector('#btn-cancel-text');

    if (textInput) {
      textInput.addEventListener('input', () => this.updatePreview());
      textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleSave();
        }
      });
    }

    if (sizeSelect) {
      sizeSelect.addEventListener('change', (e) => {
        this.currentFontSize = Number(e.target.value) || 14;
        this.updatePreview();
      });
    }

    if (bgSelect) {
      bgSelect.addEventListener('change', (e) => {
        this.currentBgStyle = e.target.value || 'dark';
        this.updatePreview();
      });
    }

    colorSwatches.forEach(swatch => {
      swatch.addEventListener('click', () => {
        colorSwatches.forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        this.currentTextColor = swatch.dataset.color || '#ffffff';
        this.updatePreview();
      });
    });

    if (btnSave) {
      btnSave.addEventListener('click', () => this.handleSave());
    }

    if (btnCancel) {
      btnCancel.addEventListener('click', () => {
        if (this.onCancel) this.onCancel();
      });
    }

    if (modal) {
      modal.addEventListener('ui-modal-fechar', () => {
        if (this.onCancel) this.onCancel();
      });
    }
  }

  handleSave() {
    const textInput = document.getElementById('text-feat-input');
    const layerSelect = document.getElementById('text-feat-layer');
    const text = textInput?.value?.trim() || 'Texto no Mapa';
    const targetLayerId = layerSelect?.value || this.activeLayerId || this.layers[0]?.id;

    if (!this.pendingLatLng) return;

    let bgColor = 'rgba(15, 23, 42, 0.88)';
    let borderColor = 'rgba(255, 255, 255, 0.25)';
    let textColor = this.currentTextColor;
    let hasHalo = false;

    if (this.currentBgStyle === 'transparent') {
      bgColor = 'transparent';
      borderColor = 'transparent';
      hasHalo = true;
    } else if (this.currentBgStyle === 'light') {
      bgColor = 'rgba(255, 255, 255, 0.92)';
      borderColor = 'rgba(0, 0, 0, 0.2)';
      if (textColor === '#ffffff') textColor = '#0f172a';
    }

    const textFeature = normalizeFeature({
      id: 'feat-text-' + Date.now(),
      type: 'Text',
      coordinates: this.pendingLatLng,
      name: text,
      category: 'Anotação / Rótulo',
      layerId: targetLayerId,
      color: textColor,
      properties: {
        text: text,
        'Tipo': 'Rótulo Cartográfico'
      },
      style: {
        fontSize: this.currentFontSize,
        textColor: textColor,
        backgroundColor: bgColor,
        borderColor: borderColor,
        halo: hasHalo,
        markerSize: 20
      },
      createdBy: 'Você',
      createdAt: new Date().toISOString()
    });

    this.onSave(textFeature);

    const modal = document.getElementById('modal-text-prompt');
    if (modal && modal.fechar) modal.fechar();
  }
}
