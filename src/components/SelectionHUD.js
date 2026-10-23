/* ==========================================================================
   ConecteMapas - SelectionHUD Component (SRP Encapsulated)
   Barra Flutuante Indicadora de Feições Selecionadas com Ações Rápidas
   ========================================================================== */

if (typeof window !== 'undefined' && !globalThis.process?.versions?.node) {
  import('./SelectionHUD.css');
}
import { FeatureGeometryUtils } from '../services/MapEngine/FeatureGeometryUtils.js';


const svg = (body) => `<svg class="cm-sel-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const ICONS = {
  inspect: svg('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'),
  popup: svg('<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
  nodes: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  zoom: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>'),
  style: svg('<path d="M12 22a10 10 0 1 1 10-10c0 3-2 4-4.5 4H15a2 2 0 0 0-1.5 3.3A2 2 0 0 1 12 22z"/><circle cx="7.5" cy="11" r="1"/><circle cx="12" cy="7" r="1"/><circle cx="16.5" cy="11" r="1"/>'),
  layer: svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  trash: svg('<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>'),
  table: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>'),
  close: svg('<path d="M18 6 6 18M6 6l12 12"/>')
};
const lbl = (t) => `<span class="cm-sel-label">${t}</span>`;

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
    this.onStyle = options.onStyle || (() => {});
    this.onOpenPopup = options.onOpenPopup || (() => {});
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
    this.observeFreeSpace(container);
  }

  /** Recalcula o modo compacto quando a janela ou o painel lateral mudam de tamanho/estado. */
  observeFreeSpace(container) {
    if (typeof ResizeObserver === 'undefined') return;
    const schedule = () => {
      clearTimeout(this._fitTimer);
      this._fitTimer = setTimeout(() => this.fit(), 0);
    };
    this._resizeObs = new ResizeObserver(schedule);
    this._resizeObs.observe(container);
    // Largura do painel (--cm-sidebar-w no :root) e recolher/expandir (classe .collapsed);
    // o painel pode ser re-renderizado, então observa o ponto de montagem e não o <aside>.
    this._mutationObs = new MutationObserver(schedule);
    this._mutationObs.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    const mount = document.getElementById('layer-panel-mount');
    if (mount) this._mutationObs.observe(mount, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
  }

  /** Só ícones quando os rótulos não cabem na faixa livre entre a barra de ferramentas e o painel. */
  fit() {
    const el = this.element;
    if (!el || el.style.display === 'none') return;
    el.classList.remove('compact');
    if (el.scrollWidth > el.clientWidth + 1) el.classList.add('compact');
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
      const canEditNodes = !feat.locked && (feat.type === 'Polygon' || feat.type === 'LineString' || feat.type === 'Point' || feat.type === 'Circle');

      this.element.innerHTML = `
        <div class="cm-sel-info">
          <span class="cm-sel-badge-count">1</span>
          <span class="cm-sel-dot" style="background: ${layer.color || '#38bdf8'}"></span>
          <span class="cm-sel-title" title="${this.escape(featName)}">${this.escape(featName)}</span>
          <span class="cm-sel-tag">${this.escape(category)}</span>
        </div>

        <div class="cm-sel-divider"></div>

        <div class="cm-sel-actions">
          <button class="cm-sel-btn primary" id="btn-sel-inspect" title="Inspecionar e editar propriedades">
            ${ICONS.inspect}${lbl('Inspecionar')}
          </button>
          <button class="cm-sel-btn" id="btn-sel-popup" title="Ver balão de detalhes flutuante no mapa">
            ${ICONS.popup}${lbl('Balão')}
          </button>
          ${canEditNodes ? `
          <button class="cm-sel-btn" id="btn-sel-edit-nodes" title="${feat.type === 'Circle' ? 'Editar centro e raio no mapa' : 'Editar vértices / nós no mapa'}">
            ${ICONS.nodes}${lbl(feat.type === 'Circle' ? 'Raio' : 'Vértices')}
          </button>
          ` : ''}
          <button class="cm-sel-btn" id="btn-sel-zoom" title="Centralizar no mapa">
            ${ICONS.zoom}${lbl('Zoom')}
          </button>
          <button class="cm-sel-btn" id="btn-sel-color" title="Alterar cor de preenchimento, traço e opacidade">
            ${ICONS.style}${lbl('Estilo')}
          </button>
          <button class="cm-sel-btn" id="btn-sel-layer" title="Mover para outra camada" aria-haspopup="menu" aria-expanded="false">
            ${ICONS.layer}${lbl('Camada')}
          </button>
          <button class="cm-sel-btn danger" id="btn-sel-delete" title="Excluir feição" aria-label="Excluir feição">
            ${ICONS.trash}
          </button>
          <button class="cm-sel-btn close" id="btn-sel-clear" title="Desmarcar (Esc)" aria-label="Desmarcar">
            ${ICONS.close}
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
            ${ICONS.table}${lbl('Tabela')}
          </button>
          <button class="cm-sel-btn" id="btn-sel-zoom" title="Enquadrar todas as feições selecionadas">
            ${ICONS.zoom}${lbl('Enquadrar')}
          </button>
          <button class="cm-sel-btn" id="btn-sel-color" title="Alterar cores em lote">
            ${ICONS.style}${lbl('Estilo')}
          </button>
          <button class="cm-sel-btn" id="btn-sel-layer" title="Mover para outra camada" aria-haspopup="menu" aria-expanded="false">
            ${ICONS.layer}${lbl('Camada')}
          </button>
          <button class="cm-sel-btn danger" id="btn-sel-delete" title="Excluir feições selecionadas">
            ${ICONS.trash}${lbl(`Excluir (${count})`)}
          </button>
          <button class="cm-sel-btn close" id="btn-sel-clear" title="Desmarcar todas (Esc)" aria-label="Desmarcar todas">
            ${ICONS.close}
          </button>
        </div>
      `;
    }

    this.bindEvents();
    this.fit();
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

    const btnPopup = this.element.querySelector('#btn-sel-popup');
    if (btnPopup) {
      btnPopup.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.selectedFeatures.length > 0) {
          this.onOpenPopup(this.selectedFeatures[0]);
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

    const btnColor = this.element.querySelector('#btn-sel-color');
    if (btnColor) {
      btnColor.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.selectedFeatures.length > 0) {
          this.onStyle(this.selectedFeatures, btnColor);
        }
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
