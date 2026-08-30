/* ==========================================================================
   ConecteMapas - CsvConverter
   Responsabilidade Única: Conversão e parsing de planilhas CSV e tabelas de coordenadas
   ========================================================================== */

export class CsvConverter {
  /**
   * Converte a lista de feições para tabela CSV
   * @param {Array} features
   * @returns {string} CSV delimitado por ponto e vírgula
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
   * Parseia texto CSV delimitado
   * @param {string} csvText
   * @returns {{features: Array}}
   */
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
   * Converte os vértices de uma feição para CSV de Coordenadas de nós
   * @param {Object} feature
   * @returns {string}
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
