import { SafeHTMLElement } from '../../core/ssr-safe';
export declare class UIAvatar extends SafeHTMLElement {
    static get observedAttributes(): string[];
    private avatarElement;
    private statusElement;
    constructor();
    connectedCallback(): void;
    attributeChangedCallback(_name: string, _old: string | null, _value: string | null): void;
    private extrairIniciais;
    private syncState;
    private renderFallback;
}
