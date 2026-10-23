/* ==========================================================================
   ConecteMapas - BatchActions
   Ações em lote sobre uma lista de ids (resultado da busca avançada ou da seleção).
   Cada ação: pula feições bloqueadas/inexistentes, grava UM passo de histórico,
   persiste/sincroniza cada feição alterada e devolve um resumo.
   ========================================================================== */

import { StorageService } from './StorageService.js';
import { SpatialAlgorithms } from './SpatialAlgorithms.js';
import { FeatureGeometryUtils } from './MapEngine/FeatureGeometryUtils.js';

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
  }
  app.saveFeaturesBulk(drafts);
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
    const changed = ['fillColor', 'strokeColor', 'fillOpacity', 'strokeWidth'].filter(k => colors[k] !== undefined);
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
    const index = new Map(app.features.map((f, i) => [f.id, i]));
    const drafts = [];
    for (const id of targets) {
      const idx = index.get(id);
      const draft = clone(app.features[idx]);
      draft.locked = false;
      app.features[idx] = draft;
      app.collabHub?.notifyFeatureUpdated(draft);
      drafts.push(draft);
    }
    app.saveFeaturesBulk(drafts);
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

  /**
   * Troca preenchimento e traço entre si. Linhas e textos têm uma cor só e ficam de fora.
   */
  static invertColors(app, ids) {
    return commitBatch(app, ids, 'Inverter cores', (d) => {
      if (/LineString/.test(d.type) || d.type === 'Text') return false;
      if (!d.style) d.style = {};
      const oldFill = d.style.fillColor !== undefined ? d.style.fillColor : (d.color || '#00E08A');
      const oldStroke = d.style.strokeColor !== undefined ? d.style.strokeColor : '#ffffff';
      if (oldFill === oldStroke) return false;
      d.style.fillColor = oldStroke;
      d.style.strokeColor = oldFill;
      if (oldStroke !== 'none') d.color = oldStroke;
      return true;
    });
  }

  /**
   * Remove vértices redundantes (Douglas-Peucker) de linhas e polígonos, anel por anel.
   * Anel que ficaria abaixo do mínimo de vértices é mantido como está.
   * @param {number} toleranceMeters
   */
  static simplify(app, ids, toleranceMeters = 5) {
    return commitBatch(app, ids, 'Simplificar geometria', (d) => {
      const isPoly = d.type === 'Polygon';
      if (!isPoly && d.type !== 'LineString') return false;
      const minVertices = isPoly ? 3 : 2;
      let coords = d.coordinates;
      for (const ring of FeatureGeometryUtils.getVertexRings(d)) {
        const simplified = SpatialAlgorithms.simplifyDouglasPeucker(ring.points, toleranceMeters, isPoly);
        if (Array.isArray(simplified) && simplified.length >= minVertices && simplified.length < ring.points.length) {
          coords = FeatureGeometryUtils.replaceRing(coords, ring.path, simplified, ring.closed);
        }
      }
      if (coords === d.coordinates) return false;
      d.coordinates = coords;
      return true;
    });
  }

  /**
   * Edição genérica (inspetor com várias feições selecionadas).
   * `mutate(draft, original)` devolve false quando nada muda naquela feição.
   */
  static edit(app, ids, label, mutate) {
    return commitBatch(app, ids, label, mutate);
  }

  /** Exclui em lote. A confirmação com o usuário fica a cargo da UI. */
  static remove(app, ids) {
    const { targets, locked, missing } = resolveTargets(app, ids);
    const summary = { changed: targets.length, locked, missing, unchanged: 0, skipped: locked + missing, ids: targets.map(f => f.id) };
    if (targets.length === 0) return summary;
    app.pushHistory(`Excluir (${targets.length})`);
    const gone = new Set(summary.ids);
    app.features = app.features.filter(f => !gone.has(f.id));
    for (const id of gone) app.collabHub?.notifyFeatureDeleted(id);
    app.removeFeaturesBulk(summary.ids);
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

  /** Guarda cor e estilo de cada feição para restaurar depois (ex.: "Cancelar" no seletor). */
  static snapshotStyles(features = []) {
    return new Map(features.map(f => [f.id, { color: f.color, style: clone(f.style || {}) }]));
  }

  /**
   * Devolve a cada feição o valor que ela tinha no snapshot, só nas propriedades indicadas.
   * Seleção com cores diferentes volta a ter cores diferentes (não recebe a cor de uma delas).
   * @param {Map<string, {color: string, style: Object}>} snapshots
   * @param {Array<'fillColor'|'strokeColor'|'fillOpacity'>} props
   */
  static restoreStyleProps(app, snapshots, props) {
    if (!snapshots?.size || !props?.length) return { changed: 0, locked: 0, missing: 0, unchanged: 0, skipped: 0, ids: [] };
    return commitBatch(app, [...snapshots.keys()], 'Restaurar cores', (draft) => BatchActions._restoreProps(draft, snapshots.get(draft.id), props));
  }

  static _restoreProps(draft, snap, props) {
    if (!snap) return false;
    const before = JSON.stringify([draft.color, draft.style]);
    const style = draft.style || (draft.style = {});
    const isLine = /LineString/.test(draft.type);
    const copy = (key) => {
      if (snap.style[key] === undefined) delete style[key];
      else style[key] = snap.style[key];
    };
    if (props.includes('fillColor') && !isLine) {
      ['fillColor', 'textColor', '_lastFillColor'].forEach(copy);
      draft.color = snap.color;
    }
    if (props.includes('strokeColor')) {
      ['strokeColor', '_lastStrokeColor'].forEach(copy);
      if (isLine) draft.color = snap.color;
    }
    if (props.includes('fillOpacity')) copy('fillOpacity');
    if (props.includes('strokeWidth')) copy('strokeWidth');
    return JSON.stringify([draft.color, draft.style]) !== before;
  }

  static _paint(draft, colors, changed) {
    if (!draft.style) draft.style = {};
    const isLine = /LineString/.test(draft.type);
    let touched = false;
    if (changed.includes('fillColor') && !isLine) {
      if (draft.type === 'Text') draft.style.textColor = colors.fillColor;
      else draft.style.fillColor = colors.fillColor;
      if (colors.fillColor && colors.fillColor !== 'none' && colors.fillColor !== 'transparent') {
        draft.color = colors.fillColor;
        draft.style._lastFillColor = colors.fillColor;
      }
      touched = true;
    }
    if (changed.includes('strokeColor') && draft.type !== 'Text') {
      draft.style.strokeColor = colors.strokeColor;
      if (colors.strokeColor && colors.strokeColor !== 'none' && colors.strokeColor !== 'transparent') {
        if (isLine) draft.color = colors.strokeColor;
        draft.style._lastStrokeColor = colors.strokeColor;
      }
      touched = true;
    }
    if (changed.includes('fillOpacity') && colors.fillOpacity !== undefined && !isLine) {
      draft.style.fillOpacity = Math.max(0, Math.min(1, Number(colors.fillOpacity)));
      touched = true;
    }
    return touched;
  }
}
