/* ==========================================================================
   ConecteMapas - GpxConverter
   Responsabilidade Única: Serialização de Waypoints e Tracks em formato GPX 1.1
   ========================================================================== */

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
   * @param {Array} features
   * @param {string} projectName
   * @returns {string}
   */
  static toGPX(features, projectName = 'ConecteMapas') {
    let wpts = '';
    let trks = '';

    features.forEach(f => {
      if (f.type === 'Point') {
        wpts += `  <wpt lat="${f.coordinates[0]}" lon="${f.coordinates[1]}">\n    <name>${this.sanitizeText(f.name)}</name>\n    <desc>${this.sanitizeText(f.description || '')}</desc>\n  </wpt>\n`;
      } else if (f.type === 'LineString' || f.type === 'Polygon') {
        const trkpts = f.coordinates.map(c => `      <trkpt lat="${c[0]}" lon="${c[1]}"/>`).join('\n');
        trks += `  <trk>\n    <name>${this.sanitizeText(f.name)}</name>\n    <trkseg>\n${trkpts}\n    </trkseg>\n  </trk>\n`;
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
}
