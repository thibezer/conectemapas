import { default as L } from 'leaflet';
import { Ponto, Confrontante } from './types';
import { MapaCore } from './mapa_core';
export declare class MapaMarcadores {
    markers: L.Marker[];
    vizinhosMarkers: L.Marker[];
    vizinhosPoligonos: L.Polygon[];
    private core;
    private controller;
    constructor(core: MapaCore, controller: any);
    plotPontos(pontos: Ponto[], onMarkerClick: (id: number) => void): void;
    plotPontosVizinhos(pontos: Ponto[]): void;
    /**
     * Desenha o perímetro (limites) dos imóveis vizinhos importados via WKT POLYGON
     */
    plotPoligonosVizinhos(confrontantes: Confrontante[]): void;
    clearMarkers(): void;
}
