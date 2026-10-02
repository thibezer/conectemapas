var b = Object.defineProperty;
var h = (l, n, t) => n in l ? b(l, n, { enumerable: !0, configurable: !0, writable: !0, value: t }) : l[n] = t;
var s = (l, n, t) => h(l, typeof n != "symbol" ? n + "" : n, t);
import { L as m } from "./listener-bag-DQgv7OON.js";
import { d, S as g } from "./ssr-safe-5cWfJP-s.js";
const f = ':host{display:inline-block;width:100%;box-sizing:border-box}:host([inline]){width:auto;height:auto}.ui-botao-primario{display:inline-flex;align-items:center;justify-content:center;gap:var(--ui-espaco-sm, 6px);width:100%;height:var(--ui-campo-altura, 100%);min-height:var(--ui-campo-altura, var(--ui-altura-minima, 15px));box-sizing:border-box;padding:0 12px;border:1px solid transparent;border-radius:var(--ui-raio-borda, 6px);font-family:var(--ui-fonte-base, "Inter", sans-serif);font-size:clamp(11px,.85rem,13px);font-weight:600;line-height:1;transition:background-color .15s cubic-bezier(.16,1,.3,1),border-color .15s cubic-bezier(.16,1,.3,1),color .15s cubic-bezier(.16,1,.3,1),filter .15s cubic-bezier(.16,1,.3,1),transform .12s cubic-bezier(.34,1.56,.64,1),box-shadow .15s ease;text-align:center;-webkit-user-select:none;user-select:none;touch-action:manipulation;-webkit-tap-highlight-color:transparent}.ui-botao-primario:focus-visible{outline:none;box-shadow:0 0 0 2px var(--ui-cor-fundo, #0b0b0d),0 0 0 4px var(--ui-cor-primaria, #00E08A)}.ui-botao-primario--has-icon-start{padding-left:8px!important;padding-right:12px!important}.ui-botao-primario--has-icon-end{padding-left:12px!important;padding-right:8px!important}::slotted(svg),::slotted(ui-icone){display:inline-flex!important;align-items:center!important;justify-content:center!important;vertical-align:middle!important;flex-shrink:0!important;line-height:1!important;width:14px!important;height:14px!important;box-sizing:content-box;shape-rendering:geometricPrecision}::slotted(span),::slotted(label),::slotted(p){display:inline-flex;align-items:center;line-height:1}::slotted(div){display:inline-flex;align-items:center;justify-content:center;line-height:1;height:100%}.ui-botao-primario,.ui-botao-primario--primary,.ui-botao-primario--primario{background:var(--ui-cor-primaria, #00E08A);color:var(--ui-cor-texto-sobre-primaria, #000000);border-color:transparent}.ui-botao-primario--primary:hover:not(:disabled),.ui-botao-primario--primario:hover:not(:disabled),.ui-botao-primario:hover:not(:disabled){filter:brightness(1.1)}.ui-botao-primario--destaque{background:var(--ui-cor-destaque, var(--ui-cor-primaria, #00E08A));color:var(--ui-cor-texto-sobre-primaria, #000000)}.ui-botao-primario--secondary,.ui-botao-primario--secundario{background:var(--ui-cor-botao-secundario-fundo, #1e1e24);color:var(--ui-cor-texto, #e1e1e6);border-color:var(--ui-cor-borda, rgba(255, 255, 255, .12))}.ui-botao-primario--secondary:hover:not(:disabled),.ui-botao-primario--secundario:hover:not(:disabled){background:var(--ui-cor-botao-secundario-hover, #2a2a34);border-color:#ffffff3d}.ui-botao-primario--ghost,.ui-botao-primario--terciario{background:transparent;color:var(--ui-cor-texto, #e1e1e6);border-color:transparent}.ui-botao-primario--ghost:hover:not(:disabled),.ui-botao-primario--terciario:hover:not(:disabled){background:var(--ui-cor-hover-menu, rgba(255, 255, 255, .08))}.ui-botao-primario--destructive,.ui-botao-primario--destrutivo,.ui-botao-primario--erro{background:var(--ui-cor-botao-destrutivo-fundo, #ff4444);color:var(--ui-cor-botao-destrutivo-texto, #ffffff);border-color:transparent}.ui-botao-primario--destructive:hover:not(:disabled),.ui-botao-primario--destrutivo:hover:not(:disabled),.ui-botao-primario--erro:hover:not(:disabled){background:var(--ui-cor-botao-destrutivo-hover, #e03333)}.ui-botao-primario--outline,.ui-botao-primario--borda{background:transparent;color:var(--ui-cor-primaria, #00E08A);border-color:var(--ui-cor-primaria, #00E08A)}.ui-botao-primario--outline:hover:not(:disabled),.ui-botao-primario--borda:hover:not(:disabled){background:#00e08a1f;border-color:var(--ui-cor-primaria, #00E08A);filter:brightness(1.08)}.ui-botao-primario--icon-only,.ui-botao-primario--icone{padding:0;width:var(--ui-campo-altura, var(--ui-altura-minima, 15px));min-width:var(--ui-campo-altura, var(--ui-altura-minima, 15px));height:var(--ui-campo-altura, var(--ui-altura-minima, 15px));aspect-ratio:1;border-radius:var(--ui-raio-borda, 6px)}.ui-botao-primario--hover{filter:brightness(1.15)!important}.ui-botao-primario:active:not(:disabled),.ui-botao-primario--active{transform:scale(.97)!important;filter:brightness(.9)!important}.ui-botao-primario:disabled,.ui-botao-primario--disabled{opacity:.45;cursor:not-allowed;transform:none!important;filter:none!important}.ui-botao-primario--carregando,.ui-botao-primario--loading{cursor:wait;opacity:.85;pointer-events:none}.ui-botao-primario__spinner{width:14px;height:14px;animation:ui-spin .75s linear infinite;flex-shrink:0;shape-rendering:geometricPrecision}@keyframes ui-spin{0%{transform:rotate(0)}to{transform:rotate(360deg)}}@media (max-width: 640px){:host(:not([inline])) .ui-botao-primario{min-height:max(var(--ui-campo-altura, 38px),38px);font-size:14px;padding:0 14px}}';
class p extends g {
  constructor() {
    super();
    s(this, "button");
    s(this, "spinnerContainer");
    s(this, "slotElement");
    s(this, "opticalState", null);
    s(this, "listeners", new m());
    s(this, "handleSlotChange", () => {
      this.sanitizeAndBalanceContent(), this.syncState();
    });
    s(this, "handleClick", (t) => {
      if (this.hasAttribute("disabled") || this.carregando) {
        t.preventDefault(), t.stopPropagation();
        return;
      }
      this.dispatchEvent(new CustomEvent("ui-click", { detail: { originalEvent: t }, bubbles: !0, composed: !0 }));
      const o = this.closest("form");
      if (o) {
        if (this.hasAttribute("tipo-reset") || this.getAttribute("type") === "reset")
          o.reset();
        else if (this.hasAttribute("tipo-submit") || this.getAttribute("type") === "submit")
          try {
            o.requestSubmit(this.button);
          } catch {
            o.requestSubmit();
          }
      }
    });
    const t = this.attachShadow({ mode: "open" });
    t.innerHTML = `
      <style>${f}</style>
      <button class="ui-botao-primario" type="button">
        <span class="ui-botao-primario__spinner-container" style="display: none;">
          <svg class="ui-botao-primario__spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
            <path d="M12 2 a 10 10 0 0 1 10 10"></path>
          </svg>
        </span>
        <slot></slot>
      </button>
    `, this.button = t.querySelector("button"), this.spinnerContainer = t.querySelector(".ui-botao-primario__spinner-container"), this.slotElement = t.querySelector("slot");
  }
  static get observedAttributes() {
    return ["disabled", "variante", "carregando", "loading", "estado", "tamanho", "size", "altura", "height", "densidade"];
  }
  connectedCallback() {
    this.listeners.cleanup(), this.listeners.add(this.button, "click", this.handleClick), this.listeners.add(this.slotElement, "slotchange", this.handleSlotChange), this.sanitizeAndBalanceContent(), this.syncState();
  }
  disconnectedCallback() {
    this.listeners.cleanup();
  }
  attributeChangedCallback(t, o, a) {
    this.syncState();
  }
  get carregando() {
    return this.hasAttribute("carregando") || this.hasAttribute("loading");
  }
  set carregando(t) {
    t ? this.setAttribute("carregando", "") : (this.removeAttribute("carregando"), this.removeAttribute("loading"));
  }
  /**
   * Remove espaços e quebras de linha fantasmas no slot e identifica
   * se há ícone no início ou fim para aplicar compensação óptica de padding.
   */
  sanitizeAndBalanceContent() {
    const t = (e) => {
      if (e.nodeType !== Node.ELEMENT_NODE) return !1;
      const i = e, r = i.tagName.toLowerCase();
      if (r === "ui-icone" || r === "svg" || r === "i" || i.hasAttribute("data-icon") || i.classList.contains("icon") || i.classList.contains("icone")) return !0;
      const c = typeof i.className == "string" ? i.className : "";
      return !!/\b(fa[srlb]?|fa-[\w-]+|lucide|tabler)\b/i.test(c);
    }, o = this.slotElement ? this.slotElement.assignedNodes() : Array.from(this.childNodes), a = [];
    for (let e = 0; e < o.length; e++) {
      const i = o[e];
      if (i.nodeType === Node.TEXT_NODE) {
        const r = i.textContent || "";
        if (!r.trim())
          o.length > 1 && (i.textContent = "");
        else {
          const c = o[e - 1];
          c && t(c) && (i.textContent = r.replace(/^\s+/, ""));
          const u = o[e + 1];
          u && t(u) && (i.textContent = (i.textContent || "").replace(/\s+$/, "")), (i.textContent || "").trim().length > 0 && a.push(i);
        }
      } else i.nodeType === Node.ELEMENT_NODE && a.push(i);
    }
    if (a.length >= 2)
      t(a[0]) ? this.opticalState = "icon-start" : t(a[a.length - 1]) ? this.opticalState = "icon-end" : this.opticalState = null;
    else if (a.length === 1) {
      const e = a[0];
      if (t(e))
        this.opticalState = "icon-only";
      else if (e.nodeType === Node.ELEMENT_NODE) {
        const i = e;
        i.children.length >= 2 ? t(i.firstElementChild) ? this.opticalState = "icon-start" : t(i.lastElementChild) ? this.opticalState = "icon-end" : this.opticalState = null : i.children.length === 1 && t(i.firstElementChild) ? this.opticalState = "icon-only" : this.opticalState = null;
      } else
        this.opticalState = null;
    } else
      this.opticalState = null;
  }
  syncState() {
    const t = this.getAttribute("altura") || this.getAttribute("height");
    t ? this.style.setProperty("--ui-campo-altura", isNaN(Number(t)) ? t : `${t}px`) : this.style.removeProperty("--ui-campo-altura");
    const o = this.carregando, a = this.hasAttribute("disabled") || o, e = this.getAttribute("variante") || "primario", i = this.getAttribute("estado");
    this.button.disabled = a, this.spinnerContainer.style.display = o ? "inline-flex" : "none";
    const r = ["ui-botao-primario", `ui-botao-primario--${e}`];
    a && !o && r.push("ui-botao-primario--disabled"), o && r.push("ui-botao-primario--carregando"), i && r.push(`ui-botao-primario--${i}`), this.opticalState === "icon-start" ? r.push("ui-botao-primario--has-icon-start") : this.opticalState === "icon-end" && r.push("ui-botao-primario--has-icon-end"), (this.opticalState === "icon-only" || e === "icon-only" || e === "icone") && r.push("ui-botao-primario--icon-only"), this.button.className = r.join(" ");
  }
}
class v extends p {
}
d("ui-botao", p);
d("ui-botao-primario", v);
export {
  p as U,
  v as a
};
