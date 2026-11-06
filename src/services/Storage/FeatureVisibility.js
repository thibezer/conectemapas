/* ==========================================================================
   ConecteMapas - FeatureVisibility
   O "olhinho" da feição é preferência de cada operador: nunca vai para a nuvem nem é
   aceito de outros. A fonte da verdade é um conjunto de ids ocultos por projeto,
   guardado em localStorage (`cm_hidden_features_<projeto>`), e `feature.visible` é
   derivado dele sempre que a feição entra no app (carga local, nuvem, colaboração).
   ========================================================================== */

const KEY_PREFIX = 'cm_hidden_features_';
const PERSIST_DELAY_MS = 250;

const _sets = new Map();      // projectId -> Set<id> (cache em memória)
const _timers = new Map();    // projectId -> timeout da gravação agendada

const pid = (projectId) => projectId || 'projeto_padrao';
const keyOf = (projectId) => `${KEY_PREFIX}${pid(projectId)}`;

function readStored(projectId) {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(keyOf(projectId));
    if (raw === null) return null;
    const list = JSON.parse(raw);
    return new Set(Array.isArray(list) ? list : []);
  } catch {
    return null;
  }
}

/** Conjunto em memória (carrega do localStorage na primeira vez; vazio se nunca gravado). */
function hiddenSet(projectId) {
  const p = pid(projectId);
  let set = _sets.get(p);
  if (!set) {
    set = readStored(p) || new Set();
    _sets.set(p, set);
  }
  return set;
}

function persistNow(projectId) {
  const p = pid(projectId);
  const timer = _timers.get(p);
  if (timer) { clearTimeout(timer); _timers.delete(p); }
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(keyOf(p), JSON.stringify([...hiddenSet(p)]));
  } catch { /* cota cheia ou bloqueado: vale só nesta sessão */ }
}

function schedulePersist(projectId) {
  const p = pid(projectId);
  if (_timers.has(p)) return;
  _timers.set(p, setTimeout(() => { _timers.delete(p); persistNow(p); }, PERSIST_DELAY_MS));
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('pagehide', () => { for (const p of [..._timers.keys()]) persistNow(p); });
}

export class FeatureVisibility {
  /** Já existe preferência gravada para o projeto? */
  static exists(projectId) {
    const p = pid(projectId);
    if (_sets.has(p) && _timers.has(p)) return true;
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem(keyOf(p)) !== null;
    } catch {
      return _sets.has(p);
    }
  }

  /** Migração: na 1ª vez, aproveita o que este aparelho já tinha oculto nas feições locais. */
  static seedIfMissing(projectId, features) {
    if (this.exists(projectId) || !Array.isArray(features)) return;
    const set = new Set();
    for (const f of features) if (f && f.id && f.visible === false) set.add(f.id);
    _sets.set(pid(projectId), set);
    persistNow(projectId);
  }

  static isHidden(projectId, id) {
    return hiddenSet(projectId).has(id);
  }

  /** Registra a escolha local (visible === false oculta). Aceita uma feição ou uma lista. */
  static record(projectId, featureOrList) {
    const list = Array.isArray(featureOrList) ? featureOrList : [featureOrList];
    const set = hiddenSet(projectId);
    let changed = false;
    for (const f of list) {
      if (!f || !f.id) continue;
      if (f.visible === false) {
        if (!set.has(f.id)) { set.add(f.id); changed = true; }
      } else if (set.delete(f.id)) {
        changed = true;
      }
    }
    if (changed) schedulePersist(projectId);
    return changed;
  }

  /** Remove da preferência feições excluídas. */
  static forget(projectId, ids) {
    const set = hiddenSet(projectId);
    let changed = false;
    for (const id of ids || []) if (set.delete(id)) changed = true;
    if (changed) schedulePersist(projectId);
  }

  /** Recria a preferência a partir da lista atual (usado após desfazer/refazer). */
  static syncFromFeatures(projectId, features) {
    const set = new Set();
    for (const f of features || []) if (f && f.id && f.visible === false) set.add(f.id);
    _sets.set(pid(projectId), set);
    schedulePersist(projectId);
  }

  /** Feição com o `visible` local (a mesma referência quando nada muda; cópia só se precisar). */
  static apply(projectId, feature) {
    if (!feature || typeof feature !== 'object' || !feature.id) return feature;
    const hidden = hiddenSet(projectId).has(feature.id);
    if (hidden) return feature.visible === false ? feature : { ...feature, visible: false };
    return feature.visible === false ? { ...feature, visible: true } : feature;
  }

  static applyAll(projectId, features) {
    if (!Array.isArray(features)) return features;
    const set = hiddenSet(projectId);
    if (set.size === 0 && !features.some(f => f && f.visible === false)) return features;
    return features.map(f => this.apply(projectId, f));
  }

  /** Para a nuvem: feição sem o campo `visible`. */
  static stripForCloud(feature) {
    if (!feature || typeof feature !== 'object' || !('visible' in feature)) return feature;
    const { visible, ...rest } = feature;
    return rest;
  }

  static flush(projectId) {
    if (projectId) persistNow(projectId);
    else for (const p of [..._timers.keys()]) persistNow(p);
  }

  /** Só para testes. */
  static _reset() {
    for (const t of _timers.values()) clearTimeout(t);
    _timers.clear();
    _sets.clear();
  }
}
