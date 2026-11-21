/* ==========================================================================
   ConecteMapas - PrintDrawing
   Item "Desenho" da prancha (substitui a antiga "Moldura"): os elementos gráficos
   são do `<ui-canvas-prancha>` do kit (modelo, pintor e edição); aqui fica só a cola
   com o layout: onde os dados moram no item, como pintar na tela e no PDF, a migração
   do item `shape` antigo e as operações do painel.

   Modelo do item (`type: 'drawing'`):
   - `elements`: ElementoGrafico[] em mm, com a origem no canto superior esquerdo do ITEM;
   - `base`: { width, height } do item quando os elementos foram desenhados. Redimensionar
     o item estica a geometria (a espessura do traço, em mm, não muda), sem gravar nada;
   - a caixa do item = envelope do desenho (mais o meio traço): o editor reajusta ao concluir.
   ========================================================================== */

import {
  gerarPredefinicao, girarElementos, transformarElemento, escala, translacao, compor,
  limitesNaFolha, meiaEspessura, desenharElementos, TIPO_LINHA_DO_ESTILO
} from '@thibezer/ui-components-kit/prancha';
import { PrintItemsManager } from './PrintItemsManager.js';

/** px de tela por mm a 100% (o `shape` antigo guardava espessura e raio nesta medida) */
const PX_PER_MM = 3.78;
const toMm = (px) => (Number(px) || 0) / PX_PER_MM;
const num = (v, fallback) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : fallback);

/** Estilos de traço do painel ↔ estilos do kit */
const STYLE_OF_LEGACY = { solid: 'continuo', dashed: 'tracejado', dotted: 'pontilhado', dash_dot: 'traco-ponto' };
const LINE_TYPE_TO_STYLE = Object.fromEntries(Object.entries(TIPO_LINHA_DO_ESTILO).map(([estilo, tipo]) => [tipo, estilo]));

/** `shapeType` antigo → pré-definição do kit */
const PRESET_OF_LEGACY = {
  rect: 'retangulo', rounded_rect: 'retangulo-arredondado', double_frame: 'moldura-dupla', ellipse: 'elipse',
  triangle: 'triangulo', diamond: 'losango', line_h: 'linha-horizontal', line_v: 'linha-vertical',
  line_diag: 'linha-diagonal', arrow: 'seta'
};
const LEGACY_LINE_TYPES = new Set(['line_h', 'line_v', 'line_diag', 'arrow']);
/** Campos do `shape` antigo que deixam de existir no item migrado */
const LEGACY_FIELDS = ['shapeType', 'fillColor', 'strokeColor', 'strokeWidth', 'strokeStyle', 'borderRadius', 'rotation', 'arrowHead'];

export class PrintDrawing {
  /** Pré-definições oferecidas no painel (ids do kit) */
  static PRESETS = [
    { value: 'retangulo', label: 'Retângulo' },
    { value: 'retangulo-arredondado', label: 'Retângulo arredondado' },
    { value: 'moldura-dupla', label: 'Moldura dupla (ABNT)' },
    { value: 'elipse', label: 'Elipse' },
    { value: 'circulo', label: 'Círculo' },
    { value: 'triangulo', label: 'Triângulo' },
    { value: 'losango', label: 'Losango' },
    { value: 'linha-horizontal', label: 'Linha horizontal' },
    { value: 'linha-vertical', label: 'Linha vertical' },
    { value: 'linha-diagonal', label: 'Linha diagonal' },
    { value: 'seta', label: 'Seta' },
    { value: 'seta-dupla', label: 'Seta dupla' }
  ];

  /** Traço e preenchimento de partida (o antigo padrão da Moldura: 1,5 px preto, branco a 40%) */
  static DEFAULT_STYLE = { strokeColor: '#000000', strokeMm: toMm(1.5), strokeStyle: 'continuo', fillHex: '#ffffff', fillAlpha: 0.4 };

  // --- Leitura -------------------------------------------------------------------------------------

  /** Elementos na medida atual do item (esticados se o item mudou de tamanho desde `base`) */
  static elementsFor(item) {
    const els = Array.isArray(item?.elements) ? item.elements : [];
    const bw = num(item?.base?.width, item?.width);
    const bh = num(item?.base?.height, item?.height);
    const sx = bw > 0 ? num(item?.width, bw) / bw : 1;
    const sy = bh > 0 ? num(item?.height, bh) / bh : 1;
    if (!els.length || (Math.abs(sx - 1) < 1e-9 && Math.abs(sy - 1) < 1e-9) || !(sx > 0) || !(sy > 0)) return els;
    const m = escala(sx, sy);
    return els.map(el => transformarElemento(el, m));
  }

