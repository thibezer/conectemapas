import { default as L } from 'leaflet';
import { DestacarElementoOpcoes } from './types';
export interface DestaqueState {
    destaqueMarker: L.Marker | null;
    destaqueTimeoutId: number | null;
}
/**
 * Localiza a coordenada geográfica central de qualquer elemento geométrico do canvas pelo identificador (ID).
 * Agnóstico a entidades pontuais, lineares e poligonais.
 */
export declare function localizarCoordenadasElemento(controller: any, id: string | number): L.LatLng | null;
export declare function executarDestaqueElemento(controller: any, state: DestaqueState, id: string | number, opcoes?: DestacarElementoOpcoes): void;
export declare function limparDestaqueElemento(state: DestaqueState, map: L.Map | null): void;
