import { CategoriaPropriedades } from './tipos';
export interface ContextoGerenciadorValores {
    hostElement: HTMLElement;
    getCategorias: () => CategoriaPropriedades[];
    onAtualizarBotoesFooter: (dirty: boolean) => void;
    onAtualizarCampoVisual: (propId: string, novoValor: any) => void;
    onRenderCategorias: () => void;
    isModoManual: () => boolean;
}
export declare class GerenciadorValoresPropriedades {
    private ctx;
    private valoresOriginais;
    private valoresAtuais;
    private dirty;
    constructor(ctx: ContextoGerenciadorValores);
    inicializarCategorias(categorias: CategoriaPropriedades[]): void;
    get isDirty(): boolean;
    getValores(): Record<string, any>;
    setValores(novosValores: Record<string, any>): void;
    obterValor(propId: string): any;
    definirValor(propId: string, novoValor: any, emitirEvento?: boolean): void;
    registrarAlteracao(categoriaId: string, propId: string, novoValor: any): void;
    aplicar(): void;
    desfazer(): void;
    private emitirAlteracao;
}
