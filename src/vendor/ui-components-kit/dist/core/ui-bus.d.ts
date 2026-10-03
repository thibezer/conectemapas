import { UIToastOpcoes } from '../components/ui-alerta';
export interface UIBusEventsMap {
    'modal:aberto': {
        id: string;
    };
    'modal:fechado': {
        id: string;
    };
    'modal:fechado-todos': void;
    'drawer:aberto': {
        id: string;
    };
    'drawer:fechado': {
        id: string;
    };
    'drawer:fechado-todos': void;
    'clipboard:copiado': {
        texto: string;
    };
    'densidade:alterada': {
        densidade: 'compacta' | 'normal' | 'padrao' | 'relaxada' | number;
        alturaPx: number;
    };
    'tema:alterado': {
        tema: 'claro' | 'escuro';
    };
}
export type UIEmitterCallback<T = any> = (dados?: T) => void;
declare class UIBusManager {
    private listeners;
    /**
     * Registra um ouvinte para um canal ou evento global tipado.
     */
    on<K extends keyof UIBusEventsMap>(evento: K, callback: UIEmitterCallback<UIBusEventsMap[K]>): () => void;
    on<T = any>(evento: string, callback: UIEmitterCallback<T>): () => void;
    /**
     * Registra um ouvinte que será executado apenas uma única vez.
     */
    once<K extends keyof UIBusEventsMap>(evento: K, callback: UIEmitterCallback<UIBusEventsMap[K]>): void;
    once<T = any>(evento: string, callback: UIEmitterCallback<T>): void;
    /**
     * Remove um ouvinte previamente registrado.
     */
    off<K extends keyof UIBusEventsMap>(evento: K, callback: UIEmitterCallback<UIBusEventsMap[K]>): void;
    off<T = any>(evento: string, callback: UIEmitterCallback<T>): void;
    /**
     * Emite um evento com dados para todos os ouvintes inscritos.
     */
    emit<K extends keyof UIBusEventsMap>(evento: K, dados?: UIBusEventsMap[K]): void;
    emit<T = any>(evento: string, dados?: T): void;
    /**
     * Abre um modal pelo seu ID no documento.
     */
    abrirModal(idModal: string): boolean;
    /**
     * Fecha um modal pelo seu ID ou todos os modais abertos se nenhum ID for passado.
     */
    fecharModal(idModal?: string): boolean;
    /**
     * Abre um painel lateral (drawer / sheet) pelo seu ID no documento.
     */
    abrirDrawer(idDrawer: string): boolean;
    /**
     * Fecha um painel lateral (drawer / sheet) pelo seu ID ou todos se nenhum for passado.
     */
    fecharDrawer(idDrawer?: string): boolean;
    /**
     * Dispara uma notificação toast flutuante inteligente.
     */
    notificar(opcoes: UIToastOpcoes | string): void;
    /**
     * Copia um texto para a área de transferência do usuário e exibe feedback opcional.
     */
    copiar(texto: string, mensagemFeedback?: string): Promise<boolean>;
    /**
     * Altera a densidade visual global do kit (compacta, normal ou relaxada).
     */
    definirDensidade(densidade: 'compacta' | 'normal' | 'padrao' | 'relaxada' | number): void;
    /**
     * Alterna ou define o tema visual global.
     */
    definirTema(tema?: 'claro' | 'escuro'): string;
}
export declare const UIBus: UIBusManager;
export {};
