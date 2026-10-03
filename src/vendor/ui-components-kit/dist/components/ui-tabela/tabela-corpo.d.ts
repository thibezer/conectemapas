import { TabelaColuna } from './tipos';
export interface ContextoCorpoTabela {
    tbodyElement: HTMLTableSectionElement | null;
    tableElement: HTMLTableElement | null;
    emptyElement: HTMLDivElement | null;
    containerElement: HTMLDivElement | null;
    dadosExibicao: Record<string, any>[];
    colunas: TabelaColuna[];
    chaveId: string;
    virtualizar: boolean;
    rowHeight: number;
    isItemSelecionado: (item: Record<string, any>, index: number) => boolean;
    onLinhaClique: (item: Record<string, any>, index: number) => void;
    formatWidth: (largura?: string | number) => string;
    getAlignmentClass: (alinhamento?: string) => string;
    getTextAlign: (alinhamento?: string) => string;
}
export declare function renderizarCorpoTabela(ctx: ContextoCorpoTabela): void;
