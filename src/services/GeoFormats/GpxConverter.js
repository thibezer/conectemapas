/* ==========================================================================
   ConecteMapas - GpxConverter
   Responsabilidade Única: Serialização e Parsing de Waypoints, Tracks e Routes
   em formato GPX 1.1 (padrão Garmin / GPS / QGIS)
   ========================================================================== */

import { FeatureGeometryUtils } from '../MapEngine/FeatureGeometryUtils.js';

export class GpxConverter {
  /**
   * Sanitiza strings para XML
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
   * Converte para GPX (Waypoints e Tracks)
   * Suporta Point, LineString (com partes), Polygon (com anéis e furos), Circle e Text.
   * @param {Array} features
   * @param {string} projectName
   * @returns {string} XML GPX formatado
   */
  static toGPX(features, projectName = 'ConecteMapas') {
    let wpts = '';
    let trks = '';

    const isValidPoint = (pt) => Array.isArray(pt) && pt.length >= 2 && Number.isFinite(pt[0]) && Number.isFinite(pt[1]);

    (features || []).filter(Boolean).forEach(f => {
      const name = this.sanitizeText(f.name || 'Feição');
      const desc = this.sanitizeText(f.description || '');

      if (f.type === 'Point' || f.type === 'Circle' || f.type === 'Text') {
        const c = f.coordinates;
        if (isValidPoint(c)) {
          const extra = f.type === 'Circle' && f.radius ? ` [Raio: ${f.radius}m]` : (f.type === 'Text' && f.text ? ` [${f.text}]` : '');
          wpts += `  <wpt lat="${c[0]}" lon="${c[1]}">\n    <name>${name}</name>\n    <desc>${desc}${extra}</desc>\n  </wpt>\n`;
        }
      } else if (f.type === 'LineString') {
        const coords = f.coordinates;
        if (!Array.isArray(coords) || coords.length === 0) return;
        const isMulti = Array.isArray(coords[0]) && Array.isArray(coords[0][0]);
        const lines = isMulti ? coords : [coords];
        let segmentsXml = '';
        lines.forEach(line => {
          if (!Array.isArray(line)) return;
          const validPts = line.filter(isValidPoint);
          if (validPts.length >= 2) {
            const trkpts = validPts.map(c => `      <trkpt lat="${c[0]}" lon="${c[1]}"/>`).join('\n');
            segmentsXml += `    <trkseg>\n${trkpts}\n    </trkseg>\n`;
          }
        });
        if (segmentsXml) {
          trks += `  <trk>\n    <name>${name}</name>\n${segmentsXml}  </trk>\n`;
        }
      } else if (f.type === 'Polygon') {
        const polygonList = FeatureGeometryUtils.toPolygonList(f.coordinates);
        if (!polygonList || polygonList.length === 0) return;
        let segmentsXml = '';
        polygonList.forEach(poly => {
          poly.forEach(ring => {
            if (!Array.isArray(ring)) return;
            const validPts = ring.filter(isValidPoint);
            if (validPts.length >= 3) {
              const closed = [...validPts];
              if (closed[0][0] !== closed[closed.length - 1][0] || closed[0][1] !== closed[closed.length - 1][1]) {
                closed.push(closed[0]);
              }
              const trkpts = closed.map(c => `      <trkpt lat="${c[0]}" lon="${c[1]}"/>`).join('\n');
              segmentsXml += `    <trkseg>\n${trkpts}\n    </trkseg>\n`;
            }
          });
        });
        if (segmentsXml) {
          trks += `  <trk>\n    <name>${name}</name>\n${segmentsXml}  </trk>\n`;
        }
      }
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="ConecteMapas" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${this.sanitizeText(projectName)}</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
${wpts}${trks}</gpx>`;
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
   * Parseia arquivo GPX (XML) em feições internas do ConecteMapas.
   * Suporta <wpt> (Waypoints), <trk> (Tracks) e <rte> (Routes).
   * @param {string} gpxText
   * @returns {{features: Array}}
   */
  static parseGPX(gpxText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(gpxText, 'text/xml');

    const parserError = doc.querySelector?.('parsererror');
    if (parserError) {
      throw new Error(`Estrutura GPX/XML inválida ou corrompida: ${parserError.textContent.slice(0, 120)}`);
    }

    const features = [];
    const isValidCoord = (lat, lon) =>
      Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;

    // 1. Waypoints (<wpt>)
    const waypoints = Array.from(doc.getElementsByTagName('wpt'));
    waypoints.forEach((wpt, i) => {
      const lat = parseFloat(wpt.getAttribute('lat'));
      const lon = parseFloat(wpt.getAttribute('lon'));
      if (!isValidCoord(lat, lon)) return;

      const name = this.childOf(wpt, 'name')?.textContent?.trim() || `Waypoint #${i + 1}`;
      const desc = this.childOf(wpt, 'desc')?.textContent?.trim() || '';
      const ele = this.childOf(wpt, 'ele')?.textContent?.trim();

      features.push({
        id: `gpx-wpt-${Date.now()}-${i}`,
        name,
        layerId: 'layer-topografia',
        type: 'Point',
        coordinates: [lat, lon],
        category: 'Ponto GPX',
        color: '#00E08A',
        description: desc,
        properties: {
          ...(ele ? { elevation: parseFloat(ele) } : {})
        },
        createdBy: 'GPX Import',
        createdAt: new Date().toISOString()
      });
    });

    // 2. Tracks (<trk>)
    const tracks = Array.from(doc.getElementsByTagName('trk'));
    tracks.forEach((trk, i) => {
      const name = this.childOf(trk, 'name')?.textContent?.trim() || `Trilha #${i + 1}`;
      const desc = this.childOf(trk, 'desc')?.textContent?.trim() || '';

      const segments = this.childrenOf(trk, 'trkseg');
      const allLines = [];

      segments.forEach(seg => {
        const trkpts = this.childrenOf(seg, 'trkpt');
        const line = [];
        trkpts.forEach(pt => {
          const lat = parseFloat(pt.getAttribute('lat'));
          const lon = parseFloat(pt.getAttribute('lon'));
          if (isValidCoord(lat, lon)) {
            line.push([lat, lon]);
          }
        });
        if (line.length >= 2) {
          allLines.push(line);
        }
      });

      if (allLines.length === 0) return;

      const isMulti = allLines.length > 1;
      features.push({
        id: `gpx-trk-${Date.now()}-${i}`,
        name,
        layerId: 'layer-vistorias',
        type: 'LineString',
        coordinates: isMulti ? allLines : allLines[0],
        category: 'Trilha GPX',
        color: '#f59e0b',
        description: desc,
        properties: {},
        createdBy: 'GPX Import',
        createdAt: new Date().toISOString()
      });
    });

    // 3. Routes (<rte>)
    const routes = Array.from(doc.getElementsByTagName('rte'));
    routes.forEach((rte, i) => {
      const name = this.childOf(rte, 'name')?.textContent?.trim() || `Rota #${i + 1}`;
      const desc = this.childOf(rte, 'desc')?.textContent?.trim() || '';

      const rtepts = this.childrenOf(rte, 'rtept');
      const line = [];
      rtepts.forEach(pt => {
        const lat = parseFloat(pt.getAttribute('lat'));
        const lon = parseFloat(pt.getAttribute('lon'));
        if (isValidCoord(lat, lon)) {
          line.push([lat, lon]);
        }
      });

      if (line.length < 2) return;

      features.push({
        id: `gpx-rte-${Date.now()}-${i}`,
        name,
        layerId: 'layer-vistorias',
        type: 'LineString',
        coordinates: line,
        category: 'Rota GPX',
        color: '#3b82f6',
        description: desc,
        properties: {},
        createdBy: 'GPX Import',
        createdAt: new Date().toISOString()
      });
    });

    return { features };
  }
}
