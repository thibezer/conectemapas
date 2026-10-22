/* ==========================================================================
   ConecteMapas - LayerPanel Component (Core Facade & Orchestrator)
   Responsabilidade Única: Orquestração do painel lateral de camadas,
   inspetor de feições (Workbench CAD) e colaboração de equipe.
   ========================================================================== */

import './LayerPanel.css';
import { LayerTreeTab } from './LayerPanel/LayerTreeTab.js';
import { FeatureInspectorTab } from './LayerPanel/FeatureInspectorTab.js';
import { CollabAuditTab } from './LayerPanel/CollabAuditTab.js';
import { FloatingInspector } from './LayerPanel/FloatingInspector.js';
import { FeatureGeometryUtils } from '../services/MapEngine/FeatureGeometryUtils.js';

const SIDEBAR_WIDTH_KEY = 'cm-sidebar-width';
const SIDEBAR_DEFAULT_WIDTH = 335;
const SIDEBAR_MIN_WIDTH = 280;
const SIDEBAR_MAX_WIDTH = 720;

export class LayerPanel {
  constructor(options = {}) {
    this.app = options.app || null; // fonte da verdade das feições (estado mais recente)
    this.layers = options.layers || [];
    this.features = options.features || [];
    this.activeTab = options.initialTab || 'layers';
    this.currentBasemap = options.currentBasemap || 'satelite';
    this.selectedFeature = options.selectedFeature || null;
    this.auditLog = options.auditLog || [];
    this.chatMessages = options.chatMessages || [];
    this.container = null;
    this.isVertexEditing = false;
    this.isFloating = false;

    this.expandedLayers = new Set(this.layers.map(l => l.id));
    this.activeSettingsLayerId = null;
    this.searchQuery = '';
    this.editingLayerId = null;
    this.editingFeatureId = null;

    this.selectedFeatureIds = new Set();
    this.lastClickedFeatureId = null;

    this.activeLayerId = options.activeLayerId || (this.layers[0]?.id || null);
    this.onLayerSelect = options.onLayerSelect || (() => {});
    this.onLayerToggle = options.onLayerToggle || (() => {});
    this.onLayerReorder = options.onLayerReorder || (() => {});
    this.onLayerOpacityChange = options.onLayerOpacityChange || (() => {});
    this.onLayerRename = options.onLayerRename || (() => {});
    this.onLayerColorChange = options.onLayerColorChange || (() => {});
    this.onLayerDelete = options.onLayerDelete || (() => {});
    this.onLayerFit = options.onLayerFit || (() => {});
    this.onFeatureToggle = options.onFeatureToggle || (() => {});
    this.onFeatureSelect = options.onFeatureSelect || (() => {});
    this.onFeatureLockToggle = options.onFeatureLockToggle || (() => {});
    this.onBulkDelete = options.onBulkDelete || (() => {});
    this.onBulkUpdate = options.onBulkUpdate || (() => {});
    this.onFeaturesReorder = options.onFeaturesReorder || (() => {});
    this.onFeaturesSelect = options.onFeaturesSelect || (() => {});

    this.onBasemapChange = options.onBasemapChange || (() => {});
    this.onAddLayer = options.onAddLayer || (() => {});
    this.onDeleteFeature = options.onDeleteFeature || (() => {});
    this.onFeatureUpdate = options.onFeatureUpdate || (() => {});
    this.onFeatureCreate = options.onFeatureCreate || (() => {});
    this.onFitFeature = options.onFitFeature || (() => {});
    this.onSendMessage = options.onSendMessage || (() => {});
    this.onStartVertexEdit = options.onStartVertexEdit || (() => {});
    this.onStopVertexEdit = options.onStopVertexEdit || (() => {});
    this.onSidebarToggle = options.onSidebarToggle || (() => {});
  }

  /** O painel lateral está recolhido (só o botão flutuante visível)? */
  isSidebarCollapsed() {
    return !!this.container?.querySelector('#cm-sidebar-panel')?.classList.contains('collapsed');
  }

  /** Recolhe ou expande o painel lateral (botão ❯, botão flutuante e ribbon). */
  setSidebarCollapsed(collapsed) {
    const sidebar = this.container?.querySelector('#cm-sidebar-panel');
    const btnExpand = this.container?.querySelector('#btn-expand-sidebar');
    if (!sidebar) return;
    sidebar.classList.toggle('collapsed', !!collapsed);
    if (btnExpand) btnExpand.style.display = collapsed ? 'flex' : 'none';
    this.onSidebarToggle(!!collapsed);
  }

