/**
 * Gerenciador utilitário de Event Listeners compartilhado para Web Components.
 * Rastreia todas as assinaturas de eventos e garante remoção atômica no disconnectedCallback,
 * prevenindo vazamentos de memória e duplicação de handlers.
 */
export declare class ListenerBag {
    private entries;
    /**
     * Adiciona um ouvinte de evento e rastreia sua referência para limpeza futura.
     * Suporta handlers tipados (MouseEvent, KeyboardEvent, CustomEvent, etc.).
     */
    add<E extends Event = Event>(target: EventTarget | null | undefined, type: string, listener: ((evt: E) => void) | EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    /**
     * Remove todos os ouvintes de eventos atualmente registrados e esvazia a coleção.
     */
    cleanup(): void;
    /**
     * Retorna a quantidade de ouvintes ativos rastreados.
     */
    get size(): number;
}
