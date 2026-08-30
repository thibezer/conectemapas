/* ==========================================================================
   ConecteMapas - ShapefileWriter
   Responsabilidade Única: Construção e geração de arquivos binários .SHP, .SHX e .DBF
   ========================================================================== */

export class ShapefileWriter {
  /**
   * Constrói buffers binários para .SHP e .SHX
   * @param {Array} features
   * @returns {{shpBuffer: ArrayBuffer, shxBuffer: ArrayBuffer}}
   */
  static buildShpAndShx(features) {
    const validFeatures = features.filter(f => Array.isArray(f.coordinates) && f.coordinates.length > 0);
    const numRecords = validFeatures.length;

    // Calcula Bounding Box geral
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const getFlattenedPoints = (f) => {
      if (f.type === 'Point') return [f.coordinates];
      if (Array.isArray(f.coordinates[0]) && Array.isArray(f.coordinates[0][0])) {
        return f.coordinates.flat();
      }
      return f.coordinates || [];
    };

    validFeatures.forEach(f => {
      const pts = getFlattenedPoints(f);
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

    let totalRecordBytes = 0;
    const recordBuffers = [];

    validFeatures.forEach((f) => {
      let shapeType = 5;
      let recordByteLen = 0;
      let recordView;

      if (f.type === 'Point') {
        shapeType = 1;
        recordByteLen = 20;
        const buf = new ArrayBuffer(recordByteLen);
        recordView = new DataView(buf);
        recordView.setInt32(0, 1, true);
        recordView.setFloat64(4, f.coordinates[1], true); // X (lng)
        recordView.setFloat64(12, f.coordinates[0], true); // Y (lat)
        recordBuffers.push({ shapeType, byteLen: recordByteLen, buffer: buf });
      } else {
        const isPoly = f.type === 'Polygon';
        shapeType = isPoly ? 5 : 3;

        const isMulti = Array.isArray(f.coordinates[0]) && Array.isArray(f.coordinates[0][0]);
        const partsList = isMulti ? f.coordinates : [f.coordinates];
        const numParts = partsList.length;
        const allPoints = [];
        const partOffsets = [];

        partsList.forEach(part => {
          partOffsets.push(allPoints.length);
          part.forEach(pt => allPoints.push(pt));
        });

        const numPoints = allPoints.length;
        recordByteLen = 44 + numParts * 4 + numPoints * 16;
        const buf = new ArrayBuffer(recordByteLen);
        recordView = new DataView(buf);

        let rMinX = Infinity, rMinY = Infinity, rMaxX = -Infinity, rMaxY = -Infinity;
        allPoints.forEach(p => {
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

        partOffsets.forEach((off, pIdx) => {
          recordView.setInt32(44 + pIdx * 4, off, true);
        });

        const ptsStart = 44 + numParts * 4;
        allPoints.forEach((p, pIdx) => {
          recordView.setFloat64(ptsStart + pIdx * 16, p[1], true);
          recordView.setFloat64(ptsStart + pIdx * 16 + 8, p[0], true);
        });

        recordBuffers.push({ shapeType, byteLen: recordByteLen, buffer: buf });
      }

      totalRecordBytes += 8 + recordByteLen;
    });

    const shpTotalBytes = 100 + totalRecordBytes;
    const shxTotalBytes = 100 + numRecords * 8;

    const shpBuf = new ArrayBuffer(shpTotalBytes);
    const shxBuf = new ArrayBuffer(shxTotalBytes);
    const shpView = new DataView(shpBuf);
    const shxView = new DataView(shxBuf);

    // 1. Cabeçalho .SHP
    shpView.setInt32(0, 9994, false);
    shpView.setInt32(24, shpTotalBytes / 2, false);
    shpView.setInt32(28, 1000, true);
    shpView.setInt32(32, recordBuffers[0]?.shapeType || 5, true);
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
      shxView.setInt32(shxOffsetPos, currentShpOffset / 2, false);
      shxView.setInt32(shxOffsetPos + 4, wordsLen, false);

      currentShpOffset += 8 + rec.byteLen;
    });

    return { shpBuffer: shpBuf, shxBuffer: shxBuf };
  }

  /**
   * Constrói buffer binário para tabela de atributos .DBF
   * @param {Array} features
   * @returns {ArrayBuffer}
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

    view.setUint8(0, 0x03);
    const now = new Date();
    view.setUint8(1, now.getFullYear() - 1900);
    view.setUint8(2, now.getMonth() + 1);
    view.setUint8(3, now.getDate());
    view.setUint32(4, numRecords, true);
    view.setUint16(8, headerLength, true);
    view.setUint16(10, recordLength, true);

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

    uint8[32 + fields.length * 32] = 0x0d;

    let currentPos = headerLength;
    validFeatures.forEach(feat => {
      uint8[currentPos] = 0x20;
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
          uint8[colPos + i] = i < valBytes.length ? valBytes[i] : 0x20;
        }
        colPos += field.length;
      });

      currentPos += recordLength;
    });

    uint8[totalDbfBytes - 1] = 0x1a;

    return dbfBuf;
  }
}
