/* ==========================================================================
   ConecteMapas - PrintComposerModal (QGIS Print Layout Composer)
   Responsabilidade Única: Orquestrador principal do Compositor de Impressão
   ========================================================================== */

import './PrintComposer.css';
import L from 'leaflet';
import { PrintItemsManager } from './PrintItemsManager.js';
import { PrintCanvasEngine } from './PrintCanvasEngine.js';
import { PrintPropertiesPanel } from './PrintPropertiesPanel.js';
import { PrintExporter } from './PrintExporter.js';
import { UIToast } from 'ui-components-kit';

export class PrintComposerModal {
  constructor(options = {}) {
    this.projectName = options.projectName || 'Levantamento Cartográfico';
    this.layers = options.layers || [];
    this.features = options.features || [];
    this.currentBasemap = options.currentBasemap || 'satelite';
    this.container = null;
    this.isOpen = false;

    this.paperSizes = {
      A4_L: { id: 'A4_L', name: 'A4 Paisagem', width: 297, height: 210 },
      A4_P: { id: 'A4_P', name: 'A4 Retrato', width: 210, height: 297 },
      A3_L: { id: 'A3_L', name: 'A3 Paisagem', width: 420, height: 297 },
      A3_P: { id: 'A3_P', name: 'A3 Retrato', width: 297, height: 420 },
      A2_L: { id: 'A2_L', name: 'A2 Paisagem', width: 594, height: 420 },
      A1_L: { id: 'A1_L', name: 'A1 Paisagem', width: 841, height: 594 }
    };
    this.paperSize = this.paperSizes.A4_L;

    this.items = PrintItemsManager.createDefaultItems(this.projectName);
    this.selectedItemId = 'item-map-main';
    this.leafletMaps = new Map(); // Sub-instâncias do Leaflet nos itens
    this.canvasEngine = new PrintCanvasEngine(this);
  }

