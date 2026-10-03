import { ListenerBag } from '../../core/listener-bag';
export interface ContextoSplitterPropriedades {
    splitterElement: HTMLElement | null;
    corpoElement: HTMLElement | null;
    hostElement: HTMLElement;
    splitterListeners: ListenerBag;
    onLarguraAlterada: (larguraPorcentagem: number) => void;
}
export interface ControladorSplitterPropriedades {
    init: () => void;
    definirLarguraRotulo: (porcentagem: number) => number;
}
export declare function criarControladorSplitter(ctx: ContextoSplitterPropriedades): ControladorSplitterPropriedades;
