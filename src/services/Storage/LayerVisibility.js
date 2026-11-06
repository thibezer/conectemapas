/* ==========================================================================
   ConecteMapas - LayerVisibility
   Preferências de VISUALIZAÇÃO da camada (olhinho `visible` e `opacity`) são de cada operador:
   nunca vão para a nuvem como mudança nem são aceitas de outros operadores. O valor vive só
   na cópia local da camada; a nuvem guarda apenas o valor inicial de uma camada nova.
   ========================================================================== */

/** Campos compartilhados da camada (o que, mudando, precisa ir para a nuvem). */
const SHARED_FIELDS = ['name', 'color', 'type', 'order'];

/** Valor local de `visible`/`opacity` (camada desconhecida aqui: visível, opacidade vinda de fora). */
function localView(remote, known) {
  const view = { visible: known ? known.visible !== false : true };
  if (known) {
    if (known.opacity !== undefined) view.opacity = known.opacity;
    else if (remote.opacity !== undefined) view.opacity = remote.opacity;
  }
  return view;
}

/** Camadas recebidas de fora: mantém `visible` e `opacity` locais (camada nova nasce visível, com a opacidade inicial). */
export function mergeLocalVisibility(remoteLayers, localLayers = []) {
  if (!Array.isArray(remoteLayers)) return remoteLayers;
  const local = new Map((Array.isArray(localLayers) ? localLayers : []).filter(l => l && l.id).map(l => [l.id, l]));
  return remoteLayers.map((layer) => {
    if (!layer || typeof layer !== 'object') return layer;
    return { ...layer, ...localView(layer, local.get(layer.id)) };
  });
}

/** Uma camada recebida de fora com as preferências locais de visualização (ou iniciais, se ainda não existe aqui). */
export function keepLocalVisibility(remoteLayer, localLayer) {
  return { ...remoteLayer, ...localView(remoteLayer, localLayer) };
}

/** Camadas para a nuvem: sem a preferência individual de `visible` (sempre true). A opacidade só vale na criação. */
export function layersForCloud(layers) {
  if (!Array.isArray(layers)) return [];
  return layers.map(l => (l && typeof l === 'object' ? { ...l, visible: true } : l));
}

/** Base da assinatura de metadados: alternar olhinho ou opacidade não é mudança do projeto. */
export function layersForSignature(layers) {
  if (!Array.isArray(layers)) return [];
  return layers.map(l => (l && typeof l === 'object' ? { ...l, visible: true, opacity: 1 } : l));
}

/** Assinatura dos campos compartilhados de UMA camada (detecta se ela mudou desde a última confirmação). */
export function sharedLayerSignature(layer) {
  if (!layer || typeof layer !== 'object') return '';
  return JSON.stringify(SHARED_FIELDS.map(k => layer[k] ?? null));
}

/**
 * Só as camadas cujos campos compartilhados mudaram desde a última confirmação da nuvem (ou ainda
 * desconhecidas). Evita que uma cópia desatualizada de uma camada sobrescreva a edição de um colega.
 * Sem base conhecida (`baseline` vazio), devolve todas.
 */
export function changedLayers(layers, baseline) {
  if (!Array.isArray(layers)) return [];
  if (!(baseline instanceof Map) || baseline.size === 0) return layers;
  return layers.filter(l => l && baseline.get(l.id) !== sharedLayerSignature(l));
}

/** Base nova (id -> assinatura) a partir de uma lista de camadas confirmadas. */
export function baselineFrom(layers, previous = null) {
  const map = previous instanceof Map ? previous : new Map();
  for (const l of Array.isArray(layers) ? layers : []) {
    if (l && l.id) map.set(l.id, sharedLayerSignature(l));
  }
  return map;
}
