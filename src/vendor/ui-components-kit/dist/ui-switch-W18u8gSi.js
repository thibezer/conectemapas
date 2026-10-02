var v = Object.defineProperty;
var _ = (n, s, t) => s in n ? v(n, s, { enumerable: !0, configurable: !0, writable: !0, value: t }) : n[s] = t;
var i = (n, s, t) => _(n, typeof s != "symbol" ? s + "" : s, t);
import { L as d } from "./listener-bag-DQgv7OON.js";
import { d as c, S as u } from "./ssr-safe-5cWfJP-s.js";
class y {
  constructor(s, t, e) {
    i(this, "scrollHandler");
    i(this, "resizeHandler");
    i(this, "posicionar", () => {
      if (this.isMobileOrBottomSheet()) {
        this.content.style.top = "", this.content.style.left = "", this.content.style.minWidth = "";
        return;
      }
      const s = this.button.getBoundingClientRect();
      this.content.style.top = `${Math.round(s.bottom + 2)}px`, this.content.style.left = `${Math.round(s.left)}px`, this.content.style.minWidth = `${Math.round(Math.max(s.width, 120))}px`;
    });
    this.host = s, this.button = t, this.content = e;
  }
  isMobileOrBottomSheet() {
    return typeof window > "u" ? !1 : window.innerWidth <= 640 || this.host.hasAttribute("bottom-sheet") || this.host.hasAttribute("modo-mobile");
  }
  ativarAcompanhamento(s) {
    if (this.scrollHandler = s, this.resizeHandler = this.posicionar, window.addEventListener("scroll", this.scrollHandler, { capture: !0, passive: !0 }), window.addEventListener("resize", this.resizeHandler, { passive: !0 }), typeof this.content.showPopover == "function")
      try {
        this.content.showPopover();
      } catch {
      }
  }
  desativarAcompanhamento() {
    if (this.scrollHandler && (window.removeEventListener("scroll", this.scrollHandler, { capture: !0 }), this.scrollHandler = void 0), this.resizeHandler && (window.removeEventListener("resize", this.resizeHandler), this.resizeHandler = void 0), typeof this.content.hidePopover == "function")
      try {
        this.content.hidePopover();
      } catch {
      }
  }
}
class k {
  constructor(s) {
    i(this, "focusedIndex", -1);
    this.listElement = s;
  }
  focarPrimeiroItem() {
    const s = Array.from(this.listElement.querySelectorAll(".ui-lista-flutuante__item"));
    s.length > 0 && (this.focusedIndex = 0, s[0].focus());
  }
  resetarFoco() {
    this.focusedIndex = -1;
  }
  moverFoco(s) {
    const t = Array.from(this.listElement.querySelectorAll(".ui-lista-flutuante__item"));
    t.length !== 0 && (this.focusedIndex += s, this.focusedIndex < 0 && (this.focusedIndex = t.length - 1), this.focusedIndex >= t.length && (this.focusedIndex = 0), t[this.focusedIndex].focus());
  }
  tratarKeydownLista(s, t, e, a, r) {
    s.key === "ArrowDown" ? (s.preventDefault(), this.moverFoco(1)) : s.key === "ArrowUp" ? (s.preventDefault(), this.moverFoco(-1)) : s.key === "Enter" || s.key === " " ? (s.preventDefault(), this.focusedIndex >= 0 && this.focusedIndex < t.length && e(t[this.focusedIndex])) : s.key === "Escape" && (s.preventDefault(), a(), r.focus());
  }
}
const w = ':host{display:inline-block;position:relative;width:100%;box-sizing:border-box;font-family:var(--ui-fonte-base, "Inter", sans-serif)}:host([inline]){width:auto}.ui-lista-flutuante__container{display:flex;flex-direction:column;width:100%;position:relative}.ui-lista-flutuante__label{font-family:var(--ui-fonte-base, "Inter", sans-serif);font-size:var(--ui-tamanho-corpo-sm, 13px);font-weight:var(--ui-peso-medio, 500);color:var(--ui-cor-texto, #e1e1e6);margin-bottom:4px;-webkit-user-select:none;user-select:none;flex-shrink:0}.ui-lista-flutuante__gatilho{display:flex;align-items:center;justify-content:space-between;gap:6px;width:100%;height:var(--ui-campo-altura, 100%);min-height:var(--ui-campo-altura, var(--ui-altura-minima, 15px));padding:0 8px;background-color:var(--ui-cor-fundo-elevado, #1a1a1e);color:var(--ui-cor-texto, #e1e1e6);border:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .12));border-radius:var(--ui-raio-borda, 6px);font-family:var(--ui-fonte-base, "Inter", sans-serif);font-size:clamp(11px,.85rem,13px);line-height:1;cursor:pointer;box-sizing:border-box;touch-action:manipulation;-webkit-tap-highlight-color:transparent;transition:border-color .15s ease,background-color .15s ease}.ui-lista-flutuante__gatilho:hover:not(:disabled){border-color:var(--ui-cor-primaria, #00E08A)}.ui-lista-flutuante__gatilho:disabled{opacity:.5;cursor:not-allowed}.ui-lista-flutuante__texto{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;text-align:left}.ui-lista-flutuante__seta{font-size:10px;line-height:1;display:inline-flex;align-items:center;justify-content:center;transition:transform .2s ease;color:var(--ui-cor-texto-secundario, #888899);flex-shrink:0;shape-rendering:geometricPrecision}:host([aberta]) .ui-lista-flutuante__seta{transform:rotate(180deg)}.ui-lista-flutuante__backdrop{display:none;position:fixed;top:0;left:0;width:100vw;height:100vh;background:transparent;-webkit-backdrop-filter:none;backdrop-filter:none;z-index:9998}:host([aberta]) .ui-lista-flutuante__backdrop{display:block}:host(:not([aberta])) .ui-lista-flutuante__conteudo{display:none!important}:host([aberta]) .ui-lista-flutuante__conteudo{display:block}.ui-lista-flutuante__conteudo{position:fixed;margin:0;padding:4px;list-style:none;background-color:var(--ui-cor-fundo-menu, #18181c);border:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .14));border-radius:var(--ui-raio-borda, 6px);box-shadow:0 8px 28px #0000008c;max-height:220px;overflow-y:auto;z-index:9999;box-sizing:border-box;inset:auto}.ui-lista-flutuante__sheet-header{display:none;width:100%;margin-bottom:8px}.ui-lista-flutuante__handle{width:36px;height:4px;border-radius:2px;background-color:#ffffff40;margin:2px auto 8px}.ui-lista-flutuante__sheet-title-bar{display:flex;align-items:center;justify-content:space-between;width:100%;padding:4px 6px 8px;border-bottom:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .08));margin-bottom:6px}.ui-lista-flutuante__sheet-titulo{font-size:13px;font-weight:600;color:var(--ui-cor-primaria, #00E08A);letter-spacing:.3px;text-transform:uppercase}.ui-lista-flutuante__sheet-close{background:transparent;border:none;color:var(--ui-cor-texto-secundario, #888899);font-size:14px;cursor:pointer;padding:4px 8px;border-radius:4px;display:flex;align-items:center;justify-content:center;touch-action:manipulation;-webkit-tap-highlight-color:transparent;transition:color .15s,background-color .15s}.ui-lista-flutuante__sheet-close:hover{color:#fff;background-color:#ffffff14}.ui-lista-flutuante__item{padding:6px 10px;font-family:var(--ui-fonte-base, "Inter", sans-serif);font-size:12px;line-height:1.2;color:var(--ui-cor-texto, #e1e1e6);border-radius:4px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;touch-action:manipulation;-webkit-tap-highlight-color:transparent;transition:background-color .12s ease,color .12s ease;-webkit-user-select:none;user-select:none}.ui-lista-flutuante__item:hover{background-color:var(--ui-cor-hover-menu, rgba(255, 255, 255, .08))}.ui-lista-flutuante__item--selecionado{background-color:#00e08a26;color:var(--ui-cor-primaria, #00E08A);font-weight:600}.ui-lista-flutuante__item--selecionado:after{content:"✓";font-size:11px;color:var(--ui-cor-primaria, #00E08A)}@media (max-width: 640px){.ui-lista-flutuante__gatilho{min-height:max(var(--ui-campo-altura, 38px),38px);font-size:15px}:host([aberta]) .ui-lista-flutuante__backdrop{background-color:#00000059;-webkit-backdrop-filter:none;backdrop-filter:none}.ui-lista-flutuante__conteudo{position:fixed!important;bottom:0!important;top:auto!important;left:0!important;width:100vw!important;max-width:100vw!important;min-width:100vw!important;max-height:70vh!important;max-height:70dvh!important;border-radius:16px 16px 0 0!important;border-bottom:none!important;padding:10px 16px calc(24px + env(safe-area-inset-bottom,0px)) 16px!important;box-shadow:0 -8px 32px #000000b3!important;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;animation:ui-bottom-sheet-slide .22s cubic-bezier(.4,0,.2,1)}.ui-lista-flutuante__sheet-header{display:flex!important;flex-direction:column!important}.ui-lista-flutuante__sheet-close{min-width:44px;min-height:44px;font-size:18px}.ui-lista-flutuante__item{padding:12px 14px!important;font-size:15px!important;margin-bottom:3px}}:host([bottom-sheet][aberta]) .ui-lista-flutuante__backdrop,:host([modo-mobile][aberta]) .ui-lista-flutuante__backdrop{background-color:#00000059;-webkit-backdrop-filter:none;backdrop-filter:none}:host([bottom-sheet]) .ui-lista-flutuante__conteudo,:host([modo-mobile]) .ui-lista-flutuante__conteudo{position:fixed!important;bottom:0!important;top:auto!important;left:0!important;width:100vw!important;max-width:100vw!important;min-width:100vw!important;max-height:70vh!important;max-height:70dvh!important;border-radius:16px 16px 0 0!important;border-bottom:none!important;padding:10px 16px calc(24px + env(safe-area-inset-bottom,0px)) 16px!important;box-shadow:0 -8px 32px #000000b3!important;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;animation:ui-bottom-sheet-slide .22s cubic-bezier(.4,0,.2,1)}:host([bottom-sheet]) .ui-lista-flutuante__sheet-header,:host([modo-mobile]) .ui-lista-flutuante__sheet-header{display:flex!important;flex-direction:column!important}:host([bottom-sheet]) .ui-lista-flutuante__sheet-close,:host([modo-mobile]) .ui-lista-flutuante__sheet-close{min-width:44px;min-height:44px;font-size:18px}:host([bottom-sheet]) .ui-lista-flutuante__item,:host([modo-mobile]) .ui-lista-flutuante__item{padding:12px 14px!important;font-size:15px!important;margin-bottom:3px}@keyframes ui-bottom-sheet-slide{0%{transform:translateY(100%)}to{transform:translateY(0)}}', A = [
  "aberta",
  "texto-padrao",
  "value",
  "disabled",
  "bottom-sheet",
  "modo-mobile",
  "label",
  "rotulo",
  "placeholder",
  "tamanho",
  "size",
  "altura",
  "height",
  "densidade",
  "name",
  "obrigatorio",
  "required",
  "mensagem-validacao"
];
function E() {
  return `
    <style>${w}</style>
    <div class="ui-lista-flutuante__container">
      <label class="ui-lista-flutuante__label" style="display: none;"></label>
      <div class="ui-lista-flutuante__backdrop"></div>
      <button class="ui-lista-flutuante__gatilho" aria-haspopup="listbox" aria-expanded="false" type="button">
        <span class="ui-lista-flutuante__texto"></span>
        <span class="ui-lista-flutuante__seta">▼</span>
      </button>
      <div class="ui-lista-flutuante__conteudo" role="listbox" popover="manual">
        <div class="ui-lista-flutuante__sheet-header">
          <div class="ui-lista-flutuante__handle"></div>
          <div class="ui-lista-flutuante__sheet-title-bar">
            <span class="ui-lista-flutuante__sheet-titulo">Selecione uma opção</span>
            <button class="ui-lista-flutuante__sheet-close" type="button" aria-label="Fechar">✕</button>
          </div>
        </div>
        <ul class="ui-lista-flutuante__lista" style="margin: 0; padding: 0; list-style: none;"></ul>
      </div>
    </div>
  `;
}
function p(n, s, t) {
  n.innerHTML = "", s.forEach((e) => {
    const a = document.createElement("li"), r = String(e.id) === String(t);
    a.className = `ui-lista-flutuante__item ${r ? "ui-lista-flutuante__item--selecionado" : ""}`, a.setAttribute("data-id", e.id), a.textContent = e.label, a.role = "option", a.tabIndex = -1, r && a.setAttribute("aria-selected", "true"), n.appendChild(a);
  });
}
function V(n, s) {
  n.querySelectorAll(".ui-lista-flutuante__item").forEach((e) => {
    e.getAttribute("data-id") === String(s) ? (e.classList.add("ui-lista-flutuante__item--selecionado"), e.setAttribute("aria-selected", "true")) : (e.classList.remove("ui-lista-flutuante__item--selecionado"), e.removeAttribute("aria-selected"));
  });
}
class b extends u {
  constructor() {
    super();
    i(this, "internals");
    i(this, "labelElement");
    i(this, "button");
    i(this, "content");
    i(this, "listElement");
    i(this, "textoElement");
    i(this, "backdropElement");
    i(this, "sheetTituloElement");
    i(this, "sheetCloseButton");
    i(this, "listeners", new d());
    i(this, "_itens", []);
    i(this, "_value", "");
    i(this, "_defaultValue", "");
    i(this, "_formDisabled", !1);
    i(this, "_customErrorMessage", "");
    i(this, "observer");
    i(this, "posicionamento");
    i(this, "teclado");
    i(this, "toggleLista", (t) => {
      t.stopPropagation(), !this.disabled && (this.hasAttribute("aberta") ? this.fechar() : this.abrir());
    });
    i(this, "handleKeyDown", (t) => {
      this.disabled || (t.key === "Enter" || t.key === " " || t.key === "ArrowDown") && (t.preventDefault(), this.hasAttribute("aberta") ? this.teclado.focarPrimeiroItem() : this.abrir());
    });
    i(this, "handleListKeyDown", (t) => {
      this.hasAttribute("aberta") && this.teclado.tratarKeydownLista(
        t,
        this._itens,
        (e) => this.selecionarItem(e),
        this.fechar,
        this.button
      );
    });
    i(this, "fechar", () => {
      this.hasAttribute("aberta") && (this.removeAttribute("aberta"), this.posicionamento.desativarAcompanhamento(), this.teclado.resetarFoco());
    });
    i(this, "handleClickFora", (t) => {
      if (!this.hasAttribute("aberta")) return;
      const e = t.composedPath();
      !e.includes(this) && !e.includes(this.content) && this.fechar();
    });
    i(this, "handleListClick", (t) => {
      var o;
      t.stopPropagation();
      const e = (o = t.target) == null ? void 0 : o.closest("li[data-id]");
      if (!e) return;
      const a = e.getAttribute("data-id"), r = this._itens.find((h) => String(h.id) === String(a));
      r && this.selecionarItem(r);
    });
    this.internals = typeof this.attachInternals == "function" ? this.attachInternals() : {};
    const t = this.attachShadow({ mode: "open" });
    t.innerHTML = E(), this.labelElement = t.querySelector(".ui-lista-flutuante__label"), this.button = t.querySelector(".ui-lista-flutuante__gatilho"), this.content = t.querySelector(".ui-lista-flutuante__conteudo"), this.listElement = t.querySelector(".ui-lista-flutuante__lista"), this.textoElement = t.querySelector(".ui-lista-flutuante__texto"), this.backdropElement = t.querySelector(".ui-lista-flutuante__backdrop"), this.sheetTituloElement = t.querySelector(".ui-lista-flutuante__sheet-titulo"), this.sheetCloseButton = t.querySelector(".ui-lista-flutuante__sheet-close"), this.posicionamento = new y(this, this.button, this.content), this.teclado = new k(this.listElement);
  }
  static get observedAttributes() {
    return A;
  }
  connectedCallback() {
    this.listeners.cleanup(), this.listeners.add(this.button, "click", this.toggleLista), this.listeners.add(this.button, "keydown", this.handleKeyDown), this.listeners.add(this.content, "keydown", this.handleListKeyDown), this.listeners.add(this.backdropElement, "click", this.fechar), this.listeners.add(this.listElement, "click", this.handleListClick), this.listeners.add(this.sheetCloseButton, "click", (t) => {
      t.stopPropagation(), this.fechar();
    }), this.listeners.add(document, "click", this.handleClickFora), this._defaultValue = this.getAttribute("value") || "", this.carregarItensFilhos(), this.syncState(), this.observer = new MutationObserver(() => this.carregarItensFilhos()), this.observer.observe(this, { childList: !0, subtree: !0 });
  }
  carregarItensFilhos() {
    const t = Array.from(this.querySelectorAll('option, ui-opcao, [role="option"], [data-opcao], [data-value]:not(input):not(select)'));
    t.length > 0 && (this._itens = t.map((e, a) => {
      var o;
      const r = e.getAttribute("value") || e.getAttribute("data-value") || String(a + 1);
      return {
        id: r,
        label: ((o = e.textContent) == null ? void 0 : o.trim()) || r || `Opção ${a + 1}`
      };
    }), p(this.listElement, this._itens, this._value), this.syncLabel());
  }
  disconnectedCallback() {
    this.listeners.cleanup(), this.observer && this.observer.disconnect(), this.fechar();
  }
  attributeChangedCallback(t, e, a) {
    t === "aberta" && this.button.setAttribute("aria-expanded", String(a !== null)), (t === "texto-padrao" || t === "placeholder" || t === "label" || t === "rotulo") && this.syncLabel(), t === "value" && a !== this._value && (this.value = a || ""), t === "disabled" && (this.button.disabled = this.disabled), (t === "altura" || t === "height") && (a ? this.style.setProperty("--ui-campo-altura", isNaN(Number(a)) ? a : `${a}px`) : this.style.removeProperty("--ui-campo-altura"));
  }
  get value() {
    return this._value;
  }
  set value(t) {
    this._value = t, this.setAttribute("value", t), this.internals.setFormValue(t), this.syncLabel(), V(this.listElement, this._value), this.atualizarValidade();
  }
  get label() {
    return this.getAttribute("label") || this.getAttribute("rotulo") || "";
  }
  set label(t) {
    t ? this.setAttribute("label", t) : (this.removeAttribute("label"), this.removeAttribute("rotulo")), this.syncLabel();
  }
  get disabled() {
    return this.hasAttribute("disabled") || this._formDisabled;
  }
  set disabled(t) {
    t ? this.setAttribute("disabled", "") : this.removeAttribute("disabled"), this.button.disabled = this.disabled;
  }
  get form() {
    var t;
    return this.closest("form") ?? ((t = this.internals) == null ? void 0 : t.form) ?? null;
  }
  get name() {
    return this.getAttribute("name") || "";
  }
  set name(t) {
    this.setAttribute("name", t);
  }
  get type() {
    return "select-one";
  }
  get required() {
    return this.hasAttribute("obrigatorio") || this.hasAttribute("required");
  }
  set required(t) {
    t ? this.setAttribute("obrigatorio", "") : (this.removeAttribute("obrigatorio"), this.removeAttribute("required")), this.syncState();
  }
  get obrigatorio() {
    return this.required;
  }
  set obrigatorio(t) {
    this.required = t;
  }
  get validity() {
    var t;
    return this.atualizarValidade(), (t = this.internals) == null ? void 0 : t.validity;
  }
  get validationMessage() {
    var t;
    return this.atualizarValidade(), ((t = this.internals) == null ? void 0 : t.validationMessage) ?? "";
  }
  get willValidate() {
    var t;
    return ((t = this.internals) == null ? void 0 : t.willValidate) ?? !1;
  }
  checkValidity() {
    var t, e;
    return this.atualizarValidade(), ((e = (t = this.internals) == null ? void 0 : t.checkValidity) == null ? void 0 : e.call(t)) ?? !0;
  }
  reportValidity() {
    var t, e;
    return this.atualizarValidade(), ((e = (t = this.internals) == null ? void 0 : t.reportValidity) == null ? void 0 : e.call(t)) ?? !0;
  }
  setCustomValidity(t) {
    this._customErrorMessage = t || "", this.atualizarValidade();
  }
  atualizarValidade() {
    if (!this.internals || typeof this.internals.setValidity != "function") return;
    if (this.disabled) {
      this.internals.setValidity({});
      return;
    }
    if (this._customErrorMessage) {
      this.internals.setValidity({ customError: !0 }, this._customErrorMessage, this.button);
      return;
    }
    if ((this.hasAttribute("obrigatorio") || this.hasAttribute("required")) && (!this._value || this._value.trim() === "")) {
      const e = this.getAttribute("mensagem-validacao") || "Selecione um item da lista.";
      this.internals.setValidity({ valueMissing: !0 }, e, this.button);
      return;
    }
    this.internals.setValidity({});
  }
  // === Ciclo de Vida Form-Associated Custom Elements (W3C FACE) ===
  formDisabledCallback(t) {
    this._formDisabled = t, this.button.disabled = this.disabled, this.disabled && this.fechar();
  }
  formResetCallback() {
    this.value = this._defaultValue;
  }
  formStateRestoreCallback(t, e) {
    typeof t == "string" && (this.value = t);
  }
  get itens() {
    return this._itens;
  }
  set itens(t) {
    this._itens = t || [], p(this.listElement, this._itens, this._value), this.syncLabel();
  }
  abrir() {
    this.disabled || this.hasAttribute("aberta") || (this.setAttribute("aberta", ""), this.posicionamento.posicionar(), this.posicionamento.ativarAcompanhamento(this.fechar));
  }
  syncLabel() {
    const t = this.getAttribute("label") || this.getAttribute("rotulo");
    if (t)
      this.required ? this.labelElement.innerHTML = `${t} <span class="ui-lista-flutuante__asterisco" style="color: var(--ui-cor-texto-erro, #ff5555); margin-left: 2px;">*</span>` : this.labelElement.textContent = t, this.labelElement.style.display = "block", this.sheetTituloElement.textContent = t;
    else {
      this.labelElement.style.display = "none";
      const a = this.getAttribute("texto-padrao") || this.getAttribute("placeholder") || "Opções";
      this.sheetTituloElement.textContent = a;
    }
    const e = this._itens.find((a) => String(a.id) === String(this._value));
    if (e)
      this.textoElement.textContent = e.label;
    else {
      const a = this.getAttribute("texto-padrao") || this.getAttribute("placeholder") || "Opções";
      this.textoElement.textContent = a;
    }
  }
  syncState() {
    const t = this.getAttribute("altura") || this.getAttribute("height");
    t && this.style.setProperty("--ui-campo-altura", isNaN(Number(t)) ? t : `${t}px`), this.hasAttribute("value") && (this._value = this.getAttribute("value") || "", this.internals.setFormValue(this._value)), this.syncLabel(), this.atualizarValidade();
  }
  selecionarItem(t) {
    this.value = t.id, this.fechar(), this.dispatchEvent(
      new CustomEvent("ui-selecionar", {
        detail: t,
        bubbles: !0,
        composed: !0
      })
    ), this.dispatchEvent(
      new Event("change", {
        bubbles: !0,
        composed: !0
      })
    ), this.dispatchEvent(
      new Event("input", {
        bubbles: !0,
        composed: !0
      })
    );
  }
}
i(b, "formAssociated", !0);
class S extends b {
}
c("ui-lista-flutuante", b);
c("ui-select", S);
const L = ':host{display:inline-flex;align-items:center;box-sizing:border-box;font-family:var(--ui-fonte-base, "Inter", sans-serif);vertical-align:middle}.ui-checkbox{display:inline-flex;align-items:center;gap:8px;cursor:pointer;-webkit-user-select:none;user-select:none;line-height:1;outline:none;touch-action:manipulation;-webkit-tap-highlight-color:transparent}.ui-checkbox--disabled{opacity:.5;cursor:not-allowed!important;pointer-events:none}.ui-checkbox__box{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;min-width:16px;min-height:16px;background-color:var(--ui-cor-fundo-elevado, #1a1a1e);border:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .16));border-radius:4px;box-sizing:border-box;transition:background-color .15s ease,border-color .15s ease,box-shadow .15s ease;flex-shrink:0}.ui-checkbox:focus-visible .ui-checkbox__box,.ui-checkbox--foco .ui-checkbox__box{border-color:var(--ui-cor-primaria, #00E08A);box-shadow:0 0 0 2px #00e08a40}.ui-checkbox--checked .ui-checkbox__box,.ui-checkbox--indeterminate .ui-checkbox__box{background-color:var(--ui-cor-primaria, #00E08A);border-color:var(--ui-cor-primaria, #00E08A);color:var(--ui-cor-texto-sobre-primaria, #000000)}.ui-checkbox__mark{width:12px;height:12px;display:flex;align-items:center;justify-content:center;transition:transform .15s cubic-bezier(.4,0,.2,1),opacity .15s ease;transform:scale(0);opacity:0}.ui-checkbox--checked .ui-checkbox__mark,.ui-checkbox--indeterminate .ui-checkbox__mark{transform:scale(1);opacity:1}.ui-checkbox__mark svg{width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;shape-rendering:geometricPrecision}.ui-checkbox__label{display:inline-flex;align-items:center;font-size:clamp(11px,.85rem,14px);color:var(--ui-cor-texto, #e1e1e6);line-height:1}.ui-checkbox--label-esquerda{flex-direction:row-reverse}@media (max-width: 640px){.ui-checkbox{min-height:40px;padding:4px 0}.ui-checkbox__box{width:20px;height:20px;min-width:20px;min-height:20px}.ui-checkbox__mark{width:14px;height:14px}.ui-checkbox__label{font-size:14px}}';
class f extends u {
  constructor() {
    super();
    i(this, "internals");
    i(this, "containerElement");
    i(this, "markElement");
    i(this, "labelElement");
    i(this, "listeners", new d());
    i(this, "_defaultChecked", !1);
    i(this, "_defaultIndeterminate", !1);
    i(this, "_formDisabled", !1);
    i(this, "_customErrorMessage", "");
    i(this, "handleClick", (t) => {
      t.preventDefault(), this.alternar();
    });
    i(this, "handleKeyDown", (t) => {
      (t.key === " " || t.key === "Enter") && (t.preventDefault(), this.alternar());
    });
    i(this, "handleFocus", () => {
      this.containerElement.classList.add("ui-checkbox--foco");
    });
    i(this, "handleBlur", () => {
      this.containerElement.classList.remove("ui-checkbox--foco");
    });
    this.internals = typeof this.attachInternals == "function" ? this.attachInternals() : {};
    const t = this.attachShadow({ mode: "open" });
    t.innerHTML = `
      <style>${L}</style>
      <div class="ui-checkbox" tabindex="0" role="checkbox" aria-checked="false">
        <span class="ui-checkbox__box">
          <span class="ui-checkbox__mark"></span>
        </span>
        <span class="ui-checkbox__label" style="display: none;"></span>
      </div>
    `, this.containerElement = t.querySelector(".ui-checkbox"), this.markElement = t.querySelector(".ui-checkbox__mark"), this.labelElement = t.querySelector(".ui-checkbox__label");
  }
  static get observedAttributes() {
    return [
      "marcado",
      "checked",
      "indeterminado",
      "indeterminate",
      "disabled",
      "value",
      "label",
      "posicao-label",
      "name",
      "obrigatorio",
      "required",
      "mensagem-validacao"
    ];
  }
  connectedCallback() {
    this.listeners.cleanup(), this.listeners.add(this.containerElement, "click", this.handleClick), this.listeners.add(this.containerElement, "keydown", this.handleKeyDown), this.listeners.add(this.containerElement, "focus", this.handleFocus), this.listeners.add(this.containerElement, "blur", this.handleBlur), this._defaultChecked = this.hasAttribute("marcado") || this.hasAttribute("checked"), this._defaultIndeterminate = this.hasAttribute("indeterminado") || this.hasAttribute("indeterminate"), this.syncState();
  }
  disconnectedCallback() {
    this.listeners.cleanup();
  }
  attributeChangedCallback(t, e, a) {
    this.syncState();
  }
  get marcado() {
    return this.hasAttribute("marcado") || this.hasAttribute("checked");
  }
  set marcado(t) {
    t ? this.setAttribute("marcado", "") : (this.removeAttribute("marcado"), this.removeAttribute("checked")), this.syncState();
  }
  get checked() {
    return this.marcado;
  }
  set checked(t) {
    this.marcado = t;
  }
  get value() {
    return this.getAttribute("value") || "on";
  }
  set value(t) {
    this.setAttribute("value", t), this.syncState();
  }
  get name() {
    return this.getAttribute("name") || "";
  }
  set name(t) {
    this.setAttribute("name", t), this.syncState();
  }
  get indeterminado() {
    return this.hasAttribute("indeterminado") || this.hasAttribute("indeterminate");
  }
  set indeterminado(t) {
    t ? this.setAttribute("indeterminado", "") : (this.removeAttribute("indeterminado"), this.removeAttribute("indeterminate")), this.syncState();
  }
  get disabled() {
    return this.hasAttribute("disabled") || this._formDisabled;
  }
  set disabled(t) {
    t ? this.setAttribute("disabled", "") : this.removeAttribute("disabled"), this.syncState();
  }
  get form() {
    var t;
    return this.closest("form") ?? ((t = this.internals) == null ? void 0 : t.form) ?? null;
  }
  get type() {
    return "checkbox";
  }
  get required() {
    return this.hasAttribute("obrigatorio") || this.hasAttribute("required");
  }
  set required(t) {
    t ? this.setAttribute("obrigatorio", "") : (this.removeAttribute("obrigatorio"), this.removeAttribute("required")), this.syncState();
  }
  get obrigatorio() {
    return this.required;
  }
  set obrigatorio(t) {
    this.required = t;
  }
  get validity() {
    var t;
    return this.atualizarValidade(), (t = this.internals) == null ? void 0 : t.validity;
  }
  get validationMessage() {
    var t;
    return this.atualizarValidade(), ((t = this.internals) == null ? void 0 : t.validationMessage) ?? "";
  }
  get willValidate() {
    var t;
    return ((t = this.internals) == null ? void 0 : t.willValidate) ?? !1;
  }
  checkValidity() {
    var t, e;
    return this.atualizarValidade(), ((e = (t = this.internals) == null ? void 0 : t.checkValidity) == null ? void 0 : e.call(t)) ?? !0;
  }
  reportValidity() {
    var t, e;
    return this.atualizarValidade(), ((e = (t = this.internals) == null ? void 0 : t.reportValidity) == null ? void 0 : e.call(t)) ?? !0;
  }
  setCustomValidity(t) {
    this._customErrorMessage = t || "", this.atualizarValidade();
  }
  atualizarValidade() {
    if (!this.internals || typeof this.internals.setValidity != "function") return;
    if (this.disabled) {
      this.internals.setValidity({});
      return;
    }
    if (this._customErrorMessage) {
      this.internals.setValidity({ customError: !0 }, this._customErrorMessage, this.containerElement);
      return;
    }
    if ((this.hasAttribute("obrigatorio") || this.hasAttribute("required")) && !this.marcado) {
      const e = this.getAttribute("mensagem-validacao") || "Marque esta caixa para continuar.";
      this.internals.setValidity({ valueMissing: !0 }, e, this.containerElement);
      return;
    }
    this.internals.setValidity({});
  }
  alternar() {
    this.disabled || (this.indeterminado ? (this.indeterminado = !1, this.marcado = !0) : this.marcado = !this.marcado, this.dispatchEvent(
      new CustomEvent("ui-change", {
        detail: {
          marcado: this.marcado,
          indeterminado: this.indeterminado,
          value: this.getAttribute("value") || ""
        },
        bubbles: !0,
        composed: !0
      })
    ), this.dispatchEvent(
      new Event("change", {
        bubbles: !0,
        composed: !0
      })
    ));
  }
  syncState() {
    const t = this.marcado, e = this.indeterminado, a = this.disabled, r = this.getAttribute("label"), o = this.getAttribute("posicao-label") || "direita";
    this.containerElement.setAttribute(
      "aria-checked",
      e ? "mixed" : String(t)
    ), a ? (this.containerElement.classList.add("ui-checkbox--disabled"), this.containerElement.setAttribute("tabindex", "-1"), this.containerElement.setAttribute("aria-disabled", "true")) : (this.containerElement.classList.remove("ui-checkbox--disabled"), this.containerElement.setAttribute("tabindex", "0"), this.containerElement.removeAttribute("aria-disabled")), t ? this.containerElement.classList.add("ui-checkbox--checked") : this.containerElement.classList.remove("ui-checkbox--checked"), e ? this.containerElement.classList.add("ui-checkbox--indeterminate") : this.containerElement.classList.remove("ui-checkbox--indeterminate"), o === "esquerda" ? this.containerElement.classList.add("ui-checkbox--label-esquerda") : this.containerElement.classList.remove("ui-checkbox--label-esquerda"), e ? this.markElement.innerHTML = `
        <svg viewBox="0 0 24 24">
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      ` : t ? this.markElement.innerHTML = `
        <svg viewBox="0 0 24 24">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      ` : this.markElement.innerHTML = "", r ? (this.labelElement.textContent = r, this.labelElement.style.display = "inline") : this.labelElement.style.display = "none", t ? this.internals.setFormValue(this.getAttribute("value") || "on") : this.internals.setFormValue(null), this.atualizarValidade();
  }
  // === Ciclo de Vida Form-Associated Custom Elements (W3C FACE) ===
  formDisabledCallback(t) {
    this._formDisabled = t, this.syncState();
  }
  formResetCallback() {
    this.marcado = this._defaultChecked, this.indeterminado = this._defaultIndeterminate, this.syncState();
  }
  formStateRestoreCallback(t, e) {
    typeof t == "string" ? this.marcado = t === (this.getAttribute("value") || "on") : typeof t == "boolean" && (this.marcado = t), this.syncState();
  }
}
i(f, "formAssociated", !0);
c("ui-checkbox", f);
const z = ':host{display:inline-flex;align-items:center;box-sizing:border-box;font-family:var(--ui-fonte-base, "Inter", sans-serif);vertical-align:middle}.ui-radio{display:inline-flex;align-items:center;gap:8px;cursor:pointer;-webkit-user-select:none;user-select:none;line-height:1;outline:none}.ui-radio--disabled{opacity:.5;cursor:not-allowed!important;pointer-events:none}.ui-radio__circle{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;min-width:16px;min-height:16px;background-color:var(--ui-cor-fundo-elevado, #1a1a1e);border:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .16));border-radius:50%;box-sizing:border-box;transition:background-color .15s ease,border-color .15s ease,box-shadow .15s ease;flex-shrink:0}.ui-radio:focus-visible .ui-radio__circle,.ui-radio--foco .ui-radio__circle{border-color:var(--ui-cor-primaria, #00E08A);box-shadow:0 0 0 2px #00e08a40}.ui-radio--checked .ui-radio__circle{border-color:var(--ui-cor-primaria, #00E08A)}.ui-radio__dot{width:8px;height:8px;border-radius:50%;background-color:var(--ui-cor-primaria, #00E08A);transition:transform .15s cubic-bezier(.4,0,.2,1),opacity .15s ease;transform:scale(0);opacity:0}.ui-radio--checked .ui-radio__dot{transform:scale(1);opacity:1}.ui-radio__label{display:inline-flex;align-items:center;font-size:clamp(11px,.85rem,14px);color:var(--ui-cor-texto, #e1e1e6);line-height:1}.ui-radio--label-esquerda{flex-direction:row-reverse}';
class l {
  static getScopeNode(s) {
    return s.closest("form") || s.getRootNode() || document;
  }
  static registrar(s) {
    const t = s.name;
    if (t) {
      const e = this.getScopeNode(s);
      this.registry.has(e) || this.registry.set(e, /* @__PURE__ */ new Map());
      const a = this.registry.get(e);
      a.has(t) || a.set(t, /* @__PURE__ */ new Set()), a.get(t).add(s);
    }
  }
  static desregistrar(s) {
    const t = s.name;
    if (t) {
      const e = this.getScopeNode(s), a = this.registry.get(e);
      if (a && a.has(t)) {
        const r = a.get(t);
        r.delete(s), r.size === 0 && a.delete(t), a.size === 0 && this.registry.delete(e);
      }
    }
  }
  static obterRadiosDoGrupo(s) {
    const t = s.name;
    if (!t) return [];
    const e = this.getScopeNode(s), a = this.registry.get(e);
    return !a || !a.has(t) ? [] : Array.from(a.get(t));
  }
  static desmarcarOutros(s) {
    this.obterRadiosDoGrupo(s).forEach((e) => {
      e !== s && (e.removeAttribute("marcado"), e.removeAttribute("checked"), e.syncState());
    });
  }
  static tratarNavegacaoTeclado(s, t) {
    if (["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(s.key)) {
      s.preventDefault();
      const a = this.obterRadiosDoGrupo(t).filter((h) => !h.disabled);
      if (a.length <= 1) return;
      const r = a.indexOf(t);
      let o = r;
      if (s.key === "ArrowDown" || s.key === "ArrowRight" ? o = (r + 1) % a.length : (s.key === "ArrowUp" || s.key === "ArrowLeft") && (o = (r - 1 + a.length) % a.length), o !== r && o >= 0 && o < a.length) {
        const h = a[o];
        h.selecionar(), h.focus();
      }
    }
  }
}
i(l, "registry", /* @__PURE__ */ new WeakMap());
class g extends u {
  constructor() {
    super();
    i(this, "internals");
    i(this, "containerElement");
    i(this, "labelElement");
    i(this, "_defaultChecked", !1);
    i(this, "_formDisabled", !1);
    i(this, "_customErrorMessage", "");
    i(this, "handleClick", (t) => {
      t.preventDefault(), this.selecionar(), this.containerElement.focus();
    });
    i(this, "handleKeyDown", (t) => {
      t.key === " " || t.key === "Enter" ? (t.preventDefault(), this.selecionar()) : l.tratarNavegacaoTeclado(t, this);
    });
    i(this, "handleFocus", () => {
      this.containerElement.classList.add("ui-radio--foco");
    });
    i(this, "handleBlur", () => {
      this.containerElement.classList.remove("ui-radio--foco");
    });
    this.internals = typeof this.attachInternals == "function" ? this.attachInternals() : {};
    const t = this.attachShadow({ mode: "open" });
    t.innerHTML = `
      <style>${z}</style>
      <div class="ui-radio" tabindex="0" role="radio" aria-checked="false">
        <span class="ui-radio__circle">
          <span class="ui-radio__dot"></span>
        </span>
        <span class="ui-radio__label" style="display: none;"></span>
      </div>
    `, this.containerElement = t.querySelector(".ui-radio"), this.labelElement = t.querySelector(".ui-radio__label");
  }
  static get observedAttributes() {
    return [
      "marcado",
      "checked",
      "name",
      "nome",
      "disabled",
      "value",
      "label",
      "posicao-label",
      "obrigatorio",
      "required",
      "mensagem-validacao"
    ];
  }
  connectedCallback() {
    this.containerElement.addEventListener("click", this.handleClick), this.containerElement.addEventListener("keydown", this.handleKeyDown), this.containerElement.addEventListener("focus", this.handleFocus), this.containerElement.addEventListener("blur", this.handleBlur), this._defaultChecked = this.hasAttribute("marcado") || this.hasAttribute("checked"), l.registrar(this), this.syncState();
  }
  disconnectedCallback() {
    this.containerElement.removeEventListener("click", this.handleClick), this.containerElement.removeEventListener("keydown", this.handleKeyDown), this.containerElement.removeEventListener("focus", this.handleFocus), this.containerElement.removeEventListener("blur", this.handleBlur), l.desregistrar(this);
  }
  attributeChangedCallback(t, e, a) {
    this.syncState();
  }
  get marcado() {
    return this.hasAttribute("marcado") || this.hasAttribute("checked");
  }
  set marcado(t) {
    t ? this.setAttribute("marcado", "") : (this.removeAttribute("marcado"), this.removeAttribute("checked"));
  }
  get name() {
    return this.getAttribute("name") || this.getAttribute("nome") || "";
  }
  set name(t) {
    l.desregistrar(this), this.setAttribute("name", t), l.registrar(this), this.syncState();
  }
  get disabled() {
    return this.hasAttribute("disabled") || this._formDisabled;
  }
  set disabled(t) {
    t ? this.setAttribute("disabled", "") : this.removeAttribute("disabled"), this.syncState();
  }
  get form() {
    var t;
    return this.closest("form") ?? ((t = this.internals) == null ? void 0 : t.form) ?? null;
  }
  get type() {
    return "radio";
  }
  get required() {
    return this.hasAttribute("obrigatorio") || this.hasAttribute("required");
  }
  set required(t) {
    t ? this.setAttribute("obrigatorio", "") : (this.removeAttribute("obrigatorio"), this.removeAttribute("required")), this.syncState();
  }
  get obrigatorio() {
    return this.required;
  }
  set obrigatorio(t) {
    this.required = t;
  }
  get validity() {
    var t;
    return this.atualizarValidade(), (t = this.internals) == null ? void 0 : t.validity;
  }
  get validationMessage() {
    var t;
    return this.atualizarValidade(), ((t = this.internals) == null ? void 0 : t.validationMessage) ?? "";
  }
  get willValidate() {
    var t;
    return ((t = this.internals) == null ? void 0 : t.willValidate) ?? !1;
  }
  checkValidity() {
    var t, e;
    return this.atualizarValidade(), ((e = (t = this.internals) == null ? void 0 : t.checkValidity) == null ? void 0 : e.call(t)) ?? !0;
  }
  reportValidity() {
    var t, e;
    return this.atualizarValidade(), ((e = (t = this.internals) == null ? void 0 : t.reportValidity) == null ? void 0 : e.call(t)) ?? !0;
  }
  setCustomValidity(t) {
    this._customErrorMessage = t || "", this.atualizarValidade();
  }
  atualizarValidade() {
    if (!this.internals || typeof this.internals.setValidity != "function") return;
    if (this.disabled) {
      this.internals.setValidity({});
      return;
    }
    if (this._customErrorMessage) {
      this.internals.setValidity({ customError: !0 }, this._customErrorMessage, this.containerElement);
      return;
    }
    const t = l.obterRadiosDoGrupo(this);
    if ((this.required || t.length > 0 && t.some((a) => a.required)) && !(this.marcado || t.length > 0 && t.some((r) => r.marcado))) {
      const r = this.getAttribute("mensagem-validacao") || "Selecione uma opção.";
      this.internals.setValidity({ valueMissing: !0 }, r, this.containerElement);
      return;
    }
    this.internals.setValidity({});
  }
  focus(t) {
    this.containerElement.focus(t);
  }
  selecionar() {
    this.disabled || this.marcado || (l.desmarcarOutros(this), this.marcado = !0, this.dispatchEvent(
      new CustomEvent("ui-change", {
        detail: {
          marcado: !0,
          name: this.name,
          value: this.getAttribute("value") || ""
        },
        bubbles: !0,
        composed: !0
      })
    ), this.dispatchEvent(
      new Event("change", {
        bubbles: !0,
        composed: !0
      })
    ), l.obterRadiosDoGrupo(this).forEach((t) => t.atualizarValidade()));
  }
  syncState() {
    const t = this.marcado, e = this.disabled, a = this.getAttribute("label"), r = this.getAttribute("posicao-label") || "direita";
    if (this.containerElement.setAttribute("aria-checked", String(t)), e)
      this.containerElement.classList.add("ui-radio--disabled"), this.containerElement.setAttribute("tabindex", "-1"), this.containerElement.setAttribute("aria-disabled", "true");
    else {
      this.containerElement.classList.remove("ui-radio--disabled"), this.containerElement.removeAttribute("aria-disabled");
      const o = l.obterRadiosDoGrupo(this);
      o.length > 0 ? o.some((x) => x.marcado) ? this.containerElement.setAttribute("tabindex", t ? "0" : "-1") : this.containerElement.setAttribute("tabindex", o[0] === this ? "0" : "-1") : this.containerElement.setAttribute("tabindex", "0");
    }
    t ? this.containerElement.classList.add("ui-radio--checked") : this.containerElement.classList.remove("ui-radio--checked"), r === "esquerda" ? this.containerElement.classList.add("ui-radio--label-esquerda") : this.containerElement.classList.remove("ui-radio--label-esquerda"), a ? (this.labelElement.textContent = a, this.labelElement.style.display = "inline") : this.labelElement.style.display = "none", t ? this.internals.setFormValue(this.getAttribute("value") || "on") : this.internals.setFormValue(null), this.atualizarValidade();
  }
  // === Ciclo de Vida Form-Associated Custom Elements (W3C FACE) ===
  formDisabledCallback(t) {
    this._formDisabled = t, this.syncState();
  }
  formResetCallback() {
    this.marcado = this._defaultChecked, this._defaultChecked ? this.internals.setFormValue(this.getAttribute("value") || "on") : this.internals.setFormValue(null), this.atualizarValidade();
  }
  formStateRestoreCallback(t, e) {
    typeof t == "string" ? this.marcado = t === (this.getAttribute("value") || "on") : typeof t == "boolean" && (this.marcado = t), this.syncState();
  }
}
i(g, "formAssociated", !0);
c("ui-radio", g);
const C = ':host{display:inline-flex;align-items:center;box-sizing:border-box;font-family:var(--ui-fonte-base, "Inter", sans-serif);vertical-align:middle}.ui-switch{display:inline-flex;align-items:center;gap:8px;cursor:pointer;-webkit-user-select:none;user-select:none;line-height:1;outline:none;touch-action:manipulation;-webkit-tap-highlight-color:transparent}.ui-switch--disabled{opacity:.5;cursor:not-allowed!important;pointer-events:none}.ui-switch__track{display:inline-flex;align-items:center;position:relative;width:36px;height:20px;background-color:var(--ui-cor-fundo-elevado, #1a1a1e);border:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .16));border-radius:999px;box-sizing:border-box;padding:1px;transition:background-color .2s ease,border-color .2s ease,box-shadow .2s ease;flex-shrink:0}.ui-switch:focus-visible .ui-switch__track,.ui-switch--foco .ui-switch__track{border-color:var(--ui-cor-primaria, #00E08A);box-shadow:0 0 0 2px #00e08a40}.ui-switch--checked .ui-switch__track{background-color:var(--ui-cor-primaria, #00E08A);border-color:var(--ui-cor-primaria, #00E08A)}.ui-switch__thumb{display:block;width:16px;height:16px;background-color:#fff;border-radius:50%;box-shadow:0 1px 3px #0000004d;transition:transform .2s cubic-bezier(.4,0,.2,1),background-color .2s ease;transform:translate(0)}.ui-switch--checked .ui-switch__thumb{transform:translate(16px);background-color:var(--ui-cor-texto-sobre-primaria, #000000)}.ui-switch--sm .ui-switch__track{width:28px;height:16px;padding:1px}.ui-switch--sm .ui-switch__thumb{width:12px;height:12px}.ui-switch--sm.ui-switch--checked .ui-switch__thumb{transform:translate(12px)}.ui-switch--lg .ui-switch__track{width:44px;height:24px;padding:1px}.ui-switch--lg .ui-switch__thumb{width:20px;height:20px}.ui-switch--lg.ui-switch--checked .ui-switch__thumb{transform:translate(20px)}.ui-switch__label{display:inline-flex;align-items:center;font-size:clamp(11px,.85rem,14px);color:var(--ui-cor-texto, #e1e1e6);line-height:1}.ui-switch--label-esquerda{flex-direction:row-reverse}@media (max-width: 640px){.ui-switch{min-height:40px;padding:4px 0}.ui-switch__label{font-size:14px}}';
class m extends u {
  constructor() {
    super();
    i(this, "internals");
    i(this, "containerElement");
    i(this, "labelElement");
    i(this, "listeners", new d());
    i(this, "_defaultChecked", !1);
    i(this, "_formDisabled", !1);
    i(this, "_customErrorMessage", "");
    i(this, "handleClick", (t) => {
      t.preventDefault(), this.alternar();
    });
    i(this, "handleKeyDown", (t) => {
      (t.key === " " || t.key === "Enter") && (t.preventDefault(), this.alternar());
    });
    i(this, "handleFocus", () => {
      this.containerElement.classList.add("ui-switch--foco");
    });
    i(this, "handleBlur", () => {
      this.containerElement.classList.remove("ui-switch--foco");
    });
    this.internals = typeof this.attachInternals == "function" ? this.attachInternals() : {};
    const t = this.attachShadow({ mode: "open" });
    t.innerHTML = `
      <style>${C}</style>
      <div class="ui-switch" tabindex="0" role="switch" aria-checked="false">
        <span class="ui-switch__track">
          <span class="ui-switch__thumb"></span>
        </span>
        <span class="ui-switch__label" style="display: none;"></span>
      </div>
    `, this.containerElement = t.querySelector(".ui-switch"), this.labelElement = t.querySelector(".ui-switch__label");
  }
  static get observedAttributes() {
    return [
      "ativo",
      "ligado",
      "checked",
      "disabled",
      "tamanho",
      "size",
      "label",
      "posicao-label",
      "value",
      "name",
      "obrigatorio",
      "required",
      "mensagem-validacao"
    ];
  }
  connectedCallback() {
    this.listeners.cleanup(), this.listeners.add(this.containerElement, "click", this.handleClick), this.listeners.add(this.containerElement, "keydown", this.handleKeyDown), this.listeners.add(this.containerElement, "focus", this.handleFocus), this.listeners.add(this.containerElement, "blur", this.handleBlur), this._defaultChecked = this.hasAttribute("ativo") || this.hasAttribute("ligado") || this.hasAttribute("checked"), this.syncState();
  }
  disconnectedCallback() {
    this.listeners.cleanup();
  }
  attributeChangedCallback(t, e, a) {
    this.syncState();
  }
  get ativo() {
    return this.hasAttribute("ativo") || this.hasAttribute("ligado") || this.hasAttribute("checked");
  }
  set ativo(t) {
    t ? this.setAttribute("ativo", "") : (this.removeAttribute("ativo"), this.removeAttribute("ligado"), this.removeAttribute("checked")), this.syncState();
  }
  get checked() {
    return this.ativo;
  }
  set checked(t) {
    this.ativo = t;
  }
  get value() {
    return this.getAttribute("value") || "on";
  }
  set value(t) {
    this.setAttribute("value", t), this.syncState();
  }
  get name() {
    return this.getAttribute("name") || "";
  }
  set name(t) {
    this.setAttribute("name", t), this.syncState();
  }
  get disabled() {
    return this.hasAttribute("disabled") || this._formDisabled;
  }
  set disabled(t) {
    t ? this.setAttribute("disabled", "") : this.removeAttribute("disabled"), this.syncState();
  }
  get form() {
    var t;
    return this.closest("form") ?? ((t = this.internals) == null ? void 0 : t.form) ?? null;
  }
  get type() {
    return "checkbox";
  }
  get required() {
    return this.hasAttribute("obrigatorio") || this.hasAttribute("required");
  }
  set required(t) {
    t ? this.setAttribute("obrigatorio", "") : (this.removeAttribute("obrigatorio"), this.removeAttribute("required")), this.syncState();
  }
  get obrigatorio() {
    return this.required;
  }
  set obrigatorio(t) {
    this.required = t;
  }
  get validity() {
    var t;
    return this.atualizarValidade(), (t = this.internals) == null ? void 0 : t.validity;
  }
  get validationMessage() {
    var t;
    return this.atualizarValidade(), ((t = this.internals) == null ? void 0 : t.validationMessage) ?? "";
  }
  get willValidate() {
    var t;
    return ((t = this.internals) == null ? void 0 : t.willValidate) ?? !1;
  }
  checkValidity() {
    var t, e;
    return this.atualizarValidade(), ((e = (t = this.internals) == null ? void 0 : t.checkValidity) == null ? void 0 : e.call(t)) ?? !0;
  }
  reportValidity() {
    var t, e;
    return this.atualizarValidade(), ((e = (t = this.internals) == null ? void 0 : t.reportValidity) == null ? void 0 : e.call(t)) ?? !0;
  }
  setCustomValidity(t) {
    this._customErrorMessage = t || "", this.atualizarValidade();
  }
  atualizarValidade() {
    if (!this.internals || typeof this.internals.setValidity != "function") return;
    if (this.disabled) {
      this.internals.setValidity({});
      return;
    }
    if (this._customErrorMessage) {
      this.internals.setValidity({ customError: !0 }, this._customErrorMessage, this.containerElement);
      return;
    }
    if ((this.hasAttribute("obrigatorio") || this.hasAttribute("required")) && !this.ativo) {
      const e = this.getAttribute("mensagem-validacao") || "Ative este interruptor para continuar.";
      this.internals.setValidity({ valueMissing: !0 }, e, this.containerElement);
      return;
    }
    this.internals.setValidity({});
  }
  alternar() {
    this.disabled || (this.ativo = !this.ativo, this.dispatchEvent(
      new CustomEvent("ui-change", {
        detail: {
          ativo: this.ativo,
          value: this.getAttribute("value") || ""
        },
        bubbles: !0,
        composed: !0
      })
    ), this.dispatchEvent(
      new Event("change", {
        bubbles: !0,
        composed: !0
      })
    ));
  }
  syncState() {
    const t = this.ativo, e = this.disabled, a = this.getAttribute("tamanho") || this.getAttribute("size") || "md", r = this.getAttribute("label"), o = this.getAttribute("posicao-label") || "direita";
    this.containerElement.setAttribute("aria-checked", String(t)), e ? (this.containerElement.classList.add("ui-switch--disabled"), this.containerElement.setAttribute("tabindex", "-1"), this.containerElement.setAttribute("aria-disabled", "true")) : (this.containerElement.classList.remove("ui-switch--disabled"), this.containerElement.setAttribute("tabindex", "0"), this.containerElement.removeAttribute("aria-disabled")), t ? this.containerElement.classList.add("ui-switch--checked") : this.containerElement.classList.remove("ui-switch--checked"), this.containerElement.classList.remove("ui-switch--sm", "ui-switch--md", "ui-switch--lg"), ["sm", "md", "lg"].includes(a) ? this.containerElement.classList.add(`ui-switch--${a}`) : this.containerElement.classList.add("ui-switch--md"), o === "esquerda" ? this.containerElement.classList.add("ui-switch--label-esquerda") : this.containerElement.classList.remove("ui-switch--label-esquerda"), r ? (this.labelElement.textContent = r, this.labelElement.style.display = "inline") : this.labelElement.style.display = "none", t ? this.internals.setFormValue(this.getAttribute("value") || "on") : this.internals.setFormValue(null), this.atualizarValidade();
  }
  // === Ciclo de Vida Form-Associated Custom Elements (W3C FACE) ===
  formDisabledCallback(t) {
    this._formDisabled = t, this.syncState();
  }
  formResetCallback() {
    this.ativo = this._defaultChecked, this.syncState();
  }
  formStateRestoreCallback(t, e) {
    typeof t == "string" ? this.ativo = t === (this.getAttribute("value") || "on") : typeof t == "boolean" && (this.ativo = t), this.syncState();
  }
}
i(m, "formAssociated", !0);
class q extends m {
}
c("ui-switch", m);
c("ui-toggle", q);
export {
  A,
  y as L,
  l as R,
  f as U,
  k as a,
  b,
  g as c,
  S as d,
  m as e,
  q as f,
  V as g,
  E as h,
  p as r
};
