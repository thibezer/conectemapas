/* ==========================================================================
   ConecteMapas - PrintViewEdits
   Responsabilidade Única: alterações na vista de um mapa (camadas, rótulos, filtros,
   feições) mantendo os ajustes esparsos: valor vazio = volta a herdar. Puro, sem DOM;
   usado pela janela Visibilidade/Gráficos e testado no Node.
   ========================================================================== */

const GRAPHIC_KEYS = ['visible', 'stroke', 'fill', 'halftone', 'color', 'minScale', 'maxScale'];

const isEmptyObj = (o) => !o || (typeof o === 'object' && Object.keys(o).length === 0);

/** Linhas "todas as camadas" e "todos os rótulos" guardam um objeto só, não um mapa por id */
const SINGLE = { defaults: 'layerDefaults', labeldefaults: 'labelDefaults' };
const BUCKET = { layer: 'layers', label: 'labels', element: 'elements' };

export const PrintViewEdits = {
  /** Objeto de ajuste da linha; `create` cria quando falta (filtro só existe se já estiver na vista) */
  target(view, kind, id, create = true) {
    if (kind === 'filter') return (view.filters || []).find(f => f.filterId === id) || null;
    if (SINGLE[kind]) {
      const key = SINGLE[kind];
      if (!view[key] && create) view[key] = {};
      return view[key] || null;
    }
    const bucket = BUCKET[kind];
    if (!bucket) return null;
    view[bucket] = view[bucket] || {};
    if (!view[bucket][id] && create) view[bucket][id] = {};
    return view[bucket][id] || null;
  },

  /**
   * Grava um campo (`stroke.color`, `fill.opacity`, `visible`, `sizePt`...).
   * `null`/'' apaga o campo (herda); objetos e linhas vazias são removidos.
   */
  setField(view, kind, id, path, value) {
    const t = this.target(view, kind, id, true);
    if (!t) return false;
    const [head, leaf] = path.split('.');
    const clear = value === null || value === undefined || value === '';
    if (leaf) {
      if (clear) {
        if (t[head]) delete t[head][leaf];
        if (isEmptyObj(t[head])) delete t[head];
      } else {
        t[head] = { ...(t[head] || {}), [leaf]: value };
      }
    } else if (clear) {
      delete t[head];
    } else {
      t[head] = value;
    }
    this.prune(view, kind, id);
    return true;
  },

  /** Visível: marcado = herda (padrão Revit: visível até desligar); desmarcado = oculto */
  setVisible(view, kind, id, visible) {
    return this.setField(view, kind, id, 'visible', visible ? null : false);
  },

  /** Volta a linha ao projeto; no filtro, mantém o vínculo e o "ativo" */
  reset(view, kind, id) {
    if (kind === 'filter') {
      const f = this.target(view, 'filter', id, false);
      if (!f) return false;
      GRAPHIC_KEYS.forEach(k => delete f[k]);
      return true;
    }
    if (SINGLE[kind]) {
      if (isEmptyObj(view[SINGLE[kind]])) return false;
      view[SINGLE[kind]] = {};
      return true;
    }
    const bucket = BUCKET[kind];
    if (!view[bucket]?.[id]) return false;
    delete view[bucket][id];
    return true;
  },

  /** A linha tem algum ajuste próprio? */
  hasOverride(view, kind, id) {
    const t = this.target(view, kind, id, false);
    if (!t) return false;
    if (kind === 'filter') return GRAPHIC_KEYS.some(k => t[k] !== undefined);
    return !isEmptyObj(t);
  },

  /** Remove a linha vazia (camada, rótulo ou feição sem nenhum ajuste) */
  prune(view, kind, id) {
    if (kind === 'filter' || SINGLE[kind]) return;
    const bucket = BUCKET[kind];
    if (view[bucket] && isEmptyObj(view[bucket][id])) delete view[bucket][id];
  },

  /** Mostrar ou ocultar todas as camadas */
  setAllLayersVisible(view, layers, visible) {
    (layers || []).forEach(l => this.setVisible(view, 'layer', l.id, visible));
  },

  /** Copia a visibilidade das camadas do mapa principal (só visibilidade; gráficos ficam) */
  copyProjectVisibility(view, layers) {
    (layers || []).forEach(l => this.setVisible(view, 'layer', l.id, l.visible !== false));
  },

  // ---------------------------------------------------------------- filtros
  addFilter(view, filterId) {
    view.filters = view.filters || [];
    if (view.filters.some(f => f.filterId === filterId)) return false;
    // Filtro novo entra no topo (maior prioridade), como no Revit ao adicionar e mover
    view.filters.unshift({ filterId, enabled: true });
    return true;
  },

  removeFilter(view, filterId) {
    const before = (view.filters || []).length;
    view.filters = (view.filters || []).filter(f => f.filterId !== filterId);
    return view.filters.length !== before;
  },

  /** Sobe (-1) ou desce (+1) um filtro na prioridade */
  moveFilter(view, filterId, delta) {
    const list = view.filters || [];
    const i = list.findIndex(f => f.filterId === filterId);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return false;
    [list[i], list[j]] = [list[j], list[i]];
    return true;
  },

  setFilterEnabled(view, filterId, enabled) {
    const f = this.target(view, 'filter', filterId, false);
    if (!f) return false;
    f.enabled = enabled !== false;
    return true;
  }
};
