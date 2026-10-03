import { ItemLista } from './tipos';
/**
 * Renderiza os itens <li> na lista do listbox
 */
export declare function renderizarItensLista(listElement: HTMLUListElement, itens: ItemLista[], valorAtual: string): void;
/**
 * Atualiza classes visuais de item selecionado sem recriar os elementos <li>
 */
export declare function atualizarEstadoSelecaoLista(listElement: HTMLUListElement, valorAtual: string): void;
