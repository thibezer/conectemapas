import { SafeHTMLElement } from '../../core/ssr-safe';
export declare class UIMapaLinha extends SafeHTMLElement {
    static get observedAttributes(): string[];
    private polyline;
    private _initTimer;
    private _retryCount;
    connectedCallback(): void;
    disconnectedCallback(): void;
    attributeChangedCallback(name: string, oldVal: string, newVal: string): void;
    private getPontos;
    private initLinha;
}
