/* ==========================================================================
   ConecteMapas - GeoJsonConverter
   Responsabilidade Única: Serialização e Desserialização de RFC 7946 GeoJSON
   ========================================================================== */

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
      features: features.map(f => {
        let geometry = null;
        if (f.type === 'Point') {
          // Leaflet usa [lat, lng], GeoJSON usa [lng, lat]
          geometry = {
            type: 'Point',
            coordinates: [f.coordinates[1], f.coordinates[0]]
          };
        } else if (f.type === 'LineString') {
          const isMulti = Array.isArray(f.coordinates[0]) && Array.isArray(f.coordinates[0][0]);
          if (isMulti) {
            geometry = {
              type: 'MultiLineString',
              coordinates: f.coordinates.map(line => line.map(c => [c[1], c[0]]))
            };
          } else {
            geometry = {
              type: 'LineString',
              coordinates: f.coordinates.map(c => [c[1], c[0]])
            };
          }
        } else if (f.type === 'Polygon') {
          const isMulti = Array.isArray(f.coordinates[0]) && Array.isArray(f.coordinates[0][0]);
          if (isMulti) {
            geometry = {
              type: 'MultiPolygon',
              coordinates: f.coordinates.map(ring => {
                const r = ring.map(c => [c[1], c[0]]);
                if (r.length > 0 && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1])) {
                  r.push([r[0][0], r[0][1]]);
                }
                return [r];
              })
            };
          } else {
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
          }
        } else if (f.type === 'Circle') {
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
   * Parseia objeto FeatureCollection GeoJSON para feições internas do ConecteMapas
   * @param {Object} geojson
   * @returns {{features: Array}}
   */
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
          ? feat.geometry.coordinates.map(ring => ring.map(c => [c[1], c[0]]))
          : feat.geometry.coordinates[0].map(c => [c[1], c[0]]);
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
        const coords = feat.geometry.coordinates.map(poly => poly[0].map(c => [c[1], c[0]]));
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
}
