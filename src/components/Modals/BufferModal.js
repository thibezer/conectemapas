/* ==========================================================================
   ConecteMapas - BufferModal Component
   Modal profissional para parametrização e geração de zonas de amortecimento (Buffer)
   Suporta aplicação em feição única ou em múltiplos objetos por vez,
   com escolha flexível da camada de destino.
   ========================================================================== */

import './BufferModal.css';
import { UIToast } from '@thibezer/ui-components-kit';

export class BufferModal {
  /**
   * @param {Object} options
   * @param {Object} [options.app] Instância da aplicação ConecteMapas
   * @param {Function} [options.getLayers] Função que retorna a lista de camadas
   * @param {Function} [options.onApply] Callback (targets, radius, targetLayerId, newLayerOptions) => void
   */
  constructor(options = {}) {
    this.app = options.app || null;
    this.getLayers = options.getLayers || (() => this.app?.layers || []);
    this.onApply = options.onApply || (() => {});

    this.targets = [];
    this.currentRadius = 50;
    this.container = null;
  }

  /**
   * Atualiza a lista de camadas no dropdown
   * @param {Array} [layers]
   * @param {string} [preferredLayerId]
   */
  updateLayers(layers = null, preferredLayerId = null) {
    const list = layers || this.getLayers();
    const select = document.getElementById('buffer-target-layer');
    if (!select) return;

    let html = `<option value="__same__">◎ Mesma camada de cada objeto de origem</option>`;
    for (const l of list) {
      const name = l.name || 'Camada sem nome';
      html += `<option value="${l.id}">📁 ${name}</option>`;
    }
    html += `<option value="__new__">➕ Criar em uma Nova Camada...</option>`;

    select.innerHTML = html;

    if (preferredLayerId) {
      select.value = preferredLayerId;
    }
    this._handleLayerSelectionChange();
  }

  render(container) {
    this.container = container;
    container.innerHTML = `
      <ui-modal id="modal-buffer" titulo="◎ Gerar Zona de Amortecimento (Buffer)">
        <div class="cm-buffer-modal-content">
          <!-- Card de Resumo dos Alvos Selecionados -->
          <div class="cm-buffer-summary-card">
            <div class="cm-buffer-summary-icon">🛡️</div>
            <div class="cm-buffer-summary-text">
              <span class="cm-buffer-summary-title" id="buffer-summary-title">
                1 feição selecionada
              </span>
              <span class="cm-buffer-summary-desc" id="buffer-summary-desc">
                Cria um polígono envoltório com raio geodésico exato (GRS80).
              </span>
            </div>
          </div>

          <!-- Configuração do Raio / Distância -->
          <div class="cm-buffer-radius-group">
            <ui-campo-texto
              id="buffer-modal-radius"
              name="radius"
              label="Distância / Raio do Buffer (em metros)"
              placeholder="50"
              type="number"
              step="any"
              min="0.1"
              value="50"
              obrigatorio>
            </ui-campo-texto>

            <!-- Chips de Distância Rápida -->
            <div class="cm-buffer-quick-chips" id="buffer-quick-chips">
              <span style="font-size: 11px; color: var(--cm-text-muted, #94a3b8); margin-right: 4px;">Atalhos:</span>
              <button type="button" class="cm-chip-btn" data-radius="5">5 m</button>
              <button type="button" class="cm-chip-btn" data-radius="10">10 m</button>
              <button type="button" class="cm-chip-btn" data-radius="20">20 m</button>
              <button type="button" class="cm-chip-btn" data-radius="30">30 m</button>
              <button type="button" class="cm-chip-btn active" data-radius="50">50 m</button>
              <button type="button" class="cm-chip-btn" data-radius="100">100 m</button>
              <button type="button" class="cm-chip-btn" data-radius="200">200 m</button>
            </div>
          </div>

          <!-- Seleção da Camada de Destino -->
          <div class="cm-buffer-layer-group">
            <ui-lista-flutuante id="buffer-target-layer" name="targetLayer" label="Camada de Destino">
              <option value="__same__">◎ Mesma camada de cada objeto de origem</option>
            </ui-lista-flutuante>

            <!-- Campo dinâmico para criação de nova camada -->
            <div id="buffer-new-layer-box" class="cm-buffer-new-layer-box" style="display: none;">
              <ui-campo-texto
                id="buffer-new-layer-name"
                label="Nome da Nova Camada"
                placeholder="Ex: Zonas de Amortecimento, Faixa de Segurança...">
              </ui-campo-texto>
            </div>
          </div>
        </div>

        <div slot="rodape" style="display: flex; justify-content: flex-end; gap: 8px;">
          <ui-botao-primario inline variante="secundario" id="btn-cancel-buffer" dismiss-modal style="height: 32px;">
            Cancelar
          </ui-botao-primario>
          <ui-botao-primario inline id="btn-confirm-buffer" variante="primary" style="height: 32px;">
            Gerar Buffer
          </ui-botao-primario>
        </div>
      </ui-modal>
    `;

    this._bindEvents(container);
  }

