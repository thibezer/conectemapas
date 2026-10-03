/**
 * Gerenciador de requisições remotas para <ui-tabela> (endpoint JSON)
 */
export interface ContextoTabelaRemota {
    host: HTMLElement;
    onCarregandoAlterado: (carregando: boolean) => void;
    onDadosRecebidos: (dados: Record<string, any>[]) => void;
}
export declare class TabelaRemotaController {
    private ctx;
    private autoFetchController;
    constructor(ctx: ContextoTabelaRemota);
    carregar(endpoint: string): Promise<void>;
    abortar(): void;
}