  render(container) {
    this.container = container;
    this.container.innerHTML = `
      <div id="cm-print-composer-modal" class="cm-print-modal-overlay hidden">
        <!-- Toolbar Superior Estilo QGIS -->
        <header class="cm-print-topbar">
          <div class="cm-print-title-area">
            <span class="cm-print-title">📐 Compositor de Impressão (Layout QGIS)</span>
            <span class="cm-print-zoom-badge">${this.paperSize.name}</span>
          </div>

          <div class="cm-print-tools-group">
            <button class="cm-print-tool-btn" id="btn-add-print-map" title="Inserir Novo Mapa">🗺️ + Mapa</button>
            <button class="cm-print-tool-btn" id="btn-add-print-inset" title="Inserir Mini-mapa de Localização">🌎 + Inset</button>
            <button class="cm-print-tool-btn" id="btn-add-print-arrow" title="Inserir Rosa dos Ventos">🧭 + Norte</button>
            <button class="cm-print-tool-btn" id="btn-add-print-scale" title="Inserir Barra de Escala">📏 + Escala</button>
            <button class="cm-print-tool-btn" id="btn-add-print-legend" title="Inserir Legenda Temática">📋 + Legenda</button>
            <button class="cm-print-tool-btn" id="btn-add-print-titleblock" title="Inserir Selo Técnico NBR">🏛️ + Selo</button>
          </div>

          <div class="cm-print-actions-group">
            <ui-botao-primario inline id="btn-export-print-png" variante="secundario" style="height: 28px; font-size: 11px;">
              🖼️ PNG (300 DPI)
            </ui-botao-primario>
            <ui-botao-primario inline id="btn-export-print-pdf" variante="primary" style="height: 28px; font-size: 11px;">
              📄 Exportar PDF
            </ui-botao-primario>
            <button id="btn-close-print-composer" class="cm-vertex-del-btn" style="font-size: 20px; margin-left: 6px;" title="Fechar Layout">×</button>
          </div>
        </header>

        <!-- Área de Trabalho Principal: Prancheta + Painel Lateral -->
        <div class="cm-print-main-workspace">
          <div class="cm-print-rulers-wrapper" id="cm-print-rulers-mount">
            <div class="cm-print-ruler-corner">mm</div>
            <div class="cm-print-ruler-h"><canvas id="ruler-h" class="cm-print-ruler-canvas"></canvas></div>
            <div class="cm-print-ruler-v"><canvas id="ruler-v" class="cm-print-ruler-canvas"></canvas></div>

            <div class="cm-print-viewport" id="cm-print-viewport">
              <div class="cm-print-paper-sheet" id="cm-print-paper-sheet">
                <!-- Itens Cartográficos Renderizados no Papel -->
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

  open(projectName, layers, features, basemap) {
    if (projectName) this.projectName = projectName;
    if (layers) this.layers = layers;
    if (features) this.features = features;
    if (basemap) this.currentBasemap = basemap;

    const modal = document.getElementById('cm-print-composer-modal');
    if (modal) modal.classList.remove('hidden');
    this.isOpen = true;

    this.updatePaperSheetDOM();
    this.updateCanvas();
    this.updatePropertiesPanel();
  }

  close() {
    this.destroyLeafletMaps();
    const modal = document.getElementById('cm-print-composer-modal');
    if (modal) modal.classList.add('hidden');
    this.isOpen = false;
  }

  setPaperSize(sizeKey) {
    if (this.paperSizes[sizeKey]) {
      this.paperSize = this.paperSizes[sizeKey];
      this.updatePaperSheetDOM();
      this.updateCanvas();
      this.updatePropertiesPanel();
    }
  }

  updatePaperSheetDOM() {
    const sheet = document.getElementById('cm-print-paper-sheet');
    if (sheet) {
      const wPx = this.paperSize.width * this.canvasEngine.mmToPx;
      const hPx = this.paperSize.height * this.canvasEngine.mmToPx;
      sheet.style.width = `${wPx}px`;
      sheet.style.height = `${hPx}px`;
    }

    const rH = document.getElementById('ruler-h');
    const rV = document.getElementById('ruler-v');
    this.canvasEngine.renderRulers(rH, rV, this.paperSize.width, this.paperSize.height);
  }

  updateCanvas() {
    const sheet = document.getElementById('cm-print-paper-sheet');
    if (!sheet) return;

    this.destroyLeafletMaps();

    sheet.innerHTML = this.items.map(item => {
      if (item.visible === false) return '';
      const isSel = item.id === this.selectedItemId;
      const xPx = item.x * this.canvasEngine.mmToPx;
      const yPx = item.y * this.canvasEngine.mmToPx;
      const wPx = item.width * this.canvasEngine.mmToPx;
      const hPx = item.height * this.canvasEngine.mmToPx;

      let innerContent = '';
      if (item.type === 'map' || item.type === 'inset_map') {
        innerContent = `
          <div class="cm-item-map-frame">
            <div id="leaf-map-${item.id}" class="cm-item-map-canvas" data-composer-map-id="${item.id}"></div>
            ${item.showGrid ? `<div class="cm-item-grid-border"><span class="cm-grid-label-n">15°47'S</span><span class="cm-grid-label-w">47°52'W</span></div>` : ''}
          </div>
        `;
      } else if (item.type === 'north_arrow') {
        innerContent = PrintItemsManager.getNorthArrowSVG(item.arrowStyle || 'classic', item.rotation || 0);
      } else if (item.type === 'scale_bar') {
        innerContent = PrintItemsManager.renderScaleBar(item, item.scale || 10000);
      } else if (item.type === 'legend') {
        innerContent = PrintItemsManager.renderLegend(item, this.layers);
      } else if (item.type === 'title_block') {
        innerContent = PrintItemsManager.renderTitleBlock(item, this.projectName);
      }

      return `
        <div class="cm-print-item ${isSel ? 'selected' : ''} ${item.locked ? 'locked' : ''}" 
             data-item-id="${item.id}" 
             style="left: ${xPx}px; top: ${yPx}px; width: ${wPx}px; height: ${hPx}px;">
          ${innerContent}
          ${isSel && !item.locked ? `
            <div class="cm-resize-handle nw" data-handle="nw"></div>
            <div class="cm-resize-handle ne" data-handle="ne"></div>
            <div class="cm-resize-handle se" data-handle="se"></div>
            <div class="cm-resize-handle sw" data-handle="sw"></div>
          ` : ''}
        </div>
      `;
    }).join('');

    this.mountLeafletMaps();
    this.canvasEngine.bindInteractions(sheet);
  }

  mountLeafletMaps() {
    this.items.forEach(item => {
      if ((item.type === 'map' || item.type === 'inset_map') && item.visible !== false) {
        const domEl = document.getElementById(`leaf-map-${item.id}`);
        if (domEl && !this.leafletMaps.has(item.id)) {
          const map = L.map(domEl, {
            attributionControl: false,
            zoomControl: false,
            preferCanvas: true
          });

          // Adiciona Basemap Esri / OSM
          L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19
          }).addTo(map);

          if (item.type === 'inset_map') {
            // Visão macro / continental (América do Sul / Brasil)
            map.setView([-15.78, -47.92], 4);
          } else {
            // Visão de detalhe das feições
            if (this.features.length > 0) {
              const bounds = [];
              this.features.forEach(f => {
                if (Array.isArray(f.coordinates)) {
                  if (f.type === 'Point') bounds.push(f.coordinates);
                  else if (f.type === 'LineString' || f.type === 'Polygon') bounds.push(...f.coordinates);
                }
              });
              if (bounds.length > 0) map.fitBounds(bounds, { padding: [10, 10] });
              else map.setView([-15.78, -47.92], 14);
            } else {
              map.setView([-15.78, -47.92], 14);
            }
          }

          this.leafletMaps.set(item.id, map);
        }
      }
    });
  }

  destroyLeafletMaps() {
    this.leafletMaps.forEach((map) => {
      try { map.remove(); } catch (e) { /* ignore */ }
    });
    this.leafletMaps.clear();
  }

  updateItemPositionDOM(item) {
    const el = document.querySelector(`[data-item-id="${item.id}"]`);
    if (el) {
      el.style.left = `${item.x * this.canvasEngine.mmToPx}px`;
      el.style.top = `${item.y * this.canvasEngine.mmToPx}px`;
      el.style.width = `${item.width * this.canvasEngine.mmToPx}px`;
      el.style.height = `${item.height * this.canvasEngine.mmToPx}px`;
    }
    const map = this.leafletMaps.get(item.id);
    if (map) map.invalidateSize();
  }

  selectItem(itemId) {
    this.selectedItemId = itemId;
    this.updateCanvas();
    this.updatePropertiesPanel();
  }

  toggleItemLock(itemId) {
    const it = this.items.find(i => i.id === itemId);
    if (it) {
      it.locked = !it.locked;
      this.updateCanvas();
      this.updatePropertiesPanel();
    }
  }

  toggleItemVisibility(itemId) {
    const it = this.items.find(i => i.id === itemId);
    if (it) {
      it.visible = it.visible === false;
      this.updateCanvas();
      this.updatePropertiesPanel();
    }
  }

  deleteItem(itemId) {
    this.items = this.items.filter(i => i.id !== itemId);
    if (this.selectedItemId === itemId) this.selectedItemId = null;
    this.updateCanvas();
    this.updatePropertiesPanel();
  }

  updatePropertiesPanel() {
    const mount = document.getElementById('cm-print-props-panel-mount');
    if (mount) {
      mount.innerHTML = PrintPropertiesPanel.render(this);
      PrintPropertiesPanel.bindEvents(this);
    }
  }

  bindEvents() {
    const btnClose = document.getElementById('btn-close-print-composer');
    if (btnClose) btnClose.addEventListener('click', () => this.close());

    const btnPng = document.getElementById('btn-export-print-png');
    if (btnPng) btnPng.addEventListener('click', () => PrintExporter.exportToPNG(this, 300));

    const btnPdf = document.getElementById('btn-export-print-pdf');
    if (btnPdf) btnPdf.addEventListener('click', () => PrintExporter.exportToPDF(this, 300));

    // Botões de inserção de itens
    const btnAddMap = document.getElementById('btn-add-print-map');
    if (btnAddMap) {
      btnAddMap.addEventListener('click', () => {
        this.items.push({
          id: `item-map-${Date.now()}`,
          type: 'map',
          name: `Mapa #${this.items.length + 1}`,
          x: 20,
          y: 20,
          width: 140,
          height: 100,
          locked: false,
          visible: true,
          scale: 10000,
          showGrid: true
        });
        this.updateCanvas();
        this.updatePropertiesPanel();
      });
    }

    const btnAddInset = document.getElementById('btn-add-print-inset');
    if (btnAddInset) {
      btnAddInset.addEventListener('click', () => {
        this.items.push({
          id: `item-inset-${Date.now()}`,
          type: 'inset_map',
          name: 'Mini-mapa Inset',
          x: 180,
          y: 20,
          width: 80,
          height: 60,
          locked: false,
          visible: true,
          scale: 500000,
          isOverview: true
        });
        this.updateCanvas();
        this.updatePropertiesPanel();
      });
    }

    const btnAddArrow = document.getElementById('btn-add-print-arrow');
    if (btnAddArrow) {
      btnAddArrow.addEventListener('click', () => {
        this.items.push({
          id: `item-arrow-${Date.now()}`,
          type: 'north_arrow',
          name: 'Rosa dos Ventos',
          x: 20,
          y: 130,
          width: 25,
          height: 25,
          locked: false,
          visible: true,
          arrowStyle: 'classic',
          rotation: 0
        });
        this.updateCanvas();
        this.updatePropertiesPanel();
      });
    }

    const btnAddScale = document.getElementById('btn-add-print-scale');
    if (btnAddScale) {
      btnAddScale.addEventListener('click', () => {
        this.items.push({
          id: `item-scale-${Date.now()}`,
          type: 'scale_bar',
          name: 'Barra de Escala',
          x: 50,
          y: 130,
          width: 50,
          height: 25,
          locked: false,
          visible: true
        });
        this.updateCanvas();
        this.updatePropertiesPanel();
      });
    }

    const btnAddLegend = document.getElementById('btn-add-print-legend');
    if (btnAddLegend) {
      btnAddLegend.addEventListener('click', () => {
        this.items.push({
          id: `item-legend-${Date.now()}`,
          type: 'legend',
          name: 'Legenda',
          x: 180,
          y: 90,
          width: 80,
          height: 50,
          locked: false,
          visible: true
        });
        this.updateCanvas();
        this.updatePropertiesPanel();
      });
    }

    const btnAddTitleblock = document.getElementById('btn-add-print-titleblock');
    if (btnAddTitleblock) {
      btnAddTitleblock.addEventListener('click', () => {
        this.items.push({
          id: `item-tb-${Date.now()}`,
          type: 'title_block',
          name: 'Carimbo Técnico',
          x: 180,
          y: 150,
          width: 90,
          height: 45,
          locked: false,
          visible: true,
          properties: {
            headerTitle: 'PLANTA TOPOGRÁFICA',
            projectName: this.projectName,
            author: 'Eng. Cartógrafo',
            art: 'CREA-BR 2026',
            datum: 'SIRGAS 2000'
          }
        });
        this.updateCanvas();
        this.updatePropertiesPanel();
      });
    }
  }
}
