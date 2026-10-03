import { ItemPropriedade, ContextoEditorPropriedade } from './tipos';
/**
 * Editor Tipo de Linha CAD (Linetype com preview SVG em tempo real)
 */
export declare function criarEditorLinetype(categoriaId: string, prop: ItemPropriedade, valorAtual: any, ctx: ContextoEditorPropriedade): HTMLElement;
/**
 * Editor Espessura de Linha CAD (Lineweight com espessura SVG proporcional)
 */
export declare function criarEditorLineweight(categoriaId: string, prop: ItemPropriedade, valorAtual: any, ctx: ContextoEditorPropriedade): HTMLElement;
/**
 * Editor Cor CAD (ByLayer, ByBlock, Cores Indexadas ACI e Hexadecimal)
 */
export declare function criarEditorCorCad(categoriaId: string, prop: ItemPropriedade, valorAtual: any, ctx: ContextoEditorPropriedade): HTMLElement;
/**
 * Editor Cor Padrão (Swatch com Color Picker Nativo)
 */
export declare function criarEditorCorSwatch(categoriaId: string, prop: ItemPropriedade, valorAtual: any, ctx: ContextoEditorPropriedade): HTMLElement;
