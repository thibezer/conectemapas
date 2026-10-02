var h = Object.defineProperty;
var m = (r, o, t) => o in r ? h(r, o, { enumerable: !0, configurable: !0, writable: !0, value: t }) : r[o] = t;
var i = (r, o, t) => m(r, typeof o != "symbol" ? o + "" : o, t);
import { L as f } from "./listener-bag-DQgv7OON.js";
import { d as c, S as p } from "./ssr-safe-5cWfJP-s.js";
const b = ':host{display:block;box-sizing:border-box;font-family:var(--ui-fonte-base, "Inter", sans-serif)}.ui-alerta{display:flex;align-items:flex-start;gap:12px;padding:12px 16px;border-radius:var(--ui-raio-borda, 8px);border:1px solid transparent;background-color:var(--ui-cor-fundo-elevado, #1a1a1e);color:var(--ui-cor-texto, #e1e1e6);box-sizing:border-box;position:relative;transition:opacity .2s ease,transform .2s ease;line-height:1.4}.ui-alerta__icone{display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;line-height:1}.ui-alerta__icone svg,.ui-alerta__icone ::slotted(svg),.ui-alerta__icone ::slotted(ui-icone){shape-rendering:geometricPrecision}.ui-alerta__conteudo{flex:1}.ui-alerta__titulo{font-size:14px;font-weight:600;margin:0 0 2px;line-height:1.2}.ui-alerta__mensagem{font-size:13px;margin:0;opacity:.9}.ui-alerta__close{background:transparent;border:none;color:currentColor;opacity:.7;font-size:14px;cursor:pointer;padding:2px 6px;border-radius:4px;line-height:1;flex-shrink:0;margin-top:-2px;margin-right:-4px;transition:opacity .15s ease,background-color .15s ease}.ui-alerta__close:hover{opacity:1;background-color:#ffffff26}.ui-alerta--sucesso{background-color:#00e08a1f;border-color:#00e08a4d;color:var(--ui-cor-texto-sucesso, #00E08A)}.ui-alerta--sucesso .ui-alerta__mensagem{color:var(--ui-cor-texto, #e1e1e6)}.ui-alerta--erro{background-color:#ff55551f;border-color:#ff55554d;color:var(--ui-cor-texto-erro, #ff5555)}.ui-alerta--erro .ui-alerta__mensagem{color:var(--ui-cor-texto, #e1e1e6)}.ui-alerta--alerta{background-color:#ffb86c1f;border-color:#ffb86c4d;color:var(--ui-cor-texto-alerta, #ffb86c)}.ui-alerta--alerta .ui-alerta__mensagem{color:var(--ui-cor-texto, #e1e1e6)}.ui-alerta--info{background-color:#00aaff1f;border-color:#00aaff4d;color:#0af}.ui-alerta--info .ui-alerta__mensagem{color:var(--ui-cor-texto, #e1e1e6)}.ui-alerta__acoes{display:flex;align-items:center;flex-shrink:0;margin-left:4px}.ui-alerta__botao-acao{background:#ffffff14;border:1px solid rgba(255,255,255,.16);color:inherit;font-family:inherit;font-size:12px;font-weight:600;padding:4px 10px;border-radius:5px;cursor:pointer;line-height:1;display:inline-flex;align-items:center;justify-content:center;white-space:nowrap;transition:background-color .15s ease,border-color .15s ease,transform .1s ease}.ui-alerta__botao-acao:hover{background:#ffffff2e;border-color:#ffffff4d}.ui-alerta__botao-acao:active{transform:scale(.96)}.ui-alerta__botao-acao:focus-visible{outline:none;box-shadow:0 0 0 2px var(--ui-cor-fundo, #0b0b0d),0 0 0 4px var(--ui-cor-primaria, #00E08A)}.ui-alerta__botao-acao--primario{background:#00e08a26;border-color:#00e08a59;color:var(--ui-cor-primaria, #00E08A)}.ui-alerta__botao-acao--primario:hover{background:#00e08a40;border-color:#00e08a80}.ui-alerta__botao-acao--destrutivo{background:#ff444426;border-color:#ff444459;color:var(--ui-cor-texto-erro, #ff5555)}.ui-alerta__botao-acao--destrutivo:hover{background:#ff444440;border-color:#ff444480}:host(ui-toast){display:block;width:100%;box-sizing:border-box;pointer-events:auto;transition:transform .25s cubic-bezier(.16,1,.3,1),opacity .25s ease}.ui-toast__banner{box-shadow:0 10px 32px #000000a6,0 0 0 1px #ffffff14;animation:ui-toast-slide .3s cubic-bezier(.16,1,.3,1);position:relative;overflow:hidden}.ui-toast__progresso{position:absolute;bottom:0;left:0;right:0;height:2px;background:#ffffff14;overflow:hidden}.ui-toast__progresso-barra{width:100%;height:100%;background:currentColor;opacity:.7;transform-origin:left;animation:ui-toast-timer linear forwards}:host(ui-toast:hover) .ui-toast__progresso-barra,:host(ui-toast:focus-within) .ui-toast__progresso-barra{animation-play-state:paused}@keyframes ui-toast-timer{0%{transform:scaleX(1)}to{transform:scaleX(0)}}@keyframes ui-toast-slide{0%{transform:translate(100%);opacity:0}to{transform:translate(0);opacity:1}}@starting-style{:host(ui-toast){opacity:0;transform:translateY(12px) scale(.96)}}', l = {
  sucesso: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
  erro: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
  alerta: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
  info: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
};
class u extends p {
  constructor() {
    super();
    i(this, "alertaElement");
    i(this, "iconeElement");
    i(this, "tituloElement");
    i(this, "mensagemElement");
    i(this, "mensagemTextoElement");
    i(this, "closeElement");
    i(this, "acoesElement");
    i(this, "botaoAcaoElement");
    i(this, "progressoContainer");
    i(this, "progressoBarra");
    i(this, "listeners", new f());
    const t = this.attachShadow({ mode: "open" });
    t.innerHTML = `
      <style>${b}</style>
      <div class="ui-alerta" role="alert">
        <span class="ui-alerta__icone"></span>
        <div class="ui-alerta__conteudo">
          <h4 class="ui-alerta__titulo" style="display: none;"></h4>
          <p class="ui-alerta__mensagem">
            <span class="ui-alerta__mensagem-texto" style="display: none;"></span>
            <slot></slot>
          </p>
        </div>
        <div class="ui-alerta__acoes" style="display: none;">
          <button type="button" class="ui-alerta__botao-acao"></button>
        </div>
        <button class="ui-alerta__close" type="button" aria-label="Fechar alerta" style="display: none;" title="Fechar">✕</button>
        <div class="ui-toast__progresso" style="display: none;">
          <div class="ui-toast__progresso-barra"></div>
        </div>
      </div>
    `, this.alertaElement = t.querySelector(".ui-alerta"), this.iconeElement = t.querySelector(".ui-alerta__icone"), this.tituloElement = t.querySelector(".ui-alerta__titulo"), this.mensagemElement = t.querySelector(".ui-alerta__mensagem"), this.mensagemTextoElement = t.querySelector(".ui-alerta__mensagem-texto"), this.closeElement = t.querySelector(".ui-alerta__close"), this.acoesElement = t.querySelector(".ui-alerta__acoes"), this.botaoAcaoElement = t.querySelector(".ui-alerta__botao-acao"), this.progressoContainer = t.querySelector(".ui-toast__progresso"), this.progressoBarra = t.querySelector(".ui-toast__progresso-barra");
  }
  static get observedAttributes() {
    return [
      "tipo",
      "variante",
      "variant",
      "titulo",
      "title",
      "mensagem",
      "fechavel",
      "dismissible"
    ];
  }
  connectedCallback() {
    this.listeners.cleanup(), this.listeners.add(this.closeElement, "click", () => this.fechar()), this.syncState();
  }
  disconnectedCallback() {
    this.listeners.cleanup();
  }
  attributeChangedCallback(t, a, e) {
    this.syncState();
  }
  fechar() {
    this.dispatchEvent(
      new CustomEvent("ui-fechar", {
        bubbles: !0,
        composed: !0
      })
    ), this.remove();
  }
  syncState() {
    const t = this.getAttribute("tipo") || this.getAttribute("variante") || this.getAttribute("variant") || "info", a = this.getAttribute("titulo") || this.getAttribute("title"), e = this.getAttribute("mensagem"), s = this.hasAttribute("fechavel") || this.hasAttribute("dismissible");
    this.alertaElement.className = `ui-alerta ui-alerta--${t}`;
    const d = l[t] || l.info;
    this.iconeElement.innerHTML = d, a ? (this.tituloElement.textContent = a, this.tituloElement.style.display = "block") : (this.tituloElement.style.display = "none", this.tituloElement.textContent = ""), e ? (this.mensagemTextoElement.textContent = e, this.mensagemTextoElement.style.display = "inline") : (this.mensagemTextoElement.style.display = "none", this.mensagemTextoElement.textContent = ""), s ? this.closeElement.style.display = "block" : this.closeElement.style.display = "none";
  }
}
c("ui-alerta", u);
class n extends u {
  constructor() {
    super(...arguments);
    i(this, "timerId", null);
    i(this, "tempoRestante", 4e3);
    i(this, "inicioTimestamp", 0);
    i(this, "isPausado", !1);
    i(this, "acaoConfig");
    i(this, "containerRef", null);
    i(this, "handleAcaoClick", (t) => {
      var a, e, s;
      t.stopPropagation(), (a = this.acaoConfig) != null && a.onClick && this.acaoConfig.onClick(t), this.dispatchEvent(
        new CustomEvent("ui-toast-acao", {
          detail: {
            rotulo: (e = this.acaoConfig) == null ? void 0 : e.rotulo,
            tipo: (s = this.acaoConfig) == null ? void 0 : s.tipo
          },
          bubbles: !0,
          composed: !0
        })
      ), this.fechar();
    });
    i(this, "pausarTimer", () => {
      if (this.isPausado || this.tempoRestante <= 0) return;
      this.isPausado = !0, this.timerId && (clearTimeout(this.timerId), this.timerId = null);
      const t = Date.now() - this.inicioTimestamp;
      this.tempoRestante = Math.max(0, this.tempoRestante - t), this.progressoBarra.style.animationPlayState = "paused";
    });
    i(this, "retomarTimer", () => {
      !this.isPausado || this.tempoRestante <= 0 || (this.isPausado = !1, this.progressoBarra.style.animationPlayState = "running", this.iniciarTimer(Math.max(this.tempoRestante, 300)));
    });
  }
  configurarAcao(t) {
    this.acaoConfig = t, this.botaoAcaoElement.textContent = t.rotulo, this.acoesElement.style.display = "flex";
    const a = t.tipo || "primario";
    this.botaoAcaoElement.className = `ui-alerta__botao-acao ui-alerta__botao-acao--${a}`;
  }
  connectedCallback() {
    super.connectedCallback(), this.containerRef = this.parentElement, this.alertaElement.classList.add("ui-toast__banner"), this.acaoConfig && this.listeners.add(this.botaoAcaoElement, "click", this.handleAcaoClick);
    const t = this.getAttribute("duracao") || this.getAttribute("duration") || "4000", a = parseInt(t, 10);
    this.tempoRestante = isNaN(a) ? 4e3 : a, this.tempoRestante > 0 ? (this.progressoContainer.style.display = "block", this.progressoBarra.style.animationDuration = `${this.tempoRestante}ms`, this.getAttribute("pausar-no-hover") !== "false" && (this.listeners.add(this, "mouseenter", this.pausarTimer), this.listeners.add(this, "mouseleave", this.retomarTimer), this.listeners.add(this, "focusin", this.pausarTimer), this.listeners.add(this, "focusout", this.retomarTimer)), this.iniciarTimer(this.tempoRestante)) : this.progressoContainer.style.display = "none";
  }
  fechar() {
    const t = this.parentElement || this.containerRef;
    super.fechar(), t && t.id.startsWith("ui-toast-container-") && t.children.length === 0 && t.remove();
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this.timerId && (clearTimeout(this.timerId), this.timerId = null), this.containerRef && this.containerRef.id.startsWith("ui-toast-container-") && this.containerRef.children.length === 0 && (this.containerRef.remove(), this.containerRef = null);
  }
  iniciarTimer(t) {
    this.timerId && clearTimeout(this.timerId), this.inicioTimestamp = Date.now(), this.timerId = setTimeout(() => {
      this.fechar();
    }, t);
  }
  static obterContainer(t) {
    const a = `ui-toast-container-${t}`;
    let e = document.getElementById(a);
    return e || (e = document.createElement("div"), e.id = a, e.style.position = "fixed", e.style.zIndex = "10000", e.style.display = "flex", e.style.gap = "10px", e.style.maxWidth = "400px", e.style.width = "calc(100vw - 32px)", e.style.pointerEvents = "none", e.style.boxSizing = "border-box", e.style.transition = "all 0.2s ease", t === "top-right" ? (e.style.top = "20px", e.style.right = "20px", e.style.flexDirection = "column") : t === "top-left" ? (e.style.top = "20px", e.style.left = "20px", e.style.flexDirection = "column") : t === "bottom-left" ? (e.style.bottom = "20px", e.style.left = "20px", e.style.flexDirection = "column-reverse") : t === "top-center" ? (e.style.top = "20px", e.style.left = "50%", e.style.transform = "translateX(-50%)", e.style.flexDirection = "column") : t === "bottom-center" ? (e.style.bottom = "20px", e.style.left = "50%", e.style.transform = "translateX(-50%)", e.style.flexDirection = "column-reverse") : (e.style.bottom = "20px", e.style.right = "20px", e.style.flexDirection = "column-reverse"), document.body.appendChild(e)), e;
  }
  // Utilitário estático para disparo imperativo de Toasts de qualquer lugar no código
  static notificar(t) {
    if (typeof document > "u") return null;
    const a = t.posicao || "bottom-right", e = document.createElement("ui-toast");
    return t.tipo && e.setAttribute("tipo", t.tipo), t.titulo && e.setAttribute("titulo", t.titulo), t.mensagem && e.setAttribute("mensagem", t.mensagem), t.duracao !== void 0 && e.setAttribute("duracao", String(t.duracao)), t.pausarNoHover === !1 && e.setAttribute("pausar-no-hover", "false"), e.setAttribute("posicao", a), t.fechavel !== !1 && e.setAttribute("fechavel", ""), t.acao && e.configurarAcao(t.acao), n.obterContainer(a).appendChild(e), e;
  }
}
c("ui-toast", n);
export {
  l as I,
  u as U,
  n as a
};
