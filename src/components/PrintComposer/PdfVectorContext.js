/* ==========================================================================
   ConecteMapas - PdfVectorContext
   Responsabilidade Única: implementar o subconjunto de CanvasRenderingContext2D que
   as pranchas usam, mas gravando operadores VETORIAIS de PDF (jsPDF) em vez de pixels.
   Assim o mesmo código de desenho da tela/PNG (PrintMapRenderer, carimbo, legenda,
   formas, rótulos...) gera um PDF com traços, preenchimentos e textos reais (texto
   selecionável, zoom sem perda). Só imagens (tiles do fundo, logotipos) seguem raster.
   Espaço do usuário = px de exportação (y para baixo); a matriz base converte para pt.
   ========================================================================== */

const NAMED_COLORS = {
  black: [0, 0, 0], white: [255, 255, 255], red: [255, 0, 0], green: [0, 128, 0], blue: [0, 0, 255],
  yellow: [255, 255, 0], orange: [255, 165, 0], gray: [128, 128, 128], grey: [128, 128, 128],
  magenta: [255, 0, 255], cyan: [0, 255, 255], purple: [128, 0, 128], brown: [165, 42, 42], pink: [255, 192, 203]
};

const colorCache = new Map();

/** Cor CSS -> { r, g, b, a } (0-255, a 0-1); null = sem cor (none/transparent/inválida vazia) */
export function parseCssColor(input) {
  if (typeof input !== 'string') return { r: 0, g: 0, b: 0, a: 1 };
  const key = input.trim().toLowerCase();
  if (colorCache.has(key)) return colorCache.get(key);
  const out = parseUncached(key);
  if (colorCache.size > 500) colorCache.clear();
  colorCache.set(key, out);
  return out;
}

function parseUncached(s) {
  if (!s || s === 'none' || s === 'transparent') return null;
  let m = /^#([0-9a-f]{3,8})$/.exec(s);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = h.split('').map(c => c + c).join('');
    if (h.length === 6 || h.length === 8) {
      return {
        r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16),
        a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1
      };
    }
  }
  m = /^rgba?\(([^)]+)\)$/.exec(s);
  if (m) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean);
    const ch = (v) => (v.endsWith('%') ? parseFloat(v) * 2.55 : parseFloat(v));
    if (p.length >= 3) {
      const a = p[3] === undefined ? 1 : (p[3].endsWith('%') ? parseFloat(p[3]) / 100 : parseFloat(p[3]));
      return {
        r: clamp(ch(p[0]), 0, 255), g: clamp(ch(p[1]), 0, 255), b: clamp(ch(p[2]), 0, 255),
        a: clamp(Number.isFinite(a) ? a : 1, 0, 1)
      };
    }
  }
  if (NAMED_COLORS[s]) {
    const [r, g, b] = NAMED_COLORS[s];
    return { r, g, b, a: 1 };
  }
  // hsl(), nomes raros etc.: o navegador normaliza para #rrggbb / rgba()
  if (typeof document !== 'undefined') {
    try {
      const c = document.createElement('canvas').getContext('2d');
      c.fillStyle = '#010203';
      c.fillStyle = s;
      const norm = String(c.fillStyle).toLowerCase();
      if (norm !== s && /^(#|rgb)/.test(norm)) return parseUncached(norm);
    } catch (e) { /* cai no padrão */ }
  }
  return { r: 0, g: 0, b: 0, a: 1 };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Número curto para o fluxo do PDF (px do usuário) */
const n = (v) => {
  if (!Number.isFinite(v)) return '0';
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
};
/** Número de alta precisão (matrizes) */
const nm = (v) => {
  if (!Number.isFinite(v)) return '0';
  const r = Math.round(v * 1e8) / 1e8;
  return Object.is(r, -0) ? '0' : r.toFixed(8).replace(/\.?0+$/, '');
};

const IDENTITY = [1, 0, 0, 1, 0, 0];

function mul(m, t) {
  return [
    m[0] * t[0] + m[2] * t[1],
    m[1] * t[0] + m[3] * t[1],
    m[0] * t[2] + m[2] * t[3],
    m[1] * t[2] + m[3] * t[3],
    m[0] * t[4] + m[2] * t[5] + m[4],
    m[1] * t[4] + m[3] * t[5] + m[5]
  ];
}

function invert(m) {
  const det = m[0] * m[3] - m[1] * m[2];
  if (!det) return IDENTITY.slice();
  return [
    m[3] / det, -m[1] / det, -m[2] / det, m[0] / det,
    (m[2] * m[5] - m[3] * m[4]) / det,
    (m[1] * m[4] - m[0] * m[5]) / det
  ];
}

const apply = (m, x, y) => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });

