import { ListenerBag } from '../../core/listener-bag';
import { SafeHTMLElement } from '../../core/ssr-safe';
export declare const ICONES_ALERTA: Record<string, string>;
export declare class UIAlerta extends SafeHTMLElement {
    static get observedAttributes(): string[];
    protected alertaElement: HTMLDivElement;
    protected iconeElement: HTMLSpanElement;
    protected tituloElement: HTMLHeadingElement;
    protected mensagemElement: HTMLParagraphElement;
    protected mensagemTextoElement: HTMLSpanElement;
    protected closeElement: HTMLButtonElement;
    protected acoesElement: HTMLDivElement;
    protected botaoAcaoElement: HTMLButtonElement;
    protected progressoContainer: HTMLDivElement;
    protected progressoBarra: HTMLDivElement;
    protected listeners: ListenerBag;
    constructor();
    connectedCallback(): void;
    disconnectedCallback(): void;
    attributeChangedCallback(_name: string, _old: string | null, _value: string | null): void;
    fechar(): void;
    protected syncState(): void;
}
