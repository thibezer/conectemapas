/* ==========================================================================
   ConecteMapas - PrintCanvasEngine
   Responsabilidade Única: Motor de interação da prancheta, réguas milimétricas sincronizadas,
   zoom/pan, arrasto de itens, manipulação das 8 alças e atalhos de teclado de precisão.
   ========================================================================== */

import { PrintSmartGuides } from './PrintSmartGuides.js';
import { PrintAlignmentHelper } from './PrintAlignmentHelper.js';
import { PrintItemsManager } from './PrintItemsManager.js';
import { UIToast } from '@thibezer/ui-components-kit';

export class PrintCanvasEngine {
  // Pixels CSS por mm no zoom 100% (96 dpi). Os itens são desenhados nessa medida e escalados por transform.
  static BASE_PX_PER_MM = 3.78;
  static MIN_ZOOM = 0.1;
  static MAX_ZOOM = 4;

  constructor(composer) {
    this.composer = composer;
    this.zoom = 1.0;
    this.isDraggingItem = false;
    this.isResizing = false;
    this.resizeHandle = null;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.itemStartProps = null;
    this.itemsStartProps = null;

    // Pan state da folha
    this.isPanning = false;
    this.autoFit = false;
    this.panStartX = 0;
    this.panStartY = 0;
    this.scrollStartX = 0;
    this.scrollStartY = 0;

    // Handlers para descarte limpo
    this.mouseMoveHandler = null;
    this.mouseUpHandler = null;
    this.keyDownHandler = null;
    this.smartGuides = new PrintSmartGuides(this);

    this.bindKeyboardShortcuts();
  }

  // 1 mm em pixels de tela para o nível atual de zoom
  get mmToPx() {
    return PrintCanvasEngine.BASE_PX_PER_MM * this.zoom;
  }

  /**
   * Muda o zoom mantendo fixo o ponto da folha sob `anchor` (coordenadas de tela) ou, sem âncora,
   * o centro da área visível.
   */
  setZoom(val, anchor = null) {
    const vp = document.getElementById('cm-print-viewport');
    this.autoFit = false; // zoom manual desliga o reajuste automático (zoomFit religa)
    const next = Math.max(PrintCanvasEngine.MIN_ZOOM, Math.min(PrintCanvasEngine.MAX_ZOOM, val));
    if (next === this.zoom && vp) {
      this.updateZoomBadge();
      return;
    }

    let ax = 0, ay = 0, fx = 0, fy = 0;
    if (vp) {
      const rect = vp.getBoundingClientRect();
      ax = anchor ? anchor.x - rect.left : vp.clientWidth / 2;
      ay = anchor ? anchor.y - rect.top : vp.clientHeight / 2;
      fx = (vp.scrollLeft + ax) / Math.max(1, vp.scrollWidth);
      fy = (vp.scrollTop + ay) / Math.max(1, vp.scrollHeight);
    }

    this.zoom = next;
    this.composer.updatePaperSheetDOM();
    this.updateZoomBadge();

    if (vp) {
      vp.scrollLeft = fx * vp.scrollWidth - ax;
      vp.scrollTop = fy * vp.scrollHeight - ay;
      this.renderRulers();
    }
  }

  zoomIn(anchor = null) {
    this.setZoom(this.zoom * 1.2, anchor);
  }

  zoomOut(anchor = null) {
    this.setZoom(this.zoom / 1.2, anchor);
  }

  zoomFit() {
    const vp = document.getElementById('cm-print-viewport');
    if (!vp) return;
    const style = getComputedStyle(vp);
    const padX = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
    const padY = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
    const availW = vp.clientWidth - padX;
    const availH = vp.clientHeight - padY;
    const paperW = this.composer.paperSize.width * PrintCanvasEngine.BASE_PX_PER_MM;
    const paperH = this.composer.paperSize.height * PrintCanvasEngine.BASE_PX_PER_MM;
    if (availW <= 0 || availH <= 0) return;

    const fitZoom = Math.min(availW / paperW, availH / paperH, 1.5);
    this.setZoom(fitZoom);
    this.autoFit = true;
    vp.scrollLeft = 0;
    vp.scrollTop = 0;
    this.renderRulers();
  }

