/* ==========================================================================
   ConecteMapas - SelectionHUD Component (SRP Encapsulated)
   Barra Flutuante Indicadora de Feições Selecionadas com Ações Rápidas
   ========================================================================== */

import './SelectionHUD.css';
import { FeatureGeometryUtils } from '../services/MapEngine/FeatureGeometryUtils.js';

export class SelectionHUD {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container Container pai onde o HUD será montado
   * @param {Function} options.onInspect
   * @param {Function} options.onEditVertices
   * @param {Function} options.onZoom
   * @param {Function} options.onDelete
   * @param {Function} options.onClear
   * @param {Function} options.onOpenTable
   */
  constructor(options = {}) {
    this.container = options.container || document.body;
    this.onInspect = options.onInspect || (() => {});
    this.onEditVertices = options.onEditVertices || (() => {});
    this.onZoom = options.onZoom || (() => {});
    this.onDelete = options.onDelete || (() => {});
    this.onClear = options.onClear || (() => {});
    this.onOpenTable = options.onOpenTable || (() => {});

    this.selectedFeatures = [];
    this.element = null;
    this.init();
  }

  init() {
    const container = document.querySelector('.cm-workspace') || this.container || document.body;
    let el = document.getElementById('cm-selection-hud');
    if (!el) {
      el = document.createElement('div');
      el.id = 'cm-selection-hud';
      el.className = 'cm-selection-hud';
      el.style.display = 'none';
      container.appendChild(el);
    } else if (el.parentElement !== container) {
      container.appendChild(el);
    }
    this.element = el;
    this.bindEvents();
  }

  hide() {
    if (this.element) {
      this.element.style.display = 'none';
    }
  }

  show() {
    if (this.element && this.selectedFeatures.length > 0) {
      this.element.style.display = 'flex';
    }
  }

  /**
   * Atualiza as feições selecionadas e re-renderiza o HUD
   * @param {Array<Object>} features Lista de feições selecionadas
   * @param {Array<Object>} layers Lista de camadas do projeto
   */
  update(features = [], layers = []) {
    this.selectedFeatures = Array.isArray(features) ? features : (features ? [features] : []);

    if (!this.element) return;

    if (this.selectedFeatures.length === 0) {
      this.element.style.display = 'none';
      return;
    }

    // Salvaguarda: Se o editor de vértices ou desenho CAD estiver ativo, mantém o SelectionHUD oculto
    const vertexHud = document.getElementById('cm-vertex-edit-hud');
    const cadHud = document.getElementById('cm-cad-hud');
    const isVertexActive = vertexHud && vertexHud.style.display !== 'none';
    const isCadActive = cadHud && cadHud.style.display !== 'none';
    if (isVertexActive || isCadActive) {
      this.element.style.display = 'none';
      return;
    }

    this.element.style.display = 'flex';

    if (this.selectedFeatures.length === 1) {
      const feat = this.selectedFeatures[0];
      const layer = layers.find(l => l.id === feat.layerId) || { name: 'Camada', color: '#00E08A' };
      const featName = feat.name || 'Feição Sem Nome';
      const category = feat.category && feat.category !== feat.type
        ? feat.category
        : FeatureGeometryUtils.getTypeLabel(feat.type);
      const canEditNodes = !feat.locked && (feat.type === 'Polygon' || feat.type === 'LineString' || feat.type === 'Point');

      this.element.innerHTML = `
        <div class="cm-sel-info">
          <span class="cm-sel-badge-count">1</span>
          <span style="color: ${layer.color || '#38bdf8'}; font-size: 14px;">●</span>
          <span class="cm-sel-title" title="${this.escape(featName)}">${this.escape(featName)}</span>
          <span class="cm-sel-tag">${this.escape(category)}</span>
        </div>

        <div class="cm-sel-divider"></div>

        <div class="cm-sel-actions">
          <button class="cm-sel-btn primary" id="btn-sel-inspect" title="Inspecionar e editar propriedades">
            🔍 Inspecionar
          </button>
          ${canEditNodes ? `
          <button class="cm-sel-btn" id="btn-sel-edit-nodes" title="Editar vértices / nós no mapa">
            ✏️ Vértices
          </button>
          ` : ''}
          <button class="cm-sel-btn" id="btn-sel-zoom" title="Centralizar no mapa">
            🎯 Zoom
          </button>
          <button class="cm-sel-btn danger" id="btn-sel-delete" title="Excluir feição">
            🗑️
          </button>
          <button class="cm-sel-btn close" id="btn-sel-clear" title="Desmarcar (Esc)">
            ✕
          </button>
        </div>
      `;
    } else {
      const count = this.selectedFeatures.length;
      const firstNames = this.selectedFeatures.slice(0, 2).map(f => f.name || f.id).join(', ');
      const extraCount = count - 2;
      const subtitle = extraCount > 0 ? `${firstNames} (+${extraCount})` : firstNames;

      this.element.innerHTML = `
        <div class="cm-sel-info">
          <span class="cm-sel-badge-count">${count}</span>
          <span class="cm-sel-title">${count} Feições Selecionadas</span>
          <span class="cm-sel-tag" title="${this.escape(subtitle)}">${this.escape(subtitle)}</span>
        </div>

        <div class="cm-sel-divider"></div>

        <div class="cm-sel-actions">
          <button class="cm-sel-btn primary" id="btn-sel-table" title="Visualizar na tabela de atributos">
            📊 Tabela
          </button>
          <button class="cm-sel-btn" id="btn-sel-zoom" title="Enquadrar todas as feições selecionadas">
            🎯 Enquadrar
          </button>
          <button class="cm-sel-btn danger" id="btn-sel-delete" title="Excluir feições selecionadas">
            🗑️ Excluir (${count})
          </button>
          <button class="cm-sel-btn close" id="btn-sel-clear" title="Desmarcar todas (Esc)">
            ✕
          </button>
        </div>
      `;
    }

    this.bindEvents();
  }

  bindEvents() {
    if (!this.element) return;

    const btnInspect = this.element.querySelector('#btn-sel-inspect');
    if (btnInspect) {
      btnInspect.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.selectedFeatures.length > 0) {
          this.onInspect(this.selectedFeatures[0]);
        }
      });
    }

    const btnEditNodes = this.element.querySelector('#btn-sel-edit-nodes');
    if (btnEditNodes) {
      btnEditNodes.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.selectedFeatures.length > 0) {
          const feat = this.selectedFeatures[0];
          this.element.style.display = 'none';
          this.onEditVertices(feat);
        }
      });
    }

    const btnZoom = this.element.querySelector('#btn-sel-zoom');
    if (btnZoom) {
      btnZoom.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onZoom(this.selectedFeatures);
      });
    }

    const btnTable = this.element.querySelector('#btn-sel-table');
    if (btnTable) {
      btnTable.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onOpenTable(this.selectedFeatures);
      });
    }

    const btnDelete = this.element.querySelector('#btn-sel-delete');
    if (btnDelete) {
      btnDelete.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onDelete(this.selectedFeatures);
      });
    }

    const btnClear = this.element.querySelector('#btn-sel-clear');
    if (btnClear) {
      btnClear.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onClear();
      });
    }
  }

  escape(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
