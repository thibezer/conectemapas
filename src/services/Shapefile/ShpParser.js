/* ==========================================================================
   ConecteMapas - ShpParser
   Responsabilidade Única: Leitura e extração de geometrias vetoriais .SHP
   ========================================================================== */

import { FeatureGeometryUtils } from '../MapEngine/FeatureGeometryUtils.js';

export class ShpParser {
  /**
   * Parseia a geometria binária do arquivo .SHP
   * @param {ArrayBuffer} shpBuffer
   * @param {Array<{offsetBytes: number, lengthBytes: number}>|null} shxOffsets
   * @returns {Array<Object>} Lista de geometrias brutas
   */
  static parse(shpBuffer, shxOffsets = null) {
    const view = new DataView(shpBuffer);
    if (shpBuffer.byteLength < 100) {
      throw new Error('Arquivo .shp inválido (menor que 100 bytes).');
    }

    const fileCode = view.getInt32(0, false);
    if (fileCode !== 9994) {
      throw new Error(`Código de cabeçalho do Shapefile inválido: ${fileCode}`);
    }

    const geometries = [];
    let offset = 100;
    const totalLength = shpBuffer.byteLength;

    while (offset < totalLength - 8) {
      const recordNumber = view.getInt32(offset, false);
      const contentLengthWords = view.getInt32(offset + 4, false);
      const contentLengthBytes = contentLengthWords * 2;
      const recordDataPos = offset + 8;

      if (recordDataPos + contentLengthBytes > totalLength) break;

      const shapeType = view.getInt32(recordDataPos, true);

      // Null Shape (0)
      if (shapeType === 0) {
        geometries.push({ type: 'Null', coordinates: [] });
      }
      // Point (1), PointZ (11), PointM (21)
      else if (shapeType === 1 || shapeType === 11 || shapeType === 21) {
        const x = view.getFloat64(recordDataPos + 4, true);
        const y = view.getFloat64(recordDataPos + 12, true);
        geometries.push({
          type: 'Point',
          coordinates: [y, x] // Leaflet [lat, lng]
        });
      }
      // PolyLine (3), PolyLineZ (13), PolyLineM (23)
      else if (shapeType === 3 || shapeType === 13 || shapeType === 23) {
        const numParts = view.getInt32(recordDataPos + 36, true);
        const numPoints = view.getInt32(recordDataPos + 40, true);

        const parts = [];
        for (let p = 0; p < numParts; p++) {
          parts.push(view.getInt32(recordDataPos + 44 + p * 4, true));
        }

        const pointsPos = recordDataPos + 44 + numParts * 4;
        const allPoints = [];
        for (let pt = 0; pt < numPoints; pt++) {
          const x = view.getFloat64(pointsPos + pt * 16, true);
          const y = view.getFloat64(pointsPos + pt * 16 + 8, true);
          allPoints.push([y, x]);
        }

        const lines = [];
        for (let p = 0; p < numParts; p++) {
          const start = parts[p];
          const end = (p + 1 < numParts) ? parts[p + 1] : allPoints.length;
          const line = allPoints.slice(start, end);
          if (line.length >= 2) {
            lines.push(line);
          }
        }

        geometries.push({
          type: 'PolyLine',
          isMulti: lines.length > 1,
          coordinates: lines.length > 1 ? lines : (lines[0] || allPoints)
        });
      }
      // Polygon (5), PolygonZ (15), PolygonM (25)
      else if (shapeType === 5 || shapeType === 15 || shapeType === 25) {
        const numParts = view.getInt32(recordDataPos + 36, true);
        const numPoints = view.getInt32(recordDataPos + 40, true);

        const parts = [];
        for (let p = 0; p < numParts; p++) {
          parts.push(view.getInt32(recordDataPos + 44 + p * 4, true));
        }

        const pointsPos = recordDataPos + 44 + numParts * 4;
        const allPoints = [];
        for (let pt = 0; pt < numPoints; pt++) {
          const x = view.getFloat64(pointsPos + pt * 16, true);
          const y = view.getFloat64(pointsPos + pt * 16 + 8, true);
          allPoints.push([y, x]);
        }

        const rings = [];
        for (let p = 0; p < numParts; p++) {
          const start = parts[p];
          const end = (p + 1 < numParts) ? parts[p + 1] : allPoints.length;
          let ring = allPoints.slice(start, end);
          if (ring.length >= 2) {
            const first = ring[0];
            const last = ring[ring.length - 1];
            if (first && last && Math.abs(first[0] - last[0]) < 1e-7 && Math.abs(first[1] - last[1]) < 1e-7) {
              ring = ring.slice(0, -1);
            }
          }
          if (ring.length >= 3) rings.push(ring);
        }

        // Anéis horários são externos e anti-horários são furos: cada polígono sai como
        // [externo, furo...]. Partes disjuntas viram polígonos distintos (não "furos" umas das outras).
        const polygons = FeatureGeometryUtils.groupPolygonRings(rings);
        const firstPolygon = polygons[0];
        geometries.push({
          type: 'Polygon',
          isMulti: polygons.length > 1,
          polygons,
          coordinates: firstPolygon ? (firstPolygon.length > 1 ? firstPolygon : firstPolygon[0]) : []
        });
      }
      // MultiPoint (8), MultiPointZ (18), MultiPointM (28)
      else if (shapeType === 8 || shapeType === 18 || shapeType === 28) {
        const numPoints = view.getInt32(recordDataPos + 36, true);
        const pointsPos = recordDataPos + 40;
        const points = [];
        for (let pt = 0; pt < numPoints; pt++) {
          const x = view.getFloat64(pointsPos + pt * 16, true);
          const y = view.getFloat64(pointsPos + pt * 16 + 8, true);
          points.push([y, x]);
        }
        geometries.push({
          type: 'MultiPoint',
          points,
          coordinates: points[0] || []
        });
      } else {
        // Tipo não suportado (ex.: MultiPatch): mantém o registro como nulo para não deslocar os atributos do .dbf
        geometries.push({ type: 'Null', coordinates: [] });
      }

      offset = recordDataPos + contentLengthBytes;
    }

    return geometries;
  }
}