  /** Elementos na medida atual, com a origem na FOLHA (o editor trabalha na folha inteira) */
  static toSheetElements(item) {
    const m = translacao(num(item?.x, 0), num(item?.y, 0));
    return this.elementsFor(item).map(el => transformarElemento(el, m));
  }

  /**
   * Pinta o desenho num contexto 2D (tela, PNG ou PDF vetorial) com o pintor do kit.
   * `pxPerMm`: px do contexto por mm; `origin`: canto do item em px do contexto.
   */
  static paint(ctx, item, pxPerMm, origin = { x: 0, y: 0 }) {
    const els = this.elementsFor(item);
    if (!els.length || !(pxPerMm > 0)) return null;
    const matriz = compor(escala(pxPerMm), translacao(num(origin.x, 0), num(origin.y, 0)));
    return desenharElementos(ctx, els, { matriz, camadas: item.layers });
  }

  /** Aparência lida do 1º elemento com traço/preenchimento (o painel mostra esta) */
  static styleOf(item) {
    const els = Array.isArray(item?.elements) ? item.elements : [];
    const s = { ...this.DEFAULT_STYLE, fillAlpha: 0, hasStroke: false, hasFill: false };
    const stroked = els.find(el => el.aparencia?.traco);
    if (stroked) {
      const t = stroked.aparencia.traco;
      s.hasStroke = true;
      s.strokeColor = PrintItemsManager.parseColor(t.cor)?.hex || '#000000';
      s.strokeMm = num(t.espessura, 0.25);
      s.strokeStyle = LINE_TYPE_TO_STYLE[t.tipoLinha || 'continua'] || 'continuo';
    } else {
      s.strokeMm = 0;
    }
    const filled = els.find(el => el.aparencia?.preenchimento);
    if (filled) {
      const p = filled.aparencia.preenchimento;
      const c = PrintItemsManager.parseColor(p.cor);
      s.hasFill = true;
      s.fillHex = c?.hex || '#ffffff';
      s.fillAlpha = Math.min(1, Math.max(0, num(p.opacidade, 1) * (c ? c.alpha : 1)));
    }
    return s;
  }

  // --- Geração -------------------------------------------------------------------------------------

  /**
   * Elementos de uma pré-definição dentro de um item `w × h` mm (coordenadas locais). O contorno fica por dentro da
   * caixa (a borda externa do traço encosta nela), como a borda CSS da antiga Moldura.
   * `style`: { strokeColor, strokeMm, strokeStyle, fillHex, fillAlpha, radiusMm, arrowBoth, gapMm, innerMm }
   */
  static buildPreset(tipo, w, h, style = {}, id = 'forma') {
    const st = { ...this.DEFAULT_STYLE, ...style };
    const stroke = Math.max(0, num(st.strokeMm, 0));
    const line = /^(linha|seta)/.test(tipo);
    const inset = line ? Math.max(toMm(1), stroke) : stroke / 2;
    let caixa = { x: inset, y: inset, largura: w - 2 * inset, altura: h - 2 * inset };
    if (!(caixa.largura > 0) || !(caixa.altura > 0)) caixa = { x: 0, y: 0, largura: w, altura: h };
    const fill = num(st.fillAlpha, 0) > 0 && !line;
    const els = gerarPredefinicao(tipo, caixa, {
      id,
      estiloTraco: st.strokeStyle,
      espessura: stroke > 0 ? stroke : undefined,
      corTraco: st.strokeColor,
      corPreenchimento: fill ? st.fillHex : undefined,
      raio: st.radiusMm > 0 ? st.radiusMm : undefined,
      espacamento: st.gapMm > 0 ? st.gapMm : undefined,
      espessuraInterna: st.innerMm > 0 ? st.innerMm : undefined
    });
    return els.map((el, i) => {
      const ap = { ...(el.aparencia || {}) };
      if (stroke <= 0) ap.traco = null;
      // O preenchimento vira cor + opacidade (o painel edita separado); na moldura dupla fica só na externa
      if (ap.preenchimento && (!fill || (tipo === 'moldura-dupla' && i > 0))) ap.preenchimento = null;
      else if (ap.preenchimento) ap.preenchimento = { ...ap.preenchimento, cor: st.fillHex, opacidade: st.fillAlpha };
      if (tipo === 'moldura-dupla' && i === 0 && fill) ap.preenchimento = { cor: st.fillHex, opacidade: st.fillAlpha };
      return { ...el, aparencia: ap };
    });
  }

