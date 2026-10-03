import { ListenerBag } from '../../core/listener-bag';
export interface ContextoPainelControles {
    shadow: ShadowRoot;
    listeners: ListenerBag;
    host: HTMLElement;
    onToggleExpandirTodas: () => void;
    onFiltrar: (termo: string) => void;
    onAplicar: () => void;
    onDesfazer: () => void;
    onAlternarDensidade?: () => void;
    onAlternarFlutuante?: () => void;
    onAlternarColapsoHorizontal?: () => void;
}
export declare function conectarPainelControles(ctx: ContextoPainelControles): void;
export declare function sincronizarPainelControles(shadow: ShadowRoot, host: HTMLElement): void;
