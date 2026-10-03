import { default as L } from 'leaflet';
import { CanvasInteracaoContext } from './canvas_interacao';
export declare const CAD_INTERACTIVE_PANES: string[];
export declare class CanvasSelecaoBox {
    private map;
    private mapContainer;
    private ctx;
    private selectionDiv;
    isSelecting: boolean;
    selectStartPos: {
        x: number;
        y: number;
    };
    selectStartPoint: L.Point | null;
    constructor(map: L.Map, mapContainer: HTMLElement, ctx: CanvasInteracaoContext);
    private criarDivSelecao;
    setPanesPointerEvents(value: 'auto' | 'none'): void;
    iniciarSelecao(e: MouseEvent): void;
    atualizarSelecao(e: MouseEvent): void;
    finalizarSelecao(e: MouseEvent, onNotificar: () => void, onLimpar: () => void): boolean;
    cancelarSelecao(): void;
    destruir(): void;
}