  /** Conteúdo de partida de um item novo (o retângulo da antiga Moldura), na medida do item */
  static fillDefault(item) {
    item.elements = this.buildPreset('retangulo', item.width, item.height, {}, `${item.id}-el`);
    item.base = { width: item.width, height: item.height };
    return item;
  }

  /** Troca o conteúdo por uma pré-definição, mantendo a aparência atual (traço e preenchimento) */
  static applyPreset(item, tipo) {
    const cur = this.styleOf(item);
    const style = {
      strokeColor: cur.strokeColor, strokeMm: cur.hasStroke ? cur.strokeMm : 0, strokeStyle: cur.strokeStyle,
      fillHex: cur.fillHex, fillAlpha: cur.hasFill ? cur.fillAlpha : 0
    };
    if (/^(linha|seta)/.test(tipo) && !(style.strokeMm > 0)) style.strokeMm = this.DEFAULT_STYLE.strokeMm;
    item.elements = this.buildPreset(tipo, item.width, item.height, style, `${item.id}-el`);
    item.base = { width: item.width, height: item.height };
    return item;
  }

  // --- Aparência em lote (painel do item) ---------------------------------------------------------

  static isClosed(el) {
    const g = el?.geometria;
    if (!g) return false;
    if (g.tipo === 'caminho') return g.geometria?.tipo === 'Polygon';
    return ['retangulo', 'elipse', 'poligono-regular', 'estrela'].includes(g.tipo);
  }

  /**
   * Aplica a TODOS os elementos: { strokeColor, strokeMm, strokeStyle, fillHex, fillAlpha }.
   * A espessura muda por proporção (a moldura dupla mantém a razão entre as linhas).
   */
  static applyStyle(item, patch) {
    const els = Array.isArray(item.elements) ? item.elements : [];
    const ref = els.find(el => el.aparencia?.traco)?.aparencia.traco;
    const refMm = num(ref?.espessura, 0.25);
    item.elements = els.map(el => {
      if (el.mascara) return el;
      const ap = { ...(el.aparencia || {}) };
      if ('strokeMm' in patch) {
        const mm = Math.max(0, num(patch.strokeMm, 0));
        if (mm <= 0) ap.traco = null;
        else if (ap.traco) ap.traco = { ...ap.traco, espessura: refMm > 0 && ref ? Math.max(0.01, num(ap.traco.espessura, refMm) * (mm / refMm)) : mm };
        else if (!ref) ap.traco ={ cor: patch.strokeColor || '#000000', espessura: mm };
      }
      if (ap.traco && 'strokeColor' in patch) ap.traco = { ...ap.traco, cor: patch.strokeColor };
      if (ap.traco && 'strokeStyle' in patch) ap.traco = { ...ap.traco, tipoLinha: TIPO_LINHA_DO_ESTILO[patch.strokeStyle] || 'continua' };
      if ('fillHex' in patch || 'fillAlpha' in patch) {
        const p = ap.preenchimento;
        const alpha = 'fillAlpha' in patch ? Math.min(1, Math.max(0, num(patch.fillAlpha, 0))) : null;
        if (p) {
          ap.preenchimento = { ...p, ...('fillHex' in patch ? { cor: patch.fillHex } : {}), ...(alpha !== null ? { opacidade: alpha } : {}) };
        } else if (alpha > 0 && this.isClosed(el) && !els.some(o => o.aparencia?.preenchimento)) {
          ap.preenchimento = { cor: patch.fillHex || '#ffffff', opacidade: alpha };
        }
      }
      return { ...el, aparencia: ap };
    });
    return item;
  }

  /** Soma `deltaMm` à espessura de todos os traços (atalhos `[` e `]`) */
  static nudgeStroke(item, deltaMm) {
    const cur = this.styleOf(item);
    if (!cur.hasStroke) {
      if (!(deltaMm > 0)) return false;
      this.applyStyle(item, { strokeMm: deltaMm });
      return true;
    }
    const next = Math.max(0, Math.round((cur.strokeMm + deltaMm) * 1000) / 1000);
    if (next === cur.strokeMm) return false;
    this.applyStyle(item, { strokeMm: next });
    return true;
  }

  // --- Caixa do item = envelope do desenho ---------------------------------------------------------

