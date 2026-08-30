/* ==========================================================================
   ConecteMapas - ShxParser
   Responsabilidade Única: Leitura do índice posicional de registros (.SHX)
   ========================================================================== */

export class ShxParser {
  /**
   * Parseia arquivo .SHX (Índice posicional dos registros)
   * @param {ArrayBuffer} shxBuffer
   * @returns {Array<{offsetBytes: number, lengthBytes: number}>|null}
   */
  static parse(shxBuffer) {
    if (!shxBuffer || shxBuffer.byteLength < 100) return null;

    const view = new DataView(shxBuffer);
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
}
