import { ItemPropriedade, ContextoEditorPropriedade } from './tipos';
export * from './editores-basicos';
export * from './editores-cad';
export type { ContextoEditorPropriedade } from './tipos';
export declare function criarEditorValor(categoriaId: string, prop: ItemPropriedade, valorAtual: any, ctx: ContextoEditorPropriedade): HTMLElement;
