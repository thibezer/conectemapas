/* ==========================================================================
   ConecteMapas - PrintCanvasEngine
   Responsabilidade Única: Motor de interação da prancheta, réguas milimétricas sincronizadas,
   zoom/pan, arrasto de itens, manipulação das 8 alças e atalhos de teclado de precisão.
   ========================================================================== */

import { PrintSmartGuides } from './PrintSmartGuides.js';
import { PrintAlignmentHelper } from './PrintAlignmentHelper.js';
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

    // Pan state da folha
    this.isPanning = false;
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
    vp.scrollLeft = 0;
    vp.scrollTop = 0;
    this.renderRulers();
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
  }

  bindInteractions(paperSheet) {
    if (!paperSheet) return;
    const vp = document.getElementById('cm-print-viewport');

    // Sincroniza réguas com scroll e resize (inclui a barra superior quebrando de linha)
    if (vp && !vp._rulerBound) {
      vp._rulerBound = true;
      vp.addEventListener('scroll', () => requestAnimationFrame(() => this.renderRulers()));
      if (typeof ResizeObserver !== 'undefined') {
        this.viewportObserver = new ResizeObserver(() => requestAnimationFrame(() => this.renderRulers()));
        this.viewportObserver.observe(vp);
      } else {
        window.addEventListener('resize', () => requestAnimationFrame(() => this.renderRulers()));
      }

      // Zoom com Ctrl + roda, ancorado no cursor
      vp.addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) {
          e.preventDefault();
          const anchor = { x: e.clientX, y: e.clientY };
          if (e.deltaY < 0) this.zoomIn(anchor);
          else this.zoomOut(anchor);
        }
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
          if (item) this.composer.selectItem(itemId);
          return;
        }

        this.isDraggingItem = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.itemStartProps = { ...item };
        this.composer.selectItem(itemId);
      } else {
        this.composer.selectItem(null);
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

      if (this.isDraggingItem && this.itemStartProps) {
        const rawDx = (e.clientX - this.dragStartX) / this.mmToPx;
        const rawDy = (e.clientY - this.dragStartY) / this.mmToPx;
        const it = this.composer.items.find(i => i.id === this.itemStartProps.id);
        if (it) {
          const rawX = Math.max(0, Math.min(this.composer.paperSize.width - it.width, this.itemStartProps.x + rawDx));
          const rawY = Math.max(0, Math.min(this.composer.paperSize.height - it.height, this.itemStartProps.y + rawDy));

          // Aplica cálculo de atração magnética das Smart Guides (estilo Illustrator)
          const { snappedX, snappedY } = this.smartGuides.calculateDragSnap(
            it,
            rawX,
            rawY,
            this.composer.items,
            this.composer.paperSize,
            this.composer.showAbntMargins
          );

          it.x = Math.max(0, Math.min(this.composer.paperSize.width - it.width, snappedX));
          it.y = Math.max(0, Math.min(this.composer.paperSize.height - it.height, snappedY));
          this.composer.updateItemPositionDOM(it);
        }
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
        const hadMoved = this.itemStartProps && (
          this.composer.items.some(i => i.id === this.itemStartProps.id && (i.x !== this.itemStartProps.x || i.y !== this.itemStartProps.y || i.width !== this.itemStartProps.width || i.height !== this.itemStartProps.height))
        );
        this.smartGuides.clearGuides();
        this.isDraggingItem = false;
        this.isResizing = false;
        this.itemStartProps = null;
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
    const min = 15;

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
      const target = e.target;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
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

      // Atalho rápido 'U' para ligar/desligar Smart Guides (como Illustrator)
      if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        const nextState = !this.smartGuides.enabled;
        this.smartGuides.setEnabled(nextState);
        const btn = document.getElementById('btn-toggle-smart-guides');
        if (btn) btn.classList.toggle('active', nextState);
        UIToast.notificar({
          tipo: nextState ? 'sucesso' : 'informativo',
          titulo: 'Guias Inteligentes',
          mensagem: nextState ? 'Guias automáticas magnéticas ativadas (estilo Illustrator).' : 'Guias inteligentes desativadas.',
          duracao: 2000
        });
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

      // Excluir com Delete ou Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        this.composer.deleteItem(selectedId);
        return;
      }

      // Mover milímetro a milímetro com as setas (5mm com Shift)
      const step = e.shiftKey ? 5 : 1;
      let moved = false;

      if (e.key === 'ArrowUp') {
        item.y = Math.max(0, item.y - step);
        moved = true;
      } else if (e.key === 'ArrowDown') {
        item.y = Math.min(this.composer.paperSize.height - item.height, item.y + step);
        moved = true;
      } else if (e.key === 'ArrowLeft') {
        item.x = Math.max(0, item.x - step);
        moved = true;
      } else if (e.key === 'ArrowRight') {
        item.x = Math.min(this.composer.paperSize.width - item.width, item.x + step);
        moved = true;
      }

      if (moved) {
        e.preventDefault();
        this.composer.updateItemPositionDOM(item);
        this.composer.updatePropertiesPanel();
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
