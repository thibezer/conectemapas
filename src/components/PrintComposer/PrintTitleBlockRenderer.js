/* ==========================================================================
   ConecteMapas - PrintTitleBlockRenderer
   Responsabilidade Única: desenhar o carimbo técnico (ABNT NBR 6492 / NBR 13133) num
   Canvas 2D. O MESMO desenho vale na tela e na exportação (tela, PNG e PDF vetorial).
   Medidas em mm/pt de papel.

   Modelo (puro, sem DOM): `cells()` lista os campos; `packRows()` monta a grade (célula
   `full` ocupa a linha; as demais vão de duas em duas); `layoutText()` decide, para cada
   valor, entre caber inteiro, quebrar em até 2 linhas, encolher a fonte ou encurtar com "…".
   ========================================================================== */

import { PrintItemsManager } from './PrintItemsManager.js';

const PT_TO_MM = 0.3528;
const FONT = 'Arial, Helvetica, sans-serif';

export const PrintTitleBlockRenderer = {
  HEADER_MM: 4.8,
  HEADER_PT: 6.2,
  LABEL_PT: 4.0,
  VALUE_PT: 6.4,
  PROJECT_PT: 8.2,
  EMPHASIS_PT: 8.6,
  PAD_MM: 1.1,
  /** Altura (mm) de uma linha de peso 1; base do "ajustar altura ao conteúdo" */
  ROW_MM: 9.2,

  /**
   * Células do carimbo, na ordem da tela.
   * { key, label, value, full?, wrap?, emphasis?, size?, weight?, kind?, caption? }
   * `mapCenter` ([lat, lng] do mapa principal) completa o fuso UTM do datum ("UTM 22S").
   */
  cells(item, projectName = 'Levantamento Cartográfico', mapScale = null, evaluator = null, mapCenter = null) {
    const p = item?.properties || {};
    const ev = (val) => (evaluator && typeof evaluator === 'function' ? evaluator(val) : val);

    const cells = [
      { key: 'project', label: 'Projeto / Obra', value: ev(p.projectName || projectName), full: true, wrap: true, size: 'project', weight: 1.3 },
      { key: 'client', label: 'Proprietário / Cliente', value: ev(p.client || 'Particular'), wrap: true },
      { key: 'location', label: 'Imóvel / Endereço', value: ev(p.location || 'Distrito Federal - Brasil'), wrap: true },
      { key: 'author', label: 'Responsável Técnico', value: ev(p.author || 'Eng. Cartógrafo / Agrimensor'), wrap: true },
      { key: 'art', label: 'Registro / ART', value: ev(p.art || 'CREA-BR 2026/0012'), wrap: true },
      { key: 'datum', label: 'Sistema Geodésico / Datum', value: ev(PrintItemsManager.titleBlockDatumText(p, mapCenter)), wrap: true },
      { key: 'scale', label: 'Escala Numérica', value: ev(PrintItemsManager.titleBlockScaleText(p, mapScale)), emphasis: true }
    ];

    // "30.307,5 m² (3,031 ha) | P: 662,9 m" vira duas células; texto livre fica numa só
    const areaText = ev(p.areaPerimeter || 'Conforme Tabela');
    const split = PrintItemsManager.splitAreaPerimeter(areaText);
    if (split) {
      cells.push(
        { key: 'area', label: 'Área', value: split.area, wrap: true },
        { key: 'perimeter', label: 'Perímetro', value: split.perimeter }
      );
    } else {
      cells.push({ key: 'areaPerimeter', label: 'Área / Perímetro', value: areaText, full: true, wrap: true });
    }

    cells.push(
      { key: 'date', label: 'Data', value: ev(PrintItemsManager.titleBlockDateOnly(p)) },
      { key: 'sheet', label: 'Prancha', value: ev(PrintItemsManager.titleBlockSheetText(p)), emphasis: true }
    );

    // Opcionais: só aparecem quando preenchidos
    const doc = [p.docNumber && `Nº ${p.docNumber}`, p.revision && `Rev. ${p.revision}`].filter(Boolean).join(' · ');
    if (p.drawnBy || doc) {
      cells.push(
        { key: 'drawnBy', label: 'Desenhista / Projetista', value: ev(p.drawnBy || '—'), wrap: true },
        { key: 'doc', label: 'Código / Revisão', value: ev(doc || '—') }
      );
    }
    if (p.showSignature === true) {
      const caption = [ev(p.author || 'Eng. Cartógrafo / Agrimensor'), ev(p.art || '')].filter(Boolean).join(' · ');
      cells.push({ key: 'signature', kind: 'signature', label: 'Assinatura do Responsável Técnico', value: '', caption, full: true, weight: 1.9 });
    }
    return cells;
  },

  /** Agrupa as células em linhas: `full` ocupa a linha; as outras vão em pares (a que sobra ocupa a linha) */
  packRows(cells) {
    const rows = [];
    let pending = null;
    const flush = () => { if (pending) { rows.push([pending]); pending = null; } };
    for (const c of cells) {
      if (c.full) { flush(); rows.push([c]); }
      else if (pending) { rows.push([pending, c]); pending = null; }
      else pending = c;
    }
    flush();
    return rows;
  },

  rowWeight(row) {
    return Math.max(1, ...row.map(c => Number(c.weight) || 1));
  },

  /** Altura (mm) que acomoda todas as linhas com folga confortável */
  idealHeightMm(item, projectName = 'Levantamento Cartográfico') {
    const rows = this.packRows(this.cells(item, projectName));
    const units = rows.reduce((sum, r) => sum + this.rowWeight(r), 0);
    return Math.round((this.HEADER_MM + units * this.ROW_MM) * 2) / 2;
  },

  headerText(item, evaluator = null) {
    const raw = item?.properties?.headerTitle || 'PLANTA TOPOGRÁFICA / CARTOGRÁFICA';
    return evaluator && typeof evaluator === 'function' ? evaluator(raw) : raw;
  },

  /** Preto ou branco, o que contrasta com o fundo `color` (#rgb, #rrggbb ou rgb()) */
  contrastColor(color) {
    const hex = (PrintItemsManager.parseColor(color) || { hex: '#000000' }).hex;
    const n = parseInt(hex.slice(1), 16);
    const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return lum > 0.6 ? '#000000' : '#ffffff';
  },

  /** Encurta `text` com "…" até caber em `maxW`; `measure(texto, tamanho)` devolve a largura */
  fitEllipsis(measure, text, maxW, size) {
    const s = String(text ?? '');
    if (maxW <= 0) return '';
    if (measure(s, size) <= maxW) return s;
    let lo = 0, hi = s.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (measure(`${s.slice(0, mid)}…`, size) <= maxW) lo = mid;
      else hi = mid - 1;
    }
    return lo > 0 ? `${s.slice(0, lo)}…` : '…';
  },

  /** Texto que cabe em `maxW` px (encurta com "…"), medindo com o fonte atual do contexto */
  fit(ctx, text, maxW) {
    return this.fitEllipsis((t) => ctx.measureText(t).width, text, maxW, 0);
  },

  /** Quebra por palavras em até `maxLines` linhas; null se não couber (ou, com `ellipsis`, encurta a última) */
  wrapWords(measure, text, maxW, maxLines, size, ellipsis = false) {
    const words = String(text ?? '').split(' ').filter(Boolean);
    const lines = [];
    let idx = 0;
    while (idx < words.length && lines.length < maxLines) {
      let cur = words[idx];
      if (measure(cur, size) > maxW) { // palavra maior que a linha
        if (!ellipsis) return null;
        lines.push(this.fitEllipsis(measure, cur, maxW, size));
        idx++;
        continue;
      }
      idx++;
      while (idx < words.length && measure(`${cur} ${words[idx]}`, size) <= maxW) { cur += ` ${words[idx]}`; idx++; }
      lines.push(cur);
    }
    if (idx < words.length) { // sobrou texto
      if (!ellipsis) return null;
      const last = lines.length - 1;
      lines[last] = this.fitEllipsis(measure, `${lines[last]} ${words.slice(idx).join(' ')}`, maxW, size);
    }
    return lines.length ? lines : [''];
  },

  /**
   * Decide como o texto entra na célula, em ordem de preferência: (1) uma linha no tamanho cheio,
   * (2) até `maxLines` linhas num tamanho um pouco menor, (3) uma linha encolhida até `minPx`,
   * (4) no mínimo, quebrado com "…" ou, em última instância, uma linha com "…".
   * @returns {{ lines: string[], px: number }}
   */
  layoutText(measure, text, maxW, { px, minPx = px * 0.7, maxLines = 1, availH = Infinity, lineGap = 1.12 } = {}) {
    const s = String(text ?? '').replace(/\s+/g, ' ').trim();
    if (!s) return { lines: [''], px };
    if (maxW <= 0) return { lines: [''], px: minPx };
    if (measure(s, px) <= maxW) return { lines: [s], px };

    const linesAllowed = (size) => Math.max(1, Math.min(maxLines, Math.floor(availH / (size * lineGap)) || 1));

    if (maxLines > 1) {
      const size = Math.max(minPx, px * 0.88);
      for (let n = 2; n <= linesAllowed(size); n++) {
        const lines = this.wrapWords(measure, s, maxW, n, size);
        if (lines) return { lines, px: size };
      }
    }

    const steps = 6;
    for (let i = 1; i <= steps; i++) {
      const size = px - ((px - minPx) * i) / steps;
      if (measure(s, size) <= maxW) return { lines: [s], px: size };
    }

    const n = linesAllowed(minPx);
    if (n > 1) return { lines: this.wrapWords(measure, s, maxW, n, minPx, true), px: minPx };
    return { lines: [this.fitEllipsis(measure, s, maxW, minPx)], px: minPx };
  },

  /**
   * @param ctx      contexto posicionado no canto do item (0, 0)
   * @param wMm,hMm  tamanho do item na folha
   * @param pxPerMm  px do contexto por mm de papel
   * @param mapCenter [lat, lng] do mapa principal (fuso UTM do datum)
   * @param evaluator Função opcional de interpolação de expressões dinâmicas (Atlas)
   */
  draw(ctx, { item, projectName, mapScale, mapCenter = null, wMm, hMm, pxPerMm, evaluator = null }) {
    const mm = (v) => v * pxPerMm;
    const pt = (v) => v * PT_TO_MM * pxPerMm;
    const W = mm(wMm);
    const H = mm(hMm);
    const pad = mm(this.PAD_MM);
    const thin = Math.max(0.5, mm(0.15));
    const p = item?.properties || {};
    const accent = PrintItemsManager.sanitizeColor(p.accentColor, '#000000');

    const measureBold = (t, size) => { ctx.font = `bold ${size}px ${FONT}`; return ctx.measureText(t).width; };
    const measureLight = (t, size) => { ctx.font = `${size}px ${FONT}`; return ctx.measureText(t).width; };

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();

    // Cabeçalho (preto ou na cor de destaque) com o título
    const headH = Math.min(mm(this.HEADER_MM), H * 0.2);
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, W, headH);
    const head = this.layoutText(measureBold, String(this.headerText(item, evaluator)).toUpperCase(), W - pad * 2, { px: Math.min(pt(this.HEADER_PT), headH * 0.62), minPx: headH * 0.34 });
    ctx.fillStyle = this.contrastColor(accent);
    ctx.font = `bold ${head.px}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(head.lines[0], W / 2, headH / 2);

    // Grade
    const rows = this.packRows(this.cells(item, projectName, mapScale, evaluator, mapCenter));
    const units = rows.reduce((sum, r) => sum + this.rowWeight(r), 0) || 1;
    const unitH = (H - headH) / units;
    const geo = [];
    let y = headH;
    rows.forEach(row => {
      const rowH = unitH * this.rowWeight(row);
      geo.push({ row, y, rowH });
      y += rowH;
    });

    // Fundos (campos de destaque: escala e prancha)
    ctx.fillStyle = '#eeeeee';
    geo.forEach(({ row, y: top, rowH }) => {
      const colW = W / row.length;
      row.forEach((c, k) => { if (c.emphasis) ctx.fillRect(k * colW, top, colW, rowH); });
    });

    // Linhas internas
    ctx.strokeStyle = '#555555';
    ctx.lineWidth = thin;
    ctx.beginPath();
    geo.forEach(({ row, y: top, rowH }, i) => {
      if (i > 0) { ctx.moveTo(0, top); ctx.lineTo(W, top); }
      if (row.length === 2) { ctx.moveTo(W / 2, top); ctx.lineTo(W / 2, top + rowH); }
    });
    ctx.stroke();

    // Textos
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    geo.forEach(({ row, y: top, rowH }) => {
      const colW = W / row.length;
      row.forEach((c, k) => {
        const x = k * colW + pad;
        const innerW = colW - pad * 2;
        const labelPx = Math.min(pt(this.LABEL_PT), rowH * 0.24);

        const label = this.layoutText(measureLight, c.label.toUpperCase(), innerW, { px: labelPx, minPx: labelPx * 0.75 });
        ctx.fillStyle = '#5c5c5c';
        ctx.font = `${label.px}px ${FONT}`;
        const labelBase = top + pad * 0.7 + label.px * 0.85;
        ctx.fillText(label.lines[0], x, labelBase);

        if (c.kind === 'signature') {
          const lineY = top + rowH * 0.7;
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = thin;
          ctx.beginPath();
          ctx.moveTo(x + pad * 2, lineY);
          ctx.lineTo(x + innerW - pad * 2, lineY);
          ctx.stroke();
          const cap = this.layoutText(measureLight, c.caption, innerW - pad * 4, { px: labelPx * 1.15, minPx: labelPx * 0.8 });
          ctx.fillStyle = '#333333';
          ctx.font = `${cap.px}px ${FONT}`;
          ctx.textAlign = 'center';
          ctx.fillText(cap.lines[0], x + innerW / 2, lineY + cap.px * 1.35);
          ctx.textAlign = 'left';
          return;
        }

        const kind = c.size === 'project' ? this.PROJECT_PT : (c.emphasis ? this.EMPHASIS_PT : this.VALUE_PT);
        const maxPx = Math.min(pt(kind), rowH * 0.46);
        const zoneTop = top + pad * 0.7 + label.px * 1.3;
        const zoneH = top + rowH - pad * 0.55 - zoneTop;
        const val = this.layoutText(measureBold, c.value, innerW, {
          px: maxPx, minPx: Math.max(maxPx * 0.68, mm(0.8)), maxLines: c.wrap ? 2 : 1, availH: zoneH
        });
        const lineH = val.px * 1.12;
        const startY = zoneTop + (zoneH - lineH * val.lines.length) / 2;
        ctx.fillStyle = '#000000';
        ctx.font = `bold ${val.px}px ${FONT}`;
        val.lines.forEach((ln, i) => ctx.fillText(ln, x, startY + i * lineH + val.px * 0.86));
      });
    });
    ctx.restore();

    // Moldura
    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(0.5, mm(0.4));
    ctx.strokeRect(0, 0, W, H);
    ctx.restore();
  }
};
