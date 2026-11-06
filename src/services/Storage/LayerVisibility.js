/* ==========================================================================
   ConecteMapas - LayerVisibility
   O "olhinho" da camada é preferência de cada operador: nunca vai para a nuvem
   nem é aceito de outros operadores. O valor vive só na cópia local da camada.
   ========================================================================== */

/** Camadas recebidas de fora: mantém o `visible` local de cada uma (camada nova nasce visível). */
export function mergeLocalVisibility(remoteLayers, localLayers = []) {
  if (!Array.isArray(remoteLayers)) return remoteLayers;
  const local = new Map((Array.isArray(localLayers) ? localLayers : []).filter(l => l && l.id).map(l => [l.id, l]));
  return remoteLayers.map((layer) => {
    if (!layer || typeof layer !== 'object') return layer;
    const known = local.get(layer.id);
    return { ...layer, visible: known ? known.visible !== false : true };
  });
}

/** Camada recebida de fora com o `visible` local (ou visível, se ainda não existir aqui). */
export function keepLocalVisibility(remoteLayer, localLayer) {
  return { ...remoteLayer, visible: localLayer ? localLayer.visible !== false : true };
}

/** Camadas para a nuvem: sem a preferência individual (sempre `visible: true`). */
export function layersForCloud(layers) {
  if (!Array.isArray(layers)) return [];
  return layers.map(l => (l && typeof l === 'object' ? { ...l, visible: true } : l));
}
