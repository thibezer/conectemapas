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

export class LayerPanel {
  constructor(options = {}) {
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
      return FeatureInspectorTab.render(this);
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

    if (btnCollapse) {
      btnCollapse.addEventListener('click', () => {
        if (sidebar) sidebar.classList.add('collapsed');
        if (btnExpand) btnExpand.style.display = 'flex';
      });
    }

    if (btnExpand) {
      btnExpand.addEventListener('click', () => {
        if (sidebar) sidebar.classList.remove('collapsed');
        if (btnExpand) btnExpand.style.display = 'none';
      });
    }

    this.bindTabEvents();
  }

  bindTabEvents() {
    if (this.activeTab === 'layers') {
      LayerTreeTab.bindEvents(this);
    } else if (this.activeTab === 'inspector') {
      FeatureInspectorTab.bindEvents(this);
    } else if (this.activeTab === 'collab') {
      CollabAuditTab.bindEvents(this);
    }
  }

  setSelectedFeature(feat, switchTab = false) {
    const featId = feat?.id || null;
    const currentId = this.selectedFeature?.id || null;
    if (featId === currentId && !switchTab) return;

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
    }

    if (this.activeTab === 'inspector' || switchTab) {
      this.updateContent();
    }
  }

  setSelectedFeatures(features = [], switchTab = false) {
    const newIds = (features || []).filter(f => f && f.id).map(f => f.id);
    const currentIds = Array.from(this.selectedFeatureIds);
    if (currentIds.length === newIds.length && newIds.every(id => this.selectedFeatureIds.has(id)) && !switchTab) {
      return;
    }

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
    }

    if (this.activeTab === 'inspector' || switchTab) {
      this.updateContent();
    }
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

  calculatePolylineLength(coordinates) {
    if (!Array.isArray(coordinates) || coordinates.length === 0) return 0;
    if (Array.isArray(coordinates[0]) && Array.isArray(coordinates[0][0])) {
      return coordinates.reduce((sum, line) => sum + this.calculateSinglePolylineLength(line), 0);
    }
    return this.calculateSinglePolylineLength(coordinates);
  }

  calculateSinglePolylineLength(coordinates) {
    let total = 0;
    for (let i = 0; i < coordinates.length - 1; i++) {
      total += this.calculateDistance(coordinates[i], coordinates[i + 1]);
    }
    return total;
  }

  calculatePolygonArea(coords) {
    if (!Array.isArray(coords) || coords.length === 0) return 0;
    if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
      return coords.reduce((sum, ring) => sum + this.calculateSinglePolygonArea(ring), 0);
    }
    return this.calculateSinglePolygonArea(coords);
  }

  calculateSinglePolygonArea(coords) {
    if (!Array.isArray(coords) || coords.length < 3) return 0;
    const R = 6378137;
    let total = 0;
    const len = coords.length;
    for (let i = 0; i < len; i++) {
      const lower = coords[i];
      const middle = coords[(i + 1) % len];
      const upper = coords[(i + 2) % len];
      const x1 = (middle[1] - lower[1]) * (Math.PI / 180);
      const y1 = (middle[0] - lower[0]) * (Math.PI / 180);
      const x2 = (upper[1] - middle[1]) * (Math.PI / 180);
      const y2 = (upper[0] - middle[0]) * (Math.PI / 180);
      total += (x1 * y2 - y1 * x2);
    }
    const area = Math.abs(total * (R * R) / 2);
    return isNaN(area) ? 0 : area;
  }

  calculateDistance(p1, p2) {
    if (!p1 || !p2) return 0;
    const R = 6371000;
    const dLat = (p2[0] - p1[0]) * Math.PI / 180;
    const dLon = (p2[1] - p1[1]) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
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
