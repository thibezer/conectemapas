import { CamadaItem } from './tipos';
export interface CamadaOverridePersistido {
    name?: string;
    visible?: boolean;
    locked?: boolean;
    opacity?: number;
    color?: string;
}
export interface EstadoPersistidoCamadas {
    versao: number;
    expandedLayerIds: string[];
    collapsedLayerIds: string[];
    camadaAtivaId?: string | null;
    painelColapsado?: boolean;
    ordemCamadasIds?: string[];
    mapaBaseAtivo?: string;
    densidade?: 'compacto' | 'normal';
    altura?: number | null;
    camadasOverrides?: Record<string, CamadaOverridePersistido>;
    ultimaAtualizacao?: number;
}
/**
 * Retorna a chave do localStorage para uma determinada instância
 */
export declare function gerarChaveStorage(chaveProp?: string | null, elementId?: string | null): string;
/**
 * Lê o estado persistido do localStorage com tolerância a falhas (SSR, restrições de sandbox)
 */
export declare function carregarEstadoPersistido(storageKey: string): EstadoPersistidoCamadas | null;
/**
 * Salva o estado atualizado no localStorage de forma segura
 */
export declare function salvarEstadoPersistido(storageKey: string, estado: EstadoPersistidoCamadas): void;
/**
 * Remove o estado persistido no localStorage
 */
export declare function limparEstadoPersistido(storageKey: string): void;
/**
 * Mescla o estado das camadas carregadas com os overrides persistidos pelo usuário
 */
export declare function reidratarCamadasComOverrides(camadas: CamadaItem[], estadoPersistido: EstadoPersistidoCamadas | null, expandedLayersSet: Set<string>): void;
