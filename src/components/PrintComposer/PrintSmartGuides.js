/* ==========================================================================
   ConecteMapas - PrintSmartGuides
   Responsabilidade Única: Motor de Guias Automáticas Inteligentes (Smart Guides)
   estilo Adobe Illustrator para pranchas cartográficas, alinhamento magnético
   entre múltiplos elementos e margens da folha ABNT, com feedback visual em tempo real.
   ========================================================================== */

import { PrintItemsManager } from './PrintItemsManager.js';

export class PrintSmartGuides {
  constructor(canvasEngine) {
    this.canvasEngine = canvasEngine;
    this.enabled = true;
    this.toleranceMm = 2.5; // Distância de atração magnética em mm
    this.activeGuides = []; // Lista de guias ativas desenhadas no frame atual
  }

  /**
   * Ativa ou desativa as guias inteligentes
   */
  setEnabled(enabled) {
    this.enabled = !!enabled;
    if (!this.enabled) {
      this.clearGuides();
    }
  }

  /**
   * Limpa as guias visuais do canvas
   */
  clearGuides() {
    this.activeGuides = [];
    if (typeof document === 'undefined') return;
    const canvas = document.getElementById('cm-print-smart-guides-canvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  /**
   * Executa o cálculo de alinhamento e snap magnético durante o arraste de um item.
   * Retorna { snappedX, snappedY, guides }
   */
  calculateDragSnap(activeItem, rawX, rawY, allItems, paperSize, showAbntMargins = true) {
    if (!this.enabled) {
      this.clearGuides();
      return { snappedX: rawX, snappedY: rawY, guides: [] };
    }

    const itemW = activeItem.width;
    const itemH = activeItem.height;

    // Coordenadas candidatas do item
    let snappedX = rawX;
    let snappedY = rawY;

    const guides = [];

    // 1. Coleta todas as referências X (Verticais) e Y (Horizontais)
    const refXList = this.collectHorizontalReferences(allItems, activeItem.id, paperSize, showAbntMargins);
    const refYList = this.collectVerticalReferences(allItems, activeItem.id, paperSize, showAbntMargins);

    // 2. Pontos de teste do item ativo em X (Esquerda, Centro, Direita)
    const testXPoints = [
      { offset: 0, type: 'left', label: 'Borda Esquerda' },
      { offset: itemW / 2, type: 'center', label: 'Centro Horizontal' },
      { offset: itemW, type: 'right', label: 'Borda Direita' }
    ];

    let bestDiffX = this.toleranceMm + 0.0001;
    let bestSnapX = null;
    let matchedGuideX = null;

    for (const tp of testXPoints) {
      const currentPointX = rawX + tp.offset;
      for (const ref of refXList) {
        const diff = Math.abs(currentPointX - ref.val);
        if (diff <= this.toleranceMm && diff < bestDiffX) {
          bestDiffX = diff;
          bestSnapX = ref.val - tp.offset;
          matchedGuideX = {
            type: 'vertical',
            x: ref.val,
            source: ref.source,
            label: ref.label || tp.label,
            refId: ref.id
          };
        }
      }
    }

    if (bestSnapX !== null) {
      snappedX = bestSnapX;
      guides.push(matchedGuideX);
    }

    // 3. Pontos de teste do item ativo em Y (Topo, Centro, Base)
    const testYPoints = [
      { offset: 0, type: 'top', label: 'Borda Superior' },
      { offset: itemH / 2, type: 'center', label: 'Centro Vertical' },
      { offset: itemH, type: 'bottom', label: 'Borda Inferior' }
    ];

    let bestDiffY = this.toleranceMm + 0.0001;
    let bestSnapY = null;
    let matchedGuideY = null;

    for (const tp of testYPoints) {
      const currentPointY = rawY + tp.offset;
      for (const ref of refYList) {
        const diff = Math.abs(currentPointY - ref.val);
        if (diff <= this.toleranceMm && diff < bestDiffY) {
          bestDiffY = diff;
          bestSnapY = ref.val - tp.offset;
          matchedGuideY = {
            type: 'horizontal',
            y: ref.val,
            source: ref.source,
            label: ref.label || tp.label,
            refId: ref.id
          };
        }
      }
    }

    if (bestSnapY !== null) {
      snappedY = bestSnapY;
      guides.push(matchedGuideY);
    }

    this.activeGuides = guides;
    this.renderGuidesVisuals(guides, paperSize);

    return { snappedX, snappedY, guides };
  }

  /**
   * Executa o cálculo de alinhamento e snap durante o redimensionamento por alças.
   */
  calculateResizeSnap(activeItem, newX, newY, newW, newH, handle, allItems, paperSize, showAbntMargins = true) {
    if (!this.enabled) {
      this.clearGuides();
      return { newX, newY, newW, newH, guides: [] };
    }

    const guides = [];
    const refXList = this.collectHorizontalReferences(allItems, activeItem.id, paperSize, showAbntMargins);
    const refYList = this.collectVerticalReferences(allItems, activeItem.id, paperSize, showAbntMargins);

    let resX = newX;
    let resY = newY;
    let resW = newW;
    let resH = newH;

    // Alças do lado Leste (E) -> ajusta borda direita (X + W)
    if (handle === 'e' || handle === 'se' || handle === 'ne') {
      const curRight = newX + newW;
      let bestDiff = this.toleranceMm + 0.0001;
      let bestRef = null;
      for (const ref of refXList) {
        const diff = Math.abs(curRight - ref.val);
        if (diff <= this.toleranceMm && diff < bestDiff) {
          bestDiff = diff;
          bestRef = ref;
        }
      }
      if (bestRef) {
        resW = Math.max(PrintItemsManager.MIN_ITEM_MM, bestRef.val - newX);
        guides.push({ type: 'vertical', x: bestRef.val, source: bestRef.source, label: bestRef.label });
      }
    }

    // Alças do lado Oeste (W) -> ajusta borda esquerda (X) e mantém borda direita fixa
    if (handle === 'w' || handle === 'sw' || handle === 'nw') {
      const fixedRight = newX + newW;
      let bestDiff = this.toleranceMm + 0.0001;
      let bestRef = null;
      for (const ref of refXList) {
        const diff = Math.abs(newX - ref.val);
        if (diff <= this.toleranceMm && diff < bestDiff) {
          bestDiff = diff;
          bestRef = ref;
        }
      }
      if (bestRef && fixedRight - bestRef.val >= PrintItemsManager.MIN_ITEM_MM) {
        resX = bestRef.val;
        resW = fixedRight - resX;
        guides.push({ type: 'vertical', x: bestRef.val, source: bestRef.source, label: bestRef.label });
      }
    }

    // Alças do lado Sul (S) -> ajusta borda inferior (Y + H)
    if (handle === 's' || handle === 'se' || handle === 'sw') {
      const curBottom = newY + newH;
      let bestDiff = this.toleranceMm + 0.0001;
      let bestRef = null;
      for (const ref of refYList) {
        const diff = Math.abs(curBottom - ref.val);
        if (diff <= this.toleranceMm && diff < bestDiff) {
          bestDiff = diff;
          bestRef = ref;
        }
      }
      if (bestRef) {
        resH = Math.max(PrintItemsManager.MIN_ITEM_MM, bestRef.val - newY);
        guides.push({ type: 'horizontal', y: bestRef.val, source: bestRef.source, label: bestRef.label });
      }
    }

    // Alças do lado Norte (N) -> ajusta borda superior (Y) e mantém borda inferior fixa
    if (handle === 'n' || handle === 'ne' || handle === 'nw') {
      const fixedBottom = newY + newH;
      let bestDiff = this.toleranceMm + 0.0001;
      let bestRef = null;
      for (const ref of refYList) {
        const diff = Math.abs(newY - ref.val);
        if (diff <= this.toleranceMm && diff < bestDiff) {
          bestDiff = diff;
          bestRef = ref;
        }
      }
      if (bestRef && fixedBottom - bestRef.val >= PrintItemsManager.MIN_ITEM_MM) {
        resY = bestRef.val;
        resH = fixedBottom - resY;
        guides.push({ type: 'horizontal', y: bestRef.val, source: bestRef.source, label: bestRef.label });
      }
    }

    this.activeGuides = guides;
    this.renderGuidesVisuals(guides, paperSize);

    return { newX: resX, newY: resY, newW: resW, newH: resH, guides };
  }

  /**
   * Coleta linhas de referência verticais (posições X) da folha e de outros itens
   */
  collectHorizontalReferences(allItems, activeId, paperSize, showAbntMargins) {
    const refs = [];

    // 1. Margens e Centros da Folha
    refs.push({ val: 0, source: 'paper', label: 'Borda Esquerda da Folha' });
    refs.push({ val: paperSize.width / 2, source: 'paper_center', label: 'Centro da Folha' });
    refs.push({ val: paperSize.width, source: 'paper', label: 'Borda Direita da Folha' });

    if (showAbntMargins) {
      const m = PrintItemsManager.sheetMargins(paperSize);
      refs.push({ val: m.left, source: 'abnt', label: 'Margem Esquerda' });
      refs.push({ val: paperSize.width - m.right, source: 'abnt', label: 'Margem Direita' });
    }

    // 2. Outros Itens da Prancha
    allItems.forEach(item => {
      if (item.id === activeId || item.visible === false) return;
      refs.push({ val: item.x, source: 'item', label: `Alinhado com ${item.name || 'Item'}`, id: item.id });
      refs.push({ val: item.x + item.width / 2, source: 'item_center', label: `Centro com ${item.name || 'Item'}`, id: item.id });
      refs.push({ val: item.x + item.width, source: 'item', label: `Borda com ${item.name || 'Item'}`, id: item.id });
    });

    return refs;
  }

  /**
   * Coleta linhas de referência horizontais (posições Y) da folha e de outros itens
   */
  collectVerticalReferences(allItems, activeId, paperSize, showAbntMargins) {
    const refs = [];

    // 1. Margens e Centros da Folha
    refs.push({ val: 0, source: 'paper', label: 'Topo da Folha' });
    refs.push({ val: paperSize.height / 2, source: 'paper_center', label: 'Centro Vertical da Folha' });
    refs.push({ val: paperSize.height, source: 'paper', label: 'Base da Folha' });

    if (showAbntMargins) {
      const m = PrintItemsManager.sheetMargins(paperSize);
      refs.push({ val: m.top, source: 'abnt', label: 'Margem Superior' });
      refs.push({ val: paperSize.height - m.bottom, source: 'abnt', label: 'Margem Inferior' });
    }

    // 2. Outros Itens da Prancha
    allItems.forEach(item => {
      if (item.id === activeId || item.visible === false) return;
      refs.push({ val: item.y, source: 'item', label: `Alinhado com ${item.name || 'Item'}`, id: item.id });
      refs.push({ val: item.y + item.height / 2, source: 'item_center', label: `Centro com ${item.name || 'Item'}`, id: item.id });
      refs.push({ val: item.y + item.height, source: 'item', label: `Base com ${item.name || 'Item'}`, id: item.id });
    });

    return refs;
  }

  /**
   * Renderiza as guias no canvas com a estética clássica do Adobe Illustrator (magenta vibrante).
   */
  renderGuidesVisuals(guides, paperSize) {
    if (typeof document === 'undefined') return;
    const canvas = document.getElementById('cm-print-smart-guides-canvas');
    if (!canvas) return;

    const mmToPx = this.canvasEngine.mmToPx;
    const wPx = Math.round(paperSize.width * mmToPx);
    const hPx = Math.round(paperSize.height * mmToPx);

    if (canvas.width !== wPx || canvas.height !== hPx) {
      canvas.width = wPx;
      canvas.height = hPx;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, wPx, hPx);

    if (!guides || guides.length === 0) return;

    // Cores estilo Adobe Illustrator Smart Guides
    // Linha principal: Magenta vivo #ff007f com glow suave
    const GUIDE_COLOR = '#ff007f';
    const GLOW_COLOR = 'rgba(255, 0, 127, 0.25)';
    const BADGE_BG = '#ff007f';
    const BADGE_TXT = '#ffffff';

    guides.forEach(g => {
      ctx.save();

      if (g.type === 'vertical') {
        const xPx = Math.round(g.x * mmToPx);

        // Glow externo
        ctx.strokeStyle = GLOW_COLOR;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(xPx + 0.5, 0);
        ctx.lineTo(xPx + 0.5, hPx);
        ctx.stroke();

        // Linha nítida
        ctx.strokeStyle = GUIDE_COLOR;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(xPx + 0.5, 0);
        ctx.lineTo(xPx + 0.5, hPx);
        ctx.stroke();

        // Rótulo discreto flutuante
        if (g.label) {
          this.drawGuideLabel(ctx, g.label, xPx + 6, Math.min(hPx - 20, 24), BADGE_BG, BADGE_TXT);
        }
      } else if (g.type === 'horizontal') {
        const yPx = Math.round(g.y * mmToPx);

        // Glow externo
        ctx.strokeStyle = GLOW_COLOR;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, yPx + 0.5);
        ctx.lineTo(wPx, yPx + 0.5);
        ctx.stroke();

        // Linha nítida
        ctx.strokeStyle = GUIDE_COLOR;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, yPx + 0.5);
        ctx.lineTo(wPx, yPx + 0.5);
        ctx.stroke();

        // Rótulo discreto flutuante
        if (g.label) {
          this.drawGuideLabel(ctx, g.label, Math.min(wPx - 100, 24), yPx - 8, BADGE_BG, BADGE_TXT);
        }
      }

      ctx.restore();
    });
  }

  /**
   * Desenha balão / badge técnico informativo estilo Illustrator / Figma
   */
  drawGuideLabel(ctx, text, x, y, bg, fg) {
    ctx.save();
    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const metrics = ctx.measureText(text);
    const padX = 6;
    const padY = 3;
    const boxW = metrics.width + padX * 2;
    const boxH = 16;

    // Fundo do badge
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y - boxH + 4, boxW, boxH, 3) : ctx.rect(x, y - boxH + 4, boxW, boxH);
    ctx.fill();

    // Texto
    ctx.fillStyle = fg;
    ctx.fillText(text, x + padX, y - boxH + 15);
    ctx.restore();
  }
}
