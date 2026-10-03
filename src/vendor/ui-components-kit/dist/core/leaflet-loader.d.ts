/**
 * Utilitário centralizado para carregamento dinâmico e desacoplado do Leaflet.
 * Permite que a biblioteca funcione sem travar caso o Leaflet não esteja presente,
 * carregando sob demanda via dynamic import() ou acessando window.L no navegador.
 */
export declare function carregarLeaflet(): Promise<any>;
export declare function obterLeafletSincrono(): any | null;
