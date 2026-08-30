/* ==========================================================================
   ConecteMapas - KmlConverter
   Responsabilidade Única: Serialização e Parsing de arquivos KML (Google Earth / QGIS)
   ========================================================================== */

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
        const isMulti = Array.isArray(f.coordinates[0]) && Array.isArray(f.coordinates[0][0]);
        if (isMulti) {
          const polys = f.coordinates.map(ring => {
            const coordsStr = ring.map(c => `${c[1]},${c[0]},0`).join(' ');
            return `<Polygon><outerBoundaryIs><LinearRing><coordinates>${coordsStr}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;
          }).join('');
          geomKML = `<MultiGeometry>${polys}</MultiGeometry>`;
        } else {
          const coordsStr = f.coordinates.map(c => `${c[1]},${c[0]},0`).join(' ');
          geomKML = `<Polygon><outerBoundaryIs><LinearRing><coordinates>${coordsStr}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;
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

  /**
   * Parseia arquivo KML XML em feições
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

    const placemarks = doc.querySelectorAll('Placemark');
    const features = [];

    placemarks.forEach((pm, i) => {
      const name = pm.querySelector('name')?.textContent || `Placemark #${i + 1}`;
      const desc = pm.querySelector('description')?.textContent || '';
      const point = pm.querySelector('Point coordinates');
      const line = pm.querySelector('LineString coordinates');
      const poly = pm.querySelector('Polygon coordinates');

      const id = `kml-feat-${Date.now()}-${i}`;

      if (point) {
        const parts = point.textContent.trim().split(',');
        if (parts.length >= 2) {
          features.push({
            id,
            name,
            layerId: 'layer-topografia',
            type: 'Point',
            coordinates: [parseFloat(parts[1]), parseFloat(parts[0])],
            category: 'KML Point',
            color: '#00E08A',
            description: desc,
            properties: {},
            createdBy: 'KML Import',
            createdAt: new Date().toISOString()
          });
        }
      } else if (line) {
        const rawCoords = line.textContent.trim().split(/\s+/);
        const coords = rawCoords.map(tuple => {
          const parts = tuple.split(',');
          return [parseFloat(parts[1]), parseFloat(parts[0])];
        }).filter(c => !isNaN(c[0]) && !isNaN(c[1]));

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
      } else if (poly) {
        const rawCoords = poly.textContent.trim().split(/\s+/);
        const coords = rawCoords.map(tuple => {
          const parts = tuple.split(',');
          return [parseFloat(parts[1]), parseFloat(parts[0])];
        }).filter(c => !isNaN(c[0]) && !isNaN(c[1]));

        features.push({
          id,
          name,
          layerId: 'layer-ambiental',
          type: 'Polygon',
          coordinates: coords,
          category: 'KML Polygon',
          color: '#10b981',
          description: desc,
          properties: {},
          createdBy: 'KML Import',
          createdAt: new Date().toISOString()
        });
      }
    });

    return { features };
  }
}
