/* ==========================================================================
   ConecteMapas - GeoFormats Service (SRP Facade)
   Importação e Exportação: GeoJSON, KML, GPX, CSV, WKT e Shapefile
   ========================================================================== */

import { ShapefileParser } from './ShapefileParser.js';
import { GeoJsonConverter } from './GeoFormats/GeoJsonConverter.js';
import { KmlConverter } from './GeoFormats/KmlConverter.js';
import { CsvConverter } from './GeoFormats/CsvConverter.js';
import { geoWorkerClient } from './Workers/GeoWorkerClient.js';

export class GeoFormats {
  static sanitizeText(str) {
    return KmlConverter.sanitizeText(str);
  }

  static async toShapefileZip(features, projectName = 'conectemapas_export') {
    return ShapefileParser.exportToShapefileZip(features, projectName);
  }

  static async parseShapefile(input) {
    return ShapefileParser.parse(input);
  }

  static toGeoJSON(features, projectName = 'ConecteMapas') {
    return GeoJsonConverter.toGeoJSON(features, projectName);
  }

  static parseGeoJSON(geojson) {
    return GeoJsonConverter.parseGeoJSON(geojson);
  }

  static toKML(features, projectName = 'ConecteMapas') {
    return KmlConverter.toKML(features, projectName);
  }

  static parseKML(kmlText) {
    return KmlConverter.parseKML(kmlText);
  }

  static toGPX(features, projectName = 'ConecteMapas') {
    return GpxConverter.toGPX(features, projectName);
  }

  static toCSV(features) {
    return CsvConverter.toCSV(features);
  }

  static parseCSV(csvText) {
    return CsvConverter.parseCSV(csvText);
  }

  static toWKT(feature) {
    return WktConverter.toWKT(feature);
  }

  static toCoordinateCSV(feature) {
    return CsvConverter.toCoordinateCSV(feature);
  }

  /**
   * Parser unificado e inteligente para arquivos importados
   * @param {File|FileList|Blob|ArrayBuffer|string} contentOrFile
   * @param {string} fileName
   */
  static async parseUploadedFile(contentOrFile, fileName = '') {
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

    if (lowerName.endsWith('.zip') || lowerName.endsWith('.shp') || lowerName.endsWith('.dbf')) {
      return this.parseShapefile(contentOrFile);
    }

    const content = typeof contentOrFile === 'string' 
      ? contentOrFile 
      : new TextDecoder('utf-8').decode(contentOrFile);

    // GeoJSON ou Projeto ConecteMapas JSON
    if (lowerName.endsWith('.geojson') || lowerName.endsWith('.json') || content.trim().startsWith('{')) {
      try {
        const parsed = await geoWorkerClient.parseJSONAsync(content);
        if (parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
          return this.parseGeoJSON(parsed);
        }
        if (parsed.layers && parsed.features) {
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
}
