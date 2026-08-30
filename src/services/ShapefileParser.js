/* ==========================================================================
   ConecteMapas - ShapefileParser Service (SRP Encapsulated)
   Parser e Gerador completo para os 5 principais arquivos ESRI Shapefile:
   1. .SHP (Geometria binária: Point, PolyLine, Polygon, MultiPoint, PointZ/M, PolyLineZ/M, PolygonZ/M)
   2. .DBF (Tabela de atributos dBase III/IV)
   3. .PRJ (Projeção e Datum cartográfico WKT / EPSG / UTM / SIRGAS 2000 / SAD69 / WGS84)
   4. .SHX (Índice posicional de registros de geometria)
   5. .CPG (Codificação de caracteres UTF-8 / Windows-1252 / ISO-8859-1 / IBM850)
   Suporte a arquivos avulsos e arquivos compactados .ZIP (JSZip)
   ========================================================================== */

import JSZip from 'jszip';
import proj4 from 'proj4';

// Definições oficiais de projeções brasileiras para Proj4
const BRAZILIAN_PROJECTIONS = {
  'EPSG:4674': '+proj=longlat +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +no_defs', // SIRGAS 2000 Geográficas
  'EPSG:4618': '+proj=longlat +ellps=aust_SA +towgs84=-66.87,4.37,-38.52,0,0,0,0 +no_defs', // SAD69 Geográficas
  'EPSG:4225': '+proj=longlat +ellps=intl +towgs84=-205.57,168.77,-3.68,0,0,0,0 +no_defs', // Córrego Alegre
  'EPSG:4326': '+proj=longlat +datum=WGS84 +no_defs', // WGS 84
  'EPSG:3857': '+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs' // Web Mercator
};

// Registra fusos UTM comuns do Brasil (Zonas 18S a 25S)
for (let zone = 18; zone <= 25; zone++) {
  // SIRGAS 2000 UTM
  const sirgasCode = `EPSG:${31960 + zone}`; // 31978 (18S) a 31985 (25S)
  const sirgasProj = `+proj=utm +zone=${zone} +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs`;
  BRAZILIAN_PROJECTIONS[sirgasCode] = sirgasProj;
  proj4.defs(sirgasCode, sirgasProj);

  // SAD69 UTM
  const sadCode = `EPSG:${29170 + zone}`; // 29188 a 29195
  const sadProj = `+proj=utm +zone=${zone} +south +ellps=aust_SA +towgs84=-66.87,4.37,-38.52,0,0,0,0 +units=m +no_defs`;
  BRAZILIAN_PROJECTIONS[sadCode] = sadProj;
  proj4.defs(sadCode, sadProj);

  // WGS 84 UTM
  const wgsCode = `EPSG:${32700 + zone}`;
  const wgsProj = `+proj=utm +zone=${zone} +south +datum=WGS84 +units=m +no_defs`;
  BRAZILIAN_PROJECTIONS[wgsCode] = wgsProj;
  proj4.defs(wgsCode, wgsProj);
}

// Registra projeções geográficas
Object.entries(BRAZILIAN_PROJECTIONS).forEach(([code, def]) => {
  proj4.defs(code, def);
});

export class ShapefileParser {
  /**
   * Identifica e parseia arquivos de entrada (ZIP ou lista de arquivos avulsos)
   * @param {File|FileList|Array<File>|Blob|ArrayBuffer} input 
   * @returns {Promise<{features: Array, metadata: Object, filesFound: Object}>}
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
      // Tenta descompactar como ZIP
      try {
        fileMap = await this.extractZip(input);
      } catch {
        fileMap.set('dataset.shp', input);
      }
    }

    return this.parseFileMap(fileMap);
  }

  /**
   * Descompacta arquivo .ZIP em memória
   */
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

