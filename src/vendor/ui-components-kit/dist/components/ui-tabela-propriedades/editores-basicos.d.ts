import { ItemPropriedade, ContextoEditorPropriedade } from './tipos';
export declare function criarEditorReadonly(valorAtual: any): HTMLElement;
export declare function criarEditorBooleano(categoriaId: string, prop: ItemPropriedade, valorAtual: any, ctx: ContextoEditorPropriedade): HTMLElement;
export declare function criarEditorSelecao(categoriaId: string, prop: ItemPropriedade, valorAtual: any, ctx: ContextoEditorPropriedade): HTMLElement;
export declare function criarEditorAcao(categoriaId: string, prop: ItemPropriedade, ctx: ContextoEditorPropriedade): HTMLElement;
export declare function criarEditorNumero(categoriaId: string, prop: ItemPropriedade, valorAtual: any, ctx: ContextoEditorPropriedade): HTMLElement;
export declare function criarEditorTexto(categoriaId: string, prop: ItemPropriedade, valorAtual: any, ctx: ContextoEditorPropriedade): HTMLElement;
