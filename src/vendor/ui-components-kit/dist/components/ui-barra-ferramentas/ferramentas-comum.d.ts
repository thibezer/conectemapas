import { FerramentaItem } from './tipos';
export type VarianteBotaoFerramenta = 'grande' | 'pequeno' | 'paleta';
export declare function criarIcone(icone: string | undefined, tamanho: number): HTMLElement | null;
export declare function textoTooltip(item: FerramentaItem): string;
export declare function aplicarEstadoBotao(btn: HTMLButtonElement, item: FerramentaItem): void;
export declare function criarBotaoFerramenta(item: FerramentaItem, variante: VarianteBotaoFerramenta, tamanhoIcone: number): HTMLButtonElement;
export declare function acharItem(itens: FerramentaItem[], id: string): FerramentaItem | undefined;
export declare function definirRoving(botoes: HTMLButtonElement[]): void;
/** Move o foco entre botões com as setas informadas. Retorna true se tratou a tecla. */
export declare function navegarRoving(e: KeyboardEvent, botoes: HTMLButtonElement[], teclasAnterior: string[], teclasProximo: string[]): boolean;
export interface OpcoesMenu {
    lado?: 'baixo' | 'direita';
    /** Foca o primeiro item ao abrir (abertura por teclado). */
    focar?: boolean;
    onFechar?: () => void;
}
export interface MenuHandle {
    elemento: HTMLElement;
    ancora: HTMLElement;
    fechar(): void;
}
export declare function abrirMenu(raiz: ShadowRoot, ancora: HTMLElement, itens: FerramentaItem[], onEscolher: (item: FerramentaItem) => void, opcoes?: OpcoesMenu): MenuHandle;
