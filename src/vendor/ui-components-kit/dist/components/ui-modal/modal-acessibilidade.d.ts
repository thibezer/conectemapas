/**
 * Utilitários de Acessibilidade WAI-ARIA e Gerenciamento de 'inert' para UIModal / UIDialog.
 */
/**
 * Aplica o atributo 'inert' em todos os elementos da página que estejam "atrás" do modal,
 * isolando o modal para tecnologias assistivas e interação de teclado/mouse.
 */
export declare function aplicarInertForaDoModal(modalElement: HTMLElement): Set<HTMLElement>;
/**
 * Remove o estado 'inert' dos elementos afetados pelo modal quando este é fechado.
 */
export declare function removerInertForaDoModal(elementosAfetados: Set<HTMLElement>): void;
