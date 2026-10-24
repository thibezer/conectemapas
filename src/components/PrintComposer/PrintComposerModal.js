/* ==========================================================================
   ConecteMapas - PrintComposerModal (QGIS Print Layout Composer)
   Responsabilidade Única: Orquestrador principal do Compositor de Impressão,
   gestão de estado de prancha, sincronização Leaflet, alternância de modos
   (Layout vs Content Pan) e disparo de exportação técnica.
   ========================================================================== */

import './PrintComposer.css';
import L from 'leaflet';
import { PrintItemsManager } from './PrintItemsManager.js';
import { PrintCanvasEngine } from './PrintCanvasEngine.js';
import { PrintPropertiesPanel } from './PrintPropertiesPanel.js';
import { PrintExporter } from './PrintExporter.js';
import { PrintSheetsManager } from './PrintSheetsManager.js';
import { PrintAlignmentHelper } from './PrintAlignmentHelper.js';
import { UIToast } from '@thibezer/ui-components-kit';

export class PrintComposerModal {
  constructor(options = {}) {
    this.projectName = options.projectName || 'Levantamento Cartográfico';
    this.layers = options.layers || [];
    this.features = options.features || [];
    this.currentBasemap = options.currentBasemap || 'satelite';
    this.container = null;
    this.isOpen = false;

    // Modos de Interação: 'layout' (mover caixas na folha) | 'content_pan' (navegar dentro do mapa)
    this.interactionMode = 'layout';
    this.showAbntMargins = true;

    this.paperSizes = {
      A4_L: { id: 'A4_L', name: 'A4 Paisagem', width: 297, height: 210, marginL: 25, marginO: 7 },
      A4_P: { id: 'A4_P', name: 'A4 Retrato', width: 210, height: 297, marginL: 25, marginO: 7 },
      A3_L: { id: 'A3_L', name: 'A3 Paisagem', width: 420, height: 297, marginL: 25, marginO: 10 },
      A3_P: { id: 'A3_P', name: 'A3 Retrato', width: 297, height: 420, marginL: 25, marginO: 10 },
      A2_L: { id: 'A2_L', name: 'A2 Paisagem', width: 594, height: 420, marginL: 25, marginO: 10 },
      A1_L: { id: 'A1_L', name: 'A1 Paisagem', width: 841, height: 594, marginL: 25, marginO: 10 }
    };
    this.paperSize = this.paperSizes.A4_L;

    this.projectId = options.projectId || 'projeto_padrao';
    this.sheetsManager = new PrintSheetsManager(this);
    this.history = [];
    this.historyIndex = -1;

    this.items = PrintItemsManager.createDefaultItems(this.projectName, this.paperSize);
    this.selectedItemId = 'item-map-main';
    this.leafletMaps = new Map(); // Sub-instâncias do Leaflet nos itens
    this.insetExtentLayer = null; // Retângulo no Inset Map
    this.canvasEngine = new PrintCanvasEngine(this);

    // Ao recarregar/sair da página com o compositor aberto, grava a edição que ainda aguarda o salvamento automático
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', () => this.sheetsManager.flushPendingSave());
    }
  }

  /** Salvamento automático da prancha ativa após qualquer edição */
  markDirty() {
    this.sheetsManager.scheduleSave();
  }

  pushHistoryState(actionName = 'Alteração') {
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    const state = {
      paperSizeId: this.paperSize.id,
      showAbntMargins: this.showAbntMargins,
      items: JSON.parse(JSON.stringify(this.items || [])),
      action: actionName
    };
    this.history.push(state);
    if (this.history.length > 30) this.history.shift();
    this.historyIndex = this.history.length - 1;
    this.sheetsManager.saveCurrentStateFromComposer();
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      const state = this.history[this.historyIndex];
      this.applyHistorySnapshot(state);
      UIToast.notificar({
        tipo: 'informativo',
        titulo: 'Desfeito',
        mensagem: `Desfez: ${state.action || 'Ação'}`,
        duracao: 1500
      });
    }
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      const state = this.history[this.historyIndex];
      this.applyHistorySnapshot(state);
      UIToast.notificar({
        tipo: 'informativo',
        titulo: 'Refeito',
        mensagem: `Refez: ${state.action || 'Ação'}`,
        duracao: 1500
      });
    }
  }

  applyHistorySnapshot(state) {
    if (!state) return;
    if (state.paperSizeId && this.paperSizes[state.paperSizeId]) {
      this.paperSize = this.paperSizes[state.paperSizeId];
    }
    this.showAbntMargins = state.showAbntMargins !== false;
    this.items = JSON.parse(JSON.stringify(state.items || []));
    this.updatePaperSheetDOM();
    this.renderAllItems();
    this.updatePropertiesPanel();
    this.sheetsManager.saveCurrentStateFromComposer();
  }

  alignLeft() { PrintAlignmentHelper.alignLeft(this); }
  alignCenterH() { PrintAlignmentHelper.alignCenterH(this); }
  alignRight() { PrintAlignmentHelper.alignRight(this); }
  alignTop() { PrintAlignmentHelper.alignTop(this); }
  alignCenterV() { PrintAlignmentHelper.alignCenterV(this); }
  alignBottom() { PrintAlignmentHelper.alignBottom(this); }
  bringToFront() { PrintAlignmentHelper.bringToFront(this); }
  sendToBack() { PrintAlignmentHelper.sendToBack(this); }
  duplicateSelectedItem() { PrintAlignmentHelper.duplicateItem(this); }

  render(container) {
    this.container = container;
    this.container.innerHTML = `
      <div id="cm-print-composer-modal" class="cm-print-modal-overlay hidden">
        <!-- Toolbar Superior Estilo QGIS -->
        <header class="cm-print-topbar">
          <div class="cm-print-title-area">
            <span class="cm-print-title">📐 Layout de Impressão</span>
            <span class="cm-print-zoom-badge" id="cm-print-paper-badge" title="Tamanho da folha">${this.paperSize.name}</span>
          </div>

          <!-- Controle de Multi-Pranchas -->
          <div id="cm-print-sheets-controls" class="cm-print-tools-group" role="group" aria-label="Gestão de Pranchas"></div>

          <!-- Ferramentas de Inserção de Elementos Cartográficos -->
          <div class="cm-print-tools-group cm-print-insert-group" role="group" aria-label="Inserir elemento">
            <button class="cm-print-tool-btn" id="btn-add-print-map" title="Inserir Novo Mapa">🗺️ <span class="cm-tb-label">Mapa</span></button>
            <button class="cm-print-tool-btn" id="btn-add-print-inset" title="Inserir Mini-mapa de Localização (Overview)">🌎 <span class="cm-tb-label">Inset</span></button>
            <button class="cm-print-tool-btn" id="btn-add-print-arrow" title="Inserir Rosa dos Ventos">🧭 <span class="cm-tb-label">Norte</span></button>
            <button class="cm-print-tool-btn" id="btn-add-print-scale" title="Inserir Barra de Escala">📏 <span class="cm-tb-label">Escala</span></button>
            <button class="cm-print-tool-btn" id="btn-add-print-legend" title="Inserir Legenda Temática">📋 <span class="cm-tb-label">Legenda</span></button>
            <button class="cm-print-tool-btn" id="btn-add-print-vertices" title="Inserir Tabela de Vértices Topográfica">📊 <span class="cm-tb-label">Vértices</span></button>
            <button class="cm-print-tool-btn" id="btn-add-print-text" title="Inserir Bloco de Notas Técnicas">📝 <span class="cm-tb-label">Notas</span></button>
            <button class="cm-print-tool-btn" id="btn-add-print-titleblock" title="Inserir Selo Técnico ABNT NBR 13133">🏛️ <span class="cm-tb-label">Selo</span></button>
            <button class="cm-print-tool-btn" id="btn-add-print-shape" title="Inserir Moldura / Forma Geométrica">🔲 <span class="cm-tb-label">Moldura</span></button>
            <button class="cm-print-tool-btn" id="btn-add-print-label" title="Inserir Título / Rótulo Livre">🏷️ <span class="cm-tb-label">Título</span></button>
            <button class="cm-print-tool-btn" id="btn-add-print-image" title="Inserir Imagem / Logotipo">🖼️ <span class="cm-tb-label">Logo</span></button>
          </div>

          <!-- Barra Rápida de Alinhamento e Camadas (Illustrator/CAD) -->
          <div class="cm-print-tools-group cm-print-align-group" role="group" aria-label="Alinhamento e Organização">
            <button class="cm-print-tool-btn cm-print-icon-btn" id="btn-topbar-align-left" title="Alinhar à Esquerda">⇤</button>
            <button class="cm-print-tool-btn cm-print-icon-btn" id="btn-topbar-align-center-h" title="Centralizar Horizontalmente">⧿</button>
            <button class="cm-print-tool-btn cm-print-icon-btn" id="btn-topbar-align-right" title="Alinhar à Direita">⇥</button>
            <button class="cm-print-tool-btn cm-print-icon-btn" id="btn-topbar-align-top" title="Alinhar ao Topo">⤒</button>
            <button class="cm-print-tool-btn cm-print-icon-btn" id="btn-topbar-align-center-v" title="Centralizar Verticalmente">⧾</button>
            <button class="cm-print-tool-btn cm-print-icon-btn" id="btn-topbar-align-bottom" title="Alinhar à Base">⤓</button>
            <button class="cm-print-tool-btn cm-print-icon-btn" id="btn-topbar-duplicate" title="Duplicar Item Selecionado (Ctrl+D)">📋</button>
          </div>

          <!-- Guias Inteligentes (Smart Guides) e Histórico -->
          <div class="cm-print-tools-group" role="group" aria-label="Guias e Histórico">
            <button class="cm-print-tool-btn active" id="btn-toggle-smart-guides" title="Guias Inteligentes (U): Alinhamento magnético automático estilo Adobe Illustrator">
              🧲 <span class="cm-tb-label">Guias Inteligentes</span>
            </button>
            <button class="cm-print-tool-btn cm-print-icon-btn" id="btn-print-undo" title="Desfazer no Layout (Ctrl+Z)">↩️</button>
            <button class="cm-print-tool-btn cm-print-icon-btn" id="btn-print-redo" title="Refazer no Layout (Ctrl+Y)">↪️</button>
          </div>

          <!-- Alternância de Modo: Mover Itens vs Navegar no Conteúdo do Mapa -->
          <div class="cm-print-tools-group" role="group" aria-label="Modo de interação">
            <button class="cm-print-tool-btn active" id="btn-mode-layout" title="Modo Layout: Mover, alinhar e redimensionar elementos (Esc)">
              🖱️ <span class="cm-tb-label">Layout</span>
            </button>
            <button class="cm-print-tool-btn" id="btn-mode-content-pan" title="Navegar no Mapa: Pan e zoom do terreno dentro da moldura">
              🖐️ <span class="cm-tb-label">Navegar no mapa</span>
            </button>
          </div>

          <!-- Controles de Zoom e Enquadramento da Folha -->
          <div class="cm-print-tools-group" role="group" aria-label="Zoom da prancheta">
            <button class="cm-print-tool-btn cm-print-icon-btn" id="btn-print-zoom-out" title="Diminuir zoom (−)" aria-label="Diminuir zoom">−</button>
            <span class="cm-print-zoom-badge" id="cm-print-zoom-val" title="Ctrl + roda do mouse também ajusta o zoom">100%</span>
            <button class="cm-print-tool-btn cm-print-icon-btn" id="btn-print-zoom-in" title="Aumentar zoom (+)" aria-label="Aumentar zoom">+</button>
            <button class="cm-print-tool-btn" id="btn-print-zoom-fit" title="Enquadrar folha na tela (0)">🎯 <span class="cm-tb-label">Enquadrar</span></button>
            <button class="cm-print-tool-btn cm-print-accent-btn" id="btn-print-auto-align" title="Reorganizar e alinhar os elementos à norma ABNT (descarta posições manuais)">📐 <span class="cm-tb-label">Alinhar ABNT</span></button>
          </div>

          <!-- Ações de Exportação em Alta Resolução -->
          <div class="cm-print-actions-group">
            <select id="print-export-dpi-select" class="cm-native-select cm-print-dpi-select" title="Resolução de exportação">
              <option value="300" selected>300 DPI (Plotagem)</option>
              <option value="150">150 DPI (Rápido)</option>
            </select>
            <ui-botao-primario inline id="btn-export-print-png" variante="secundario" style="height: 28px; font-size: 11px;">
              🖼️ PNG
            </ui-botao-primario>
            <ui-botao-primario inline id="btn-export-print-pdf" variante="primary" style="height: 28px; font-size: 11px; white-space: nowrap;">
              📄 PDF Prancha
            </ui-botao-primario>
            <ui-botao-primario inline id="btn-export-print-all-pdf" variante="secundario" style="height: 28px; font-size: 11px; white-space: nowrap;" title="Exportar todas as pranchas do projeto em um arquivo PDF multi-páginas">
              📚 Todas em PDF
            </ui-botao-primario>
            <button id="btn-close-print-composer" class="cm-print-close-btn" title="Fechar layout" aria-label="Fechar layout">×</button>
          </div>
        </header>

        <!-- Faixa de Aviso Quando no Modo Navegação de Conteúdo -->
        <div id="cm-print-pan-alert-banner" class="cm-print-pan-banner hidden">
          <span>🖐️ <strong>Modo Navegação de Mapa Ativo:</strong> Arraste o mapa com o botão esquerdo para enquadrar a feição | Use o scroll para ajustar o zoom. Quando terminar, clique em <strong>Layout</strong>.</span>
          <button id="btn-dismiss-pan-banner" class="cm-pan-banner-btn">Voltar ao Layout</button>
        </div>

        <!-- Área de Trabalho Principal: Prancheta com Réguas + Painel Lateral -->
        <div class="cm-print-main-workspace">
          <div class="cm-print-rulers-wrapper" id="cm-print-rulers-mount">
            <div class="cm-print-ruler-corner">mm</div>
            <div class="cm-print-ruler-h"><canvas id="ruler-h" class="cm-print-ruler-canvas"></canvas></div>
            <div class="cm-print-ruler-v"><canvas id="ruler-v" class="cm-print-ruler-canvas"></canvas></div>

            <div class="cm-print-viewport" id="cm-print-viewport">
              <div class="cm-print-paper-sheet" id="cm-print-paper-sheet">
                <!-- Margens ABNT Normatizadas (Overlay) -->
                <div class="cm-abnt-margins-frame" id="cm-abnt-margins-frame"></div>
                <!-- Container de Itens Cartográficos -->
                <div id="cm-print-items-layer" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></div>
                <!-- Canvas de Guias Automáticas Inteligentes (Smart Guides estilo Illustrator) -->
                <canvas id="cm-print-smart-guides-canvas" class="cm-print-smart-guides-canvas" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 90;"></canvas>
              </div>
            </div>
          </div>

          <!-- Painel Lateral de Propriedades e Elementos -->
          <div id="cm-print-props-panel-mount">
            ${PrintPropertiesPanel.render(this)}
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  open(projectName, layers, features, basemap, projectId) {
    if (projectName) this.projectName = projectName;
    if (layers) this.layers = layers;
    if (features) this.features = features;
    if (basemap) this.currentBasemap = basemap;
    if (projectId) this.projectId = projectId;

    const modal = document.getElementById('cm-print-composer-modal');
    if (modal) modal.classList.remove('hidden');
    this.isOpen = true;
    this.canvasEngine.bindKeyboardShortcuts();

    // Inicializa ou carrega as pranchas do projeto
    const currentSheet = this.sheetsManager.init(this.projectId, this.projectName, this.paperSizes);
    if (currentSheet) {
      this.paperSize = currentSheet.paperSize;
      this.showAbntMargins = currentSheet.showAbntMargins !== false;
      this.items = JSON.parse(JSON.stringify(currentSheet.items || []));
      const badge = document.getElementById('cm-print-paper-badge');
      if (badge) badge.textContent = this.paperSize.name;
    }

    this.sheetsManager.renderSheetsSelectorDOM();

    // Inicializa pilha de histórico da prancha
    this.history = [{
      paperSizeId: this.paperSize.id,
      showAbntMargins: this.showAbntMargins,
      items: JSON.parse(JSON.stringify(this.items || [])),
      action: 'Abertura da Prancha'
    }];
    this.historyIndex = 0;

    this.updatePaperSheetDOM();
    this.renderAllItems();
    this.updatePropertiesPanel();

    setTimeout(() => {
      this.canvasEngine.zoomFit();
      this.canvasEngine.renderRulers();
      this.updateInsetMapExtent();
    }, 100);
  }

  resetDefaultLayout() {
    this.items = PrintItemsManager.createDefaultItems(this.projectName, this.paperSize);
    this.renderAllItems();
    this.updatePropertiesPanel();
    this.selectItem('item-map-main');
    this.markDirty();
  }

  close() {
    if (this.sheetsManager) this.sheetsManager.saveCurrentStateFromComposer();
    this.destroyLeafletMaps();
    if (this.canvasEngine) this.canvasEngine.destroy();
    const modal = document.getElementById('cm-print-composer-modal');
    if (modal) modal.classList.add('hidden');
    this.isOpen = false;
  }

  setInteractionMode(mode) {
    this.interactionMode = mode;
    const btnLayout = document.getElementById('btn-mode-layout');
    const btnPan = document.getElementById('btn-mode-content-pan');
    const banner = document.getElementById('cm-print-pan-alert-banner');

    if (mode === 'content_pan') {
      btnLayout?.classList.remove('active');
      btnPan?.classList.add('active');
      banner?.classList.remove('hidden');
      document.querySelectorAll('.cm-item-map-frame').forEach(el => el.classList.add('pan-enabled'));
      this.enableLeafletMapPan(true);
    } else {
      btnPan?.classList.remove('active');
      btnLayout?.classList.add('active');
      banner?.classList.add('hidden');
      document.querySelectorAll('.cm-item-map-frame').forEach(el => el.classList.remove('pan-enabled'));
      this.enableLeafletMapPan(false);
    }
  }

  enableLeafletMapPan(enable) {
    this.leafletMaps.forEach((map) => {
      if (enable) {
        map.dragging.enable();
        map.scrollWheelZoom.enable();
      } else {
        map.dragging.disable();
        map.scrollWheelZoom.disable();
      }
    });
  }

  setPaperSize(sizeKey) {
    if (this.paperSizes[sizeKey]) {
      this.paperSize = this.paperSizes[sizeKey];
      const badge = document.getElementById('cm-print-paper-badge');
      if (badge) badge.textContent = this.paperSize.name;

      this.items = PrintItemsManager.createDefaultItems(this.projectName, this.paperSize);
      this.updatePaperSheetDOM();
      this.renderAllItems();
      this.updatePropertiesPanel();

      setTimeout(() => {
        this.canvasEngine.zoomFit();
      }, 50);
      this.markDirty();
    }
  }

  setAbntMargins(visible) {
    this.showAbntMargins = visible;
    this.updatePaperSheetDOM();
    this.markDirty();
  }

  updatePaperSheetDOM() {
    const sheet = document.getElementById('cm-print-paper-sheet');
    const marginsFrame = document.getElementById('cm-abnt-margins-frame');
    if (!sheet) return;

    const wPx = this.paperSize.width * this.canvasEngine.mmToPx;
    const hPx = this.paperSize.height * this.canvasEngine.mmToPx;
    sheet.style.width = `${wPx}px`;
    sheet.style.height = `${hPx}px`;

    if (marginsFrame) {
      if (this.showAbntMargins) {
        marginsFrame.style.display = 'block';
        const mL = this.paperSize.marginL * this.canvasEngine.mmToPx;
        const mO = this.paperSize.marginO * this.canvasEngine.mmToPx;
        marginsFrame.style.left = `${mL}px`;
        marginsFrame.style.top = `${mO}px`;
        marginsFrame.style.right = `${mO}px`;
        marginsFrame.style.bottom = `${mO}px`;
      } else {
        marginsFrame.style.display = 'none';
      }
    }

    this.layoutItemsDOM();
    this.canvasEngine.renderRulers();
  }

  /**
   * Renderiza todos os itens do zero (chamado ao abrir ou mudar tamanho de folha)
   */
  renderAllItems() {
    const layer = document.getElementById('cm-print-items-layer');
    if (!layer) return;

    this.destroyLeafletMaps();

    layer.innerHTML = this.items.map(item => {
      if (item.visible === false) return '';
      const isSel = item.id === this.selectedItemId;
      const xPx = item.x * this.canvasEngine.mmToPx;
      const yPx = item.y * this.canvasEngine.mmToPx;
      const wPx = item.width * this.canvasEngine.mmToPx;
      const hPx = item.height * this.canvasEngine.mmToPx;

      // O conteúdo é montado na medida de 100% (px = mm × 3,78) e escalado por transform:
      // textos, mapas e a extensão visível ficam idênticos em qualquer zoom da prancheta.
      return `
        <div class="cm-print-item ${isSel ? 'selected' : ''} ${item.locked ? 'locked' : ''}"
             data-item-id="${item.id}"
             data-item-type="${item.type}"
             style="left: ${xPx}px; top: ${yPx}px; width: ${wPx}px; height: ${hPx}px;">
          <div class="cm-item-scaler" style="${this.getScalerStyle(item)}">${this.getItemInnerContent(item)}</div>
          ${isSel && !item.locked ? this.getResizeHandlesHTML() : ''}
        </div>
      `;
    }).join('');

    this.mountLeafletMaps();
    this.canvasEngine.bindInteractions(layer);
  }

  getItemInnerContent(item) {
    if (item.type === 'map' || item.type === 'inset_map') {
      return `
        <div class="cm-item-map-frame ${this.interactionMode === 'content_pan' ? 'pan-enabled' : ''}">
          <div id="leaf-map-${item.id}" class="cm-item-map-canvas" data-composer-map-id="${item.id}"></div>
          ${item.showGrid ? `<div class="cm-item-grid-border"><span class="cm-grid-label-n">...</span></div>` : ''}
        </div>
      `;
    } else if (item.type === 'north_arrow') {
      return PrintItemsManager.getNorthArrowSVG(item.arrowStyle || 'classic', item.rotation || 0);
    } else if (item.type === 'scale_bar') {
      return PrintItemsManager.renderScaleBar(item, item.scale || 10000);
    } else if (item.type === 'legend') {
      return PrintItemsManager.renderLegend(item, this.layers);
    } else if (item.type === 'title_block') {
      return PrintItemsManager.renderTitleBlock(item, this.projectName);
    } else if (item.type === 'table_vertices') {
      return PrintItemsManager.renderVerticesTable(item, this.features);
    } else if (item.type === 'text_block') {
      return PrintItemsManager.renderTextBlock(item);
    } else if (item.type === 'shape') {
      return PrintItemsManager.renderShape(item);
    } else if (item.type === 'image') {
      return PrintItemsManager.renderImage(item);
    } else if (item.type === 'label') {
      return PrintItemsManager.renderLabel(item);
    }
    return '';
  }

  getResizeHandlesHTML() {
    return `
      <div class="cm-resize-handle nw" data-handle="nw"></div>
      <div class="cm-resize-handle n" data-handle="n"></div>
      <div class="cm-resize-handle ne" data-handle="ne"></div>
      <div class="cm-resize-handle e" data-handle="e"></div>
      <div class="cm-resize-handle se" data-handle="se"></div>
      <div class="cm-resize-handle s" data-handle="s"></div>
      <div class="cm-resize-handle sw" data-handle="sw"></div>
      <div class="cm-resize-handle w" data-handle="w"></div>
    `;
  }

  /**
   * Seleciona um item SEM recriar os mapas Leaflet (preservação de zoom e pan)
   */
  selectItem(itemId) {
    this.selectedItemId = itemId;

    // Remove classes selected e alças anteriores
    document.querySelectorAll('.cm-print-item').forEach(el => {
      el.classList.remove('selected');
      el.querySelectorAll('.cm-resize-handle').forEach(h => h.remove());
    });

    if (itemId) {
      const targetEl = document.querySelector(`[data-item-id="${itemId}"]`);
      const item = this.items.find(i => i.id === itemId);
      if (targetEl && item) {
        targetEl.classList.add('selected');
        if (!item.locked) {
          targetEl.insertAdjacentHTML('beforeend', this.getResizeHandlesHTML());
        }
      }
    }

    this.updatePropertiesPanel();
  }

  mountLeafletMaps() {
    this.items.forEach(item => {
      if ((item.type === 'map' || item.type === 'inset_map') && item.visible !== false) {
        const domEl = document.getElementById(`leaf-map-${item.id}`);
        if (domEl && !this.leafletMaps.has(item.id)) {
          const map = L.map(domEl, {
            attributionControl: false,
            zoomControl: false,
            preferCanvas: true,
            dragging: this.interactionMode === 'content_pan',
            scrollWheelZoom: this.interactionMode === 'content_pan'
          });

          // Adiciona Basemap configurado
          this.applyBasemapToMap(map, item.basemap || (item.type === 'inset_map' ? 'cartodb_positron' : this.currentBasemap));

          const savedView = item.view && Array.isArray(item.view.center) && Number.isFinite(item.view.zoom) ? item.view : null;

          if (item.type === 'inset_map') {
            map.setView([-15.78, -47.92], 4);
          } else {
            // Renderiza geometrias vetoriais das camadas
            if (this.features.length > 0) {
              const bounds = [];
              this.features.forEach(f => {
                if (f.visible === false) return;
                const layer = this.layers.find(l => l.id === f.layerId) || {};
                const color = layer.color || f.color || '#00E08A';
                const style = { color, fillColor: color, fillOpacity: 0.35, weight: 2 };

                const rawType = (f.type || '').toLowerCase();
                const coords = f.coordinates;

                if ((rawType === 'polygon' || rawType === 'multipolygon') && Array.isArray(coords)) {
                  L.polygon(coords, style).addTo(map);
                  this.pushBounds(bounds, coords);
                } else if ((rawType === 'linestring' || rawType === 'line') && Array.isArray(coords)) {
                  L.polyline(coords, style).addTo(map);
                  this.pushBounds(bounds, coords);
                } else if (rawType === 'point' && coords) {
                  const pt = Array.isArray(coords[0]) ? coords[0] : coords;
                  if (!isNaN(pt[0]) && !isNaN(pt[1])) {
                    L.circleMarker(pt, { ...style, radius: 6, fillOpacity: 0.85 }).addTo(map);
                    bounds.push(pt);
                  }
                }
              });

              if (bounds.length > 0) map.fitBounds(bounds, { padding: [20, 20] });
              else map.setView([-15.78, -47.92], 14);
            } else {
              map.setView([-15.78, -47.92], 14);
            }
          }

          // Restaura o enquadramento salvo da prancha (pan/zoom/escala feitos pelo usuário)
          if (savedView) map.setView(savedView.center, savedView.zoom, { animate: false });

          // Sincronização de zoom <-> escala e grade cartográfica dinâmica
          const updateGridAndScale = () => {
            const center = map.getCenter();
            item.scale = PrintItemsManager.calculateScale(map.getZoom(), center.lat);

            // Sincroniza barra de escala
            if (item.type === 'map') {
              const scaleBar = this.items.find(i => i.type === 'scale_bar');
              if (scaleBar) {
                scaleBar.scale = item.scale;
                const sbEl = document.querySelector('[data-item-id="item-scale-bar"] .cm-item-scale-bar');
                if (sbEl) sbEl.outerHTML = PrintItemsManager.renderScaleBar(scaleBar, item.scale);
              }

              // Sincroniza retângulo no Inset Map
              this.updateInsetMapExtent();
            }

            // Atualiza coordenadas reais da grade
            const frame = domEl.parentElement;
            if (frame && item.showGrid) {
              const b = map.getBounds();
              const oldGrid = frame.querySelector('.cm-item-grid-border');
              if (oldGrid) oldGrid.remove();
              frame.insertAdjacentHTML('beforeend', PrintItemsManager.renderMapGridBorder({
                north: b.getNorth(),
                south: b.getSouth(),
                west: b.getWest(),
                east: b.getEast()
              }, item.gridType || 'dms'));
            }
          };

          map.on('moveend zoomend', updateGridAndScale);
          // Registrado após o enquadramento inicial: só movimentos posteriores viram enquadramento salvo
          map.on('moveend', () => {
            const c = map.getCenter();
            item.view = { center: [c.lat, c.lng], zoom: map.getZoom() };
            this.markDirty();
          });
          setTimeout(updateGridAndScale, 150);

          if (item.rotation) {
            domEl.style.transform = `rotate(${item.rotation}deg)`;
          }

          this.leafletMaps.set(item.id, map);
        }
      }
    });
  }

  pushBounds(boundsArr, coords) {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      boundsArr.push(coords);
    } else if (Array.isArray(coords[0])) {
      coords.forEach(c => this.pushBounds(boundsArr, c));
    }
  }

  applyBasemapToMap(map, basemapKey) {
    // Remove tiles existentes
    map.eachLayer(l => {
      if (l instanceof L.TileLayer) map.removeLayer(l);
    });

    if (basemapKey === 'none' || basemapKey === 'branco') {
      map.getContainer().style.background = '#ffffff';
      return;
    }

    let url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    let maxZoom = 19;

    if (basemapKey === 'osm') {
      url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      maxZoom = 19;
    } else if (basemapKey === 'cartodb_positron' || basemapKey === 'esri_light' || basemapKey === 'light') {
      // Esri Light Gray Canvas: Elegante, sem API Key, perfeito para inset/overview map
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}';
      maxZoom = 16;
    } else if (basemapKey === 'cartodb_dark' || basemapKey === 'esri_dark' || basemapKey === 'dark') {
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
      maxZoom = 16;
    } else if (basemapKey === 'relevo' || basemapKey === 'topografia') {
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}';
    } else if (basemapKey === 'google_satelite_puro') {
      url = 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}';
      maxZoom = 20;
    } else if (basemapKey === 'google_satelite') {
      url = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
      maxZoom = 20;
    }

    L.tileLayer(url, { maxZoom, crossOrigin: true }).addTo(map);
  }

  updateInsetMapExtent() {
    const mainMapItem = this.items.find(i => i.type === 'map');
    const insetItem = this.items.find(i => i.type === 'inset_map');
    if (!mainMapItem || !insetItem) return;

    const mainMap = this.leafletMaps.get(mainMapItem.id);
    const insetMap = this.leafletMaps.get(insetItem.id);
    if (!mainMap || !insetMap) return;

    const b = mainMap.getBounds();
    const bounds = [[b.getSouth(), b.getWest()], [b.getNorth(), b.getEast()]];

    if (this.insetExtentLayer) {
      this.insetExtentLayer.setBounds(bounds);
    } else {
      this.insetExtentLayer = L.rectangle(bounds, {
        color: '#ff2244',
        weight: 1.5,
        fillColor: '#ff2244',
        fillOpacity: 0.25
      }).addTo(insetMap);
    }
  }

  applyMapScaleAndRotation(item) {
    const map = this.leafletMaps.get(item.id);
    const domEl = document.getElementById(`leaf-map-${item.id}`);
    if (map && domEl) {
      const center = map.getCenter();
      const targetZoom = PrintItemsManager.calculateZoom(item.scale, center.lat);
      map.setZoom(Math.round(targetZoom));
      domEl.style.transform = `rotate(${item.rotation || 0}deg)`;
    }
  }

  destroyLeafletMaps() {
    this.leafletMaps.forEach((map) => {
      try { map.remove(); } catch (e) { /* ignore */ }
    });
    this.leafletMaps.clear();
    this.insetExtentLayer = null;
  }

  getScalerStyle(item) {
    const base = PrintCanvasEngine.BASE_PX_PER_MM;
    return `width: ${item.width * base}px; height: ${item.height * base}px; transform: scale(${this.canvasEngine.zoom});`;
  }

  updateItemPositionDOM(item, invalidateMap = true) {
    const el = document.querySelector(`[data-item-id="${item.id}"]`);
    if (el) {
      el.style.left = `${item.x * this.canvasEngine.mmToPx}px`;
      el.style.top = `${item.y * this.canvasEngine.mmToPx}px`;
      el.style.width = `${item.width * this.canvasEngine.mmToPx}px`;
      el.style.height = `${item.height * this.canvasEngine.mmToPx}px`;
      const scaler = el.querySelector(':scope > .cm-item-scaler');
      if (scaler) scaler.style.cssText = this.getScalerStyle(item);
    }
    const map = this.leafletMaps.get(item.id);
    if (map && invalidateMap) map.invalidateSize();
  }

  /** Reposiciona todos os itens após mudança de zoom (os mapas não mudam de tamanho: só o transform) */
  layoutItemsDOM() {
    this.items.forEach(item => {
      if (item.visible !== false) this.updateItemPositionDOM(item, false);
    });
  }

  toggleItemLock(itemId) {
    const it = this.items.find(i => i.id === itemId);
    if (it) {
      it.locked = !it.locked;
      this.selectItem(this.selectedItemId);
      this.markDirty();
    }
  }

  toggleItemVisibility(itemId) {
    const it = this.items.find(i => i.id === itemId);
    if (it) {
      it.visible = it.visible === false;
      this.renderAllItems();
      this.updatePropertiesPanel();
      this.markDirty();
    }
  }

  deleteItem(itemId) {
    this.items = this.items.filter(i => i.id !== itemId);
    if (this.selectedItemId === itemId) this.selectedItemId = null;
    this.renderAllItems();
    this.updatePropertiesPanel();
    this.markDirty();
  }

  updatePropertiesPanel() {
    const mount = document.getElementById('cm-print-props-panel-mount');
    if (mount) {
      // Preserva a rolagem do painel (e a seção aberta) ao reconstruí-lo após cada seleção/arrasto
      const prevScroll = mount.querySelector('.cm-print-props-scroll')?.scrollTop || 0;
      const closed = [...mount.querySelectorAll('details.cm-inspector-accordion')].map(d => d.open);
      mount.innerHTML = PrintPropertiesPanel.render(this);
      mount.querySelectorAll('details.cm-inspector-accordion').forEach((d, i) => {
        if (closed[i] === false) d.open = false;
      });
      const scroller = mount.querySelector('.cm-print-props-scroll');
      if (scroller) scroller.scrollTop = prevScroll;
      PrintPropertiesPanel.bindEvents(this);
    }
  }

  bindEvents() {
    const btnClose = document.getElementById('btn-close-print-composer');
    if (btnClose) btnClose.addEventListener('click', () => this.close());

    // Seletor de DPI
    const dpiSelect = document.getElementById('print-export-dpi-select');
    const getDPI = () => parseInt(dpiSelect?.value || '300', 10);

    const btnPng = document.getElementById('btn-export-print-png');
    if (btnPng) btnPng.addEventListener('click', () => PrintExporter.exportToPNG(this, getDPI()));

    const btnPdf = document.getElementById('btn-export-print-pdf');
    if (btnPdf) btnPdf.addEventListener('click', () => PrintExporter.exportToPDF(this, getDPI()));

    const btnAllPdf = document.getElementById('btn-export-print-all-pdf');
    if (btnAllPdf) btnAllPdf.addEventListener('click', () => PrintExporter.exportAllSheetsToPDF(this, getDPI()));

    // Botão de Toggle das Guias Inteligentes
    const btnSmartGuides = document.getElementById('btn-toggle-smart-guides');
    if (btnSmartGuides) {
      btnSmartGuides.addEventListener('click', () => {
        const nextState = !this.canvasEngine.smartGuides.enabled;
        this.canvasEngine.smartGuides.setEnabled(nextState);
        btnSmartGuides.classList.toggle('active', nextState);
        UIToast.notificar({
          tipo: nextState ? 'sucesso' : 'informativo',
          titulo: 'Guias Inteligentes',
          mensagem: nextState ? 'Guias magnéticas ativadas (estilo Illustrator).' : 'Guias desativadas.',
          duracao: 2000
        });
      });
    }

    // Histórico Desfazer / Refazer
    const btnUndo = document.getElementById('btn-print-undo');
    if (btnUndo) btnUndo.addEventListener('click', () => this.undo());

    const btnRedo = document.getElementById('btn-print-redo');
    if (btnRedo) btnRedo.addEventListener('click', () => this.redo());

    // Botões da Topbar de Alinhamento Rápido
    const topAlignL = document.getElementById('btn-topbar-align-left');
    const topAlignCH = document.getElementById('btn-topbar-align-center-h');
    const topAlignR = document.getElementById('btn-topbar-align-right');
    const topAlignT = document.getElementById('btn-topbar-align-top');
    const topAlignCV = document.getElementById('btn-topbar-align-center-v');
    const topAlignB = document.getElementById('btn-topbar-align-bottom');
    const topDup = document.getElementById('btn-topbar-duplicate');

    if (topAlignL) topAlignL.onclick = () => this.alignLeft();
    if (topAlignCH) topAlignCH.onclick = () => this.alignCenterH();
    if (topAlignR) topAlignR.onclick = () => this.alignRight();
    if (topAlignT) topAlignT.onclick = () => this.alignTop();
    if (topAlignCV) topAlignCV.onclick = () => this.alignCenterV();
    if (topAlignB) topAlignB.onclick = () => this.alignBottom();
    if (topDup) topDup.onclick = () => this.duplicateSelectedItem();

    // Alternância de modo
    const btnLayout = document.getElementById('btn-mode-layout');
    if (btnLayout) btnLayout.addEventListener('click', () => this.setInteractionMode('layout'));

    const btnPan = document.getElementById('btn-mode-content-pan');
    if (btnPan) btnPan.addEventListener('click', () => this.setInteractionMode('content_pan'));

    const btnDismissBanner = document.getElementById('btn-dismiss-pan-banner');
    if (btnDismissBanner) btnDismissBanner.addEventListener('click', () => this.setInteractionMode('layout'));

    // Controles de Zoom
    const btnZoomIn = document.getElementById('btn-print-zoom-in');
    if (btnZoomIn) btnZoomIn.addEventListener('click', () => this.canvasEngine.zoomIn());

    const btnZoomOut = document.getElementById('btn-print-zoom-out');
    if (btnZoomOut) btnZoomOut.addEventListener('click', () => this.canvasEngine.zoomOut());

    const btnZoomFit = document.getElementById('btn-print-zoom-fit');
    if (btnZoomFit) btnZoomFit.addEventListener('click', () => this.canvasEngine.zoomFit());

    // Alinhar e organizar prancha à norma ABNT
    const btnAutoAlign = document.getElementById('btn-print-auto-align');
    if (btnAutoAlign) btnAutoAlign.addEventListener('click', () => this.resetDefaultLayout());

    // Botões de inserção de itens cartográficos
    const addItemHelper = (btnId, type) => {
      const btn = document.getElementById(btnId);
      if (btn) {
        btn.addEventListener('click', () => {
          const item = PrintItemsManager.createNewItem(type, this.projectName, this.items.length);
          if (item) {
            this.items.push(item);
            this.renderAllItems();
            this.selectItem(item.id);
            this.markDirty();
          }
        });
      }
    };

    addItemHelper('btn-add-print-map', 'map');
    addItemHelper('btn-add-print-inset', 'inset_map');
    addItemHelper('btn-add-print-arrow', 'north_arrow');
    addItemHelper('btn-add-print-scale', 'scale_bar');
    addItemHelper('btn-add-print-legend', 'legend');
    addItemHelper('btn-add-print-vertices', 'table_vertices');
    addItemHelper('btn-add-print-text', 'text_block');
    addItemHelper('btn-add-print-titleblock', 'title_block');
    addItemHelper('btn-add-print-shape', 'shape');
    addItemHelper('btn-add-print-label', 'label');
    addItemHelper('btn-add-print-image', 'image');
  }
}
