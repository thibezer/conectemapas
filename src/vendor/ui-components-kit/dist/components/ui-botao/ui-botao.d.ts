import { SafeHTMLElement } from '../../core/ssr-safe';
export type VarianteBotao = 'primary' | 'primario' | 'secondary' | 'secundario' | 'ghost' | 'terciario' | 'destructive' | 'destrutivo' | 'erro' | 'icon-only' | 'icone' | 'destaque' | 'outline' | 'borda';
export declare class UIBotao extends SafeHTMLElement {
    static get observedAttributes(): string[];
    private button;
    private spinnerContainer;
    private slotElement;
    private opticalState;
    private listeners;
    constructor();
    connectedCallback(): void;
    disconnectedCallback(): void;
    attributeChangedCallback(_name: string, _old: string | null, _value: string | null): void;
    get carregando(): boolean;
    set carregando(val: boolean);
    private handleSlotChange;
    /**
     * Remove espaços e quebras de linha fantasmas no slot e identifica
     * se há ícone no início ou fim para aplicar compensação óptica de padding.
     */
    private sanitizeAndBalanceContent;
    private syncState;
    private handleClick;
}
export declare class UIBotaoPrimario extends UIBotao {
}
