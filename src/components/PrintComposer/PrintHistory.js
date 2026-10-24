/* ==========================================================================
   ConecteMapas - PrintHistory
   Responsabilidade Única: Pilha de Desfazer/Refazer do Layout de Impressão.
   Cada entrada é o estado da prancha DEPOIS de uma ação (a primeira é a abertura):
   desfazer volta à entrada anterior e refazer avança para a seguinte.
   ========================================================================== */

export class PrintHistory {
  static LIMIT = 30;
  // Edições em rajada no mesmo campo (digitação, setas) viram um único passo
  static COALESCE_MS = 1000;

  constructor() {
    this.reset(null);
  }

  reset(state) {
    this.entries = state ? [{ ...state, coalesceKey: null, time: 0 }] : [];
    this.index = this.entries.length - 1;
  }

  /**
   * Registra o estado após uma ação. Com `coalesceKey`, substitui o passo anterior
   * se ele tiver a mesma chave e tiver sido registrado há menos de COALESCE_MS.
   */
  push(state, { coalesceKey = null, now = Date.now() } = {}) {
    if (this.index < this.entries.length - 1) {
      this.entries = this.entries.slice(0, this.index + 1);
    }

    const top = this.entries[this.index];
    if (coalesceKey && top && this.index > 0 && top.coalesceKey === coalesceKey && now - top.time < PrintHistory.COALESCE_MS) {
      this.entries[this.index] = { ...state, coalesceKey, time: now };
      return;
    }

    this.entries.push({ ...state, coalesceKey, time: now });
    if (this.entries.length > PrintHistory.LIMIT) this.entries.shift();
    this.index = this.entries.length - 1;
  }

  canUndo() { return this.index > 0; }
  canRedo() { return this.index < this.entries.length - 1; }

  /** Retorna o estado a restaurar e a ação desfeita, ou null */
  undo() {
    if (!this.canUndo()) return null;
    const undone = this.entries[this.index];
    this.index--;
    return { state: this.entries[this.index], action: undone.action };
  }

  /** Retorna o estado a restaurar e a ação refeita, ou null */
  redo() {
    if (!this.canRedo()) return null;
    this.index++;
    const state = this.entries[this.index];
    return { state, action: state.action };
  }
}
