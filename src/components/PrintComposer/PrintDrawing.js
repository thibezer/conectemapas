/* ==========================================================================
   ConecteMapas - PrintDrawing
   Item "Desenho" da prancha (substitui a antiga "Moldura"). Os elementos gráficos são do
   kit (`@thibezer/ui-components-kit/prancha`): modelo, pintor, caixa visual, aparência em
   lote, ajuste à caixa e editor. Aqui fica só a COLA com o layout: onde os dados moram no
   item, a pintura na tela e no PDF e a migração do item `shape` antigo.

   Importa só o NÚCLEO do kit (sem o componente): o editor (`PrintDrawingEditor`) carrega
   o componente sob demanda.

   Modelo do item (`type: 'drawing'`):
   - `elements`: ElementoGrafico[] em mm, com a origem no canto superior esquerdo do ITEM;
   - `base`: { width, height } do item quando os elementos foram desenhados. Redimensionar
     o item estica a geometria (`ajustarElementosACaixa`: a espessura do traço, em mm,
     não muda), sem gravar nada;
   - `layers`: camadas do editor (opcional);
   - a caixa do item = envelope visual do desenho: o editor reajusta ao concluir.
   ========================================================================== */

import {
  gerarPredefinicao, girarElementos, transformarElemento, translacao, escala, compor,
  planejar, desenharPlano, envelopeVisual, normalizarParaOrigem, ajustarElementosACaixa,
  ajustarAparenciaEmLote, resumirAparencia, normalizarElementos, ITENS_PREDEFINICOES
} from '@thibezer/ui-components-kit/prancha/nucleo';
import { PrintItemsManager } from './PrintItemsManager.js';

/** px de tela por mm a 100% (o `shape` antigo guardava espessura e raio nesta medida) */
const PX_PER_MM = 3.78;
const toMm = (px) => (Number(px) || 0) / PX_PER_MM;
const num = (v, fallback) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : fallback);
const round3 = (v) => Math.round(v * 1000) / 1000;

/** Teto de elementos aceitos ao carregar (dado salvo pode vir de fora: nuvem, outro operador) */
export const MAX_DRAWING_ELEMENTS = 5000;

/** Estilos de traço do formato antigo ↔ estilos do kit */
const STYLE_OF_LEGACY = { solid: 'continuo', dashed: 'tracejado', dotted: 'pontilhado', dash_dot: 'traco-ponto' };

/** `shapeType` antigo → pré-definição do kit */
const PRESET_OF_LEGACY = {
  rect: 'retangulo', rounded_rect: 'retangulo-arredondado', double_frame: 'moldura-dupla', ellipse: 'elipse',
  triangle: 'triangulo', diamond: 'losango', line_h: 'linha-horizontal', line_v: 'linha-vertical',
  line_diag: 'linha-diagonal', arrow: 'seta'
};
const LEGACY_LINE_TYPES = new Set(['line_h', 'line_v', 'line_diag', 'arrow']);
/** Campos do `shape` antigo que deixam de existir no item migrado */
const LEGACY_FIELDS = ['shapeType', 'fillColor', 'strokeColor', 'strokeWidth', 'strokeStyle', 'borderRadius', 'rotation', 'arrowHead'];

/** Planos de pintura por lista de elementos (referência) e tamanho do item: repintar no zoom não replaneja */
const planCache = new WeakMap();

export class PrintDrawing {
  /** Pré-definições oferecidas no painel (lista do kit, com os rótulos em pt-BR) */
  static PRESETS = ITENS_PREDEFINICOES.map(p => ({ value: p.valor, label: p.rotulo }));

  /** Traço e preenchimento de partida (o antigo padrão da Moldura: 1,5 px preto, branco a 40%) */
  static DEFAULT_STYLE = { strokeColor: '#000000', strokeMm: toMm(1.5), strokeStyle: 'continuo', fillHex: '#ffffff', fillAlpha: 0.4 };

  // --- Leitura -------------------------------------------------------------------------------------

