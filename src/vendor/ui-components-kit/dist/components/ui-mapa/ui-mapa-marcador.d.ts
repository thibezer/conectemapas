import { SafeHTMLElement } from '../../core/ssr-safe';
export declare class UIMapaMarcador extends SafeHTMLElement {
    static get observedAttributes(): string[];
    private marker;
    private _initTimer;
    private _retryCount;
    private _parentMap;
    connectedCallback(): void;
    disconnectedCallback(): void;
    private handleMapReady;
    attributeChangedCallback(name: string, oldVal: string, newVal: string): void;
    private createPopupContent;
    private createIcon;
    private initMarker;
}