  /**
   * Abre o modal com os alvos especificados.
   * @param {Object|Object[]} rawTargets
   * @param {number} [initialRadius=50]
   */
  open(rawTargets = [], initialRadius = 50) {
    const list = Array.isArray(rawTargets) ? rawTargets : (rawTargets ? [rawTargets] : []);
    this.targets = list.filter(f => f && f.locked !== true);

    if (this.targets.length === 0) {
      UIToast.notificar({
        tipo: 'alerta',
        titulo: 'Buffer',
        mensagem: 'Nenhuma feição válida e desbloqueada selecionada para gerar buffer.',
        duracao: 3500
      });
      return;
    }

    this.currentRadius = Number.isFinite(initialRadius) && initialRadius > 0 ? initialRadius : 50;

    // 1. Atualiza resumo visual dos alvos
    const titleEl = document.getElementById('buffer-summary-title');
    const descEl = document.getElementById('buffer-summary-desc');
    const layers = this.getLayers();

    if (this.targets.length === 1) {
      const feat = this.targets[0];
      const layer = layers.find(l => l.id === feat.layerId);
      const layerName = layer?.name || 'Camada padrão';
      if (titleEl) titleEl.textContent = `1 objeto selecionado: "${feat.name || 'Feição'}"`;
      if (descEl) descEl.textContent = `Tipo: ${feat.type || 'Geometria'} • Camada atual: ${layerName}`;
    } else {
      const countsByType = {};
      for (const f of this.targets) {
        const t = f.type || 'Outro';
        countsByType[t] = (countsByType[t] || 0) + 1;
      }
      const typeSummary = Object.entries(countsByType)
        .map(([k, v]) => `${v} ${k.toLowerCase()}`)
        .join(', ');

      if (titleEl) titleEl.textContent = `${this.targets.length} objetos selecionados`;
      if (descEl) descEl.textContent = `Será gerado 1 buffer para cada feição (${typeSummary}).`;
    }

    // 2. Atualiza input de raio e chips
    const radiusInput = document.getElementById('buffer-modal-radius');
    if (radiusInput) {
      radiusInput.value = String(this.currentRadius);
    }
    this._updateActiveChip(this.currentRadius);

    // 3. Atualiza dropdown de camadas
    // Se todos os alvos pertencem à mesma camada, pré-seleciona ela; senão escolhe '__same__'
    let preferredLayer = '__same__';
    const firstLayerId = this.targets[0]?.layerId;
    if (firstLayerId && this.targets.every(f => f.layerId === firstLayerId)) {
      preferredLayer = firstLayerId;
    }
    this.updateLayers(layers, preferredLayer);

    // 4. Abre o modal
    const modal = document.getElementById('modal-buffer');
    if (modal && typeof modal.abrir === 'function') {
      modal.abrir();
      setTimeout(() => {
        const inputInner = radiusInput?.shadowRoot?.querySelector('input') || radiusInput;
        if (inputInner && typeof inputInner.focus === 'function') {
          inputInner.focus();
          if (typeof inputInner.select === 'function') inputInner.select();
        }
      }, 50);
    }
  }

