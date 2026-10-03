/**
 * Utilitários para Form-Associated Custom Elements e validação nativa de restrições (HTML5 / W3C FACE).
 */
export interface RegrasValidacaoCampoTexto {
    val: string;
    rawVal?: string;
    badInput?: boolean;
    disabled: boolean;
    required: boolean;
    tipo?: string;
    minlength?: number | null;
    maxlength?: number | null;
    pattern?: string | null;
    min?: number | null;
    max?: number | null;
    step?: string | null;
    customError?: string;
    mensagemValidacao?: string | null;
}
export interface ResultadoValidacao {
    valido: boolean;
    flags: ValidityStateFlags;
    mensagem: string;
}
/**
 * Valida o valor e restrições de um campo de texto conforme a especificação W3C / HTML5.
 */
export declare function validarRestricoesCampoTexto(regras: RegrasValidacaoCampoTexto): ResultadoValidacao;
/**
 * Aplica o resultado da validação na instância de ElementInternals
 */
export declare function aplicarValidadeInternals(internals: {
    setValidity?: (flags?: any, message?: string, anchor?: HTMLElement) => void;
} | any, resultado: ResultadoValidacao, anchor?: HTMLElement): void;
