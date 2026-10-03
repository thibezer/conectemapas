import { isBrowser } from './core/ssr-safe';
export { isBrowser };
/**
 * Registra manualmente todos os componentes do kit caso ainda não estejam registrados.
 * Seguro para chamar múltiplas vezes ou no ciclo de montagem de frameworks client-side (Next.js 'use client', Vue onMounted, etc.).
 */
export declare function registrarTodosComponentes(): void;
