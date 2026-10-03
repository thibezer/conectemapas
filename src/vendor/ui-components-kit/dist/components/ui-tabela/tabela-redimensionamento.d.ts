import { TabelaColuna } from './tipos';
export interface IniciarRedimensionamentoContexto {
    evento: MouseEvent;
    coluna: TabelaColuna;
    colIndex: number;
    thElement: HTMLTableCellElement;
    resizer: HTMLDivElement;
    colgroupElement: HTMLTableColElement | null;
    onResizeStart: () => void;
    onResizeEnd: (larguraFinal: string) => void;
}
/**
 * Gerencia o ciclo de eventos de drag-to-resize de uma coluna da tabela.
 */
export declare function iniciarRedimensionamentoColuna(ctx: IniciarRedimensionamentoContexto): () => void;
export interface ExibirPromptPopoverContexto {
    evento: MouseEvent;
    coluna: TabelaColuna;
    colIndex: number;
    thElement: HTMLTableCellElement;
    colgroupElement: HTMLTableColElement | null;
    shadow: ShadowRoot;
    onResizeEnd: (larguraFinal: string) => void;
}
/**
 * Exibe o diálogo popover para ajuste numérico preciso da largura da coluna.
 */
export declare function exibirPromptPopoverRedimensionamento(ctx: ExibirPromptPopoverContexto): void;
