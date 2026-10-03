import { SafeHTMLElement } from '../../core/ssr-safe';
export type TendenciaStat = 'alta' | 'positivo' | 'baixa' | 'negativo' | 'neutro';
export declare class UIStat extends SafeHTMLElement {
    static get observedAttributes(): string[];
    private statElement;
    private rotuloElement;
    private valorElement;
    private indicadorElement;
    private setaElement;
    private variacaoElement;
    private descricaoElement;
    constructor();
    connectedCallback(): void;
    attributeChangedCallback(_name: string, _old: string | null, _value: string | null): void;
    get rotulo(): string;
    set rotulo(val: string);
    get valor(): string;
    set valor(val: string);
    get variacao(): string;
    set variacao(val: string);
    get tendencia(): TendenciaStat;
    set tendencia(val: TendenciaStat);
    get descricao(): string;
    set descricao(val: string);
    private syncState;
}
export declare class UIKpi extends UIStat {
}
export declare class UIMetrica extends UIStat {
}
