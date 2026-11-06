/* ==========================================================================
   ConecteMapas - PrintTitleBlockRenderer
   Responsabilidade Única: desenhar o carimbo técnico (ABNT NBR 6492 / NBR 13133) num
   Canvas 2D. O MESMO desenho vale na tela e na exportação (antes o PDF tinha outro
   layout e o texto transbordava das células). Medidas em mm/pt de papel; textos que
   não cabem são encurtados com "…".
   ========================================================================== */

import { PrintItemsManager } from './PrintItemsManager.js';

const PT_TO_MM = 0.3528;
const FONT = 'Arial, Helvetica, sans-serif';

export const PrintTitleBlockRenderer = {
  HEADER_MM: 4.2,
  HEADER_PT: 5.6,
  LABEL_PT: 4.1,
  VALUE_PT: 4.9,
  PAD_MM: 0.9,

  /** Células do carimbo, na ordem da tela: [{ label, value, full }] */
  cells(item, projectName = 'Levantamento Cartográfico', mapScale = null, evaluator = null) {
    const p = item?.properties || {};
    const evalText = (val) => (evaluator && typeof evaluator === 'function' ? evaluator(val) : val);
    return [
      { label: 'Projeto / Obra', value: evalText(p.projectName || projectName), full: true },
      { label: 'Proprietário / Cliente', value: evalText(p.client || 'Particular') },
      { label: 'Imóvel / Endereço', value: evalText(p.location || 'Distrito Federal - Brasil') },
      { label: 'Responsável Técnico', value: evalText(p.author || 'Eng. Cartógrafo / Agrimensor') },
      { label: 'Registro / ART', value: evalText(p.art || 'CREA-BR 2026/0012') },
      { label: 'Sistema Geodésico / Datum', value: evalText(p.datum || 'SIRGAS 2000 / UTM') },
      { label: 'Escala Numérica', value: evalText(PrintItemsManager.titleBlockScaleText(p, mapScale)) },
      { label: 'Área / Perímetro', value: evalText(p.areaPerimeter || 'Conforme Tabela') },
      { label: 'Data / Prancha', value: evalText(PrintItemsManager.titleBlockDateText(p)) }
    ];
  },

  headerText(item, evaluator = null) {
    const raw = item?.properties?.headerTitle || 'PLANTA TOPOGRÁFICA / CARTOGRÁFICA';
    return evaluator && typeof evaluator === 'function' ? evaluator(raw) : raw;
  },

  /** Texto que cabe em `maxW` px (encurta com "…") */
  fit(ctx, text, maxW) {
    const s = String(text ?? '');
    if (maxW <= 0) return '';
    if (ctx.measureText(s).width <= maxW) return s;
    let lo = 0, hi = s.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (ctx.measureText(`${s.slice(0, mid)}…`).width <= maxW) lo = mid;
      else hi = mid - 1;
    }
    return lo > 0 ? `${s.slice(0, lo)}…` : '…';
  },

  /**
   * @param ctx      contexto posicionado no canto do item (0, 0)
   * @param wMm,hMm  tamanho do item na folha
   * @param pxPerMm  px do contexto por mm de papel
   * @param evaluator Função opcional de interpolação de expressões dinâmicas (Atlas)
   */
  draw(ctx, { item, projectName, mapScale, wMm, hMm, pxPerMm, evaluator = null }) {
    const mm = (v) => v * pxPerMm;
    const pt = (v) => v * PT_TO_MM * pxPerMm;
    const W = mm(wMm);
    const H = mm(hMm);
    const pad = mm(this.PAD_MM);
    const thin = Math.max(0.5, mm(0.18));

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();

    // Cabeçalho preto com o título
    const headH = Math.min(mm(this.HEADER_MM), H * 0.2);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, headH);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${pt(this.HEADER_PT)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.fit(ctx, this.headerText(item, evaluator).toUpperCase(), W - pad * 2), W / 2, headH / 2);

    // Grade: 1 linha inteira (projeto) + 4 linhas de 2 células
    const cells = this.cells(item, projectName, mapScale, evaluator);
    const rows = 5;
    const rowH = (H - headH) / rows;
    const colW = W / 2;
    const labelPx = Math.min(pt(this.LABEL_PT), rowH * 0.32);
    const valuePx = Math.min(pt(this.VALUE_PT), rowH * 0.4);

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = thin;
    ctx.beginPath();
    for (let r = 0; r < rows; r++) {
      const y = headH + rowH * r;
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.moveTo(colW, headH + rowH);
    ctx.lineTo(colW, H);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    cells.forEach((c, i) => {
      const r = c.full ? 0 : 1 + Math.floor((i - 1) / 2);
      const col = c.full ? 0 : (i - 1) % 2;
      const x = col * colW + pad;
      const cellW = (c.full ? W : colW) - pad * 2;
      const top = headH + rowH * r;
      const gap = (rowH - labelPx - valuePx) / 3;
      ctx.fillStyle = '#555555';
      ctx.font = `bold ${labelPx}px ${FONT}`;
      ctx.fillText(this.fit(ctx, c.label.toUpperCase(), cellW), x, top + gap + labelPx * 0.85);
      ctx.fillStyle = '#000000';
      ctx.font = `bold ${valuePx}px ${FONT}`;
      ctx.fillText(this.fit(ctx, c.value, cellW), x, top + gap * 2 + labelPx + valuePx * 0.85);
    });
    ctx.restore();

    // Moldura
    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(0.5, mm(0.35));
    ctx.strokeRect(0, 0, W, H);
    ctx.restore();
  }
};
