export interface ContextoLabelPlaceholder {
    labelElement: HTMLLabelElement;
    inputElement: HTMLInputElement;
    labelText: string | null;
    placeholderText: string;
    isFlutuante: boolean;
    estaFocado: boolean;
    obrigatorio?: boolean;
}
export declare function sincronizarLabelEPlaceholder(ctx: ContextoLabelPlaceholder): void;
export declare function sincronizarIconeSenha(container: HTMLSpanElement, ehSenhaOuAlternar: boolean, senhaVisivel: boolean): void;
export declare function sincronizarFeedbackErro(wrapper: HTMLDivElement, input: HTMLInputElement, helper: HTMLDivElement, temErro: boolean, mensagemErro: string | null, helperText: string | null): void;
