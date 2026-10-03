import { TabelaColuna } from './tipos';
export interface ContextoTabelaInteracao {
    host: HTMLElement;
    colgroupElement: HTMLTableColElement | null;
    shadow: ShadowRoot;
    onSetIsResizing: (resizing: boolean) => void;
}
export declare function executarRedimensionamentoColuna(e: MouseEvent, coluna: TabelaColuna, colIndex: number, thElement: HTMLTableCellElement, resizer: HTMLDivElement, ctx: ContextoTabelaInteracao): (() => void) | null;
export declare function abrirPopoverRedimensionamento(e: MouseEvent, coluna: TabelaColuna, colIndex: number, thElement: HTMLTableCellElement, ctx: ContextoTabelaInteracao): void;
