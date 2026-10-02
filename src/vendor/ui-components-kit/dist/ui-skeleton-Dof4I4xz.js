var C = Object.defineProperty;
var S = (s, l, t) => l in s ? C(s, l, { enumerable: !0, configurable: !0, writable: !0, value: t }) : s[l] = t;
var n = (s, l, t) => S(s, typeof l != "symbol" ? l + "" : l, t);
import { L } from "./listener-bag-DQgv7OON.js";
import { d as h, S as x } from "./ssr-safe-5cWfJP-s.js";
const N = ':host{display:block;box-sizing:border-box;font-family:var(--ui-fonte-base, "Inter", sans-serif)}.ui-drawer__backdrop{position:fixed;top:0;left:0;width:100vw;height:100vh;background-color:#000000a6;-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);z-index:9998;opacity:0;pointer-events:none;transition:opacity .25s ease}:host([aberto]) .ui-drawer__backdrop,:host([open]) .ui-drawer__backdrop{opacity:1;pointer-events:auto}.ui-drawer__painel{position:fixed;z-index:9999;background-color:var(--ui-cor-fundo-card, #18181c);border:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .12));box-shadow:0 16px 40px #000000b3;display:flex;flex-direction:column;opacity:0;visibility:hidden;pointer-events:none;transition:transform .25s cubic-bezier(.16,1,.3,1),opacity .2s ease,visibility .2s ease;box-sizing:border-box;color:var(--ui-cor-texto, #e1e1e6)}:root[data-tema=claro] .ui-drawer__painel,[data-tema=claro] .ui-drawer__painel{background-color:#fff;border-color:#0000001f;box-shadow:0 12px 32px #00000026;color:#1a1a1e}:host(:not([posicao])) .ui-drawer__painel,:host([posicao="direita"]) .ui-drawer__painel,:host([position="right"]) .ui-drawer__painel{top:0;right:0;bottom:0;width:var(--ui-drawer-largura, 480px);max-width:92vw;height:100vh;transform:translate(100%);border-left:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .16))}:host([aberto]:not([posicao])) .ui-drawer__painel,:host([open]:not([posicao])) .ui-drawer__painel,:host([aberto][posicao="direita"]) .ui-drawer__painel,:host([open][posicao="direita"]) .ui-drawer__painel,:host([aberto][position="right"]) .ui-drawer__painel,:host([open][position="right"]) .ui-drawer__painel{transform:translate(0);opacity:1;visibility:visible;pointer-events:auto}:host([posicao="esquerda"]) .ui-drawer__painel,:host([position="left"]) .ui-drawer__painel{top:0;left:0;bottom:0;width:var(--ui-drawer-largura, 480px);max-width:92vw;height:100vh;transform:translate(-100%);border-right:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .16))}:host([aberto][posicao="esquerda"]) .ui-drawer__painel,:host([open][posicao="esquerda"]) .ui-drawer__painel,:host([aberto][position="left"]) .ui-drawer__painel,:host([open][position="left"]) .ui-drawer__painel{transform:translate(0);opacity:1;visibility:visible;pointer-events:auto}:host([posicao="baixo"]) .ui-drawer__painel,:host([position="bottom"]) .ui-drawer__painel{bottom:0;left:0;right:0;width:100vw;max-height:85vh;transform:translateY(100%);border-top:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .16));border-top-left-radius:14px;border-top-right-radius:14px}:host([aberto][posicao="baixo"]) .ui-drawer__painel,:host([open][posicao="baixo"]) .ui-drawer__painel,:host([aberto][position="bottom"]) .ui-drawer__painel,:host([open][position="bottom"]) .ui-drawer__painel{transform:translateY(0);opacity:1;visibility:visible;pointer-events:auto}:host([posicao="cima"]) .ui-drawer__painel,:host([position="top"]) .ui-drawer__painel{top:0;left:0;right:0;width:100vw;max-height:85vh;transform:translateY(-100%);border-bottom:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .16));border-bottom-left-radius:14px;border-bottom-right-radius:14px}:host([aberto][posicao="cima"]) .ui-drawer__painel,:host([open][posicao="cima"]) .ui-drawer__painel,:host([aberto][position="top"]) .ui-drawer__painel,:host([open][position="top"]) .ui-drawer__painel{transform:translateY(0);opacity:1;visibility:visible;pointer-events:auto}.ui-drawer__header{padding:16px 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .08));flex-shrink:0}:root[data-tema=claro] .ui-drawer__header,[data-tema=claro] .ui-drawer__header{border-bottom-color:#00000014}.ui-drawer__titulo-container{display:flex;flex-direction:column;gap:2px}.ui-drawer__titulo{margin:0;font-size:16px;font-weight:600;color:var(--ui-cor-texto, #ffffff)}:root[data-tema=claro] .ui-drawer__titulo,[data-tema=claro] .ui-drawer__titulo{color:#1a1a1e}.ui-drawer__descricao{margin:0;font-size:13px;color:var(--ui-cor-texto-secundario, #888899)}.ui-drawer__close{background:transparent;border:none;color:var(--ui-cor-texto-secundario, #888899);font-size:16px;cursor:pointer;padding:6px;border-radius:6px;line-height:1;display:flex;align-items:center;justify-content:center;transition:color .15s ease,background-color .15s ease}.ui-drawer__close svg,.ui-drawer__close ::slotted(svg){shape-rendering:geometricPrecision}.ui-drawer__close:hover{color:var(--ui-cor-texto, #ffffff);background-color:var(--ui-cor-hover-menu, rgba(255, 255, 255, .08))}.ui-drawer__close:focus-visible{outline:none;box-shadow:0 0 0 2px var(--ui-cor-primaria, #00E08A)}.ui-drawer__body{padding:20px;overflow-y:auto;flex:1;box-sizing:border-box}.ui-drawer__footer{padding:14px 20px;border-top:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .08));display:flex;align-items:center;justify-content:flex-end;gap:10px;background-color:#00000026;flex-shrink:0}:root[data-tema=claro] .ui-drawer__footer,[data-tema=claro] .ui-drawer__footer{border-top-color:#00000014;background-color:#00000008}@starting-style{:host([aberto]:not([posicao])) .ui-drawer__painel,:host([open]:not([posicao])) .ui-drawer__painel,:host([aberto][posicao="direita"]) .ui-drawer__painel,:host([open][posicao="direita"]) .ui-drawer__painel{transform:translate(100%);opacity:0}:host([aberto][posicao="esquerda"]) .ui-drawer__painel,:host([open][posicao="esquerda"]) .ui-drawer__painel{transform:translate(-100%);opacity:0}:host([aberto][posicao="baixo"]) .ui-drawer__painel,:host([open][posicao="baixo"]) .ui-drawer__painel{transform:translateY(100%);opacity:0}:host([aberto]) .ui-drawer__backdrop,:host([open]) .ui-drawer__backdrop{opacity:0}}', v = 'a[href], button, input, textarea, select, details, [tabindex]:not([tabindex="-1"]), ui-campo-texto, ui-botao, ui-botao-primario, ui-checkbox, ui-switch, ui-lista-flutuante, ui-radio, ui-select, ui-segmented';
function g(s, l) {
  let t = Array.from(s.querySelectorAll(v));
  t = t.filter((e) => {
    try {
      return window.getComputedStyle(e).display !== "none";
    } catch {
      return !0;
    }
  });
  const i = s.querySelectorAll("slot"), o = [];
  return i.forEach((e) => {
    e.assignedElements({ flatten: !0 }).forEach((r) => {
      r instanceof HTMLElement && (r.matches(v) && o.push(r), o.push(...Array.from(r.querySelectorAll(v))));
    });
  }), [...t, ...o].filter((e) => !e.hasAttribute("disabled") && e.getAttribute("aria-hidden") !== "true");
}
function q(s) {
  if (typeof document > "u") return !0;
  const l = Array.from(
    document.querySelectorAll("ui-drawer[aberto], ui-drawer[open], ui-sheet[aberto], ui-sheet[open]")
  );
  return l[l.length - 1] === s;
}
function M(s, l, t, i) {
  if (l.length === 0) {
    s.preventDefault();
    return;
  }
  const o = l[0], e = l[l.length - 1], a = t.getRootNode(), r = a == null ? void 0 : a.activeElement;
  s.shiftKey ? (r === o || !t.contains(r) && !i.contains(r)) && (s.preventDefault(), e.focus()) : (r === e || !t.contains(r) && !i.contains(r)) && (s.preventDefault(), o.focus());
}
function z() {
  if (typeof document > "u") return;
  document.querySelectorAll(
    "ui-modal[aberto], ui-modal[open], ui-dialog[aberto], ui-dialog[open], ui-drawer[aberto], ui-drawer[open], ui-sheet[aberto], ui-sheet[open]"
  ).length > 0 ? document.body.style.overflow = "hidden" : document.body.style.overflow = "";
}
class b extends x {
  constructor() {
    super();
    n(this, "backdropElement");
    n(this, "painelElement");
    n(this, "tituloElement");
    n(this, "descricaoElement");
    n(this, "closeElement");
    n(this, "listeners", new L());
    n(this, "_elementoGatilho", null);
    n(this, "_focables", []);
    n(this, "handleSlotChange", () => {
      this.syncState();
    });
    n(this, "handleBackdropClick", (t) => {
      t.stopPropagation(), this.hasAttribute("estatico") || this.hasAttribute("static") || this.fechar();
    });
    n(this, "handleCloseClick", (t) => {
      t.stopPropagation(), this.fechar();
    });
    n(this, "handleKeyDown", (t) => {
      this.aberto && q(this) && (t.key === "Escape" ? this.hasAttribute("estatico") || this.hasAttribute("static") || (this.fechar(), t.stopImmediatePropagation()) : t.key === "Tab" && (this._focables = g(this.shadowRoot), M(t, this._focables, this, this.shadowRoot)));
    });
    const t = this.attachShadow({ mode: "open" });
    t.innerHTML = `
      <style>${N}</style>
      <div class="ui-drawer__backdrop"></div>
      <aside class="ui-drawer__painel" role="dialog" aria-modal="true" tabindex="-1">
        <div class="ui-drawer__header">
          <div class="ui-drawer__titulo-container">
            <h3 class="ui-drawer__titulo"></h3>
            <p class="ui-drawer__descricao" style="display: none;"></p>
          </div>
          <button type="button" class="ui-drawer__close" aria-label="Fechar painel lateral" title="Fechar">✕</button>
        </div>
        <div class="ui-drawer__body">
          <slot></slot>
        </div>
        <div class="ui-drawer__footer">
          <slot name="rodape"></slot>
          <slot name="footer"></slot>
        </div>
      </aside>
    `, this.backdropElement = t.querySelector(".ui-drawer__backdrop"), this.painelElement = t.querySelector(".ui-drawer__painel"), this.tituloElement = t.querySelector(".ui-drawer__titulo"), this.descricaoElement = t.querySelector(".ui-drawer__descricao"), this.closeElement = t.querySelector(".ui-drawer__close");
  }
  static get observedAttributes() {
    return [
      "aberto",
      "open",
      "posicao",
      "position",
      "titulo",
      "title",
      "descricao",
      "description",
      "largura",
      "width",
      "estatico",
      "static"
    ];
  }
  connectedCallback() {
    this.listeners.cleanup(), this.listeners.add(this.backdropElement, "click", this.handleBackdropClick), this.listeners.add(this.closeElement, "click", this.handleCloseClick), this.listeners.add(window, "keydown", this.handleKeyDown), this.shadowRoot.querySelectorAll("slot").forEach((i) => {
      this.listeners.add(i, "slotchange", this.handleSlotChange);
    }), this.syncState();
  }
  disconnectedCallback() {
    this.listeners.cleanup(), b.atualizarScrollLock();
  }
  attributeChangedCallback(t, i, o) {
    (t === "aberto" || t === "open") && o !== null && (document.activeElement && document.activeElement !== document.body && (this._elementoGatilho = document.activeElement), setTimeout(() => {
      this._focables = g(this.shadowRoot), this._focables.length > 0 ? this._focables[0].focus() : this.painelElement.focus();
    }, 0)), this.syncState();
  }
  get aberto() {
    return this.hasAttribute("aberto") || this.hasAttribute("open");
  }
  set aberto(t) {
    t ? this.setAttribute("aberto", "") : (this.removeAttribute("aberto"), this.removeAttribute("open")), this.syncState();
  }
  get posicao() {
    const t = (this.getAttribute("posicao") || this.getAttribute("position") || "direita").toLowerCase();
    return t === "esquerda" || t === "left" ? "esquerda" : t === "baixo" || t === "bottom" ? "baixo" : t === "cima" || t === "top" ? "cima" : "direita";
  }
  set posicao(t) {
    this.setAttribute("posicao", t);
  }
  abrir() {
    this.aberto || (document.activeElement && document.activeElement !== document.body && (this._elementoGatilho = document.activeElement), this.aberto = !0, this.dispatchEvent(
      new CustomEvent("ui-abrir", {
        bubbles: !0,
        composed: !0
      })
    ), setTimeout(() => {
      this._focables = g(this.shadowRoot), this._focables.length > 0 ? this._focables[0].focus() : this.painelElement.focus();
    }, 0));
  }
  fechar() {
    this.aberto && (this.aberto = !1, this.dispatchEvent(
      new CustomEvent("ui-fechar", {
        bubbles: !0,
        composed: !0
      })
    ), this._elementoGatilho && (this._elementoGatilho.focus(), this._elementoGatilho = null));
  }
  alternar() {
    this.aberto ? this.fechar() : this.abrir();
  }
  syncState() {
    var r, d;
    const t = this.aberto, i = this.getAttribute("titulo") || this.getAttribute("title") || "", o = this.getAttribute("descricao") || this.getAttribute("description") || "", e = this.getAttribute("largura") || this.getAttribute("width"), a = (r = this.shadowRoot) == null ? void 0 : r.querySelector(".ui-drawer__footer");
    if (this.painelElement.setAttribute("aria-hidden", String(!t)), i ? (this.tituloElement.textContent = i, this.tituloElement.style.display = "block") : this.tituloElement.style.display = "none", o ? (this.descricaoElement.textContent = o, this.descricaoElement.style.display = "block") : this.descricaoElement.style.display = "none", e ? this.style.setProperty("--ui-drawer-largura", isNaN(Number(e)) ? e : `${e}px`) : this.style.removeProperty("--ui-drawer-largura"), a) {
      const u = Array.from(((d = this.shadowRoot) == null ? void 0 : d.querySelectorAll('slot[name="rodape"], slot[name="footer"]')) || []).some((p) => p.assignedNodes({ flatten: !0 }).some((f) => f.nodeType === Node.ELEMENT_NODE || f.textContent && f.textContent.trim() !== "")) || this.querySelector('[slot="rodape"], [slot="footer"]') !== null;
      a.style.display = u ? "flex" : "none";
    }
    b.atualizarScrollLock();
  }
  static atualizarScrollLock() {
    z();
  }
}
class $ extends b {
}
class T extends b {
}
class R extends b {
}
h("ui-drawer", b);
h("ui-sheet", $);
h("ui-painel-lateral", T);
h("ui-gaveta", R);
const P = ":host{display:inline-flex;position:relative;align-items:center;justify-content:center;vertical-align:middle;box-sizing:border-box;--ui-tooltip-texto-distancia: 260px;--ui-tooltip-seta-espaco: 70px}.ui-tooltip__bubble{position:fixed;z-index:10001;padding:6px 10px;border-radius:6px;font-size:11px;font-weight:500;background-color:var(--ui-cor-fundo-elevado, #1e1e24);color:var(--ui-cor-texto, #e1e1e6);border:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .16));box-shadow:0 4px 16px #00000080;white-space:normal;max-width:var(--ui-tooltip-texto-distancia, 260px);width:max-content;opacity:0;visibility:hidden;pointer-events:none;transition:opacity .15s ease,visibility .15s ease;line-height:1.35;box-sizing:border-box;-webkit-user-select:none;user-select:none;margin:0}.ui-tooltip__bubble[popover]{margin:0;border:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .16));background-color:var(--ui-cor-fundo-elevado, #1e1e24);color:var(--ui-cor-texto, #e1e1e6);padding:6px 10px;overflow:visible;max-width:var(--ui-tooltip-texto-distancia, 260px);width:max-content;white-space:normal}.ui-tooltip__texto{display:inline-block;max-width:100%}.ui-tooltip__arrow{position:absolute;width:0;height:0;border-style:solid}.ui-tooltip--topo .ui-tooltip__arrow{bottom:-5px;left:50%;transform:translate(-50%);border-width:5px 5px 0 5px;border-color:var(--ui-cor-fundo-elevado, #1e1e24) transparent transparent transparent}.ui-tooltip--baixo .ui-tooltip__arrow{top:-5px;left:50%;transform:translate(-50%);border-width:0 5px 5px 5px;border-color:transparent transparent var(--ui-cor-fundo-elevado, #1e1e24) transparent}.ui-tooltip--esquerda .ui-tooltip__arrow{right:-5px;top:50%;transform:translateY(-50%);border-width:5px 0 5px 5px;border-color:transparent transparent transparent var(--ui-cor-fundo-elevado, #1e1e24)}.ui-tooltip--direita .ui-tooltip__arrow{left:-5px;top:50%;transform:translateY(-50%);border-width:5px 5px 5px 0;border-color:transparent var(--ui-cor-fundo-elevado, #1e1e24) transparent transparent}.ui-tooltip--visivel .ui-tooltip__bubble{opacity:1;visibility:visible;pointer-events:auto;transform:scale(1)}@starting-style{.ui-tooltip--visivel .ui-tooltip__bubble,.ui-tooltip__bubble:popover-open{opacity:0;transform:scale(.94)}}";
class E extends x {
  constructor() {
    super();
    n(this, "containerElement");
    n(this, "bubbleElement");
    n(this, "_posicionamentoAtivo", !1);
    n(this, "posicionarBubble", () => {
      if (!this.aberto) return;
      const t = this.getBoundingClientRect(), i = this.bubbleElement.getBoundingClientRect(), o = this.getAttribute("posicao") || this.getAttribute("position") || "topo";
      let e = "topo";
      ["topo", "top"].includes(o) ? e = "topo" : ["baixo", "bottom"].includes(o) ? e = "baixo" : ["esquerda", "left"].includes(o) ? e = "esquerda" : ["direita", "right"].includes(o) && (e = "direita");
      let a = 0, r = 0;
      const d = 8;
      e === "topo" ? (a = t.top - i.height - d, r = t.left + t.width / 2 - i.width / 2) : e === "baixo" ? (a = t.bottom + d, r = t.left + t.width / 2 - i.width / 2) : e === "esquerda" ? (a = t.top + t.height / 2 - i.height / 2, r = t.left - i.width - d) : e === "direita" && (a = t.top + t.height / 2 - i.height / 2, r = t.right + d), r = Math.max(8, Math.min(r, window.innerWidth - i.width - 8)), a = Math.max(8, Math.min(a, window.innerHeight - i.height - 8)), this.bubbleElement.style.top = `${Math.round(a)}px`, this.bubbleElement.style.left = `${Math.round(r)}px`;
    });
    n(this, "handleMouseEnter", () => {
      const t = this.getAttribute("gatilho") || this.getAttribute("trigger") || "hover";
      (t === "hover" || t === "passar-mouse") && this.mostrar();
    });
    n(this, "handleMouseLeave", () => {
      const t = this.getAttribute("gatilho") || this.getAttribute("trigger") || "hover";
      (t === "hover" || t === "passar-mouse") && this.ocultar();
    });
    n(this, "handleClick", (t) => {
      const i = this.getAttribute("gatilho") || this.getAttribute("trigger") || "hover", o = window.matchMedia("(pointer: coarse)").matches;
      (i === "clique" || i === "click" || o) && (t.stopPropagation(), this.aberto = !this.aberto);
    });
    n(this, "handleClickOutside", (t) => {
      t.composedPath().includes(this) || this.ocultar();
    });
    const t = this.attachShadow({ mode: "open" });
    t.innerHTML = `
      <style>${P}</style>
      <div class="ui-tooltip ui-tooltip--topo">
        <slot></slot>
        <div class="ui-tooltip__bubble" role="tooltip" popover="manual">
          <span class="ui-tooltip__texto"></span>
          <slot name="conteudo"></slot>
          <span class="ui-tooltip__arrow"></span>
        </div>
      </div>
    `, this.containerElement = t.querySelector(".ui-tooltip"), this.bubbleElement = t.querySelector(".ui-tooltip__bubble");
  }
  static get observedAttributes() {
    return [
      "texto",
      "text",
      "posicao",
      "position",
      "gatilho",
      "trigger",
      "aberto",
      "open",
      "disabled"
    ];
  }
  connectedCallback() {
    this.addEventListener("mouseenter", this.handleMouseEnter), this.addEventListener("mouseleave", this.handleMouseLeave), this.addEventListener("focusin", this.handleMouseEnter), this.addEventListener("focusout", this.handleMouseLeave), this.addEventListener("click", this.handleClick), this.syncState();
  }
  disconnectedCallback() {
    this.removeEventListener("mouseenter", this.handleMouseEnter), this.removeEventListener("mouseleave", this.handleMouseLeave), this.removeEventListener("focusin", this.handleMouseEnter), this.removeEventListener("focusout", this.handleMouseLeave), this.removeEventListener("click", this.handleClick), document.removeEventListener("click", this.handleClickOutside), this._posicionamentoAtivo && (this._posicionamentoAtivo = !1, window.removeEventListener("scroll", this.posicionarBubble, { capture: !0 }), window.removeEventListener("resize", this.posicionarBubble)), this.ocultar();
  }
  attributeChangedCallback(t, i, o) {
    this.syncState();
  }
  get aberto() {
    return this.hasAttribute("aberto") || this.hasAttribute("open");
  }
  set aberto(t) {
    t ? this.setAttribute("aberto", "") : (this.removeAttribute("aberto"), this.removeAttribute("open")), this.syncState();
  }
  get disabled() {
    return this.hasAttribute("disabled");
  }
  set disabled(t) {
    t ? this.setAttribute("disabled", "") : this.removeAttribute("disabled"), this.syncState();
  }
  mostrar() {
    this.disabled || (this.aberto = !0);
  }
  ocultar() {
    this.aberto = !1;
  }
  syncState() {
    var r;
    const t = this.aberto, i = this.getAttribute("posicao") || this.getAttribute("position") || "topo", o = this.getAttribute("texto") || this.getAttribute("text") || "", e = (r = this.shadowRoot) == null ? void 0 : r.querySelector(".ui-tooltip__texto");
    let a = "topo";
    if (["topo", "top"].includes(i) ? a = "topo" : ["baixo", "bottom"].includes(i) ? a = "baixo" : ["esquerda", "left"].includes(i) ? a = "esquerda" : ["direita", "right"].includes(i) && (a = "direita"), this.containerElement.className = `ui-tooltip ui-tooltip--${a}`, e && (o ? (e.textContent = o, e.style.display = "inline") : e.style.display = "none"), t) {
      if (document.addEventListener("click", this.handleClickOutside), typeof this.bubbleElement.showPopover == "function")
        try {
          this.bubbleElement.showPopover();
        } catch {
        }
      this.containerElement.classList.add("ui-tooltip--visivel"), requestAnimationFrame(() => {
        this.posicionarBubble();
      }), this._posicionamentoAtivo || (this._posicionamentoAtivo = !0, window.addEventListener("scroll", this.posicionarBubble, { capture: !0, passive: !0 }), window.addEventListener("resize", this.posicionarBubble, { passive: !0 }));
    } else {
      if (document.removeEventListener("click", this.handleClickOutside), typeof this.bubbleElement.hidePopover == "function")
        try {
          this.bubbleElement.hidePopover();
        } catch {
        }
      this.containerElement.classList.remove("ui-tooltip--visivel"), this._posicionamentoAtivo && (this._posicionamentoAtivo = !1, window.removeEventListener("scroll", this.posicionarBubble, { capture: !0 }), window.removeEventListener("resize", this.posicionarBubble));
    }
  }
}
class B extends E {
}
h("ui-tooltip", E);
h("ui-popover", B);
const F = ":host{display:block;box-sizing:border-box}:host([inline]){display:inline-block}.ui-skeleton{background:var(--ui-cor-fundo-elevado, #1e1e24);background-image:linear-gradient(90deg,#fff0,#ffffff12,#fff0);background-size:200% 100%;background-repeat:no-repeat;border-radius:var(--ui-raio-borda, 6px);position:relative;overflow:hidden;box-sizing:border-box;animation:ui-skeleton-shimmer 1.6s ease-in-out infinite}:root[data-tema=claro] .ui-skeleton,[data-tema=claro] .ui-skeleton{background:var(--ui-cor-fundo-elevado, #e9ecef);background-image:linear-gradient(90deg,#0000,#0000000f,#0000)}@keyframes ui-skeleton-shimmer{0%{background-position:-200% 0}to{background-position:200% 0}}.ui-skeleton--pulso{background-image:none;animation:ui-skeleton-pulse 1.8s ease-in-out infinite}@keyframes ui-skeleton-pulse{0%,to{opacity:1}50%{opacity:.45}}.ui-skeleton--estatico{animation:none;background-image:none}.ui-skeleton--texto{height:1.1em;border-radius:4px}.ui-skeleton--circular{border-radius:50%!important;aspect-ratio:1;width:var(--ui-skeleton-largura, 40px);height:var(--ui-skeleton-altura, 40px)}.ui-skeleton--retangular{border-radius:var(--ui-raio-borda, 6px);min-height:20px}.ui-skeleton__linhas{display:flex;flex-direction:column;gap:8px;width:100%}.ui-skeleton__linhas .ui-skeleton{width:100%}.ui-skeleton__linhas .ui-skeleton:last-child:not(:first-child){width:65%}.ui-skeleton--card{display:flex;flex-direction:column;gap:12px;padding:16px;border-radius:var(--ui-raio-borda, 10px);border:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .08));background:var(--ui-cor-fundo-card, #18181c);animation:none}.ui-skeleton__card-media{width:100%;height:120px;border-radius:6px}.ui-skeleton__card-header{display:flex;align-items:center;gap:10px}.ui-skeleton__card-avatar{width:36px;height:36px;border-radius:50%;flex-shrink:0}.ui-skeleton__card-title{width:50%;height:16px}@media (prefers-reduced-motion: reduce){.ui-skeleton{animation:none!important;background-image:none!important;opacity:.7}}";
class A extends x {
  constructor() {
    super();
    n(this, "rootElement");
    const t = this.attachShadow({ mode: "open" });
    t.innerHTML = `
      <style>${F}</style>
      <div class="ui-skeleton-container" role="status" aria-label="Carregando..."></div>
    `, this.rootElement = t.querySelector(".ui-skeleton-container");
  }
  static get observedAttributes() {
    return [
      "variante",
      "variant",
      "largura",
      "width",
      "altura",
      "height",
      "raio",
      "radius",
      "linhas",
      "lines",
      "count",
      "animado",
      "animated"
    ];
  }
  connectedCallback() {
    this.hasAttribute("aria-hidden") || this.setAttribute("aria-hidden", "true"), this.syncState();
  }
  attributeChangedCallback(t, i, o) {
    this.syncState();
  }
  get variante() {
    const t = (this.getAttribute("variante") || this.getAttribute("variant") || "texto").toLowerCase();
    return t === "circulo" || t === "circular" ? "circular" : t === "retangulo" || t === "retangular" ? "retangular" : t === "card" ? "card" : "texto";
  }
  set variante(t) {
    this.setAttribute("variante", t);
  }
  get animado() {
    const t = (this.getAttribute("animado") || this.getAttribute("animated") || "shimmer").toLowerCase();
    return t === "pulse" || t === "pulso" ? "pulso" : t === "none" || t === "nenhum" || t === "estatico" ? "nenhum" : "shimmer";
  }
  set animado(t) {
    this.setAttribute("animado", t);
  }
  get linhas() {
    const t = parseInt(this.getAttribute("linhas") || this.getAttribute("lines") || this.getAttribute("count") || "1", 10);
    return isNaN(t) || t < 1 ? 1 : t;
  }
  set linhas(t) {
    this.setAttribute("linhas", String(t));
  }
  syncState() {
    const t = this.variante, i = this.animado, o = this.getAttribute("largura") || this.getAttribute("width"), e = this.getAttribute("altura") || this.getAttribute("height"), a = this.getAttribute("raio") || this.getAttribute("radius"), r = this.linhas;
    this.rootElement.innerHTML = "";
    const d = i === "pulso" ? "ui-skeleton--pulso" : i === "nenhum" ? "ui-skeleton--estatico" : "";
    if (t === "card") {
      const u = document.createElement("div");
      u.className = "ui-skeleton ui-skeleton--card";
      const p = document.createElement("div");
      p.className = `ui-skeleton ui-skeleton__card-media ${d}`;
      const c = document.createElement("div");
      c.className = "ui-skeleton__card-header";
      const f = document.createElement("div");
      f.className = `ui-skeleton ui-skeleton__card-avatar ${d}`;
      const w = document.createElement("div");
      w.className = `ui-skeleton ui-skeleton__card-title ${d}`, c.appendChild(f), c.appendChild(w);
      const _ = document.createElement("div");
      _.className = "ui-skeleton__linhas";
      for (let y = 0; y < 2; y++) {
        const k = document.createElement("div");
        k.className = `ui-skeleton ui-skeleton--texto ${d}`, _.appendChild(k);
      }
      u.appendChild(p), u.appendChild(c), u.appendChild(_), this.rootElement.appendChild(u);
      return;
    }
    if (r > 1 && t === "texto") {
      const u = document.createElement("div");
      u.className = "ui-skeleton__linhas";
      for (let p = 0; p < r; p++) {
        const c = document.createElement("div");
        c.className = `ui-skeleton ui-skeleton--texto ${d}`, e && (c.style.height = isNaN(Number(e)) ? e : `${e}px`), a && (c.style.borderRadius = isNaN(Number(a)) ? a : `${a}px`), u.appendChild(c);
      }
      o && (u.style.width = isNaN(Number(o)) ? o : `${o}px`), this.rootElement.appendChild(u);
      return;
    }
    const m = document.createElement("div");
    m.className = `ui-skeleton ui-skeleton--${t} ${d}`.trim(), o && (m.style.width = isNaN(Number(o)) ? o : `${o}px`), e && (m.style.height = isNaN(Number(e)) ? e : `${e}px`), a && (m.style.borderRadius = isNaN(Number(a)) ? a : `${a}px`), this.rootElement.appendChild(m);
  }
}
class I extends A {
}
h("ui-skeleton", A);
h("ui-esqueleto", I);
export {
  b as U,
  I as a,
  R as b,
  T as c,
  B as d,
  $ as e,
  A as f,
  E as g,
  z as h,
  M as i,
  q as j,
  g as o
};
