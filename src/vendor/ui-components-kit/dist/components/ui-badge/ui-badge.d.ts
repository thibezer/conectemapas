import { SafeHTMLElement } from '../../core/ssr-safe';
export declare class UIBadge extends SafeHTMLElement {
    static get observedAttributes(): string[];
    private badgeElement;
    private labelElement;
    private closeElement;
    private listeners;
    constructor();
    connectedCallback(): void;
    disconnectedCallback(): void;
    attributeChangedCallback(_name: string, _old: string | null, _value: string | null): void;
    get removivel(): boolean;
    set removivel(val: boolean);
    private syncState;
    private handleRemove;
}
export declare class UIChip extends UIBadge {
}
export declare class UITag extends UIBadge {
}