  /** Elementos na medida atual do item (esticados se o item mudou de tamanho desde `base`) */
  static elementsFor(item) {
    const els = Array.isArray(item?.elements) ? item.elements : [];
    const bw = num(item?.base?.width, item?.width);
    const bh = num(item?.base?.height, item?.height);
    const w = num(item?.width, bw);
    const h = num(item?.height, bh);
    if (!els.length || !(bw > 0) || !(bh > 0) || !(w > 0) || !(h > 0)) return els;
    if (Math.abs(w - bw) < 1e-9 && Math.abs(h - bh) < 1e-9) return els;
    return ajustarElementosACaixa(els, { x: 0, y: 0, largura: bw, altura: bh }, { x: 0, y: 0, largura: w, altura: h }, { escalarTexto: 'tamanho' });
  }

  /** Elementos na medida atual, com a origem na FOLHA (o editor trabalha na folha inteira) */
  static toSheetElements(item) {
    const m = translacao(num(item?.x, 0), num(item?.y, 0));
    return this.elementsFor(item).map(el => transformarElemento(el, m));
  }

  /** Plano de pintura do item: calculado uma vez por lista de elementos e tamanho (não depende do zoom nem da exportação) */
  static planFor(item) {
    const els = Array.isArray(item?.elements) ? item.elements : [];
    if (!els.length) return null;
    const key = `${num(item.width, 0)}x${num(item.height, 0)}`;
    const hit = planCache.get(els);
    if (hit && hit.key === key && hit.layers === item.layers) return hit.plan;
    const plan = planejar(this.elementsFor(item), { camadas: item.layers });
    planCache.set(els, { key, layers: item.layers, plan });
    return plan;
  }

  /**
   * Pinta o desenho num contexto 2D (tela, PNG ou PDF vetorial) com o pintor do kit.
   * `pxPerMm`: px do contexto por mm; `origin`: canto do item em px do contexto.
   */
  static paint(ctx, item, pxPerMm, origin = { x: 0, y: 0 }) {
    const plan = this.planFor(item);
    if (!plan || !(pxPerMm > 0)) return null;
    const matriz = compor(escala(pxPerMm), translacao(num(origin.x, 0), num(origin.y, 0)));
    return desenharPlano(ctx, plan, { matriz });
  }

  /**
   * Aparência do desenho para o painel: a do 1º elemento com traço/preenchimento (o kit informa `misto` quando há
   * diferença; o painel mostra o primeiro valor, como antes).
   */
  static styleOf(item) {
    const els = Array.isArray(item?.elements) ? item.elements : [];
    const s = { ...this.DEFAULT_STYLE, fillAlpha: 0, hasStroke: false, hasFill: false, strokeMm: 0 };
    const stroked = els.find(el => el.aparencia?.traco);
    const filled = els.find(el => el.aparencia?.preenchimento);
    const t = stroked ? resumirAparencia([stroked]).traco : null;
    if (t && t !== 'misto') {
      s.hasStroke = true;
      s.strokeColor = PrintItemsManager.parseColor(t.cor)?.hex || '#000000';
      s.strokeMm = t.espessura;
      s.strokeStyle = t.estilo;
    }
    const f = filled ? resumirAparencia([filled]).preenchimento : null;
    if (f && f !== 'misto') {
      s.hasFill = true;
      s.fillHex = PrintItemsManager.parseColor(f.cor)?.hex || '#ffffff';
      s.fillAlpha = Math.min(1, Math.max(0, f.opacidade));
    }
    return s;
  }

  // --- Geração -------------------------------------------------------------------------------------

