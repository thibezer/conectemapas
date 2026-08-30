/* ==========================================================================
   ConecteMapas - PrintCanvasEngine
   Responsabilidade Única: Motor de interação da prancheta, réguas milimétricas,
   arrasto de itens e manipulação de alças de redimensionamento.
   ========================================================================== */

export class PrintCanvasEngine {
  constructor(composer) {
    this.composer = composer;
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.isDraggingItem = false;
    this.isResizing = false;
    this.resizeHandle = null;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.itemStartProps = null;
  }

  // 1 mm em pixels de tela na escala 100%
  get mmToPx() {
    return 3.78 * this.zoom;
  }

  renderRulers(rulerHCanvas, rulerVCanvas, paperWidthMm, paperHeightMm) {
    if (!rulerHCanvas || !rulerVCanvas) return;

    const ctxH = rulerHCanvas.getContext('2d');
    const ctxV = rulerVCanvas.getContext('2d');
    const wH = rulerHCanvas.width = rulerHCanvas.offsetWidth;
    const hH = rulerHCanvas.height = rulerHCanvas.offsetHeight;
    const wV = rulerVCanvas.width = rulerVCanvas.offsetWidth;
    const hV = rulerVCanvas.height = rulerVCanvas.offsetHeight;

    ctxH.fillStyle = '#1e1e24';
    ctxH.fillRect(0, 0, wH, hH);
    ctxV.fillStyle = '#1e1e24';
    ctxV.fillRect(0, 0, wV, hV);

    const stepMm = 10;
    const pxStep = stepMm * this.mmToPx;

    // Régua Horizontal
    ctxH.strokeStyle = 'rgba(255,255,255,0.2)';
    ctxH.fillStyle = '#888899';
    ctxH.font = '8px monospace';
    ctxH.textAlign = 'center';

    for (let mm = 0; mm <= paperWidthMm; mm += 2) {
      const x = mm * this.mmToPx + 40; // offset do padding
      if (x > wH) break;
      const isMajor = mm % 10 === 0;
      const tickH = isMajor ? 10 : (mm % 5 === 0 ? 6 : 3);
      ctxH.beginPath();
      ctxH.moveTo(x, hH - tickH);
      ctxH.lineTo(x, hH);
      ctxH.stroke();

      if (isMajor && mm > 0) {
        ctxH.fillText(String(mm), x, hH - 12);
      }
    }

    // Régua Vertical
    ctxV.strokeStyle = 'rgba(255,255,255,0.2)';
    ctxV.fillStyle = '#888899';
    ctxV.font = '8px monospace';
    ctxV.textAlign = 'right';

    for (let mm = 0; mm <= paperHeightMm; mm += 2) {
      const y = mm * this.mmToPx + 40;
      if (y > hV) break;
      const isMajor = mm % 10 === 0;
      const tickW = isMajor ? 10 : (mm % 5 === 0 ? 6 : 3);
      ctxV.beginPath();
      ctxV.moveTo(wV - tickW, y);
      ctxV.lineTo(wV, y);
      ctxV.stroke();

      if (isMajor && mm > 0) {
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

    window.onmousemove = (e) => {
      if (this.isDraggingItem && this.itemStartProps) {
        const dxPx = e.clientX - this.dragStartX;
        const dyPx = e.clientY - this.dragStartY;
        const dxMm = dxPx / this.mmToPx;
        const dyMm = dyPx / this.mmToPx;

        const it = this.composer.items.find(i => i.id === this.itemStartProps.id);
        if (it) {
          it.x = Math.max(0, Math.min(this.composer.paperSize.width - it.width, this.itemStartProps.x + dxMm));
          it.y = Math.max(0, Math.min(this.composer.paperSize.height - it.height, this.itemStartProps.y + dyMm));
          this.composer.updateItemPositionDOM(it);
        }
      } else if (this.isResizing && this.itemStartProps) {
        const dxPx = e.clientX - this.dragStartX;
        const dyPx = e.clientY - this.dragStartY;
        const dxMm = dxPx / this.mmToPx;
        const dyMm = dyPx / this.mmToPx;

        const it = this.composer.items.find(i => i.id === this.itemStartProps.id);
        if (it) {
          if (this.resizeHandle === 'se') {
            it.width = Math.max(15, this.itemStartProps.width + dxMm);
            it.height = Math.max(15, this.itemStartProps.height + dyMm);
          } else if (this.resizeHandle === 'e') {
            it.width = Math.max(15, this.itemStartProps.width + dxMm);
          } else if (this.resizeHandle === 's') {
            it.height = Math.max(15, this.itemStartProps.height + dyMm);
          } else if (this.resizeHandle === 'nw') {
            const newW = Math.max(15, this.itemStartProps.width - dxMm);
            const newH = Math.max(15, this.itemStartProps.height - dyMm);
            it.x = this.itemStartProps.x + (this.itemStartProps.width - newW);
            it.y = this.itemStartProps.y + (this.itemStartProps.height - newH);
            it.width = newW;
            it.height = newH;
          }
          this.composer.updateItemPositionDOM(it);
        }
      }
    };

    window.onmouseup = () => {
      if (this.isDraggingItem || this.isResizing) {
        this.isDraggingItem = false;
        this.isResizing = false;
        this.itemStartProps = null;
        this.composer.updatePropertiesPanel();
      }
    };
  }
}
