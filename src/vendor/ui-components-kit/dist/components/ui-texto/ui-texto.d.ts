import { SafeHTMLElement } from '../../core/ssr-safe';
export type VarianteTexto = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'corpo' | 'corpo-sm' | 'caption' | 'codigo';
export type CorTexto = 'primaria' | 'secundaria' | 'destaque' | 'erro' | 'sucesso' | 'alerta';
export type PesoTexto = 'normal' | 'medio' | 'seminegrito' | 'negrito';
export type AlinhamentoTexto = 'esquerda' | 'centro' | 'direita' | 'justificado';
export declare class UITexto extends SafeHTMLElement {
    static get observedAttributes(): string[];
    private container;
    private shadow;
    constructor();
    connectedCallback(): void;
    attributeChangedCallback(_name: string, _old: string | null, _value: string | null): void;
    private resolveTag;
    private render;
}
