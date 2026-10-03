import { UIRowScrollOptions } from './tipos';
export interface ContextoTabelaSelecao {
    host: HTMLElement;
    tbodyElement: HTMLTableSectionElement | null;
    containerElement: HTMLDivElement | null;
    dadosExibicao: Record<string, any>[];
    chaveId: string;
    getRowHeight: () => number;
    onRenderBody: () => void;
}
export declare class TabelaSelecaoController {
    private ctx;
    private itemSelecionado;
    private indiceSelecionado;
    constructor(ctx: ContextoTabelaSelecao);
    getItemSelecionado(): Record<string, any> | null;
    setItemSelecionado(item: Record<string, any> | null): void;
    getIndiceSelecionado(): number | null;
    setIndiceSelecionado(idx: number | null): void;
    limparSelecao(): void;
    isItemSelecionado(item: Record<string, any>, index: number): boolean;
    atualizarLinhasSelecionadas(): void;
    rolarPara(idOuIndice: string | number | ((item: any, index: number) => boolean), opcoes?: UIRowScrollOptions): boolean;
}
