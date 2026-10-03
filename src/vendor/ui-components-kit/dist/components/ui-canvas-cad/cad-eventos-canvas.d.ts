import { GerenciGeoMapaController } from '../../gerencigeo-canvas/mapa_controller';
export interface ContextoEventosCanvas {
    host: HTMLElement;
    controller: GerenciGeoMapaController;
    mapContainer: HTMLElement | null;
    modoSequencial: boolean;
    mouseMovedSinceDown: boolean;
    obterElementoPorId: (id: string | number) => any;
    fecharPopup: () => void;
}
export declare function processarCliqueLivreCanvas(ctx: ContextoEventosCanvas, e: MouseEvent | any, latLngParam?: {
    lat: number;
    lng?: number;
    lon?: number;
}, containerPointParam?: {
    x: number;
    y: number;
}): boolean;
export declare function processarAcaoPopup(ctx: ContextoEventosCanvas, acaoId: string, elementoId: string | number, elemento?: any): void;
export declare function tratarCliqueMarcador(ctx: ContextoEventosCanvas, pId: string | number, isVizinho: boolean | undefined, elemento: any, coords: {
    lat: number;
    lon: number;
} | undefined, prevMarkerClick?: (pId: string | number, isVizinho?: boolean, elemento?: any, coords?: {
    lat: number;
    lon: number;
}) => void, customMarkerClickHandler?: (pontoId: number, isVizinho?: boolean) => void): void;
