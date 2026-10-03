import { ItemLista } from './tipos';
/**
 * Navegação de foco e teclado acessível para UIListaFlutuante (padrão listbox)
 */
export declare class ListaFlutuanteTeclado {
    private listElement;
    private focusedIndex;
    constructor(listElement: HTMLUListElement);
    focarPrimeiroItem(): void;
    resetarFoco(): void;
    moverFoco(direcao: number): void;
    tratarKeydownLista(e: KeyboardEvent, itens: ItemLista[], onSelecionar: (item: ItemLista) => void, onFechar: () => void, button: HTMLButtonElement): void;
}
