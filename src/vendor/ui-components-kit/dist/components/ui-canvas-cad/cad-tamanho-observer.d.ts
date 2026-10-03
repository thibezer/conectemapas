import { GerenciGeoMapaController } from '../../gerencigeo-canvas/mapa_controller';
export interface ControladorTamanhoCanvas {
    observe: () => void;
    disconnect: () => void;
    invalidateSizeSafely: () => void;
}
export declare function criarControladorTamanho(host: HTMLElement, controller: GerenciGeoMapaController): ControladorTamanhoCanvas;
