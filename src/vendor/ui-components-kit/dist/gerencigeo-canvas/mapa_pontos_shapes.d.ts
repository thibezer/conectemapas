/**
 * Helper para renderizar elementos HTML/SVG de marcadores no Leaflet Canvas/DOM.
 * Estilos inline 100% autônomos (independentes de Tailwind) e suporte completo a
 * formas geométricas topográficas (circle, circle-dot, square, diamond, cross, x, triangle)
 * com suporte nativo a seleção e destaque visual.
 */
export declare function extrairCorPonto(bgClassOuCor: string): string;
export declare function getPointShapeHtml(shapeStyle: string, size: number, bgClass: string, extraClasses?: string, id?: string, selecionado?: boolean): string;
