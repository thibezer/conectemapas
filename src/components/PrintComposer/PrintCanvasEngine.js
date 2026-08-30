/* ==========================================================================
   ConecteMapas - PrintCanvasEngine
   Responsabilidade Única: Motor de interação da prancheta, réguas milimétricas sincronizadas,
   zoom/pan, arrasto de itens e manipulação completa das 8 alças de redimensionamento.
   ========================================================================== */

export class PrintCanvasEngine {
  constructor(composer) {
    this.composer = composer;
    this.zoom = 1.0;
    this.isDraggingItem = false;
    this.isResizing = false;
    this.resizeHandle = null;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.itemStartProps = null;

    // Pan state
    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;
    this.scrollStartX = 0;
    this.scrollStartY = 0;
  }

  // 1 mm em pixels de tela para o nível atual de zoom
  get mmToPx() {
    return 3.78 * this.zoom;
  }

  setZoom(val) {
    this.zoom = Math.max(0.2, Math.min(3.0, val));
    this.composer.updatePaperSheetDOM();
    this.composer.updateCanvas();
    this.updateZoomBadge();
  }

  zoomIn() {
    this.setZoom(this.zoom + 0.15);
  }

  zoomOut() {
    this.setZoom(this.zoom - 0.15);
  }

  zoomFit() {
    const vp = document.getElementById('cm-print-viewport');
    if (!vp) return;
    const availW = vp.clientWidth - 80;
    const availH = vp.clientHeight - 80;
    const paperW = this.composer.paperSize.width * 3.78;
    const paperH = this.composer.paperSize.height * 3.78;

    const scaleX = availW / paperW;
    const scaleY = availH / paperH;
    const fitZoom = Math.min(scaleX, scaleY, 1.5);
    this.setZoom(Math.max(0.25, fitZoom));
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
    const wH = rulerH.width = rulerH.offsetWidth;
    const hH = rulerH.height = rulerH.offsetHeight;
    const wV = rulerV.width = rulerV.offsetWidth;
    const hV = rulerV.height = rulerV.offsetHeight;

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

    // Sincroniza réguas com scroll e resize
    if (vp && !vp._rulerBound) {
      vp._rulerBound = true;
      vp.addEventListener('scroll', () => requestAnimationFrame(() => this.renderRulers()));
      window.addEventListener('resize', () => requestAnimationFrame(() => this.renderRulers()));

      // Zoom com Wheel (Ctrl + Roda ou Roda direta na prancheta)
      vp.addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) {
          e.preventDefault();
          const delta = e.deltaY < 0 ? 0.1 : -0.1;
          this.setZoom(this.zoom + delta);
        }
      }, { passive: false });

      // Pan com Botão do Meio ou Espaço
      vp.addEventListener('mousedown', (e) => {
        if (e.button === 1 || (e.button === 0 && e.target === vp)) {
          this.isPanning = true;
          this.panStartX = e.clientX;
          this.panStartY = e.clientY;
          this.scrollStartX = vp.scrollLeft;
          this.scrollStartY = vp.scrollTop;
          vp.style.cursor = 'grab';
        }
      });
    }

    paperSheet.onmousedown = (e) => {
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
        if (!item || item.locked) return;

        this.isDraggingItem = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.itemStartProps = { ...item };
        this.composer.selectItem(itemId);
      } else {
        this.composer.selectItem(null);
      }
    };

    this.mouseMoveHandler = (e) => {
      if (this.isPanning && vp) {
        const dx = e.clientX - this.panStartX;
        const dy = e.clientY - this.panStartY;
        vp.scrollLeft = this.scrollStartX - dx;
        vp.scrollTop = this.scrollStartY - dy;
        return;
      }

      if (this.isDraggingItem && this.itemStartProps) {
        const dxMm = (e.clientX - this.dragStartX) / this.mmToPx;
        const dyMm = (e.clientY - this.dragStartY) / this.mmToPx;

        const it = this.composer.items.find(i => i.id === this.itemStartProps.id);
        if (it) {
          it.x = Math.max(0, Math.min(this.composer.paperSize.width - it.width, this.itemStartProps.x + dxMm));
          it.y = Math.max(0, Math.min(this.composer.paperSize.height - it.height, this.itemStartProps.y + dyMm));
          this.composer.updateItemPositionDOM(it);
        }
      } else if (this.isResizing && this.itemStartProps) {
        const dxMm = (e.clientX - this.dragStartX) / this.mmToPx;
        const dyMm = (e.clientY - this.dragStartY) / this.mmToPx;
        const it = this.composer.items.find(i => i.id === this.itemStartProps.id);
        if (!it) return;

        const sp = this.itemStartProps;
        const minDim = 15;

        switch (this.resizeHandle) {
          case 'e':
            it.width = Math.max(minDim, sp.width + dxMm);
            break;
          case 's':
            it.height = Math.max(minDim, sp.height + dyMm);
            break;
          case 'se':
            it.width = Math.max(minDim, sp.width + dxMm);
            it.height = Math.max(minDim, sp.height + dyMm);
            break;
          case 'ne':
            it.width = Math.max(minDim, sp.width + dxMm);
            it.height = Math.max(minDim, sp.height - dyMm);
            it.y = sp.y + (sp.height - it.height);
            break;
          case 'sw':
            it.width = Math.max(minDim, sp.width - dxMm);
            it.height = Math.max(minDim, sp.height + dyMm);
            it.x = sp.x + (sp.width - it.width);
            break;
          case 'nw':
            it.width = Math.max(minDim, sp.width - dxMm);
            it.height = Math.max(minDim, sp.height - dyMm);
            it.x = sp.x + (sp.width - it.width);
            it.y = sp.y + (sp.height - it.height);
            break;
          case 'n':
            it.height = Math.max(minDim, sp.height - dyMm);
            it.y = sp.y + (sp.height - it.height);
            break;
          case 'w':
            it.width = Math.max(minDim, sp.width - dxMm);
            it.x = sp.x + (sp.width - it.width);
            break;
        }

        this.composer.updateItemPositionDOM(it);
      }
    };

    this.mouseUpHandler = () => {
      if (this.isPanning && vp) {
        this.isPanning = false;
        vp.style.cursor = 'default';
      }
      if (this.isDraggingItem || this.isResizing) {
        this.isDraggingItem = false;
        this.isResizing = false;
        this.itemStartProps = null;
        this.composer.updatePropertiesPanel();
      }
    };

    window.removeEventListener('mousemove', this.mouseMoveHandler);
    window.removeEventListener('mouseup', this.mouseUpHandler);
    window.addEventListener('mousemove', this.mouseMoveHandler);
    window.addEventListener('mouseup', this.mouseUpHandler);
  }

  destroy() {
    if (this.mouseMoveHandler) window.removeEventListener('mousemove', this.mouseMoveHandler);
    if (this.mouseUpHandler) window.removeEventListener('mouseup', this.mouseUpHandler);
  }
}
