export interface ContextoAtributosTabela {
    host: HTMLElement;
    containerElement: HTMLDivElement | null;
    emptyElement: HTMLDivElement | null;
    loadingElement: HTMLDivElement | null;
    onTextoVazioAlterado: (texto: string) => void;
    onVirtualizarAlterado: (virtualizar: boolean) => void;
    onCarregarSrc: (src: string) => void;
    onCarregandoAlterado: (carregando: boolean) => void;
    onRenderBody: () => void;
    onRenderTotal: () => void;
}
export declare function sincronizarAtributosTabela(ctx: ContextoAtributosTabela): void;
export declare function tratarMudancaAtributoTabela(name: string, newVal: string | null, ctx: ContextoAtributosTabela): void;
