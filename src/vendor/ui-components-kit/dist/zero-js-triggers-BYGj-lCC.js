var w = Object.defineProperty;
var v = (f, e, t) => e in f ? w(f, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : f[e] = t;
var g = (f, e, t) => v(f, typeof e != "symbol" ? e + "" : e, t);
import { a as A } from "./ui-toast-3t4yHnGr.js";
class E {
  constructor() {
    g(this, "listeners", /* @__PURE__ */ new Map());
  }
  on(e, t) {
    return this.listeners.has(e) || this.listeners.set(e, /* @__PURE__ */ new Set()), this.listeners.get(e).add(t), () => this.off(e, t);
  }
  once(e, t) {
    const r = (n) => {
      this.off(e, r), t(n);
    };
    this.on(e, r);
  }
  off(e, t) {
    const r = this.listeners.get(e);
    r && (r.delete(t), r.size === 0 && this.listeners.delete(e));
  }
  emit(e, t) {
    const r = this.listeners.get(e);
    r && r.forEach((n) => {
      try {
        n(t);
      } catch (c) {
        console.error(`[UIBus] Erro ao executar ouvinte do evento "${e}":`, c);
      }
    }), typeof window < "u" && window.dispatchEvent(
      new CustomEvent(`uibus:${e}`, {
        detail: t,
        bubbles: !0,
        composed: !0
      })
    );
  }
  /* ====================================================
     Métodos de Atalho e Ações de Alta Produtividade
     ==================================================== */
  /**
   * Abre um modal pelo seu ID no documento.
   */
  abrirModal(e) {
    if (typeof document > "u") return !1;
    const t = document.getElementById(e);
    return t && typeof t.abrir == "function" ? (t.abrir(), this.emit("modal:aberto", { id: e }), !0) : t ? (t.setAttribute("aberto", ""), this.emit("modal:aberto", { id: e }), !0) : (console.warn(`[UIBus] Modal com ID "${e}" não encontrado no DOM.`), !1);
  }
  /**
   * Fecha um modal pelo seu ID ou todos os modais abertos se nenhum ID for passado.
   */
  fecharModal(e) {
    if (typeof document > "u") return !1;
    if (e) {
      const t = document.getElementById(e);
      return t && typeof t.fechar == "function" ? (t.fechar(), this.emit("modal:fechado", { id: e }), !0) : t ? (t.removeAttribute("aberto"), t.removeAttribute("open"), this.emit("modal:fechado", { id: e }), !0) : !1;
    } else
      return document.querySelectorAll(
        "ui-modal[aberto], ui-modal[open], ui-dialog[aberto], ui-dialog[open]"
      ).forEach((r) => {
        typeof r.fechar == "function" ? r.fechar() : (r.removeAttribute("aberto"), r.removeAttribute("open"));
      }), this.emit("modal:fechado-todos"), !0;
  }
  /**
   * Abre um painel lateral (drawer / sheet) pelo seu ID no documento.
   */
  abrirDrawer(e) {
    if (typeof document > "u") return !1;
    const t = document.getElementById(e);
    return t && typeof t.abrir == "function" ? (t.abrir(), this.emit("drawer:aberto", { id: e }), !0) : t ? (t.setAttribute("aberto", ""), this.emit("drawer:aberto", { id: e }), !0) : (console.warn(`[UIBus] Drawer com ID "${e}" não encontrado no DOM.`), !1);
  }
  /**
   * Fecha um painel lateral (drawer / sheet) pelo seu ID ou todos se nenhum for passado.
   */
  fecharDrawer(e) {
    if (typeof document > "u") return !1;
    if (e) {
      const t = document.getElementById(e);
      return t && typeof t.fechar == "function" ? (t.fechar(), this.emit("drawer:fechado", { id: e }), !0) : t ? (t.removeAttribute("aberto"), t.removeAttribute("open"), this.emit("drawer:fechado", { id: e }), !0) : !1;
    } else
      return document.querySelectorAll(
        "ui-drawer[aberto], ui-drawer[open], ui-sheet[aberto], ui-sheet[open]"
      ).forEach((r) => {
        typeof r.fechar == "function" ? r.fechar() : (r.removeAttribute("aberto"), r.removeAttribute("open"));
      }), this.emit("drawer:fechado-todos"), !0;
  }
  /**
   * Dispara uma notificação toast flutuante inteligente.
   */
  notificar(e) {
    typeof e == "string" ? A.notificar({ mensagem: e, tipo: "info" }) : A.notificar(e);
  }
  /**
   * Copia um texto para a área de transferência do usuário e exibe feedback opcional.
   */
  async copiar(e, t) {
    if (typeof navigator > "u" || !navigator.clipboard)
      return !1;
    try {
      return await navigator.clipboard.writeText(e), t !== void 0 && this.notificar({
        tipo: "sucesso",
        mensagem: t || "Copiado para a área de transferência!"
      }), this.emit("clipboard:copiado", { texto: e }), !0;
    } catch (r) {
      return console.error("[UIBus] Falha ao copiar texto:", r), this.notificar({
        tipo: "erro",
        mensagem: "Não foi possível copiar o texto."
      }), !1;
    }
  }
  /**
   * Altera a densidade visual global do kit (compacta, normal ou relaxada).
   */
  definirDensidade(e) {
    let t = 34;
    typeof e == "number" ? t = Math.max(15, e) : e === "compacta" ? t = 26 : e === "relaxada" ? t = 42 : t = 34, !(typeof document > "u") && (document.documentElement.style.setProperty("--ui-altura-minima", `${t}px`), document.documentElement.style.setProperty("--ui-campo-altura", `${t}px`), document.documentElement.setAttribute("data-ui-densidade", typeof e == "string" ? e : "custom"), this.emit("densidade:alterada", { densidade: e, alturaPx: t }));
  }
  /**
   * Alterna ou define o tema visual global.
   */
  definirTema(e) {
    if (typeof document > "u") return e || "escuro";
    const t = document.documentElement;
    let r = t.getAttribute("data-tema");
    r || (r = t.classList.contains("dark") ? "escuro" : t.classList.contains("light") ? "claro" : "escuro");
    const n = e || (r === "escuro" ? "claro" : "escuro");
    return t.setAttribute("data-tema", n), n === "escuro" ? (t.classList.add("dark"), t.classList.remove("light")) : (t.classList.remove("dark"), t.classList.add("light")), this.emit("tema:alterado", { tema: n }), n;
  }
}
const s = new E();
let y = !1;
function B() {
  y || typeof document > "u" || (y = !0, document.addEventListener("click", (f) => {
    const e = f.composedPath ? f.composedPath() : [f.target], t = "[target-modal], [modal-alvo], [dismiss-modal], [fechar-modal], [target-drawer], [drawer-alvo], [dismiss-drawer], [fechar-drawer], [toast-sucesso], [toast-erro], [toast-alerta], [toast-info], [copiar-texto], [alternar-tema], [definir-densidade], [limpar-form]";
    let r = null;
    for (const a of e)
      if (a instanceof HTMLElement && a.matches(t)) {
        r = a;
        break;
      }
    if (!r) return;
    const n = r.getAttribute("target-modal") || r.getAttribute("modal-alvo");
    if (n && s.abrirModal(n), r.hasAttribute("dismiss-modal") || r.hasAttribute("fechar-modal")) {
      const a = r.getAttribute("dismiss-modal") || r.getAttribute("fechar-modal");
      if (a && a !== "")
        s.fecharModal(a);
      else {
        let i = null;
        for (const o of e)
          if (o instanceof HTMLElement && (o.matches("ui-modal, ui-dialog") || o.tagName === "UI-MODAL" || o.tagName === "UI-DIALOG")) {
            i = o;
            break;
          }
        i && (typeof i.fechar == "function" ? i.fechar() : (i.removeAttribute("aberto"), i.removeAttribute("open")));
      }
    }
    const c = r.getAttribute("target-drawer") || r.getAttribute("drawer-alvo");
    if (c && s.abrirDrawer(c), r.hasAttribute("dismiss-drawer") || r.hasAttribute("fechar-drawer")) {
      const a = r.getAttribute("dismiss-drawer") || r.getAttribute("fechar-drawer");
      if (a && a !== "")
        s.fecharDrawer(a);
      else {
        let i = null;
        for (const o of e)
          if (o instanceof HTMLElement && (o.matches("ui-drawer, ui-sheet, ui-painel-lateral, ui-gaveta") || o.tagName.startsWith("UI-DRAWER") || o.tagName.startsWith("UI-SHEET"))) {
            i = o;
            break;
          }
        i && (typeof i.fechar == "function" ? i.fechar() : (i.removeAttribute("aberto"), i.removeAttribute("open")));
      }
    }
    const l = r.getAttribute("toast-sucesso");
    l && s.notificar({ tipo: "sucesso", mensagem: l });
    const m = r.getAttribute("toast-erro");
    m && s.notificar({ tipo: "erro", mensagem: m });
    const d = r.getAttribute("toast-alerta");
    d && s.notificar({ tipo: "alerta", mensagem: d });
    const h = r.getAttribute("toast-info");
    h && s.notificar({ tipo: "info", mensagem: h });
    const u = r.getAttribute("copiar-texto");
    if (u !== null) {
      let a = u;
      if (u.startsWith("#") || u.startsWith(".") || u.match(/^[a-zA-Z0-9_-]+$/))
        try {
          let o = null;
          u.startsWith("#") || u.startsWith(".") ? o = document.querySelector(u) : o = document.getElementById(u) || document.querySelector(`#${u}`), o && (a = o.value !== void 0 && o.value !== null ? o.value : o.textContent || "");
        } catch {
        }
      const i = r.getAttribute("copiar-mensagem") || "Copiado com sucesso!";
      s.copiar(a, i);
    }
    r.hasAttribute("alternar-tema") && s.definirTema();
    const p = r.getAttribute("definir-densidade");
    p && s.definirDensidade(p);
    const b = r.getAttribute("limpar-form");
    if (b) {
      const a = document.getElementById(b);
      a && typeof a.reset == "function" && (a.reset(), s.notificar({ tipo: "info", mensagem: "Formulário limpo." }));
    }
  }));
}
export {
  s as U,
  B as i
};
