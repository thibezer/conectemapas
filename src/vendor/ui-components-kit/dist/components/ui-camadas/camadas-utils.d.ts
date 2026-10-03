/**
 * Escapa caracteres HTML perigosos para prevenir ataques XSS
 */
export declare function escapeHtml(str: string | null | undefined): string;
/**
 * Sanitiza e valida cor para interpolação segura em inline styles e variáveis CSS
 */
export declare function sanitizarCorCss(cor: string | null | undefined, fallback?: string): string;
/**
 * Cria uma função com debounce para limitar disparos de alta frequência (ex: busca rápida)
 */
export declare function debounce<T extends (...args: any[]) => void>(fn: T, delayMs?: number): (...args: Parameters<T>) => void;
