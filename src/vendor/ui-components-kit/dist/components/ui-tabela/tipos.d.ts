/**
 * Tipos e interfaces de configuração para a Tabela Técnica de Alta Densidade (<ui-tabela>).
 */
export type DensidadeTabela = 'compacta' | 'normal' | 'relaxada';
export interface TabelaColuna<T = any> {
    id: string;
    rotulo: string;
    largura?: string | number;
    larguraMinima?: string | number;
    larguraMaxima?: string | number;
    alinhamento?: 'esquerda' | 'centro' | 'direita' | 'left' | 'center' | 'right';
    ordenavel?: boolean;
    tooltip?: string;
    render?: (valor: any, item: T, index: number) => HTMLElement | string;
}
export interface UISortDetail {
    idColuna: string | null;
    direcao: 'asc' | 'desc' | 'original';
}
export interface UIColumnResizeDetail {
    idColuna: string;
    largura: string;
}
export interface UIRowScrollOptions {
    comportamento?: 'smooth' | 'auto';
    selecionar?: boolean;
}
