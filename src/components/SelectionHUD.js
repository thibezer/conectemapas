/* ==========================================================================
   ConecteMapas - SelectionHUD Component (SRP Encapsulated)
   Barra Flutuante Indicadora de Feições Selecionadas com Ações Rápidas
   ========================================================================== */

if (typeof window !== 'undefined' && !globalThis.process?.versions?.node) {
  import('./SelectionHUD.css');
}
import { FeatureGeometryUtils } from '../services/MapEngine/FeatureGeometryUtils.js';
import { ICONES, computeModifyState } from './ModifyRibbon.js';


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
  duplicate: svg('<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16V5a2 2 0 0 1 2-2h11"/>'),
  more: svg('<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'),
  lock: svg('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
  close: svg('<path d="M18 6 6 18M6 6l12 12"/>')
};
const lbl = (t) => `<span class="cm-sel-label">${t}</span>`;

/** Teto de feições para somar métricas no cabeçalho (evita travar com seleções enormes). */
const METRIC_LIMIT = 200;

/** Itens do menu "mais ações": comandos da aba Modificar, executados por onAction(id). */
const MORE_MENU = [
  { title: 'Copiar como', items: [
    { id: 'mod-copy-geojson', label: 'GeoJSON', icon: ICONES.copiar },
    { id: 'mod-copy-wkt', label: 'WKT', icon: ICONES.copiar },
    { id: 'mod-copy-coords', label: 'Coordenadas', icon: ICONES.copiar }
  ] },
  { title: 'Organizar', items: [
    { id: 'mod-lock', label: 'Bloquear', icon: ICONES.bloquear },
    { id: 'mod-visible', label: 'Ocultar', icon: ICONES.ocultar }
  ] },
  { title: 'Geometria', items: [
    { id: 'mod-buffer', label: 'Buffer…', icon: ICONES.buffer },
    { id: 'mod-simplify', label: 'Simplificar', icon: ICONES.simplificar },
    { id: 'mod-invert', label: 'Inverter cores', icon: ICONES.inverter }
  ] }
];

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
   * @param {Function} options.onAction (modId, {anchor}) => void  Comandos da aba Modificar (duplicar, copiar, bloquear…)
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
    this.onAction = options.onAction || (() => {});
    this.layers = [];

    this.selectedFeatures = [];
    this.element = null;
    this._menuAnchor = null;

    // Ação do botão (data-act) → comportamento. Os botões são refeitos a cada seleção;
    // os eventos ficam delegados no elemento raiz e ligados uma única vez.
    this._handlers = {
      inspect: () => this.onInspect(this.selectedFeatures[0]),
      popup: () => this.onOpenPopup(this.selectedFeatures[0]),
      table: () => this.onOpenTable(this.selectedFeatures),
      nodes: () => {
        const feat = this.selectedFeatures[0];
        this.element.style.display = 'none';
        this.onEditVertices(feat);
      },
      duplicate: (btn) => this.onAction('mod-duplicate', { anchor: btn }),
      zoom: () => this.onZoom(this.selectedFeatures),
      style: (btn) => this.onStyle(this.selectedFeatures, btn),
      layer: (btn, kbd) => this.toggleMenu(btn, 'layer', kbd),
      more: (btn, kbd) => this.toggleMenu(btn, 'more', kbd),
      delete: () => this.onDelete(this.selectedFeatures),
      clear: () => this.onClear()
    };
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
    this.closeMenu();
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
    this.closeMenu();

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
    this.element.innerHTML = `${this.renderInfo()}${this.renderActions()}`;
    this.initRoving();
    this.fit();
  }

  /* ---------------------------- Renderização ---------------------------- */

  /** Faixa à esquerda: contagem, camada, nome, tipo e métrica da geometria. */
  renderInfo() {
    const feats = this.selectedFeatures;
    const metric = this.metricOf(feats);
    const [metricMain, ...metricRest] = metric.split(' · ');
    const metricHtml = metric
      ? `<span class="cm-sel-metric" title="${this.escape(metric)}"><b>${this.escape(metricMain)}</b>${metricRest.length ? ` · ${this.escape(metricRest.join(' · '))}` : ''}</span>`
      : '';

    if (feats.length === 1) {
      const feat = feats[0];
      const layer = this.layers.find(l => l.id === feat.layerId) || { name: 'Camada', color: '#00E08A' };
      const featName = feat.name || 'Feição Sem Nome';
      const category = feat.category && feat.category !== feat.type
        ? feat.category
        : FeatureGeometryUtils.getTypeLabel(feat.type);
      this.element.style.setProperty?.('--cm-sel-layer', layer.color || '#00E08A');
      return `
        <div class="cm-sel-info" aria-live="polite" title="Camada: ${this.escape(layer.name)}">
          <span class="cm-sel-badge-count">1</span>
          <span class="cm-sel-title" title="${this.escape(featName)}">${this.escape(featName)}</span>
          ${feat.locked ? `<span class="cm-sel-lock" title="Feição bloqueada">${ICONS.lock}</span>` : ''}
          <span class="cm-sel-tag">${this.escape(category)}</span>
          ${metricHtml}
        </div>`;
    }

    const count = feats.length;
    const firstNames = feats.slice(0, 2).map(f => f.name || f.id).join(', ');
    const extraCount = count - 2;
    const subtitle = extraCount > 0 ? `${firstNames} (+${extraCount})` : firstNames;
    this.element.style.removeProperty?.('--cm-sel-layer');
    return `
        <div class="cm-sel-info" aria-live="polite">
          <span class="cm-sel-badge-count">${count}</span>
          <span class="cm-sel-title">${count} Feições Selecionadas</span>
          <span class="cm-sel-tag" title="${this.escape(subtitle)}">${this.escape(subtitle)}</span>
          ${metricHtml}
        </div>`;
  }

  /** Grupos de botões separados por traços finos: ver · editar · organizar · encerrar. */
  renderActions() {
    const groups = this.selectedFeatures.length === 1 ? this.singleGroups() : this.multiGroups();
    const html = groups.map(g => g.map(b => this.renderButton(b)).join('')).join('<span class="cm-sel-sep" aria-hidden="true"></span>');
    return `<div class="cm-sel-actions" role="toolbar" aria-label="Ações da seleção">${html}</div>`;
  }

  singleGroups() {
    const feat = this.selectedFeatures[0];
    const isCircle = feat.type === 'Circle';
    const canEditNodes = !feat.locked && ['Polygon', 'LineString', 'Point', 'Circle'].includes(feat.type);
    return [
      [
        { act: 'inspect', ico: ICONS.inspect, label: 'Inspecionar', title: 'Inspecionar e editar propriedades', primary: true },
        { act: 'popup', ico: ICONS.popup, label: 'Balão', title: 'Ver balão de detalhes flutuante no mapa' },
        { act: 'table', ico: ICONS.table, title: 'Ver na tabela de atributos' }
      ],
      [
        ...(canEditNodes ? [{ act: 'nodes', ico: ICONS.nodes, label: isCircle ? 'Raio' : 'Vértices', title: isCircle ? 'Editar centro e raio no mapa' : 'Editar vértices / nós no mapa' }] : []),
        { act: 'duplicate', ico: ICONS.duplicate, title: 'Duplicar feição (deslocada 30 m)' },
        { act: 'style', ico: ICONS.style, label: 'Estilo', title: 'Alterar cor de preenchimento, traço e opacidade' }
      ],
      [
        { act: 'zoom', ico: ICONS.zoom, label: 'Zoom', title: 'Centralizar no mapa' },
        { act: 'layer', ico: ICONS.layer, label: 'Camada', title: 'Mover para outra camada', popup: true },
        { act: 'more', ico: ICONS.more, title: 'Mais ações: copiar, bloquear, ocultar, buffer…', popup: true }
      ],
      [
        { act: 'delete', ico: ICONS.trash, title: 'Excluir feição (Del)', aria: 'Excluir feição', danger: true },
        { act: 'clear', ico: ICONS.close, title: 'Desmarcar (Esc)', aria: 'Desmarcar', close: true }
      ]
    ];
  }

  multiGroups() {
    const count = this.selectedFeatures.length;
    return [
      [
        { act: 'table', ico: ICONS.table, label: 'Tabela', title: 'Visualizar na tabela de atributos', primary: true },
        { act: 'zoom', ico: ICONS.zoom, label: 'Enquadrar', title: 'Enquadrar todas as feições selecionadas' }
      ],
      [
        { act: 'style', ico: ICONS.style, label: 'Estilo', title: 'Alterar cores em lote' },
        { act: 'layer', ico: ICONS.layer, label: 'Camada', title: 'Mover para outra camada', popup: true },
        { act: 'more', ico: ICONS.more, title: 'Mais ações: copiar, bloquear, ocultar, buffer…', popup: true }
      ],
      [
        { act: 'delete', ico: ICONS.trash, label: `Excluir (${count})`, title: 'Excluir feições selecionadas (Del)', danger: true },
        { act: 'clear', ico: ICONS.close, title: 'Desmarcar todas (Esc)', aria: 'Desmarcar todas', close: true }
      ]
    ];
  }

  renderButton(b) {
    const cls = ['cm-sel-btn', b.primary && 'primary', b.danger && 'danger', b.close && 'close'].filter(Boolean).join(' ');
    const aria = b.aria ? ` aria-label="${b.aria}"` : (b.label ? '' : ` aria-label="${this.escape(b.title)}"`);
    const popup = b.popup ? ' aria-haspopup="menu" aria-expanded="false"' : '';
    return `<button type="button" class="${cls}" data-act="${b.act}" id="btn-sel-${b.act}" title="${this.escape(b.title)}"${aria}${popup}>${b.ico}${b.label ? lbl(b.label) : ''}</button>`;
  }

  /* ------------------------------ Métricas ------------------------------ */

  /** Resumo métrico da seleção: área/perímetro, extensão ou raio (vazio quando não se aplica). */
  metricOf(feats) {
    try {
      if (!feats.length || feats.length > METRIC_LIMIT) return '';
      const U = FeatureGeometryUtils;
      if (feats.length === 1) {
        const f = feats[0];
        if (f.type === 'Polygon') return `${U.formatArea(U.calculatePolygonArea(f.coordinates))} · ${U.formatLength(U.calculatePolygonPerimeter(f.coordinates))}`;
        if (f.type === 'LineString') return U.formatLength(U.calculatePolylineLength(f.coordinates));
        if (f.type === 'Circle' && Number(f.radius) > 0) return `raio ${U.formatLength(Number(f.radius))}`;
        return '';
      }
      let area = 0;
      let length = 0;
      for (const f of feats) {
        if (f.type === 'Polygon') area += U.calculatePolygonArea(f.coordinates);
        else if (f.type === 'LineString') length += U.calculatePolylineLength(f.coordinates);
      }
      const parts = [];
      if (area > 0) parts.push(`Σ ${U.formatArea(area)}`);
      if (length > 0) parts.push(`Σ ${U.formatLength(length)}`);
      return parts.join(' · ');
    } catch (_) {
      return '';
    }
  }

  /* ------------------------------- Eventos ------------------------------- */

  bindEvents() {
    const el = this.element;
    if (!el || el._cmHudBound) return;
    el._cmHudBound = true;

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const target = e.target;
      const layerItem = target?.closest?.('[data-layer-id]');
      if (layerItem) return this.pickLayer(layerItem);
      const modItem = target?.closest?.('[data-mod]');
      if (modItem) return this.pickModAction(modItem);
      const btn = target?.closest?.('[data-act]');
      if (!btn || btn.disabled || this.selectedFeatures.length === 0) return;
      // detail === 0: acionado pelo teclado (Enter/Espaço), então o menu aberto recebe o foco
      this._handlers[btn.dataset.act]?.(btn, e.detail === 0);
    });

    el.addEventListener('keydown', (e) => this.onKeydown(e));

    // Barra com um único ponto de Tab (roving tabindex): o botão focado vira o tabbable
    el.addEventListener('focusin', (e) => {
      const btn = e.target?.closest?.('.cm-sel-actions .cm-sel-btn');
      if (btn) this.initRoving(btn);
    });
  }

  /** Setas, Home e End percorrem os botões; no menu aberto, setas percorrem os itens e Esc fecha. */
  onKeydown(e) {
    const menu = e.target?.closest?.('.cm-sel-menu');
    if (menu) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation(); // não deixa o Esc global desmarcar a seleção
        const anchor = this._menuAnchor;
        this.closeMenu();
        anchor?.focus?.();
        return;
      }
      this.moveFocus([...menu.querySelectorAll('[role="menuitem"]:not([disabled])')], e);
      return;
    }
    const btn = e.target?.closest?.('.cm-sel-actions .cm-sel-btn');
    if (!btn) return;
    this.moveFocus([...this.element.querySelectorAll('.cm-sel-actions .cm-sel-btn')], e, true);
  }

  /** Move o foco entre `items` conforme a tecla; `horizontal` usa ←/→, senão ↑/↓. */
  moveFocus(items, e, horizontal = false) {
    if (!items.length) return;
    const prev = horizontal ? 'ArrowLeft' : 'ArrowUp';
    const next = horizontal ? 'ArrowRight' : 'ArrowDown';
    const i = items.indexOf(document.activeElement);
    let to = -1;
    if (e.key === next) to = (i + 1) % items.length;
    else if (e.key === prev) to = (i - 1 + items.length) % items.length;
    else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = items.length - 1;
    if (to < 0) return;
    e.preventDefault();
    items[to].focus();
  }

  /** Apenas `current` (ou o primeiro botão) fica no ciclo de Tab. */
  initRoving(current) {
    const btns = this.element?.querySelectorAll?.('.cm-sel-actions .cm-sel-btn') || [];
    const keep = current || btns[0];
    btns.forEach(b => { b.tabIndex = b === keep ? 0 : -1; });
  }

  /* -------------------------------- Menus -------------------------------- */

  closeMenu() {
    this.element?.querySelector?.('.cm-sel-menu')?.remove();
    this.element?.querySelectorAll?.('[aria-haspopup]').forEach(b => b.setAttribute('aria-expanded', 'false'));
    this._menuAnchor = null;
    if (this._outsideHandler) {
      document.removeEventListener('mousedown', this._outsideHandler, true);
      this._outsideHandler = null;
    }
  }

  /** Abre (ou fecha, se já estava aberto para o mesmo botão) o menu `kind` ('layer' | 'more'). */
  toggleMenu(anchor, kind, focusFirst = false) {
    const reopen = this._menuAnchor !== anchor;
    this.closeMenu();
    if (!reopen) return;

    const menu = document.createElement('div');
    menu.className = `cm-sel-menu cm-sel-${kind}-menu`;
    menu.setAttribute('role', 'menu');
    menu.innerHTML = kind === 'layer' ? this.layerMenuHtml() : this.moreMenuHtml();
    this.element.appendChild(menu);

    // Alinha a borda direita do menu à do botão que o abriu
    try {
      const hud = this.element.getBoundingClientRect();
      const btn = anchor.getBoundingClientRect();
      menu.style.right = `${Math.max(0, hud.right - btn.right)}px`;
    } catch (_) { /* sem layout (testes): fica no padrão do CSS */ }

    anchor.setAttribute('aria-expanded', 'true');
    this._menuAnchor = anchor;
    this._outsideHandler = (e) => { if (!menu.contains(e.target) && !anchor.contains(e.target)) this.closeMenu(); };
    document.addEventListener('mousedown', this._outsideHandler, true);
    if (focusFirst) menu.querySelector('[role="menuitem"]:not([disabled])')?.focus?.();
  }

  /** Camadas do projeto; a camada comum da seleção aparece marcada. */
  layerMenuHtml() {
    const layerIds = new Set(this.selectedFeatures.map(f => f.layerId));
    return `
      <div class="cm-sel-layer-title">Mover ${this.selectedFeatures.length} feição(ões) para…</div>
      <div class="cm-sel-layer-list">
        ${this.layers.map(l => `
          <button type="button" class="cm-sel-layer-item ${layerIds.size === 1 && layerIds.has(l.id) ? 'current' : ''}" role="menuitem" data-layer-id="${this.escape(l.id)}">
            <span style="color: ${this.escape(l.color || '#00E08A')};">●</span>
            <span class="cm-sel-layer-name">${this.escape(l.name)}</span>
          </button>`).join('')}
      </div>
      <label class="cm-sel-layer-opt"><input type="checkbox" id="cm-sel-inherit-color"> Adotar a cor da camada</label>`;
  }

  /** Comandos da aba Modificar, habilitados conforme a seleção (mesma regra da ribbon). */
  moreMenuHtml() {
    const state = computeModifyState({ features: this.selectedFeatures, layers: this.layers });
    return MORE_MENU.map(sec => `
      <div class="cm-sel-layer-title">${sec.title}</div>
      ${sec.items.map(it => {
        const st = state[it.id] || {};
        return `<button type="button" class="cm-sel-layer-item" role="menuitem" data-mod="${it.id}"${st.disabled ? ' disabled' : ''}>
          <span class="cm-sel-menu-ico" aria-hidden="true">${st.icone || it.icon}</span>
          <span class="cm-sel-layer-name">${this.escape(st.rotulo || it.label)}</span>
        </button>`;
      }).join('')}`).join('<div class="cm-sel-menu-sep"></div>');
  }

  pickLayer(item) {
    const menu = item.closest('.cm-sel-menu');
    const inheritColor = !!menu?.querySelector('#cm-sel-inherit-color')?.checked;
    const layerId = item.dataset.layerId;
    this.closeMenu();
    this.onMoveToLayer(this.selectedFeatures, layerId, { inheritColor });
  }

  pickModAction(item) {
    if (item.disabled) return;
    const anchor = this._menuAnchor;
    this.closeMenu();
    this.onAction(item.dataset.mod, { anchor });
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
