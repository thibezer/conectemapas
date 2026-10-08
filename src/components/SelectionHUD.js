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
   * @param {Function} options.onMoveToLayer (features, layerId, {inheritColor}) => void
   */
  constructor(options = {}) {
    this.container = options.container || document.body;
    this.onInspect = options.onInspect || (() => {});
    this.onEditVertices = options.onEditVertices || (() => {});
    this.onZoom = options.onZoom || (() => {});
    this.onDelete = options.onDelete || (() => {});
    this.onClear = options.onClear || (() => {});
    this.onOpenTable = options.onOpenTable || (() => {});
    this.onMoveToLayer = options.onMoveToLayer || (() => {});
    this.layers = [];

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
    this.layers = layers || [];

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
          <button class="cm-sel-btn" id="btn-sel-layer" title="Mover para outra camada" aria-haspopup="menu" aria-expanded="false">
            📁 Camada
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
          <button class="cm-sel-btn" id="btn-sel-layer" title="Mover para outra camada" aria-haspopup="menu" aria-expanded="false">
            📁 Camada
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

    const btnLayer = this.element.querySelector('#btn-sel-layer');
    if (btnLayer) {
      btnLayer.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleLayerMenu(btnLayer);
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

  closeLayerMenu() {
    this.element?.querySelector('.cm-sel-layer-menu')?.remove();
    this.element?.querySelector('#btn-sel-layer')?.setAttribute('aria-expanded', 'false');
    if (this._outsideHandler) {
      document.removeEventListener('mousedown', this._outsideHandler, true);
      this._outsideHandler = null;
    }
  }

  /** Menu com as camadas do projeto; a camada comum da seleção aparece marcada. */
  toggleLayerMenu(anchor) {
    if (this.element.querySelector('.cm-sel-layer-menu')) return this.closeLayerMenu();
    const layerIds = new Set(this.selectedFeatures.map(f => f.layerId));
    const menu = document.createElement('div');
    menu.className = 'cm-sel-layer-menu';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = `
      <div class="cm-sel-layer-title">Mover ${this.selectedFeatures.length} feição(ões) para…</div>
      <div class="cm-sel-layer-list">
        ${this.layers.map(l => `
          <button class="cm-sel-layer-item ${layerIds.size === 1 && layerIds.has(l.id) ? 'current' : ''}" role="menuitem" data-layer-id="${this.escape(l.id)}">
            <span style="color: ${this.escape(l.color || '#00E08A')};">●</span>
            <span class="cm-sel-layer-name">${this.escape(l.name)}</span>
          </button>`).join('')}
      </div>
      <label class="cm-sel-layer-opt"><input type="checkbox" id="cm-sel-inherit-color"> Adotar a cor da camada</label>`;
    menu.addEventListener('click', (e) => {
      e.stopPropagation();
      const item = e.target.closest('[data-layer-id]');
      if (!item) return;
      const inheritColor = menu.querySelector('#cm-sel-inherit-color').checked;
      const layerId = item.dataset.layerId;
      this.closeLayerMenu();
      this.onMoveToLayer(this.selectedFeatures, layerId, { inheritColor });
    });
    this.element.appendChild(menu);
    anchor.setAttribute('aria-expanded', 'true');
    this._outsideHandler = (e) => { if (!menu.contains(e.target) && e.target !== anchor) this.closeLayerMenu(); };
    document.addEventListener('mousedown', this._outsideHandler, true);
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
