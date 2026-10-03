import { default as L } from 'leaflet';
import { Ponto, Confrontante } from './types';
export declare function processarPontosVizinhos(pontos: Ponto[], confrontantesAtuais: Confrontante[]): Confrontante[];
export declare function processarPoligonosVizinhos(confrontantes: Confrontante[], confrontantesAtuais: Confrontante[]): Confrontante[];
export declare function calcularBoundsGeometrias(pontos: Ponto[], confrontantes?: Confrontante[], incluirVizinhos?: boolean): {
    single?: L.LatLng;
    bounds?: L.LatLngBounds;
} | null;
export declare function coletarMarcadoresLeaflet(map: L.Map | null, layerManager: any): L.Marker[];
export declare function executarPlotarPontos(controller: any, pontos?: any[] | null, camadaId?: string, onClique?: (ponto: any) => void): void;
export declare function executarPlotarConexoes(controller: any, conexoes?: any[] | null, camadaId?: string): void;
export declare function executarPlotarPolilinha(controller: any, pontos?: any[] | null, fechar?: boolean, camadaId?: string, chaveGrupo?: string): void;
export declare function executarPlotarPoligonos(controller: any, poligonos?: any[] | null, camadaId?: string): void;
export declare function executarPlotSegmentos(controller: any, segmentos?: any[] | null, pontos?: any[] | null): void;
export declare function executarClearOverlays(controller: any, manterBanco?: boolean): void;
