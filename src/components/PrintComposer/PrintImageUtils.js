/* ==========================================================================
   ConecteMapas - PrintImageUtils
   Responsabilidade Única: Preparar imagens/logotipos da prancha para gravação.
   A prancha vive no localStorage (cota de ~5 MB por site): a imagem é reduzida
   ao tamanho útil de impressão antes de virar data URL.
   ========================================================================== */

export class PrintImageUtils {
  /** Maior lado em px: um logotipo de 80 mm a 300 DPI tem ~950 px */
  static MAX_PX = 1200;
  /** Acima disso (em caracteres da data URL) o PNG é trocado por JPEG */
  static MAX_DATA_URL_CHARS = 500 * 1024;
  /** Arquivo maior que isso é recusado antes de ser lido */
  static MAX_FILE_BYTES = 20 * 1024 * 1024;
  /** SVG pequeno é mantido como vetor (nítido em qualquer DPI) */
  static MAX_SVG_CHARS = 200 * 1024;

  /** Dimensões que cabem em `max` px mantendo a proporção (nunca amplia) */
  static fitWithin(width, height, max = PrintImageUtils.MAX_PX) {
    if (!(width > 0) || !(height > 0)) return { width: 0, height: 0 };
    const k = Math.min(1, max / Math.max(width, height));
    return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
  }

  static readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('Falha ao ler a imagem'));
      reader.readAsDataURL(file);
    });
  }

  static loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Formato de imagem não suportado'));
      img.src = src;
    });
  }

  /**
   * Lê o arquivo e devolve uma data URL reduzida para a prancha.
   * Retorna { dataUrl, width, height, resized }.
   */
  static async prepareImageFile(file) {
    if (!file) throw new Error('Nenhum arquivo selecionado');
    if (file.size > PrintImageUtils.MAX_FILE_BYTES) {
      throw new Error(`Imagem muito grande (${(file.size / 1048576).toFixed(1)} MB). O limite é ${PrintImageUtils.MAX_FILE_BYTES / 1048576} MB.`);
    }

    const original = await PrintImageUtils.readAsDataURL(file);
    const img = await PrintImageUtils.loadImage(original);
    const natW = img.naturalWidth || img.width;
    const natH = img.naturalHeight || img.height;

    if (file.type === 'image/svg+xml' && original.length <= PrintImageUtils.MAX_SVG_CHARS) {
      return { dataUrl: original, width: natW, height: natH, resized: false };
    }

    const { width, height } = PrintImageUtils.fitWithin(natW, natH);
    if (width === natW && height === natH && original.length <= PrintImageUtils.MAX_DATA_URL_CHARS && file.type !== 'image/svg+xml') {
      return { dataUrl: original, width, height, resized: false };
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);
    let dataUrl = canvas.toDataURL('image/png');

    if (dataUrl.length > PrintImageUtils.MAX_DATA_URL_CHARS) {
      // Foto/imagem complexa: JPEG sobre fundo branco (a folha é branca)
      const flat = document.createElement('canvas');
      flat.width = width;
      flat.height = height;
      const fctx = flat.getContext('2d');
      fctx.fillStyle = '#ffffff';
      fctx.fillRect(0, 0, width, height);
      fctx.drawImage(canvas, 0, 0);
      dataUrl = flat.toDataURL('image/jpeg', 0.88);
    }
    return { dataUrl, width, height, resized: true };
  }
}
