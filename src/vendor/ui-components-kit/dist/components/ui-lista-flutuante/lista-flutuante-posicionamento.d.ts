/**
 * Gerenciador de posicionamento flutuante e modo responsivo bottom-sheet
 */
export declare class ListaFlutuantePosicionamento {
    private host;
    private button;
    private content;
    private scrollHandler?;
    private resizeHandler?;
    constructor(host: HTMLElement, button: HTMLElement, content: HTMLElement);
    isMobileOrBottomSheet(): boolean;
    posicionar: () => void;
    ativarAcompanhamento(onFechar: () => void): void;
    desativarAcompanhamento(): void;
}
