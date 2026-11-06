/* ==========================================================================
   ConecteMapas - PrintLegendRenderer
   Responsabilidade Única: desenhar a legenda num Canvas 2D a partir das entradas da
   vista do mapa vinculado (PrintViewResolver.legendEntries). O mesmo desenho vale na
   tela e na exportação. Medidas em mm/pt de papel.
   ========================================================================== */

import { PrintMapRenderer } from './PrintMapRenderer.js';
import { PrintTitleBlockRenderer } from './PrintTitleBlockRenderer.js';

const PT_TO_MM = 0.3528;

export const PrintLegendRenderer = {
  TITLE_MM: 5,
  ROW_MM: 5,
  SWATCH_W_MM: 6,
  SWATCH_H_MM: 3.2,
  PAD_MM: 2,

  /**
   * @param ctx      contexto já posicionado no canto do item (0, 0)
   * @param item     item `legend` (title)
   * @param entries  entradas da vista (PrintViewResolver.legendEntries)
   * @param wMm,hMm  tamanho do item na folha
   * @param pxPerMm  px do contexto por mm de papel
   * @param title    título resolvido ('' = sem título)
   */
  draw(ctx, { entries = [], wMm, hMm, pxPerMm, title = '' }) {
    const mm = (v) => v * pxPerMm;
    const W = mm(wMm);
    const H = mm(hMm);
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(0, 0, W, H);
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();

    let top = 0;
    if (title) {
      const th = Math.min(mm(this.TITLE_MM), H * 0.3);
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, W, th);
      PrintMapRenderer.drawText(ctx, title, W / 2, th / 2, { sizePt: 7, color: '#ffffff', halo: false, align: 'center', bold: true }, pxPerMm);
      top = th;
    }

    if (!entries.length) {
      PrintMapRenderer.drawText(ctx, 'Nenhuma camada visível', W / 2, top + (H - top) / 2, { sizePt: 7, color: '#555555', halo: false }, pxPerMm);
    } else {
      const avail = H - top - mm(this.PAD_MM);
      const row = Math.min(mm(this.ROW_MM), avail / entries.length);
      const sw = Math.min(mm(this.SWATCH_W_MM), row * 1.8);
      const sh = Math.min(mm(this.SWATCH_H_MM), row * 0.7);
      const fontPt = Math.max(4, Math.min(6.5, (row / pxPerMm) / PT_TO_MM * 0.6));
      entries.forEach((e, i) => {
        const cy = top + mm(this.PAD_MM) / 2 + row * (i + 0.5);
        const x0 = mm(this.PAD_MM);
        PrintMapRenderer.drawSwatch(ctx, e.graphics, x0, cy - sh / 2, sw, sh, pxPerMm);
        // Nome que não cabe na caixa é encurtado com "…" (mesmo fonte que drawText usa)
        const textX = x0 + sw + mm(1.5);
        const sizePx = Math.max(1, fontPt * PT_TO_MM * pxPerMm);
        const measure = (t) => {
          ctx.font = `${e.isFilter ? '' : 'bold '}${sizePx}px Arial, Helvetica, sans-serif`;
          return ctx.measureText(t).width;
        };
        const name = PrintTitleBlockRenderer.fitEllipsis(measure, e.name, W - textX - mm(this.PAD_MM), sizePx);
        PrintMapRenderer.drawText(ctx, name, textX, cy, { sizePt: fontPt, color: '#000000', halo: false, align: 'left', bold: !e.isFilter }, pxPerMm);
      });
    }

    ctx.restore();
    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(0.5, mm(0.35));
    ctx.strokeRect(0, 0, W, H);
    ctx.restore();
  }
};
