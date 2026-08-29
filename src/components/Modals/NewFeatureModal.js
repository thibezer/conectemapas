/* ==========================================================================
   ConecteMapas - NewFeatureModal Component
   Modal de criação e configuração inicial de nova feição vetorial
   ========================================================================== */

import { normalizeFeature } from '../../services/MockData.js';

export class NewFeatureModal {
  constructor(options = {}) {
    this.layers = options.layers || [];
    this.pendingFeature = null;
    this.onSave = options.onSave || (() => {});
  }

  render(container) {
    container.innerHTML = `
      <ui-modal id="modal-new-feature" titulo="✨ Nova Feição no Mapa">
        <form id="form-new-feature" style="display: flex; flex-direction: column; gap: 14px;">
          <ui-campo-texto 
            id="new-feat-name" 
            name="name" 
            label="Nome da Feição" 
            placeholder="Ex: Marco M-03, Área de Preservação..." 
            obrigatorio>
          </ui-campo-texto>

          <ui-lista-flutuante id="new-feat-layer" name="layerId" label="Camada de Destino">
            ${this.layers.map(l => `
              <option value="${l.id}">${l.name}</option>
            `).join('')}
          </ui-lista-flutuante>

          <ui-campo-texto 
            id="new-feat-category" 
            name="category" 
            label="Categoria / Tipo" 
            placeholder="Ex: Topografia, Ambiental, Infraestrutura...">
          </ui-campo-texto>

          <ui-campo-texto 
            id="new-feat-desc" 
            name="description" 
            label="Descrição / Detalhes">
          </ui-campo-texto>
        </form>

        <div slot="rodape" style="display: flex; justify-content: flex-end; gap: 8px;">
          <ui-botao-primario inline variante="secundario" dismiss-modal style="height: 30px;">
            Cancelar
          </ui-botao-primario>
          <ui-botao-primario inline id="btn-save-new-feature" variante="primary" style="height: 30px;">
            Adicionar ao Mapa
          </ui-botao-primario>
        </div>
      </ui-modal>
    `;

    this.bindEvents(container);
  }

  openWithFeature(rawFeature) {
    this.pendingFeature = rawFeature;
    const nameInput = document.getElementById('new-feat-name');
    const catInput = document.getElementById('new-feat-category');
    const descInput = document.getElementById('new-feat-desc');

    let defaultName = 'Nova Feição';
    let defaultCat = 'Geral';

    if (rawFeature.type === 'Point') {
      defaultName = `Ponto #${Math.floor(Math.random() * 900 + 100)}`;
      defaultCat = 'Marco Topográfico';
    } else if (rawFeature.type === 'LineString') {
      defaultName = `Rota #${Math.floor(Math.random() * 900 + 100)}`;
      defaultCat = 'Eixo Viário';
    } else if (rawFeature.type === 'Polygon') {
      defaultName = `Polígono #${Math.floor(Math.random() * 900 + 100)}`;
      defaultCat = 'Área Delimitada';
    } else if (rawFeature.type === 'Circle') {
      defaultName = `Buffer de Raio (${rawFeature.radius}m)`;
      defaultCat = 'Raio de Cobertura';
    }

    if (nameInput) nameInput.value = defaultName;
    if (catInput) catInput.value = defaultCat;
    if (descInput) descInput.value = '';

    const modal = document.getElementById('modal-new-feature');
    if (modal && modal.abrir) modal.abrir();
  }

  updateLayers(layers) {
    this.layers = layers;
    const select = document.getElementById('new-feat-layer');
    if (select) {
      select.innerHTML = layers.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
    }
  }

  bindEvents(container) {
    const btnSave = container.querySelector('#btn-save-new-feature');
    const form = container.querySelector('#form-new-feature');

    if (btnSave) {
      btnSave.addEventListener('click', () => {
        const nameInput = document.getElementById('new-feat-name');
        const layerSelect = document.getElementById('new-feat-layer');
        const catInput = document.getElementById('new-feat-category');
        const descInput = document.getElementById('new-feat-desc');

        const name = nameInput?.value?.trim() || 'Nova Feição';
        const layerId = layerSelect?.value || this.layers[0]?.id || 'layer-topografia';
        const category = catInput?.value?.trim() || 'Geral';
        const description = descInput?.value?.trim() || '';

        if (this.pendingFeature) {
          const targetL = this.layers.find(l => l.id === layerId) || this.layers[0] || { color: '#00E08A' };
          const color = targetL.color || '#00E08A';

          const completedFeature = normalizeFeature({
            ...this.pendingFeature,
            id: 'feat-' + Date.now(),
            name,
            layerId,
            category,
            color,
            description,
            style: {
              fillColor: color,
              fillOpacity: this.pendingFeature.type === 'LineString' ? 1 : 0.35,
              strokeColor: color,
              strokeWidth: 2.5,
              strokeDashArray: '',
              markerIcon: 'pin',
              markerSize: 24,
              markerRotation: 0,
              showLabel: false,
              labelField: 'name'
            },
            properties: {
              ...(this.pendingFeature.properties || {})
            },
            createdBy: 'Você',
            createdAt: new Date().toISOString()
          });

          this.onSave(completedFeature);

          const modal = document.getElementById('modal-new-feature');
          if (modal && modal.fechar) modal.fechar();
        }
      });
    }
  }
}
