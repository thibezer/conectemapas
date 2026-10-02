var g = Object.defineProperty;
var h = (a, o, e) => o in a ? g(a, o, { enumerable: !0, configurable: !0, writable: !0, value: e }) : a[o] = e;
var t = (a, o, e) => h(a, typeof o != "symbol" ? o + "" : o, e);
import { d as s, S as u } from "./ssr-safe-5cWfJP-s.js";
import { L as p } from "./listener-bag-DQgv7OON.js";
const m = ':host{display:block;box-sizing:border-box;font-family:var(--ui-fonte-base, "Inter", sans-serif)}.ui-stat{padding:18px 20px;border-radius:var(--ui-raio-borda, 10px);border:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .12));background-color:var(--ui-cor-fundo-card, #18181c);color:var(--ui-cor-texto, #e1e1e6);box-sizing:border-box;display:flex;flex-direction:column;position:relative;transition:border-color .15s ease,box-shadow .15s ease}:root[data-tema=claro] .ui-stat,[data-tema=claro] .ui-stat{background-color:#fff;border-color:#00000017;color:#1a1a1e;box-shadow:0 1px 3px #0000000a}.ui-stat--baixa{box-shadow:0 2px 6px #0000004d}.ui-stat--media{box-shadow:0 4px 14px #0006}.ui-stat--alta{box-shadow:0 8px 24px #00000080}.ui-stat__cabecalho{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;gap:8px}.ui-stat__rotulo{font-size:13px;font-weight:500;color:var(--ui-cor-texto-secundario, #888899);letter-spacing:.01em}:root[data-tema=claro] .ui-stat__rotulo,[data-tema=claro] .ui-stat__rotulo{color:#6c757d}.ui-stat__icone-slot{display:flex;align-items:center;color:var(--ui-cor-texto-secundario, #888899)}.ui-stat__icone-slot svg,.ui-stat__icone-slot ::slotted(svg),.ui-stat__icone-slot ::slotted(ui-icone){shape-rendering:geometricPrecision}.ui-stat__conteudo{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:6px}.ui-stat__valor{font-size:28px;font-weight:700;color:var(--ui-cor-texto, #ffffff);line-height:1.15;letter-spacing:-.025em}:root[data-tema=claro] .ui-stat__valor,[data-tema=claro] .ui-stat__valor{color:#111114}.ui-stat__indicador{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:5px;font-size:12px;font-weight:600;line-height:1}.ui-stat__indicador--positivo,.ui-stat__indicador--alta{background-color:#00e08a24;color:var(--ui-cor-primaria, #00E08A)}.ui-stat__indicador--negativo,.ui-stat__indicador--baixa{background-color:#ff444424;color:var(--ui-cor-texto-erro, #ff5555)}.ui-stat__indicador--neutro{background-color:#ffffff14;color:var(--ui-cor-texto-secundario, #888899)}:root[data-tema=claro] .ui-stat__indicador--neutro,[data-tema=claro] .ui-stat__indicador--neutro{background-color:#f1f3f5;color:#495057}.ui-stat__seta{font-size:.85em;line-height:1}.ui-stat__rodape{display:flex;flex-direction:column;gap:6px}.ui-stat__descricao{font-size:12px;color:var(--ui-cor-texto-secundario, #888899);line-height:1.3}:root[data-tema=claro] .ui-stat__descricao,[data-tema=claro] .ui-stat__descricao{color:#6c757d}';
class n extends u {
  constructor() {
    super();
    t(this, "statElement");
    t(this, "rotuloElement");
    t(this, "valorElement");
    t(this, "indicadorElement");
    t(this, "setaElement");
    t(this, "variacaoElement");
    t(this, "descricaoElement");
    const e = this.attachShadow({ mode: "open" });
    e.innerHTML = `
      <style>${m}</style>
      <div class="ui-stat">
        <div class="ui-stat__cabecalho">
          <span class="ui-stat__rotulo"></span>
          <div class="ui-stat__icone-slot"><slot name="icone"></slot></div>
        </div>
        <div class="ui-stat__conteudo">
          <div class="ui-stat__valor"></div>
          <div class="ui-stat__indicador" style="display: none;">
            <span class="ui-stat__seta" aria-hidden="true"></span>
            <span class="ui-stat__variacao"></span>
          </div>
        </div>
        <div class="ui-stat__rodape">
          <span class="ui-stat__descricao" style="display: none;"></span>
          <slot name="grafico"></slot>
          <slot></slot>
        </div>
      </div>
    `, this.statElement = e.querySelector(".ui-stat"), this.rotuloElement = e.querySelector(".ui-stat__rotulo"), this.valorElement = e.querySelector(".ui-stat__valor"), this.indicadorElement = e.querySelector(".ui-stat__indicador"), this.setaElement = e.querySelector(".ui-stat__seta"), this.variacaoElement = e.querySelector(".ui-stat__variacao"), this.descricaoElement = e.querySelector(".ui-stat__descricao");
  }
  static get observedAttributes() {
    return [
      "rotulo",
      "label",
      "valor",
      "value",
      "variacao",
      "trend",
      "tendencia",
      "direction",
      "descricao",
      "description",
      "elevacao",
      "elevation"
    ];
  }
  connectedCallback() {
    this.syncState();
  }
  attributeChangedCallback(e, r, i) {
    this.syncState();
  }
  get rotulo() {
    return this.getAttribute("rotulo") || this.getAttribute("label") || "";
  }
  set rotulo(e) {
    this.setAttribute("rotulo", e);
  }
  get valor() {
    return this.getAttribute("valor") || this.getAttribute("value") || "";
  }
  set valor(e) {
    this.setAttribute("valor", e);
  }
  get variacao() {
    return this.getAttribute("variacao") || this.getAttribute("trend") || "";
  }
  set variacao(e) {
    this.setAttribute("variacao", e);
  }
  get tendencia() {
    const e = (this.getAttribute("tendencia") || this.getAttribute("direction") || "positivo").toLowerCase();
    return e === "baixa" || e === "negativo" || e === "down" ? "baixa" : e === "neutro" || e === "neutral" ? "neutro" : "alta";
  }
  set tendencia(e) {
    this.setAttribute("tendencia", e);
  }
  get descricao() {
    return this.getAttribute("descricao") || this.getAttribute("description") || "";
  }
  set descricao(e) {
    this.setAttribute("descricao", e);
  }
  syncState() {
    const e = this.rotulo, r = this.valor, i = this.variacao, l = this.tendencia, d = this.descricao, b = this.getAttribute("elevacao") || this.getAttribute("elevation") || "baixa";
    this.statElement.className = `ui-stat ui-stat--${b}`, this.rotuloElement.textContent = e, this.valorElement.textContent = r, i ? (this.variacaoElement.textContent = i, this.indicadorElement.style.display = "inline-flex", l === "baixa" ? (this.indicadorElement.className = "ui-stat__indicador ui-stat__indicador--negativo", this.setaElement.textContent = "↓", this.indicadorElement.setAttribute("aria-label", `Queda de ${i}`)) : l === "neutro" ? (this.indicadorElement.className = "ui-stat__indicador ui-stat__indicador--neutro", this.setaElement.textContent = "→", this.indicadorElement.setAttribute("aria-label", `Variação estável de ${i}`)) : (this.indicadorElement.className = "ui-stat__indicador ui-stat__indicador--positivo", this.setaElement.textContent = "↑", this.indicadorElement.setAttribute("aria-label", `Aumento de ${i}`))) : this.indicadorElement.style.display = "none", d ? (this.descricaoElement.textContent = d, this.descricaoElement.style.display = "block") : this.descricaoElement.style.display = "none";
  }
}
class v extends n {
}
class f extends n {
}
s("ui-stat", n);
s("ui-kpi", v);
s("ui-metrica", f);
const x = ':host{display:inline-flex;align-items:center;box-sizing:border-box;font-family:var(--ui-fonte-base, "Inter", sans-serif);vertical-align:middle}.ui-badge{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:600;line-height:1;-webkit-user-select:none;user-select:none;box-sizing:border-box;transition:background-color .15s ease,color .15s ease,border-color .15s ease;white-space:nowrap}::slotted(svg),::slotted(ui-icone){width:12px!important;height:12px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;line-height:1!important;vertical-align:middle!important;shape-rendering:geometricPrecision;flex-shrink:0}::slotted(span){display:inline-flex;align-items:center;line-height:1}.ui-badge--suave{background-color:var(--ui-cor-badge-fundo, rgba(255, 255, 255, .08));color:var(--ui-cor-badge-texto, #e1e1e6);border:1px solid transparent}.ui-badge--solido{background-color:var(--ui-cor-badge-solido, #888899);color:#000;border:1px solid transparent}.ui-badge--contornado{background-color:transparent;color:var(--ui-cor-badge-texto, #e1e1e6);border:1px solid var(--ui-cor-badge-borda, rgba(255, 255, 255, .2))}.ui-badge--sucesso.ui-badge--suave{background-color:#00e08a26;color:var(--ui-cor-primaria, #00E08A)}.ui-badge--sucesso.ui-badge--solido{background-color:var(--ui-cor-primaria, #00E08A);color:#000}.ui-badge--sucesso.ui-badge--contornado{color:var(--ui-cor-primaria, #00E08A);border-color:#00e08a66}.ui-badge--erro.ui-badge--suave{background-color:#ff555526;color:var(--ui-cor-texto-erro, #ff5555)}.ui-badge--erro.ui-badge--solido{background-color:var(--ui-cor-texto-erro, #ff5555);color:#fff}.ui-badge--erro.ui-badge--contornado{color:var(--ui-cor-texto-erro, #ff5555);border-color:#f556}.ui-badge--alerta.ui-badge--suave{background-color:#ffb86c26;color:var(--ui-cor-texto-alerta, #ffb86c)}.ui-badge--alerta.ui-badge--solido{background-color:var(--ui-cor-texto-alerta, #ffb86c);color:#000}.ui-badge--alerta.ui-badge--contornado{color:var(--ui-cor-texto-alerta, #ffb86c);border-color:#ffb86c66}.ui-badge--info.ui-badge--suave,.ui-badge--primaria.ui-badge--suave{background-color:#00aaff26;color:#0af}.ui-badge--info.ui-badge--solido,.ui-badge--primaria.ui-badge--solido{background-color:#0af;color:#fff}.ui-badge--info.ui-badge--contornado,.ui-badge--primaria.ui-badge--contornado{color:#0af;border-color:#0af6}.ui-badge--neutro.ui-badge--suave{background-color:#ffffff14;color:var(--ui-cor-texto-secundario, #888899)}.ui-badge__close{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border-radius:50%;cursor:pointer;opacity:.7;transition:opacity .15s ease,background-color .15s ease;font-size:10px;line-height:1;margin-left:2px}.ui-badge__close:hover{opacity:1;background-color:#fff3}';
class c extends u {
  constructor() {
    super();
    t(this, "badgeElement");
    t(this, "labelElement");
    t(this, "closeElement");
    t(this, "listeners", new p());
    t(this, "handleRemove", (e) => {
      var r;
      e.stopPropagation(), this.dispatchEvent(
        new CustomEvent("ui-remove", {
          detail: {
            value: this.getAttribute("value") || ((r = this.textContent) == null ? void 0 : r.trim()) || ""
          },
          bubbles: !0,
          composed: !0
        })
      );
    });
    const e = this.attachShadow({ mode: "open" });
    e.innerHTML = `
      <style>${x}</style>
      <span class="ui-badge">
        <slot></slot>
        <span class="ui-badge__label" style="display: none;"></span>
        <span class="ui-badge__close" role="button" tabindex="0" aria-label="Remover" style="display: none;" title="Remover">✕</span>
      </span>
    `, this.badgeElement = e.querySelector(".ui-badge"), this.labelElement = e.querySelector(".ui-badge__label"), this.closeElement = e.querySelector(".ui-badge__close");
  }
  static get observedAttributes() {
    return [
      "variante",
      "variant",
      "estilo",
      "removivel",
      "removable",
      "disabled",
      "label",
      "value"
    ];
  }
  connectedCallback() {
    this.listeners.cleanup(), this.listeners.add(this.closeElement, "click", this.handleRemove), this.listeners.add(this.closeElement, "keydown", (e) => {
      (e.key === "Enter" || e.key === " ") && (e.preventDefault(), this.handleRemove(e));
    }), this.syncState();
  }
  disconnectedCallback() {
    this.listeners.cleanup();
  }
  attributeChangedCallback(e, r, i) {
    this.syncState();
  }
  get removivel() {
    return this.hasAttribute("removivel") || this.hasAttribute("removable");
  }
  set removivel(e) {
    e ? this.setAttribute("removivel", "") : (this.removeAttribute("removivel"), this.removeAttribute("removable"));
  }
  syncState() {
    const e = this.getAttribute("variante") || this.getAttribute("variant") || "neutro", r = this.getAttribute("estilo") || "suave", i = this.getAttribute("label"), l = this.removivel;
    this.badgeElement.className = "ui-badge", this.badgeElement.classList.add(`ui-badge--${e}`), this.badgeElement.classList.add(`ui-badge--${r}`), i ? (this.labelElement.textContent = i, this.labelElement.style.display = "inline") : this.labelElement.style.display = "none", l ? this.closeElement.style.display = "inline-flex" : this.closeElement.style.display = "none";
  }
}
class _ extends c {
}
class y extends c {
}
s("ui-badge", c);
s("ui-chip", _);
s("ui-tag", y);
export {
  c as U,
  _ as a,
  v as b,
  f as c,
  n as d,
  y as e
};
