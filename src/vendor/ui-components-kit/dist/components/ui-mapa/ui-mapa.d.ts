import { default as L } from 'leaflet';
import { SafeHTMLElement } from '../../core/ssr-safe';
export declare class UIMapa extends SafeHTMLElement {
    static get observedAttributes(): string[];
    private mapContainer;
    private mapInstance;
    private _initTimer;
    private _resizeObserver?;
    private _resizeTimer?;
    constructor();
    connectedCallback(): void;
    disconnectedCallback(): void;
    attributeChangedCallback(_name: string, oldVal: string, newVal: string): void;
    private initMap;
    getMap(): L.Map | null;
}
