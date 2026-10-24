/* ==========================================================================
   ConecteMapas - PrintComposerModal (QGIS Print Layout Composer)
   Responsabilidade Única: Orquestrador principal do Compositor de Impressão,
   gestão de estado de prancha, sincronização Leaflet, alternância de modos
   (Layout vs Content Pan) e disparo de exportação técnica.
   ========================================================================== */

import './PrintComposer.css';
import './PrintPropertiesPanel.css';
import L from 'leaflet';
import { PrintItemsManager } from './PrintItemsManager.js';
import { PrintCanvasEngine } from './PrintCanvasEngine.js';
import { PrintPropertiesPanel } from './PrintPropertiesPanel.js';
import { PrintSheetsManager } from './PrintSheetsManager.js';
import { PrintAlignmentHelper } from './PrintAlignmentHelper.js';
import { PrintToolbar } from './PrintToolbar.js';
import { PrintHistory } from './PrintHistory.js';
import { UIToast } from '@thibezer/ui-components-kit';
import { BasemapCatalog } from '../../services/BasemapCatalog.js';
import { PrintViewResolver } from './PrintViewResolver.js';
import { PrintMapRenderer } from './PrintMapRenderer.js';
import { PrintVectorLayer } from './PrintVectorLayer.js';

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
    this.panelSections = {}; // Seções do painel lateral abertas/fechadas pelo usuário, por nome

    this.paperSizes = {
      A4_L: { id: 'A4_L', name: 'A4 Paisagem', width: 297, height: 210, marginL: 25, marginO: 7 },
      A4_P: { id: 'A4_P', name: 'A4 Retrato', width: 210, height: 297, marginL: 25, marginO: 7 },
      A3_L: { id: 'A3_L', name: 'A3 Paisagem', width: 420, height: 297, marginL: 25, marginO: 10 },
      A3_P: { id: 'A3_P', name: 'A3 Retrato', width: 297, height: 420, marginL: 25, marginO: 10 },
      A2_L: { id: 'A2_L', name: 'A2 Paisagem', width: 594, height: 420, marginL: 25, marginO: 10 },
      A1_L: { id: 'A1_L', name: 'A1 Paisagem', width: 841, height: 594, marginL: 25, marginO: 10 }
    };
    this.paperSize = this.paperSizes.A4_L;
    this.exportDpi = 300;

    this.projectId = options.projectId || 'projeto_padrao';
    this.sheetsManager = new PrintSheetsManager(this);
    this.history = new PrintHistory();

    this.items = PrintItemsManager.createDefaultItems(this.projectName, this.paperSize);
    this.selectedItemId = 'item-map-main';
    this.leafletMaps = new Map(); // Sub-instâncias do Leaflet nos itens
    this.mapRefreshers = new Map(); // Atualização de grade/escala de cada mapa, sem recriá-lo
    this.mapTimers = new Set(); // Timeouts dos mapas montados, cancelados ao destruí-los
    this.insetExtentLayer = null; // Retângulo no Inset Map
    this.vectorLayers = new Map(); // Camada vetorial (canvas) de cada mapa
    this.resolveCache = new Map(); // Filtros casados por mapa, refeitos só quando a vista ou as feições mudam
    this.library = { filters: [], viewTemplates: [] }; // Filtros e modelos de vista do projeto
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

  captureState(actionName) {
    return {
      paperSizeId: this.paperSize.id,
      paperSize: { ...this.paperSize },
      showAbntMargins: this.showAbntMargins,
      items: JSON.parse(JSON.stringify(this.items || [])),
      action: actionName
    };
  }

  /** Recomeça o histórico a partir do estado atual (abertura ou troca de prancha) */
  resetHistory() {
    this.history.reset(this.captureState('Abertura da Prancha'));
  }

  /**
   * Registra o estado DEPOIS da ação (chamar sempre após a mudança).
   * `coalesceKey` junta edições em rajada no mesmo campo num único passo.
   */
  pushHistoryState(actionName = 'Alteração', { coalesceKey = null } = {}) {
    this.history.push(this.captureState(actionName), { coalesceKey });
    this.markDirty();
  }

  undo() {
    const step = this.history.undo();
    if (!step) return;
    this.applyHistorySnapshot(step.state);
    UIToast.notificar({
      tipo: 'informativo',
      titulo: 'Desfeito',
      mensagem: `Desfez: ${step.action || 'Ação'}`,
      duracao: 1500
    });
  }

  redo() {
    const step = this.history.redo();
    if (!step) return;
    this.applyHistorySnapshot(step.state);
    UIToast.notificar({
      tipo: 'informativo',
      titulo: 'Refeito',
      mensagem: `Refez: ${step.action || 'Ação'}`,
      duracao: 1500
    });
  }

  applyHistorySnapshot(state) {
    if (!state) return;
    if (state.paperSize?.width) {
      this.paperSize = { ...state.paperSize };
    } else if (state.paperSizeId && this.paperSizes[state.paperSizeId]) {
      this.paperSize = this.paperSizes[state.paperSizeId];
    }
    this.showAbntMargins = state.showAbntMargins !== false;
    this.items = JSON.parse(JSON.stringify(state.items || []));
    if (this.selectedItemId && !this.items.some(i => i.id === this.selectedItemId)) this.selectedItemId = null;
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
        ${PrintToolbar.render(this)}

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
    this.library = this.sheetsManager.loadLibrary(this.projectId);
    const currentSheet = this.sheetsManager.init(this.projectId, this.projectName, this.paperSizes);
    if (currentSheet) {
      this.paperSize = currentSheet.paperSize;
      this.showAbntMargins = currentSheet.showAbntMargins !== false;
      this.items = JSON.parse(JSON.stringify(currentSheet.items || []));
    }

    this.sheetsManager.renderSheetsSelectorDOM();

    // Inicializa pilha de histórico da prancha
    this.resetHistory();

    this.updatePaperSheetDOM();
    this.renderAllItems();
    this.updatePropertiesPanel();

    setTimeout(() => {
      this.canvasEngine.zoomFit();
      this.canvasEngine.renderRulers();
      this.updateInsetMapExtent();
    }, 100);
  }

  /** Volta a folha ao padrão: margens ABNT, moldura e itens do layout padrão (mantém o papel; pode ser desfeito) */
  resetDefaultLayout() {
    this.paperSize = PrintItemsManager.withMargins(this.paperSize, null);
    this.showAbntMargins = true;
    this.items = PrintItemsManager.createDefaultItems(this.projectName, this.paperSize);
    this.selectedItemId = 'item-map-main';
    this.updatePaperSheetDOM();
    this.renderAllItems();
    this.updatePropertiesPanel();
    this.pushHistoryState('Layout Padrão ABNT');
    UIToast.notificar({
      tipo: 'informativo',
      titulo: 'Layout padrão aplicado',
      mensagem: 'Margens ABNT e elementos padrão. Ctrl+Z desfaz.',
      duracao: 3000
    });
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
    const banner = document.getElementById('cm-print-pan-alert-banner');

    if (mode === 'content_pan') {
      banner?.classList.remove('hidden');
      document.querySelectorAll('.cm-item-map-frame').forEach(el => el.classList.add('pan-enabled'));
      this.enableLeafletMapPan(true);
    } else {
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

  /**
   * Aplica papel, margens e moldura de uma vez, reajustando os itens à nova área útil
   * (mesma regra da troca de papel). Um passo no histórico.
   */
  applyPageSetup(paper, showFrame, actionName) {
    const sizeChanged = paper.width !== this.paperSize.width || paper.height !== this.paperSize.height;
    this.items = PrintItemsManager.fitItemsToPaper(this.items, this.paperSize, paper);
    this.paperSize = paper;
    this.showAbntMargins = showFrame !== false;
    this.updatePaperSheetDOM();
    this.renderAllItems();
    this.updatePropertiesPanel();
    if (sizeChanged) setTimeout(() => this.canvasEngine.zoomFit(), 50);
    this.pushHistoryState(actionName);
  }

  /** Troca a folha mantendo os itens do usuário e as margens personalizadas (pode ser desfeito) */
  setPaperSize(sizeKey) {
    const target = this.paperSizes[sizeKey];
    if (!target || target.id === this.paperSize.id) return;
    const paper = this.paperSize.margins
      ? PrintItemsManager.withMargins(target, PrintItemsManager.sheetMargins(this.paperSize))
      : target;
    this.applyPageSetup(paper, this.showAbntMargins, `Folha ${target.name}`);
  }

  /** Altera um ou mais lados da margem (mm); `null` volta à ABNT */
  setMargins(partial) {
    const paper = partial
      ? PrintItemsManager.withMargins(this.paperSize, { ...PrintItemsManager.sheetMargins(this.paperSize), ...partial })
      : PrintItemsManager.withMargins(this.paperSize, null);
    const before = PrintItemsManager.sheetMargins(this.paperSize);
    const after = PrintItemsManager.sheetMargins(paper);
    if (['top', 'right', 'bottom', 'left'].every(k => before[k] === after[k])) {
      this.updatePropertiesPanel(); // devolve ao campo o valor válido
      return;
    }
    this.applyPageSetup(paper, this.showAbntMargins, partial ? 'Margens' : 'Margens ABNT');
  }

  setAbntMargins(visible) {
    this.showAbntMargins = visible;
    this.updatePaperSheetDOM();
    this.updatePropertiesPanel();
    this.pushHistoryState(visible ? 'Exibir Moldura' : 'Ocultar Moldura');
  }

  applyPagePreset(presetId) {
    const preset = this.sheetsManager.loadPresets().find(p => p.id === presetId);
    const base = preset && this.paperSizes[preset.paperSizeId];
    if (!base) return;
    this.applyPageSetup(PrintItemsManager.withMargins(base, preset.margins), preset.showFrame, `Pré-definição ${preset.name}`);
  }

  savePagePreset() {
    const m = PrintItemsManager.sheetMargins(this.paperSize);
    const suggestion = this.paperSize.margins
      ? `${this.paperSize.name} ${m.top}/${m.right}/${m.bottom}/${m.left}`
      : `${this.paperSize.name} ABNT`;
    const name = typeof prompt === 'function' ? prompt('Nome da pré-definição:', suggestion) : null;
    if (name === null || !name.trim()) return;
    const preset = this.sheetsManager.addPreset(name, this.paperSize, this.showAbntMargins);
    this.updatePropertiesPanel();
    UIToast.notificar(preset
      ? { tipo: 'sucesso', titulo: 'Pré-definição salva', mensagem: preset.name, duracao: 2000 }
      : { tipo: 'erro', titulo: 'Pré-definição não salva', mensagem: 'Sem espaço no armazenamento do navegador.', duracao: 4000 });
  }

  deletePagePreset(presetId) {
    const preset = this.sheetsManager.loadPresets().find(p => p.id === presetId);
    if (!preset || !confirm(`Excluir a pré-definição "${preset.name}"?`)) return;
    this.sheetsManager.deletePreset(presetId);
    this.updatePropertiesPanel();
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
        const m = PrintItemsManager.sheetMargins(this.paperSize);
        const px = this.canvasEngine.mmToPx;
        marginsFrame.style.left = `${m.left * px}px`;
        marginsFrame.style.top = `${m.top * px}px`;
        marginsFrame.style.right = `${m.right * px}px`;
        marginsFrame.style.bottom = `${m.bottom * px}px`;
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

    layer.innerHTML = this.items.map((item, index) => {
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
             style="left: ${xPx}px; top: ${yPx}px; width: ${wPx}px; height: ${hPx}px; z-index: ${index + 1};">
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
        </div>
      `;
    } else if (item.type === 'north_arrow') {
      return PrintItemsManager.getNorthArrowSVG(item.arrowStyle || 'classic', item.rotation || 0);
    } else if (item.type === 'scale_bar') {
      return PrintItemsManager.renderScaleBar(item, item.scale || 10000);
    } else if (item.type === 'legend') {
      return PrintItemsManager.renderLegend(item, this.layers);
    } else if (item.type === 'title_block') {
      return PrintItemsManager.renderTitleBlock(item, this.projectName, this.items.find(i => i.type === 'map')?.scale);
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
            // Zoom fracionário: a escala digitada no painel (ex.: 1:5.000) é aplicada exatamente
            zoomSnap: 0,
            zoomDelta: 0.5,
            // Sem animação: a camada vetorial (canvas próprio) acompanha cada quadro sem defasagem
            zoomAnimation: false,
            fadeAnimation: false,
            dragging: this.interactionMode === 'content_pan',
            scrollWheelZoom: this.interactionMode === 'content_pan'
          });

          // Adiciona Basemap configurado
          this.applyBasemapToMap(map, item.basemap || (item.type === 'inset_map' ? 'esri_light' : this.currentBasemap));

          const savedView = item.view && Array.isArray(item.view.center) && Number.isFinite(item.view.zoom) ? item.view : null;

          if (item.type === 'inset_map') {
            // Centrado na área do projeto (o marcador de localização fica no meio do mapa)
            const pts = [];
            this.features.forEach(f => { if (f.visible !== false) this.pushBounds(pts, f.coordinates); });
            const valid = pts.filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]));
            map.setView(valid.length ? L.latLngBounds(valid).getCenter() : [-15.78, -47.92], 4);
          } else {
            // Feições: desenhadas pela vista do mapa (mesmo desenho da exportação)
            const vectors = new PrintVectorLayer(() => this.vectorStateFor(item, map), () => this.vectorResolution()).addTo(map);
            this.vectorLayers.set(item.id, vectors);
            const bounds = [];
            this.features.forEach(f => {
              const box = PrintMapRenderer.bboxOf(f);
              if (box && f.visible !== false) bounds.push([box[0], box[1]], [box[2], box[3]]);
            });
            if (bounds.length > 0) map.fitBounds(bounds, { padding: [20, 20] });
            else map.setView([-15.78, -47.92], 14);
          }

          // Restaura o enquadramento salvo da prancha (pan/zoom/escala feitos pelo usuário)
          if (savedView) map.setView(savedView.center, savedView.zoom, { animate: false });

          // Sincronização de zoom <-> escala e grade cartográfica dinâmica
          const updateGridAndScale = () => {
            // O mapa pode ter sido removido/recriado antes deste evento ou timeout (erro _leaflet_pos)
            if (this.leafletMaps.get(item.id) !== map) return;
            const center = map.getCenter();
            item.scale = PrintItemsManager.calculateScale(map.getZoom(), center.lat);

            // Mantém o campo de escala do painel igual à escala real do mapa
            const scaleInput = document.getElementById('prop-map-scale');
            if (scaleInput && this.selectedItemId === item.id && document.activeElement !== scaleInput) {
              scaleInput.value = item.scale;
            }

            // Sincroniza barra de escala
            if (item.type === 'map') {
              this.items.filter(i => i.type === 'scale_bar').forEach(scaleBar => {
                scaleBar.scale = item.scale;
                const sbEl = document.querySelector(`[data-item-id="${scaleBar.id}"] .cm-item-scale-bar`);
                if (sbEl) sbEl.outerHTML = PrintItemsManager.renderScaleBar(scaleBar, item.scale);
              });

              // O carimbo mostra a escala do mapa principal
              this.items.filter(i => i.type === 'title_block').forEach(tb => this.refreshItemContent(tb));

              // Sincroniza retângulo no Inset Map
              this.updateInsetMapExtent();
            }

            // Atualiza coordenadas reais da grade (e a remove quando desligada)
            const frame = domEl.parentElement;
            frame?.querySelector('.cm-item-grid-border')?.remove();
            if (frame && item.showGrid) {
              const b = map.getBounds();
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
            if (this.leafletMaps.get(item.id) !== map) return;
            const c = map.getCenter();
            item.view = { center: [c.lat, c.lng], zoom: map.getZoom() };
            this.markDirty();
          });
          const timer = setTimeout(() => {
            this.mapTimers.delete(timer);
            updateGridAndScale();
          }, 150);
          this.mapTimers.add(timer);
          this.mapRefreshers.set(item.id, updateGridAndScale);

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

    // Mesma lista do mapa principal (aceita as chaves antigas das pranchas)
    const basemap = BasemapCatalog.get(basemapKey);
    map.getContainer().style.background = BasemapCatalog.backgroundOf(basemap.id);
    basemap.tiles.forEach(t => {
      // Acima do zoom nativo os tiles são ampliados: escalas grandes (1:200) continuam possíveis
      L.tileLayer(t.url, { maxNativeZoom: t.maxNativeZoom, maxZoom: 23, crossOrigin: true }).addTo(map);
    });
  }

  /** Estado da camada vetorial de um mapa: vista efetiva + filtros casados (cache por vista) */
  vectorStateFor(item, map) {
    if (item.type !== 'map') return null;
    const view = PrintViewResolver.effectiveView(item, this.library);
    const key = JSON.stringify([view.followProject, view.filters, this.library?.filters || []]);
    let cached = this.resolveCache.get(item.id);
    if (!cached || cached.key !== key || cached.features !== this.features || cached.layers !== this.layers) {
      const ctx = PrintViewResolver.prepare(view, { features: this.features, layers: this.layers, library: this.library });
      cached = { key, features: this.features, layers: this.layers, ctx };
      this.resolveCache.set(item.id, cached);
    }
    // Escala ao vivo (durante o zoom o item ainda não foi atualizado) para as faixas de escala
    const scale = map ? PrintItemsManager.calculateScale(map.getZoom(), map.getCenter().lat) : item.scale;
    return {
      features: this.features,
      layers: this.layers,
      resolveCtx: { ...cached.ctx, view, scale },
      pxPerMm: PrintCanvasEngine.BASE_PX_PER_MM
    };
  }

  /** Pixels de tela por px CSS do mapa (zoom da prancheta × densidade da tela) */
  vectorResolution() {
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    return Math.min(4, dpr * Math.max(1, this.canvasEngine?.zoom || 1));
  }

  /** Redesenha as feições de um mapa (ou de todos) depois de mudar a vista */
  redrawMapVectors(itemId = null) {
    if (itemId) this.vectorLayers.get(itemId)?.redraw();
    else this.vectorLayers.forEach(v => v.redraw());
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
    const style = { color: '#ff2244', weight: 1.5, fillColor: '#ff2244', fillOpacity: 0.25 };

    if (!this.insetExtentLayer) {
      this.insetExtentLayer = L.rectangle(bounds, style);
      this.insetMarkerLayer = L.circleMarker(b.getCenter(), { ...style, radius: 4, weight: 2, fillOpacity: 0.85 });
    }
    this.insetExtentLayer.setBounds(bounds);
    this.insetMarkerLayer.setLatLng(b.getCenter());

    // Área pequena demais para o retângulo aparecer: mostra um ponto no centro
    const locator = PrintItemsManager.insetLocator(
      insetMap.latLngToContainerPoint([b.getNorth(), b.getWest()]),
      insetMap.latLngToContainerPoint([b.getSouth(), b.getEast()])
    );
    const show = locator.type === 'rect' ? this.insetExtentLayer : this.insetMarkerLayer;
    const hide = locator.type === 'rect' ? this.insetMarkerLayer : this.insetExtentLayer;
    if (insetMap.hasLayer(hide)) insetMap.removeLayer(hide);
    if (!insetMap.hasLayer(show)) show.addTo(insetMap);
  }

  applyMapScaleAndRotation(item) {
    const map = this.leafletMaps.get(item.id);
    const domEl = document.getElementById(`leaf-map-${item.id}`);
    if (map && domEl) {
      const center = map.getCenter();
      const targetZoom = PrintItemsManager.calculateZoom(item.scale, center.lat);
      // Sem animação: a escala digitada vale na hora (e os eventos de grade/escala disparam já)
      map.setZoom(targetZoom, { animate: false });
      domEl.style.transform = `rotate(${item.rotation || 0}deg)`;
    }
  }

  destroyLeafletMaps() {
    this.leafletMaps.forEach((map) => {
      try { map.remove(); } catch (e) { /* ignore */ }
    });
    this.leafletMaps.clear();
    this.vectorLayers.clear();
    this.resolveCache.clear();
    this.mapRefreshers.clear();
    this.mapTimers.forEach(t => clearTimeout(t));
    this.mapTimers.clear();
    this.insetExtentLayer = null;
    this.insetMarkerLayer = null;
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

  /** Redesenha só o conteúdo de um item; mapas só atualizam grade e escala (o Leaflet não é recriado) */
  refreshItemContent(item) {
    if (item.type === 'map' || item.type === 'inset_map') {
      this.mapRefreshers.get(item.id)?.();
      this.redrawMapVectors(item.id);
      return;
    }
    const scaler = document.querySelector(`[data-item-id="${item.id}"] > .cm-item-scaler`);
    if (scaler) scaler.innerHTML = this.getItemInnerContent(item);
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
      this.pushHistoryState(it.locked ? 'Bloquear Item' : 'Desbloquear Item');
    }
  }

  toggleItemVisibility(itemId) {
    const it = this.items.find(i => i.id === itemId);
    if (it) {
      it.visible = it.visible === false;
      this.renderAllItems();
      this.updatePropertiesPanel();
      this.pushHistoryState(it.visible ? 'Exibir Item' : 'Ocultar Item');
    }
  }

  /** Exclui um item; item bloqueado não é excluído (só o próprio bloqueio pode mudar) */
  deleteItem(itemId) {
    const it = this.items.find(i => i.id === itemId);
    if (!it) return false;
    if (it.locked) {
      UIToast.notificar({
        tipo: 'alerta',
        titulo: 'Item bloqueado',
        mensagem: `Desbloqueie "${it.name || 'o item'}" antes de excluí-lo.`,
        duracao: 2500
      });
      return false;
    }
    this.items = this.items.filter(i => i.id !== itemId);
    if (this.selectedItemId === itemId) this.selectedItemId = null;
    this.renderAllItems();
    this.updatePropertiesPanel();
    this.pushHistoryState('Excluir Item');
    return true;
  }

  updatePropertiesPanel() {
    const mount = document.getElementById('cm-print-props-panel-mount');
    if (mount) {
      // Preserva a rolagem ao reconstruir após cada seleção/arrasto (as seções abertas ficam em this.panelSections)
      const prevScroll = mount.querySelector('.cm-print-props-scroll')?.scrollTop || 0;
      const keptPaper = mount.querySelector('details[data-section="paper"]');
      // Quem usa o teclado não perde o lugar na lista ao bloquear, ocultar ou selecionar
      const focusSel = PrintPropertiesPanel.listFocusSelector(document.activeElement, mount);
      mount.innerHTML = PrintPropertiesPanel.render(this);
      // A seção da folha continua a mesma na tela, só com os valores atualizados
      const freshPaper = mount.querySelector('details[data-section="paper"]');
      if (keptPaper && freshPaper) {
        PrintPropertiesPanel.syncPaperSection(keptPaper, freshPaper);
        freshPaper.replaceWith(keptPaper);
      }
      const scroller = mount.querySelector('.cm-print-props-scroll');
      if (scroller) scroller.scrollTop = prevScroll;
      PrintPropertiesPanel.bindEvents(this);
      if (focusSel) mount.querySelector(focusSel)?.focus({ preventScroll: true });
    }
  }

  /** Insere um novo elemento cartográfico na prancha e o seleciona */
  insertItem(type) {
    const item = PrintItemsManager.createNewItem(type, this.projectName, this.items.length);
    if (!item) return null;
    this.items.splice(PrintItemsManager.insertionIndex(this.items, item.type), 0, item);
    this.renderAllItems();
    this.selectItem(item.id);
    this.pushHistoryState('Inserir Item');
    return item;
  }

  bindEvents() {
    PrintToolbar.bind(this);

    const btnDismissBanner = document.getElementById('btn-dismiss-pan-banner');
    if (btnDismissBanner) btnDismissBanner.addEventListener('click', () => this.setInteractionMode('layout'));
  }
}
