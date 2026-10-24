/* ==========================================================================
   ConecteMapas - PrintMapRenderer
   Responsabilidade Única: desenhar as feições de um mapa da prancha num contexto
   Canvas 2D a partir dos gráficos resolvidos (PrintViewResolver). O MESMO código
   desenha a prévia na tela (PrintVectorLayer) e a exportação (PrintExporter), então
   tela e PDF saem iguais. Espessuras e textos em mm/pt de papel (`pxPerMm`).
   ========================================================================== */

import { PrintViewResolver } from './PrintViewResolver.js';

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
  draw(ctx, { features = [], layers = [], resolveCtx, project, pxPerMm, bounds = null }) {
    const order = new Map(layers.map((l, i) => [l.id, i]));
    const items = [];
    features.forEach((f, idx) => {
      if (!this.intersects(this.bboxOf(f), bounds)) return;
      const g = PrintViewResolver.resolve(f, resolveCtx);
      if (g) items.push({ f, g, idx, layerOrder: order.has(f.layerId) ? order.get(f.layerId) : layers.length });
    });
    // Camadas de baixo primeiro; dentro da camada, a ordem do projeto
    items.sort((a, b) => (b.layerOrder - a.layerOrder) || (a.idx - b.idx));

    const labels = [];
    for (const { f, g } of items) {
      ctx.save();
      try {
        const anchor = this.drawFeature(ctx, f, g, project, pxPerMm);
        if (anchor && g.label.show) labels.push({ anchor, g, f });
      } finally {
        ctx.restore();
      }
    }
    labels.forEach(l => this.drawLabel(ctx, l, pxPerMm));
    return items.length;
  },

  /** Desenha uma feição e devolve onde o rótulo vai ({ x, y, angle }) */
  drawFeature(ctx, f, g, project, pxPerMm) {
    const mm = (v) => v * pxPerMm;
    const strokeOn = g.stroke.color !== 'none' && g.stroke.widthMm > 0;
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

    if (g.kind === 'polygon') {
      const polys = this.polygonsOf(f.coordinates).map(rings => rings.map(r => r.map(ll => project(ll))));
      if (!polys.length) return null;
      ctx.beginPath();
      polys.forEach(rings => rings.forEach(pts => { tracePath(pts); ctx.closePath(); }));
      if (g.fill.color !== 'none' && g.fill.opacity > 0) {
        if (g.fill.pattern === 'solido' || !g.fill.pattern) {
          ctx.globalAlpha = g.fill.opacity;
          ctx.fillStyle = g.fill.color;
          ctx.fill('evenodd');
          ctx.globalAlpha = 1;
        } else if (g.fill.pattern !== 'nenhum') {
          this.drawHatch(ctx, polys, g, pxPerMm);
        }
      }
      if (strokeOn) {
        applyStroke();
        ctx.stroke();
      }
      return this.polygonAnchor(polys);
    }

    if (g.kind === 'line') {
      const parts = this.linesOf(f.coordinates).map(p => p.map(ll => project(ll)));
      if (!parts.length || !strokeOn) return parts.length ? this.lineAnchor(parts) : null;
      ctx.beginPath();
      parts.forEach(tracePath);
      applyStroke();
      ctx.stroke();
      return this.lineAnchor(parts);
    }

    const ll = this.pointOf(f.coordinates);
    if (!ll) return null;
    const p = project(ll);

    if (g.kind === 'circle') {
      const r = Number(f.radius) > 0 ? Number(f.radius) : 500;
      const edge = project([ll[0] + r / 111320, ll[1]]);
      const rPx = Math.hypot(edge.x - p.x, edge.y - p.y);
      ctx.beginPath();
      ctx.arc(p.x, p.y, rPx, 0, Math.PI * 2);
      if (g.fill.color !== 'none' && g.fill.opacity > 0) {
        ctx.globalAlpha = g.fill.opacity;
        ctx.fillStyle = g.fill.color;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (strokeOn) {
        applyStroke();
        ctx.stroke();
      }
      return { x: p.x, y: p.y, angle: 0 };
    }

    if (g.kind === 'text') {
      const text = String(f.properties?.text ?? f.name ?? '').trim();
      if (text) this.drawText(ctx, text, p.x, p.y, { sizePt: g.text.sizePt, color: g.text.color, halo: g.text.halo, align: 'center' }, pxPerMm);
      return null;
    }

    // Ponto
    const rPx = mm(g.point.sizeMm) / 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, rPx, 0, Math.PI * 2);
    ctx.fillStyle = g.fill.color !== 'none' ? g.fill.color : (g.stroke.color !== 'none' ? g.stroke.color : '#000000');
    ctx.fill();
    ctx.lineWidth = Math.max(0.5, mm(0.18));
    ctx.strokeStyle = '#000000';
    ctx.setLineDash([]);
    ctx.stroke();
    return { x: p.x + rPx + mm(0.8), y: p.y, angle: 0, align: 'left' };
  },

  /** Hachura vetorial recortada no polígono (nítida em qualquer DPI) */
  drawHatch(ctx, polys, g, pxPerMm) {
    const spacing = 1.5 * pxPerMm;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    polys.forEach(rings => rings[0].forEach(pt => {
      minX = Math.min(minX, pt.x); maxX = Math.max(maxX, pt.x);
      minY = Math.min(minY, pt.y); maxY = Math.max(maxY, pt.y);
    }));
    if (!Number.isFinite(minX)) return;
    ctx.save();
    ctx.clip('evenodd');
    ctx.globalAlpha = Math.max(0.15, g.fill.opacity);
    ctx.strokeStyle = g.fill.color;
    ctx.fillStyle = g.fill.color;
    ctx.lineWidth = Math.max(0.5, 0.13 * pxPerMm);
    ctx.setLineDash([]);
    const span = (maxX - minX) + (maxY - minY);
    ctx.beginPath();
    const pattern = g.fill.pattern;
    if (pattern === 'pontos') {
      const r = Math.max(0.4, 0.18 * pxPerMm);
      for (let x = minX; x <= maxX; x += spacing) {
        for (let y = minY; y <= maxY; y += spacing) {
          ctx.moveTo(x + r, y);
          ctx.arc(x, y, r, 0, Math.PI * 2);
        }
      }
      ctx.fill();
    } else {
      if (pattern === 'horizontal') {
        for (let y = minY; y <= maxY; y += spacing) { ctx.moveTo(minX, y); ctx.lineTo(maxX, y); }
      } else {
        for (let d = -span; d <= span; d += spacing) {
          ctx.moveTo(minX + d, maxY); ctx.lineTo(minX + d + (maxY - minY), minY);
          if (pattern === 'hachura-cruzada') { ctx.moveTo(minX + d, minY); ctx.lineTo(minX + d + (maxY - minY), maxY); }
        }
      }
      ctx.stroke();
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
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle, offsetUp: true };
      }
      half -= seg;
    }
    return null;
  },

  drawLabel(ctx, { anchor, g, f }, pxPerMm) {
    const text = PrintViewResolver.labelText(f, g.label.text);
    if (!text) return;
    ctx.save();
    ctx.translate(anchor.x, anchor.y);
    if (anchor.angle) ctx.rotate(anchor.angle);
    const sizePx = g.label.sizePt * PT_TO_MM * pxPerMm;
    const dy = anchor.offsetUp ? -(sizePx * 0.7 + g.stroke.widthMm * pxPerMm) : 0;
    this.drawText(ctx, text, 0, dy, { sizePt: g.label.sizePt, color: g.label.color, halo: g.label.halo, align: anchor.align || 'center' }, pxPerMm);
    ctx.restore();
  },

  /** Texto em pt de papel, multilinha, com halo branco opcional */
  drawText(ctx, text, x, y, { sizePt, color, halo, align = 'center', bold = false }, pxPerMm) {
    const sizePx = Math.max(1, sizePt * PT_TO_MM * pxPerMm);
    const lines = String(text).split('\n');
    ctx.save();
    ctx.font = `${bold ? 'bold ' : ''}${sizePx}px Arial, Helvetica, sans-serif`;
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
    const strokeOn = g.stroke.color !== 'none' && g.stroke.widthMm > 0;
    ctx.setLineDash(g.stroke.dashMm ? g.stroke.dashMm.map(mm) : []);
    if (g.kind === 'line') {
      ctx.beginPath();
      ctx.moveTo(x, y + h / 2);
      ctx.lineTo(x + w, y + h / 2);
      ctx.strokeStyle = strokeOn ? g.stroke.color : '#000000';
      ctx.lineWidth = Math.max(0.5, mm(g.stroke.widthMm || 0.25));
      ctx.stroke();
    } else if (g.kind === 'point' || g.kind === 'text') {
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, Math.min(h / 2, mm(g.point.sizeMm) / 2), 0, Math.PI * 2);
      ctx.fillStyle = g.fill.color !== 'none' ? g.fill.color : g.stroke.color;
      ctx.fill();
      ctx.setLineDash([]);
      ctx.lineWidth = Math.max(0.5, mm(0.18));
      ctx.strokeStyle = '#000000';
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      if (g.fill.color !== 'none' && g.fill.opacity > 0) {
        if (!g.fill.pattern || g.fill.pattern === 'solido') {
          ctx.globalAlpha = g.fill.opacity;
          ctx.fillStyle = g.fill.color;
          ctx.fill();
          ctx.globalAlpha = 1;
        } else if (g.fill.pattern !== 'nenhum') {
          this.drawHatch(ctx, [[[{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }]]], g, pxPerMm);
        }
      }
      if (strokeOn) {
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.strokeStyle = g.stroke.color;
        ctx.lineWidth = Math.max(0.5, mm(g.stroke.widthMm));
        ctx.stroke();
      }
    }
    ctx.restore();
  }
};