  /** Envelope do desenho com o meio traço e a sombra, em mm; null sem elementos desenháveis */
  static contentBounds(elements) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const el of elements || []) {
      if (el.oculto || el.mascara) continue;
      const box = limitesNaFolha(el);
      if (!box) continue;
      const sh = el.aparencia?.sombra;
      const shadowPad = sh ? Math.max(Math.abs(num(sh.deslocamento?.[0], 1.5)), Math.abs(num(sh.deslocamento?.[1], 1.5))) + 3 * num(sh.desfoque, 1) : 0;
      const pad = meiaEspessura(el) + shadowPad;
      x0 = Math.min(x0, box.x - pad); y0 = Math.min(y0, box.y - pad);
      x1 = Math.max(x1, box.x + box.largura + pad); y1 = Math.max(y1, box.y + box.altura + pad);
    }
    return [x0, y0, x1, y1].every(Number.isFinite) ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : null;
  }

  /**
   * Grava no item os elementos `els` (coordenadas cuja origem está em (`originX`, `originY`) da folha) e reajusta a caixa
   * do item ao desenho (no mínimo `MIN_ITEM_MM`, centrada no desenho). Sem elementos, o item mantém a caixa.
   */
  static commit(item, els, originX = num(item.x, 0), originY = num(item.y, 0)) {
    const bounds = this.contentBounds(els);
    if (!bounds) {
      item.elements = [];
      return item;
    }
    const min = PrintItemsManager.MIN_ITEM_MM;
    const w = Math.max(min, bounds.width);
    const h = Math.max(min, bounds.height);
    const bx = bounds.x - (w - bounds.width) / 2;
    const by = bounds.y - (h - bounds.height) / 2;
    const round = (v) => Math.round(v * 1000) / 1000;
    const m = translacao(-bx, -by);
    item.elements = els.map(el => transformarElemento(el, m));
    item.x = round(originX + bx);
    item.y = round(originY + by);
    item.width = round(w);
    item.height = round(h);
    item.base = { width: item.width, height: item.height };
    return item;
  }

  // --- Migração da antiga Moldura (`shape`) ---------------------------------------------------------

  /** Item `shape` → item `drawing` equivalente (cor, traço, raio, setas e rotação viram elementos do kit) */
  static migrateShape(shape) {
    const w = num(shape.width, 40);
    const h = num(shape.height, 30);
    const legacyType = PRESET_OF_LEGACY[shape.shapeType] ? shape.shapeType : 'rect';
    const strokePx = shape.strokeWidth == null || shape.strokeWidth === '' ? 1.5 : Math.max(0, num(shape.strokeWidth, 0));
    const fill = PrintItemsManager.parseColor(PrintItemsManager.sanitizeColor(shape.fillColor, 'rgba(255, 255, 255, 0.5)'));
    const radiusPx = num(shape.borderRadius, 0);
    const radius = legacyType === 'rounded_rect' && radiusPx === 0 ? 8 : radiusPx;
    let tipo = PRESET_OF_LEGACY[legacyType];
    if (tipo === 'retangulo' && radius > 0) tipo = 'retangulo-arredondado';
    if (legacyType === 'arrow' && shape.arrowHead === 'both') tipo = 'seta-dupla';
    const innerPx = Math.max(0.75, strokePx * 0.55);
    const els = this.buildPreset(tipo, w, h, {
      strokeColor: PrintItemsManager.parseColor(PrintItemsManager.sanitizeColor(shape.strokeColor, '#000000'))?.hex || '#000000',
      strokeMm: toMm(strokePx),
      strokeStyle: STYLE_OF_LEGACY[shape.strokeStyle] || 'continuo',
      fillHex: fill?.hex || '#ffffff',
      fillAlpha: LEGACY_LINE_TYPES.has(legacyType) ? 0 : (fill ? fill.alpha : 0.5),
      radiusMm: toMm(radius),
      gapMm: toMm(Math.max(2, strokePx * 2)),
      innerMm: toMm(innerPx)
    }, `${shape.id}-el`);
    const out = { ...shape, type: 'drawing', name: shape.name || 'Desenho' };
    LEGACY_FIELDS.forEach(k => { delete out[k]; });
    const rot = num(shape.rotation, 0);
    out.elements = els;
    out.base = { width: w, height: h };
    if (rot % 360 !== 0 && els.length) {
      // A rotação antiga girava só o conteúdo (a caixa não mudava): vira rotação dos elementos, e a caixa abraça o resultado
      const rotated = girarElementos(els, (rot * Math.PI) / 180, [w / 2, h / 2]);
      this.commit(out, rotated, num(shape.x, 0), num(shape.y, 0));
    }
    return out;
  }

  /** Converte itens do formato antigo (`shape`) e devolve a lista; o que já é novo passa como está */
  static migrateItems(items) {
    if (!Array.isArray(items)) return [];
    return items.map(it => (it && it.type === 'shape' ? this.migrateShape(it) : it));
  }

  /** Cópia profunda da lista de itens (JSON) já no formato atual: único ponto de carga de pranchas */
  static cloneItems(items) {
    return this.migrateItems(JSON.parse(JSON.stringify(items || [])));
  }
}
