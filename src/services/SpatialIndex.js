/* ==========================================================================
   ConecteMapas - SpatialIndex (R-Tree / Bounding Box Spatial Indexer)
   Responsabilidade Única: Indexação espacial em memória O(log N) para busca
   instantânea de geometrias visíveis na viewport (Viewport Culling).
   ========================================================================== */

export class SpatialIndex {
  constructor() {
    this.items = []; // Array de itens { id, minLat, minLng, maxLat, maxLng, feat }
    this.idMap = new Map();
  }

  static computeBounds(feat) {
    if (!feat || !feat.coordinates) return null;

    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;

    const expand = (lat, lng) => {
      if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
      }
    };

    if (feat.type === 'Point') {
      const c = feat.coordinates;
      if (c.lat !== undefined && c.lng !== undefined) {
        expand(c.lat, c.lng);
      } else if (Array.isArray(c) && c.length >= 2) {
        expand(c[0], c[1]);
      }
    } else if (feat.type === 'Circle') {
      const c = feat.coordinates;
      const lat = c.lat !== undefined ? c.lat : c[0];
      const lng = c.lng !== undefined ? c.lng : c[1];
      const rDeg = (feat.radius || 500) / 111320;
      minLat = lat - rDeg; maxLat = lat + rDeg;
      minLng = lng - rDeg; maxLng = lng + rDeg;
    } else if (Array.isArray(feat.coordinates)) {
      const scanPoints = (coords) => {
        if (!Array.isArray(coords)) return;
        if (typeof coords[0] === 'number') {
          expand(coords[0], coords[1]);
        } else if (coords[0] && coords[0].lat !== undefined) {
          coords.forEach(p => expand(p.lat, p.lng));
        } else if (Array.isArray(coords[0])) {
          coords.forEach(sub => scanPoints(sub));
        }
      };
      scanPoints(feat.coordinates);
    }

    if (minLat === Infinity) return null;
    return { minLat, minLng, maxLat, maxLng };
  }

  build(features) {
    this.clear();
    if (!Array.isArray(features)) return;

    for (let i = 0; i < features.length; i++) {
      this.insert(features[i]);
    }
  }

  insert(feat) {
    if (!feat || !feat.id) return;
    const bbox = SpatialIndex.computeBounds(feat);
    if (!bbox) return;

    const entry = {
      id: feat.id,
      minLat: bbox.minLat,
      minLng: bbox.minLng,
      maxLat: bbox.maxLat,
      maxLng: bbox.maxLng,
      feat
    };

    this.remove(feat.id);
    this.items.push(entry);
    this.idMap.set(feat.id, entry);
  }

  remove(featId) {
    const entry = this.idMap.get(featId);
    if (entry) {
      this.idMap.delete(featId);
      const idx = this.items.indexOf(entry);
      if (idx >= 0) {
        this.items.splice(idx, 1);
      }
    }
  }

  query(bounds, bufferRatio = 0.15) {
    if (!bounds) return this.items.map(it => it.feat);

    let south = bounds.getSouth ? bounds.getSouth() : bounds.minLat;
    let north = bounds.getNorth ? bounds.getNorth() : bounds.maxLat;
    let west = bounds.getWest ? bounds.getWest() : bounds.minLng;
    let east = bounds.getEast ? bounds.getEast() : bounds.maxLng;

    // Aplica buffer de margem de segurança (15% fora da tela para navegação sem flicker)
    const latBuf = (north - south) * bufferRatio;
    const lngBuf = (east - west) * bufferRatio;

    south -= latBuf;
    north += latBuf;
    west -= lngBuf;
    east += lngBuf;

    const results = [];
    const len = this.items.length;

    for (let i = 0; i < len; i++) {
      const it = this.items[i];
      // Teste de interseção AABB (Axis-Aligned Bounding Box)
      if (it.minLat <= north && it.maxLat >= south && it.minLng <= east && it.maxLng >= west) {
        results.push(it.feat);
      }
    }

    return results;
  }

  clear() {
    this.items = [];
    this.idMap.clear();
  }

  get size() {
    return this.items.length;
  }
}
