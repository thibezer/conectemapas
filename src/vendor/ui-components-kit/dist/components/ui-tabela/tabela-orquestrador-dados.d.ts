import { TabelaColuna, UISortDetail } from './tipos';
export declare class TabelaOrquestradorDados {
    private dadosOriginais;
    private dadosExibicao;
    private colunaOrdenada;
    private direcaoOrdenacao;
    private ultimoFiltro;
    getDadosOriginais(): Record<string, any>[];
    setDadosOriginais(dados: Record<string, any>[]): void;
    getDadosExibicao(): Record<string, any>[];
    getColunaOrdenada(): string | null;
    setColunaOrdenada(id: string | null): void;
    getDirecaoOrdenacao(): 'asc' | 'desc' | 'original';
    setDirecaoOrdenacao(dir: 'asc' | 'desc' | 'original'): void;
    alternarOrdenacaoColuna(coluna: TabelaColuna): UISortDetail | null;
    aplicarOrdenacao(): void;
    filtrar(termo: string): void;
}
