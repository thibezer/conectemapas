import { SafeHTMLElement } from '../../core/ssr-safe';
export declare class UITooltip extends SafeHTMLElement {
    static get observedAttributes(): string[];
    private containerElement;
    private bubbleElement;
    private _posicionamentoAtivo;
    constructor();
    connectedCallback(): void;
    disconnectedCallback(): void;
    attributeChangedCallback(_name: string, _old: string | null, _value: string | null): void;
    get aberto(): boolean;
    set aberto(val: boolean);
    get disabled(): boolean;
    set disabled(val: boolean);
    mostrar(): void;
    ocultar(): void;
    private posicionarBubble;
    private syncState;
    private handleMouseEnter;
    private handleMouseLeave;
    private handleClick;
    private handleClickOutside;
}
export declare class UIPopover extends UITooltip {
}
