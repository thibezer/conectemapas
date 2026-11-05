/* ==========================================================================
   ConecteMapas - GeoJsonConverter
   Responsabilidade Única: Serialização e Desserialização de RFC 7946 GeoJSON
   ========================================================================== */

import proj4 from 'proj4';
import { FeatureGeometryUtils } from '../MapEngine/FeatureGeometryUtils.js';
import '../Shapefile/Projections.js';

export class GeoJsonConverter {
  /**
   * Converte a lista de feições para GeoJSON FeatureCollection padrão RFC 7946
   * @param {Array} features
   * @param {string} projectName
   * @returns {string} JSON formatado
   */
  static toGeoJSON(features, projectName = 'ConecteMapas') {
    const geojson = {
      type: 'FeatureCollection',
      name: projectName,
      crs: {
        type: 'name',
        properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' }
      },
      features: (features || []).filter(Boolean).map(f => {
        let geometry = null;
        const coords = f.coordinates;
        const isValidPoint = (c) => Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]);

        if (f.type === 'Point' || f.type === 'Circle' || f.type === 'Text') {
          // Leaflet usa [lat, lng], GeoJSON usa [lng, lat]
          if (isValidPoint(coords)) {
            geometry = {
              type: 'Point',
              coordinates: [coords[1], coords[0]]
            };
          }
        } else if (f.type === 'LineString') {
          if (Array.isArray(coords) && coords.length > 0) {
            const isMulti = Array.isArray(coords[0]) && Array.isArray(coords[0][0]);
            if (isMulti) {
              const multi = coords
                .map(line => (Array.isArray(line) ? line.filter(isValidPoint).map(c => [c[1], c[0]]) : []))
                .filter(line => line.length >= 2);
              if (multi.length > 0) {
                geometry = {
                  type: 'MultiLineString',
                  coordinates: multi
                };
              }
            } else {
              const pts = coords.filter(isValidPoint).map(c => [c[1], c[0]]);
              if (pts.length >= 2) {
                geometry = {
                  type: 'LineString',
                  coordinates: pts
                };
              }
            }
          }
        } else if (f.type === 'Polygon') {
          // Anéis fechados em [lng, lat]. Profundidade 3 = externo + furos (um Polygon);
          // profundidade 4 = vários polígonos (MultiPolygon).
          if (Array.isArray(coords) && coords.length > 0) {
            const closeRing = (ring) => {
              if (!Array.isArray(ring)) return null;
              const valid = ring.filter(isValidPoint);
              if (valid.length < 3) return null;
              const r = valid.map(c => [c[1], c[0]]);
              if (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1]) {
                r.push([r[0][0], r[0][1]]);
              }
              return r;
            };
            const rawPolys = FeatureGeometryUtils.toPolygonList(coords);
            const polygons = (rawPolys || [])
              .map(poly => poly.map(closeRing).filter(Boolean))
              .filter(poly => poly.length > 0);

            if (polygons.length === 1) {
              geometry = { type: 'Polygon', coordinates: polygons[0] };
            } else if (polygons.length > 1) {
              geometry = { type: 'MultiPolygon', coordinates: polygons };
            }
          }
        }

        const extraText = f.type === 'Text' ? { text: f.text || f.properties?.text || f.name || '' } : {};

        return {
          type: 'Feature',
          id: f.id,
          properties: {
            name: f.name,
            layerId: f.layerId,
            category: f.category || '',
            color: f.color || '#00E08A',
            description: f.description || '',
            radius: f.radius || null,
            createdBy: f.createdBy || '',
            createdAt: f.createdAt || '',
            ...extraText,
            ...(f.properties || {})
          },
          geometry
        };
      })
    };

    return JSON.stringify(geojson, null, 2);
  }

  /**
   * Parseia objeto FeatureCollection GeoJSON para feições internas do ConecteMapas
   * @param {Object} geojson
   * @returns {{features: Array}}
   */
  static parseGeoJSON(geojson) {
    const features = [];
    const toWgs84 = GeoJsonConverter.crsTransformer(geojson);
    let skipped = 0;
    geojson.features.forEach((rawFeat, i) => {
      if (!rawFeat.geometry || !Array.isArray(rawFeat.geometry.coordinates)) return;
      // GeoJSON antigo pode declarar outro CRS (UTM, SAD69...): leva as posições para WGS84/SIRGAS
      const feat = toWgs84 ? { ...rawFeat, geometry: toWgs84(rawFeat.geometry) } : rawFeat;
      if (!GeoJsonConverter.geometryInRange(feat.geometry)) {
        skipped++;
        return;
      }
      const geomType = feat.geometry.type;
      const props = feat.properties || {};
      const id = feat.id || `import-feat-${Date.now()}-${i}`;
      const name = props.name || `Feição #${i + 1}`;
      const color = props.color || '#00E08A';
      const category = props.category || 'Importado';
      const layerId = props.layerId || 'layer-topografia';

      if (geomType === 'Point') {
        const coords = [feat.geometry.coordinates[1], feat.geometry.coordinates[0]];
        features.push({
          id,
          name,
          layerId,
          type: props.radius ? 'Circle' : 'Point',
          coordinates: coords,
          radius: props.radius || null,
          category,
          color,
          description: props.description || '',
          properties: { ...props },
          createdBy: props.createdBy || 'Importado',
          createdAt: props.createdAt || new Date().toISOString()
        });
      } else if (geomType === 'MultiPoint') {
        const points = feat.geometry.coordinates;
        points.forEach((pt, k) => {
          const multi = points.length > 1;
          features.push({
            id: multi ? `${id}-pt${k + 1}` : id,
            name: multi ? `${name} (ponto ${k + 1}/${points.length})` : name,
            layerId,
            type: 'Point',
            coordinates: [pt[1], pt[0]],
            category,
            color,
            description: props.description || '',
            properties: { ...props },
            createdBy: props.createdBy || 'Importado',
            createdAt: props.createdAt || new Date().toISOString()
          });
        });
      } else if (geomType === 'LineString') {
        const coords = feat.geometry.coordinates.map(c => [c[1], c[0]]);
        features.push({
          id,
          name,
          layerId,
          type: 'LineString',
          coordinates: coords,
          category,
          color,
          description: props.description || '',
          properties: { ...props },
          createdBy: props.createdBy || 'Importado',
          createdAt: props.createdAt || new Date().toISOString()
        });
      } else if (geomType === 'MultiLineString') {
        const coords = feat.geometry.coordinates.map(line => line.map(c => [c[1], c[0]]));
        features.push({
          id,
          name,
          layerId,
          type: 'LineString',
          coordinates: coords,
          category,
          color,
          description: props.description || '',
          properties: { ...props },
          createdBy: props.createdBy || 'Importado',
          createdAt: props.createdAt || new Date().toISOString()
        });
      } else if (geomType === 'Polygon') {
        const coords = feat.geometry.coordinates.length > 1
          ? feat.geometry.coordinates.map(ring => GeoJsonConverter.openRing(ring))
          : GeoJsonConverter.openRing(feat.geometry.coordinates[0]);
        features.push({
          id,
          name,
          layerId,
          type: 'Polygon',
          coordinates: coords,
          category,
          color,
          description: props.description || '',
          properties: { ...props },
          createdBy: props.createdBy || 'Importado',
          createdAt: props.createdAt || new Date().toISOString()
        });
      } else if (geomType === 'MultiPolygon') {
        // Cada polígono do MultiPolygon (externo + furos) vira uma feição: o modelo do app trata
        // várias partes de uma mesma feição como externo + furos, o que zeraria a área.
        const polygons = feat.geometry.coordinates.filter(poly => Array.isArray(poly) && Array.isArray(poly[0]));
        polygons.forEach((poly, k) => {
          const multi = polygons.length > 1;
          const coords = poly.length > 1
            ? poly.map(ring => GeoJsonConverter.openRing(ring))
            : GeoJsonConverter.openRing(poly[0]);
          features.push({
            id: multi ? `${id}-p${k + 1}` : id,
            name: multi ? `${name} (parte ${k + 1}/${polygons.length})` : name,
            layerId,
            type: 'Polygon',
            coordinates: coords,
            category,
            color,
            description: props.description || '',
            properties: { ...props },
            createdBy: props.createdBy || 'Importado',
            createdAt: props.createdAt || new Date().toISOString()
          });
        });
      }
    });

    if (features.length === 0 && skipped > 0) {
      throw new Error(
        'As coordenadas do GeoJSON estão fora de ±90°/±180°. Se estiverem em metros (UTM), declare o "crs" ' +
        '(ex.: "urn:ogc:def:crs:EPSG::31983") ou reprojete o arquivo para WGS84/SIRGAS 2000.'
      );
    }

    return { features, skipped };
  }

  /**
   * Função que leva a geometria do CRS declarado em `crs` para lon/lat WGS84, ou null quando o
   * arquivo já está em WGS84/SIRGAS 2000/CRS84 (ou não declara CRS, o padrão da RFC 7946).
   * CRS que o app não conhece geram erro, em vez de importar números no lugar errado.
   */
  static crsTransformer(geojson) {
    const name = geojson?.crs?.properties?.name;
    if (!name) return null;
    if (/CRS84/i.test(name)) return null;
    const code = (String(name).match(/EPSG:+(\d+)/i) || [])[1];
    if (!code || code === '4326' || code === '4674') return null;

    let transformer;
    try {
      transformer = proj4(`EPSG:${code}`, 'EPSG:4326');
    } catch {
      throw new Error(`Sistema de referência do GeoJSON não suportado: ${name}. Reprojete o arquivo para WGS84/SIRGAS 2000.`);
    }
    const project = (pos) => {
      const [x, y] = transformer.forward([pos[0], pos[1]]);
      return [x, y];
    };
    const walk = (coords) => (typeof coords[0] === 'number' ? project(coords) : coords.map(walk));
    return (geometry) => (geometry && Array.isArray(geometry.coordinates)
      ? { ...geometry, coordinates: walk(geometry.coordinates) }
      : geometry);
  }

  /** Todas as posições [lng, lat] da geometria são finitas e estão em ±180°/±90°. */
  static geometryInRange(geometry) {
    const check = (c) => {
      if (!Array.isArray(c) || c.length === 0) return false;
      if (typeof c[0] === 'number') {
        return Number.isFinite(c[0]) && Number.isFinite(c[1]) && Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90;
      }
      return c.every(check);
    };
    return check(geometry.coordinates);
  }

  /**
   * Converte coordenadas [lng, lat] de um LinearRing para [lat, lng]
   * e garante anel aberto (remove o vértice de fechamento duplicado se houver).
   * @param {Array<[number, number]>} ring
   * @returns {Array<[number, number]>}
   */
  static openRing(ring) {
    if (!Array.isArray(ring)) return [];
    const coords = ring.map(c => [c[1], c[0]]);
    if (coords.length > 2) {
      const first = coords[0];
      const last = coords[coords.length - 1];
      if (first && last && Math.abs(first[0] - last[0]) < 1e-7 && Math.abs(first[1] - last[1]) < 1e-7) {
        return coords.slice(0, -1);
      }
    }
    return coords;
  }
}