/** Distância da linha de base ao ponto de referência do textBaseline, em fração do tamanho da fonte */
const BASELINE_SHIFT = { alphabetic: 0, top: 0.88, hanging: 0.72, middle: 0.34, ideographic: -0.2, bottom: -0.2 };

/** Caracteres fora do Latin-1 que a codificação WinAnsi dos fontes padrão do PDF não tem */
const TEXT_FALLBACK = { '…': '...', '→': '->', '←': '<-', '≈': '~', '−': '-', '′': "'", '″': '"', '✓': 'v' };

function pdfSafeText(text) {
  return String(text).replace(/\n/g, ' ').replace(/[^\x00-\xFF–—‘’“”•€]/g, (c) => TEXT_FALLBACK[c] ?? '?');
}

export class PdfVectorContext {
  /**
   * @param pdf           instância jsPDF (unit 'mm') com a página alvo já ativa
   * @param pxPerMm       px de exportação por mm de papel (mesma escala do canvas)
   */
  constructor(pdf, { pxPerMm }) {
    this.pdf = pdf;
    this.isVector = true;
    /** true se algum raster (tiles) foi dispensado por restrição de CORS */
    this.rasterBlocked = false;
    this.k = pdf.internal.scaleFactor;
    this.pageH = pdf.internal.pageSize.getHeight();
    this.pxPerMm = pxPerMm;

    this.fillStyle = '#000000';
    this.strokeStyle = '#000000';
    this.lineWidth = 1;
    this.lineJoin = 'miter';
    this.lineCap = 'butt';
    this.globalAlpha = 1;
    this.font = '10px sans-serif';
    this.textAlign = 'left';
    this.textBaseline = 'alphabetic';
    this._dash = [];
    this._path = [];
    this._hasCurrent = false;
    this._cur = { x: 0, y: 0 };
    this._start = { x: 0, y: 0 };

    // user(px, y p/ baixo) -> pt da página (y p/ cima)
    const s = this.k / pxPerMm;
    this._m = [s, 0, 0, -s, 0, this.pageH * this.k];
    this._alpha = { fill: 1, stroke: 1 };
    this._stack = [];
    this._gsKeys = new Set();

    pdf.saveGraphicsState();
    this._write(`${nm(this._m[0])} ${nm(this._m[1])} ${nm(this._m[2])} ${nm(this._m[3])} ${nm(this._m[4])} ${nm(this._m[5])} cm`);
  }

  _write(s) { this.pdf.internal.write(s); }

  /** Fecha todos os save() pendentes e a matriz base: a página fica pronta */
  finish() {
    while (this._stack.length) this.restore();
    this.pdf.restoreGraphicsState();
  }

  // ----- Estado -----------------------------------------------------------

  save() {
    this.pdf.saveGraphicsState();
    this._stack.push({
      m: this._m.slice(), alpha: { ...this._alpha },
      fillStyle: this.fillStyle, strokeStyle: this.strokeStyle, lineWidth: this.lineWidth,
      lineJoin: this.lineJoin, lineCap: this.lineCap, globalAlpha: this.globalAlpha,
      font: this.font, textAlign: this.textAlign, textBaseline: this.textBaseline, dash: this._dash
    });
  }

  restore() {
    const st = this._stack.pop();
    if (!st) return;
    this.pdf.restoreGraphicsState();
    this._m = st.m;
    this._alpha = st.alpha;
    this.fillStyle = st.fillStyle; this.strokeStyle = st.strokeStyle; this.lineWidth = st.lineWidth;
    this.lineJoin = st.lineJoin; this.lineCap = st.lineCap; this.globalAlpha = st.globalAlpha;
    this.font = st.font; this.textAlign = st.textAlign; this.textBaseline = st.textBaseline; this._dash = st.dash;
  }

  setLineDash(arr) {
    const list = Array.isArray(arr) ? arr.filter(v => Number.isFinite(v) && v >= 0) : [];
    this._dash = list.length && list.some(v => v > 0) ? list : [];
  }

