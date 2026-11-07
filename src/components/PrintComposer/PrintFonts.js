/* ==========================================================================
   ConecteMapas - PrintFonts
   Responsabilidade Única: famílias de fonte da prancha. Uma lista só, usada pela tela
   (CSS), pelo desenho em canvas (rótulos do mapa, legenda) e pelo PDF. Só fontes de
   sistema (sem arquivo para baixar), cada uma com alternativas.
   ========================================================================== */

export const FONT_FAMILIES = {
  sans: { label: 'Sem serifa (Arial)', css: 'Arial, Helvetica, sans-serif' },
  condensed: { label: 'Condensada', css: '"Arial Narrow", "Roboto Condensed", "Helvetica Neue Condensed", Arial, sans-serif' },
  rounded: { label: 'Arredondada', css: '"Trebuchet MS", "Segoe UI", Verdana, sans-serif' },
  serif: { label: 'Com serifa', css: 'Georgia, "Times New Roman", serif' },
  mono: { label: 'Monoespaçada', css: '"Courier New", Consolas, monospace' }
};

export const DEFAULT_FONT = 'sans';

export const PrintFonts = {
  /** Chave conhecida (ou a padrão) */
  normalize(id) {
    return Object.prototype.hasOwnProperty.call(FONT_FAMILIES, id) ? id : DEFAULT_FONT;
  },

  /** Pilha CSS para `font` do canvas e `font-family` da tela */
  css(id) {
    return FONT_FAMILIES[this.normalize(id)].css;
  },

  list() {
    return Object.entries(FONT_FAMILIES).map(([id, f]) => ({ id, label: f.label }));
  }
};
