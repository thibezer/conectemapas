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

          <!-- Controles de Zoom e Enquadramento -->
          <div class="cm-print-tools-group">
            <button class="cm-print-tool-btn" id="btn-print-zoom-out" title="Diminuir Zoom">➖</button>
            <span class="cm-print-zoom-badge" id="cm-print-zoom-val" style="min-width: 42px; text-align: center;">100%</span>
            <button class="cm-print-tool-btn" id="btn-print-zoom-in" title="Aumentar Zoom">➕</button>
            <button class="cm-print-tool-btn" id="btn-print-zoom-fit" title="Enquadrar Folha">🎯 Enquadrar</button>
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

    setTimeout(() => {
      this.canvasEngine.zoomFit();
      this.canvasEngine.renderRulers();
    }, 80);
  }

  close() {
    this.destroyLeafletMaps();
    if (this.canvasEngine) this.canvasEngine.destroy();
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
      setTimeout(() => {
        this.canvasEngine.zoomFit();
      }, 50);
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

    this.canvasEngine.renderRulers();
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
            <div class="cm-resize-handle n" data-handle="n"></div>
            <div class="cm-resize-handle ne" data-handle="ne"></div>
            <div class="cm-resize-handle e" data-handle="e"></div>
            <div class="cm-resize-handle se" data-handle="se"></div>
            <div class="cm-resize-handle s" data-handle="s"></div>
            <div class="cm-resize-handle sw" data-handle="sw"></div>
            <div class="cm-resize-handle w" data-handle="w"></div>
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

          // Adiciona Basemap Esri Satélite com crossOrigin para exportação limpa
          L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19,
            crossOrigin: true
          }).addTo(map);

          if (item.type === 'inset_map') {
            map.setView([-15.78, -47.92], 4);
          } else {
            // Renderiza geometrias vetoriais das camadas no mapa de impressão
            if (this.features.length > 0) {
              const bounds = [];
              this.features.forEach(f => {
                if (f.visible === false) return;
                const layer = this.layers.find(l => l.id === f.layerId) || {};
                const color = layer.color || f.color || '#00E08A';
                const style = { color, fillColor: color, fillOpacity: 0.35, weight: 2 };

                if (f.type === 'Polygon' && Array.isArray(f.coordinates)) {
                  L.polygon(f.coordinates, style).addTo(map);
                  bounds.push(...f.coordinates);
                } else if (f.type === 'LineString' && Array.isArray(f.coordinates)) {
                  L.polyline(f.coordinates, style).addTo(map);
                  bounds.push(...f.coordinates);
                } else if (f.type === 'Point' && Array.isArray(f.coordinates)) {
                  L.circleMarker(f.coordinates, { ...style, radius: 6, fillOpacity: 0.85 }).addTo(map);
                  bounds.push(f.coordinates);
                }
              });

              if (bounds.length > 0) map.fitBounds(bounds, { padding: [15, 15] });
              else map.setView([-15.78, -47.92], 14);
            } else {
              map.setView([-15.78, -47.92], 14);
            }
          }

          // Sincronização em tempo real de zoom <-> escala real e grade DMS dinâmica
          const updateGridAndScale = () => {
            const center = map.getCenter();
            item.scale = PrintItemsManager.calculateScale(map.getZoom(), center.lat);

            // Sincroniza a barra de escala se for o mapa principal
            if (item.type === 'map') {
              const scaleBar = this.items.find(i => i.type === 'scale_bar');
              if (scaleBar) {
                scaleBar.scale = item.scale;
                const sbEl = document.querySelector('[data-item-id="item-scale-bar"]');
                if (sbEl) sbEl.innerHTML = PrintItemsManager.renderScaleBar(scaleBar, item.scale);
              }
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
              }));
            }
          };

          map.on('moveend zoomend', updateGridAndScale);
          setTimeout(updateGridAndScale, 120);

          if (item.rotation) {
            domEl.style.transform = `rotate(${item.rotation}deg)`;
          }

          this.leafletMaps.set(item.id, map);
        }
      }
    });
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

    // Controles de Zoom
    const btnZoomIn = document.getElementById('btn-print-zoom-in');
    if (btnZoomIn) btnZoomIn.addEventListener('click', () => this.canvasEngine.zoomIn());

    const btnZoomOut = document.getElementById('btn-print-zoom-out');
    if (btnZoomOut) btnZoomOut.addEventListener('click', () => this.canvasEngine.zoomOut());

    const btnZoomFit = document.getElementById('btn-print-zoom-fit');
    if (btnZoomFit) btnZoomFit.addEventListener('click', () => this.canvasEngine.zoomFit());

    // Botões de inserção de itens
    const addItemHelper = (btnId, type) => {
      const btn = document.getElementById(btnId);
      if (btn) {
        btn.addEventListener('click', () => {
          const item = PrintItemsManager.createNewItem(type, this.projectName, this.items.length);
          if (item) {
            this.items.push(item);
            this.selectItem(item.id);
          }
        });
      }
    };

    addItemHelper('btn-add-print-map', 'map');
    addItemHelper('btn-add-print-inset', 'inset_map');
    addItemHelper('btn-add-print-arrow', 'north_arrow');
    addItemHelper('btn-add-print-scale', 'scale_bar');
    addItemHelper('btn-add-print-legend', 'legend');
    addItemHelper('btn-add-print-titleblock', 'title_block');
  }
}
