/* ==========================================================================
   ConecteMapas - KmlConverter
   Responsabilidade Única: Serialização e Parsing de arquivos KML (Google Earth / QGIS)
   ========================================================================== */

import { FeatureGeometryUtils } from '../MapEngine/FeatureGeometryUtils.js';

export class KmlConverter {
  /**
   * Sanitiza strings para XML seguro
   */
  static sanitizeText(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Converte para KML (compatível com Google Earth / QGIS)
   * @param {Array} features
   * @param {string} projectName
   * @returns {string} XML KML formatado
   */
  static toKML(features, projectName = 'ConecteMapas') {
    let placemarks = features.map(f => {
      let geomKML = '';
      if (f.type === 'Point' || f.type === 'Circle') {
        geomKML = `<Point><coordinates>${f.coordinates[1]},${f.coordinates[0]},0</coordinates></Point>`;
      } else if (f.type === 'LineString') {
        const isMulti = Array.isArray(f.coordinates[0]) && Array.isArray(f.coordinates[0][0]);
        if (isMulti) {
          const lines = f.coordinates.map(line => {
            const coordsStr = line.map(c => `${c[1]},${c[0]},0`).join(' ');
            return `<LineString><tessellate>1</tessellate><coordinates>${coordsStr}</coordinates></LineString>`;
          }).join('');
          geomKML = `<MultiGeometry>${lines}</MultiGeometry>`;
        } else {
          const coordsStr = f.coordinates.map(c => `${c[1]},${c[0]},0`).join(' ');
          geomKML = `<LineString><tessellate>1</tessellate><coordinates>${coordsStr}</coordinates></LineString>`;
        }
      } else if (f.type === 'Polygon') {
        // Profundidade 3 = externo + furos (innerBoundaryIs); profundidade 4 = vários polígonos
        const ringCoords = (ring) => {
          const r = [...ring];
          if (r.length > 0 && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1])) {
            r.push([r[0][0], r[0][1]]);
          }
          return r.map(c => `${c[1]},${c[0]},0`).join(' ');
        };
        const polygonKML = (poly) => {
          const [outer, ...holes] = poly;
          const inner = holes.map(h => `<innerBoundaryIs><LinearRing><coordinates>${ringCoords(h)}</coordinates></LinearRing></innerBoundaryIs>`).join('');
          return `<Polygon><outerBoundaryIs><LinearRing><coordinates>${ringCoords(outer)}</coordinates></LinearRing></outerBoundaryIs>${inner}</Polygon>`;
        };
        const polygons = FeatureGeometryUtils.toPolygonList(f.coordinates);
        if (polygons.length === 1) {
          geomKML = polygonKML(polygons[0]);
        } else if (polygons.length > 1) {
          geomKML = `<MultiGeometry>${polygons.map(polygonKML).join('')}</MultiGeometry>`;
        }
      }

      return `
    <Placemark id="${f.id}">
      <name>${this.sanitizeText(f.name)}</name>
      <description>${this.sanitizeText(f.description || '')}</description>
      <Style>
        <LineStyle><color>ff00e08a</color><width>3</width></LineStyle>
        <PolyStyle><color>7f00e08a</color></PolyStyle>
      </Style>
      ${geomKML}
    </Placemark>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${this.sanitizeText(projectName)}</name>
    <description>Exportado via ConecteMapas</description>
    ${placemarks}
  </Document>
</kml>`;
  }

  /** Primeiro filho-elemento com o nome local informado. */
  static childOf(el, name) {
    return Array.from(el.children || []).find(c => c.localName === name) || null;
  }

  /** Filhos-elemento com o nome local informado. */
  static childrenOf(el, name) {
    return Array.from(el.children || []).filter(c => c.localName === name);
  }

  /**
   * Texto de <coordinates> ("lng,lat[,alt]" separados por espaço/quebra de linha, tolerando
   * espaços ao redor das vírgulas) -> [[lat, lng], ...] só com posições válidas.
   */
  static parseCoordinates(text) {
    return String(text || '')
      .replace(/\s*,\s*/g, ',')
      .trim()
      .split(/\s+/)
      .map(tuple => {
        const parts = tuple.split(',');
        return [parseFloat(parts[1]), parseFloat(parts[0])];
      })
      .filter(c => Number.isFinite(c[0]) && Number.isFinite(c[1]) && Math.abs(c[0]) <= 90 && Math.abs(c[1]) <= 180);
  }

  /** Remove o vértice de fechamento duplicado de um anel (primeiro == último). */
  static openRing(coords) {
    if (coords.length > 2) {
      const first = coords[0];
      const last = coords[coords.length - 1];
      if (Math.abs(first[0] - last[0]) < 1e-7 && Math.abs(first[1] - last[1]) < 1e-7) {
        return coords.slice(0, -1);
      }
    }
    return coords;
  }

  /** Geometrias simples (Point, LineString, Polygon) de um Placemark, descendo em MultiGeometry. */
  static collectGeometries(el, out = []) {
    for (const child of Array.from(el.children || [])) {
      const tag = child.localName;
      if (tag === 'Point' || tag === 'LineString' || tag === 'Polygon') out.push(child);
      else if (tag === 'MultiGeometry') this.collectGeometries(child, out);
    }
    return out;
  }

  /**
   * Parseia arquivo KML XML em feições. MultiGeometry gera uma feição por geometria;
   * Polygon traz o anel externo e os furos (innerBoundaryIs).
   * @param {string} kmlText
   * @returns {{features: Array}}
   */
  static parseKML(kmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(kmlText, 'text/xml');

    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      throw new Error(`Estrutura KML/XML inválida ou corrompida: ${parserError.textContent.slice(0, 120)}`);
    }

    const placemarks = Array.from(doc.getElementsByTagName('Placemark'));
    const features = [];

    placemarks.forEach((pm, i) => {
      const baseName = this.childOf(pm, 'name')?.textContent || `Placemark #${i + 1}`;
      const desc = this.childOf(pm, 'description')?.textContent || '';
      const geometries = this.collectGeometries(pm);

      geometries.forEach((geom, k) => {
        const multi = geometries.length > 1;
        const id = `kml-feat-${Date.now()}-${i}${multi ? `-${k + 1}` : ''}`;
        const name = multi ? `${baseName} (${k + 1}/${geometries.length})` : baseName;
        const tag = geom.localName;

        if (tag === 'Point') {
          const pts = this.parseCoordinates(this.childOf(geom, 'coordinates')?.textContent);
          if (pts.length < 1) return;
          features.push({
            id,
            name,
            layerId: 'layer-topografia',
            type: 'Point',
            coordinates: pts[0],
            category: 'KML Point',
            color: '#00E08A',
            description: desc,
            properties: {},
            createdBy: 'KML Import',
            createdAt: new Date().toISOString()
          });
        } else if (tag === 'LineString') {
          const coords = this.parseCoordinates(this.childOf(geom, 'coordinates')?.textContent);
          if (coords.length < 2) return;
          features.push({
            id,
            name,
            layerId: 'layer-vistorias',
            type: 'LineString',
            coordinates: coords,
            category: 'KML Line',
            color: '#f59e0b',
            description: desc,
            properties: {},
            createdBy: 'KML Import',
            createdAt: new Date().toISOString()
          });
        } else {
          const ringOf = (boundary) => {
            const linear = boundary && this.childOf(boundary, 'LinearRing');
            return this.openRing(this.parseCoordinates(linear && this.childOf(linear, 'coordinates')?.textContent));
          };
          const outer = ringOf(this.childOf(geom, 'outerBoundaryIs'));
          if (outer.length < 3) return;
          const holes = this.childrenOf(geom, 'innerBoundaryIs').map(ringOf).filter(r => r.length >= 3);
          features.push({
            id,
            name,
            layerId: 'layer-ambiental',
            type: 'Polygon',
            coordinates: holes.length > 0 ? [outer, ...holes] : outer,
            category: 'KML Polygon',
            color: '#10b981',
            description: desc,
            properties: {},
            createdBy: 'KML Import',
            createdAt: new Date().toISOString()
          });
        }
      });
    });

    return { features };
  }
}
