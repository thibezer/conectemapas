/* ==========================================================================
   ConecteMapas - PrintViewTemplates
   Responsabilidade Única: modelos de vista (View Templates do Revit). Modelos prontos
   (acadêmico e urbano), modelos do projeto (biblioteca) e as operações de vincular,
   aplicar uma vez, desvincular e salvar a vista como modelo. Puro, sem DOM.

   Um modelo guarda as seções que controla (`include`) e os valores delas (`view`):
     layers  -> view.layers + view.layerDefaults (gráficos de todas as camadas)
     labels  -> view.labels + view.labelDefaults
     filters -> view.filters
     basemap -> view.basemap
   ========================================================================== */

const clone = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));

export const ALL_SECTIONS = { layers: true, labels: true, filters: true, basemap: true };

/** Modelos prontos: valem para qualquer projeto (gráficos gerais, sem depender de ids de camadas) */
export const BUILTIN_TEMPLATES = [
  {
    id: 'builtin:academico-tematico',
    name: 'Acadêmico — mapa temático',
    builtin: true,
    include: { ...ALL_SECTIONS },
    view: {
      basemap: 'none',
      layerDefaults: { stroke: { color: '#1f2937', widthMm: 0.18 }, fill: { opacity: 0.65 } },
      labelDefaults: {},
      layers: {},
      labels: {},
      filters: []
    }
  },
  {
    id: 'builtin:urbano-situacao',
    name: 'Urbano — planta de situação',
    builtin: true,
    include: { ...ALL_SECTIONS },
    view: {
      basemap: 'esri_light',
      layerDefaults: { stroke: { widthMm: 0.25 }, fill: { opacity: 0.25 } },
      labelDefaults: { show: true, text: '{name}', sizePt: 6, color: '#111111', halo: true },
      layers: {},
      labels: {},
      filters: []
    }
  },
  {
    id: 'builtin:urbano-uso-solo',
    name: 'Urbano — uso do solo',
    builtin: true,
    include: { ...ALL_SECTIONS },
    view: {
      basemap: 'none',
      layerDefaults: { stroke: { color: '#ffffff', widthMm: 0.13 }, fill: { opacity: 0.85 } },
      labelDefaults: {},
      layers: {},
      labels: {},
      filters: []
    }
  }
];

export const PrintViewTemplates = {
  /** Modelos do projeto + prontos */
  all(library) {
    return [...(library?.viewTemplates || []), ...BUILTIN_TEMPLATES];
  },

  find(library, id) {
    if (!id) return null;
    return this.all(library).find(t => t.id === id) || null;
  },

  isBuiltin(id) {
    return String(id || '').startsWith('builtin:');
  },

  /** Seções do modelo copiadas para a vista do item (o item passa a valer sozinho) */
  copySections(viewConfig, item, tpl) {
    const inc = tpl.include || {};
    const v = tpl.view || {};
    if (inc.layers) {
      viewConfig.layers = clone(v.layers) || {};
      viewConfig.layerDefaults = clone(v.layerDefaults) || {};
    }
    if (inc.labels) {
      viewConfig.labels = clone(v.labels) || {};
      viewConfig.labelDefaults = clone(v.labelDefaults) || {};
    }
    if (inc.filters) viewConfig.filters = clone(v.filters) || [];
    if (inc.basemap && v.basemap) item.basemap = v.basemap;
  },

  /** Vincula: as seções incluídas passam a vir do modelo (mudar o modelo muda o mapa) */
  assign(viewConfig, templateId) {
    viewConfig.templateId = templateId || null;
    viewConfig.followProject = false;
  },

  /** Aplicar uma vez: copia sem vincular */
  applyOnce(viewConfig, item, tpl) {
    this.copySections(viewConfig, item, tpl);
    viewConfig.templateId = null;
    viewConfig.followProject = false;
  },

  /** Desvincular mantendo a aparência atual (como no Revit) */
  detach(viewConfig, item, library) {
    const tpl = this.find(library, viewConfig.templateId);
    if (tpl) this.copySections(viewConfig, item, tpl);
    viewConfig.templateId = null;
  },

  /** Novo modelo a partir da vista efetiva de um mapa */
  fromView(effectiveView, name, id = `tpl-${Date.now().toString(36)}`) {
    return {
      id,
      name: String(name || 'Modelo').trim() || 'Modelo',
      include: { ...ALL_SECTIONS },
      view: {
        basemap: effectiveView.basemap,
        layers: clone(effectiveView.layers) || {},
        layerDefaults: clone(effectiveView.layerDefaults) || {},
        labels: clone(effectiveView.labels) || {},
        labelDefaults: clone(effectiveView.labelDefaults) || {},
        filters: clone(effectiveView.filters) || []
      }
    };
  },

  /** Cópia editável de um modelo (pronto ou do projeto) */
  duplicate(tpl, id = `tpl-${Date.now().toString(36)}`) {
    const copy = clone(tpl);
    delete copy.builtin;
    return { ...copy, id, name: `${tpl.name} (cópia)` };
  },

  /** Quantos mapas usam o modelo (em todas as pranchas) */
  usage(templateId, sheets = [], activeSheetId = null, currentItems = null) {
    let n = 0;
    sheets.forEach(s => {
      // A prancha aberta conta pelo estado da tela (pode ainda não ter sido gravada)
      const items = s.id === activeSheetId && currentItems ? currentItems : s.items;
      (items || []).forEach(i => { if (i.type === 'map' && i.viewConfig?.templateId === templateId) n++; });
    });
    return n;
  }
};
