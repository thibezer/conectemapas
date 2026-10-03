import { SafeHTMLElement } from '../../core/ssr-safe';
export type VarianteSkeleton = 'texto' | 'circular' | 'retangular' | 'card';
export type AnimacaoSkeleton = 'shimmer' | 'pulso' | 'nenhum';
export declare class UISkeleton extends SafeHTMLElement {
    static get observedAttributes(): string[];
    private rootElement;
    constructor();
    connectedCallback(): void;
    attributeChangedCallback(_name: string, _old: string | null, _value: string | null): void;
    get variante(): VarianteSkeleton;
    set variante(val: VarianteSkeleton);
    get animado(): AnimacaoSkeleton;
    set animado(val: AnimacaoSkeleton);
    get linhas(): number;
    set linhas(val: number);
    private syncState;
}
export declare class UIEsqueleto extends UISkeleton {
}
