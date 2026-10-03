import { CategoriaPropriedades } from './tipos';
export declare function focarProximoEditor(shadow: ShadowRoot, atual: HTMLElement): void;
export declare function atualizarCampoVisual(shadow: ShadowRoot, propId: string, novoValor: any): void;
export declare function expandirTodasCategorias(shadow: ShadowRoot, categorias: CategoriaPropriedades[]): void;
export declare function colapsarTodasCategorias(shadow: ShadowRoot, categorias: CategoriaPropriedades[]): void;
export declare function alternarCategoria(shadow: ShadowRoot, host: HTMLElement, categorias: CategoriaPropriedades[], idCategoria: string): void;
