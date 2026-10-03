/**
 * Controlador do indicador deslizante (pill) do UISegmented
 */
export declare class SegmentedIndicadorController {
    private trackElement;
    private indicadorElement;
    private rafId;
    private resizeObserver?;
    constructor(trackElement: HTMLElement, indicadorElement: HTMLElement);
    iniciarObserver(rootElement: HTMLElement, onResize?: () => void): void;
    destruir(): void;
    atualizar(): void;
}
