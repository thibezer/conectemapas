var y = Object.defineProperty;
var _ = (i, t, e) => t in i ? y(i, t, { enumerable: !0, configurable: !0, writable: !0, value: e }) : i[t] = e;
var o = (i, t, e) => _(i, typeof t != "symbol" ? t + "" : t, e);
import { L as w } from "./listener-bag-DQgv7OON.js";
import { d as E, S as k } from "./ssr-safe-5cWfJP-s.js";
const A = ':host{display:block;width:100%;box-sizing:border-box}:host(.h-full),:host([style*="height: 100%"]){height:100%}.ui-card{display:flex;flex-direction:column;width:100%;height:100%;box-sizing:border-box;background-color:var(--ui-cor-fundo-card, #18181c);border:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .12));border-radius:var(--ui-raio-borda, 8px);overflow:hidden;transition:transform .2s cubic-bezier(.4,0,.2,1),box-shadow .2s cubic-bezier(.4,0,.2,1),border-color .2s ease;color:var(--ui-cor-texto, #e1e1e6);font-family:var(--ui-fonte-base, "Inter", sans-serif)}.ui-card--plano{background-color:var(--ui-cor-fundo-card, #18181c);box-shadow:none}.ui-card--elevado{background-color:var(--ui-cor-fundo-elevado, #1e1e24);box-shadow:0 8px 24px #0006;border-color:#ffffff14}.ui-card--destaque{border-color:var(--ui-cor-primaria, #00E08A);background-color:var(--ui-cor-fundo-card, #18181c);box-shadow:0 0 0 1px #00e08a40}.ui-card--clicavel{cursor:pointer;-webkit-user-select:none;user-select:none}.ui-card--clicavel:hover{transform:translateY(-3px);border-color:var(--ui-cor-primaria, #00E08A);box-shadow:0 10px 30px #00000080,0 0 15px #00e08a26}.ui-card--clicavel:active{transform:translateY(-1px)}.ui-card--disabled{opacity:.5;cursor:not-allowed!important;pointer-events:none}.ui-card__media{width:100%;overflow:hidden;display:block;line-height:0}::slotted([slot="midia"]),::slotted([slot="media"]){width:100%;height:auto;display:block;object-fit:cover}.ui-card__header{padding:14px 16px 8px;display:flex;align-items:center;justify-content:space-between;gap:12px;box-sizing:border-box}.ui-card__body{padding:12px 16px;flex:1;box-sizing:border-box}.ui-card__footer{padding:10px 16px 14px;border-top:1px solid rgba(255,255,255,.06);display:flex;align-items:center;justify-content:space-between;gap:12px;box-sizing:border-box}.ui-card--compacto .ui-card__header{padding:10px 12px 6px}.ui-card--compacto .ui-card__body{padding:8px 12px}.ui-card--compacto .ui-card__footer{padding:8px 12px 10px}';
class S extends k {
  constructor() {
    super();
    o(this, "cardElement");
    o(this, "listeners", new w());
    o(this, "handleSlotChange", () => {
      this.syncState();
    });
    o(this, "handleClick", (e) => {
      this.disabled || e && e.target && e.target instanceof HTMLElement && e.target.closest('button, a, input, select, textarea, ui-botao, ui-switch, ui-checkbox, ui-radio, [role="button"]') || this.clicavel && (this.dispatchEvent(
        new CustomEvent("ui-click", {
          detail: {
            id: this.id || "sem-id"
          },
          bubbles: !0,
          composed: !0
        })
      ), this.dispatchEvent(
        new CustomEvent("ui-clique", {
          detail: {
            id: this.id || "sem-id"
          },
          bubbles: !0,
          composed: !0
        })
      ));
    });
    o(this, "handleKeyDown", (e) => {
      !this.clicavel || this.disabled || (e.key === "Enter" || e.key === " ") && (e.preventDefault(), this.handleClick());
    });
    const e = this.attachShadow({ mode: "open" });
    e.innerHTML = `
      <style>${A}</style>
      <div class="ui-card">
        <div class="ui-card__media">
          <slot name="midia"></slot>
          <slot name="media"></slot>
        </div>
        <div class="ui-card__header">
          <slot name="cabecalho"></slot>
          <slot name="header"></slot>
        </div>
        <div class="ui-card__body">
          <slot></slot>
        </div>
        <div class="ui-card__footer">
          <slot name="rodape"></slot>
          <slot name="footer"></slot>
        </div>
      </div>
    `, this.cardElement = e.querySelector(".ui-card");
  }
  static get observedAttributes() {
    return [
      "elevacao",
      "elevation",
      "variante",
      "variant",
      "clicavel",
      "clickable",
      "compacto",
      "compact",
      "disabled"
    ];
  }
  connectedCallback() {
    var a;
    this.listeners.cleanup(), this.listeners.add(this.cardElement, "click", this.handleClick), this.listeners.add(this.cardElement, "keydown", this.handleKeyDown);
    const e = (a = this.shadowRoot) == null ? void 0 : a.querySelectorAll("slot");
    e == null || e.forEach((r) => this.listeners.add(r, "slotchange", this.handleSlotChange)), this.syncState();
  }
  disconnectedCallback() {
    this.listeners.cleanup();
  }
  attributeChangedCallback(e, a, r) {
    this.syncState();
  }
  get clicavel() {
    return this.hasAttribute("clicavel") || this.hasAttribute("clickable");
  }
  set clicavel(e) {
    e ? this.setAttribute("clicavel", "") : (this.removeAttribute("clicavel"), this.removeAttribute("clickable")), this.syncState();
  }
  get disabled() {
    return this.hasAttribute("disabled");
  }
  set disabled(e) {
    e ? this.setAttribute("disabled", "") : this.removeAttribute("disabled"), this.syncState();
  }
  syncState() {
    var h, b, p;
    const e = this.getAttribute("elevacao") || this.getAttribute("elevation") || "plano", a = this.getAttribute("variante") || this.getAttribute("variant"), r = this.clicavel, f = this.hasAttribute("compacto") || this.hasAttribute("compact"), x = this.disabled;
    this.cardElement.className = "ui-card", this.cardElement.classList.add(`ui-card--${e}`), a && this.cardElement.classList.add(`ui-card--${a}`), r ? (this.cardElement.classList.add("ui-card--clicavel"), this.cardElement.setAttribute("tabindex", "0")) : this.cardElement.removeAttribute("tabindex"), f && this.cardElement.classList.add("ui-card--compacto"), x && this.cardElement.classList.add("ui-card--disabled");
    const l = (h = this.shadowRoot) == null ? void 0 : h.querySelector(".ui-card__header"), n = (b = this.shadowRoot) == null ? void 0 : b.querySelector(".ui-card__footer"), u = (p = this.shadowRoot) == null ? void 0 : p.querySelector(".ui-card__media"), d = (m) => {
      var v;
      const g = m.map((s) => `slot[name="${s}"]`).join(", ");
      return Array.from(((v = this.shadowRoot) == null ? void 0 : v.querySelectorAll(g)) || []).some((s) => s.assignedNodes({ flatten: !0 }).some((c) => c.nodeType === Node.ELEMENT_NODE || c.textContent && c.textContent.trim() !== "")) || m.some((s) => this.querySelector(`[slot="${s}"]`) !== null);
    };
    u && (u.style.display = d(["midia", "media"]) ? "block" : "none"), l && (l.style.display = d(["cabecalho", "header"]) ? "flex" : "none"), n && (n.style.display = d(["rodape", "footer"]) ? "flex" : "none");
  }
}
E("ui-card", S);
export {
  S as U
};
