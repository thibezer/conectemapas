import { default as L } from 'leaflet';
import { Segmento, Ponto, BancoPonto } from './types';
import { MapaCore } from './mapa_core';
export declare class MapaLinhas {
    polylines: L.Polyline[];
    bancoPontosAtivo: boolean;
    private core;
    constructor(core: MapaCore, _controller?: any);
    setBancoPontosAtivo(ativo: boolean): void;
    plotSegmentos(segmentos: Segmento[], pontos: Ponto[]): void;
    plotPolilinhaTemporaria(pontos: Ponto[]): void;
    plotPoligonalHomologada(bancoPontos: BancoPonto[]): void;
    clearLinhas(): void;
}
