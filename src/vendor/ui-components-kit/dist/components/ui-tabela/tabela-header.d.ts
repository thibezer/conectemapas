import { TabelaColuna } from './tipos';
import { ListenerBag } from '../../core/listener-bag';
export interface ContextoHeaderTabela {
    theadElement: HTMLTableSectionElement | null;
    colgroupElement: HTMLTableColElement | null;
    colunas: TabelaColuna[];
    colunaOrdenada: string | null;
    direcaoOrdenacao: 'asc' | 'desc' | 'original';
    headerListeners: ListenerBag;
    formatWidth: (largura?: string | number) => string;
    getAlignmentClass: (alinhamento?: string) => string;
    getTextAlign: (alinhamento?: string) => string;
    onHeaderClick: (coluna: TabelaColuna) => void;
    onHeaderContextMenu: (e: MouseEvent, coluna: TabelaColuna, colIndex: number, th: HTMLTableCellElement) => void;
    onInitColumnResize: (e: MouseEvent, coluna: TabelaColuna, colIndex: number, th: HTMLTableCellElement, resizer: HTMLDivElement) => void;
    onColumnAutoFit: (coluna: TabelaColuna, th: HTMLTableCellElement, col: HTMLTableColElement) => void;
}
export declare function renderizarHeaderTabela(ctx: ContextoHeaderTabela): void;
