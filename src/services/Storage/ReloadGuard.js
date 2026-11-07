/* ==========================================================================
   ConecteMapas - ReloadGuard
   Trava anti-loop para recarregamentos automáticos: no máximo 1 a cada 60 s por aba.
   ========================================================================== */

const KEY = 'cm_last_auto_reload';
const MIN_INTERVAL_MS = 60000;

/** true se um recarregamento automático é permitido agora (e registra o instante). */
export function allowAutoReload(now = Date.now()) {
  try {
    if (typeof sessionStorage === 'undefined') return false;
    const last = Number(sessionStorage.getItem(KEY));
    if (Number.isFinite(last) && last > 0 && now - last < MIN_INTERVAL_MS) return false;
    sessionStorage.setItem(KEY, String(now));
    return true;
  } catch {
    return false; // sem storage não há como limitar: melhor não recarregar
  }
}
