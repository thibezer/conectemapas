import { Ponto } from './types';
import { CanvasLayerManager } from './layer_manager';
import { CAD_INTERACTIVE_PANES } from './canvas_selecao_box';
export { CAD_INTERACTIVE_PANES };
export interface CanvasInteracaoContext {
    mapaController?: any;
    layerManager?: CanvasLayerManager;
    selectedPontoIds: number[];
    selectedVizinhoPontoIds: number[];
    lastSelectedPontoId: number | null;
    pontosList?: Ponto[];
    containerHost?: HTMLElement | ShadowRoot;
    atualizarDestaqueLinhasTabela?: () => void;
    onSelectionChange?: (selectedIds: number[], selectedVizinhoIds: number[]) => void;
}
/**
 * Controlador de Interações do Canvas AutoCAD-like para o Leaflet
 *
 * Funcionalidades CAD:
 *  - Pan Dinâmico: Botão do Meio (Scroll Wheel Drag) com cursor grabbing
 *  - Zoom Extents: Duplo clique na rodinha do mouse (<300ms)
 *  - Janelas de Seleção:
 *      * Window Selection (Esquerda -> Direita, Azul #06b6d4): seleciona 100% contidos
 *      * Crossing Selection (Direita -> Esquerda, Verde #10b981): seleciona interceptados
 *  - Snapping e Seleção Filtrada: Apenas camadas ativas, visíveis e desbloqueadas
 *  - Teclado: Tecla ESC limpa a seleção; tecla Ctrl/Cmd ativa seleção aditiva múltipla
 */
export declare class CanvasInteracao {
    ctx: CanvasInteracaoContext;
    private map;
    private mapContainer;
    private selecaoBox;
    private isPanning;
    private lastMousePos;
    private lastMiddleClickTime;
    private touchStartPos;
    private touchStartDist;
    private isTouchPanning;
    selectionHappened: boolean;
    panHappened: boolean;
    constructor(ctx?: Partial<CanvasInteracaoContext>);
    ativar(mapaController: any, containerHost?: HTMLElement | ShadowRoot): void;
    desativar(): void;
    private handleTouchStart;
    private handleTouchMove;
    private handleTouchEnd;
    private handleContextMenu;
    private handleMouseDown;
    private handleMouseMove;
    private handleMouseUp;
    private handleKeyDown;
    limparSelecao(): void;
    private notificarSelecao;
    zoomExtents(): void;
    destroy(): void;
}
