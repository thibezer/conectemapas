import { UICanvasCAD } from './ui-canvas-cad';
import { GerenciGeoMapaController } from '../../gerencigeo-canvas/mapa_controller';
import { GerenciadorToolbarPainel } from './cad-toolbar-painel';
import { GerenciadorColecoesDados } from './cad-colecoes-dados';
import { ContextoEventosCanvas } from './cad-eventos-canvas';
export interface ContextoInicializadorCAD {
    host: UICanvasCAD;
    shadow: ShadowRoot;
    mapContainer: HTMLDivElement | null;
    controller: GerenciGeoMapaController;
    toolbarPainel: GerenciadorToolbarPainel;
    colecoesDados: GerenciadorColecoesDados;
    obterContextoEventos: () => ContextoEventosCanvas;
    renderLayersUI: () => void;
    invalidateSizeSafely: () => void;
    tratarCliqueLivreCanvas: (e: any, latlng?: any, containerPoint?: any) => void;
    dispararAcaoPopup: (acaoId: string, elementoId: string | number, elemento?: any) => void;
}
export declare function inicializarCAD(ctx: ContextoInicializadorCAD): void;
