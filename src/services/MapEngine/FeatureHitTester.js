/* ==========================================================================
   ConecteMapas - FeatureHitTester
   Hit-test unificado de feições (clique, hover e menu de contexto).

   Por que existe: com 'preferCanvas', cada camada tem seu próprio pane e,
   portanto, seu próprio <canvas> cobrindo o mapa inteiro. O canvas da camada
   do topo interceptava os cliques e as feições das camadas de baixo nunca
   eram selecionáveis. Os canvases agora não recebem eventos (CSS) e a seleção
   é resolvida aqui, em pixels de tela, sobre TODAS as camadas visíveis.

   Prioridade: pontos/textos > linhas > polígonos/círculos. Pontos e linhas
   desempatam pela camada mais ao topo; áreas pela menor (lote dentro de quadra).
   Cliques repetidos no mesmo lugar alternam entre as feições sobrepostas (estilo CAD).
   ========================================================================== */

import L from 'leaflet';

const LINE_TOLERANCE_PX = 6;
const POINT_TOLERANCE_PX = 4;
const CYCLE_RADIUS_PX = 4;

const KIND_PRIORITY = { marker: 0, line: 1, area: 2 };

export class FeatureHitTester {
  constructor(engine) {
    this.engine = engine;
    this._lastPick = null; // { point, ids, index }
  }