  getLineDash() { return this._dash.slice(); }

  // ----- Transformações ---------------------------------------------------

  _concat(t) {
    this._m = mul(this._m, t);
    this._write(`${nm(t[0])} ${nm(t[1])} ${nm(t[2])} ${nm(t[3])} ${nm(t[4])} ${nm(t[5])} cm`);
  }

  translate(x, y) { this._concat([1, 0, 0, 1, x, y]); }
  scale(x, y) { this._concat([x, 0, 0, y, 0, 0]); }
  rotate(a) {
    const c = Math.cos(a), s = Math.sin(a);
    this._concat([c, s, -s, c, 0, 0]);
  }
  transform(a, b, c, d, e, f) { this._concat([a, b, c, d, e, f]); }

  // ----- Caminhos ---------------------------------------------------------

  beginPath() {
    this._path = [];
    this._hasCurrent = false;
  }

  moveTo(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this._path.push(`${n(x)} ${n(y)} m`);
    this._cur = { x, y };
    this._start = { x, y };
    this._hasCurrent = true;
  }

  lineTo(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (!this._hasCurrent) return this.moveTo(x, y);
    this._path.push(`${n(x)} ${n(y)} l`);
    this._cur = { x, y };
  }

  closePath() {
    if (!this._hasCurrent) return;
    this._path.push('h');
    this._cur = { ...this._start };
  }

  rect(x, y, w, h) {
    if (![x, y, w, h].every(Number.isFinite)) return;
    this._path.push(`${n(x)} ${n(y)} ${n(w)} ${n(h)} re`);
    this._cur = { x, y };
    this._start = { x, y };
    this._hasCurrent = true;
  }

  bezierCurveTo(c1x, c1y, c2x, c2y, x, y) {
    if (![c1x, c1y, c2x, c2y, x, y].every(Number.isFinite)) return;
    if (!this._hasCurrent) this.moveTo(c1x, c1y);
    this._path.push(`${n(c1x)} ${n(c1y)} ${n(c2x)} ${n(c2y)} ${n(x)} ${n(y)} c`);
    this._cur = { x, y };
  }

  quadraticCurveTo(cx, cy, x, y) {
    if (!this._hasCurrent) this.moveTo(cx, cy);
    const p0 = this._cur;
    this.bezierCurveTo(
      p0.x + (2 / 3) * (cx - p0.x), p0.y + (2 / 3) * (cy - p0.y),
      x + (2 / 3) * (cx - x), y + (2 / 3) * (cy - y), x, y
    );
  }

