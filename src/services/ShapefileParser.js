/* ==========================================================================
   ConecteMapas - ShapefileParser Service (SRP Facade)
   Parser e Gerador completo para os 5 principais arquivos ESRI Shapefile:
   .SHP, .DBF, .PRJ, .SHX, .CPG (Avulsos ou compactados em .ZIP)
   ========================================================================== */

import JSZip from 'jszip';
import proj4 from 'proj4';
import { PrjParser } from './Shapefile/PrjParser.js';
import { CpgParser } from './Shapefile/CpgParser.js';
import { ShxParser } from './Shapefile/ShxParser.js';
import { DbfParser } from './Shapefile/DbfParser.js';
import { ShpParser } from './Shapefile/ShpParser.js';
import { ShapefileWriter } from './Shapefile/ShapefileWriter.js';
import './Shapefile/Projections.js';

export class ShapefileParser {
  /**
   * Identifica e parseia arquivos de entrada (ZIP ou lista de arquivos avulsos)
   * @param {File|FileList|Array<File>|Blob|ArrayBuffer} input 
   */
  static async parse(input) {
    let fileMap = new Map();

    const isBlob = typeof Blob !== 'undefined' && input instanceof Blob;
    const isFile = typeof File !== 'undefined' && input instanceof File;
    const isFileList = typeof FileList !== 'undefined' && input instanceof FileList;

    if (isFile || isBlob) {
      const fileName = (input.name || '').toLowerCase();
      if (fileName.endsWith('.zip')) {
        fileMap = await this.extractZip(input);
      } else {
        const ext = this.getFileExtension(fileName);
        const baseName = this.getFileBaseName(fileName);
        fileMap.set(`${baseName}.${ext}`, await input.arrayBuffer());
      }
    } else if (isFileList || Array.isArray(input)) {
      for (const f of input) {
        const name = (f.name || '').toLowerCase();
        if (name.endsWith('.zip')) {
          const zipMap = await this.extractZip(f);
          zipMap.forEach((val, key) => fileMap.set(key, val));
        } else {
          fileMap.set(name, await f.arrayBuffer());
        }
      }
    } else if (input instanceof ArrayBuffer) {
      try {
        fileMap = await this.extractZip(input);
      } catch {
        fileMap.set('dataset.shp', input);
      }
    }

    return this.parseFileMap(fileMap);
  }

  static async extractZip(zipData) {
    const zip = await JSZip.loadAsync(zipData);
    const fileMap = new Map();

    const entries = Object.keys(zip.files);
    for (const entryName of entries) {
      const entry = zip.files[entryName];
      if (!entry.dir) {
        const lowerName = entryName.toLowerCase().split('/').pop();
        if (lowerName) {
          const buffer = await entry.async('arraybuffer');
          fileMap.set(lowerName, buffer);
        }
      }
    }

    return fileMap;
  }

  static async parseFileMap(fileMap) {
    let shpName = null;
    let baseName = null;

    for (const key of fileMap.keys()) {
      if (key.endsWith('.shp')) {
        shpName = key;
        baseName = key.slice(0, -4);
        break;
      }
    }

    if (!shpName) {
      throw new Error('Nenhum arquivo de geometria (.shp) foi encontrado no pacote fornecido.');
    }

    const shpBuffer = fileMap.get(shpName);
    const dbfBuffer = fileMap.get(`${baseName}.dbf`) || this.findFuzzyFile(fileMap, '.dbf');
    const prjBuffer = fileMap.get(`${baseName}.prj`) || this.findFuzzyFile(fileMap, '.prj');
    const shxBuffer = fileMap.get(`${baseName}.shx`) || this.findFuzzyFile(fileMap, '.shx');
    const cpgBuffer = fileMap.get(`${baseName}.cpg`) || this.findFuzzyFile(fileMap, '.cpg');

    const encoding = CpgParser.parse(cpgBuffer);
    const prjInfo = PrjParser.parse(prjBuffer);
    const shxOffsets = ShxParser.parse(shxBuffer);
    const dbfRecords = DbfParser.parse(dbfBuffer, encoding);
    const rawGeometries = ShpParser.parse(shpBuffer, shxOffsets);

    // Otimização QGIS: Compila o pipeline do proj4 UMA ÚNICA VEZ para todo o arquivo
    let transformer = null;
    if (prjInfo && !prjInfo.isWGS84 && prjInfo.epsg !== 'EPSG:4326') {
      try {
        const sourceEpsg = prjInfo.epsg || 'CUSTOM_PRJ';
        transformer = proj4(sourceEpsg, 'EPSG:4326');
      } catch (err) {
        console.warn('[ShapefileParser] Erro ao instanciar transformer proj4:', err);
      }
    }

    const features = [];
    for (let i = 0; i < rawGeometries.length; i++) {
      const geom = rawGeometries[i];
      if (!geom || geom.type === 'Null') continue;

      const attrs = dbfRecords[i] || {};
      const reprojectedCoords = this.reprojectGeometry(geom.coordinates, geom.type, prjInfo, transformer);

      let featType = 'Polygon';
      if (geom.type === 'Point' || geom.type === 'MultiPoint') featType = 'Point';
      else if (geom.type === 'PolyLine') featType = 'LineString';
      else if (geom.type === 'Polygon') featType = 'Polygon';

      const featName = attrs.NOME || attrs.Nome || attrs.name || attrs.NAME || attrs.ID || attrs.id || `${baseName} #${i + 1}`;
      const featCategory = attrs.CATEGORIA || attrs.Categoria || attrs.TIPO || attrs.Tipo || 'Shapefile';

      features.push({
        id: `feat-shp-${Date.now()}-${i + 1}`,
        name: String(featName),
        type: featType,
        layerId: 'layer-topografia',
        category: String(featCategory),
        coordinates: reprojectedCoords,
        properties: attrs,
        customAttributes: Object.entries(attrs).map(([key, val]) => ({
          key,
          value: val == null ? '' : String(val)
        })),
        style: {
          fillColor: '#00E08A',
          fillOpacity: featType === 'LineString' ? 1 : 0.35,
          strokeColor: '#00E08A',
          strokeWidth: 2.5,
          strokeDashArray: '',
          markerIcon: 'pin',
          markerSize: 24,
          markerRotation: 0,
          showLabel: false,
          labelField: 'name'
        },
        createdBy: 'Importador SHP',
        createdAt: new Date().toISOString()
      });
    }

    return {
      features,
      metadata: {
        baseName,
        totalRecords: features.length,
        encoding,
        projection: prjInfo.name || 'WGS 84',
        epsg: prjInfo.epsg || 'EPSG:4326',
        geometryType: rawGeometries[0]?.type || 'Desconhecido',
        filesFound: {
          shp: true,
          dbf: Boolean(dbfBuffer),
          prj: Boolean(prjBuffer),
          shx: Boolean(shxBuffer),
          cpg: Boolean(cpgBuffer)
        }
      }
    };
  }