  _bindEvents(container) {
    const btnConfirm = container.querySelector('#btn-confirm-buffer');
    const radiusInput = container.querySelector('#buffer-modal-radius');
    const layerSelect = container.querySelector('#buffer-target-layer');
    const chipsContainer = container.querySelector('#buffer-quick-chips');

    // Chips de raio rápido
    if (chipsContainer) {
      chipsContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.cm-chip-btn');
        if (!btn) return;
        const r = parseFloat(btn.dataset.radius);
        if (Number.isFinite(r) && r > 0) {
          this.currentRadius = r;
          if (radiusInput) radiusInput.value = String(r);
          this._updateActiveChip(r);
        }
      });
    }

    // Input manual de raio
    if (radiusInput) {
      const handleInput = () => {
        const val = parseFloat(String(radiusInput.value).trim().replace(',', '.'));
        if (Number.isFinite(val) && val > 0) {
          this.currentRadius = val;
          this._updateActiveChip(val);
        }
      };
      radiusInput.addEventListener('input', handleInput);
      radiusInput.addEventListener('change', handleInput);
    }

    // Troca de camada no dropdown
    if (layerSelect) {
      layerSelect.addEventListener('change', () => this._handleLayerSelectionChange());
    }

    // Clique em Confirmar
    if (btnConfirm) {
      btnConfirm.addEventListener('click', () => this._handleConfirm());
    }
  }

  _updateActiveChip(radius) {
    const chips = this.container?.querySelectorAll('.cm-chip-btn') || [];
    chips.forEach(c => {
      const chipRadius = parseFloat(c.dataset.radius);
      if (Math.abs(chipRadius - radius) < 1e-4) {
        c.classList.add('active');
      } else {
        c.classList.remove('active');
      }
    });
  }

  _handleLayerSelectionChange() {
    const select = document.getElementById('buffer-target-layer');
    const newLayerBox = document.getElementById('buffer-new-layer-box');
    const newLayerInput = document.getElementById('buffer-new-layer-name');
    if (!select || !newLayerBox) return;

    if (select.value === '__new__') {
      newLayerBox.style.display = 'block';
      if (newLayerInput && !newLayerInput.value) {
        const r = this.currentRadius || 50;
        newLayerInput.value = `Buffer (${r}m)`;
      }
      setTimeout(() => {
        const inner = newLayerInput?.shadowRoot?.querySelector('input') || newLayerInput;
        inner?.focus?.();
      }, 50);
    } else {
      newLayerBox.style.display = 'none';
    }
  }

  _handleConfirm() {
    const radiusInput = document.getElementById('buffer-modal-radius');
    const layerSelect = document.getElementById('buffer-target-layer');
    const newLayerInput = document.getElementById('buffer-new-layer-name');

    const radiusRaw = radiusInput?.value ? String(radiusInput.value).trim().replace(',', '.') : '';
    const radius = parseFloat(radiusRaw);

    if (!Number.isFinite(radius) || radius <= 0) {
      UIToast.notificar({
        tipo: 'alerta',
        titulo: 'Raio Inválido',
        mensagem: 'Por favor, informe uma distância positiva em metros para o buffer.',
        duracao: 3500
      });
      return;
    }

    let targetLayerId = layerSelect?.value || '__same__';
    let newLayerName = null;

    if (targetLayerId === '__new__') {
      newLayerName = newLayerInput?.value?.trim() || `Buffer (${radius}m)`;
    }

    // Fecha o modal
    const modal = document.getElementById('modal-buffer');
    if (modal && typeof modal.fechar === 'function') {
      modal.fechar();
    }

    // Executa a aplicação do buffer
    this.onApply(this.targets, radius, targetLayerId, { newLayerName });
  }
}