  /**
   * Elementos de uma pré-definição dentro de um item `w × h` mm (coordenadas locais). O contorno fica por dentro da
   * caixa (a borda externa do traço encosta nela), como a borda CSS da antiga Moldura.
   * `style`: { strokeColor, strokeMm, strokeStyle, fillHex, fillAlpha, radiusMm, gapMm, innerMm }
   */
  static buildPreset(tipo, w, h, style = {}, id = 'forma') {
    const st = { ...this.DEFAULT_STYLE, ...style };
    const stroke = Math.max(0, num(st.strokeMm, 0));
    const line = /^(linha|seta)/.test(tipo);
    const fill = num(st.fillAlpha, 0) > 0 && !line;
    return gerarPredefinicao(tipo, { x: 0, y: 0, largura: w, altura: h }, {
      id,
      estiloTraco: st.strokeStyle,
      espessura: stroke > 0 ? stroke : undefined,
      semTraco: stroke <= 0,
      corTraco: st.strokeColor,
      corPreenchimento: fill ? st.fillHex : undefined,
      opacidadePreenchimento: fill ? st.fillAlpha : undefined,
      raio: st.radiusMm > 0 ? st.radiusMm : undefined,
      espacamento: st.gapMm > 0 ? st.gapMm : undefined,
      espessuraInterna: st.innerMm > 0 ? st.innerMm : undefined,
      alinhamentoTraco: 'dentro',
      preenchimentoNa: 'externa',
      recuo: line ? Math.max(toMm(1), stroke) : undefined
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

  /**
   * Aplica a TODOS os elementos: { strokeColor, strokeMm, strokeStyle, fillHex, fillAlpha }.
   * A espessura muda por proporção (a moldura dupla mantém a razão entre as linhas).
   */
  static applyStyle(item, patch) {
    const ajuste = {};
    if ('strokeColor' in patch) ajuste.corTraco = patch.strokeColor;
    if ('strokeStyle' in patch) ajuste.estiloTraco = patch.strokeStyle;
    if ('strokeMm' in patch) {
      const mm = Math.max(0, num(patch.strokeMm, 0));
      if (mm <= 0) ajuste.semTraco = true;
      else ajuste.espessura = mm;
    }
    if ('fillHex' in patch) ajuste.corPreenchimento = patch.fillHex;
    if ('fillAlpha' in patch && patch.fillAlpha !== undefined) ajuste.opacidadePreenchimento = Math.min(1, Math.max(0, num(patch.fillAlpha, 0)));
    // Sem traço nenhum, voltar a ter traço usa a cor pedida (ou preto)
    if (ajuste.espessura && !ajuste.corTraco && !(item.elements || []).some(el => el.aparencia?.traco)) ajuste.corTraco = '#000000';
    const els = item.elements || [];
    const opts = { espessura: 'proporcional' };
    const FILL_KEYS = ['corPreenchimento', 'opacidadePreenchimento'];
    const fillPatch = Object.fromEntries(FILL_KEYS.filter(k => k in ajuste).map(k => [k, ajuste[k]]));
    const withFill = els.filter(el => el.aparencia?.preenchimento);
    if (!Object.keys(fillPatch).length || !withFill.length) {
      item.elements = ajustarAparenciaEmLote(els, ajuste, opts);
      return item;
    }
    // Já há preenchimento: o ajuste de cor/opacidade vale só para quem o tem (a moldura dupla não ganha fundo na linha interna)
    const rest = { ...ajuste };
    FILL_KEYS.forEach(k => { delete rest[k]; });
    const base = ajustarAparenciaEmLote(els, rest, opts);
    const filled = new Map(ajustarAparenciaEmLote(base.filter(el => el.aparencia?.preenchimento), fillPatch, opts).map(el => [el.id, el]));
    item.elements = base.map(el => filled.get(el.id) || el);
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
    const next = Math.max(0, round3(cur.strokeMm + deltaMm));
    if (next === round3(cur.strokeMm)) return false;
    this.applyStyle(item, { strokeMm: next });
    return true;
  }

  // --- Caixa do item = envelope visual do desenho ---------------------------------------------------

  /** Envelope visual (traço, pontas, sombra, texto) em mm; null sem elementos desenháveis */
  static contentBounds(elements) {
    const c = envelopeVisual(elements || []);
    return c ? { x: c.x, y: c.y, width: c.largura, height: c.altura } : null;
  }

  /**
   * Grava no item os elementos `els` (coordenadas cuja origem está em (`originX`, `originY`) da folha) e reajusta a caixa
   * do item ao desenho (no mínimo `MIN_ITEM_MM`, centrada no desenho). Sem elementos visíveis o item mantém a caixa.
   */
  static commit(item, els, originX = num(item.x, 0), originY = num(item.y, 0)) {
    const env = envelopeVisual(els || []);
    if (!env) {
      item.elements = Array.isArray(els) ? els.map(e => e) : [];
      return item;
    }
    const { elementos, caixa } = normalizarParaOrigem(els, { minimo: PrintItemsManager.MIN_ITEM_MM });
    item.elements = elementos;
    item.x = round3(originX + env.x - (caixa.largura - env.largura) / 2);
    item.y = round3(originY + env.y - (caixa.altura - env.altura) / 2);
    item.width = round3(caixa.largura);
    item.height = round3(caixa.altura);
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
    const els = this.buildPreset(tipo, w, h, {
      strokeColor: PrintItemsManager.parseColor(PrintItemsManager.sanitizeColor(shape.strokeColor, '#000000'))?.hex || '#000000',
      strokeMm: toMm(strokePx),
      strokeStyle: STYLE_OF_LEGACY[shape.strokeStyle] || 'continuo',
      fillHex: fill?.hex || '#ffffff',
      fillAlpha: LEGACY_LINE_TYPES.has(legacyType) ? 0 : (fill ? fill.alpha : 0.5),
      radiusMm: toMm(radius),
      gapMm: toMm(Math.max(2, strokePx * 2)),
      innerMm: toMm(Math.max(0.75, strokePx * 0.55))
    }, `${shape.id}-el`);
    const out = { ...shape, type: 'drawing', name: shape.name || 'Desenho' };
    LEGACY_FIELDS.forEach(k => { delete out[k]; });
    const rot = num(shape.rotation, 0);
    out.elements = els;
    out.base = { width: w, height: h };
    if (rot % 360 !== 0 && els.length) {
      // A rotação antiga girava só o conteúdo (a caixa não mudava): vira rotação dos elementos, e a caixa abraça o resultado
      this.commit(out, girarElementos(els, (rot * Math.PI) / 180, [w / 2, h / 2]), num(shape.x, 0), num(shape.y, 0));
    }
    return out;
  }

  /**
   * Item `drawing` vindo de fora (nuvem, outro operador, arquivo): elementos validados pelo kit (descarta inválidos e ids
   * repetidos, com teto), `base` e camadas saneados. Item bom passa quase intacto.
   */
  static sanitizeDrawing(item) {
    const raw = Array.isArray(item.elements) ? item.elements.slice(0, MAX_DRAWING_ELEMENTS) : [];
    const { elementos, recusados } = normalizarElementos(raw);
    if (recusados.length) console.warn(`[PrintDrawing] ${recusados.length} elemento(s) descartado(s) em "${item.name || item.id}":`, recusados.slice(0, 5));
    const out = { ...item, elements: elementos };
    const bw = num(item.base?.width, 0);
    const bh = num(item.base?.height, 0);
    out.base = bw > 0 && bh > 0 ? { width: bw, height: bh } : { width: num(item.width, 40), height: num(item.height, 30) };
    if (item.layers !== undefined && !Array.isArray(item.layers)) delete out.layers;
    return out;
  }

  /** Converte itens do formato antigo (`shape`) e valida os `drawing`; o resto passa como está */
  static migrateItems(items) {
    if (!Array.isArray(items)) return [];
    return items.map(it => {
      if (!it || typeof it !== 'object') return it;
      if (it.type === 'shape') return this.migrateShape(it);
      if (it.type === 'drawing') return this.sanitizeDrawing(it);
      return it;
    });
  }

  /** Cópia profunda da lista de itens (JSON) já no formato atual: único ponto de carga de pranchas */
  static cloneItems(items) {
    return this.migrateItems(JSON.parse(JSON.stringify(items || [])));
  }
}
