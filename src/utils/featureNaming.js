/* ==========================================================================
   ConecteMapas - Nomes padrão de feição
   "Polígono 1", "Polígono 2"... por tipo, seguindo o maior número já usado
   no projeto (aceita também o formato antigo "Polígono #526").
   ========================================================================== */

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Próximo nome livre para o prefixo (ex.: "Ponto") entre as feições do projeto. */
export function nextFeatureName(features, prefix) {
  const pattern = new RegExp(`^${escapeRegex(prefix)} #?(\\d+)$`);
  let max = 0;
  const list = Array.isArray(features) ? features : [];
  for (let i = 0; i < list.length; i++) {
    const m = pattern.exec(list[i]?.name || '');
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix} ${max + 1}`;
}