  /**
   * Processa o mapa de arquivos binários (.shp, .dbf, .prj, .shx, .cpg)
   */
  static async parseFileMap(fileMap) {
    // 1. Identifica o arquivo .shp principal
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

    // 2. Extrai Encoding do .CPG
    const encoding = this.parseCPG(cpgBuffer);

    // 3. Extrai e detecta Projeção do .PRJ
    const prjInfo = this.parsePRJ(prjBuffer);

    // 4. Parseia Índice de Registros do .SHX (se presente)
    const shxOffsets = shxBuffer ? this.parseSHX(shxBuffer) : null;

    // 5. Parseia Tabela de Atributos .DBF
    const dbfRecords = dbfBuffer ? this.parseDBF(dbfBuffer, encoding) : [];

    // 6. Parseia Geometrias do .SHP
    const rawGeometries = this.parseSHP(shpBuffer, shxOffsets);

    // 7. Reprojeção e montagem das Feições ConecteMapas
    const features = [];
    const count = Math.max(rawGeometries.length, dbfRecords.length);

    for (let i = 0; i < rawGeometries.length; i++) {
      const geom = rawGeometries[i];
      if (!geom || geom.type === 'Null') continue;

      const attrs = dbfRecords[i] || {};
      const reprojectedCoords = this.reprojectGeometry(geom.coordinates, geom.type, prjInfo);

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

  /**
   * Parseia arquivo .CPG (Codificação de Caracteres)
   */
  static parseCPG(cpgBuffer) {
    if (!cpgBuffer) return 'utf-8';
    try {
      const text = new TextDecoder('utf-8').decode(cpgBuffer).trim().toUpperCase();
      if (text.includes('1252') || text.includes('CP1252') || text.includes('ANSI')) return 'windows-1252';
      if (text.includes('8859-1') || text.includes('LATIN1') || text.includes('88591')) return 'iso-8859-1';
      if (text.includes('850') || text.includes('CP850') || text.includes('IBM850')) return 'ibm850';
      if (text.includes('UTF-8') || text.includes('UTF8')) return 'utf-8';
      return text.toLowerCase();
    } catch {
      return 'utf-8';
    }
  }

  /**
   * Parseia arquivo .PRJ (Sistema de Referência de Coordenadas)
   */
  static parsePRJ(prjBuffer) {
    if (!prjBuffer) {
      return { wkt: '', epsg: 'EPSG:4326', name: 'WGS 84 (Padrão)', isWGS84: true };
    }

    const wkt = new TextDecoder('utf-8').decode(prjBuffer).trim();
    const upper = wkt.toUpperCase();

    // 1. Detecção de SIRGAS 2000 UTM
    const utmMatch = upper.match(/UTM[_\s]+ZONE[_\s]+(\d+)[_\s]*(S|SOUTH)?/i) || upper.match(/FUSO[_\s]+(\d+)[_\s]*(S|SUL)?/i);
    const isSirgas = upper.includes('SIRGAS') || upper.includes('GRS_1980') || upper.includes('GRS80');
    const isSad69 = upper.includes('SAD') || upper.includes('SOUTH_AMERICAN_DATUM_1969') || upper.includes('AUST_SA');
    const isWgs84 = upper.includes('WGS_1984') || upper.includes('WGS84');

    if (utmMatch) {
      const zone = parseInt(utmMatch[1], 10);
      if (zone >= 18 && zone <= 25) {
        if (isSirgas) {
          const epsg = `EPSG:${31960 + zone}`;
          return { wkt, epsg, name: `SIRGAS 2000 / UTM Fuso ${zone}S`, isWGS84: false, proj4def: BRAZILIAN_PROJECTIONS[epsg] };
        }
        if (isSad69) {
          const epsg = `EPSG:${29170 + zone}`;
          return { wkt, epsg, name: `SAD69 / UTM Fuso ${zone}S`, isWGS84: false, proj4def: BRAZILIAN_PROJECTIONS[epsg] };
        }
        if (isWgs84) {
          const epsg = `EPSG:${32700 + zone}`;
          return { wkt, epsg, name: `WGS 84 / UTM Fuso ${zone}S`, isWGS84: false, proj4def: BRAZILIAN_PROJECTIONS[epsg] };
        }
      }
    }

    // 2. Geográficas
    if (isSirgas && !utmMatch) {
      return { wkt, epsg: 'EPSG:4674', name: 'SIRGAS 2000 (Geográficas)', isWGS84: false, proj4def: BRAZILIAN_PROJECTIONS['EPSG:4674'] };
    }
    if (isSad69 && !utmMatch) {
      return { wkt, epsg: 'EPSG:4618', name: 'SAD69 (Geográficas)', isWGS84: false, proj4def: BRAZILIAN_PROJECTIONS['EPSG:4618'] };
    }
    if (upper.includes('3857') || upper.includes('WEB_MERCATOR') || upper.includes('PSEUDO_MERCATOR')) {
      return { wkt, epsg: 'EPSG:3857', name: 'WGS 84 / Pseudo-Mercator (EPSG:3857)', isWGS84: false, proj4def: BRAZILIAN_PROJECTIONS['EPSG:3857'] };
    }

    // 3. Tenta passar o WKT diretamente para o proj4
    try {
      proj4.defs('CUSTOM_PRJ', wkt);
      return { wkt, epsg: 'CUSTOM_PRJ', name: 'Projeção Personalizada (WKT)', isWGS84: false, proj4def: wkt };
    } catch {
      return { wkt, epsg: 'EPSG:4326', name: 'WGS 84 (Geográficas)', isWGS84: true };
    }
  }

  /**
   * Parseia arquivo .SHX (Índice posicional dos registros)
   */
  static parseSHX(shxBuffer) {
    const view = new DataView(shxBuffer);
    if (shxBuffer.byteLength < 100) return null;

    const fileCode = view.getInt32(0, false);
    if (fileCode !== 9994) return null;

    const offsets = [];
    const numRecords = (shxBuffer.byteLength - 100) / 8;

    for (let i = 0; i < numRecords; i++) {
      const pos = 100 + i * 8;
      const offsetWords = view.getInt32(pos, false);
      const lengthWords = view.getInt32(pos + 4, false);
      offsets.push({
        offsetBytes: offsetWords * 2,
        lengthBytes: lengthWords * 2
      });
    }

    return offsets;
  }

  /**
   * Parseia tabela de atributos .DBF (dBase III / IV)
   */
  static parseDBF(dbfBuffer, encoding = 'utf-8') {
    const view = new DataView(dbfBuffer);
    if (dbfBuffer.byteLength < 32) return [];

    const numRecords = view.getUint32(4, true);
    const headerLength = view.getUint16(8, true);
    const recordLength = view.getUint16(10, true);

    // Cria TextDecoder resiliente
    let decoder;
    try {
      decoder = new TextDecoder(encoding, { fatal: false });
    } catch {
      decoder = new TextDecoder('utf-8', { fatal: false });
    }

    // Extrai descritores de campos
    const fields = [];
    let fieldOffset = 32;

    while (fieldOffset < headerLength - 1) {
      if (view.getUint8(fieldOffset) === 0x0d) break; // Terminador de cabeçalho

      const nameBytes = new Uint8Array(dbfBuffer, fieldOffset, 11);
      let nameEnd = 0;
      while (nameEnd < 11 && nameBytes[nameEnd] !== 0) nameEnd++;

      const fieldName = decoder.decode(nameBytes.subarray(0, nameEnd)).trim();
      const fieldType = String.fromCharCode(view.getUint8(fieldOffset + 11));
      const fieldLen = view.getUint8(fieldOffset + 16);
      const fieldDec = view.getUint8(fieldOffset + 17);

      fields.push({
        name: fieldName,
        type: fieldType,
        length: fieldLen,
        decimals: fieldDec
      });

      fieldOffset += 32;
    }

    // Lê linhas de registros
    const records = [];
    let recordPos = headerLength;

    for (let r = 0; r < numRecords; r++) {
      if (recordPos + recordLength > dbfBuffer.byteLength) break;

      const deleteFlag = view.getUint8(recordPos);
      if (deleteFlag === 0x2a) {
        // Registro deletado
        recordPos += recordLength;
        continue;
      }

      let colPos = recordPos + 1;
      const row = {};

      for (const field of fields) {
        const valBytes = new Uint8Array(dbfBuffer, colPos, field.length);
        const rawStr = decoder.decode(valBytes).trim();

        if (field.type === 'N' || field.type === 'F') {
          const num = parseFloat(rawStr);
          row[field.name] = isNaN(num) ? rawStr : num;
        } else if (field.type === 'L') {
          row[field.name] = rawStr.toUpperCase() === 'T' || rawStr.toUpperCase() === 'Y';
        } else if (field.type === 'D') {
          row[field.name] = rawStr.length === 8 ? `${rawStr.slice(0, 4)}-${rawStr.slice(4, 6)}-${rawStr.slice(6, 8)}` : rawStr;
        } else {
          row[field.name] = rawStr;
        }

        colPos += field.length;
      }

      records.push(row);
      recordPos += recordLength;
    }

    return records;
  }

  /**
   * Parseia a geometria binária do arquivo .SHP
   */
  static parseSHP(shpBuffer, shxOffsets = null) {
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

        // Se houver múltiplas partes, pega a principal ou primeira
        const mainLine = parts.length > 1 
          ? allPoints.slice(parts[0], parts[1]) 
          : allPoints;

        geometries.push({
          type: 'PolyLine',
          coordinates: mainLine
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

        // Anel externo principal
        const exteriorRing = parts.length > 1
          ? allPoints.slice(parts[0], parts[1])
          : allPoints;

        geometries.push({
          type: 'Polygon',
          coordinates: exteriorRing
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
          type: 'Point',
          coordinates: points[0] || [0, 0]
        });
      }

      offset = recordDataPos + contentLengthBytes;
    }

    return geometries;
  }

  /**
   * Reprojeta coordenadas de qualquer CRS para WGS 84 ([lat, lng])
   */
  static reprojectGeometry(coords, geomType, prjInfo) {
    if (!prjInfo || prjInfo.isWGS84 || prjInfo.epsg === 'EPSG:4326') {
      return coords;
    }

    const sourceEpsg = prjInfo.epsg || 'CUSTOM_PRJ';
    const targetEpsg = 'EPSG:4326';

    const reprojectPoint = (pt) => {
      try {
        // pt está em [lat/Y, lng/X]
        const y = pt[0];
        const x = pt[1];
        const [wgsLng, wgsLat] = proj4(sourceEpsg, targetEpsg, [x, y]);
        return [wgsLat, wgsLng];
      } catch (err) {
        console.warn('Erro ao reprojetar coordenada:', pt, err);
        return pt;
      }
    };

    if (geomType === 'Point') {
      return reprojectPoint(coords);
    } else if (Array.isArray(coords)) {
      return coords.map(pt => reprojectPoint(pt));
    }
    return coords;
  }

  /**
   * Gera um pacote completo ESRI Shapefile compactado (.ZIP) com os 5 arquivos
   * (.shp, .dbf, .prj, .shx, .cpg)
   */
  static async exportToShapefileZip(features, baseName = 'conectemapas_export') {
    const zip = new JSZip();

    // 1. Gera .PRJ (WGS 84 Padrão)
    const prjContent = 'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';
    zip.file(`${baseName}.prj`, prjContent);

    // 2. Gera .CPG (UTF-8)
    zip.file(`${baseName}.cpg`, 'UTF-8');

    // 3. Gera .SHP e .SHX binários
    const { shpBuffer, shxBuffer } = this.buildShpAndShx(features);
    zip.file(`${baseName}.shp`, shpBuffer);
    zip.file(`${baseName}.shx`, shxBuffer);

    // 4. Gera .DBF binário
    const dbfBuffer = this.buildDbf(features);
    zip.file(`${baseName}.dbf`, dbfBuffer);

    return zip.generateAsync({ type: 'blob' });
  }

  /**
   * Constrói buffers binários para .SHP e .SHX
   */
  static buildShpAndShx(features) {
    const validFeatures = features.filter(f => Array.isArray(f.coordinates) && f.coordinates.length > 0);
    const numRecords = validFeatures.length;

    // Calcula Bounding Box geral
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    validFeatures.forEach(f => {
      const pts = f.type === 'Point' ? [f.coordinates] : f.coordinates;
      pts.forEach(p => {
        const lat = p[0], lng = p[1];
        if (lng < minX) minX = lng;
        if (lng > maxX) maxX = lng;
        if (lat < minY) minY = lat;
        if (lat > maxY) maxY = lat;
      });
    });

    if (minX === Infinity) {
      minX = 0; minY = 0; maxX = 0; maxY = 0;
    }

    // Calcula tamanho total dos registros
    let totalRecordBytes = 0;
    const recordBuffers = [];

    validFeatures.forEach((f, idx) => {
      let shapeType = 5; // Polygon
      let recordByteLen = 0;
      let recordView;

      if (f.type === 'Point') {
        shapeType = 1;
        recordByteLen = 20; // 4 bytes shapeType + 16 bytes XY
        const buf = new ArrayBuffer(recordByteLen);
        recordView = new DataView(buf);
        recordView.setInt32(0, 1, true);
        recordView.setFloat64(4, f.coordinates[1], true); // X (lng)
        recordView.setFloat64(12, f.coordinates[0], true); // Y (lat)
        recordBuffers.push({ shapeType, byteLen: recordByteLen, buffer: buf });
      } else {
        const isPoly = f.type === 'Polygon';
        shapeType = isPoly ? 5 : 3;
        const numPoints = f.coordinates.length;
        const numParts = 1;

        recordByteLen = 44 + numParts * 4 + numPoints * 16;
        const buf = new ArrayBuffer(recordByteLen);
        recordView = new DataView(buf);

        // Bounding Box do registro
        let rMinX = Infinity, rMinY = Infinity, rMaxX = -Infinity, rMaxY = -Infinity;
        f.coordinates.forEach(p => {
          if (p[1] < rMinX) rMinX = p[1];
          if (p[1] > rMaxX) rMaxX = p[1];
          if (p[0] < rMinY) rMinY = p[0];
          if (p[0] > rMaxY) rMaxY = p[0];
        });

        recordView.setInt32(0, shapeType, true);
        recordView.setFloat64(4, rMinX, true);
        recordView.setFloat64(12, rMinY, true);
        recordView.setFloat64(20, rMaxX, true);
        recordView.setFloat64(28, rMaxY, true);
        recordView.setInt32(36, numParts, true);
        recordView.setInt32(40, numPoints, true);
        recordView.setInt32(44, 0, true); // Part 0 start offset

        const ptsStart = 48;
        f.coordinates.forEach((p, pIdx) => {
          recordView.setFloat64(ptsStart + pIdx * 16, p[1], true); // X (lng)
          recordView.setFloat64(ptsStart + pIdx * 16 + 8, p[0], true); // Y (lat)
        });

        recordBuffers.push({ shapeType, byteLen: recordByteLen, buffer: buf });
      }

      totalRecordBytes += 8 + recordByteLen; // 8 bytes record header + content
    });

    const shpTotalBytes = 100 + totalRecordBytes;
    const shxTotalBytes = 100 + numRecords * 8;

    const shpBuf = new ArrayBuffer(shpTotalBytes);
    const shxBuf = new ArrayBuffer(shxTotalBytes);
    const shpView = new DataView(shpBuf);
    const shxView = new DataView(shxBuf);

    // 1. Cabeçalho .SHP
    shpView.setInt32(0, 9994, false); // File Code
    shpView.setInt32(24, shpTotalBytes / 2, false); // File Length in 16-bit words
    shpView.setInt32(28, 1000, true); // Version
    shpView.setInt32(32, recordBuffers[0]?.shapeType || 5, true); // Shape Type
    shpView.setFloat64(36, minX, true);
    shpView.setFloat64(44, minY, true);
    shpView.setFloat64(52, maxX, true);
    shpView.setFloat64(60, maxY, true);

    // 2. Cabeçalho .SHX
    shxView.setInt32(0, 9994, false);
    shxView.setInt32(24, shxTotalBytes / 2, false);
    shxView.setInt32(28, 1000, true);
    shxView.setInt32(32, recordBuffers[0]?.shapeType || 5, true);
    shxView.setFloat64(36, minX, true);
    shxView.setFloat64(44, minY, true);
    shxView.setFloat64(52, maxX, true);
    shxView.setFloat64(60, maxY, true);

    // 3. Escreve registros e índices
    let currentShpOffset = 100;
    const shpUint8 = new Uint8Array(shpBuf);

    recordBuffers.forEach((rec, idx) => {
      const recordNumber = idx + 1;
      const wordsLen = rec.byteLen / 2;

      // SHP Record Header
      shpView.setInt32(currentShpOffset, recordNumber, false);
      shpView.setInt32(currentShpOffset + 4, wordsLen, false);

      // SHP Record Body
      shpUint8.set(new Uint8Array(rec.buffer), currentShpOffset + 8);

      // SHX Entry
      const shxOffsetPos = 100 + idx * 8;
      shxView.setInt32(shxOffsetPos, currentShpOffset / 2, false); // Offset in words
      shxView.setInt32(shxOffsetPos + 4, wordsLen, false); // Length in words

      currentShpOffset += 8 + rec.byteLen;
    });

    return { shpBuffer: shpBuf, shxBuffer: shxBuf };
  }

  /**
   * Constrói buffer binário para tabela de atributos .DBF
   */
  static buildDbf(features) {
    const validFeatures = features.filter(f => Array.isArray(f.coordinates) && f.coordinates.length > 0);
    const numRecords = validFeatures.length;

    const fields = [
      { name: 'ID', type: 'C', length: 24, decimals: 0 },
      { name: 'NOME', type: 'C', length: 60, decimals: 0 },
      { name: 'TIPO', type: 'C', length: 20, decimals: 0 },
      { name: 'CATEGORIA', type: 'C', length: 40, decimals: 0 },
      { name: 'AREA_HA', type: 'N', length: 12, decimals: 2 },
      { name: 'EXTENSAO', type: 'C', length: 30, decimals: 0 }
    ];

    const headerLength = 32 + fields.length * 32 + 1;
    const recordLength = 1 + fields.reduce((acc, f) => acc + f.length, 0);
    const totalDbfBytes = headerLength + numRecords * recordLength + 1;

    const dbfBuf = new ArrayBuffer(totalDbfBytes);
    const view = new DataView(dbfBuf);
    const uint8 = new Uint8Array(dbfBuf);

    // Header dBase III
    view.setUint8(0, 0x03); // dBase III sem memo
    const now = new Date();
    view.setUint8(1, now.getFullYear() - 1900);
    view.setUint8(2, now.getMonth() + 1);
    view.setUint8(3, now.getDate());
    view.setUint32(4, numRecords, true);
    view.setUint16(8, headerLength, true);
    view.setUint16(10, recordLength, true);

    // Descritores de Campo
    const encoder = new TextEncoder();
    fields.forEach((field, fIdx) => {
      const pos = 32 + fIdx * 32;
      const nameBytes = encoder.encode(field.name);
      for (let i = 0; i < 11; i++) {
        uint8[pos + i] = i < nameBytes.length ? nameBytes[i] : 0;
      }
      uint8[pos + 11] = field.type.charCodeAt(0);
      uint8[pos + 16] = field.length;
      uint8[pos + 17] = field.decimals;
    });

    uint8[32 + fields.length * 32] = 0x0d; // Terminador de cabeçalho

    // Registros
    let currentPos = headerLength;
    validFeatures.forEach(feat => {
      uint8[currentPos] = 0x20; // Deletion flag (espaço = não deletado)
      let colPos = currentPos + 1;

      const areaHa = feat.properties?.['Área (ha)'] 
        ? parseFloat(feat.properties['Área (ha)']) 
        : 0;
      const extensao = feat.properties?.['Extensão'] || '';

      const rowValues = {
        ID: String(feat.id || ''),
        NOME: String(feat.name || ''),
        TIPO: String(feat.type || ''),
        CATEGORIA: String(feat.category || ''),
        AREA_HA: isNaN(areaHa) ? '0.00' : areaHa.toFixed(2),
        EXTENSAO: String(extensao)
      };

      fields.forEach(field => {
        const valStr = String(rowValues[field.name] || '');
        const valBytes = encoder.encode(valStr);

        for (let i = 0; i < field.length; i++) {
          uint8[colPos + i] = i < valBytes.length ? valBytes[i] : 0x20; // Pad com espaços
        }
        colPos += field.length;
      });

      currentPos += recordLength;
    });

    uint8[totalDbfBytes - 1] = 0x1a; // EOF dBase

    return dbfBuf;
  }

  // --- Funções Auxiliares de Nomes de Arquivo ---
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
