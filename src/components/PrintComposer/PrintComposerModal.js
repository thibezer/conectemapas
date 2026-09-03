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
import { UIToast } from 'ui-components-kit';

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

    this.items = PrintItemsManager.createDefaultItems(this.projectName);
    this.selectedItemId = 'item-map-main';
    this.leafletMaps = new Map(); // Sub-instâncias do Leaflet nos itens
    this.insetExtentLayer = null; // Retângulo no Inset Map
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
            <span class="cm-print-zoom-badge" id="cm-print-paper-badge">${this.paperSize.name}</span>
          </div>

          <!-- Ferramentas de Inserção de Elementos Cartográficos -->
          <div class="cm-print-tools-group">
            <button class="cm-print-tool-btn" id="btn-add-print-map" title="Inserir Novo Mapa">🗺️ + Mapa</button>
            <button class="cm-print-tool-btn" id="btn-add-print-inset" title="Inserir Mini-mapa de Localização (Overview)">🌎 + Inset</button>
            <button class="cm-print-tool-btn" id="btn-add-print-arrow" title="Inserir Rosa dos Ventos">🧭 + Norte</button>
            <button class="cm-print-tool-btn" id="btn-add-print-scale" title="Inserir Barra de Escala">📏 + Escala</button>
            <button class="cm-print-tool-btn" id="btn-add-print-legend" title="Inserir Legenda Temática">📋 + Legenda</button>
            <button class="cm-print-tool-btn" id="btn-add-print-vertices" title="Inserir Tabela de Vértices Topográfica">📊 + Vértices</button>
            <button class="cm-print-tool-btn" id="btn-add-print-text" title="Inserir Bloco de Notas Técnicas">📝 + Notas</button>
            <button class="cm-print-tool-btn" id="btn-add-print-titleblock" title="Inserir Selo Técnico ABNT NBR 13133">🏛️ + Selo</button>
          </div>

          <!-- Alternância de Modo: Mover Itens vs Navegar no Conteúdo do Mapa -->
          <div class="cm-print-tools-group">
            <button class="cm-print-tool-btn active" id="btn-mode-layout" title="Modo Layout: Mover, alinhar e redimensionar elementos">
              🖱️ Layout
            </button>
            <button class="cm-print-tool-btn" id="btn-mode-content-pan" title="Navegar no Mapa: Pan e zoom do terreno dentro da moldura">
              🖐️ Navegar no Mapa
            </button>
          </div>

          <!-- Controles de Zoom e Enquadramento da Folha -->
          <div class="cm-print-tools-group">
            <button class="cm-print-tool-btn" id="btn-print-zoom-out" title="Diminuir Zoom">➖</button>
            <span class="cm-print-zoom-badge" id="cm-print-zoom-val" style="min-width: 44px; text-align: center;">100%</span>
            <button class="cm-print-tool-btn" id="btn-print-zoom-in" title="Aumentar Zoom">➕</button>
            <button class="cm-print-tool-btn" id="btn-print-zoom-fit" title="Enquadrar Folha">🎯 Enquadrar</button>
          </div>

          <!-- Ações de Exportação em Alta Resolução -->
          <div class="cm-print-actions-group">
            <select id="print-export-dpi-select" class="cm-native-select" style="height: 28px; font-size: 11px; padding: 2px 4px;" title="Resolução de Exportação">
              <option value="300" selected>300 DPI (Plotagem)</option>
              <option value="150">150 DPI (Rápido)</option>
            </select>
            <ui-botao-primario inline id="btn-export-print-png" variante="secundario" style="height: 28px; font-size: 11px;">
              🖼️ PNG
            </ui-botao-primario>
            <ui-botao-primario inline id="btn-export-print-pdf" variante="primary" style="height: 28px; font-size: 11px;">
              📄 PDF Técnico
            </ui-botao-primario>
            <button id="btn-close-print-composer" class="cm-vertex-del-btn" style="font-size: 20px; margin-left: 6px;" title="Fechar Layout">×</button>
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
    this.renderAllItems();
    this.updatePropertiesPanel();

    setTimeout(() => {
      this.canvasEngine.zoomFit();
      this.canvasEngine.renderRulers();
      this.updateInsetMapExtent();
    }, 100);
  }

  close() {
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

      this.updatePaperSheetDOM();
      this.renderAllItems();
      this.updatePropertiesPanel();

      setTimeout(() => {
        this.canvasEngine.zoomFit();
      }, 50);
    }
  }

  setAbntMargins(visible) {
    this.showAbntMargins = visible;
    this.updatePaperSheetDOM();
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

      return `
        <div class="cm-print-item ${isSel ? 'selected' : ''} ${item.locked ? 'locked' : ''}" 
             data-item-id="${item.id}" 
             style="left: ${xPx}px; top: ${yPx}px; width: ${wPx}px; height: ${hPx}px;">
          ${this.getItemInnerContent(item)}
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

          // Sincronização de zoom <-> escala e grade cartográfica dinâmica
          const updateGridAndScale = () => {
            const center = map.getCenter();
            item.scale = PrintItemsManager.calculateScale(map.getZoom(), center.lat);

            // Sincroniza barra de escala
            if (item.type === 'map') {
              const scaleBar = this.items.find(i => i.type === 'scale_bar');
              if (scaleBar) {
                scaleBar.scale = item.scale;
                const sbEl = document.querySelector('[data-item-id="item-scale-bar"]');
                if (sbEl) sbEl.innerHTML = PrintItemsManager.renderScaleBar(scaleBar, item.scale);
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
    } else if (basemapKey === 'cartodb_positron') {
      url = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
      maxZoom = 20;
    } else if (basemapKey === 'cartodb_dark') {
      url = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      maxZoom = 20;
    } else if (basemapKey === 'relevo') {
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}';
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

  toggleItemLock(itemId) {
    const it = this.items.find(i => i.id === itemId);
    if (it) {
      it.locked = !it.locked;
      this.selectItem(this.selectedItemId);
    }
  }

  toggleItemVisibility(itemId) {
    const it = this.items.find(i => i.id === itemId);
    if (it) {
      it.visible = it.visible === false;
      this.renderAllItems();
      this.updatePropertiesPanel();
    }
  }

  deleteItem(itemId) {
    this.items = this.items.filter(i => i.id !== itemId);
    if (this.selectedItemId === itemId) this.selectedItemId = null;
    this.renderAllItems();
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

    // Seletor de DPI
    const dpiSelect = document.getElementById('print-export-dpi-select');
    const getDPI = () => parseInt(dpiSelect?.value || '300', 10);

    const btnPng = document.getElementById('btn-export-print-png');
    if (btnPng) btnPng.addEventListener('click', () => PrintExporter.exportToPNG(this, getDPI()));

    const btnPdf = document.getElementById('btn-export-print-pdf');
    if (btnPdf) btnPdf.addEventListener('click', () => PrintExporter.exportToPDF(this, getDPI()));

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
            UIToast.notificar({
              tipo: 'sucesso',
              titulo: 'Elemento Inserido',
              mensagem: `${item.name} adicionado à folha.`,
              duracao: 2000
            });
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
  }
}