  static parseCPG(cpgBuffer) { return CpgParser.parse(cpgBuffer); }
  static parsePRJ(prjBuffer) { return PrjParser.parse(prjBuffer); }
  static parseSHX(shxBuffer) { return ShxParser.parse(shxBuffer); }
  static parseDBF(dbfBuffer, encoding) { return DbfParser.parse(dbfBuffer, encoding); }
  static parseSHP(shpBuffer, shxOffsets) { return ShpParser.parse(shpBuffer, shxOffsets); }
  static buildShpAndShx(features) { return ShapefileWriter.buildShpAndShx(features); }
  static buildDbf(features) { return ShapefileWriter.buildDbf(features); }

  static reprojectGeometry(coords, geomType, prjInfo, transformer = null) {
    if (!prjInfo || prjInfo.isWGS84 || prjInfo.epsg === 'EPSG:4326') {
      return coords;
    }

    // Se não recebeu o transformer compilado do batch, compila agora (apenas uma vez por geometria)
    if (!transformer) {
      const sourceEpsg = prjInfo.epsg || 'CUSTOM_PRJ';
      try {
        transformer = proj4(sourceEpsg, 'EPSG:4326');
      } catch (err) {
        console.warn('[ShapefileParser] Erro ao instanciar transformer proj4:', err);
        return coords;
      }
    }

    const reprojectPoint = (pt) => {
      try {
        // No Shapefile do ShpParser, pt é [lat, lng]. proj4.forward recebe [lng, lat]
        const [wgsLng, wgsLat] = transformer.forward([pt[1], pt[0]]);
        return [wgsLat, wgsLng];
      } catch (err) {
        return pt;
      }
    };


    if (geomType === 'Point') {
      return reprojectPoint(coords);
    } else if (Array.isArray(coords)) {
      if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
        return coords.map(ring => ring.map(pt => reprojectPoint(pt)));
      }
      return coords.map(pt => reprojectPoint(pt));
    }
    return coords;
  }


  static async exportToShapefileZip(features, baseName = 'conectemapas_export') {
    const zip = new JSZip();

    const prjContent = 'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';
    zip.file(`${baseName}.prj`, prjContent);
    zip.file(`${baseName}.cpg`, 'UTF-8');

    const { shpBuffer, shxBuffer } = this.buildShpAndShx(features);
    zip.file(`${baseName}.shp`, shpBuffer);
    zip.file(`${baseName}.shx`, shxBuffer);

    const dbfBuffer = this.buildDbf(features);
    zip.file(`${baseName}.dbf`, dbfBuffer);

    return zip.generateAsync({ type: 'blob' });
  }

  static getFileExtension(filename) {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
  }

  static getFileBaseName(filename) {
    const parts = filename.split('.');
    if (parts.length > 1) parts.pop();
    return parts.join('.');
  }

  static findFuzzyFile(fileMap, extension) {
    for (const [key, val] of fileMap.entries()) {
      if (key.endsWith(extension)) return val;
    }
    return null;
  }
}
