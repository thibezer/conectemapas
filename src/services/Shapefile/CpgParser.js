/* ==========================================================================
   ConecteMapas - CpgParser
   Responsabilidade Única: Identificação de codificação de caracteres (.CPG)
   ========================================================================== */

export class CpgParser {
  /**
   * Parseia arquivo .CPG (Codificação de Caracteres)
   * @param {ArrayBuffer} cpgBuffer
   * @returns {string} Encoding normalizado (ex: 'utf-8', 'windows-1252', 'iso-8859-1')
   */
  static parse(cpgBuffer) {
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
}
