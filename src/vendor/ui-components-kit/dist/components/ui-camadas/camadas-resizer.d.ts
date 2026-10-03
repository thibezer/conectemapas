import { ListenerBag } from '../../core/listener-bag';
export interface ContextoResizerCamadas {
    hostElement: HTMLElement;
    resizerElement: HTMLElement | null;
    listeners: ListenerBag;
    getMinAltura?: () => number;
    getMaxAltura?: () => number;
    onAlturaAlterada?: (alturaPx: number | null) => void;
    onRedimensionando?: (alturaPx: number) => void;
}
export interface ControladorResizerCamadas {
    init: () => void;
    definirAltura: (alturaPx: number | string | null, dispararEvento?: boolean) => void;
    destruir: () => void;
}
export declare function criarControladorRedimensionamentoAltura(ctx: ContextoResizerCamadas): ControladorResizerCamadas;
