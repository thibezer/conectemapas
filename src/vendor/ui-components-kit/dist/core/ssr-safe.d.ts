/**
 * Utilitários para compatibilidade universal com Server-Side Rendering (SSR).
 * Permite que módulos e classes de Web Components sejam importados em ambientes Node.js
 * (Next.js App/Pages Router, Nuxt, Remix, Astro, SvelteKit) sem lançar ReferenceError
 * quando HTMLElement, customElements, window ou document não estiverem disponíveis.
 */
export declare const isBrowser: boolean;
/**
 * Base segura para Custom Elements no ambiente Node.js / SSR.
 * No navegador, retorna o HTMLElement nativo da janela.
 * No Node.js (SSR), provê uma classe vazia de fallback para que a instrução
 * `class MinhaClasse extends SafeHTMLElement` seja avaliada sem erro durante imports no servidor.
 */
export declare const SafeHTMLElement: typeof HTMLElement;
/**
 * Registra um Custom Element de forma segura.
 * No navegador, executa customElements.define caso a tag ainda não esteja registrada.
 * No servidor (Node.js/SSR), a operação é ignorada silenciosamente sem ReferenceError.
 */
export declare function definirCustomElement(tag: string, construtor: CustomElementConstructor): void;
