/* ==========================================================================
   ConecteMapas - SpatialIndex (R-Tree Spatial Indexer via RBush)
   Responsabilidade Única: Indexação espacial hierárquica baseada em R-Tree 2D
   (OMT Bulk-Loading e busca em O(log N)) para Viewport Culling ultra-rápido.
   Substitui varredura linear O(N) para garantir 60 FPS durante Pan e Zoom
   mesmo sob estresse de 10.000 a 100.000 feições.
   ========================================================================== */

import RBush from 'rbush';

export class SpatialIndex {
  constructor() {
    this.tree = new RBush();
    this.idMap = new Map(); // Map<id, entry>
  }

  static computeBounds(feat) {
    if (!feat) return null;
    const rawCoords = feat.coordinates || feat.geometry?.coordinates;
    const type = feat.type || feat.geometry?.type || 'Point';
    if (!rawCoords) return null;

    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;

    const expand = (lat, lng) => {
      const nLat = Number(lat);
      const nLng = Number(lng);
      if (!isNaN(nLat) && !isNaN(nLng) && isFinite(nLat) && isFinite(nLng)) {
        if (nLat < minLat) minLat = nLat;
        if (nLat > maxLat) maxLat = nLat;
        if (nLng < minLng) minLng = nLng;
        if (nLng > maxLng) maxLng = nLng;
      }
    };

    if (type === 'Point') {
      const c = rawCoords;
      if (c && typeof c === 'object' && !Array.isArray(c)) {
        expand(c.lat ?? c.latitude, c.lng ?? c.longitude);
      } else if (Array.isArray(c) && c.length >= 2) {
        expand(c[0], c[1]);
      }
    } else if (type === 'Circle') {
      const c = rawCoords;
      const lat = (c && typeof c === 'object' && !Array.isArray(c)) ? (c.lat ?? c.latitude) : (Array.isArray(c) ? c[0] : null);
      const lng = (c && typeof c === 'object' && !Array.isArray(c)) ? (c.lng ?? c.longitude) : (Array.isArray(c) ? c[1] : null);
      const rDeg = (Number(feat.radius) || 500) / 111320;
      if (lat !== null && lng !== null) {
        expand(Number(lat) - rDeg, Number(lng) - rDeg);
        expand(Number(lat) + rDeg, Number(lng) + rDeg);
      }
    } else if (Array.isArray(rawCoords)) {
      const scanPoints = (coords) => {
        if (!Array.isArray(coords) || coords.length === 0) return;
        if (typeof coords[0] === 'number' || (typeof coords[0] === 'string' && !isNaN(Number(coords[0])))) {
          expand(coords[0], coords[1]);
        } else if (coords[0] && typeof coords[0] === 'object' && !Array.isArray(coords[0])) {
          coords.forEach(p => {
            if (p) expand(p.lat ?? p.latitude, p.lng ?? p.longitude);
          });
        } else if (Array.isArray(coords[0])) {
          coords.forEach(sub => scanPoints(sub));
        }
      };
      scanPoints(rawCoords);
    }

    if (minLat === Infinity || maxLat === -Infinity || minLng === Infinity || maxLng === -Infinity) {
      return null;
    }
    return { minLat, minLng, maxLat, maxLng };
  }

  /**
   * Constrói o índice espacial em lote utilizando o algoritmo OMT (Overlap Minimizing Top-down)
   * do RBush, alcançando O(N log N) e sub-100ms para 100.000 feições.
   * @param {Array<Object>} features
   * @param {boolean} force
   */
  build(features, force = false) {
    if (!force && Array.isArray(features) && this.idMap.size === features.length && this.idMap.size > 0) {
      return;
    }
    this.clear();
    if (!Array.isArray(features) || features.length === 0) return;

    const entries = [];
    const len = features.length;
    for (let i = 0; i < len; i++) {
      const feat = features[i];
      if (!feat || !feat.id) continue;
      const bbox = SpatialIndex.computeBounds(feat);
      if (!bbox) continue;

      const entry = {
        minX: bbox.minLng,
        minY: bbox.minLat,
        maxX: bbox.maxLng,
        maxY: bbox.maxLat,
        id: feat.id,
        feat
      };
      entries.push(entry);
      this.idMap.set(feat.id, entry);
    }

    if (entries.length > 0) {
      this.tree.load(entries);
    }
  }

