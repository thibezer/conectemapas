import { SafeHTMLElement } from '../../core/ssr-safe';
export declare class UIModal extends SafeHTMLElement {
    static _openCount: number;
    static get observedAttributes(): string[];
    private backdropElement;
    private dialogElement;
    private tituloElement;
    private closeElement;
    private _elementoGatilho;
    private _focables;
    private _tituloId;
    private _elementosInertes;
    constructor();
    connectedCallback(): void;
    disconnectedCallback(): void;
    attributeChangedCallback(name: string, _old: string | null, value: string | null): void;
    private handleSlotChange;
    get aberto(): boolean;
    set aberto(val: boolean);
    abrir(): void;
    fechar(): void;
    private syncState;
    private handleBackdropClick;
    private handleCloseClick;
    private _atualizarFocables;
    private _isTopMostModal;
    private handleKeyDown;
}
export declare class UIDialog extends UIModal {
}
