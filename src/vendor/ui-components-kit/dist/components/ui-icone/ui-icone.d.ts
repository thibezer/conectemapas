import { SafeHTMLElement } from '../../core/ssr-safe';
export type TamanhoIcone = 'sm' | 'md' | 'lg' | 'xl' | string | number;
export declare class UIIcone extends SafeHTMLElement {
    static get observedAttributes(): string[];
    private iconContainer;
    private svgContainer;
    private slotElement;
    constructor();
    connectedCallback(): void;
    disconnectedCallback(): void;
    attributeChangedCallback(_name: string, _old: string | null, _value: string | null): void;
    private handleSlotChange;
    private resolveTamanhoPx;
    private syncState;
}