  /**
   * Insere ou atualiza uma feição no índice R-Tree em O(log N)
   * @param {Object} feat
   */
  insert(feat) {
    if (!feat || !feat.id) return;
    const bbox = SpatialIndex.computeBounds(feat);
    if (!bbox) return;

    const existing = this.idMap.get(feat.id);
    if (existing) {
      if (
        existing.minX === bbox.minLng &&
        existing.minY === bbox.minLat &&
        existing.maxX === bbox.maxLng &&
        existing.maxY === bbox.maxLat
      ) {
        existing.feat = feat;
        return;
      }
      this.tree.remove(existing);
    }

    const entry = {
      minX: bbox.minLng,
      minY: bbox.minLat,
      maxX: bbox.maxLng,
      maxY: bbox.maxLat,
      id: feat.id,
      feat
    };

    this.idMap.set(feat.id, entry);
    this.tree.insert(entry);
  }

  update(feat) {
    this.insert(feat);
  }

  has(featId) {
    return this.idMap.has(featId);
  }

  get(featId) {
    return this.idMap.get(featId)?.feat;
  }

  /**
   * Remove uma feição do índice R-Tree em O(log N)
   * @param {string} featId
   */
  remove(featId) {
    const entry = this.idMap.get(featId);
    if (!entry) return;

    this.idMap.delete(featId);
    this.tree.remove(entry);
  }

  /**
   * Testa se uma feição ou seu BBox intersecta o viewport
   * @param {Object|string} featOrId
   * @param {Object} bounds
   * @param {number} bufferRatio
   */
  intersects(featOrId, bounds, bufferRatio = 0.20) {
    if (!bounds) return true;
    const featId = typeof featOrId === 'string' ? featOrId : featOrId?.id;
    const entry = this.idMap.get(featId);
    if (!entry) {
      if (typeof featOrId === 'object') {
        const bbox = SpatialIndex.computeBounds(featOrId);
        if (!bbox) return false;
        return this.testBBoxIntersection(bbox, bounds, bufferRatio);
      }
      return false;
    }
    return this.testBBoxIntersection({
      minLat: entry.minY,
      minLng: entry.minX,
      maxLat: entry.maxY,
      maxLng: entry.maxX
    }, bounds, bufferRatio);
  }

  testBBoxIntersection(bbox, bounds, bufferRatio = 0.20) {
    let south = bounds.getSouth ? bounds.getSouth() : bounds.minLat;
    let north = bounds.getNorth ? bounds.getNorth() : bounds.maxLat;
    let west = bounds.getWest ? bounds.getWest() : bounds.minLng;
    let east = bounds.getEast ? bounds.getEast() : bounds.maxLng;

    const latBuf = (north - south) * bufferRatio;
    const lngBuf = (east - west) * bufferRatio;

    south -= latBuf;
    north += latBuf;
    west -= lngBuf;
    east += lngBuf;

    return bbox.minLat <= north && bbox.maxLat >= south && bbox.minLng <= east && bbox.maxLng >= west;
  }

  /**
   * Consulta feições visíveis na viewport em O(log N + K) via R-Tree search
   * Substitui varredura linear O(N) anterior.
   * @param {Object} bounds
   * @param {number} bufferRatio
   */
  query(bounds, bufferRatio = 0.20) {
    if (!bounds) {
      const all = [];
      for (const entry of this.idMap.values()) {
        all.push(entry.feat);
      }
      return all;
    }

    let south = bounds.getSouth ? bounds.getSouth() : bounds.minLat;
    let north = bounds.getNorth ? bounds.getNorth() : bounds.maxLat;
    let west = bounds.getWest ? bounds.getWest() : bounds.minLng;
    let east = bounds.getEast ? bounds.getEast() : bounds.maxLng;

    const latBuf = (north - south) * bufferRatio;
    const lngBuf = (east - west) * bufferRatio;

    south -= latBuf;
    north += latBuf;
    west -= lngBuf;
    east += lngBuf;

    const searchBox = {
      minX: west,
      minY: south,
      maxX: east,
      maxY: north
    };

    const matches = this.tree.search(searchBox);
    const results = new Array(matches.length);
    for (let i = 0; i < matches.length; i++) {
      results[i] = matches[i].feat;
    }
    return results;
  }

  clear() {
    this.tree.clear();
    this.idMap.clear();
  }

  get size() {
    return this.idMap.size;
  }
}
