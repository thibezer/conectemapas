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

    // Callbacks
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
    this.onBulkUpdate = options.onBulkUpdate || (() => {});
    this.onBulkDelete = options.onBulkDelete || (() => {});

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
          <div class="cm-sidebar-tabs">
            <button class="cm-sidebar-tab-btn ${this.activeTab === 'layers' ? 'active' : ''}" data-tab="layers">
              🗂️ Camadas
            </button>
            <button class="cm-sidebar-tab-btn ${this.activeTab === 'inspector' ? 'active' : ''}" data-tab="inspector">
              🔍 Inspeção
            </button>
            <button class="cm-sidebar-tab-btn ${this.activeTab === 'collab' ? 'active' : ''}" data-tab="collab">
              💬 Equipe
            </button>
          </div>
        </div>
        <div class="cm-sidebar-body" id="cm-sidebar-tab-content">
          ${this.renderTabContent()}
        </div>
      </aside>
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
      body.innerHTML = this.renderTabContent();
      this.bindTabEvents();
    }

    document.querySelectorAll('.cm-sidebar-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === this.activeTab);
    });
  }

  bindEvents() {
    if (!this.container) return;

    this.container.querySelectorAll('.cm-sidebar-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.getAttribute('data-tab');
        this.updateContent();
      });
    });

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

  setSelectedFeature(feat) {
    this.selectedFeature = feat;
    if (feat) {
      this.activeTab = 'inspector';
    }
    this.updateContent();
  }

  updateLayers(layers, features = null) {
    this.layers = layers;
    if (features) {
      this.features = features;
      const validIds = new Set(features.map(f => f.id));
      for (const id of this.selectedFeatureIds) {
        if (!validIds.has(id)) this.selectedFeatureIds.delete(id);
      }
    }
    if (this.activeTab === 'layers') this.updateContent();
  }

  updateFeatures(features) {
    this.features = features;
    const validIds = new Set(features.map(f => f.id));
    for (const id of this.selectedFeatureIds) {
      if (!validIds.has(id)) this.selectedFeatureIds.delete(id);
    }
    if (this.activeTab === 'layers') this.updateContent();
  }

  updateAuditLog(log) {
    this.auditLog = log;
    if (this.activeTab === 'collab') this.updateContent();
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
