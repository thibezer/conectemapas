/* ==========================================================================
   ConecteMapas - PrintViewResolver
   Responsabilidade Única: vista de um mapa da prancha no padrão Revit. Decide, para
   cada feição, se ela aparece e com que gráficos, a partir do estilo do projeto e
   dos ajustes da vista. Puro (sem DOM), usado pela tela, pelo exportador e pela legenda.

   Gráficos, do mais fraco ao mais forte (campo a campo):
     estilo do projeto (FeatureStyle) → camada na vista → filtros (o de cima vence)
     → feição na vista. Meio-tom por último, sobre a cor final.
   Visibilidade: qualquer nível que oculta, oculta. A feição na vista pode reexibir
   o que um filtro escondeu, mas não o que a camada desligou.
   ========================================================================== */

import { FeatureStyle, PX_TO_MM } from '../../services/FeatureStyle.js';
import { FeatureQuery } from '../../services/FeatureQuery.js';
import { BasemapCatalog } from '../../services/BasemapCatalog.js';

/** Série ISO de penas (mm) oferecida na interface */
export const PEN_WIDTHS_MM = [0.13, 0.18, 0.25, 0.35, 0.5, 0.7, 1.0, 1.4];

/** Padrões de linha em múltiplos da espessura (com mínimo em mm) */
export const LINE_PATTERNS = {
  continuo: { label: 'Contínuo', dashMm: null },
  tracejado: { label: 'Tracejado', dashMm: [3, 1.5] },
  pontilhado: { label: 'Pontilhado', dashMm: [0.01, 1] },
  'traco-ponto': { label: 'Traço-ponto', dashMm: [4, 1, 0.01, 1] }
};

export const FILL_PATTERNS = {
  solido: 'Sólido',
  nenhum: 'Sem preenchimento',
  hachura: 'Hachura diagonal',
  'hachura-cruzada': 'Hachura cruzada',
  horizontal: 'Linhas horizontais',
  pontos: 'Pontos'
};

/** Seções que um modelo de vista pode controlar */
export const TEMPLATE_SECTIONS = {
  layers: 'Camadas (visibilidade, gráficos e escala)',
  labels: 'Rótulos',
  filters: 'Filtros',
  basemap: 'Mapa de fundo'
};

export const DEFAULT_LABEL = { show: false, text: '{name}', sizePt: 7, color: '#111111', halo: true };

/** Tamanho do texto do mapa principal (px) -> pt no papel */
const PX_TO_PT = 0.6;
/** Tracejado do mapa principal ("6, 4" em px) -> mm */
const DASH_PX_TO_MM = 0.3;

const isDeleted = (f) => Boolean(f?.is_deleted || f?._deleted || f?.deleted_at);
const has = (o, k) => o && Object.prototype.hasOwnProperty.call(o, k) && o[k] !== undefined;

