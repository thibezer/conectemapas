export interface ContextoToolbarPainel {
    shadow: ShadowRoot;
    mapContainer: HTMLDivElement | null;
    layersPanel: HTMLDivElement | null;
    onToggleCamadas?: () => void;
    onCloseCamadas?: () => void;
    onZoomExtents?: () => void;
    onLimparSelecao?: () => void;
    onTratarCliqueCanvas?: (e: MouseEvent) => void;
    onDispararAcaoPopup?: (acaoId: string, elementoId: string | number) => void;
}
/**
 * Gerencia a interação da interface com a barra de ferramentas rápida,
 * painel retrátil de camadas e detecção de clique versus pan no container do mapa.
 */
export declare class GerenciadorToolbarPainel {
    private contexto;
    private uiListeners;
    private isLayersPanelOpen;
    private mouseMovedSinceDown;
    private mouseDownPos;
    constructor(contexto: ContextoToolbarPainel);
    get estaPainelAberto(): boolean;
    get houveMovimentoMouse(): boolean;
    toggleLayersPanel(): void;
    closeLayersPanel(): void;
    vincularEventos(): void;
    limpar(): void;
}
