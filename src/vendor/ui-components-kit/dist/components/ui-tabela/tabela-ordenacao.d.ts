import { UISortDetail } from './tipos';
/**
 * Alterna ciclicamente a ordenação tri-state:
 * Primeira vez -> 'asc'
 * Segunda vez -> 'desc'
 * Terceira vez -> 'original' (reseta)
 */
export declare function alternarDirecaoOrdenacao(colunaAtual: string | null, direcaoAtual: 'asc' | 'desc' | 'original', colunaClicada: string): UISortDetail;
/**
 * Ordena os dados em memória respeitando valores nulos/undefined, números e strings com collation pt-BR.
 */
export declare function aplicarOrdenacaoTabela(dadosOriginais: Record<string, any>[], colunaOrdenada: string | null, direcao: 'asc' | 'desc' | 'original'): Record<string, any>[];
