/* ==========================================================================
   ConecteMapas - LayerExpansion
   Quais camadas o operador deixou recolhidas no painel é preferência local: guardada em
   localStorage (`cm_collapsed_layers`) para sobreviver ao F5. Camadas sem registro nascem
   expandidas. Os ids de camadas que não estão carregadas agora (outros projetos) são mantidos.
   ========================================================================== */

const KEY = 'cm_collapsed_layers';

/** Ids de camadas recolhidas gravados (vazio se nunca gravado ou se o storage falhar). */
export function loadCollapsedLayers() {
  try {
    if (typeof localStorage === 'undefined') return new Set();
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return new Set(Array.isArray(list) ? list.filter(id => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

/**
 * Atualiza o registro a partir do estado atual do painel: as camadas carregadas que não estão em
 * `expanded` ficam recolhidas; as carregadas que estão em `expanded` saem do registro.
 * Devolve o novo conjunto (e o grava).
 */
export function saveCollapsedLayers(layerIds, expanded) {
  const ids = Array.isArray(layerIds) ? layerIds : [];
  const stored = loadCollapsedLayers();
  for (const id of ids) {
    if (expanded && expanded.has(id)) stored.delete(id);
    else stored.add(id);
  }
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify([...stored]));
  } catch {}
  return stored;
}
