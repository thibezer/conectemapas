/* ==========================================================================
   ConecteMapas - BatchActions
   Ações em lote sobre uma lista de ids (resultado da busca avançada ou da seleção).
   Cada ação: pula feições bloqueadas/inexistentes, grava UM passo de histórico,
   persiste/sincroniza cada feição alterada e devolve um resumo.
   ========================================================================== */

const clone = (o) => JSON.parse(JSON.stringify(o));

/** Resolve ids em feições, separando as que serão alteradas das ignoradas. */
function resolveTargets(app, ids) {
  const byId = new Map(app.features.map(f => [f.id, f]));
  const targets = [];
  let locked = 0;
  let missing = 0;
  for (const id of new Set(ids || [])) {
    const feat = byId.get(id);
    if (!feat) missing++;
    else if (feat.locked === true) locked++;
    else targets.push(feat);
  }
  return { targets, locked, missing };
}

/**
 * Aplica `mutate` em cópias das feições alvo e grava o lote.
 * `mutate(draft, original)` devolve false para dispensar a feição (nada a mudar).
 */
function commitBatch(app, ids, label, mutate) {
  const { targets, locked, missing } = resolveTargets(app, ids);
  const drafts = [];
  let unchanged = 0;
  for (const feat of targets) {
    const draft = clone(feat);
    if (mutate(draft, feat) === false) unchanged++;
    else drafts.push(draft);
  }

  const summary = { changed: drafts.length, locked, missing, unchanged, skipped: locked + missing + unchanged, ids: drafts.map(d => d.id) };
  if (drafts.length === 0) return summary;

  app.pushHistory(`${label} (${drafts.length})`);
  const index = new Map(app.features.map((f, i) => [f.id, i]));
  for (const draft of drafts) {
    app.features[index.get(draft.id)] = draft;
    app.collabHub?.notifyFeatureUpdated(draft);
    app.saveFeature(draft);
  }
  // Re-renderiza de uma vez (a feição precisa trocar de sub-pane ao mudar de camada)
  app.refreshMapAndTable(true);
  return summary;
}

export class BatchActions {
  /**
   * Move feições para outra camada.
   * @param {Object} app
   * @param {string[]} ids
   * @param {string} layerId camada de destino (precisa existir)
   * @param {{inheritColor?: boolean}} [opts] inheritColor: adota a cor da camada de destino
   */
  static moveToLayer(app, ids, layerId, opts = {}) {
    const layer = app.layers.find(l => l.id === layerId);
    if (!layer) return { changed: 0, locked: 0, missing: 0, unchanged: 0, skipped: 0, ids: [], error: 'Camada de destino não encontrada.' };

    return commitBatch(app, ids, `Mover para "${layer.name}"`, (draft) => {
      if (draft.layerId === layerId && !opts.inheritColor) return false;
      draft.layerId = layerId;
      if (opts.inheritColor && layer.color) {
        BatchActions._paint(draft, { fillColor: layer.color, strokeColor: layer.color }, ['fillColor', 'strokeColor']);
      }
      return true;
    });
  }

  /**
   * Aplica cores. Linhas só recebem o traço, textos só a cor do texto (mesma regra do seletor de cores).
   * @param {{fillColor?: string, strokeColor?: string}} colors
   */
  static applyColors(app, ids, colors = {}) {
    const changed = ['fillColor', 'strokeColor'].filter(k => colors[k]);
    if (changed.length === 0) return { changed: 0, locked: 0, missing: 0, unchanged: 0, skipped: 0, ids: [] };
    return commitBatch(app, ids, 'Aplicar cores', (draft) => BatchActions._paint(draft, colors, changed));
  }

  static setLocked(app, ids, locked) {
    // Desbloquear precisa alcançar as feições bloqueadas, então não passa por resolveTargets
    if (locked) return commitBatch(app, ids, 'Bloquear', (d) => { d.locked = true; });
    const byId = new Map(app.features.map(f => [f.id, f]));
    const targets = [...new Set(ids || [])].filter(id => byId.get(id)?.locked === true);
    if (targets.length === 0) return { changed: 0, locked: 0, missing: 0, unchanged: 0, skipped: 0, ids: [] };
    app.pushHistory(`Desbloquear (${targets.length})`);
    for (const id of targets) {
      const idx = app.features.findIndex(f => f.id === id);
      const draft = clone(app.features[idx]);
      draft.locked = false;
      app.features[idx] = draft;
      app.collabHub?.notifyFeatureUpdated(draft);
      app.saveFeature(draft);
    }
    app.refreshMapAndTable(true);
    return { changed: targets.length, locked: 0, missing: 0, unchanged: 0, skipped: 0, ids: targets };
  }

  static setVisible(app, ids, visible) {
    return commitBatch(app, ids, visible ? 'Mostrar' : 'Ocultar', (d) => {
      if ((d.visible !== false) === visible) return false;
      d.visible = visible;
      return true;
    });
  }

  /** Define (ou cria) um atributo em feature.properties para todas as feições. */
  static setProperty(app, ids, key, value) {
    if (!key) return { changed: 0, locked: 0, missing: 0, unchanged: 0, skipped: 0, ids: [] };
    return commitBatch(app, ids, `Atributo "${key}"`, (d) => {
      if (d.properties && d.properties[key] === value) return false;
      d.properties = { ...(d.properties || {}), [key]: value };
      return true;
    });
  }

  /** Exclui em lote. A confirmação com o usuário fica a cargo da UI. */
  static remove(app, ids) {
    const { targets, locked, missing } = resolveTargets(app, ids);
    const summary = { changed: targets.length, locked, missing, unchanged: 0, skipped: locked + missing, ids: targets.map(f => f.id) };
    if (targets.length === 0) return summary;
    app.pushHistory(`Excluir (${targets.length})`);
    const gone = new Set(summary.ids);
    app.features = app.features.filter(f => !gone.has(f.id));
    for (const id of gone) {
      app.collabHub?.notifyFeatureDeleted(id);
      app.removeFeature(id);
    }
    app.refreshMapAndTable(true);
    return summary;
  }

  /** Texto curto para toast: "42 alteradas, 3 ignoradas (2 bloqueadas)". */
  static describe(summary, verb = 'alteradas') {
    const parts = [`${summary.changed} ${verb}`];
    if (summary.skipped > 0) {
      const why = [];
      if (summary.locked) why.push(`${summary.locked} bloqueada(s)`);
      if (summary.unchanged) why.push(`${summary.unchanged} já estavam assim`);
      if (summary.missing) why.push(`${summary.missing} inexistente(s)`);
      parts.push(`${summary.skipped} ignorada(s)${why.length ? ` (${why.join(', ')})` : ''}`);
    }
    return parts.join(', ');
  }

  static _paint(draft, colors, changed) {
    if (!draft.style) draft.style = {};
    const isLine = /LineString/.test(draft.type);
    let touched = false;
    if (changed.includes('fillColor') && !isLine) {
      if (draft.type === 'Text') draft.style.textColor = colors.fillColor;
      else draft.style.fillColor = colors.fillColor;
      draft.color = colors.fillColor;
      touched = true;
    }
    if (changed.includes('strokeColor') && draft.type !== 'Text') {
      draft.style.strokeColor = colors.strokeColor;
      if (isLine) draft.color = colors.strokeColor;
      touched = true;
    }
    return touched;
  }
}
