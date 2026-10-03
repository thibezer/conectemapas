/**
 * Localiza todos os elementos focáveis dentro do Shadow DOM e nos slots associados.
 */
export declare function obterElementosFocaveis(shadowRoot: ShadowRoot, _hostElement?: HTMLElement): HTMLElement[];
/**
 * Verifica se a instância é o drawer/sheet no topo da pilha de abertos.
 */
export declare function isTopMostDrawer(elemento: HTMLElement): boolean;
/**
 * Aplica a armadilha de foco (Focus Trap) para navegação estrita com a tecla Tab.
 */
export declare function gerenciarTabTrap(e: KeyboardEvent, focables: HTMLElement[], hostElement: HTMLElement, shadowRoot: ShadowRoot): void;
/**
 * Controla o bloqueio de rolagem do body quando drawers ou modais estão visíveis.
 */
export declare function atualizarScrollLockDrawer(): void;
