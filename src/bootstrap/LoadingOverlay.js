/* ==========================================================================
   ConecteMapas - LoadingOverlay
   Aviso de carregamento sobre o mapa: o markup (#cm-loading) está no index.html
   e aparece sozinho por CSS após um pequeno atraso (projetos pequenos não piscam),
   mesmo que a thread principal esteja ocupada desenhando.
   ========================================================================== */

/** A partir deste número de feições o desenho já é demorado o bastante para avisar. */
export const LARGE_PROJECT_FEATURES = 500;

const FADE_MS = 250;

export class LoadingOverlay {
  /** Texto "N formas" com separador de milhar pt-BR (singular para 1). */
  static formatCount(n) {
    const count = Math.max(0, Math.floor(Number(n) || 0));
    return `${count.toLocaleString('pt-BR')} ${count === 1 ? 'forma' : 'formas'}`;
  }

  static isLarge(n) {
    return Number(n) >= LARGE_PROJECT_FEATURES;
  }

  /** Atualiza título e detalhe. Sem o elemento (testes/Node ou já removido) não faz nada. */
  static update(title, detail) {
    if (typeof document === 'undefined') return;
    const root = document.getElementById('cm-loading');
    if (!root || root.dataset.done === '1') return;
    const titleEl = document.getElementById('cm-loading-title');
    const detailEl = document.getElementById('cm-loading-detail');
    if (titleEl && title != null && titleEl.textContent !== title) titleEl.textContent = title;
    if (detailEl && detail != null && detailEl.textContent !== detail) detailEl.textContent = detail;
  }

  /** Mensagem de desenho; só para projetos grandes (devolve true se avisou). */
  static announceDrawing(featureCount) {
    if (!this.isLarge(featureCount)) return false;
    this.update(
      `Desenhando ${this.formatCount(featureCount)} no mapa…`,
      'Projetos com muitas formas levam alguns segundos. O mapa não travou, aguarde.'
    );
    return true;
  }

  /**
   * Deixa o navegador pintar a mensagem antes de um trabalho síncrono pesado.
   * Nunca fica pendente: em aba oculta o requestAnimationFrame não dispara, então há um limite de tempo.
   */
  static nextPaint(timeoutMs = 120) {
    return new Promise((resolve) => {
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        resolve();
      };
      setTimeout(done, timeoutMs);
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => setTimeout(done, 0));
      }
    });
  }

  /** Esconde com fade e remove do DOM. Pode ser chamado várias vezes. */
  static hide() {
    if (typeof document === 'undefined') return;
    const root = document.getElementById('cm-loading');
    if (!root || root.dataset.done === '1') return;
    root.dataset.done = '1';
    root.classList.add('is-done');
    setTimeout(() => root.remove(), FADE_MS + 50);
  }

  /** Esconde depois que o navegador pintou o mapa já desenhado. */
  static async hideAfterPaint() {
    await this.nextPaint();
    this.hide();
  }
}
