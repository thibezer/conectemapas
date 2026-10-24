/* ==========================================================================
   ConecteMapas - PrintCategoryFilters
   Responsabilidade Única: estilo por categoria (mapa temático) do jeito do Revit:
   gera um filtro por valor de um campo (ex.: "uso: comercial", "uso: residencial"),
   cada um com uma cor de uma paleta qualitativa, prontos para entrar na vista.
   Puro, sem DOM.
   ========================================================================== */

import { normalizeText } from '../../services/FeatureQuery.js';

/** Paletas qualitativas (cores distinguíveis entre si, boas para impressão) */
export const CATEGORY_PALETTES = {
  vivas: { label: 'Vivas', colors: ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#ffff33', '#a65628', '#f781bf', '#999999'] },
  suaves: { label: 'Suaves', colors: ['#8dd3c7', '#ffffb3', '#bebada', '#fb8072', '#80b1d3', '#fdb462', '#b3de69', '#fccde5', '#d9d9d9', '#bc80bd', '#ccebc5', '#ffed6f'] },
  // Uso do solo urbano (convenção usual: residencial amarelo, comercial vermelho, industrial roxo...)
  urbano: { label: 'Uso do solo', colors: ['#ffe066', '#e03131', '#9c36b5', '#2f9e44', '#1971c2', '#868e96', '#f08c00', '#66d9e8'] }
};

export const MAX_CATEGORIES = 24;

const FIXED_FIELDS = { name: 'Nome', category: 'Categoria', type: 'Tipo de geometria' };

export const PrintCategoryFilters = {
  /** Valor do campo usado para agrupar (`prop:<chave>` ou campo fixo) */
  valueOf(feat, field) {
    if (!feat) return '';
    const v = field.startsWith('prop:') ? feat.properties?.[field.slice(5)] : feat[field];
    return v === null || v === undefined ? '' : String(v).trim();
  },

  /**
   * Valores distintos do campo nas camadas escolhidas, do mais comum ao menos comum.
   * Agrupa sem diferenciar maiúsculas e acentos (como o "é igual a" do filtro).
   */
  distinctValues(features, field, layerIds = []) {
    const groups = new Map();
    (features || []).forEach(f => {
      if (layerIds.length && !layerIds.includes(f.layerId)) return;
      const v = this.valueOf(f, field);
      if (v === '') return;
      const key = normalizeText(v);
      const g = groups.get(key) || { value: v, count: 0 };
      g.count++;
      groups.set(key, g);
    });
    return [...groups.values()]
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'pt-BR'));
  },

  fieldLabel(field) {
    return field.startsWith('prop:') ? field.slice(5) : (FIXED_FIELDS[field] || field);
  },

  /**
   * Filtros (para a biblioteca) e entradas da vista (com a cor de cada valor).
   * Só os `MAX_CATEGORIES` valores mais comuns; o resto fica com o estilo da camada.
   */
  build(features, { field, layerIds = [], palette = 'vivas', idPrefix = `cat-${Date.now().toString(36)}` }) {
    const colors = (CATEGORY_PALETTES[palette] || CATEGORY_PALETTES.vivas).colors;
    const values = this.distinctValues(features, field, layerIds).slice(0, MAX_CATEGORIES);
    const label = this.fieldLabel(field);
    const filters = [];
    const entries = [];
    values.forEach(({ value }, i) => {
      const id = `${idPrefix}-${i}`;
      filters.push({
        id,
        name: `${label}: ${value}`,
        layerIds: [...layerIds],
        query: { op: 'AND', not: false, items: [{ field, operator: 'equals', value, value2: '' }] },
        category: { field, value }
      });
      const color = colors[i % colors.length];
      entries.push({ filterId: id, enabled: true, fill: { color, opacity: 0.8 }, stroke: { color } });
    });
    return { filters, entries, total: this.distinctValues(features, field, layerIds).length };
  }
};
