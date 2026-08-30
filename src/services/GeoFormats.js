/* ==========================================================================
   ConecteMapas - GeoFormats Service
   Importação e Exportação: GeoJSON, KML, GPX, CSV e JSON do Projeto
   ========================================================================== */

import { ShapefileParser } from './ShapefileParser.js';

export class GeoFormats {
  /**
   * Sanitiza strings para evitar injeção XSS
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
   * Converte para pacote ESRI Shapefile compactado (.ZIP com .shp, .dbf, .prj, .shx, .cpg)
   */
  static async toShapefileZip(features, projectName = 'conectemapas_export') {
    return ShapefileParser.exportToShapefileZip(features, projectName);
  }

  /**
   * Parser unificado e inteligente para Shapefile (ZIP ou 5 arquivos avulsos)
   */
  static async parseShapefile(input) {
    return ShapefileParser.parse(input);
  }

  /**
   * Converte a lista de feições para GeoJSON FeatureCollection padrão RFC 7946
   */
  static toGeoJSON(features, projectName = 'ConecteMapas') {
    const geojson = {
      type: 'FeatureCollection',
      name: projectName,
      crs: {
        type: 'name',
        properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' }
      },
      features: features.map(f => {
        let geometry = null;
        if (f.type === 'Point') {
          // Leaflet usa [lat, lng], GeoJSON usa [lng, lat]
          geometry = {
            type: 'Point',
            coordinates: [f.coordinates[1], f.coordinates[0]]
          };
        } else if (f.type === 'LineString') {
          geometry = {
            type: 'LineString',
            coordinates: f.coordinates.map(c => [c[1], c[0]])
          };
        } else if (f.type === 'Polygon') {
          // Garante anel fechado
          const ring = f.coordinates.map(c => [c[1], c[0]]);
          if (
            ring.length > 0 &&
            (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])
          ) {
            ring.push([ring[0][0], ring[0][1]]);
          }
          geometry = {
            type: 'Polygon',
            coordinates: [ring]
          };
        } else if (f.type === 'Circle') {
          // Círculos são convertidos em ponto com atributo de raio
          geometry = {
            type: 'Point',
            coordinates: [f.coordinates[1], f.coordinates[0]]
          };
        }

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
            ...(f.properties || {})
          },
          geometry
        };
      })
    };

    return JSON.stringify(geojson, null, 2);
  }

  /**
   * Converte para KML (compatível com Google Earth / QGIS)
   */
  static toKML(features, projectName = 'ConecteMapas') {
    let placemarks = features.map(f => {
      let geomKML = '';
      if (f.type === 'Point' || f.type === 'Circle') {
        geomKML = `<Point><coordinates>${f.coordinates[1]},${f.coordinates[0]},0</coordinates></Point>`;
      } else if (f.type === 'LineString') {
        const coordsStr = f.coordinates.map(c => `${c[1]},${c[0]},0`).join(' ');
        geomKML = `<LineString><tessellate>1</tessellate><coordinates>${coordsStr}</coordinates></LineString>`;
      } else if (f.type === 'Polygon') {
        const coordsStr = f.coordinates.map(c => `${c[1]},${c[0]},0`).join(' ');
        geomKML = `<Polygon><outerBoundaryIs><LinearRing><coordinates>${coordsStr}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;
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
   * Converte para GPX (Waypoints e Tracks)
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

  /**
   * Converte a lista de feições para tabela CSV
   */
  static toCSV(features) {
    const headers = ['ID', 'Nome', 'Tipo', 'Camada', 'Categoria', 'Latitude', 'Longitude', 'Propriedades', 'CriadoPor', 'Data'];
    const rows = features.map(f => {
      const lat = f.type === 'Point' ? f.coordinates[0] : (f.coordinates[0] ? f.coordinates[0][0] : '');
      const lng = f.type === 'Point' ? f.coordinates[1] : (f.coordinates[0] ? f.coordinates[0][1] : '');
      const propsStr = f.properties ? JSON.stringify(f.properties).replace(/"/g, '""') : '';
      
      return [
        `"${f.id}"`,
        `"${(f.name || '').replace(/"/g, '""')}"`,
        `"${f.type}"`,
        `"${f.layerId}"`,
        `"${f.category || ''}"`,
        `"${lat}"`,
        `"${lng}"`,
        `"${propsStr}"`,
        `"${f.createdBy || ''}"`,
        `"${f.createdAt || ''}"`
      ].join(';');
    });

    return [headers.join(';'), ...rows].join('\r\n');
  }

  /**
   * Parser robusto de arquivos importados (Texto, Shapefile, ZIP, KML, GeoJSON, CSV)
   */
  static async parseUploadedFile(contentOrFile, fileName = '') {
    // 1. Arquivos binários ou múltiplos arquivos Shapefile
    const isBlob = typeof Blob !== 'undefined' && contentOrFile instanceof Blob;
    const isFile = typeof File !== 'undefined' && contentOrFile instanceof File;
    const isFileList = typeof FileList !== 'undefined' && contentOrFile instanceof FileList;

    if (isFile || isFileList || isBlob || Array.isArray(contentOrFile)) {
      const name = (fileName || (isFile ? contentOrFile.name : '')).toLowerCase();
      if (
        name.endsWith('.zip') ||
        name.endsWith('.shp') ||
        name.endsWith('.dbf') ||
        isFileList ||
        Array.isArray(contentOrFile)
      ) {
        return this.parseShapefile(contentOrFile);
      }
    }

    const lowerName = fileName.toLowerCase();

    // 2. Se for Shapefile ZIP / SHP
    if (lowerName.endsWith('.zip') || lowerName.endsWith('.shp') || lowerName.endsWith('.dbf')) {
      return this.parseShapefile(contentOrFile);
    }

    const content = typeof contentOrFile === 'string' 
      ? contentOrFile 
      : new TextDecoder('utf-8').decode(contentOrFile);

    // GeoJSON ou JSON
    if (lowerName.endsWith('.geojson') || lowerName.endsWith('.json') || content.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(content);
        if (parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
          return this.parseGeoJSON(parsed);
        }
        if (parsed.layers && parsed.features) {
          // Formato nativo de projeto ConecteMapas
          return parsed;
        }
      } catch (e) {
        throw new Error('Formato JSON / GeoJSON inválido: ' + e.message);
      }
    }

    // KML
    if (lowerName.endsWith('.kml') || content.includes('<kml')) {
      return this.parseKML(content);
    }

    // CSV
    if (lowerName.endsWith('.csv') || content.includes(';')) {
      return this.parseCSV(content);
    }

    throw new Error('Formato de arquivo não reconhecido. Suportamos Shapefile (.zip/.shp/.dbf/.prj/.shx/.cpg), GeoJSON, KML e CSV.');
  }

  static parseGeoJSON(geojson) {
    const features = [];
    geojson.features.forEach((feat, i) => {
      if (!feat.geometry) return;
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
      } else if (geomType === 'Polygon') {
        const coords = feat.geometry.coordinates[0].map(c => [c[1], c[0]]);
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
      }
    });

    return { features };
  }

  static parseKML(kmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(kmlText, 'text/xml');
    
    // Verifica se houve erro de parsing XML
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

  static parseCSV(csvText) {
    const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return { features: [] };

    const separator = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(separator).map(h => h.replace(/^["']|["']$/g, '').trim().toLowerCase());
    const latIdx = headers.findIndex(h => h.includes('lat'));
    const lngIdx = headers.findIndex(h => h.includes('lng') || h.includes('lon'));
    const nameIdx = headers.findIndex(h => h.includes('nome') || h.includes('name'));

    if (latIdx === -1 || lngIdx === -1) {
      throw new Error('O CSV precisa conter colunas de Latitude e Longitude (ou Lat / Lng).');
    }

    const features = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(separator).map(p => p.replace(/^["']|["']$/g, '').trim());
      const lat = parseFloat(parts[latIdx]);
      const lng = parseFloat(parts[lngIdx]);

      if (!isNaN(lat) && !isNaN(lng)) {
        features.push({
          id: `csv-feat-${Date.now()}-${i}`,
          name: nameIdx >= 0 ? parts[nameIdx] : `Ponto CSV #${i}`,
          layerId: 'layer-topografia',
          type: 'Point',
          coordinates: [lat, lng],
          category: 'Ponto CSV',
          color: '#00E08A',
          description: `Importado de planilha CSV (Linha ${i})`,
          properties: {},
          createdBy: 'CSV Import',
          createdAt: new Date().toISOString()
        });
      }
    }

    return { features };
  }

  /**
   * Converte uma feição isolada para WKT (Well-Known Text)
   * @param {Object} feature
   */
  static toWKT(feature) {
    if (!feature || !feature.coordinates) return '';
    const type = feature.type;
    const coords = feature.coordinates;

    if (type === 'Point') {
      return `POINT(${coords[1]} ${coords[0]})`;
    } else if (type === 'LineString') {
      const pts = coords.map(c => `${c[1]} ${c[0]}`).join(', ');
      return `LINESTRING(${pts})`;
    } else if (type === 'Polygon') {
      const ring = coords.map(c => `${c[1]} ${c[0]}`);
      if (ring.length > 0 && ring[0] !== ring[ring.length - 1]) {
        ring.push(ring[0]);
      }
      return `POLYGON((${ring.join(', ')}))`;
    } else if (type === 'Circle') {
      return `POINT(${coords[1]} ${coords[0]}) /* BUFFER ${feature.radius || 0}m */`;
    }
    return '';
  }

  /**
   * Converte os vértices de uma feição para CSV de Coordenadas
   * @param {Object} feature
   */
  static toCoordinateCSV(feature) {
    if (!feature || !feature.coordinates) return '';
    const rows = ['Vertice;Latitude;Longitude'];
    if (feature.type === 'Point' || feature.type === 'Circle') {
      rows.push(`V1;${feature.coordinates[0]};${feature.coordinates[1]}`);
    } else if (Array.isArray(feature.coordinates)) {
      feature.coordinates.forEach((c, idx) => {
        rows.push(`V${idx + 1};${c[0]};${c[1]}`);
      });
    }
    return rows.join('\r\n');
  }
}

