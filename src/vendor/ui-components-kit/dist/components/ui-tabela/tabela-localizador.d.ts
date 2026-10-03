/**
 * Localiza o índice de um item pelo ID, chave customizada, predicado funcional ou índice direto.
 */
export declare function localizarIndiceItem(dados: Record<string, any>[], idOuIndice: string | number | ((item: any, idx: number) => boolean), chaveId?: string): number;