  /** Arco em até 4 curvas de Bézier por volta (erro < 0,03%) */
  arc(cx, cy, r, a0, a1, ccw = false) {
    if (![cx, cy, r, a0, a1].every(Number.isFinite) || r < 0) return;
    const TAU = Math.PI * 2;
    let sweep = a1 - a0;
    if (!ccw) {
      if (sweep >= TAU) sweep = TAU;
      else while (sweep < 0) sweep += TAU;
    } else {
      if (sweep <= -TAU) sweep = -TAU;
      else while (sweep > 0) sweep -= TAU;
    }
    const sx = cx + r * Math.cos(a0);
    const sy = cy + r * Math.sin(a0);
    if (this._hasCurrent) this.lineTo(sx, sy);
    else this.moveTo(sx, sy);
    if (r === 0 || sweep === 0) return;

    const segs = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2) - 1e-9));
    const step = sweep / segs;
    const t = (4 / 3) * Math.tan(step / 4);
    let a = a0;
    for (let i = 0; i < segs; i++) {
      const b = a + step;
      const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
      this.bezierCurveTo(
        cx + r * (ca - t * sa), cy + r * (sa + t * ca),
        cx + r * (cb + t * sb), cy + r * (sb - t * cb),
        cx + r * cb, cy + r * sb
      );
      a = b;
    }
  }

  // ----- Pintura ----------------------------------------------------------

  _color(style) { return parseCssColor(style); }

  _setFillColor(c) { this._write(`${nm(c.r / 255)} ${nm(c.g / 255)} ${nm(c.b / 255)} rg`); }
  _setStrokeColor(c) { this._write(`${nm(c.r / 255)} ${nm(c.g / 255)} ${nm(c.b / 255)} RG`); }

  /** Opacidade de preenchimento (ca) e de traço (CA) via ExtGState, só quando muda */
  _setAlpha(fill, stroke) {
    const f = Math.round(clamp(fill, 0, 1) * 1000) / 1000;
    const s = Math.round(clamp(stroke, 0, 1) * 1000) / 1000;
    if (f === this._alpha.fill && s === this._alpha.stroke) return;
    const key = `A${f}_${s}`;
    if (!this._gsKeys.has(key)) {
      this.pdf.addGState(key, new this.pdf.GState({ opacity: f, 'stroke-opacity': s }));
      this._gsKeys.add(key);
    }
    this.pdf.setGState(key);
    this._alpha = { fill: f, stroke: s };
  }

  _applyStrokeStyle() {
    this._write(`${n(Math.max(0, this.lineWidth))} w`);
    this._write(`${{ round: 1, bevel: 2 }[this.lineJoin] ?? 0} j`);
    this._write(`${{ round: 1, square: 2 }[this.lineCap] ?? 0} J`);
    this._write(this._dash.length ? `[${this._dash.map(n).join(' ')}] 0 d` : '[] 0 d');
  }

  _emitPath() { if (this._path.length) this._write(this._path.join('\n')); }

  fill(rule) {
    const c = this._color(this.fillStyle);
    if (!c || !this._path.length) return;
    const a = c.a * this.globalAlpha;
    if (a <= 0) return;
    this._setAlpha(a, this._alpha.stroke);
    this._setFillColor(c);
    this._emitPath();
    this._write(rule === 'evenodd' ? 'f*' : 'f');
  }

  stroke() {
    const c = this._color(this.strokeStyle);
    if (!c || !this._path.length || !(this.lineWidth > 0)) return;
    const a = c.a * this.globalAlpha;
    if (a <= 0) return;
    this._setAlpha(this._alpha.fill, a);
    this._setStrokeColor(c);
    this._applyStrokeStyle();
    this._emitPath();
    this._write('S');
  }

  clip(rule) {
    if (!this._path.length) return;
    this._emitPath();
    this._write(rule === 'evenodd' ? 'W* n' : 'W n');
  }

  fillRect(x, y, w, h) {
    const keep = [this._path, this._hasCurrent, this._cur, this._start];
    this.beginPath();
    this.rect(x, y, w, h);
    this.fill();
    [this._path, this._hasCurrent, this._cur, this._start] = keep;
  }

  strokeRect(x, y, w, h) {
    const keep = [this._path, this._hasCurrent, this._cur, this._start];
    this.beginPath();
    this.rect(x, y, w, h);
    this.stroke();
    [this._path, this._hasCurrent, this._cur, this._start] = keep;
  }

  // ----- Texto ------------------------------------------------------------

  _parseFont() {
    const m = /^(.*?)([\d.]+)px\s*(.*)$/.exec(this.font.trim());
    const prefix = (m ? m[1] : '').toLowerCase();
    const sizePx = m ? parseFloat(m[2]) : 10;
    const family = ((m ? m[3] : '').split(',')[0] || '').replace(/['"]/g, '').trim().toLowerCase();
    const bold = /\bbold\b|\b[6-9]00\b/.test(prefix);
    const italic = /\bitalic\b|\boblique\b/.test(prefix);
    let name = 'helvetica';
    if (/mono|courier|consolas/.test(family)) name = 'courier';
    else if (/times|georgia|^serif$/.test(family)) name = 'times';
    return { name, style: bold ? (italic ? 'bolditalic' : 'bold') : (italic ? 'italic' : 'normal'), sizePx };
  }

  /** Aplica o fonte atual no jsPDF e devolve o tamanho em px do usuário */
  _useFont() {
    const f = this._parseFont();
    this.pdf.setFont(f.name, f.style);
    // fonte em pt = px do usuário × (pt por px do usuário); o jsPDF recebe o tamanho em pt
    const ptPerPx = Math.hypot(this._m[0], this._m[1]);
    this.pdf.setFontSize(Math.max(0.1, f.sizePx * ptPerPx));
    return f.sizePx;
  }

  measureText(text) {
    const sizePx = this._useFont();
    const em = this.pdf.getStringUnitWidth(pdfSafeText(text));
    return { width: em * sizePx };
  }

  fillText(text, x, y) { this._text(text, x, y, false); }
  strokeText(text, x, y) { this._text(text, x, y, true); }

  _text(text, x, y, stroked) {
    const str = pdfSafeText(text ?? '');
    if (!str.trim() || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const c = this._color(stroked ? this.strokeStyle : this.fillStyle);
    if (!c) return;
    const a = c.a * this.globalAlpha;
    if (a <= 0) return;

    const sizePx = this._useFont();
    const em = this.pdf.getStringUnitWidth(str);
    const width = em * sizePx;
    const shiftX = this.textAlign === 'center' ? -width / 2 : (this.textAlign === 'right' || this.textAlign === 'end' ? -width : 0);
    const shiftY = (BASELINE_SHIFT[this.textBaseline] ?? 0) * sizePx;
    const p = apply(this._m, x + shiftX, y + shiftY);
    const angle = (Math.atan2(this._m[1], this._m[0]) * 180) / Math.PI;

    if (stroked) this._setAlpha(this._alpha.fill, a);
    else this._setAlpha(a, this._alpha.stroke);

    // O jsPDF escreve texto no espaço padrão da página: desfaz a matriz acumulada só aqui
    const inv = invert(this._m);
    this.pdf.saveGraphicsState();
    this._write(`${nm(inv[0])} ${nm(inv[1])} ${nm(inv[2])} ${nm(inv[3])} ${nm(inv[4])} ${nm(inv[5])} cm`);
    const opts = { baseline: 'alphabetic' };
    if (Math.abs(angle) > 1e-6) opts.angle = angle;
    if (stroked) {
      const ptPerPx = Math.hypot(this._m[0], this._m[1]);
      this.pdf.setDrawColor(c.r, c.g, c.b);
      this.pdf.setLineWidth(Math.max(0, this.lineWidth) * ptPerPx / this.k);
      this._write(`${{ round: 1, bevel: 2 }[this.lineJoin] ?? 0} j`);
      opts.renderingMode = 'stroke';
    } else {
      this.pdf.setTextColor(c.r, c.g, c.b);
    }
    this.pdf.text(str, p.x / this.k, this.pageH - p.y / this.k, opts);
    this.pdf.restoreGraphicsState();
  }

  // ----- Imagens (raster) -------------------------------------------------

  /** Imagem/canvas -> data URL. Lança SecurityError se estiver "sujo" por CORS */
  _encodeRaster(src) {
    if (typeof HTMLCanvasElement !== 'undefined' && src instanceof HTMLCanvasElement) {
      const opaque = src._opaque === true;
      return { data: src.toDataURL(opaque ? 'image/jpeg' : 'image/png', 0.92), format: opaque ? 'JPEG' : 'PNG' };
    }
    const w = src.naturalWidth || src.width;
    const h = src.naturalHeight || src.height;
    if (!w || !h) return null;
    const k = Math.min(1, 4096 / Math.max(w, h));
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(w * k));
    cv.height = Math.max(1, Math.round(h * k));
    cv.getContext('2d').drawImage(src, 0, 0, cv.width, cv.height);
    return { data: cv.toDataURL('image/png'), format: 'PNG' };
  }

  drawImage(src, dx, dy, dw, dh) {
    if (arguments.length < 5) throw new Error('PdfVectorContext.drawImage exige (imagem, x, y, largura, altura).');
    if (![dx, dy, dw, dh].every(Number.isFinite) || dw === 0 || dh === 0) return;
    const enc = this._encodeRaster(src); // antes de emitir qualquer operador: falha sem sujar a página
    if (!enc) return;
    const p0 = apply(this._m, dx, dy);
    const p1 = apply(this._m, dx + dw, dy + dh);
    const xMm = Math.min(p0.x, p1.x) / this.k;
    const yMm = this.pageH - Math.max(p0.y, p1.y) / this.k;
    const wMm = Math.abs(p1.x - p0.x) / this.k;
    const hMm = Math.abs(p1.y - p0.y) / this.k;

    this._setAlpha(this.globalAlpha, this._alpha.stroke);
    const inv = invert(this._m);
    this.pdf.saveGraphicsState();
    this._write(`${nm(inv[0])} ${nm(inv[1])} ${nm(inv[2])} ${nm(inv[3])} ${nm(inv[4])} ${nm(inv[5])} cm`);
    this.pdf.addImage(enc.data, enc.format, xMm, yMm, wMm, hMm, undefined, 'FAST');
    this.pdf.restoreGraphicsState();
  }
}
