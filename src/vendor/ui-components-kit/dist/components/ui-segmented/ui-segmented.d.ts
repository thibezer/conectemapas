import { SafeHTMLElement } from '../../core/ssr-safe';
export interface UISegmentedOpcao {
    valor: string;
    rotulo: string;
    icone?: string;
    disabled?: boolean;
}
export declare class UISegmented extends SafeHTMLElement {
    static formAssociated: boolean;
    static get observedAttributes(): string[];
    private internals?;
    private rootElement;
    private trackElement;
    private indicadorElement;
    private slotElement;
    private _opcoes;
    private _defaultValue;
    private _formDisabled;
    private _customErrorMessage;
    private listeners;
    private indicadorController;
    constructor();
    connectedCallback(): void;
    disconnectedCallback(): void;
    attributeChangedCallback(name: string, old: string | null, value: string | null): void;
    formDisabledCallback(disabled: boolean): void;
    formResetCallback(): void;
    formStateRestoreCallback(state: any, _mode: 'restore' | 'autocomplete'): void;
    get form(): HTMLFormElement | null;
    get type(): string;
    get required(): boolean;
    set required(val: boolean);
    get obrigatorio(): boolean;
    set obrigatorio(val: boolean);
    get validity(): ValidityState | undefined;
    get validationMessage(): string;
    get willValidate(): boolean;
    checkValidity(): boolean;
    reportValidity(): boolean;
    setCustomValidity(error: string): void;
    atualizarValidade(): void;
    get valor(): string;
    set valor(val: string);
    get value(): string;
    set value(val: string);
    get name(): string;
    set name(val: string);
    get disabled(): boolean;
    set disabled(val: boolean);
    get opcoes(): UISegmentedOpcao[];
    set opcoes(val: UISegmentedOpcao[]);
    private handleSlotChange;
    private carregarOpcoes;
    private renderizarOpcoes;
    selecionarIndice(indice: number, dispararEventos?: boolean): void;
    private atualizarSelecao;
    private handleKeyDown;
    private syncState;
}
export declare class UISegmento extends UISegmented {
}
export * from './segmented-indicador';
export * from './segmented-teclado';
export * from './segmented-template';
