/* ==========================================================================
   ConecteMapas - GeoWorker (Background Thread Parser)
   Responsabilidade Única: Processamento assíncrono de parsing e serialização
   de arquivos pesados (GeoJSON, JSON massivo) fora da thread principal.
   ========================================================================== */

self.onmessage = async (e) => {
  const { id, type, jsonString } = e.data;

  try {
    if (type === 'parse_json') {
      const parsed = JSON.parse(jsonString);
      self.postMessage({ id, success: true, data: parsed });
    } else {
      self.postMessage({ id, success: false, error: 'Operação não suportada' });
    }
  } catch (err) {
    self.postMessage({ id, success: false, error: err.message });
  }
};
