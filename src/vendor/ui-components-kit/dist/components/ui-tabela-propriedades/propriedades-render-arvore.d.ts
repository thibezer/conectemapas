import { ItemPropriedade, CategoriaPropriedades } from './tipos';
import { ContextoEditorPropriedade } from './propriedades-editores';
export interface ContextoLinhaPropriedade {
    valoresAtuais: Record<string, any>;
    valoresOriginais: Record<string, any>;
    isDirty: boolean;
    editorCtx: ContextoEditorPropriedade;
    onAtualizarCampoVisual: (propId: string, novoValor: any) => void;
}
export interface OpcoesRenderArvore {
    listaContainer: HTMLElement;
    categorias: CategoriaPropriedades[];
    termoBusca: string;
    onToggleCategoria: (idCategoria: string) => void;
    linhaCtx: ContextoLinhaPropriedade;
}
/**
 * Renderiza todas as categorias e suas propriedades filtradas
 */
export declare function renderizarCategoriasETree(opcoes: OpcoesRenderArvore): void;
/**
 * Cria a linha individual de uma propriedade com rótulo, scrubber e editor
 */
export declare function criarLinhaPropriedade(categoriaId: string, prop: ItemPropriedade, ctx: ContextoLinhaPropriedade): HTMLDivElement;