export const PrintViewResolver = {
  /** Vista vazia (tudo segue o projeto) */
  emptyView() {
    return { templateId: null, followProject: false, layers: {}, labels: {}, filters: [], elements: {} };
  },

  /**
   * Vista do item (`item.viewConfig`; `item.view` é o enquadramento centro/zoom do mapa),
   * criando a estrutura se faltar (itens antigos espelham o projeto até a 1ª edição)
   */
  ensureView(item) {
    if (!item.viewConfig || typeof item.viewConfig !== 'object') {
      item.viewConfig = { ...this.emptyView(), followProject: true };
    }
    const v = item.viewConfig;
    // Mapas (id -> ajuste) precisam ser objetos: uma lista aqui perderia as chaves ao gravar
    const asMap = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? o : {});
    v.layers = asMap(v.layers);
    v.labels = asMap(v.labels);
    v.filters = Array.isArray(v.filters) ? v.filters : [];
    v.elements = asMap(v.elements);
    return v;
  },

  /**
   * Primeira edição de uma vista que ainda espelha o projeto: fotografa a visibilidade
   * atual do projeto como ajustes e passa a ser independente.
   */
  detachFromProject(item, layers, features) {
    const v = this.ensureView(item);
    if (!v.followProject) return false;
    (layers || []).forEach(l => {
      if (l.visible === false) v.layers[l.id] = { ...(v.layers[l.id] || {}), visible: false };
    });
    (features || []).forEach(f => {
      if (f.visible === false && !isDeleted(f)) v.elements[f.id] = { ...(v.elements[f.id] || {}), visible: false };
    });
    v.followProject = false;
    return true;
  },

  /** Vista efetiva: as seções incluídas no modelo vêm dele; as demais, do próprio item */
  effectiveView(item, library) {
    const own = item?.viewConfig && typeof item.viewConfig === 'object' ? item.viewConfig : { ...this.emptyView(), followProject: true };
    const tpl = own.templateId ? (library?.viewTemplates || []).find(t => t.id === own.templateId) : null;
    const pick = (section, fallback) => {
      if (tpl && tpl.include?.[section]) return tpl.view?.[section] ?? fallback;
      return own[section] ?? fallback;
    };
    return {
      template: tpl || null,
      followProject: tpl ? false : own.followProject === true,
      basemap: tpl?.include?.basemap ? BasemapCatalog.normalize(tpl.view?.basemap) : BasemapCatalog.normalize(item?.basemap),
      layers: pick('layers', {}) || {},
      labels: pick('labels', {}) || {},
      filters: pick('filters', []) || [],
      elements: own.elements || {}
    };
  },

  /** A seção está travada por um modelo de vista? */
  isLockedByTemplate(item, library, section) {
    const id = item?.viewConfig?.templateId;
    if (!id) return false;
    const tpl = (library?.viewTemplates || []).find(t => t.id === id);
    return Boolean(tpl?.include?.[section]);
  },

  /** A camada aparece nesta escala (faixa 1:min … 1:max; 0/vazio = sem limite) */
  inScaleRange(layerOverride, scale) {
    if (!layerOverride || !(scale > 0)) return true;
    const min = Number(layerOverride.minScale) || 0;
    const max = Number(layerOverride.maxScale) || 0;
    if (min && scale < min) return false;
    if (max && scale > max) return false;
    return true;
  },

  /**
   * Prepara a resolução de uma vista: casa cada filtro ativo uma vez (Set de ids).
   * `scale` = denominador da escala do mapa.
   */
  prepare(view, { features = [], layers = [], library = null, scale = 0 } = {}) {
    const filterDefs = new Map((library?.filters || []).map(f => [f.id, f]));
    const active = [];
    (view.filters || []).forEach(entry => {
      if (!entry || entry.enabled === false) return;
      const def = filterDefs.get(entry.filterId);
      if (!def) return; // filtro excluído da biblioteca: ignorado
      const scoped = Array.isArray(def.layerIds) && def.layerIds.length
        ? features.filter(f => def.layerIds.includes(f.layerId))
        : features;
      let ids;
      try {
        // Sem critérios, o filtro pega todas as feições das camadas dele (como no Revit)
        ids = new Set(FeatureQuery.run(scoped, def.query || null, { layers }).ids.map(String));
      } catch (e) {
        ids = new Set();
      }
      active.push({ entry, def, ids });
    });
    return {
      view,
      scale,
      layersById: new Map(layers.map(l => [l.id, l])),
      // Ordem da lista = prioridade: o filtro do topo é aplicado por último (vence)
      filters: active
    };
  },

  /** Ajustes que valem para a feição, do mais fraco ao mais forte */
  overridesFor(feat, ctx) {
    const { view } = ctx;
    const out = [];
    const layerOv = view.layers?.[feat.layerId];
    if (layerOv) out.push(layerOv);
    for (let i = ctx.filters.length - 1; i >= 0; i--) {
      if (ctx.filters[i].ids.has(String(feat.id))) out.push(ctx.filters[i].entry);
    }
    const el = view.elements?.[feat.id];
    if (el) out.push(el);
    return out;
  },

  /** A feição aparece nesta vista? */
  isVisible(feat, ctx) {
    if (!feat || isDeleted(feat)) return false;
    const { view } = ctx;
    const layer = ctx.layersById.get(feat.layerId);
    if (view.followProject) {
      if (layer?.visible === false || feat.visible === false) return false;
    }
    const layerOv = view.layers?.[feat.layerId];
    if (layerOv?.visible === false) return false;
    if (!this.inScaleRange(layerOv, ctx.scale)) return false;

    const el = view.elements?.[feat.id];
    if (el && has(el, 'visible')) return el.visible !== false;

    for (const f of ctx.filters) {
      if (f.entry.visible === false && f.ids.has(String(feat.id))) return false;
    }
    return true;
  },

  /**
   * Gráficos finais da feição em unidades de papel, ou null se não aparece:
   * { kind, stroke: { color, widthMm, dashMm }, fill: { color, opacity, pattern },
   *   point: { sizeMm }, text: { color, sizePt, halo }, label: { show, text, sizePt, color, halo }, halftone }
   */
  resolve(feat, ctx) {
    if (!this.isVisible(feat, ctx)) return null;
    const layer = ctx.layersById.get(feat.layerId);
    return this.graphicsOf(feat, layer, this.overridesFor(feat, ctx), ctx.view.labels?.[feat.layerId]);
  },

  /** Gráficos do projeto + ajustes (do mais fraco ao mais forte) + rótulo da camada */
  graphicsOf(feat, layer, overrides = [], labelOv = null) {
    const base = FeatureStyle.base(feat, layer);
    const g = {
      kind: base.kind,
      stroke: {
        color: base.stroke.color,
        widthMm: Math.max(0, base.stroke.width * PX_TO_MM),
        pattern: null,
        dashMm: this.parseDash(base.stroke.dash)
      },
      fill: { color: base.fill.color, opacity: base.fill.opacity, pattern: base.fill.color === 'none' ? 'nenhum' : 'solido' },
      point: { sizeMm: 2.2 },
      text: { color: base.text.color, sizePt: (base.text.size || 14) * PX_TO_PT, halo: base.text.halo },
      label: base.label.show
        ? { ...DEFAULT_LABEL, show: true, text: base.label.field }
        : { ...DEFAULT_LABEL },
      halftone: false
    };

    for (const ov of overrides) this.applyOverride(g, ov);
    if (labelOv) Object.assign(g.label, this.cleanLabel(labelOv));

    if (g.stroke.pattern) g.stroke.dashMm = this.patternDash(g.stroke.pattern, g.stroke.widthMm);
    if (g.fill.pattern === 'nenhum') g.fill.opacity = 0;
    if (g.halftone) this.applyHalftone(g);
    return g;
  },

  /**
   * Gráficos de uma camada para a janela Visibilidade/Gráficos: estilo do projeto (1ª feição
   * da camada, ou a cor da camada) com o ajuste da camada na vista, sem filtros nem feições.
   */
  layerPreview(layer, features, view, { withHalftone = true } = {}) {
    const sample = (features || []).find(f => f.layerId === layer.id && !isDeleted(f))
      || { id: '__amostra', layerId: layer.id, type: 'Polygon', coordinates: [] };
    const ov = view?.layers?.[layer.id];
    const g = this.graphicsOf(sample, layer, ov ? [withHalftone ? ov : { ...ov, halftone: false }] : [], view?.labels?.[layer.id]);
    return g;
  },

  /** Aplica um OverrideGraphics (campos ausentes não mudam nada) */
  applyOverride(g, ov) {
    if (!ov) return;
    const s = ov.stroke || {};
    if (has(s, 'color')) g.stroke.color = s.color;
    if (has(s, 'widthMm')) g.stroke.widthMm = Math.max(0, Number(s.widthMm) || 0);
    if (has(s, 'pattern')) g.stroke.pattern = LINE_PATTERNS[s.pattern] ? s.pattern : 'continuo';
    const f = ov.fill || {};
    if (has(f, 'color')) g.fill.color = f.color;
    if (has(f, 'opacity')) g.fill.opacity = Math.min(1, Math.max(0, Number(f.opacity)));
    if (has(f, 'pattern')) g.fill.pattern = FILL_PATTERNS[f.pattern] ? f.pattern : 'solido';
    if (has(ov, 'halftone')) g.halftone = ov.halftone === true;
    if (has(ov, 'color')) { // atalho: mesma cor no traço e no preenchimento
      g.stroke.color = ov.color;
      g.fill.color = ov.color;
    }
  },

  cleanLabel(l) {
    const out = {};
    if (has(l, 'show')) out.show = l.show === true;
    if (has(l, 'text')) out.text = String(l.text);
    if (has(l, 'sizePt')) out.sizePt = Math.min(48, Math.max(3, Number(l.sizePt) || DEFAULT_LABEL.sizePt));
    if (has(l, 'color')) out.color = l.color;
    if (has(l, 'halo')) out.halo = l.halo !== false;
    return out;
  },

  /** Texto do rótulo a partir do modelo (`{name}`, `Lote {name}\n{Área (m²)} m²`) */
  labelText(feat, template) {
    return FeatureStyle.labelText(feat, template);
  },

  /** "6, 4" (px do mapa principal) -> [mm, mm] */
  parseDash(dash) {
    if (!dash) return null;
    const parts = String(dash).split(/[\s,]+/).map(Number).filter(n => Number.isFinite(n) && n >= 0);
    if (!parts.length || parts.every(n => n === 0)) return null;
    return parts.map(n => n * DASH_PX_TO_MM);
  },

  /** Tracejado do padrão, proporcional à espessura (com mínimo legível) */
  patternDash(pattern, widthMm) {
    const p = LINE_PATTERNS[pattern];
    if (!p || !p.dashMm) return null;
    const k = Math.max(1, widthMm / 0.25);
    return p.dashMm.map(n => n * k);
  },

  applyHalftone(g) {
    const mix = (c) => this.mixWithWhite(c, 0.5);
    if (g.stroke.color !== 'none') g.stroke.color = mix(g.stroke.color);
    if (g.fill.color !== 'none') g.fill.color = mix(g.fill.color);
    g.label.color = mix(g.label.color);
    g.text.color = mix(g.text.color);
  },

  /** Mistura uma cor #hex/rgb() com branco (t = 0..1); cor que não reconhece volta igual */
  mixWithWhite(color, t) {
    const rgb = this.parseRgb(color);
    if (!rgb) return color;
    const m = (v) => Math.round(v + (255 - v) * t);
    return `#${[m(rgb[0]), m(rgb[1]), m(rgb[2])].map(n => n.toString(16).padStart(2, '0')).join('')}`;
  },

  parseRgb(color) {
    const v = typeof color === 'string' ? color.trim() : '';
    let m = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})(?:[0-9a-f]{2})?$/i);
    if (m) {
      const h = m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1];
      const n = parseInt(h, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    m = v.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
  },

  /**
   * Entradas da legenda de um mapa: camadas que aparecem na vista (com o gráfico da vista)
   * e, depois, filtros ativos que mudam a aparência.
   */
  legendEntries(view, { features = [], layers = [], library = null, scale = 0, hiddenLayerIds = [] } = {}) {
    const ctx = this.prepare(view, { features, layers, library, scale });
    const hidden = new Set((hiddenLayerIds || []).map(String));
    const firstVisible = new Map();
    for (const f of features) {
      if (firstVisible.has(f.layerId)) continue;
      if (this.isVisible(f, ctx)) firstVisible.set(f.layerId, f);
    }
    const entries = [];
    layers.forEach(l => {
      if (hidden.has(String(l.id))) return;
      const sample = firstVisible.get(l.id);
      if (!sample) return;
      // Amostra: estilo do projeto + camada na vista (sem filtros nem ajustes por feição)
      const g = this.resolve(sample, { ...ctx, filters: [], view: { ...ctx.view, elements: {} } });
      if (g) entries.push({ id: l.id, name: l.name || 'Camada', kind: g.kind, graphics: g });
    });
    ctx.filters.forEach(({ entry, def, ids }) => {
      if (entry.visible === false || !ids.size || hidden.has(`filter:${def.id}`)) return;
      if (!entry.stroke && !entry.fill && !entry.color && !entry.halftone) return;
      const sample = features.find(f => ids.has(String(f.id)) && this.isVisible(f, ctx));
      if (!sample) return;
      const g = this.resolve(sample, ctx);
      if (g) entries.push({ id: `filter:${def.id}`, name: def.name || 'Filtro', kind: g.kind, graphics: g, isFilter: true });
    });
    return entries;
  }
};
