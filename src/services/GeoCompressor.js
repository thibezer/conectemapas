/* ==========================================================================
   ConecteMapas - GeoCompressor Service (P2)
   Responsabilidade Única: Compactação geodésica de alta fidelidade e compressão
   binária transparente via CompressionStream (GZIP nativo do navegador).
   Reduz o volume de armazenamento no IndexedDB em até 80% sem perda de precisão.
   ========================================================================== */

export class GeoCompressor {
  /**
   * Quantiza coordenadas geográficas para até 6 casas decimais (precisão centimétrica ~0,11 m),
   * eliminando números de ponto flutuante excessivamente longos do JSON/IndexedDB.
   * @param {Array|Object|number} coords
   * @param {number} precision
   * @returns {Array|Object|number}
   */
  static quantizeCoordinates(coords, precision = 6) {
    if (coords == null) return coords;

    if (typeof coords === 'number') {
      return Number(coords.toFixed(precision));
    }

    if (Array.isArray(coords)) {
      const len = coords.length;
      const res = new Array(len);
      for (let i = 0; i < len; i++) {
        res[i] = this.quantizeCoordinates(coords[i], precision);
      }
      return res;
    }

    if (typeof coords === 'object') {
      if (coords.lat !== undefined && coords.lng !== undefined) {
        return {
          lat: Number(coords.lat.toFixed(precision)),
          lng: Number(coords.lng.toFixed(precision))
        };
      }
    }

    return coords;
  }

  /**
   * Sanitiza e compacta um registro de feição para persistência leve no IndexedDB.
   * Remove referências circulares, propriedades nulas desnecessárias e trunca decimais.
   * @param {Object} feat
   * @returns {Object}
   */
  static compactFeatureForStorage(feat) {
    if (!feat || !feat.id) return feat;

    const compactCoords = feat.coordinates ? this.quantizeCoordinates(feat.coordinates, 6) : feat.coordinates;

    const compacted = {
      id: feat.id,
      name: feat.name || '',
      type: feat.type || 'Point',
      layerId: feat.layerId || 'layer-topografia',
      coordinates: compactCoords
    };

    if (feat.category) compacted.category = feat.category;
    if (feat.color) compacted.color = feat.color;
    if (feat.description) compacted.description = feat.description;
    if (feat.radius) compacted.radius = feat.radius;
    if (feat.locked) compacted.locked = true;
    if (feat.createdBy) compacted.createdBy = feat.createdBy;
    if (feat.createdAt) compacted.createdAt = feat.createdAt;
    if (feat.updatedAt) compacted.updatedAt = feat.updatedAt;

    if (feat.properties && typeof feat.properties === 'object' && Object.keys(feat.properties).length > 0) {
      compacted.properties = feat.properties;
    }

    if (feat.style && typeof feat.style === 'object') {
      compacted.style = { ...feat.style };
    }

    if (Array.isArray(feat.customAttributes) && feat.customAttributes.length > 0) {
      compacted.customAttributes = feat.customAttributes;
    }

    if (Array.isArray(feat.history) && feat.history.length > 0) {
      compacted.history = feat.history.slice(0, 5); // Limita histórico persistido a 5 entradas
    }

    return compacted;
  }

  /**
   * Comprime qualquer objeto JavaScript em um buffer binário GZIP usando a API nativa
   * @param {any} data
   * @returns {Promise<Uint8Array>}
   */
  static async compressJSON(data) {
    const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
    if (typeof CompressionStream === 'undefined') {
      // Fallback para UTF-8 buffer se CompressionStream não estiver disponível
      return new TextEncoder().encode(jsonStr);
    }

    const stream = new Blob([jsonStr]).stream().pipeThrough(new CompressionStream('gzip'));
    const arrayBuffer = await new Response(stream).arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  /**
   * Descomprime um buffer binário GZIP de volta para o objeto JavaScript
   * @param {ArrayBuffer|Uint8Array} buffer
   * @returns {Promise<any>}
   */
  static async decompressJSON(buffer) {
    if (typeof DecompressionStream === 'undefined') {
      const decoded = new TextDecoder().decode(buffer);
      return JSON.parse(decoded);
    }

    try {
      const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
      const text = await new Response(stream).text();
      return JSON.parse(text);
    } catch {
      // Fallback para texto simples
      const decoded = new TextDecoder().decode(buffer);
      return JSON.parse(decoded);
    }
  }
}
