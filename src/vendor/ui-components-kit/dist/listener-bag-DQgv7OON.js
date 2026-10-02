var a = Object.defineProperty;
var c = (n, e, s) => e in n ? a(n, e, { enumerable: !0, configurable: !0, writable: !0, value: s }) : n[e] = s;
var h = (n, e, s) => c(n, typeof e != "symbol" ? e + "" : e, s);
class d {
  constructor() {
    h(this, "entries", []);
  }
  /**
   * Adiciona um ouvinte de evento e rastreia sua referência para limpeza futura.
   * Suporta handlers tipados (MouseEvent, KeyboardEvent, CustomEvent, etc.).
   */
  add(e, s, r, i) {
    if (!e) return;
    const t = r;
    e.addEventListener(s, t, i), this.entries.push({ target: e, type: s, listener: t, options: i });
  }
  /**
   * Remove todos os ouvintes de eventos atualmente registrados e esvazia a coleção.
   */
  cleanup() {
    this.entries.forEach(({ target: e, type: s, listener: r, options: i }) => {
      e.removeEventListener(s, r, i);
    }), this.entries = [];
  }
  /**
   * Retorna a quantidade de ouvintes ativos rastreados.
   */
  get size() {
    return this.entries.length;
  }
}
export {
  d as L
};