  /**
   * Retorna todas as feições sob o ponto, ordenadas por prioridade de seleção.
   * @param {L.LatLng} latlng
   * @returns {Array<Object>} feições
   */
  hitTestAll(latlng) {
    const engine = this.engine;
    const map = engine.map;
    if (!map || !latlng || !engine.featureRenderer) return [];

    const containerPoint = map.latLngToContainerPoint(latlng);
    const layerPoint = map.latLngToLayerPoint(latlng);
    const candidates = this._candidateFeatures(containerPoint);
    if (candidates.length === 0) return [];

    const layerOrder = new Map((engine.featureRenderer.allLayers || []).map((l, idx) => [l.id, idx]));
    const hits = [];

    for (const feat of candidates) {
      const leafLayer = engine.renderedFeatures.get(feat.id);
      if (!leafLayer || !map.hasLayer(leafLayer)) continue;

      const hit = this._testLayer(leafLayer, containerPoint, layerPoint);
      if (!hit) continue;

      hits.push({
        feat,
        priority: KIND_PRIORITY[hit.kind],
        order: layerOrder.has(feat.layerId) ? layerOrder.get(feat.layerId) : Number.MAX_SAFE_INTEGER,
        size: hit.size
      });
    }

    // Pontos e linhas: camada do topo primeiro. Áreas: a menor primeiro (o lote dentro da
    // quadra é o alvo provável mesmo com a quadra numa camada superior); o 2º clique alterna.
    hits.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (a.priority === KIND_PRIORITY.area) return (a.size - b.size) || (a.order - b.order);
      return (a.order - b.order) || (a.size - b.size);
    });
    return hits.map(h => h.feat);
  }

  /**
   * Feição mais relevante sob o ponto (sem alternância). Usada no hover e no menu de contexto.
   */
  pickTop(latlng) {
    const all = this.hitTestAll(latlng);
    return all[0] || null;
  }

  /**
   * Feição a selecionar em um clique. Cliques repetidos no mesmo pixel alternam
   * entre as feições empilhadas naquele ponto.
   */
  pickForClick(latlng) {
    const all = this.hitTestAll(latlng);
    if (all.length === 0) {
      this._lastPick = null;
      return null;
    }

    // Compara pela posição geográfica reprojetada agora: o auto-pan do popup move o mapa entre cliques
    const map = this.engine.map;
    const point = map.latLngToContainerPoint(latlng);
    const ids = all.map(f => f.id);
    const last = this._lastPick;
    let index = 0;
    if (last && map.latLngToContainerPoint(last.latlng).distanceTo(point) <= CYCLE_RADIUS_PX && last.ids.join('|') === ids.join('|')) {
      index = (last.index + 1) % ids.length;
    }
    this._lastPick = { latlng, ids, index };
    return all[index];
  }

  _candidateFeatures(containerPoint) {
    const map = this.engine.map;
    const pad = Math.max(LINE_TOLERANCE_PX, POINT_TOLERANCE_PX) + 24; // folga para ícones de marcador
    const sw = map.containerPointToLatLng([containerPoint.x - pad, containerPoint.y + pad]);
    const ne = map.containerPointToLatLng([containerPoint.x + pad, containerPoint.y - pad]);
    const bounds = L.latLngBounds(sw, ne);

    const index = this.engine.spatialIndex;
    if (index && typeof index.query === 'function' && index.size > 0) {
      return index.query(bounds, 0) || [];
    }
    // Fallback sem índice: varre apenas o que está renderizado
    const list = [];
    this.engine.renderedFeatures.forEach(layer => {
      if (layer && layer._cmFeature) list.push(layer._cmFeature);
    });
    return list;
  }

  _testLayer(leafLayer, containerPoint, layerPoint) {
    // Marcadores DOM (ícones SVG e textos): usa o retângulo real do ícone
    if (leafLayer instanceof L.Marker) {
      const icon = leafLayer._icon;
      if (!icon) return null;
      const mapRect = this.engine.map.getContainer().getBoundingClientRect();
      const r = icon.getBoundingClientRect();
      const x = containerPoint.x + mapRect.left;
      const y = containerPoint.y + mapRect.top;
      const t = POINT_TOLERANCE_PX;
      if (x >= r.left - t && x <= r.right + t && y >= r.top - t && y <= r.bottom + t) {
        return { kind: 'marker', size: r.width * r.height };
      }
      return null;
    }

    // Círculos (Circle em metros e CircleMarker em pixels)
    if (leafLayer instanceof L.CircleMarker) {
      if (!leafLayer._point) return null;
      const radius = leafLayer._radius || 0;
      const dist = layerPoint.distanceTo(leafLayer._point);
      const isPoint = !(leafLayer instanceof L.Circle);
      const tolerance = isPoint ? POINT_TOLERANCE_PX : this._strokeTolerance(leafLayer);
      if (dist <= radius + tolerance) {
        return { kind: isPoint ? 'marker' : 'area', size: radius * radius };
      }
      return null;
    }

    if (leafLayer instanceof L.Polyline) {
      const parts = leafLayer._parts;
      if (!parts || parts.length === 0) return null;
      const isArea = leafLayer instanceof L.Polygon;
      const tolerance = this._strokeTolerance(leafLayer);

      if (isArea && this._pointInParts(layerPoint, parts)) {
        return { kind: 'area', size: this._pixelBoundsArea(leafLayer) };
      }
      if (this._nearParts(layerPoint, parts, isArea, tolerance)) {
        return { kind: isArea ? 'area' : 'line', size: this._pixelBoundsArea(leafLayer) };
      }
      return null;
    }

    return null;
  }

  _strokeTolerance(leafLayer) {
    const weight = leafLayer.options && leafLayer.options.weight ? leafLayer.options.weight : 2;
    return weight / 2 + LINE_TOLERANCE_PX;
  }

  _nearParts(p, parts, closed, tolerance) {
    for (const part of parts) {
      const len = part.length;
      if (len === 0) continue;
      if (len === 1) {
        if (p.distanceTo(part[0]) <= tolerance) return true;
        continue;
      }
      for (let i = 0, j = len - 1; i < len; j = i++) {
        if (!closed && i === 0) continue;
        if (L.LineUtil.pointToSegmentDistance(p, part[j], part[i]) <= tolerance) return true;
      }
    }
    return false;
  }

  // Regra par-ímpar sobre todos os anéis: furos (anéis internos) ficam corretamente de fora
  _pointInParts(p, parts) {
    let inside = false;
    for (const part of parts) {
      for (let i = 0, len = part.length, j = len - 1; i < len; j = i++) {
        const a = part[i];
        const b = part[j];
        if (((a.y > p.y) !== (b.y > p.y)) && (p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x)) {
          inside = !inside;
        }
      }
    }
    return inside;
  }

  _pixelBoundsArea(leafLayer) {
    const b = leafLayer._pxBounds;
    if (!b || !b.min || !b.max) return Number.MAX_SAFE_INTEGER;
    return Math.max(1, (b.max.x - b.min.x) * (b.max.y - b.min.y));
  }
}