  /** Liga/desliga as guias inteligentes (botão da barra e tecla U) */
  toggleSmartGuides() {
    const nextState = !this.smartGuides.enabled;
    this.smartGuides.setEnabled(nextState);
    const btn = document.getElementById('btn-toggle-smart-guides');
    if (btn) {
      btn.classList.toggle('active', nextState);
      btn.setAttribute('aria-pressed', String(nextState));
    }
    UIToast.notificar({
      tipo: nextState ? 'sucesso' : 'informativo',
      titulo: 'Guias inteligentes',
      mensagem: nextState ? 'Guias magnéticas ativadas.' : 'Guias desativadas.',
      duracao: 2000
    });
  }

  updateZoomBadge() {
    const badge = document.getElementById('cm-print-zoom-val');
    if (badge) {
      badge.textContent = `${Math.round(this.zoom * 100)}%`;
    }
  }

  renderRulers() {
    const rulerH = document.getElementById('ruler-h');
    const rulerV = document.getElementById('ruler-v');
    const vp = document.getElementById('cm-print-viewport');
    const sheet = document.getElementById('cm-print-paper-sheet');
    if (!rulerH || !rulerV || !vp || !sheet) return;

    const ctxH = rulerH.getContext('2d');
    const ctxV = rulerV.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const wH = rulerH.offsetWidth;
    const hH = rulerH.offsetHeight;
    const wV = rulerV.offsetWidth;
    const hV = rulerV.offsetHeight;
    if (!wH || !hH || !wV || !hV) return;
    rulerH.width = Math.round(wH * dpr);
    rulerH.height = Math.round(hH * dpr);
    rulerV.width = Math.round(wV * dpr);
    rulerV.height = Math.round(hV * dpr);
    ctxH.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctxV.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctxH.fillStyle = '#1e1e24';
    ctxH.fillRect(0, 0, wH, hH);
    ctxV.fillStyle = '#1e1e24';
    ctxV.fillRect(0, 0, wV, hV);

    const vpRect = vp.getBoundingClientRect();
    const sheetRect = sheet.getBoundingClientRect();

    // Posição zero da folha relativa às réguas
    const originX = sheetRect.left - vpRect.left;
    const originY = sheetRect.top - vpRect.top;
    const paperWMm = this.composer.paperSize.width;
    const paperHMm = this.composer.paperSize.height;

    // Régua Horizontal
    ctxH.strokeStyle = 'rgba(255,255,255,0.2)';
    ctxH.fillStyle = '#888899';
    ctxH.font = '8px monospace';
    ctxH.textAlign = 'center';

    const minMmX = Math.floor(-originX / this.mmToPx);
    const maxMmX = Math.ceil((wH - originX) / this.mmToPx);

    for (let mm = Math.max(-50, minMmX); mm <= Math.min(paperWMm + 50, maxMmX); mm += 2) {
      const x = originX + mm * this.mmToPx;
      if (x < 0 || x > wH) continue;
      const isMajor = mm % 10 === 0;
      const isWithinPaper = mm >= 0 && mm <= paperWMm;
      ctxH.strokeStyle = isWithinPaper ? 'rgba(0, 224, 138, 0.4)' : 'rgba(255,255,255,0.15)';
      ctxH.fillStyle = isWithinPaper ? '#00E08A' : '#666677';

      const tickH = isMajor ? 10 : (mm % 5 === 0 ? 6 : 3);
      ctxH.beginPath();
      ctxH.moveTo(x, hH - tickH);
      ctxH.lineTo(x, hH);
      ctxH.stroke();

      if (isMajor) {
        ctxH.fillText(String(mm), x, hH - 12);
      }
    }

    // Régua Vertical
    ctxV.textAlign = 'right';
    const minMmY = Math.floor(-originY / this.mmToPx);
    const maxMmY = Math.ceil((hV - originY) / this.mmToPx);

    for (let mm = Math.max(-50, minMmY); mm <= Math.min(paperHMm + 50, maxMmY); mm += 2) {
      const y = originY + mm * this.mmToPx;
      if (y < 0 || y > hV) continue;
      const isMajor = mm % 10 === 0;
      const isWithinPaper = mm >= 0 && mm <= paperHMm;
      ctxV.strokeStyle = isWithinPaper ? 'rgba(0, 224, 138, 0.4)' : 'rgba(255,255,255,0.15)';
      ctxV.fillStyle = isWithinPaper ? '#00E08A' : '#666677';

      const tickW = isMajor ? 10 : (mm % 5 === 0 ? 6 : 3);
      ctxV.beginPath();
      ctxV.moveTo(wV - tickW, y);
      ctxV.lineTo(wV, y);
      ctxV.stroke();

      if (isMajor) {
        ctxV.save();
        ctxV.translate(wV - 12, y + 3);
        ctxV.rotate(-Math.PI / 2);
        ctxV.fillText(String(mm), 0, 0);
        ctxV.restore();
      }
    }

    this.bindRulerGuides();
    this.renderManualGuides();
  }

