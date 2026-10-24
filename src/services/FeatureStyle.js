/* ==========================================================================
   ConecteMapas - FeatureStyle
   Responsabilidade Única: estilo de uma feição no projeto (feature.style, feature.color,
   layer.color), lido do mesmo jeito pelo mapa principal (CanvasMapEngine) e pelas
   pranchas (PrintViewResolver). Puro: sem DOM nem Leaflet.
   ========================================================================== */

export const DEFAULT_FEATURE_COLOR = '#00E08A';

/** Espessura do mapa principal (px de tela) -> espessura no papel (mm). 2,5 px = pena 0,25 mm. */
export const PX_TO_MM = 0.1;

const NONE = new Set(['none', 'transparent']);

export const FeatureStyle = {
  /** 'polygon' | 'line' | 'point' | 'text' | 'circle' */
  kind(feat) {
    const t = String(feat?.type || '').toLowerCase();
    if (t === 'polygon' || t === 'multipolygon') return 'polygon';
    if (t === 'linestring' || t === 'line' || t === 'multilinestring') return 'line';
    if (t === 'text') return 'text';
    if (t === 'circle') return 'circle';
    return 'point';
  },

  /**
   * Estilo do projeto, normalizado:
   * { kind, color, stroke: { color, width (px), dash }, fill: { color, opacity },
   *   marker: { icon, size, rotation }, label: { show, field }, text: { color, size, halo } }
   * `color: 'none'` em traço ou preenchimento = não desenhar.
   */
  base(feat, layer) {
    const s = feat?.style || {};
    const kind = this.kind(feat);
    const color = feat?.color || layer?.color || DEFAULT_FEATURE_COLOR;
    const fillNone = NONE.has(s.fillColor);
    const strokeNone = NONE.has(s.strokeColor);

    let strokeColor;
    if (kind === 'text') strokeColor = s.textColor || '#ffffff';
    else if (strokeNone) strokeColor = 'none';
    else if (s.strokeColor) strokeColor = s.strokeColor;
    else if (kind === 'line') strokeColor = color;
    else strokeColor = s.fillColor && !fillNone ? '#ffffff' : color;

    return {
      kind,
      color,
      stroke: {
        color: strokeColor,
        width: strokeNone ? 0 : (s.strokeWidth !== undefined ? Number(s.strokeWidth) : 2.5),
        dash: s.strokeDashArray || undefined
      },
      fill: {
        color: fillNone ? 'none' : (s.fillColor || color),
        opacity: fillNone ? 0 : (s.fillOpacity !== undefined ? Number(s.fillOpacity) : 0.35)
      },
      marker: {
        icon: s.markerIcon,
        size: s.markerSize !== undefined ? Number(s.markerSize) : 24,
        rotation: s.markerRotation !== undefined ? Number(s.markerRotation) : 0
      },
      label: { show: s.showLabel === true, field: s.labelField || 'name' },
      text: {
        color: s.textColor || '#ffffff',
        size: s.fontSize !== undefined ? Number(s.fontSize) : undefined,
        halo: Boolean(s.halo)
      }
    };
  },

  /** Valor do campo de rótulo (aceita campos da feição e de `properties`) */
  fieldValue(feat, field) {
    if (!feat || !field) return '';
    const direct = { name: feat.name, category: feat.category, description: feat.description, type: feat.type };
    const v = field in direct ? direct[field] : feat.properties?.[field];
    return v === null || v === undefined ? '' : String(v);
  },

  /**
   * Texto do rótulo a partir de um modelo: `Lote {name}\n{Área (m²)} m²`.
   * Sem chaves, o modelo é tratado como nome de campo (compatível com `labelField`).
   */
  labelText(feat, template) {
    if (!template) return '';
    if (!template.includes('{')) return this.fieldValue(feat, template);
    return template
      .replace(/\{([^{}]+)\}/g, (_, f) => this.fieldValue(feat, f.trim()))
      .replace(/\\n/g, '\n')
      .trim();
  }
};
