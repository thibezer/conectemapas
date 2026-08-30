/* ==========================================================================
   ConecteMapas - DbfParser
   Responsabilidade Única: Leitura e extração de atributos dBase III / IV (.DBF)
   ========================================================================== */

export class DbfParser {
  /**
   * Parseia tabela de atributos .DBF (dBase III / IV)
   * @param {ArrayBuffer} dbfBuffer
   * @param {string} encoding
   * @returns {Array<Object>} Lista de registros chave-valor
   */
  static parse(dbfBuffer, encoding = 'utf-8') {
    if (!dbfBuffer || dbfBuffer.byteLength < 32) return [];

    const view = new DataView(dbfBuffer);
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
}
