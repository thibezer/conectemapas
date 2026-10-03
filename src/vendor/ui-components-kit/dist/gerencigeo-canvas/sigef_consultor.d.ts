import { default as L } from 'leaflet';
export interface SigefConsultorState {
    currentAbortController?: AbortController;
}
/**
 * Consulta de certificações fundiárias no WMS do SIGEF/INCRA
 * e renderização de popups informativos com links de shapefile e importação.
 */
export declare function consultarSigefNoPonto(map: L.Map, e: L.LeafletMouseEvent, apiBaseUrl: string, state: SigefConsultorState): Promise<void>;
