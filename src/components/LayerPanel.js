/* ==========================================================================
   ConecteMapas - LayerPanel Component (SRP Module)
   Responsabilidade Única: Painel lateral para Gestão de Camadas Vetoriais,
   seleção de Mapa Base (TileLayer), Inspetor de Feições e Chat/Auditoria.
   ========================================================================== */

import './LayerPanel.css';
import { GeoFormats } from '../services/GeoFormats.js';
import { SpatialAlgorithms } from '../services/SpatialAlgorithms.js';
import { UIToast } from 'ui-components-kit';

export class LayerPanel {
  /**
   * @param {Object} options
   */
  constructor(options = {}) {
    this.layers = options.layers || [];
    this.features = options.features || [];
    this.activeTab = options.initialTab || 'layers'; // 'layers' | 'inspector' | 'collab'
    this.currentBasemap = options.currentBasemap || 'satelite';
    this.selectedFeature = options.selectedFeature || null;
    this.auditLog = options.auditLog || [];
    this.chatMessages = options.chatMessages || [];
    this.container = null;
    this.isVertexEditing = false;
    this.isFloating = false;

    // Estado da Árvore de Camadas (tipo Illustrator / Photoshop)
    this.expandedLayers = new Set(this.layers.map(l => l.id)); // Inicialmente expandidas
    this.activeSettingsLayerId = null;

    // Multi-seleção de feições para Ações Coletivas (Estilo Illustrator Target Circles & Shift)
    this.selectedFeatureIds = new Set();
    this.lastClickedFeatureId = null;

    this.onLayerToggle = options.onLayerToggle || (() => {});
    this.onLayerReorder = options.onLayerReorder || (() => {});
    this.onLayerOpacityChange = options.onLayerOpacityChange || (() => {});
    this.onLayerRename = options.onLayerRename || (() => {});
    this.onLayerColorChange = options.onLayerColorChange || (() => {});
    this.onLayerDelete = options.onLayerDelete || (() => {});
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

  /**
   * Obtém a lista linear de IDs de feições visíveis na árvore (Complexidade O(L + F))
   */
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

  /**
   * Gerencia seleção simples, Ctrl (toggle) e Shift (range contínuo)
   */
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

  /**
   * Renderiza a barra lateral
   * @param {HTMLElement} container
   */
  render(container) {
    this.container = container;
    this.container.innerHTML = `
      <aside class="cm-sidebar" id="cm-sidebar-panel" aria-label="Painel de Camadas e Ferramentas">
        <!-- Cabeçalho de Abas Superior Compacto -->
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

        <!-- Conteúdo da Aba Ativa -->
        <div class="cm-sidebar-body" id="cm-sidebar-tab-content">
          ${this.renderTabContent()}
        </div>
      </aside>
    `;

    this.bindEvents();
  }

  renderTabContent() {
    if (this.activeTab === 'layers') {
      return this.renderLayersTab();
    } else if (this.activeTab === 'inspector') {
      return this.renderInspectorTab();
    } else if (this.activeTab === 'collab') {
      return this.renderCollabTab();
    }
    return '';
  }

  renderLayersTab() {
    const allExpanded = this.layers.every(l => this.expandedLayers.has(l.id));
    const allVisible = this.layers.every(l => l.visible !== false);

    const selectedFeaturesList = this.features.filter(f => this.selectedFeatureIds.has(f.id));
    const hasSelection = selectedFeaturesList.length > 0;

    // Indexação O(F) de feições por camada para renderização rápida
    const featsByLayer = new Map();
    for (let i = 0; i < this.features.length; i++) {
      const f = this.features[i];
      if (!featsByLayer.has(f.layerId)) featsByLayer.set(f.layerId, []);
      featsByLayer.get(f.layerId).push(f);
    }

    // Métricas somadas para o rodapé
    let bulkMetricStr = '';
    const polySelected = selectedFeaturesList.filter(f => f.type === 'Polygon');
    if (polySelected.length > 0) {
      const sumAreaM2 = polySelected.reduce((acc, f) => acc + (this.calculatePolygonArea(f.coordinates) || 0), 0);
      bulkMetricStr = `${(sumAreaM2 / 10000).toFixed(1)} ha`;
    } else {
      const lineSelected = selectedFeaturesList.filter(f => f.type === 'LineString');
      if (lineSelected.length > 0) {
        const sumLenM = lineSelected.reduce((acc, f) => acc + (this.calculatePolylineLength(f.coordinates) || 0), 0);
        bulkMetricStr = sumLenM > 1000 ? `${(sumLenM / 1000).toFixed(1)} km` : `${sumLenM.toFixed(0)} m`;
      }
    }

    return `
      <!-- Toolbar Superior da Árvore de Camadas (Estilo Illustrator) -->
      <div class="cm-tree-toolbar">
        <div class="cm-tree-title-group">
          <span class="cm-tree-section-title">CAMADAS</span>
          <span class="cm-tree-count-badge">${this.layers.length}</span>
        </div>
        <div class="cm-tree-actions">
          <button id="btn-toggle-all-vis" class="cm-tree-action-btn" title="${allVisible ? 'Ocultar Todas as Camadas' : 'Exibir Todas as Camadas'}">
            ${allVisible ? '👁️' : '🚫'}
          </button>
          <button id="btn-toggle-all-expand" class="cm-tree-action-btn" title="${allExpanded ? 'Recolher Todos os Grupos' : 'Expandir Todos os Grupos'}">
            ${allExpanded ? '📁' : '📂'}
          </button>
          <button id="btn-add-layer" class="cm-tree-btn-new" title="Adicionar nova camada vetorial">
            + Camada
          </button>
        </div>
      </div>

      <!-- Estrutura Unificada da Árvore + Rodapé Illustrator -->
      <div class="cm-ai-panel-box">
        <!-- Tabela Hierárquica Estilo Adobe Illustrator (Linhas de 24px) -->
        <div class="cm-ai-layer-tree" id="cm-ai-layer-tree-mount">
          ${this.layers.map((layer, index) => {
            const safeName = this.escapeHtml(layer.name || 'Camada');
            const safeId = this.escapeHtml(layer.id || '');
            const safeColor = this.escapeHtml(layer.color || '#00E08A');
            const isVisible = layer.visible !== false;
            const isLocked = layer.locked === true;
            const isExpanded = this.expandedLayers.has(layer.id);

            const layerFeatures = featsByLayer.get(layer.id) || [];
            const layerSelectedCount = layerFeatures.filter(f => this.selectedFeatureIds.has(f.id)).length;
            const isLayerFullySelected = layerFeatures.length > 0 && layerSelectedCount === layerFeatures.length;
            const isLayerPartiallySelected = layerSelectedCount > 0 && !isLayerFullySelected;

            return `
            <div class="cm-ai-layer-group ${!isVisible ? 'ai-dimmed' : ''}" data-layer-id="${safeId}">
              <!-- Linha da Camada Pai (Altura estrita 24px) -->
              <div class="cm-ai-row cm-ai-layer-row ${isLayerFullySelected ? 'ai-selected' : ''}">
                <!-- Col 1: Olho / Visibilidade -->
                <div class="cm-ai-col cm-ai-col-eye" data-layer-eye="${safeId}" title="${isVisible ? 'Ocultar Camada' : 'Exibir Camada'}">
                  ${isVisible ? `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>` : `<span class="cm-ai-hidden-dot">·</span>`}
                </div>

                <!-- Col 2: Cadeado / Trava -->
                <div class="cm-ai-col cm-ai-col-lock" data-layer-lock="${safeId}" title="${isLocked ? 'Desbloquear Camada' : 'Bloquear Camada'}">
                  ${isLocked ? `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#f59e0b" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>` : ''}
                </div>

                <!-- Col 3: Faixa de Cor Vertical da Camada -->
                <div class="cm-ai-col-colorbar" style="background: ${safeColor};"></div>

                <!-- Col 4: Chevron Expansor -->
                <div class="cm-ai-col cm-ai-col-chevron" data-layer-expand="${safeId}" title="Expandir/Recolher sub-elementos">
                  <svg class="cm-ai-chevron-svg ${isExpanded ? 'open' : ''}" viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </div>

                <!-- Col 5: Miniatura do Grupo / Camada -->
                <div class="cm-ai-col cm-ai-col-thumb">
                  <div class="cm-ai-thumb-box" style="border-color: ${safeColor};">
                    <svg viewBox="0 0 16 16" width="10" height="10">
                      <rect x="2" y="2" width="12" height="12" rx="1.5" fill="${safeColor}" fill-opacity="0.3" stroke="${safeColor}" stroke-width="1.2"/>
                    </svg>
                  </div>
                </div>

                <!-- Col 6: Nome da Camada -->
                <div class="cm-ai-col cm-ai-col-name" data-layer-name-click="${safeId}" title="${safeName}">
                  <span class="cm-ai-name-text">${safeName}</span>
                  <span class="cm-ai-subcount">(${layerFeatures.length})</span>
                </div>

                <!-- Col 7: Ações Rápidas (Reordenação & Config) -->
                <div class="cm-ai-col cm-ai-col-actions">
                  <button class="cm-ai-micro-btn" data-layer-up="${index}" title="Trazer para cima" ${index === 0 ? 'disabled' : ''}>▲</button>
                  <button class="cm-ai-micro-btn" data-layer-down="${index}" title="Mover para baixo" ${index === this.layers.length - 1 ? 'disabled' : ''}>▼</button>
                  <button class="cm-ai-micro-btn" data-layer-settings="${safeId}" title="Opacidade & Cor">⚙️</button>
                </div>

                <!-- Col 8: Alvo de Seleção (Illustrator Target Circle) -->
                <div class="cm-ai-col cm-ai-col-target" data-layer-target="${safeId}" title="Selecionar todos os itens da camada (Shift para seleção múltipla)">
                  <div class="cm-ai-target-circle ${isLayerFullySelected ? 'selected' : (isLayerPartiallySelected ? 'partial' : '')}"></div>
                </div>
              </div>

              <!-- Painel de Configurações da Camada se aberto -->
              ${this.activeSettingsLayerId === safeId ? `
                <div class="cm-layer-settings-box">
                  <div class="cm-layer-settings-row">
                    <span class="cm-settings-label">Opacidade:</span>
                    <input type="range" class="cm-native-range" min="0.1" max="1" step="0.05" value="${layer.opacity ?? 1}" data-layer-opacity-slider="${safeId}" style="flex: 1;" />
                    <span class="cm-summary-pill" id="badge-op-${safeId}">${Math.round((layer.opacity ?? 1) * 100)}%</span>
                  </div>
                  <div class="cm-layer-settings-row">
                    <span class="cm-settings-label">Cor da Camada:</span>
                    <input type="color" class="cm-color-picker-input" value="${safeColor}" data-layer-color-picker="${safeId}" />
                    <input type="text" class="cm-settings-text-input" value="${safeName}" data-layer-rename-input="${safeId}" placeholder="Nome da camada" style="flex: 1;" />
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                    <button class="cm-settings-btn btn-apply-layer-name" data-save-layer-name="${safeId}">✔ Salvar Nome</button>
                    ${this.layers.length > 1 ? `
                      <button class="cm-settings-btn btn-danger-layer" data-delete-layer="${safeId}">🗑️ Excluir Camada</button>
                    ` : ''}
                  </div>
                </div>
              ` : ''}

              <!-- Sub-linhas: Feições Filhas (Altura estrita 24px cada) -->
              ${isExpanded ? `
                <div class="cm-ai-sub-tree">
                  ${layerFeatures.map(feat => {
                    const featName = this.escapeHtml(feat.name || 'Feição');
                    const featId = this.escapeHtml(feat.id || '');
                    const featColor = this.escapeHtml(feat.style?.fillColor || feat.color || safeColor);
                    const isFeatVisible = feat.visible !== false;
                    const isFeatLocked = feat.locked === true;
                    const isFeatSelected = this.selectedFeatureIds.has(feat.id);

                    // Miniatura SVG de acordo com a geometria
                    let thumbSvg = '';
                    if (feat.type === 'Polygon') {
                      thumbSvg = `<svg viewBox="0 0 16 16" width="10" height="10"><polygon points="8,1 15,6 12,15 4,15 1,6" fill="${featColor}" fill-opacity="0.4" stroke="${featColor}" stroke-width="1.2"/></svg>`;
                    } else if (feat.type === 'LineString') {
                      thumbSvg = `<svg viewBox="0 0 16 16" width="10" height="10"><path d="M2,14 Q8,2 14,8" fill="none" stroke="${featColor}" stroke-width="2"/></svg>`;
                    } else if (feat.type === 'Point') {
                      thumbSvg = `<svg viewBox="0 0 16 16" width="10" height="10"><circle cx="8" cy="8" r="4.5" fill="${featColor}" stroke="#ffffff" stroke-width="1.2"/></svg>`;
                    } else {
                      thumbSvg = `<svg viewBox="0 0 16 16" width="10" height="10"><circle cx="8" cy="8" r="5.5" fill="${featColor}" fill-opacity="0.3" stroke="${featColor}" stroke-width="1.2"/></svg>`;
                    }

                    return `
                      <div class="cm-ai-row cm-ai-feat-row ${isFeatSelected ? 'ai-selected' : ''} ${!isFeatVisible ? 'ai-dimmed' : ''}" data-feat-row="${featId}">
                        <!-- Col 1: Olho -->
                        <div class="cm-ai-col cm-ai-col-eye" data-feat-eye="${featId}" title="${isFeatVisible ? 'Ocultar' : 'Exibir'}">
                          ${isFeatVisible ? `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>` : `<span class="cm-ai-hidden-dot">·</span>`}
                        </div>

                        <!-- Col 2: Cadeado -->
                        <div class="cm-ai-col cm-ai-col-lock" data-feat-lock="${featId}" title="${isFeatLocked ? 'Desbloquear' : 'Bloquear'}">
                          ${isFeatLocked ? `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#f59e0b" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>` : ''}
                        </div>

                        <!-- Col 3: Faixa de Cor -->
                        <div class="cm-ai-col-colorbar" style="background: ${featColor};"></div>

                        <!-- Col 4: Indentação de Sub-ramo -->
                        <div class="cm-ai-col cm-ai-col-branch">
                          <span class="cm-ai-branch-line">└</span>
                        </div>

                        <!-- Col 5: Miniatura Vetorial -->
                        <div class="cm-ai-col cm-ai-col-thumb">
                          <div class="cm-ai-thumb-box" style="border-color: rgba(255,255,255,0.15);">
                            ${thumbSvg}
                          </div>
                        </div>

                        <!-- Col 6: Nome da Feição -->
                        <div class="cm-ai-col cm-ai-col-name" data-feat-select="${featId}" title="${featName}">
                          <span class="cm-ai-name-text">${featName}</span>
                        </div>

                        <!-- Col 7: Botão de Foco / Alvo -->
                        <div class="cm-ai-col cm-ai-col-actions">
                          <button class="cm-ai-micro-btn" data-feat-fit="${featId}" title="Enquadrar no mapa">🎯</button>
                        </div>

                        <!-- Col 8: Círculo de Seleção (Target Circle) -->
                        <div class="cm-ai-col cm-ai-col-target" data-feat-target="${featId}" title="Selecionar feição (Segure Shift para selecionar intervalo)">
                          <div class="cm-ai-target-circle ${isFeatSelected ? 'selected' : ''}"></div>
                        </div>
                      </div>
                    `;
                  }).join('')}

                  ${layerFeatures.length === 0 ? `
                    <div class="cm-ai-empty-row">
                      <span>Nenhum elemento neste grupo</span>
                    </div>
                  ` : ''}
                </div>
              ` : ''}
            </div>
          `;
          }).join('')}
        </div>

        <!-- Rodapé Estilo Adobe Illustrator (20px de Altura, Fixo Abaixo da Árvore) -->
        <div class="cm-ai-tree-footer">
          <div class="cm-ai-footer-left">
            <span class="cm-ai-footer-label">${hasSelection ? `${selectedFeaturesList.length} Selecionado${selectedFeaturesList.length > 1 ? 's' : ''}` : `${this.layers.length} Camadas`}</span>
            ${bulkMetricStr ? `<span class="cm-ai-footer-metric">• ${bulkMetricStr}</span>` : ''}
          </div>
          <div class="cm-ai-footer-right">
            <!-- Alternar Visibilidade Coletiva -->
            <button class="cm-ai-footer-btn ${!hasSelection ? 'disabled' : ''}" id="btn-footer-vis" title="Alternar visibilidade coletiva" ${!hasSelection ? 'disabled' : ''}>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            </button>

            <!-- Alternar Trava Coletiva -->
            <button class="cm-ai-footer-btn ${!hasSelection ? 'disabled' : ''}" id="btn-footer-lock" title="Alternar bloqueio coletivo" ${!hasSelection ? 'disabled' : ''}>
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            </button>

            <!-- Seletor de Cor Coletivo Swatch -->
            <div class="cm-ai-footer-color-wrapper ${!hasSelection ? 'disabled' : ''}" title="Alterar cor dos selecionados">
              <input type="color" id="input-footer-color" value="#00E08A" class="cm-ai-footer-color" ${!hasSelection ? 'disabled' : ''} />
            </div>

            <!-- Mover para Camada -->
            <div class="cm-ai-footer-move-wrapper ${!hasSelection ? 'disabled' : ''}" title="Mover selecionados para outra camada">
              <select id="select-footer-move-layer" class="cm-ai-footer-select" ${!hasSelection ? 'disabled' : ''}>
                <option value="" disabled selected>📁</option>
                ${this.layers.map(l => `<option value="${l.id}">${l.name}</option>`).join('')}
              </select>
            </div>

            <!-- Criar Nova Camada [+] (Ícone Illustrator) -->
            <button class="cm-ai-footer-btn" id="btn-footer-new-layer" title="Criar Nova Camada">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
            </button>

            <!-- Excluir Selecionados [🗑️] (Ícone Illustrator) -->
            <button class="cm-ai-footer-btn ${!hasSelection ? 'disabled' : ''}" id="btn-footer-del" title="Excluir selecionados" ${!hasSelection ? 'disabled' : ''}>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>

            ${hasSelection ? `
              <!-- Limpar Seleção [✕] -->
              <button class="cm-ai-footer-btn" id="btn-footer-clear" title="Limpar seleção">
                ✕
              </button>
            ` : ''}
          </div>
        </div>
      </div>

      <!-- Seção: Mapa Base -->
      <div class="cm-sidebar-section-header" style="margin-top: 10px;">
        <span class="cm-sidebar-section-title">Mapa Base</span>
      </div>

      <div class="cm-basemap-grid">
        <div class="cm-basemap-card ${this.currentBasemap === 'google_satelite' ? 'active' : ''}" data-basemap="google_satelite" title="Google Maps Satélite / Híbrido">
          <img src="https://images.unsplash.com/photo-1524661135-423995f22d0b?w=160&auto=format&fit=crop&q=80" alt="Google Satélite" />
          <span>🛰️ Google Satélite</span>
        </div>

        <div class="cm-basemap-card ${this.currentBasemap === 'satelite' ? 'active' : ''}" data-basemap="satelite" title="Satélite de Alta Resolução Esri">
          <img src="https://images.unsplash.com/photo-1508873696983-2df5293cb32b?w=160&auto=format&fit=crop&q=80" alt="Esri Satélite" />
          <span>🛰️ Esri Satélite</span>
        </div>

        <div class="cm-basemap-card ${this.currentBasemap === 'osm' ? 'active' : ''}" data-basemap="osm" title="Mapa Urbano OpenStreetMap">
          <img src="https://images.unsplash.com/photo-1569336415962-a4bd9f69cd83?w=160&auto=format&fit=crop&q=80" alt="OSM" />
          <span>🗺️ OpenStreet</span>
        </div>

        <div class="cm-basemap-card ${this.currentBasemap === 'topografia' ? 'active' : ''}" data-basemap="topografia" title="Mapa de Curvas de Nível e Relevo">
          <img src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=160&auto=format&fit=crop&q=80" alt="Topografia" />
          <span>⛰️ Topografia</span>
        </div>

        <div class="cm-basemap-card ${this.currentBasemap === 'dark' ? 'active' : ''}" data-basemap="dark" title="Mapa Escuro Esri Dark Canvas">
          <img src="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=160&auto=format&fit=crop&q=80" alt="Dark" />
          <span>🌑 Dark Canvas</span>
        </div>
      </div>
    `;
  }

  escapeHtml(str) {
    if (typeof str !== 'string') return str == null ? '' : String(str);
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
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

  renderInspectorTab() {
    if (!this.selectedFeature) {
      return `
        <div style="text-align: center; padding: 24px 10px; color: var(--cm-text-muted);">
          <div style="font-size: 24px; margin-bottom: 8px;">📍</div>
          <div style="font-weight: 500; font-size: 12px; color: var(--cm-text);">Nenhum elemento selecionado</div>
          <div style="font-size: 11px; margin-top: 4px;">Clique em uma feição no mapa ou na tabela para abrir o Workbench CAD/GIS.</div>
        </div>
      `;
    }

    const feat = this.selectedFeature;
    const isLocked = feat.locked === true;
    const safeName = this.escapeHtml(feat.name || '');
    const safeDesc = this.escapeHtml(feat.description || '');
    const safeCategory = this.escapeHtml(feat.category || feat.type || 'Geral');
    const safeId = this.escapeHtml(feat.id || '');

    const isPoly = feat.type === 'Polygon';
    const isCircle = feat.type === 'Circle';
    const isLine = feat.type === 'LineString';
    const isPoint = feat.type === 'Point';

    const defaultColor = feat.color || '#00E08A';
    const style = {
      fillColor: feat.style?.fillColor || defaultColor,
      fillOpacity: feat.style?.fillOpacity !== undefined ? Number(feat.style.fillOpacity) : (isLine ? 1 : 0.35),
      strokeColor: feat.style?.strokeColor || defaultColor,
      strokeWidth: feat.style?.strokeWidth !== undefined ? Number(feat.style.strokeWidth) : 2.5,
      strokeDashArray: feat.style?.strokeDashArray || '',
      markerIcon: feat.style?.markerIcon || 'pin',
      markerSize: feat.style?.markerSize !== undefined ? Number(feat.style.markerSize) : 24,
      markerRotation: feat.style?.markerRotation !== undefined ? Number(feat.style.markerRotation) : 0,
      showLabel: feat.style?.showLabel === true,
      labelField: feat.style?.labelField || 'name'
    };

    const coordinates = Array.isArray(feat.coordinates) ? feat.coordinates : [];
    const isMultiGeom = Array.isArray(coordinates[0]) && Array.isArray(coordinates[0][0]);
    const flattenedPoints = isMultiGeom ? coordinates.flat() : coordinates;
    const hasVertices = (isPoly || isLine) && flattenedPoints.length > 0;
    const segments = hasVertices && !isMultiGeom ? this.calculateFeatureSegments(coordinates, isPoly) : [];

    // Conversões de Área e Extensão
    let areaM2 = 0;
    let lengthM = 0;
    if (isPoly && (coordinates.length >= 3 || (isMultiGeom && flattenedPoints.length >= 3))) {
      areaM2 = this.calculatePolygonArea(coordinates);
    } else if (isCircle) {
      areaM2 = Math.PI * (feat.radius || 0) * (feat.radius || 0);
    } else if (isLine && (coordinates.length >= 2 || (isMultiGeom && flattenedPoints.length >= 2))) {
      lengthM = this.calculatePolylineLength(coordinates);
    }

    const areaConversions = SpatialAlgorithms.convertArea(areaM2);
    const lengthConversions = SpatialAlgorithms.convertLength(lengthM);

    // Centroide / Coordenadas de Referência
    let refCoord = [0, 0];
    if (isPoint || isCircle) {
      refCoord = coordinates;
    } else if (flattenedPoints.length > 0) {
      refCoord = [
        flattenedPoints.reduce((acc, c) => acc + c[0], 0) / flattenedPoints.length,
        flattenedPoints.reduce((acc, c) => acc + c[1], 0) / flattenedPoints.length
      ];
    }
    const dmsLat = SpatialAlgorithms.ddToDms(refCoord[0], true);
    const dmsLng = SpatialAlgorithms.ddToDms(refCoord[1], false);

    const customAttrs = Array.isArray(feat.customAttributes) ? feat.customAttributes : [];
    const historyList = Array.isArray(feat.history) ? feat.history : [];
    const layerName = this.layers.find(l => l.id === feat.layerId)?.name || 'Padrão';
    let dimSummary = 'Ponto';
    if (isPoly) dimSummary = `${areaConversions.ha} ha`;
    else if (isLine) dimSummary = `${lengthConversions.km} km`;
    else if (isCircle) dimSummary = `R: ${feat.radius || 50}m`;

    return `
      <div class="cm-inspector-box">
        <!-- Topo da Feição: Header Card com Toolbar Integrada (Workbench B2B) -->
        <div class="cm-inspector-header-card">
          <div class="cm-inspector-header-top">
            <div style="display: flex; align-items: center; gap: 6px;">
              <ui-badge variante="primario">${safeCategory}</ui-badge>
              ${isLocked ? `<span class="cm-locked-badge">🔒 Bloqueado</span>` : `<span class="cm-summary-pill" style="color: var(--cm-primary); font-weight: 600;">${dimSummary}</span>`}
            </div>
            <div class="cm-inspector-quick-toolbar">
              <button 
                id="btn-toggle-lock" 
                class="cm-quick-tool-btn ${isLocked ? 'active-lock' : ''}" 
                title="${isLocked ? 'Desbloquear Feição' : 'Bloquear Feição contra Edições'}">
                ${isLocked ? '🔒 Bloqueado' : '🔓 Livre'}
              </button>
              <button 
                id="btn-toggle-float" 
                class="cm-quick-tool-btn" 
                title="Destacar Inspetor em Janela Flutuante (Workbench)">
                🪟
              </button>
              <button 
                id="btn-fit-feature" 
                class="cm-quick-tool-btn" 
                title="Enquadrar no Mapa (Fit Bounds)">
                🎯
              </button>
              <button 
                id="btn-delete-inspector" 
                class="cm-quick-tool-btn btn-danger" 
                title="Excluir Feição (com Desfazer)">
                🗑️
              </button>
            </div>
          </div>
          <div style="font-size: 10px; color: var(--cm-text-muted); font-family: var(--cm-fonte-mono); display: flex; justify-content: space-between;">
            <span>ID: ${safeId}</span>
            <span>Camada: ${this.escapeHtml(layerName)}</span>
          </div>
        </div>

        <!-- 1. ACORDEÃO: 📌 IDENTIFICAÇÃO & CAMADA -->
        <details class="cm-inspector-accordion" open>
          ${this.renderAccordionHeader('📌 Identificação & Camada', this.escapeHtml(layerName))}
          <div class="cm-accordion-content">
            <ui-campo-texto id="inspector-feat-name" label="Nome do Elemento" value="${safeName}" ${isLocked ? 'desabilitado' : ''} obrigatorio></ui-campo-texto>
            <ui-campo-texto id="inspector-feat-desc" label="Descrição / Observações" value="${safeDesc}" ${isLocked ? 'desabilitado' : ''}></ui-campo-texto>
            
            <div class="cm-param-row">
              <span class="cm-param-label">Camada:</span>
              <select class="cm-native-select" id="inspector-feat-layer" style="width: 170px;" ${isLocked ? 'disabled' : ''}>
                ${this.layers.map(l => `
                  <option value="${l.id}" ${feat.layerId === l.id ? 'selected' : ''}>${this.escapeHtml(l.name)}</option>
                `).join('')}
              </select>
            </div>
          </div>
        </details>

        <!-- 2. ACORDEÃO: 🎨 APARÊNCIA & SIMBOLOGIA -->
        <details class="cm-inspector-accordion" open>
          ${this.renderAccordionHeader('🎨 Aparência & Simbologia', isPoint ? `${style.markerIcon} • ${style.markerSize}px` : `<span style="background:${style.fillColor}; width:8px; height:8px; border-radius:2px; display:inline-block; vertical-align:middle; margin-right:3px;"></span>${Math.round(style.fillOpacity * 100)}% • ${style.strokeWidth}px`)}
          <div class="cm-accordion-content">
            ${(isPoly || isCircle) ? `
              <div class="cm-param-row">
                <span class="cm-param-label">Preenchimento:</span>
                <div class="cm-color-input-wrapper">
                  <input type="color" class="cm-color-picker" id="style-fill-color" value="${style.fillColor}" ${isLocked ? 'disabled' : ''} />
                  <span class="cm-param-badge" id="val-fill-color-hex">${style.fillColor}</span>
                </div>
              </div>

              <div class="cm-param-row">
                <span class="cm-param-label">Opacidade:</span>
                <input type="range" class="cm-param-slider" id="style-fill-opacity" min="0" max="1" step="0.05" value="${style.fillOpacity}" ${isLocked ? 'disabled' : ''} />
                <span class="cm-param-badge" id="val-fill-opacity">${Math.round(style.fillOpacity * 100)}%</span>
              </div>
            ` : ''}

            ${(isPoly || isCircle || isLine) ? `
              <div class="cm-param-row">
                <span class="cm-param-label">Contorno:</span>
                <div class="cm-color-input-wrapper">
                  <input type="color" class="cm-color-picker" id="style-stroke-color" value="${style.strokeColor}" ${isLocked ? 'disabled' : ''} />
                  <span class="cm-param-badge" id="val-stroke-color-hex">${style.strokeColor}</span>
                </div>
              </div>

              <div class="cm-param-row">
                <span class="cm-param-label">Espessura:</span>
                <input type="range" class="cm-param-slider" id="style-stroke-width" min="1" max="10" step="0.5" value="${style.strokeWidth}" ${isLocked ? 'disabled' : ''} />
                <span class="cm-param-badge" id="val-stroke-width">${style.strokeWidth}px</span>
              </div>

              <div class="cm-param-row">
                <span class="cm-param-label">Padrão:</span>
                <select class="cm-native-select" id="style-stroke-dash" style="width: 140px;" ${isLocked ? 'disabled' : ''}>
                  <option value="" ${style.strokeDashArray === '' ? 'selected' : ''}>Sólida (Contínua)</option>
                  <option value="6, 6" ${style.strokeDashArray === '6, 6' ? 'selected' : ''}>Tracejada (---)</option>
                  <option value="2, 4" ${style.strokeDashArray === '2, 4' ? 'selected' : ''}>Pontilhada (···)</option>
                </select>
              </div>
            ` : ''}

            ${isPoint ? `
              <div class="cm-param-row">
                <span class="cm-param-label">Cor Marcador:</span>
                <div class="cm-color-input-wrapper">
                  <input type="color" class="cm-color-picker" id="style-point-color" value="${style.fillColor}" ${isLocked ? 'disabled' : ''} />
                  <span class="cm-param-badge" id="val-point-color-hex">${style.fillColor}</span>
                </div>
              </div>

              <div class="cm-param-row">
                <span class="cm-param-label">Ícone Vetorial:</span>
                <select class="cm-native-select" id="style-marker-icon" style="width: 140px;" ${isLocked ? 'disabled' : ''}>
                  <option value="pin" ${style.markerIcon === 'pin' ? 'selected' : ''}>📌 Pino Padrão</option>
                  <option value="tower" ${style.markerIcon === 'tower' ? 'selected' : ''}>🗼 Base RTK / Torre</option>
                  <option value="tree" ${style.markerIcon === 'tree' ? 'selected' : ''}>🌲 Reserva / APP</option>
                  <option value="warning" ${style.markerIcon === 'warning' ? 'selected' : ''}>⚠️ Alerta / Inspeção</option>
                  <option value="water" ${style.markerIcon === 'water' ? 'selected' : ''}>💧 Hidrografia / Nascente</option>
                  <option value="boundary" ${style.markerIcon === 'boundary' ? 'selected' : ''}>🏛️ Marco Topográfico</option>
                </select>
              </div>

              <div class="cm-param-row">
                <span class="cm-param-label">Tamanho:</span>
                <input type="range" class="cm-param-slider" id="style-marker-size" min="16" max="48" step="2" value="${style.markerSize}" ${isLocked ? 'disabled' : ''} />
                <span class="cm-param-badge" id="val-marker-size">${style.markerSize}px</span>
              </div>

              <div class="cm-param-row">
                <span class="cm-param-label">Rotação:</span>
                <input type="range" class="cm-param-slider" id="style-marker-rot" min="0" max="360" step="5" value="${style.markerRotation}" ${isLocked ? 'disabled' : ''} />
                <span class="cm-param-badge" id="val-marker-rot">${style.markerRotation}°</span>
              </div>
            ` : ''}

            <!-- Rótulo no Mapa -->
            <div class="cm-param-row" style="border-top: 1px dashed rgba(255,255,255,0.06); padding-top: 6px;">
              <span class="cm-param-label">Rótulo no Mapa:</span>
              <div style="display: flex; align-items: center; gap: 8px;">
                <select class="cm-native-select" id="style-label-field" style="width: 110px;" ${isLocked ? 'disabled' : ''}>
                  <option value="name" ${style.labelField === 'name' ? 'selected' : ''}>Nome</option>
                  <option value="category" ${style.labelField === 'category' ? 'selected' : ''}>Categoria</option>
                  ${isPoly ? `<option value="area" ${style.labelField === 'area' ? 'selected' : ''}>Área (ha)</option>` : ''}
                  ${isLine ? `<option value="extensao" ${style.labelField === 'extensao' ? 'selected' : ''}>Extensão</option>` : ''}
                </select>
                <ui-switch ${style.showLabel ? 'checked' : ''} id="style-show-label" ${isLocked ? 'desabilitado' : ''}></ui-switch>
              </div>
            </div>
          </div>
        </details>

        <!-- 3. ACORDEÃO: 📐 VÉRTICES & AZIMUTES -->
        <details class="cm-inspector-accordion">
          ${this.renderAccordionHeader('📐 Geometria & Vértices', `${hasVertices ? coordinates.length : 1} nós`)}
          <div class="cm-accordion-content">
            <div style="display: flex; justify-content: flex-end;">
              <ui-botao-primario 
                inline 
                id="btn-toggle-vertex-edit" 
                variante="${this.isVertexEditing ? 'primary' : 'secundario'}" 
                style="height: 24px; font-size: 10.5px; padding: 0 8px;"
                ${isLocked ? 'desabilitado' : ''}>
                ${this.isVertexEditing ? '✔ Concluir Edição' : '✏️ Editar Vértices no Mapa'}
              </ui-botao-primario>
            </div>

            ${hasVertices ? `
              <!-- Tabela de Vértices -->
              <details class="cm-vertex-details" open>
                <summary class="cm-vertex-summary">📍 Coordenadas dos Vértices (${coordinates.length})</summary>
                <div class="cm-vertex-list-scroll">
                  ${coordinates.map((pt, idx) => `
                    <div class="cm-vertex-row" data-vertex-idx="${idx}">
                      <span class="cm-vertex-badge">V${idx + 1}</span>
                      <input type="number" step="0.00001" class="cm-vertex-input" data-v-lat="${idx}" value="${Number(pt[0]).toFixed(5)}" ${isLocked ? 'disabled' : ''} />
                      <input type="number" step="0.00001" class="cm-vertex-input" data-v-lng="${idx}" value="${Number(pt[1]).toFixed(5)}" ${isLocked ? 'disabled' : ''} />
                      ${!isLocked ? `<button class="cm-vertex-del-btn" data-v-del="${idx}" title="Excluir Vértice">×</button>` : ''}
                    </div>
                  `).join('')}
                </div>
              </details>

              <!-- Métricas de Segmento -->
              <details class="cm-vertex-details">
                <summary class="cm-vertex-summary">🧭 Azimutes & Distâncias das Arestas</summary>
                <div class="cm-vertex-list-scroll" style="max-height: 110px;">
                  ${segments.map(seg => `
                    <div class="cm-segment-row">
                      <span style="color: var(--cm-primary); font-weight: 600;">V${seg.from} ➔ V${seg.to}</span>
                      <span>Az: <strong>${seg.azimuth.toFixed(1)}°</strong></span>
                      <span style="color: var(--cm-text-muted);">${seg.distance > 1000 ? (seg.distance/1000).toFixed(2) + ' km' : seg.distance.toFixed(1) + ' m'}</span>
                    </div>
                  `).join('')}
                </div>
              </details>
            ` : ''}

            <!-- Botões de Cópia Rápida -->
            <div style="display: flex; gap: 4px; border-top: 1px dashed rgba(255,255,255,0.06); padding-top: 6px;">
              <ui-botao-primario inline id="btn-copy-wkt" variante="secundario" style="flex: 1; height: 24px; font-size: 10px;" title="Copiar WKT">📋 WKT</ui-botao-primario>
              <ui-botao-primario inline id="btn-copy-geojson" variante="secundario" style="flex: 1; height: 24px; font-size: 10px;" title="Copiar GeoJSON">📋 GeoJSON</ui-botao-primario>
              <ui-botao-primario inline id="btn-copy-coord-csv" variante="secundario" style="flex: 1; height: 24px; font-size: 10px;" title="Copiar CSV de Nós">📋 CSV</ui-botao-primario>
            </div>
          </div>
        </details>

        <!-- 4. ACORDEÃO: 🛠️ MICRO-FERRAMENTAS ESPACIAIS (CAD/GIS) -->
        <details class="cm-inspector-accordion">
          ${this.renderAccordionHeader('🛠️ Micro-ferramentas Espaciais', 'Buffer • DP • Clone')}
          <div class="cm-accordion-content">
            <!-- Ferramenta: Buffer Paramétrico -->
            <div class="cm-spatial-tool-card">
              <div class="cm-spatial-tool-header">
                <span>🔄 Zona de Amortecimento (Buffer)</span>
              </div>
              <div style="display: flex; gap: 6px; align-items: center;">
                <input 
                  type="number" 
                  id="buffer-radius-input" 
                  class="cm-native-select" 
                  style="width: 80px; height: 26px; padding: 0 6px;" 
                  value="50" 
                  min="1" 
                  max="10000" 
                  step="5"
                  title="Raio do Buffer em metros" />
                <span style="font-size: 10.5px; color: var(--cm-text-muted);">metros</span>
                <ui-botao-primario inline id="btn-generate-buffer" variante="secundario" style="flex: 1; height: 26px; font-size: 10.5px;">
                  Criar Buffer
                </ui-botao-primario>
              </div>
            </div>

            <!-- Ferramenta: Simplificação Douglas-Peucker -->
            ${(isPoly || isLine) ? `
              <div class="cm-spatial-tool-card">
                <div class="cm-spatial-tool-header">
                  <span>📉 Simplificar Nós (Douglas-Peucker)</span>
                  <span id="dp-tolerance-val" style="color: var(--cm-primary); font-family: var(--cm-fonte-mono);">5m</span>
                </div>
                <div style="display: flex; gap: 6px; align-items: center;">
                  <input type="range" id="dp-tolerance-slider" class="cm-param-slider" min="1" max="50" step="1" value="5" />
                  <ui-botao-primario inline id="btn-simplify-dp" variante="secundario" style="height: 26px; font-size: 10.5px; padding: 0 8px;" ${isLocked ? 'desabilitado' : ''}>
                    Simplificar
                  </ui-botao-primario>
                </div>
              </div>
            ` : ''}

            <!-- Ferramenta: Duplicar Feição -->
            <div style="display: flex; justify-content: flex-end;">
              <ui-botao-primario inline id="btn-duplicate-feat" variante="secundario" style="height: 24px; font-size: 10.5px; width: 100%;">
                📑 Duplicar Feição (+30m offset)
              </ui-botao-primario>
            </div>
          </div>
        </details>

        <!-- 5. ACORDEÃO: 📋 ATRIBUTOS PERSONALIZADOS -->
        <details class="cm-inspector-accordion">
          ${this.renderAccordionHeader('📋 Atributos Personalizados', `${customAttrs.length} campos`)}
          <div class="cm-accordion-content">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 10px; color: var(--cm-text-muted);">Pares Chave / Valor</span>
              <button id="btn-add-custom-attr" class="cm-native-select" style="padding: 1px 6px; font-size: 10px;" ${isLocked ? 'disabled' : ''}>
                + Adicionar
              </button>
            </div>

            <div id="cm-custom-attr-list" style="display: flex; flex-direction: column; gap: 4px;">
              ${customAttrs.map((attr, idx) => `
                <div class="cm-custom-attr-row" data-attr-idx="${idx}">
                  <input type="text" class="cm-custom-attr-input attr-key" placeholder="Campo" value="${this.escapeHtml(attr.key)}" ${isLocked ? 'disabled' : ''} />
                  <input type="text" class="cm-custom-attr-input attr-val" placeholder="Valor" value="${this.escapeHtml(attr.value)}" ${isLocked ? 'disabled' : ''} />
                  ${!isLocked ? `<button class="cm-vertex-del-btn btn-del-attr" data-attr-del="${idx}">×</button>` : ''}
                </div>
              `).join('')}
              ${customAttrs.length === 0 ? `<div style="font-size: 10px; color: var(--cm-text-muted); font-style: italic;">Nenhum atributo adicional cadastrado.</div>` : ''}
            </div>
          </div>
        </details>

        <!-- 6. ACORDEÃO: 🔄 CONVERSOR TOPOGRÁFICO & GEODÉSICO -->
        <details class="cm-inspector-accordion">
          ${this.renderAccordionHeader('🔄 Conversor de Unidades', isPoly ? `${areaConversions.ha} ha` : (isLine ? `${lengthConversions.km} km` : 'DMS'))}
          <div class="cm-accordion-content">
            ${(isPoly || isCircle) ? `
              <div style="font-size: 10px; font-weight: 600; color: var(--cm-text);">Área Equivalente:</div>
              <div class="cm-converter-grid">
                <div class="cm-converter-item">
                  <span class="cm-converter-label">Hectares</span>
                  <span class="cm-converter-val">${areaConversions.ha}</span>
                </div>
                <div class="cm-converter-item">
                  <span class="cm-converter-label">Metros Quadrados</span>
                  <span class="cm-converter-val">${areaConversions.m2}</span>
                </div>
                <div class="cm-converter-item">
                  <span class="cm-converter-label">Alqueire Paulista (2,42 ha)</span>
                  <span class="cm-converter-val">${areaConversions.alqueirePaulista}</span>
                </div>
                <div class="cm-converter-item">
                  <span class="cm-converter-label">Alqueire MG/GO (4,84 ha)</span>
                  <span class="cm-converter-val">${areaConversions.alqueireMineiro}</span>
                </div>
              </div>
            ` : ''}

            ${isLine ? `
              <div style="font-size: 10px; font-weight: 600; color: var(--cm-text);">Extensão Linear:</div>
              <div class="cm-converter-grid">
                <div class="cm-converter-item">
                  <span class="cm-converter-label">Metros</span>
                  <span class="cm-converter-val">${lengthConversions.meters}</span>
                </div>
                <div class="cm-converter-item">
                  <span class="cm-converter-label">Quilômetros</span>
                  <span class="cm-converter-val">${lengthConversions.km}</span>
                </div>
                <div class="cm-converter-item">
                  <span class="cm-converter-label">Milhas</span>
                  <span class="cm-converter-val">${lengthConversions.miles}</span>
                </div>
                <div class="cm-converter-item">
                  <span class="cm-converter-label">Pés</span>
                  <span class="cm-converter-val">${lengthConversions.feet}</span>
                </div>
              </div>
            ` : ''}

            <div style="font-size: 10px; font-weight: 600; color: var(--cm-text); margin-top: 4px;">Centroide / Coordenadas:</div>
            <div class="cm-converter-grid">
              <div class="cm-converter-item">
                <span class="cm-converter-label">Graus Decimais (DD)</span>
                <span class="cm-converter-val">${refCoord[0].toFixed(5)}, ${refCoord[1].toFixed(5)}</span>
              </div>
              <div class="cm-converter-item">
                <span class="cm-converter-label">DMS (GMS)</span>
                <span class="cm-converter-val" style="font-size: 9.5px;">${dmsLat}<br>${dmsLng}</span>
              </div>
            </div>
          </div>
        </details>

        <!-- 7. ACORDEÃO: 🕒 HISTÓRICO LOCAL DO ELEMENTO -->
        <details class="cm-inspector-accordion">
          ${this.renderAccordionHeader('🕒 Histórico de Modificações', `${historyList.length} eventos`)}
          <div class="cm-accordion-content">
            <div class="cm-audit-log-list" style="max-height: 100px;">
              ${historyList.length > 0 ? historyList.map(h => `
                <div class="cm-audit-item">
                  <span style="color: var(--cm-primary);">${this.escapeHtml(h.time || '')}:</span>
                  <span style="color: var(--cm-text);">${this.escapeHtml(h.action || '')}</span>
                </div>
              `).join('') : `
                <div class="cm-audit-item">
                  <span style="color: var(--cm-text-muted);">Criado em ${new Date(feat.createdAt || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              `}
            </div>
          </div>
        </details>

        <!-- Sticky Action Footer (B2B Workbench) -->
        <div class="cm-inspector-sticky-footer">
          <ui-botao-primario inline id="btn-save-inspector" variante="primary" style="height: 30px; flex: 1;" ${isLocked ? 'desabilitado' : ''}>
            Salvar Alterações <kbd class="cm-save-shortcut-kbd">Ctrl+S</kbd>
          </ui-botao-primario>
        </div>
      </div>
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
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  calculateBearing(p1, p2) {
    if (!p1 || !p2) return 0;
    const lat1 = p1[0] * Math.PI / 180;
    const lat2 = p2[0] * Math.PI / 180;
    const dLon = (p2[1] - p1[1]) * Math.PI / 180;

    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    let brng = Math.atan2(y, x) * 180 / Math.PI;
    return (brng + 360) % 360;
  }

  calculateFeatureSegments(coordinates, isClosed = false) {
    if (!Array.isArray(coordinates) || coordinates.length < 2) return [];
    const segments = [];
    const count = isClosed ? coordinates.length : coordinates.length - 1;

    for (let i = 0; i < count; i++) {
      const p1 = coordinates[i];
      const p2 = coordinates[(i + 1) % coordinates.length];
      if (!p1 || !p2) continue;

      const dist = this.calculateDistance(p1, p2);
      const az = this.calculateBearing(p1, p2);
      segments.push({
        from: i + 1,
        to: (i + 1) % coordinates.length === 0 ? 1 : i + 2,
        distance: dist,
        azimuth: az
      });
    }
    return segments;
  }

  renderCollabTab() {
    return `
      <div style="display: flex; flex-direction: column; gap: 10px; height: 100%;">
        <div>
          <span class="cm-sidebar-section-title" style="display: block; margin-bottom: 4px;">Trilha de Auditoria</span>
          <div class="cm-audit-log-list">
            ${this.auditLog.length ? this.auditLog.map(entry => `
              <div class="cm-audit-item">
                <span style="color: var(--cm-primary); font-weight: 600;">${this.escapeHtml(entry.user)}:</span>
                <span style="color: var(--cm-text);">${this.escapeHtml(entry.action)}</span>
                <span style="color: var(--cm-text-muted); margin-left: auto;">${this.escapeHtml(entry.timestamp)}</span>
              </div>
            `).join('') : '<div style="color: var(--cm-text-muted); font-size: 10.5px;">Nenhuma alteração registrada.</div>'}
          </div>
        </div>

        <div style="flex: 1; display: flex; flex-direction: column;">
          <span class="cm-sidebar-section-title" style="display: block; margin-bottom: 4px;">Chat da Equipe</span>
          
          <div class="cm-chat-messages" id="cm-chat-messages-box">
            ${this.chatMessages.length ? this.chatMessages.map(msg => {
              const safeUser = this.escapeHtml(msg.user?.name || 'Operador');
              const safeColor = this.escapeHtml(msg.user?.color || 'var(--cm-primary)');
              const safeText = this.escapeHtml(msg.text || '');
              const safeTime = this.escapeHtml(msg.timestamp || '');
              return `
              <div class="cm-chat-bubble">
                <div class="cm-chat-meta">
                  <span class="cm-chat-user" style="color: ${safeColor}">${safeUser}</span>
                  <span>${safeTime}</span>
                </div>
                <div style="color: var(--cm-text); margin-top: 2px;">${safeText}</div>
              </div>
            `;
            }).join('') : '<div style="color: var(--cm-text-muted); font-size: 10.5px;">Nenhuma mensagem na sala.</div>'}
          </div>

          <form id="cm-chat-form" style="display: flex; gap: 6px; margin-top: 6px; align-items: center;">
            <ui-campo-texto id="cm-chat-input" placeholder="Mensagem da equipe..." style="flex: 1; --ui-campo-altura: 30px; --ui-altura-minima: 30px;"></ui-campo-texto>
            <ui-botao-primario inline type="submit" variante="primary" style="height: 30px; padding: 0 12px; font-size: 11.5px;">
              Enviar
            </ui-botao-primario>
          </form>
        </div>
      </div>
    `;
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
    // 1. Ações da Toolbar Superior da Árvore
    const btnToggleAllVis = document.getElementById('btn-toggle-all-vis');
    if (btnToggleAllVis) {
      btnToggleAllVis.addEventListener('click', () => {
        const someVisible = this.layers.some(l => l.visible !== false);
        const newVis = !someVisible;
        this.layers.forEach(l => {
          l.visible = newVis;
          this.onLayerToggle(l.id, newVis);
        });
        this.updateContent();
      });
    }

    const btnToggleAllExpand = document.getElementById('btn-toggle-all-expand');
    if (btnToggleAllExpand) {
      btnToggleAllExpand.addEventListener('click', () => {
        const allExpanded = this.layers.every(l => this.expandedLayers.has(l.id));
        if (allExpanded) {
          this.expandedLayers.clear();
        } else {
          this.expandedLayers = new Set(this.layers.map(l => l.id));
        }
        this.updateContent();
      });
    }

    // Botão Nova Camada Superior
    const btnAddLayer = document.getElementById('btn-add-layer');
    if (btnAddLayer) {
      btnAddLayer.addEventListener('click', () => this.onAddLayer());
    }

    // 2. Ações do Rodapé Fixo Illustrator (cm-ai-tree-footer)
    const btnFooterVis = document.getElementById('btn-footer-vis');
    if (btnFooterVis) {
      btnFooterVis.addEventListener('click', () => {
        const selFeats = this.features.filter(f => this.selectedFeatureIds.has(f.id));
        if (selFeats.length === 0) return;
        const someVisible = selFeats.some(f => f.visible !== false);
        const newVis = !someVisible;
        selFeats.forEach(f => {
          f.visible = newVis;
          this.onFeatureToggle(f.id, newVis);
        });
        this.updateContent();
      });
    }

    const btnFooterLock = document.getElementById('btn-footer-lock');
    if (btnFooterLock) {
      btnFooterLock.addEventListener('click', () => {
        const selFeats = this.features.filter(f => this.selectedFeatureIds.has(f.id));
        if (selFeats.length === 0) return;
        const someLocked = selFeats.some(f => f.locked === true);
        const newLock = !someLocked;
        selFeats.forEach(f => {
          f.locked = newLock;
          this.onFeatureLockToggle(f.id, newLock);
        });
        this.updateContent();
      });
    }

    const inputFooterColor = document.getElementById('input-footer-color');
    if (inputFooterColor) {
      inputFooterColor.addEventListener('change', (e) => {
        const newColor = e.target.value;
        const updated = [];
        this.features.forEach(f => {
          if (this.selectedFeatureIds.has(f.id)) {
            f.color = newColor;
            f.style = {
              ...(f.style || {}),
              fillColor: newColor,
              strokeColor: newColor
            };
            updated.push(f);
          }
        });
        if (updated.length > 0) {
          this.onBulkUpdate(updated);
          this.updateContent();
        }
      });
    }

    const selectFooterMove = document.getElementById('select-footer-move-layer');
    if (selectFooterMove) {
      selectFooterMove.addEventListener('change', (e) => {
        const targetLayerId = e.target.value;
        if (!targetLayerId) return;
        const updated = [];
        this.features.forEach(f => {
          if (this.selectedFeatureIds.has(f.id)) {
            f.layerId = targetLayerId;
            updated.push(f);
          }
        });
        if (updated.length > 0) {
          this.onBulkUpdate(updated);
          this.updateContent();
        }
      });
    }

    const btnFooterNewLayer = document.getElementById('btn-footer-new-layer');
    if (btnFooterNewLayer) {
      btnFooterNewLayer.addEventListener('click', () => this.onAddLayer());
    }

    const btnFooterDel = document.getElementById('btn-footer-del');
    if (btnFooterDel) {
      btnFooterDel.addEventListener('click', () => {
        const ids = Array.from(this.selectedFeatureIds);
        if (ids.length === 0) return;
        this.onBulkDelete(ids);
        this.selectedFeatureIds.clear();
        this.updateContent();
      });
    }

    const btnFooterClear = document.getElementById('btn-footer-clear');
    if (btnFooterClear) {
      btnFooterClear.addEventListener('click', () => {
        this.selectedFeatureIds.clear();
        this.updateContent();
      });
    }

    // 3. Ações da Camada Pai
    // Expandir/Recolher
    document.querySelectorAll('[data-layer-expand]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const layerId = btn.getAttribute('data-layer-expand');
        if (this.expandedLayers.has(layerId)) {
          this.expandedLayers.delete(layerId);
        } else {
          this.expandedLayers.add(layerId);
        }
        this.updateContent();
      });
    });

    // Eye / Visibilidade da Camada
    document.querySelectorAll('[data-layer-eye]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const layerId = btn.getAttribute('data-layer-eye');
        const layer = this.layers.find(l => l.id === layerId);
        if (layer) {
          const isVisible = layer.visible !== false;
          layer.visible = !isVisible;
          this.onLayerToggle(layerId, layer.visible);
          this.updateContent();
        }
      });
    });

    // Trava / Bloqueio da Camada
    document.querySelectorAll('[data-layer-lock]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const layerId = btn.getAttribute('data-layer-lock');
        const layer = this.layers.find(l => l.id === layerId);
        if (layer) {
          layer.locked = !layer.locked;
          this.features.forEach(f => {
            if (f.layerId === layerId) f.locked = layer.locked;
          });
          this.updateContent();
        }
      });
    });

    // Alvo de Seleção da Camada Inteira (Illustrator Target Circle com suporte a Shift)
    document.querySelectorAll('[data-layer-target]').forEach(target => {
      target.addEventListener('click', (e) => {
        e.stopPropagation();
        const layerId = target.getAttribute('data-layer-target');
        const layerFeats = this.features.filter(f => f.layerId === layerId);
        if (layerFeats.length === 0) return;

        const isShift = e.shiftKey;
        const isCtrl = e.ctrlKey || e.metaKey;

        if (isShift && this.lastClickedFeatureId) {
          this.handleItemSelection(layerFeats[0].id, true, isCtrl);
        } else {
          const allSelected = layerFeats.every(f => this.selectedFeatureIds.has(f.id));
          if (allSelected) {
            layerFeats.forEach(f => this.selectedFeatureIds.delete(f.id));
          } else {
            if (!isCtrl) this.selectedFeatureIds.clear();
            layerFeats.forEach(f => this.selectedFeatureIds.add(f.id));
          }
          this.lastClickedFeatureId = layerFeats[layerFeats.length - 1].id;
        }
        this.updateContent();
      });
    });

    // Reordenação / Z-Index da Camada (Subir ▲)
    document.querySelectorAll('[data-layer-up]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-layer-up'), 10);
        if (idx > 0) {
          const temp = this.layers[idx];
          this.layers[idx] = this.layers[idx - 1];
          this.layers[idx - 1] = temp;
          this.onLayerReorder(this.layers);
          this.updateContent();
        }
      });
    });

    // Reordenação / Z-Index da Camada (Descer ▼)
    document.querySelectorAll('[data-layer-down]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-layer-down'), 10);
        if (idx < this.layers.length - 1) {
          const temp = this.layers[idx];
          this.layers[idx] = this.layers[idx + 1];
          this.layers[idx + 1] = temp;
          this.onLayerReorder(this.layers);
          this.updateContent();
        }
      });
    });

    // Configurações / Opacidade da Camada
    document.querySelectorAll('[data-layer-settings]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const layerId = btn.getAttribute('data-layer-settings');
        this.activeSettingsLayerId = this.activeSettingsLayerId === layerId ? null : layerId;
        this.updateContent();
      });
    });

    // Slider de Opacidade da Camada
    document.querySelectorAll('[data-layer-opacity-slider]').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const layerId = slider.getAttribute('data-layer-opacity-slider');
        const val = parseFloat(e.target.value);
        const badge = document.getElementById(`badge-op-${layerId}`);
        if (badge) badge.textContent = `${Math.round(val * 100)}%`;
        const layer = this.layers.find(l => l.id === layerId);
        if (layer) {
          layer.opacity = val;
          this.onLayerOpacityChange(layerId, val);
        }
      });
    });

    // Color Picker da Camada
    document.querySelectorAll('[data-layer-color-picker]').forEach(picker => {
      picker.addEventListener('change', (e) => {
        const layerId = picker.getAttribute('data-layer-color-picker');
        const color = e.target.value;
        const layer = this.layers.find(l => l.id === layerId);
        if (layer) {
          layer.color = color;
          this.onLayerColorChange(layerId, color);
          this.updateContent();
        }
      });
    });

    // Renomear Camada
    document.querySelectorAll('.btn-apply-layer-name').forEach(btn => {
      btn.addEventListener('click', () => {
        const layerId = btn.getAttribute('data-save-layer-name');
        const input = document.querySelector(`[data-layer-rename-input="${layerId}"]`);
        const newName = input?.value?.trim();
        if (newName) {
          const layer = this.layers.find(l => l.id === layerId);
          if (layer) {
            layer.name = newName;
            this.onLayerRename(layerId, newName);
            this.activeSettingsLayerId = null;
            this.updateContent();
          }
        }
      });
    });

    // Excluir Camada
    document.querySelectorAll('[data-delete-layer]').forEach(btn => {
      btn.addEventListener('click', () => {
        const layerId = btn.getAttribute('data-delete-layer');
        if (this.layers.length <= 1) {
          UIToast.notificar({ tipo: 'alerta', titulo: 'Aviso', mensagem: 'O mapa deve ter ao menos 1 camada ativa.' });
          return;
        }
        this.onLayerDelete(layerId);
        this.layers = this.layers.filter(l => l.id !== layerId);
        this.activeSettingsLayerId = null;
        this.updateContent();
      });
    });

    // 4. Ações de Feições Filhas (Tree Children)
    // Selecionar feição / Abrir inspeção
    document.querySelectorAll('[data-feat-select]').forEach(node => {
      node.addEventListener('click', (e) => {
        const featId = node.getAttribute('data-feat-select');
        const isShift = e.shiftKey;
        const isCtrl = e.ctrlKey || e.metaKey;

        if (isShift || isCtrl) {
          this.handleItemSelection(featId, isShift, isCtrl);
          this.updateContent();
        } else {
          const feat = this.features.find(f => f.id === featId);
          if (feat) {
            this.setSelectedFeature(feat);
            this.onFeatureSelect(feat);
            this.onFitFeature(feat.id);
          }
        }
      });
    });

    // Alvo de Seleção Individual da Feição (Illustrator Target Circle com suporte a Shift)
    document.querySelectorAll('[data-feat-target]').forEach(target => {
      target.addEventListener('click', (e) => {
        e.stopPropagation();
        const featId = target.getAttribute('data-feat-target');
        const isShift = e.shiftKey;
        const isCtrl = e.ctrlKey || e.metaKey;
        this.handleItemSelection(featId, isShift, isCtrl);
        this.updateContent();
      });
    });

    // Visibilidade individual da feição (Eye)
    document.querySelectorAll('[data-feat-eye]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const featId = btn.getAttribute('data-feat-eye');
        const feat = this.features.find(f => f.id === featId);
        if (feat) {
          const isVisible = feat.visible !== false;
          feat.visible = !isVisible;
          this.onFeatureToggle(featId, feat.visible);
          this.updateContent();
        }
      });
    });

    // Trava individual da feição (Lock)
    document.querySelectorAll('[data-feat-lock]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const featId = btn.getAttribute('data-feat-lock');
        const feat = this.features.find(f => f.id === featId);
        if (feat) {
          feat.locked = !feat.locked;
          this.onFeatureLockToggle(featId, feat.locked);
          this.updateContent();
        }
      });
    });

    // Foco / Enquadrar feição
    document.querySelectorAll('[data-feat-fit]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const featId = btn.getAttribute('data-feat-fit');
        this.onFitFeature(featId);
      });
    });

    // 5. Mapas base
    document.querySelectorAll('[data-basemap]').forEach(card => {
      card.addEventListener('click', () => {
        const base = card.getAttribute('data-basemap');
        this.currentBasemap = base;
        this.onBasemapChange(base);
        this.updateContent();
      });
    });

    // Sliders e Color Pickers em Tempo Real
    const fillPicker = document.getElementById('style-fill-color');
    const fillHexBadge = document.getElementById('val-fill-color-hex');
    if (fillPicker && fillHexBadge) {
      fillPicker.addEventListener('input', (e) => {
        fillHexBadge.textContent = e.target.value;
      });
    }

    const strokePicker = document.getElementById('style-stroke-color');
    const strokeHexBadge = document.getElementById('val-stroke-color-hex');
    if (strokePicker && strokeHexBadge) {
      strokePicker.addEventListener('input', (e) => {
        strokeHexBadge.textContent = e.target.value;
      });
    }

    const pointPicker = document.getElementById('style-point-color');
    const pointHexBadge = document.getElementById('val-point-color-hex');
    if (pointPicker && pointHexBadge) {
      pointPicker.addEventListener('input', (e) => {
        pointHexBadge.textContent = e.target.value;
      });
    }

    const fillOpacitySlider = document.getElementById('style-fill-opacity');
    const fillOpacityBadge = document.getElementById('val-fill-opacity');
    if (fillOpacitySlider && fillOpacityBadge) {
      fillOpacitySlider.addEventListener('input', (e) => {
        fillOpacityBadge.textContent = `${Math.round(e.target.value * 100)}%`;
      });
    }

    const strokeWidthSlider = document.getElementById('style-stroke-width');
    const strokeWidthBadge = document.getElementById('val-stroke-width');
    if (strokeWidthSlider && strokeWidthBadge) {
      strokeWidthSlider.addEventListener('input', (e) => {
        strokeWidthBadge.textContent = `${e.target.value}px`;
      });
    }

    const markerSizeSlider = document.getElementById('style-marker-size');
    const markerSizeBadge = document.getElementById('val-marker-size');
    if (markerSizeSlider && markerSizeBadge) {
      markerSizeSlider.addEventListener('input', (e) => {
        markerSizeBadge.textContent = `${e.target.value}px`;
      });
    }

    const markerRotSlider = document.getElementById('style-marker-rot');
    const markerRotBadge = document.getElementById('val-marker-rot');
    if (markerRotSlider && markerRotBadge) {
      markerRotSlider.addEventListener('input', (e) => {
        markerRotBadge.textContent = `${e.target.value}°`;
      });
    }

    // Botão de Trava/Lock
    const btnLock = document.getElementById('btn-toggle-lock');
    if (btnLock && this.selectedFeature) {
      btnLock.addEventListener('click', () => {
        const isLocked = !this.selectedFeature.locked;
        const updated = {
          ...this.selectedFeature,
          locked: isLocked
        };
        this.selectedFeature = updated;
        this.onFeatureUpdate(updated);
        this.updateContent();
        UIToast.notificar({
          tipo: isLocked ? 'alerta' : 'sucesso',
          titulo: isLocked ? 'Feição Bloqueada' : 'Feição Desbloqueada',
          mensagem: isLocked ? 'Edições e exclusões estão temporariamente travadas.' : 'Edição liberada no mapa e no painel.',
          duracao: 2000
        });
      });
    }

    // Botão de Janela Flutuante (Floating Detachable Workbench)
    const btnFloat = document.getElementById('btn-toggle-float');
    if (btnFloat) {
      btnFloat.addEventListener('click', () => {
        this.toggleFloatingWindow();
      });
    }

    // Botão Enquadrar Feição
    const btnFit = document.getElementById('btn-fit-feature');
    if (btnFit && this.selectedFeature) {
      btnFit.addEventListener('click', () => {
        this.onFitFeature(this.selectedFeature.id);
      });
    }

    // Buffer Paramétrico
    const btnGenBuffer = document.getElementById('btn-generate-buffer');
    if (btnGenBuffer && this.selectedFeature) {
      btnGenBuffer.addEventListener('click', () => {
        const radiusInput = document.getElementById('buffer-radius-input');
        const radius = Math.max(1, parseFloat(radiusInput?.value) || 50);
        const bufferFeature = SpatialAlgorithms.generateBuffer(this.selectedFeature, radius);
        if (bufferFeature) {
          this.onFeatureCreate(bufferFeature);
          UIToast.notificar({
            tipo: 'sucesso',
            titulo: 'Buffer Gerado',
            mensagem: `Zona de amortecimento de ${radius}m criada no mapa.`,
            duracao: 2500
          });
        }
      });
    }

    // Simplificação Douglas-Peucker
    const dpSlider = document.getElementById('dp-tolerance-slider');
    const dpValBadge = document.getElementById('dp-tolerance-val');
    if (dpSlider && dpValBadge) {
      dpSlider.addEventListener('input', (e) => {
        dpValBadge.textContent = `${e.target.value}m`;
      });
    }

    const btnSimplify = document.getElementById('btn-simplify-dp');
    if (btnSimplify && this.selectedFeature && Array.isArray(this.selectedFeature.coordinates)) {
      btnSimplify.addEventListener('click', () => {
        const tol = parseFloat(dpSlider?.value) || 5;
        const isPoly = this.selectedFeature.type === 'Polygon';
        const originalCount = this.selectedFeature.coordinates.length;
        const simplified = SpatialAlgorithms.simplifyDouglasPeucker(this.selectedFeature.coordinates, tol, isPoly);
        const newCount = simplified.length;
        const reduced = originalCount - newCount;

        const updated = {
          ...this.selectedFeature,
          coordinates: simplified
        };
        this.selectedFeature = updated;
        this.onFeatureUpdate(updated);
        this.updateContent();

        UIToast.notificar({
          tipo: 'sucesso',
          titulo: 'Geometria Simplificada',
          mensagem: reduced > 0 ? `${reduced} vértices redundantes removidos (tolerância: ${tol}m).` : 'Geometria já otimizada.',
          duracao: 2500
        });
      });
    }

    // Duplicação de Feição com Offset
    const btnDup = document.getElementById('btn-duplicate-feat');
    if (btnDup && this.selectedFeature) {
      btnDup.addEventListener('click', () => {
        const clone = SpatialAlgorithms.duplicateWithOffset(this.selectedFeature, 30);
        if (clone) {
          this.onFeatureCreate(clone);
          UIToast.notificar({
            tipo: 'sucesso',
            titulo: 'Feição Duplicada',
            mensagem: `Cópia criada com deslocamento geodésico de +30m.`,
            duracao: 2500
          });
        }
      });
    }

    // Adicionar Atributo Customizado
    const btnAddAttr = document.getElementById('btn-add-custom-attr');
    if (btnAddAttr && this.selectedFeature) {
      btnAddAttr.addEventListener('click', () => {
        const current = Array.isArray(this.selectedFeature.customAttributes) ? [...this.selectedFeature.customAttributes] : [];
        current.push({ key: '', value: '' });
        this.selectedFeature.customAttributes = current;
        this.updateContent();
      });
    }

    // Excluir Atributo Customizado
    document.querySelectorAll('.btn-del-attr').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-attr-del'), 10);
        if (this.selectedFeature && Array.isArray(this.selectedFeature.customAttributes)) {
          this.selectedFeature.customAttributes.splice(idx, 1);
          this.updateContent();
        }
      });
    });

    // Inspetor Salvar/Excluir
    const btnSave = document.getElementById('btn-save-inspector');
    if (btnSave && this.selectedFeature) {
      btnSave.addEventListener('click', () => {
        if (this.selectedFeature.locked) {
          UIToast.notificar({ tipo: 'alerta', titulo: 'Feição Bloqueada', mensagem: 'Desbloqueie o elemento antes de salvar alterações.' });
          return;
        }

        const nameInput = document.getElementById('inspector-feat-name');
        const descInput = document.getElementById('inspector-feat-desc');
        const layerSelect = document.getElementById('inspector-feat-layer');
        const newName = nameInput ? nameInput.value.trim() : '';
        const newDesc = descInput ? descInput.value.trim() : '';
        const newLayerId = layerSelect ? layerSelect.value : (this.selectedFeature.layerId || 'layer-topografia');

        const isPoint = this.selectedFeature.type === 'Point';

        const fillPick = document.getElementById('style-fill-color');
        const strokePick = document.getElementById('style-stroke-color');
        const pointPick = document.getElementById('style-point-color');
        const fillOpSlider = document.getElementById('style-fill-opacity');
        const strokeWSlider = document.getElementById('style-stroke-width');
        const strokeDSelect = document.getElementById('style-stroke-dash');
        const markerISelect = document.getElementById('style-marker-icon');
        const markerSSlider = document.getElementById('style-marker-size');
        const markerRSlider = document.getElementById('style-marker-rot');
        const labelSw = document.getElementById('style-show-label');
        const labelFSelect = document.getElementById('style-label-field');

        const currentStyle = this.selectedFeature.style || {};
        const isLabelChecked = labelSw ? (labelSw.checked || labelSw.hasAttribute('checked')) : false;

        const newStyle = {
          ...currentStyle,
          fillColor: isPoint ? (pointPick?.value || currentStyle.fillColor || '#00E08A') : (fillPick?.value || currentStyle.fillColor || '#00E08A'),
          fillOpacity: fillOpSlider ? parseFloat(fillOpSlider.value) : (currentStyle.fillOpacity ?? 0.35),
          strokeColor: strokePick?.value || currentStyle.strokeColor || (isPoint ? (pointPick?.value || '#00E08A') : '#00E08A'),
          strokeWidth: strokeWSlider ? parseFloat(strokeWSlider.value) : (currentStyle.strokeWidth ?? 2.5),
          strokeDashArray: strokeDSelect ? strokeDSelect.value : (currentStyle.strokeDashArray || ''),
          markerIcon: markerISelect ? markerISelect.value : (currentStyle.markerIcon || 'pin'),
          markerSize: markerSSlider ? parseInt(markerSSlider.value, 10) : (currentStyle.markerSize ?? 24),
          markerRotation: markerRSlider ? parseInt(markerRSlider.value, 10) : (currentStyle.markerRotation ?? 0),
          showLabel: isLabelChecked,
          labelField: labelFSelect ? labelFSelect.value : (currentStyle.labelField || 'name')
        };

        // Coleta atributos customizados dos inputs
        const customAttrs = [];
        document.querySelectorAll('.cm-custom-attr-row').forEach(row => {
          const k = row.querySelector('.attr-key')?.value?.trim();
          const v = row.querySelector('.attr-val')?.value?.trim();
          if (k) {
            customAttrs.push({ key: k, value: v || '' });
          }
        });

        // Atualiza mini-histórico
        const historyList = Array.isArray(this.selectedFeature.history) ? [...this.selectedFeature.history] : [];
        historyList.unshift({
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          action: `Propriedades salvas por Você`
        });

        const updated = {
          ...this.selectedFeature,
          name: newName || this.selectedFeature.name,
          description: newDesc,
          layerId: newLayerId,
          color: newStyle.fillColor || newStyle.strokeColor || this.selectedFeature.color,
          style: newStyle,
          customAttributes: customAttrs,
          history: historyList.slice(0, 8)
        };

        this.selectedFeature = updated;
        this.onFeatureUpdate(updated);
      });
    }

    // Botão de Ativar / Desativar Modo de Edição de Vértices no Mapa
    const btnToggleVertex = document.getElementById('btn-toggle-vertex-edit');
    if (btnToggleVertex && this.selectedFeature) {
      btnToggleVertex.addEventListener('click', () => {
        if (this.selectedFeature.locked) {
          UIToast.notificar({ tipo: 'alerta', titulo: 'Feição Bloqueada', mensagem: 'Desbloqueie o elemento antes de editar vértices.' });
          return;
        }
        this.isVertexEditing = !this.isVertexEditing;
        if (this.isVertexEditing) {
          this.onStartVertexEdit(this.selectedFeature);
        } else {
          this.onStopVertexEdit();
        }
        this.updateContent();
      });
    }

    // Inputs de Latitude dos Vértices
    document.querySelectorAll('[data-v-lat]').forEach(input => {
      input.addEventListener('change', (e) => {
        if (this.selectedFeature.locked) return;
        const idx = parseInt(input.getAttribute('data-v-lat'), 10);
        const newLat = parseFloat(e.target.value);
        if (!isNaN(newLat) && this.selectedFeature && Array.isArray(this.selectedFeature.coordinates)) {
          const coords = [...this.selectedFeature.coordinates];
          if (coords[idx]) {
            coords[idx] = [newLat, coords[idx][1]];
            const updated = { ...this.selectedFeature, coordinates: coords };
            this.selectedFeature = updated;
            this.onFeatureUpdate(updated);
            this.updateContent();
          }
        }
      });
    });

    // Inputs de Longitude dos Vértices
    document.querySelectorAll('[data-v-lng]').forEach(input => {
      input.addEventListener('change', (e) => {
        if (this.selectedFeature.locked) return;
        const idx = parseInt(input.getAttribute('data-v-lng'), 10);
        const newLng = parseFloat(e.target.value);
        if (!isNaN(newLng) && this.selectedFeature && Array.isArray(this.selectedFeature.coordinates)) {
          const coords = [...this.selectedFeature.coordinates];
          if (coords[idx]) {
            coords[idx] = [coords[idx][0], newLng];
            const updated = { ...this.selectedFeature, coordinates: coords };
            this.selectedFeature = updated;
            this.onFeatureUpdate(updated);
            this.updateContent();
          }
        }
      });
    });

    // Exclusão de Vértice Individual
    document.querySelectorAll('[data-v-del]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.selectedFeature.locked) return;
        const idx = parseInt(btn.getAttribute('data-v-del'), 10);
        if (this.selectedFeature && Array.isArray(this.selectedFeature.coordinates)) {
          const minNodes = this.selectedFeature.type === 'Polygon' ? 3 : 2;
          if (this.selectedFeature.coordinates.length <= minNodes) {
            UIToast.notificar({
              tipo: 'alerta',
              titulo: 'Limite Mínimo',
              mensagem: `A geometria não pode ter menos de ${minNodes} vértices.`,
              duracao: 2500
            });
            return;
          }
          const coords = [...this.selectedFeature.coordinates];
          coords.splice(idx, 1);
          const updated = { ...this.selectedFeature, coordinates: coords };
          this.selectedFeature = updated;
          this.onFeatureUpdate(updated);
          this.updateContent();
        }
      });
    });

    // Botões de Cópia Rápida
    const btnCopyWKT = document.getElementById('btn-copy-wkt');
    if (btnCopyWKT && this.selectedFeature) {
      btnCopyWKT.addEventListener('click', () => {
        const wkt = GeoFormats.toWKT(this.selectedFeature);
        navigator.clipboard.writeText(wkt).then(() => {
          UIToast.notificar({
            tipo: 'sucesso',
            titulo: 'WKT Copiado',
            mensagem: 'Geometria no padrão Well-Known Text copiada!',
            duracao: 2500
          });
        });
      });
    }

    const btnCopyGeoJSON = document.getElementById('btn-copy-geojson');
    if (btnCopyGeoJSON && this.selectedFeature) {
      btnCopyGeoJSON.addEventListener('click', () => {
        const geo = GeoFormats.toGeoJSON([this.selectedFeature]);
        navigator.clipboard.writeText(geo).then(() => {
          UIToast.notificar({
            tipo: 'sucesso',
            titulo: 'GeoJSON Copiado',
            mensagem: 'Feature GeoJSON copiada com sucesso!',
            duracao: 2500
          });
        });
      });
    }

    const btnCopyCSV = document.getElementById('btn-copy-coord-csv');
    if (btnCopyCSV && this.selectedFeature) {
      btnCopyCSV.addEventListener('click', () => {
        const csv = GeoFormats.toCoordinateCSV(this.selectedFeature);
        navigator.clipboard.writeText(csv).then(() => {
          UIToast.notificar({
            tipo: 'sucesso',
            titulo: 'CSV de Vértices Copiado',
            mensagem: 'Tabela de coordenadas dos nós copiada!',
            duracao: 2500
          });
        });
      });
    }

    const btnDelete = document.getElementById('btn-delete-inspector');
    if (btnDelete && this.selectedFeature) {
      btnDelete.addEventListener('click', () => {
        if (this.selectedFeature.locked) {
          UIToast.notificar({ tipo: 'alerta', titulo: 'Feição Bloqueada', mensagem: 'Desbloqueie o elemento antes de excluí-lo.' });
          return;
        }
        this.onDeleteFeature(this.selectedFeature.id);
        this.setSelectedFeature(null);
      });
    }

    // Chat Form
    const chatForm = document.getElementById('cm-chat-form');
    if (chatForm) {
      chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('cm-chat-input');
        const text = input?.value?.trim();
        if (text) {
          this.onSendMessage(text);
          if (input) input.value = '';
        }
      });
    }
  }

  toggleFloatingWindow() {
    this.isFloating = !this.isFloating;
    let floatWin = document.getElementById('cm-floating-inspector-window');
    if (this.isFloating) {
      if (!floatWin) {
        floatWin = document.createElement('div');
        floatWin.id = 'cm-floating-inspector-window';
        floatWin.className = 'cm-floating-window';
        document.body.appendChild(floatWin);
      }
      floatWin.style.display = 'flex';
      this.renderFloatingWindowContent();
      this.makeWindowDraggable(floatWin);
    } else {
      if (floatWin) {
        floatWin.style.display = 'none';
      }
    }
    this.updateContent();
  }

  renderFloatingWindowContent() {
    const floatWin = document.getElementById('cm-floating-inspector-window');
    if (!floatWin || !this.selectedFeature) return;

    floatWin.innerHTML = `
      <div class="cm-floating-header" id="cm-floating-header-handle">
        <div class="cm-floating-title">
          <span>🔍 Inspetor Workbench</span>
          <span style="font-size: 10px; opacity: 0.7;">(${this.escapeHtml(this.selectedFeature.name || '')})</span>
        </div>
        <div style="display: flex; gap: 4px; align-items: center;">
          <button id="btn-dock-float-win" class="cm-native-select" style="padding: 1px 5px; font-size: 10px;" title="Acoplar de volta na barra lateral">📌 Acoplar</button>
          <button id="btn-close-float-win" class="cm-vertex-del-btn" style="font-size: 16px; padding: 0 4px;" title="Fechar">×</button>
        </div>
      </div>
      <div class="cm-floating-body">
        ${this.renderInspectorTab()}
      </div>
    `;

    const btnDock = floatWin.querySelector('#btn-dock-float-win');
    if (btnDock) {
      btnDock.addEventListener('click', () => {
        this.toggleFloatingWindow();
      });
    }

    const btnClose = floatWin.querySelector('#btn-close-float-win');
    if (btnClose) {
      btnClose.addEventListener('click', () => {
        this.toggleFloatingWindow();
      });
    }

    this.bindTabEvents();
  }

  makeWindowDraggable(win) {
    const header = win.querySelector('#cm-floating-header-handle');
    if (!header) return;

    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;

    header.onmousedown = (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = win.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      win.style.right = 'auto';
      win.style.left = `${initialLeft}px`;
      win.style.top = `${initialTop}px`;

      document.onmousemove = (ev) => {
        if (!isDragging) return;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;

        // Clamping de viewport
        const maxLeft = window.innerWidth - win.offsetWidth - 10;
        const maxTop = window.innerHeight - win.offsetHeight - 10;

        const newLeft = Math.max(10, Math.min(maxLeft, initialLeft + dx));
        const newTop = Math.max(10, Math.min(maxTop, initialTop + dy));

        win.style.left = `${newLeft}px`;
        win.style.top = `${newTop}px`;
      };

      document.onmouseup = () => {
        isDragging = false;
        document.onmousemove = null;
        document.onmouseup = null;
      };
    };
  }
}

