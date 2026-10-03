import { TabelaColuna } from './tipos';
import { ListenerBag } from '../../core/listener-bag';
import { EstruturaDOMElementos } from './tabela-dom';
import { TabelaOrquestradorDados } from './tabela-orquestrador-dados';
import { TabelaSelecaoController } from './tabela-selecao';
export interface ContextoOrquestradorRender {
    host: HTMLElement;
    shadow: ShadowRoot;
    theadElement: HTMLTableSectionElement | null;
    colgroupElement: HTMLTableColElement | null;
    tbodyElement: HTMLTableSectionElement | null;
    tableElement: HTMLTableElement | null;
    emptyElement: HTMLDivElement | null;
    containerElement: HTMLDivElement | null;
    colunas: TabelaColuna[];
    dadosController: TabelaOrquestradorDados;
    selecaoController: TabelaSelecaoController;
    headerListeners: ListenerBag;
    chaveId: string;
    virtualizar: boolean;
    rowHeight: number;
    onSetIsResizing: (resizing: boolean) => void;
    onActiveResizeCleanup: (cleanup: (() => void) | null) => void;
    onHeaderClick: (col: TabelaColuna) => void;
}
export declare function executarOrquestracaoHeader(ctx: ContextoOrquestradorRender): void;
export declare function executarOrquestracaoCorpo(ctx: ContextoOrquestradorRender): void;
export declare function inicializarScrollVirtualizacao(container: HTMLElement, onRenderBody: () => void): (e: Event) => void;
export declare function orquestrarEstruturaInicial(shadow: ShadowRoot, textoVazio: string, maxHeight: string | null, carregando: boolean): EstruturaDOMElementos;