  getVisibleTreeItemIds() {
    const ids = [];
    const featsByLayer = new Map();
    for (let i = 0; i < this.features.length; i++) {
      const f = this.features[i];
      if (!featsByLayer.has(f.layerId)) featsByLayer.set(f.layerId, []);
      featsByLayer.get(f.layerId).push(f);
    }

    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      if (this.expandedLayers.has(layer.id)) {
        const layerFeats = featsByLayer.get(layer.id) || [];
        for (let j = 0; j < layerFeats.length; j++) {
          ids.push(layerFeats[j].id);
        }
      }
    }
    return ids;
  }

  handleItemSelection(itemId, isShift = false, isCtrl = false) {
    const allIds = this.getVisibleTreeItemIds();

    if (isShift && this.lastClickedFeatureId && allIds.includes(this.lastClickedFeatureId) && allIds.includes(itemId)) {
      const idxA = allIds.indexOf(this.lastClickedFeatureId);
      const idxB = allIds.indexOf(itemId);
      const start = Math.min(idxA, idxB);
      const end = Math.max(idxA, idxB);

      if (!isCtrl) {
        this.selectedFeatureIds.clear();
      }
      for (let i = start; i <= end; i++) {
        this.selectedFeatureIds.add(allIds[i]);
      }
    } else if (isCtrl) {
      if (this.selectedFeatureIds.has(itemId)) {
        this.selectedFeatureIds.delete(itemId);
      } else {
        this.selectedFeatureIds.add(itemId);
      }
      this.lastClickedFeatureId = itemId;
    } else {
      if (this.selectedFeatureIds.has(itemId) && this.selectedFeatureIds.size === 1) {
        this.selectedFeatureIds.delete(itemId);
      } else {
        this.selectedFeatureIds.clear();
        this.selectedFeatureIds.add(itemId);
      }
      this.lastClickedFeatureId = itemId;
    }
  }

  render(container) {
    this.container = container;
    this.container.innerHTML = `
      <aside class="cm-sidebar" id="cm-sidebar-panel" aria-label="Painel de Camadas e Ferramentas">
        <div class="cm-sidebar-resizer" id="cm-sidebar-resizer" role="separator" aria-orientation="vertical"
          aria-label="Ajustar largura do painel" tabindex="0"
          title="Arraste para ajustar a largura (duplo clique restaura)"></div>
        <div class="cm-sidebar-header">
          <ui-segmented id="cm-sidebar-segmented" tamanho="sm" valor="${this.activeTab}" style="flex: 1; margin-right: 4px;">
            <span valor="layers">🗂️ Camadas</span>
            <span valor="inspector">🔍 Inspeção</span>
            <span valor="collab">💬 Equipe</span>
          </ui-segmented>
          <ui-botao-primario inline variante="ghost" id="btn-collapse-sidebar" title="Recolher Painel Lateral" style="height: 24px; width: 24px; padding: 0; min-width: 24px; font-size: 11px;">
            ❯
          </ui-botao-primario>
        </div>
        <div class="cm-sidebar-body" id="cm-sidebar-tab-content">
          ${this.renderTabContent()}
        </div>
      </aside>
      <button class="cm-sidebar-floating-toggle" id="btn-expand-sidebar" style="display: none;" title="Expandir Painel Lateral">
        🗂️
      </button>
    `;

    this.bindEvents();
  }

  renderTabContent() {
    if (this.activeTab === 'layers') {
      return LayerTreeTab.render(this);
    } else if (this.activeTab === 'inspector') {
      return FeatureInspectorTab.render(this, 'sidebar');
    } else if (this.activeTab === 'collab') {
      return CollabAuditTab.render(this);
    }
    return '';
  }

  updateContent() {
    const body = document.getElementById('cm-sidebar-tab-content');
    if (body) {
      const existingUiCamadas = body.querySelector('#cm-ui-camadas');
      if (this.activeTab === 'layers' && existingUiCamadas) {
        // Se o Web Component já está montado, sincroniza dados sem destruição do DOM
        if (typeof existingUiCamadas.definirCamadas === 'function') {
          existingUiCamadas.definirCamadas(this.layers, this.features);
        }
      } else {
        body.innerHTML = this.renderTabContent();
        this.bindTabEvents();
      }
    }

    // A janela flutuante acompanha a seleção mesmo com outra aba ativa
    if (this.isFloating) {
      FloatingInspector.renderContent(this);
    }

    const segmented = this.container?.querySelector('#cm-sidebar-segmented');
    if (segmented && (segmented.valor !== this.activeTab && segmented.value !== this.activeTab)) {
      segmented.valor = this.activeTab;
      segmented.value = this.activeTab;
    }
  }

  bindEvents() {
    if (!this.container) return;

    const segmented = this.container.querySelector('#cm-sidebar-segmented');
    if (segmented) {
      const handleTabChange = (e) => {
        const novoValor = e.detail?.valor || e.target.value || e.target.valor;
        if (novoValor && novoValor !== this.activeTab) {
          this.activeTab = novoValor;
          this.updateContent();
        }
      };
      segmented.addEventListener('ui-change', handleTabChange);
      segmented.addEventListener('change', handleTabChange);
    }

    const btnCollapse = this.container.querySelector('#btn-collapse-sidebar');
    const btnExpand = this.container.querySelector('#btn-expand-sidebar');
    const sidebar = this.container.querySelector('#cm-sidebar-panel');

    btnCollapse?.addEventListener('click', () => this.setSidebarCollapsed(true));
    btnExpand?.addEventListener('click', () => this.setSidebarCollapsed(false));

    this.bindResizer(sidebar);
    this.bindTabEvents();
  }

  /** Alça na borda esquerda: arrastar (ou setas do teclado) ajusta a largura; duplo clique restaura. */
  bindResizer(sidebar) {
    const handle = this.container.querySelector('#cm-sidebar-resizer');
    if (!sidebar || !handle) return;

    const clamp = (w) => {
      const max = Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, window.innerWidth * 0.6));
      return Math.round(Math.min(max, Math.max(SIDEBAR_MIN_WIDTH, w)));
    };
    const apply = (w) => {
      const width = clamp(w);
      sidebar.style.width = `${width}px`;
      handle.setAttribute('aria-valuenow', String(width));
      return width;
    };
    const save = (w) => {
      try { localStorage.setItem(SIDEBAR_WIDTH_KEY, String(w)); } catch { /* armazenamento indisponível */ }
    };

    let saved = NaN;
    try { saved = parseInt(localStorage.getItem(SIDEBAR_WIDTH_KEY), 10); } catch { /* idem */ }
    // `preferred` é a escolha do usuário; `width` é o que cabe na janela atual
    let preferred = Number.isFinite(saved) ? saved : SIDEBAR_DEFAULT_WIDTH;
    let width = apply(preferred);
    const commit = (w) => {
      width = apply(w);
      preferred = width;
      save(width);
    };
    handle.setAttribute('aria-valuemin', String(SIDEBAR_MIN_WIDTH));
    handle.setAttribute('aria-valuemax', String(SIDEBAR_MAX_WIDTH));

    let startX = 0;
    let startWidth = 0;
    const onMove = (e) => {
      // O painel cresce para a esquerda: arrastar para a esquerda aumenta a largura
      width = apply(startWidth + (startX - e.clientX));
    };
    const onUp = (e) => {
      handle.releasePointerCapture?.(e.pointerId);
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
      sidebar.classList.remove('cm-sidebar--resizing');
      document.body.classList.remove('cm-resizing-x');
      commit(width);
    };
    handle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      startX = e.clientX;
      startWidth = sidebar.getBoundingClientRect().width;
      handle.setPointerCapture?.(e.pointerId);
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
      handle.addEventListener('pointercancel', onUp);
      sidebar.classList.add('cm-sidebar--resizing');
      document.body.classList.add('cm-resizing-x');
    });
    handle.addEventListener('dblclick', () => commit(SIDEBAR_DEFAULT_WIDTH));
    handle.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 40 : 10;
      if (e.key === 'ArrowLeft') commit(width + step);
      else if (e.key === 'ArrowRight') commit(width - step);
      else return;
      e.preventDefault();
    });

    // Janela menor que a largura salva: reajusta sem perder a preferência
    if (this._onWindowResize) window.removeEventListener('resize', this._onWindowResize);
    this._onWindowResize = () => { width = apply(preferred); };
    window.addEventListener('resize', this._onWindowResize);
  }

  bindTabEvents() {
    if (this.activeTab === 'layers') {
      LayerTreeTab.bindEvents(this);
    } else if (this.activeTab === 'inspector') {
      FeatureInspectorTab.bindEvents(this, document.getElementById('cm-sidebar-tab-content'));
    } else if (this.activeTab === 'collab') {
      CollabAuditTab.bindEvents(this);
    }
  }

  setSelectedFeature(feat, switchTab = false) {
    const featId = feat?.id || null;
    const currentId = this.selectedFeature?.id || null;
    // Sem feição única (currentId nulo) ainda pode haver seleção múltipla a limpar
    const idsAtuais = this.selectedFeatureIds.size;
    if (featId === currentId && !switchTab && idsAtuais === (featId ? 1 : 0)) return;
    if (featId !== currentId) this._stopVertexEditingIfActive();

    this.selectedFeature = feat;
    this.selectedFeatureIds.clear();
    if (feat) {
      this.selectedFeatureIds.add(feat.id);
      if (switchTab) {
        this.activeTab = 'inspector';
      }
    }

    const uiCamadas = this.container?.querySelector('#cm-ui-camadas');
    if (uiCamadas && typeof uiCamadas.selecionarFeicoes === 'function') {
      uiCamadas.selecionarFeicoes(Array.from(this.selectedFeatureIds), false);
      uiCamadas.lastClickedFeatureId = featId;
    }

    if (this.activeTab === 'inspector' || switchTab || this.isFloating) {
      this.updateContent();
    }
  }

  setSelectedFeatures(features = [], switchTab = false) {
    const newIds = (features || []).filter(f => f && f.id).map(f => f.id);
    const currentIds = Array.from(this.selectedFeatureIds);
    if (currentIds.length === newIds.length && newIds.every(id => this.selectedFeatureIds.has(id)) && !switchTab) {
      return;
    }

    if (!(newIds.length === 1 && newIds[0] === this.selectedFeature?.id)) this._stopVertexEditingIfActive();
    this.selectedFeatureIds.clear();
    newIds.forEach(id => this.selectedFeatureIds.add(id));
    if (features && features.length === 1) {
      this.selectedFeature = features[0];
      if (switchTab) {
        this.activeTab = 'inspector';
      }
    } else {
      this.selectedFeature = null;
    }

    const uiCamadas = this.container?.querySelector('#cm-ui-camadas');
    if (uiCamadas && typeof uiCamadas.selecionarFeicoes === 'function') {
      uiCamadas.selecionarFeicoes(Array.from(this.selectedFeatureIds), false);
      uiCamadas.lastClickedFeatureId = newIds.length > 0 ? newIds[newIds.length - 1] : null;
    }

    if (this.activeTab === 'inspector' || switchTab || this.isFloating) {
      this.updateContent();
    }
  }

  /** Liga/desliga as alças de edição de vértices no mapa para a feição inspecionada. */
  toggleVertexEditing() {
    const feat = this.getLatestFeature(this.selectedFeature?.id) || this.selectedFeature;
    if (this.isVertexEditing) {
      this.isVertexEditing = false;
      this.onStopVertexEdit();
    } else {
      if (!feat || feat.locked === true || (feat.type !== 'Polygon' && feat.type !== 'LineString' && feat.type !== 'Circle')) return;
      if (feat.type !== 'Circle' && FeatureGeometryUtils.getVertexRings(feat).length !== 1) {
        this.onStartVertexEdit(feat); // o editor do mapa exibe o aviso de multipartes
        return;
      }
      this.isVertexEditing = true;
      this.onStartVertexEdit(feat);
    }
    this._renderPreservingScroll();
  }

  _stopVertexEditingIfActive() {
    if (this.isVertexEditing) {
      this.isVertexEditing = false;
      this.onStopVertexEdit();
    }
  }

  // ---------------------------------------------------------------------------
  // Edição consistente do inspetor (colaboração em tempo real)
  // ---------------------------------------------------------------------------

  /** Versão mais recente da feição no estado do app (inclui alterações remotas). */
  getLatestFeature(featId) {
    if (!featId) return null;
    const source = (this.app && Array.isArray(this.app.features)) ? this.app.features : this.features;
    return (source || []).find(f => f.id === featId) || null;
  }

  /**
   * Aplica uma edição do inspetor sobre a versão MAIS RECENTE da feição, nunca sobre a
   * cópia exibida no painel: assim só o campo alterado é gravado e alterações de
   * colaboradores recebidas nesse meio-tempo não são desfeitas.
   * @param {string} featId
   * @param {(draft: Object) => (void|false)} mutate altera o rascunho; retornar false cancela
   * @param {{rerender?: boolean}} options rerender:false mantém o DOM (ex.: seletor de cor aberto)
   * @returns {Object|null} feição gravada
   */
  commitFeatureEdit(featId, mutate, { rerender = true } = {}) {
    const base = this.getLatestFeature(featId) || (this.selectedFeature?.id === featId ? this.selectedFeature : null);
    if (!base) return null;
    const draft = JSON.parse(JSON.stringify(base));
    if (mutate(draft) === false) return null;
    this.selectedFeature = draft;
    this._suppressInspectorRender = !rerender;
    try {
      this.onFeatureUpdate(draft);
    } finally {
      this._suppressInspectorRender = false;
    }
    // Garante o re-render mesmo se o fluxo de atualização não notificar o painel
    if (rerender) this.refreshSelectedFeature(draft, { immediate: true });
    return draft;
  }

  /**
   * Sincroniza o inspetor com uma nova versão da feição selecionada (edição local ou remota).
   * Se o usuário estiver digitando no inspetor, adia o re-render até o foco sair.
   */
  refreshSelectedFeature(feat, { immediate = false } = {}) {
    if (!feat || !this.selectedFeature || this.selectedFeature.id !== feat.id) return;
    this.selectedFeature = feat;
    if (this._suppressInspectorRender) return;
    this._renderInspectorSafely(immediate);
  }

  /** A feição exibida foi excluída (localmente ou por um colaborador). */
  handleSelectedFeatureRemoved(featId) {
    if (!this.selectedFeature || this.selectedFeature.id !== featId) return;
    this._stopVertexEditingIfActive();
    this.selectedFeature = null;
    this.selectedFeatureIds.delete(featId);
    this._renderInspectorSafely(true);
  }

  _renderInspectorSafely(immediate) {
    if (this.activeTab !== 'inspector' && !this.isFloating) return;
    if (!immediate && this._isTypingInInspector()) {
      if (!this._pendingInspectorRefresh) {
        this._pendingInspectorRefresh = true;
        const onFocusOut = () => {
          setTimeout(() => {
            if (this._isTypingInInspector()) return;
            document.removeEventListener('focusout', onFocusOut, true);
            this._pendingInspectorRefresh = false;
            this._renderPreservingScroll();
          }, 0);
        };
        document.addEventListener('focusout', onFocusOut, true);
      }
      return;
    }
    this._renderPreservingScroll();
  }

  _renderPreservingScroll() {
    const body = document.getElementById('cm-sidebar-tab-content');
    const floatBody = document.querySelector('#cm-floating-inspector-window .cm-floating-body');
    const top = body ? body.scrollTop : 0;
    const floatTop = floatBody ? floatBody.scrollTop : 0;
    this.updateContent();
    if (body) body.scrollTop = top;
    const newFloatBody = document.querySelector('#cm-floating-inspector-window .cm-floating-body');
    if (newFloatBody) newFloatBody.scrollTop = floatTop;
  }

  _isTypingInInspector() {
    let el = document.activeElement;
    if (!el || !el.closest || !el.closest('.cm-inspector-box, #cm-floating-inspector-window')) return false;
    while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
    if (!el) return false;
    if (el.tagName === 'TEXTAREA' || el.isContentEditable) return true;
    return el.tagName === 'INPUT' && !['checkbox', 'radio', 'color', 'button', 'range'].includes(el.type);
  }

  setActiveLayerId(layerId) {
    if (!layerId || this.activeLayerId === layerId) return;
    this.activeLayerId = layerId;
    const uiCamadas = this.container?.querySelector('#cm-ui-camadas');
    if (uiCamadas && uiCamadas.camadaAtivaId !== layerId) {
      uiCamadas.camadaAtivaId = layerId;
      if (typeof uiCamadas.sincronizarCamadaAtivaDOM === 'function') {
        uiCamadas.sincronizarCamadaAtivaDOM();
      }
    }
  }

  updateLayers(layers = [], features = null) {
    if (Array.isArray(layers)) {
      this.layers = layers;
      layers.forEach(l => {
        if (!this.expandedLayers.has(l.id)) {
          this.expandedLayers.add(l.id);
        }
      });
    }
    if (Array.isArray(features)) {
      this.features = features;
      if (this.selectedFeatureIds && this.selectedFeatureIds.size > 0) {
        const validIds = new Set(features.map(f => f.id));
        for (const id of this.selectedFeatureIds) {
          if (!validIds.has(id)) this.selectedFeatureIds.delete(id);
        }
      }
    }

    const uiCamadas = this.container?.querySelector('#cm-ui-camadas');
    if (uiCamadas && typeof uiCamadas.definirCamadas === 'function') {
      uiCamadas.definirCamadas(this.layers, this.features);
      if (this.activeLayerId && uiCamadas.camadaAtivaId !== this.activeLayerId) {
        uiCamadas.camadaAtivaId = this.activeLayerId;
      }
      if (this.currentBasemap && uiCamadas.mapaBaseAtivo !== this.currentBasemap) {
        uiCamadas.mapaBaseAtivo = this.currentBasemap;
      }
      if (this.selectedFeatureIds && typeof uiCamadas.selecionarFeicoes === 'function') {
        uiCamadas.selecionarFeicoes(Array.from(this.selectedFeatureIds), false);
      }
    } else if (this.activeTab === 'layers') {
      this.updateContent();
    }
  }

  updateAuditLog(auditLog = []) {
    this.auditLog = auditLog || [];
    if (this.activeTab === 'collab') {
      this.updateContent();
    }
  }

  updateFeatures(features) {
    this.features = features;
    if (this.selectedFeatureIds && this.selectedFeatureIds.size > 0) {
      const validIds = new Set(features.map(f => f.id));
      for (const id of this.selectedFeatureIds) {
        if (!validIds.has(id)) this.selectedFeatureIds.delete(id);
      }
    }
    const uiCamadas = this.container?.querySelector('#cm-ui-camadas');
    if (uiCamadas && typeof uiCamadas.definirFeicoes === 'function') {
      uiCamadas.definirFeicoes(this.features);
    } else if (this.activeTab === 'layers') {
      this.updateContent();
    }
  }

  addChatMessage(msg) {
    this.chatMessages.push(msg);
    if (this.activeTab === 'collab') {
      this.updateContent();
      const box = document.getElementById('cm-chat-messages-box');
      if (box) box.scrollTop = box.scrollHeight;
    }
  }

  toggleFloatingWindow() {
    FloatingInspector.toggle(this);
  }

  escapeHtml(str) {
    if (typeof str !== 'string') return str == null ? '' : String(str);
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  renderAccordionHeader(title, summaryPill = '') {
    return `
      <summary>
        <div class="cm-accordion-summary-left">
          <svg class="cm-accordion-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
          <span>${title}</span>
        </div>
        <div class="cm-accordion-summary-right">
          ${summaryPill ? `<span class="cm-summary-pill">${summaryPill}</span>` : ''}
        </div>
      </summary>
    `;
  }

  // Cálculos geodésicos: fonte única em FeatureGeometryUtils (área elipsoidal com furos/multipolígonos)
  calculatePolylineLength(coordinates) {
    return FeatureGeometryUtils.calculatePolylineLength(coordinates);
  }

  calculatePolygonArea(coords) {
    return FeatureGeometryUtils.calculatePolygonArea(coords);
  }

  calculatePolygonPerimeter(coords) {
    return FeatureGeometryUtils.calculatePolygonPerimeter(coords);
  }

  calculateDistance(p1, p2) {
    if (!p1 || !p2) return 0;
    return FeatureGeometryUtils.calculateDistance(p1, p2);
  }

  calculateBearing(p1, p2) {
    if (!p1 || !p2) return 0;
    const lat1 = p1[0] * Math.PI / 180;
    const lat2 = p2[0] * Math.PI / 180;
    const dLon = (p2[1] - p1[1]) * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  calculateFeatureSegments(coordinates, isClosed = false) {
    if (!Array.isArray(coordinates) || coordinates.length < 2) return [];
    const segments = [];
    const count = isClosed ? coordinates.length : coordinates.length - 1;
    for (let i = 0; i < count; i++) {
      const p1 = coordinates[i];
      const p2 = coordinates[(i + 1) % coordinates.length];
      if (!p1 || !p2) continue;
      segments.push({
        from: i + 1,
        to: (i + 1) % coordinates.length === 0 ? 1 : i + 2,
        distance: this.calculateDistance(p1, p2),
        azimuth: this.calculateBearing(p1, p2)
      });
    }
    return segments;
  }
}
