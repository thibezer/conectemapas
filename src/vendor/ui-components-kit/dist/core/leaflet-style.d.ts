import { default as leafletCss } from 'leaflet/dist/leaflet.css?inline';
export { leafletCss };
/**
 * Retorna uma instância única compartilhada de CSSStyleSheet para o Leaflet (Constructable Stylesheets).
 * Permite que múltiplos Web Components compartilhem a mesma folha de estilo em memória sem duplicação.
 */
export declare function getLeafletStyleSheet(): CSSStyleSheet | null;