  bindRulerGuides() {
    if (typeof document === 'undefined') return;
    const rulerH = document.getElementById('ruler-h');
    const rulerV = document.getElementById('ruler-v');
    if (!rulerH || !rulerV || rulerH._guideBound) return;
    rulerH._guideBound = true;
    rulerH.style.cursor = 'ns-resize';
    rulerH.title = 'Clique e arraste para baixo para criar uma guia horizontal';
    rulerV.style.cursor = 'ew-resize';
    rulerV.title = 'Clique e arraste para a direita para criar uma guia vertical';

    rulerH.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      this.startRulerGuideDrag('y', e.clientY);
    });

    rulerV.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      this.startRulerGuideDrag('x', e.clientX);
    });
  }

  startRulerGuideDrag(axis, startClientPos) {
    const sheet = document.getElementById('cm-print-paper-sheet');
    const vp = document.getElementById('cm-print-viewport');
    if (!sheet || !vp) return;

    const ghost = document.createElement('div');
    ghost.className = `cm-ruler-drag-ghost ${axis === 'y' ? 'horizontal' : 'vertical'}`;
    const tag = document.createElement('div');
    tag.className = 'cm-ruler-drag-tag';
    ghost.appendChild(tag);
    vp.appendChild(ghost);

    const onMove = (e) => {
      const sheetRect = sheet.getBoundingClientRect();
      const pxPerMm = this.mmToPx;
      if (pxPerMm <= 0) return;

      const vpRect = vp.getBoundingClientRect();
      if (axis === 'y') {
        const yMm = (e.clientY - sheetRect.top) / pxPerMm;
        const clampedY = Math.round(yMm * 2) / 2;
        const screenY = e.clientY - vpRect.top + vp.scrollTop;
        ghost.style.top = `${screenY}px`;
        ghost.style.left = '0px';
        ghost.style.right = '0px';
        tag.textContent = `Y: ${clampedY.toFixed(1)} mm`;
      } else {
        const xMm = (e.clientX - sheetRect.left) / pxPerMm;
        const clampedX = Math.round(xMm * 2) / 2;
        const screenX = e.clientX - vpRect.left + vp.scrollLeft;
        ghost.style.left = `${screenX}px`;
        ghost.style.top = '0px';
        ghost.style.bottom = '0px';
        tag.textContent = `X: ${clampedX.toFixed(1)} mm`;
      }
    };

    const onUp = (e) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      ghost.remove();

      const sheetRect = sheet.getBoundingClientRect();
      const pxPerMm = this.mmToPx;
      if (pxPerMm <= 0) return;

      if (axis === 'y') {
        const yMm = (e.clientY - sheetRect.top) / pxPerMm;
        const paperH = this.composer.paperSize?.height || 210;
        if (yMm >= 0 && yMm <= paperH) {
          this.addManualGuide('y', yMm);
        }
      } else {
        const xMm = (e.clientX - sheetRect.left) / pxPerMm;
        const paperW = this.composer.paperSize?.width || 297;
        if (xMm >= 0 && xMm <= paperW) {
          this.addManualGuide('x', xMm);
        }
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  addManualGuide(axis, valMm) {
    this.composer.manualGuides = this.composer.manualGuides || { x: [], y: [] };
    const list = this.composer.manualGuides[axis] || [];
    const rounded = Math.round(valMm * 2) / 2;
    if (!list.includes(rounded)) {
      list.push(rounded);
      list.sort((a, b) => a - b);
      this.composer.manualGuides[axis] = list;
      this.renderManualGuides();
      this.composer.pushHistoryState(`Criar Guia ${axis.toUpperCase()} ${rounded}mm`);
      UIToast.notificar({
        tipo: 'sucesso',
        titulo: 'Guia Criada',
        mensagem: `Guia em ${rounded} mm adicionada. (Snap magnético ativo)`,
        duracao: 1500
      });
    }
  }

  removeManualGuide(axis, valMm) {
    if (!this.composer.manualGuides || !this.composer.manualGuides[axis]) return;
    this.composer.manualGuides[axis] = this.composer.manualGuides[axis].filter(v => Math.abs(v - valMm) > 0.1);
    this.renderManualGuides();
    this.composer.pushHistoryState(`Remover Guia ${axis.toUpperCase()}`);
  }

  renderManualGuides() {
    if (typeof document === 'undefined') return;
    const layer = document.getElementById('cm-print-manual-guides-layer');
    if (!layer) return;

    const guides = this.composer.manualGuides || { x: [], y: [] };
    const pxPerMm = this.mmToPx;

    layer.innerHTML = `
      ${(guides.x || []).map(x => `
        <div class="cm-manual-guide cm-manual-guide-v" style="left: ${x * pxPerMm}px;" title="Guia vertical ${x} mm (duplo clique para excluir)" data-guide-axis="x" data-guide-val="${x}">
          <div class="cm-manual-guide-tag" data-guide-axis="x" data-guide-val="${x}">
            <span>${x} mm</span>
            <button type="button" class="cm-manual-guide-del" data-del-guide="x" data-guide-val="${x}" title="Excluir guia">✕</button>
          </div>
        </div>
      `).join('')}
      ${(guides.y || []).map(y => `
        <div class="cm-manual-guide cm-manual-guide-h" style="top: ${y * pxPerMm}px;" title="Guia horizontal ${y} mm (duplo clique para excluir)" data-guide-axis="y" data-guide-val="${y}">
          <div class="cm-manual-guide-tag" data-guide-axis="y" data-guide-val="${y}">
            <span>${y} mm</span>
            <button type="button" class="cm-manual-guide-del" data-del-guide="y" data-guide-val="${y}" title="Excluir guia">✕</button>
          </div>
        </div>
      `).join('')}
    `;

    layer.querySelectorAll('[data-del-guide]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        this.removeManualGuide(btn.dataset.delGuide, parseFloat(btn.dataset.guideVal));
      };
    });

    layer.querySelectorAll('.cm-manual-guide').forEach(el => {
      el.ondblclick = (e) => {
        e.stopPropagation();
        this.removeManualGuide(el.dataset.guideAxis, parseFloat(el.dataset.guideVal));
      };
    });
  }

  bindInteractions(paperSheet) {
    if (!paperSheet) return;
    const vp = document.getElementById('cm-print-viewport');

    // Sincroniza réguas com scroll e resize (inclui a barra superior quebrando de linha)
    if (vp && !vp._rulerBound) {
      vp._rulerBound = true;
      vp.addEventListener('scroll', () => requestAnimationFrame(() => this.renderRulers()));
      // Se o usuário não mexeu no zoom, a folha continua ajustada ao novo tamanho da área
      const onViewportResize = () => requestAnimationFrame(() => {
        if (this.autoFit && this.composer.isOpen) this.zoomFit();
        else this.renderRulers();
      });
      if (typeof ResizeObserver !== 'undefined') {
        this.viewportObserver = new ResizeObserver(onViewportResize);
        this.viewportObserver.observe(vp);
      } else {
        window.addEventListener('resize', onViewportResize);
      }

      // Zoom com a roda, ancorado no cursor. Sobre um mapa em modo "conteúdo", a roda é do Leaflet (zoom do mapa);
      // Shift + roda rola na horizontal (comportamento nativo).
      vp.addEventListener('wheel', (e) => {
        if (e.shiftKey || !e.deltaY) return;
        const modoConteudo = this.composer.interactionMode === 'content_pan';
        const sobreMapa = e.target.closest?.('.cm-item-map-frame');
        if (modoConteudo && sobreMapa && !(e.ctrlKey || e.metaKey || e.altKey)) return;
        e.preventDefault();
        const anchor = { x: e.clientX, y: e.clientY };
        if (e.deltaY < 0) this.zoomIn(anchor);
        else this.zoomOut(anchor);
      }, { passive: false });

      // Pan da prancheta com Botão do Meio ou arrasto fora dos itens
      vp.addEventListener('mousedown', (e) => {
        const onEmptySpace = e.target === vp || e.target.id === 'cm-print-paper-sheet' || e.target.id === 'cm-print-items-layer' || e.target.id === 'cm-abnt-margins-frame';
        if (e.button === 1 || (e.button === 0 && onEmptySpace)) {
          if (e.button === 1) e.preventDefault();
          this.isPanning = true;
          this.panStartX = e.clientX;
          this.panStartY = e.clientY;
          this.scrollStartX = vp.scrollLeft;
          this.scrollStartY = vp.scrollTop;
          vp.style.cursor = 'grabbing';
        }
      });
    }

    paperSheet.onmousedown = (e) => {
      // Se estiver no modo de navegação de conteúdo do mapa, não captura o arrasto da caixa
      if (this.composer.interactionMode === 'content_pan') {
        const isMapClick = e.target.closest('.cm-item-map-frame');
        if (isMapClick) return; // Permite ao Leaflet lidar com o evento nativo
      }

      const handle = e.target.closest('.cm-resize-handle');
      const itemEl = e.target.closest('.cm-print-item');
      const isAdditive = e.shiftKey || e.ctrlKey || e.metaKey;

      if (handle && itemEl) {
        e.stopPropagation();
        const itemId = itemEl.getAttribute('data-item-id');
        const item = this.composer.items.find(i => i.id === itemId);
        if (!item || item.locked) return;

        this.isResizing = true;
        this.resizeHandle = handle.getAttribute('data-handle');
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.itemStartProps = { ...item };
        this.composer.selectItem(itemId);
      } else if (itemEl) {
        const itemId = itemEl.getAttribute('data-item-id');
        const item = this.composer.items.find(i => i.id === itemId);
        if (!item || item.locked) {
          if (item) this.composer.selectItem(itemId, { additive: isAdditive });
          return;
        }

        if (isAdditive) {
          this.composer.selectItem(itemId, { additive: true });
          return;
        }

        const isAlreadySelected = this.composer.selectedItemIds ? this.composer.selectedItemIds.has(itemId) : (this.composer.selectedItemId === itemId);
        if (!isAlreadySelected) {
          this.composer.selectItem(itemId, { additive: false });
        }

        this.isDraggingItem = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.itemsStartProps = (typeof this.composer.getSelectedItems === 'function' ? this.composer.getSelectedItems() : [item]).map(it => ({ ...it }));
        this.itemStartProps = { ...item };
      } else {
        if (!isAdditive) {
          this.composer.selectItem(null);
        }
      }
    };

    // Remove listeners antigos antes de definir novos
    if (this.mouseMoveHandler) window.removeEventListener('mousemove', this.mouseMoveHandler);
    if (this.mouseUpHandler) window.removeEventListener('mouseup', this.mouseUpHandler);

    this.mouseMoveHandler = (e) => {
      if (this.isPanning && vp) {
        vp.scrollLeft = this.scrollStartX - (e.clientX - this.panStartX);
        vp.scrollTop = this.scrollStartY - (e.clientY - this.panStartY);
        return;
      }

      if (this.isDraggingItem && this.itemsStartProps && this.itemsStartProps.length > 0) {
        const rawDx = (e.clientX - this.dragStartX) / this.mmToPx;
        const rawDy = (e.clientY - this.dragStartY) / this.mmToPx;

        const primaryStart = this.itemStartProps;
        const primaryItem = this.composer.items.find(i => i.id === primaryStart?.id);

        let dx = rawDx;
        let dy = rawDy;

        if (primaryItem) {
          const rawX = Math.max(0, Math.min(this.composer.paperSize.width - primaryItem.width, primaryStart.x + rawDx));
          const rawY = Math.max(0, Math.min(this.composer.paperSize.height - primaryItem.height, primaryStart.y + rawDy));

          const otherItems = this.composer.items.filter(i => !this.itemsStartProps.some(sp => sp.id === i.id));
          const { snappedX, snappedY } = this.smartGuides.calculateDragSnap(
            primaryItem,
            rawX,
            rawY,
            otherItems,
            this.composer.paperSize,
            this.composer.showAbntMargins
          );
          dx = snappedX - primaryStart.x;
          dy = snappedY - primaryStart.y;
        }

        this.itemsStartProps.forEach(sp => {
          const it = this.composer.items.find(i => i.id === sp.id);
          if (it && !it.locked) {
            it.x = Math.max(0, Math.min(this.composer.paperSize.width - it.width, sp.x + dx));
            it.y = Math.max(0, Math.min(this.composer.paperSize.height - it.height, sp.y + dy));
            this.composer.updateItemPositionDOM(it);
          }
        });
      } else if (this.isResizing && this.itemStartProps) {
        this.handleItemResize(e);
      }
    };

    this.mouseUpHandler = () => {
      if (this.isPanning && vp) {
        this.isPanning = false;
        vp.style.cursor = '';
      }
      if (this.isDraggingItem || this.isResizing) {
        const hadMoved = (this.itemsStartProps && this.itemsStartProps.some(sp => {
          const it = this.composer.items.find(i => i.id === sp.id);
          return it && (it.x !== sp.x || it.y !== sp.y);
        })) || (this.itemStartProps && (
          this.composer.items.some(i => i.id === this.itemStartProps.id && (i.x !== this.itemStartProps.x || i.y !== this.itemStartProps.y || i.width !== this.itemStartProps.width || i.height !== this.itemStartProps.height))
        ));
        this.smartGuides.clearGuides();
        this.isDraggingItem = false;
        this.isResizing = false;
        this.itemStartProps = null;
        this.itemsStartProps = null;
        this.composer.updatePropertiesPanel();
        if (hadMoved) {
          this.composer.pushHistoryState('Mover/Redimensionar');
        }
      }
    };

    window.addEventListener('mousemove', this.mouseMoveHandler);
    window.addEventListener('mouseup', this.mouseUpHandler);
  }

  handleItemResize(e) {
    const dx = (e.clientX - this.dragStartX) / this.mmToPx;
    const dy = (e.clientY - this.dragStartY) / this.mmToPx;
    const it = this.composer.items.find(i => i.id === this.itemStartProps.id);
    if (!it) return;

    const sp = this.itemStartProps;
    const min = PrintItemsManager.MIN_ITEM_MM;

    if (this.resizeHandle === 'e' || this.resizeHandle === 'se' || this.resizeHandle === 'ne') {
      it.width = Math.max(min, sp.width + dx);
    }
    if (this.resizeHandle === 's' || this.resizeHandle === 'se' || this.resizeHandle === 'sw') {
      it.height = Math.max(min, sp.height + dy);
    }
    if (this.resizeHandle === 'w' || this.resizeHandle === 'sw' || this.resizeHandle === 'nw') {
      it.width = Math.max(min, sp.width - dx);
      it.x = sp.x + (sp.width - it.width);
    }
    if (this.resizeHandle === 'n' || this.resizeHandle === 'ne' || this.resizeHandle === 'nw') {
      it.height = Math.max(min, sp.height - dy);
      it.y = sp.y + (sp.height - it.height);
    }

    // Aplica snap de guias inteligentes no redimensionamento
    const snapResult = this.smartGuides.calculateResizeSnap(
      it,
      it.x,
      it.y,
      it.width,
      it.height,
      this.resizeHandle,
      this.composer.items,
      this.composer.paperSize,
      this.composer.showAbntMargins
    );

    it.x = snapResult.newX;
    it.y = snapResult.newY;
    it.width = snapResult.newW;
    it.height = snapResult.newH;

    this.composer.updateItemPositionDOM(it);
  }

  bindKeyboardShortcuts() {
    if (this.keyDownHandler) window.removeEventListener('keydown', this.keyDownHandler);

    this.keyDownHandler = (e) => {
      if (!this.composer.isOpen) return;

      // Salvaguarda: NUNCA intercepta teclas quando o foco estiver em campos de input ou texto (Regra GEMINI.md)
      const path = typeof e.composedPath === 'function' ? e.composedPath() : [e.target];
      const isInput = path.some(el => {
        if (!el || !el.tagName) return false;
        const tag = el.tagName.toUpperCase();
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
          || tag === 'UI-CAMPO-TEXTO' || tag === 'UI-INPUT' || tag === 'UI-AREA-TEXTO' || tag === 'UI-TEXTAREA'
          || tag === 'UI-SELECT' || tag === 'UI-LISTA-FLUTUANTE' || tag === 'UI-TABELA-PROPRIEDADES'
          || el.isContentEditable;
      });
      if (isInput) return;

      // Atalhos com modificadores (Desfazer, Refazer, Duplicar)
      if (e.ctrlKey || e.metaKey) {
        if ((e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
          e.preventDefault();
          this.composer.undo();
          return;
        }
        if ((e.key === 'y' || e.key === 'Y') || ((e.key === 'z' || e.key === 'Z') && e.shiftKey)) {
          e.preventDefault();
          this.composer.redo();
          return;
        }
        if (e.key === 'd' || e.key === 'D') {
          e.preventDefault();
          PrintAlignmentHelper.duplicateItem(this.composer);
          return;
        }
        return; // Preserva outros atalhos com Ctrl
      }
      if (e.altKey) return;

      // Com a janela Visibilidade/Gráficos aberta, a prancheta não recebe teclas (só desfazer/refazer, acima)
      if (this.composer.visibilityDialog?.isOpen()) return;

      // Só visualizando (outro operador edita a prancha): apenas zoom e Esc
      if (this.composer.readOnly && !['0', '+', '=', '-', '_', 'Escape'].includes(e.key)) return;

      // V V abre Visibilidade/Gráficos do mapa (atalho do Revit)
      if (e.key === 'v' || e.key === 'V') {
        const now = Date.now();
        if (this.lastVKeyAt && now - this.lastVKeyAt < 600) {
          e.preventDefault();
          this.lastVKeyAt = 0;
          this.composer.openVisibilityDialog();
        } else {
          this.lastVKeyAt = now;
        }
        return;
      }

      // Atalho rápido 'U' para ligar/desligar Smart Guides (como Illustrator)
      if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        this.toggleSmartGuides();
        return;
      }

      // Atalhos da prancheta (independem de haver item selecionado)
      if (e.key === 'Escape') {
        if (this.composer.interactionMode === 'content_pan') this.composer.setInteractionMode('layout');
        else this.composer.selectItem(null);
        return;
      }
      if (e.key === '0') { e.preventDefault(); this.zoomFit(); return; }
      if (e.key === '+' || e.key === '=') { e.preventDefault(); this.zoomIn(); return; }
      if (e.key === '-' || e.key === '_') { e.preventDefault(); this.zoomOut(); return; }

      const selectedId = this.composer.selectedItemId;
      if (!selectedId) return;

      const item = this.composer.items.find(i => i.id === selectedId);
      if (!item || item.locked) return;

      // Atalho rápido '[' ou ']' para recolher/expandir o painel de propriedades
      if (e.key === '[' || e.key === ']') {
        e.preventDefault();
        this.composer.togglePropertiesPanel();
        return;
      }

      // Excluir com Delete ou Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        const ids = [...(this.composer.selectedItemIds || [selectedId])];
        if (typeof this.composer.deleteItems === 'function' && ids.length > 1) {
          this.composer.deleteItems(ids);
        } else {
          this.composer.deleteItem(selectedId);
        }
        return;
      }

      // Mover milímetro a milímetro com as setas (5mm com Shift) para todos os selecionados
      const itemsToMove = (typeof this.composer.getSelectedItems === 'function' ? this.composer.getSelectedItems() : [item]).filter(i => !i.locked);
      if (!itemsToMove.length) return;

      const step = e.shiftKey ? 5 : 1;
      let dx = 0, dy = 0;

      if (e.key === 'ArrowUp') dy = -step;
      else if (e.key === 'ArrowDown') dy = step;
      else if (e.key === 'ArrowLeft') dx = -step;
      else if (e.key === 'ArrowRight') dx = step;

      if (dx !== 0 || dy !== 0) {
        e.preventDefault();
        itemsToMove.forEach(it => {
          it.x = Math.max(0, Math.min(this.composer.paperSize.width - it.width, it.x + dx));
          it.y = Math.max(0, Math.min(this.composer.paperSize.height - it.height, it.y + dy));
          this.composer.updateItemPositionDOM(it);
        });
        this.composer.updatePropertiesPanel();
        // Toques seguidos nas setas viram um único passo de desfazer
        this.composer.pushHistoryState('Mover com as Setas', { coalesceKey: `nudge:${itemsToMove.map(i => i.id).join(',')}` });
      }
    };

    window.addEventListener('keydown', this.keyDownHandler);
  }

  destroy() {
    if (this.mouseMoveHandler) window.removeEventListener('mousemove', this.mouseMoveHandler);
    if (this.mouseUpHandler) window.removeEventListener('mouseup', this.mouseUpHandler);
    if (this.keyDownHandler) window.removeEventListener('keydown', this.keyDownHandler);
    this.mouseMoveHandler = null;
    this.mouseUpHandler = null;
    this.keyDownHandler = null;
  }
}
