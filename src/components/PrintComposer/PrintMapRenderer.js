/* ==========================================================================
   ConecteMapas - PrintMapRenderer
   Responsabilidade Única: desenhar as feições de um mapa da prancha num contexto
   Canvas 2D a partir dos gráficos resolvidos (PrintViewResolver). O MESMO código
   desenha a prévia na tela (PrintVectorLayer) e a exportação (PrintExporter), então
   tela e PDF saem iguais. Espessuras e textos em mm/pt de papel (`pxPerMm`).
   ========================================================================== */

import { PrintViewResolver, BLEND_MODES, HATCH_DEFAULTS } from './PrintViewResolver.js';
import { PrintFonts } from './PrintFonts.js';

const PT_TO_MM = 0.3528;
const bboxCache = new WeakMap();

/** [lat, lng] de um vértice (array ou {lat, lng}); null se inválido */
function toLL(pt) {
  if (!pt) return null;
  const lat = Number(Array.isArray(pt) ? pt[0] : (pt.lat ?? pt.latitude));
  const lng = Number(Array.isArray(pt) ? pt[1] : (pt.lng ?? pt.longitude));
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
}

const isVertex = (v) => v && (typeof v === 'object') && !Array.isArray(v[0]) && (Array.isArray(v) ? typeof v[0] !== 'object' : true);

/** Profundidade até o vértice: anel = 1, polígono com furos = 2, multipolígono = 3 */
function depth(c) {
  let d = 0;
  let cur = c;
  while (Array.isArray(cur) && cur.length && !isVertex(cur)) {
    d++;
    cur = cur[0];
  }
  return d;
}

