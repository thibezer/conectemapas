import { default as L } from 'leaflet';
import { MapaConfigManager } from './mapa_config';
import { MapaConfiguracoes } from './types';
export interface MapaCoreControllerRef {
    modoCliqueSequencialAtivo?: boolean;
    canvasInteracao?: {
        selectionHappened?: boolean;
    };
    layerManager?: any;
}
export declare class MapaCore {
    map: L.Map | null;
    configManager: MapaConfigManager;
    config: MapaConfiguracoes;
    apiBaseUrl: string;
    bancoPontosGroup: L.LayerGroup;
    pontosVizinhosGroup: L.LayerGroup;
    private controller;
    private containerElement;
    private bc?;
    private sigefState;
    constructor(controller: MapaCoreControllerRef);
    init(containerIdOrElement: string | HTMLElement): L.Map | null;
    invalidateSize(animate?: boolean): void;
    private applyMapStyles;
    private listenConfigBroadcast;
    destroy(): void;
    preCarregarTilesRegiao(bounds: L.LatLngBounds): void;
    private consultarSigef;
}