export const PrintMapRenderer = {
  /** Polígonos como lista de anéis [[externo, furo...], ...] em [lat, lng] */
  polygonsOf(coords) {
    if (!Array.isArray(coords) || !coords.length) return [];
    const ring = (r) => (Array.isArray(r) ? r.map(toLL).filter(Boolean) : []);
    const d = depth(coords);
    let polys;
    if (d <= 1) polys = [[ring(coords)]];
    else if (d === 2) polys = [coords.map(ring)];
    else polys = coords.map(p => (Array.isArray(p) ? p.map(ring) : []));
    return polys
      .map(rings => rings.filter(r => r.length >= 3))
      .filter(rings => rings.length);
  },

  /** Linhas como lista de partes em [lat, lng] */
  linesOf(coords) {
    if (!Array.isArray(coords) || !coords.length) return [];
    const line = (l) => (Array.isArray(l) ? l.map(toLL).filter(Boolean) : []);
    const parts = depth(coords) <= 1 ? [line(coords)] : coords.map(line);
    return parts.filter(p => p.length >= 2);
  },

  pointOf(coords) {
    if (!coords) return null;
    const direct = toLL(coords);
    if (direct) return direct;
    return Array.isArray(coords) ? toLL(coords[0]) : null;
  },

  /** Caixa [sul, oeste, norte, leste] da geometria (cache pela referência das coordenadas) */
  bboxOf(feat) {
    const c = feat?.coordinates;
    if (!c || typeof c !== 'object') return null;
    if (bboxCache.has(c)) return bboxCache.get(c);
    let s = Infinity, w = Infinity, n = -Infinity, e = -Infinity;
    const visit = (v) => {
      if (!v) return;
      const ll = isVertex(v) ? toLL(v) : null;
      if (ll) {
        if (ll[0] < s) s = ll[0];
        if (ll[0] > n) n = ll[0];
        if (ll[1] < w) w = ll[1];
        if (ll[1] > e) e = ll[1];
      } else if (Array.isArray(v)) v.forEach(visit);
    };
    visit(c);
    let box = Number.isFinite(s) ? [s, w, n, e] : null;
    if (box && feat.type === 'Circle' && Number(feat.radius) > 0) {
      const dLat = Number(feat.radius) / 111320;
      const dLng = dLat / Math.max(0.01, Math.cos(box[0] * Math.PI / 180));
      box = [box[0] - dLat, box[1] - dLng, box[2] + dLat, box[3] + dLng];
    }
    bboxCache.set(c, box);
    return box;
  },

  intersects(box, bounds) {
    if (!bounds || !box) return true;
    return !(box[2] < bounds.south || box[0] > bounds.north || box[3] < bounds.west || box[1] > bounds.east);
  },

  /**
   * Desenha as feições visíveis da vista.
   * opts: { features, layers, resolveCtx, project(latLng) -> {x, y}, pxPerMm, bounds? }
   * Camadas: a primeira da lista fica por cima (mesma ordem do mapa principal).
   */
  draw(ctx, opts) {
    const { items, runs } = this.plan(opts);
    const labels = [];
    runs.forEach(run => labels.push(...this.drawRun(ctx, run, opts)));
    labels.forEach(l => this.drawLabel(ctx, l, opts.pxPerMm));
    return items.length;
  },

  /**
   * Feições visíveis na ordem de desenho, agrupadas em trechos de mesma mesclagem
   * ({ blend, items }). A exportação desenha tudo no mesmo canvas (a mesclagem pega o fundo);
   * a prévia usa um canvas por trecho, com `mix-blend-mode` (PrintVectorLayer).
   */
  plan({ features = [], layers = [], resolveCtx, bounds = null }) {
    const order = new Map(layers.map((l, i) => [l.id, i]));
    const items = [];
    features.forEach((f, idx) => {
      if (!this.intersects(this.bboxOf(f), bounds)) return;
      const g = PrintViewResolver.resolve(f, resolveCtx);
      if (g) items.push({ f, g, idx, layerOrder: order.has(f.layerId) ? order.get(f.layerId) : layers.length });
    });
    // Camadas de baixo primeiro; dentro da camada, a ordem do projeto
    items.sort((a, b) => (b.layerOrder - a.layerOrder) || (a.idx - b.idx));
    const runs = [];
    for (const it of items) {
      const blend = BLEND_MODES[it.g.blend] ? it.g.blend : 'normal';
      const last = runs[runs.length - 1];
      if (last && last.blend === blend) last.items.push(it);
      else runs.push({ blend, items: [it] });
    }
    return { items, runs };
  },

  /**
   * Desenha um trecho e devolve os rótulos pendentes (vão por cima de tudo, sem mesclagem).
   * `applyBlend: false` na prévia: lá a mesclagem é do elemento canvas.
   */
  drawRun(ctx, run, { project, pxPerMm, applyBlend = true }) {
    const labels = [];
    for (const { f, g } of run.items) {
      ctx.save();
      try {
        if (applyBlend && run.blend !== 'normal') ctx.globalCompositeOperation = BLEND_MODES[run.blend].op;
        const anchor = this.drawFeature(ctx, f, g, project, pxPerMm);
        if (anchor && g.label.show) labels.push({ anchor, g, f });
      } finally {
        ctx.restore();
      }
    }
    return labels;
  },

  /**
   * Feição sob o ponto (px do contêiner do mapa), a de cima primeiro; só as que aparecem
   * na vista (ou reveladas). Tolerância em px para linhas e pontos.
   */
  hitTest({ features = [], layers = [], resolveCtx, project, point, tolerance = 6 }) {
    const order = new Map(layers.map((l, i) => [l.id, i]));
    const candidates = [];
    features.forEach((f, idx) => {
      const g = PrintViewResolver.resolve(f, resolveCtx);
      if (g) candidates.push({ f, g, idx, layerOrder: order.has(f.layerId) ? order.get(f.layerId) : layers.length });
    });
    // De cima para baixo: inverso da ordem de desenho
    candidates.sort((a, b) => (a.layerOrder - b.layerOrder) || (b.idx - a.idx));
    const distSeg = (p, a, b) => {
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = dx * dx + dy * dy;
      const t = len ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len)) : 0;
      return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
    };
    const inRing = (p, r) => {
      let inside = false;
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        if ((r[i].y > p.y) !== (r[j].y > p.y) && p.x < ((r[j].x - r[i].x) * (p.y - r[i].y)) / (r[j].y - r[i].y) + r[i].x) inside = !inside;
      }
      return inside;
    };
    for (const { f, g } of candidates) {
      if (g.kind === 'polygon') {
        const polys = this.polygonsOf(f.coordinates).map(rings => rings.map(r => r.map(ll => project(ll))));
        // evenodd: dentro de um número ímpar de anéis (furo não conta)
        if (polys.some(rings => rings.filter(r => inRing(point, r)).length % 2 === 1)) return f;
        if (polys.some(rings => rings.some(r => r.some((pt, i) => distSeg(point, pt, r[(i + 1) % r.length]) <= tolerance)))) return f;
      } else if (g.kind === 'line') {
        const parts = this.linesOf(f.coordinates).map(pts => pts.map(ll => project(ll)));
        if (parts.some(pts => pts.some((pt, i) => i > 0 && distSeg(point, pts[i - 1], pt) <= tolerance))) return f;
      } else {
        const ll = this.pointOf(f.coordinates);
        if (!ll) continue;
        const p = project(ll);
        let r = tolerance + 2;
        if (g.kind === 'circle') {
          const edge = project([ll[0] + (Number(f.radius) > 0 ? Number(f.radius) : 500) / 111320, ll[1]]);
          r = Math.max(r, Math.hypot(edge.x - p.x, edge.y - p.y));
        }
        if (Math.hypot(point.x - p.x, point.y - p.y) <= r) return f;
      }
    }
    return null;
  },

  /** Desenha uma feição e devolve onde o rótulo vai ({ x, y, angle }) */
  drawFeature(ctx, f, g, project, pxPerMm) {
    const mm = (v) => v * pxPerMm;
    const A = Number.isFinite(g.opacity) ? g.opacity : 1; // opacidade geral da feição
    ctx.globalAlpha = A;
    const strokeOn = g.stroke.color !== 'none' && g.stroke.widthMm > 0;
    const casing = g.stroke.casing;
    const casingOn = strokeOn && casing && casing.color && casing.widthMm > 0;
    const applyStroke = () => {
      ctx.strokeStyle = g.stroke.color;
      ctx.lineWidth = Math.max(0.5, mm(g.stroke.widthMm));
      ctx.lineJoin = 'round';
      ctx.lineCap = g.stroke.pattern === 'pontilhado' ? 'round' : 'butt';
      ctx.setLineDash(g.stroke.dashMm ? g.stroke.dashMm.map(mm) : []);
    };
    const tracePath = (pts) => {
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    };
    /** Traço completo: contorno (casing) → fundo do bicolor → traço principal → símbolos ao longo */
    const strokeAll = (trace, partsForDecor, closed) => {
      ctx.lineJoin = 'round';
      ctx.lineCap = 'butt';
      if (casingOn) {
        trace();
        ctx.strokeStyle = casing.color;
        ctx.lineWidth = Math.max(0.5, mm(g.stroke.widthMm + casing.widthMm * 2));
        ctx.setLineDash([]);
        ctx.stroke();
      }
      if (strokeOn && g.stroke.altColor && g.stroke.dashMm) {
        trace();
        ctx.strokeStyle = g.stroke.altColor;
        ctx.lineWidth = Math.max(0.5, mm(g.stroke.widthMm));
        ctx.setLineDash([]);
        ctx.stroke();
      }
      if (strokeOn) {
        trace();
        applyStroke();
        ctx.stroke();
        this.drawDecor(ctx, partsForDecor, g, pxPerMm, closed);
      }
    };

    if (g.kind === 'polygon') {
      const polys = this.polygonsOf(f.coordinates).map(rings => rings.map(r => r.map(ll => project(ll))));
      if (!polys.length) return null;
      const traceOutline = () => {
        ctx.beginPath();
        polys.forEach(rings => rings.forEach(pts => { tracePath(pts); ctx.closePath(); }));
      };
      traceOutline();
      if (g.fill.color !== 'none' && g.fill.opacity > 0) {
        if (g.fill.pattern === 'solido' || !g.fill.pattern) {
          ctx.globalAlpha = A * g.fill.opacity;
          ctx.fillStyle = g.fill.color;
          ctx.fill('evenodd');
          ctx.globalAlpha = A;
        } else if (g.fill.pattern !== 'nenhum') {
          this.drawHatch(ctx, polys, g, pxPerMm);
        }
      }
      strokeAll(traceOutline, polys.flat(), true);
      return this.polygonAnchor(polys);
    }

    if (g.kind === 'line') {
      const parts = this.linesOf(f.coordinates).map(p => p.map(ll => project(ll)));
      if (!parts.length || !strokeOn) return parts.length ? this.lineAnchor(parts) : null;
      strokeAll(() => { ctx.beginPath(); parts.forEach(tracePath); }, parts, false);
      return this.lineAnchor(parts);
    }

    const ll = this.pointOf(f.coordinates);
    if (!ll) return null;
    const p = project(ll);

    if (g.kind === 'circle') {
      const r = Number(f.radius) > 0 ? Number(f.radius) : 500;
      const edge = project([ll[0] + r / 111320, ll[1]]);
      const rPx = Math.hypot(edge.x - p.x, edge.y - p.y);
      const traceCircle = () => { ctx.beginPath(); ctx.arc(p.x, p.y, rPx, 0, Math.PI * 2); };
      traceCircle();
      if (g.fill.color !== 'none' && g.fill.opacity > 0) {
        ctx.globalAlpha = A * g.fill.opacity;
        ctx.fillStyle = g.fill.color;
        ctx.fill();
        ctx.globalAlpha = A;
      }
      if (strokeOn) {
        // Anel como polilinha só para os símbolos ao longo (o traço usa o arco)
        const ring = [];
        const n = 72;
        for (let i = 0; i < n; i++) ring.push({ x: p.x + rPx * Math.cos((i / n) * Math.PI * 2), y: p.y + rPx * Math.sin((i / n) * Math.PI * 2) });
        strokeAll(traceCircle, [ring], true);
      }
      return { x: p.x, y: p.y, angle: 0 };
    }

    if (g.kind === 'text') {
      const text = String(f.properties?.text ?? f.name ?? '').trim();
      if (text) this.drawText(ctx, text, p.x, p.y, { sizePt: g.text.sizePt, color: g.text.color, halo: g.text.halo, align: 'center', font: g.label?.font, bold: g.label?.bold }, pxPerMm);
      return null;
    }

    // Ponto (círculo ou ícone)
    const rPx = mm(g.point.sizeMm) / 2;
    const fill = g.fill.color !== 'none' ? g.fill.color : (g.stroke.color !== 'none' ? g.stroke.color : '#000000');
    this.drawPointIcon(ctx, g.point.icon, p.x, p.y, rPx * 2, fill, Math.max(0.5, mm(0.18)));
    return { x: p.x + rPx + mm(0.8), y: p.y, angle: 0, align: 'left' };
  },

  /**
   * Ícone de ponto centrado em (cx, cy) dentro de uma caixa `size` (px): forma preenchida com
   * a cor e contorno preto fino. Só primitivas do canvas (sem Path2D), iguais na tela e no PDF.
   */
  drawPointIcon(ctx, icon, cx, cy, size, fill, lineW) {
    const s = size;
    ctx.save();
    ctx.setLineDash([]);
    ctx.fillStyle = fill;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = lineW;
    ctx.lineJoin = 'round';
    const poly = (pts) => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(cx + x * s, cy + y * s) : ctx.moveTo(cx + x * s, cy + y * s)));
      ctx.closePath();
    };
    const done = () => { ctx.fill(); ctx.stroke(); };
    switch (icon) {
      case 'quadrado': poly([[-0.45, -0.45], [0.45, -0.45], [0.45, 0.45], [-0.45, 0.45]]); done(); break;
      case 'triangulo': poly([[0, -0.5], [0.5, 0.42], [-0.5, 0.42]]); done(); break;
      case 'losango': poly([[0, -0.55], [0.45, 0], [0, 0.55], [-0.45, 0]]); done(); break;
      case 'estrela': {
        const pts = [];
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const r = i % 2 === 0 ? 0.55 : 0.24;
          pts.push([r * Math.cos(a), r * Math.sin(a)]);
        }
        poly(pts); done();
        break;
      }
      case 'cruz': {
        const t = 0.16;
        poly([[-t, -0.5], [t, -0.5], [t, -t], [0.5, -t], [0.5, t], [t, t], [t, 0.5], [-t, 0.5], [-t, t], [-0.5, t], [-0.5, -t], [-t, -t]]);
        done();
        break;
      }
      case 'x': {
        const t = 0.16;
        const c = [[-t, -0.5], [t, -0.5], [t, -t], [0.5, -t], [0.5, t], [t, t], [t, 0.5], [-t, 0.5], [-t, t], [-0.5, t], [-0.5, -t], [-t, -t]];
        const k = Math.SQRT1_2;
        poly(c.map(([x, y]) => [(x - y) * k, (x + y) * k]));
        done();
        break;
      }
      case 'forte': {
        const pts = [];
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
          pts.push([0.52 * Math.cos(a), 0.52 * Math.sin(a)]);
        }
        poly(pts); done();
        break;
      }
      case 'pino': {
        const r = 0.3 * s;
        const ccy = cy - 0.2 * s;
        const phi = Math.acos(r / (0.7 * s));
        ctx.beginPath();
        ctx.moveTo(cx, cy + 0.5 * s);
        ctx.arc(cx, ccy, r, Math.PI / 2 + phi, Math.PI / 2 - phi + Math.PI * 2, false);
        ctx.closePath();
        done();
        ctx.beginPath();
        ctx.arc(cx, ccy, r * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        break;
      }
      case 'gota': {
        const r = 0.32 * s;
        const ccy = cy + 0.15 * s;
        const phi = Math.acos(r / (0.65 * s));
        ctx.beginPath();
        ctx.moveTo(cx, cy - 0.5 * s);
        ctx.arc(cx, ccy, r, Math.PI * 1.5 - phi, Math.PI * 1.5 + phi, true);
        ctx.closePath();
        done();
        break;
      }
      case 'ponte': {
        // Tabuleiro e dois pilares
        poly([[-0.5, -0.22], [0.5, -0.22], [0.5, 0.02], [-0.5, 0.02]]); done();
        poly([[-0.34, 0.02], [-0.2, 0.02], [-0.2, 0.46], [-0.34, 0.46]]); done();
        poly([[0.2, 0.02], [0.34, 0.02], [0.34, 0.46], [0.2, 0.46]]); done();
        break;
      }
      case 'onibus': {
        poly([[-0.45, -0.42], [0.45, -0.42], [0.45, 0.3], [-0.45, 0.3]]); done();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx - 0.36 * s, cy - 0.32 * s, 0.72 * s, 0.26 * s);
        ctx.fillStyle = '#000000';
        [-0.24, 0.24].forEach(dx => { ctx.beginPath(); ctx.arc(cx + dx * s, cy + 0.34 * s, 0.1 * s, 0, Math.PI * 2); ctx.fill(); });
        break;
      }
      default: // circulo
        ctx.beginPath();
        ctx.arc(cx, cy, s / 2, 0, Math.PI * 2);
        done();
    }
    ctx.restore();
  },

  /** Percorre a polilinha chamando `cb(x, y, ângulo)` a cada `step` px (com teto de chamadas) */
  walkPath(pts, step, cb, maxCalls = 20000) {
    if (!(step > 0) || !pts || pts.length < 2) return;
    let d = step / 2;
    let calls = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (!len) continue;
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      while (d <= len) {
        const t = d / len;
        cb(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, angle);
        if (++calls >= maxCalls) return;
        d += step;
      }
      d -= len;
    }
  },

  /** Símbolos ao longo da linha ou do contorno: travessas (ferrovia, cerca) e dentes (fortificação) */
  drawDecor(ctx, parts, g, pxPerMm, closed) {
    const kind = g.stroke.decor;
    if (!kind || kind === 'nenhum' || !parts?.length) return;
    const mm = (v) => v * pxPerMm;
    const w = g.stroke.widthMm;
    const step = Math.max(3, mm(Math.max(1.6, w * 6)));
    const len = mm(Math.max(1.2, w * 3.5));
    ctx.save();
    ctx.setLineDash([]);
    ctx.strokeStyle = g.stroke.color;
    ctx.fillStyle = g.stroke.color;
    ctx.lineWidth = Math.max(0.5, mm(Math.max(0.13, w * 0.6)));
    ctx.lineCap = 'butt';
    ctx.beginPath();
    parts.forEach(pts => {
      if (!pts || pts.length < 2) return;
      const path = closed ? [...pts, pts[0]] : pts;
      this.walkPath(path, step, (x, y, a) => {
        const nx = -Math.sin(a);
        const ny = Math.cos(a);
        if (kind === 'tracos') {
          ctx.moveTo(x - (nx * len) / 2, y - (ny * len) / 2);
          ctx.lineTo(x + (nx * len) / 2, y + (ny * len) / 2);
        } else {
          const half = step * 0.28;
          const tx = Math.cos(a);
          const ty = Math.sin(a);
          ctx.moveTo(x - tx * half, y - ty * half);
          ctx.lineTo(x + tx * half, y + ty * half);
          ctx.lineTo(x + nx * len, y + ny * len);
          ctx.closePath();
        }
      });
    });
    if (kind === 'tracos') ctx.stroke(); else ctx.fill();
    ctx.restore();
  },

  /** Hachura vetorial recortada no polígono (nítida em qualquer DPI), com ângulo, espaçamento e pena próprios */
  drawHatch(ctx, polys, g, pxPerMm) {
    const hatch = g.fill.hatch || {};
    const pattern = g.fill.pattern;
    const def = HATCH_DEFAULTS[pattern] || { angle: 45, cross: false };
    const customAngle = Number.isFinite(hatch.angle);
    const angle0 = customAngle ? hatch.angle : def.angle;
    const widthPx = Math.max(0.5, (hatch.widthMm > 0 ? hatch.widthMm : 0.13) * pxPerMm);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    polys.forEach(rings => rings[0].forEach(pt => {
      minX = Math.min(minX, pt.x); maxX = Math.max(maxX, pt.x);
      minY = Math.min(minY, pt.y); maxY = Math.max(maxY, pt.y);
    }));
    if (!Number.isFinite(minX)) return;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const R = Math.hypot(maxX - minX, maxY - minY) / 2 + 2;
    // Espaçamento entre linhas (perpendicular); teto de linhas para não travar em polígonos enormes
    let spacing = Math.max(1, (hatch.spacingMm > 0 ? hatch.spacingMm : 1.5) * pxPerMm);
    spacing = Math.max(spacing, (R * 2) / 3000);

    ctx.save();
    ctx.clip('evenodd');
    ctx.globalAlpha = (Number.isFinite(g.opacity) ? g.opacity : 1) * Math.max(0.15, g.fill.opacity);
    ctx.strokeStyle = g.fill.color;
    ctx.fillStyle = g.fill.color;
    ctx.lineWidth = widthPx;
    ctx.setLineDash([]);
    if (pattern === 'pontos') {
      const r = Math.max(0.4, widthPx * 1.4);
      ctx.translate(cx, cy);
      if (customAngle) ctx.rotate((-angle0 * Math.PI) / 180);
      ctx.beginPath();
      for (let x = -R; x <= R; x += spacing) {
        for (let y = -R; y <= R; y += spacing) {
          ctx.moveTo(x + r, y);
          ctx.arc(x, y, r, 0, Math.PI * 2);
        }
      }
      ctx.fill();
    } else {
      const dirs = def.cross ? [angle0, angle0 + 90] : [angle0];
      dirs.forEach(deg => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((-deg * Math.PI) / 180);
        ctx.beginPath();
        for (let y = -R; y <= R; y += spacing) { ctx.moveTo(-R, y); ctx.lineTo(R, y); }
        ctx.stroke();
        ctx.restore();
      });
    }
    ctx.restore();
  },

  /** Centroide de área do maior anel externo (cai na média dos vértices se degenerado) */
  polygonAnchor(polys) {
    let best = null;
    let bestArea = 0;
    polys.forEach(rings => {
      const r = rings[0];
      let a = 0, cx = 0, cy = 0;
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const cross = r[j].x * r[i].y - r[i].x * r[j].y;
        a += cross;
        cx += (r[j].x + r[i].x) * cross;
        cy += (r[j].y + r[i].y) * cross;
      }
      a /= 2;
      if (Math.abs(a) > bestArea) {
        bestArea = Math.abs(a);
        best = { x: cx / (6 * a), y: cy / (6 * a), angle: 0 };
      }
    });
    if (best && Number.isFinite(best.x)) return best;
    const all = polys.flatMap(rings => rings[0]);
    return { x: all.reduce((s, p) => s + p.x, 0) / all.length, y: all.reduce((s, p) => s + p.y, 0) / all.length, angle: 0 };
  },

  /** Meio da parte mais longa, alinhado ao segmento e sempre legível (não fica de cabeça para baixo) */
  lineAnchor(parts) {
    let best = parts[0];
    let bestLen = -1;
    const lenOf = (pts) => pts.reduce((s, p, i) => (i ? s + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) : 0), 0);
    parts.forEach(p => { const l = lenOf(p); if (l > bestLen) { bestLen = l; best = p; } });
    let half = bestLen / 2;
    for (let i = 1; i < best.length; i++) {
      const a = best[i - 1], b = best[i];
      const seg = Math.hypot(b.x - a.x, b.y - a.y);
      if (seg >= half || i === best.length - 1) {
        const t = seg ? Math.min(1, half / seg) : 0;
        let angle = Math.atan2(b.y - a.y, b.x - a.x);
        if (angle > Math.PI / 2) angle -= Math.PI;
        if (angle < -Math.PI / 2) angle += Math.PI;
        // `path`: a parte inteira, para o rótulo que acompanha a curva
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle, offsetUp: true, path: best, pathLen: bestLen };
      }
      half -= seg;
    }
    return null;
  },

  drawLabel(ctx, { anchor, g, f }, pxPerMm) {
    const text = PrintViewResolver.labelText(f, g.label.text);
    if (!text) return;
    const style = { sizePt: g.label.sizePt, color: g.label.color, halo: g.label.halo, font: g.label.font, bold: g.label.bold };
    const sizePx = g.label.sizePt * PT_TO_MM * pxPerMm;
    const lift = sizePx * 0.7 + g.stroke.widthMm * pxPerMm;
    // Chamada: texto deslocado, sem girar, com linha-guia saindo da feição
    const dx = (Number(g.label.dxMm) || 0) * pxPerMm;
    const dy0 = (Number(g.label.dyMm) || 0) * pxPerMm;
    if (dx || dy0) {
      const tx = anchor.x + dx;
      const ty = anchor.y + dy0;
      ctx.save();
      ctx.strokeStyle = g.label.color || '#111111';
      ctx.lineWidth = Math.max(0.5, 0.15 * pxPerMm);
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(anchor.x, anchor.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(anchor.x, anchor.y, Math.max(0.8, 0.35 * pxPerMm), 0, Math.PI * 2);
      ctx.fillStyle = g.label.color || '#111111';
      ctx.fill();
      ctx.restore();
      this.drawText(ctx, text, tx, ty, { ...style, align: 'center' }, pxPerMm);
      return;
    }
    // Linha com rótulo "acompanhar a curva": o texto segue o traçado; se não couber, vai reto como antes
    if (g.label.curved && anchor.path && !String(text).includes('\n') && this.drawCurvedText(ctx, text, anchor.path, anchor.pathLen, { ...style, lift }, pxPerMm)) return;
    ctx.save();
    ctx.translate(anchor.x, anchor.y);
    if (anchor.angle) ctx.rotate(anchor.angle);
    const dy = anchor.offsetUp ? -lift : 0;
    this.drawText(ctx, text, 0, dy, { ...style, align: anchor.align || 'center' }, pxPerMm);
    ctx.restore();
  },

  /**
   * Texto letra a letra ao longo da polilinha, centrado e sempre da esquerda para a direita.
   * Devolve false quando não cabe (o chamador desenha reto).
   */
  drawCurvedText(ctx, text, pts, pathLen, { sizePt, color, halo, font, bold, lift = 0 }, pxPerMm) {
    if (!pts || pts.length < 2) return false;
    const sizePx = Math.max(1, sizePt * PT_TO_MM * pxPerMm);
    const path = pts[pts.length - 1].x < pts[0].x ? [...pts].reverse() : pts;
    const cum = [0];
    for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y));
    const total = cum[cum.length - 1] || pathLen || 0;
    ctx.save();
    ctx.font = `${bold ? 'bold ' : ''}${sizePx}px ${PrintFonts.css(font)}`;
    const chars = Array.from(String(text));
    const widths = chars.map(ch => {
      const m = ctx.measureText ? ctx.measureText(ch) : null;
      return m && Number.isFinite(m.width) ? m.width : sizePx * 0.55;
    });
    const textW = widths.reduce((s, w) => s + w, 0);
    if (!(total > 0) || textW > total * 0.96) { ctx.restore(); return false; }
    const at = (s) => {
      const d = Math.min(total, Math.max(0, s));
      let i = 1;
      while (i < cum.length - 1 && cum[i] < d) i++;
      const segLen = cum[i] - cum[i - 1] || 1;
      const t = (d - cum[i - 1]) / segLen;
      return { x: path[i - 1].x + (path[i].x - path[i - 1].x) * t, y: path[i - 1].y + (path[i].y - path[i - 1].y) * t };
    };
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.setLineDash([]);
    let s = (total - textW) / 2;
    chars.forEach((ch, i) => {
      const w = widths[i];
      const mid = s + w / 2;
      s += w;
      if (ch === ' ') return;
      const p = at(mid);
      // Ângulo médio numa janela do tamanho da letra: curva sem "serrilhado"
      const p0 = at(mid - w / 2);
      const p1 = at(mid + w / 2);
      const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(ang);
      if (halo) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(1, sizePx * 0.28);
        ctx.strokeText(ch, 0, -lift);
      }
      ctx.fillStyle = color || '#111111';
      ctx.fillText(ch, 0, -lift);
      ctx.restore();
    });
    ctx.restore();
    return true;
  },

  /** Texto em pt de papel, multilinha, com halo branco opcional e família de fonte */
  drawText(ctx, text, x, y, { sizePt, color, halo, align = 'center', bold = false, font }, pxPerMm) {
    const sizePx = Math.max(1, sizePt * PT_TO_MM * pxPerMm);
    const lines = String(text).split('\n');
    ctx.save();
    ctx.font = `${bold ? 'bold ' : ''}${sizePx}px ${PrintFonts.css(font)}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.setLineDash([]);
    const lh = sizePx * 1.15;
    const y0 = y - ((lines.length - 1) * lh) / 2;
    lines.forEach((line, i) => {
      const ly = y0 + i * lh;
      if (halo) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(1, sizePx * 0.28);
        ctx.strokeText(line, x, ly);
      }
      ctx.fillStyle = color || '#111111';
      ctx.fillText(line, x, ly);
    });
    ctx.restore();
  },

  /** Amostra da legenda (retângulo, linha ou ponto) dentro da caixa x, y, w, h */
  drawSwatch(ctx, g, x, y, w, h, pxPerMm) {
    ctx.save();
    const mm = (v) => v * pxPerMm;
    const A = Number.isFinite(g.opacity) ? g.opacity : 1;
    ctx.globalAlpha = A;
    const strokeOn = g.stroke.color !== 'none' && g.stroke.widthMm > 0;
    const casing = g.stroke.casing;
    const casingOn = strokeOn && casing && casing.color && casing.widthMm > 0;
    const dash = g.stroke.dashMm ? g.stroke.dashMm.map(mm) : [];
    /** Traço da amostra com contorno, fundo bicolor e símbolos, como no mapa */
    const strokeSwatch = (trace, decorParts, closed) => {
      ctx.lineJoin = 'round';
      if (casingOn) {
        trace();
        ctx.strokeStyle = casing.color;
        ctx.lineWidth = Math.max(0.5, mm((g.stroke.widthMm || 0.25) + casing.widthMm * 2));
        ctx.setLineDash([]);
        ctx.stroke();
      }
      if (strokeOn && g.stroke.altColor && dash.length) {
        trace();
        ctx.strokeStyle = g.stroke.altColor;
        ctx.lineWidth = Math.max(0.5, mm(g.stroke.widthMm || 0.25));
        ctx.setLineDash([]);
        ctx.stroke();
      }
      trace();
      ctx.strokeStyle = strokeOn ? g.stroke.color : '#000000';
      ctx.lineWidth = Math.max(0.5, mm(g.stroke.widthMm || 0.25));
      ctx.setLineDash(dash);
      ctx.stroke();
      ctx.setLineDash([]);
      if (strokeOn) this.drawDecor(ctx, decorParts, g, pxPerMm, closed);
    };
    if (g.kind === 'line') {
      strokeSwatch(() => { ctx.beginPath(); ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2); }, [[{ x, y: y + h / 2 }, { x: x + w, y: y + h / 2 }]], false);
    } else if (g.kind === 'point' || g.kind === 'text') {
      const size = Math.min(h, mm(g.point.sizeMm));
      const fill = g.fill.color !== 'none' ? g.fill.color : g.stroke.color;
      this.drawPointIcon(ctx, g.point.icon, x + w / 2, y + h / 2, size, fill, Math.max(0.5, mm(0.18)));
    } else {
      const rect = () => { ctx.beginPath(); ctx.rect(x, y, w, h); };
      rect();
      if (g.fill.color !== 'none' && g.fill.opacity > 0) {
        if (!g.fill.pattern || g.fill.pattern === 'solido') {
          ctx.globalAlpha = A * g.fill.opacity;
          ctx.fillStyle = g.fill.color;
          ctx.fill();
          ctx.globalAlpha = A;
        } else if (g.fill.pattern !== 'nenhum') {
          this.drawHatch(ctx, [[[{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }]]], g, pxPerMm);
        }
      }
      if (strokeOn) {
        strokeSwatch(rect, [[{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }]], true);
      }
    }
    ctx.restore();
  }
};
