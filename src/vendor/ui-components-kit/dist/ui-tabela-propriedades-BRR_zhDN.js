var D = Object.defineProperty;
var R = (o, t, e) => t in o ? D(o, t, { enumerable: !0, configurable: !0, writable: !0, value: e }) : o[t] = e;
var f = (o, t, e) => R(o, typeof t != "symbol" ? t + "" : t, e);
import { L as y } from "./listener-bag-DQgv7OON.js";
import { d as S, S as L } from "./ssr-safe-5cWfJP-s.js";
class I {
  constructor(t) {
    f(this, "autoFetchController", null);
    this.ctx = t;
  }
  async carregar(t) {
    if (!t) return;
    this.autoFetchController && (this.autoFetchController.abort(), this.autoFetchController = null);
    const e = new AbortController();
    this.autoFetchController = e, this.ctx.onCarregandoAlterado(!0), this.ctx.host.dispatchEvent(
      new CustomEvent("ui-fetch-start", {
        bubbles: !0,
        composed: !0,
        detail: { url: t }
      })
    );
    try {
      const i = await fetch(t, { signal: e.signal });
      if (!i.ok)
        throw new Error(`HTTP ${i.status}: ${i.statusText}`);
      const r = await i.json(), a = Array.isArray(r) ? r : r.dados || r.items || r.data || r.rows || [];
      this.autoFetchController === e && (this.ctx.onDadosRecebidos(a), this.ctx.onCarregandoAlterado(!1), this.autoFetchController = null, this.ctx.host.dispatchEvent(
        new CustomEvent("ui-fetch-sucesso", {
          bubbles: !0,
          composed: !0,
          detail: { url: t, total: a.length, dados: a }
        })
      ));
    } catch (i) {
      if (i.name === "AbortError")
        return;
      this.autoFetchController === e && (this.ctx.onCarregandoAlterado(!1), this.autoFetchController = null, console.error("[ui-tabela] Erro ao carregar dados remotos:", i), this.ctx.host.dispatchEvent(
        new CustomEvent("ui-fetch-erro", {
          bubbles: !0,
          composed: !0,
          detail: { url: t, erro: i.message || String(i) }
        })
      ));
    }
  }
  abortar() {
    this.autoFetchController && (this.autoFetchController.abort(), this.autoFetchController = null);
  }
}
function H(o, t, e = "id") {
  if (!o || o.length === 0) return -1;
  if (typeof t == "function")
    return o.findIndex(t);
  const i = o.findIndex((r) => !r || typeof r != "object" ? !1 : r[e] !== void 0 && (r[e] === t || String(r[e]) === String(t)) || r.id !== void 0 && (r.id === t || String(r.id) === String(t)) || r._id !== void 0 && (r._id === t || String(r._id) === String(t)) || r.codigo !== void 0 && (r.codigo === t || String(r.codigo) === String(t)) || r.key !== void 0 && (r.key === t || String(r.key) === String(t)));
  if (i !== -1)
    return i;
  if (typeof t == "number" && Number.isInteger(t)) {
    if (t >= 0 && t < o.length)
      return t;
  } else if (typeof t == "string" && /^\d+$/.test(t.trim())) {
    const r = parseInt(t.trim(), 10);
    if (r >= 0 && r < o.length)
      return r;
  }
  return -1;
}
class z {
  constructor(t) {
    f(this, "itemSelecionado", null);
    f(this, "indiceSelecionado", null);
    this.ctx = t;
  }
  getItemSelecionado() {
    return this.itemSelecionado;
  }
  setItemSelecionado(t) {
    this.itemSelecionado = t, this.indiceSelecionado = t ? this.ctx.dadosExibicao.indexOf(t) : null, this.atualizarLinhasSelecionadas();
  }
  getIndiceSelecionado() {
    return this.indiceSelecionado;
  }
  setIndiceSelecionado(t) {
    this.indiceSelecionado = t, this.itemSelecionado = t !== null && t >= 0 && t < this.ctx.dadosExibicao.length ? this.ctx.dadosExibicao[t] : null, this.atualizarLinhasSelecionadas();
  }
  limparSelecao() {
    this.itemSelecionado = null, this.indiceSelecionado = null, this.atualizarLinhasSelecionadas();
  }
  isItemSelecionado(t, e) {
    if (this.itemSelecionado) {
      if (this.itemSelecionado === t) return !0;
      const i = this.ctx.chaveId;
      if (t[i] !== void 0 && this.itemSelecionado[i] !== void 0)
        return String(t[i]) === String(this.itemSelecionado[i]);
      if (t.id !== void 0 && this.itemSelecionado.id !== void 0)
        return String(t.id) === String(this.itemSelecionado.id);
    }
    return this.indiceSelecionado !== null && this.indiceSelecionado === e;
  }
  atualizarLinhasSelecionadas() {
    if (!this.ctx.tbodyElement) return;
    this.ctx.tbodyElement.querySelectorAll("tr:not(.ui-tabela__virtual-spacer)").forEach((e) => {
      const i = e.getAttribute("data-index"), r = i !== null ? parseInt(i, 10) : -1, a = r >= 0 ? this.ctx.dadosExibicao[r] : null, c = a ? this.isItemSelecionado(a, r) : !1;
      e.classList.toggle("ui-tabela__tr--selecionada", c), c ? e.setAttribute("data-selecionada", "true") : e.removeAttribute("data-selecionada");
    });
  }
  rolarPara(t, e) {
    var l, u, d;
    const i = H(this.ctx.dadosExibicao, t, this.ctx.chaveId);
    if (i === -1)
      return !1;
    const r = this.ctx.dadosExibicao[i], a = (e == null ? void 0 : e.comportamento) || "smooth";
    e != null && e.selecionar && (this.itemSelecionado = r, this.indiceSelecionado = i, this.atualizarLinhasSelecionadas(), this.ctx.host.dispatchEvent(
      new CustomEvent("ui-linha-selecionada", {
        bubbles: !0,
        composed: !0,
        detail: { item: r, indice: i }
      })
    ));
    const c = this.ctx.getRowHeight(), s = (l = this.ctx.tbodyElement) == null ? void 0 : l.querySelector(
      `tr[data-index="${i}"]`
    );
    if (s && !s.classList.contains("ui-tabela__virtual-spacer"))
      return this.ctx.containerElement && (typeof window.happyDOM < "u" || typeof process < "u" && ((u = process.env) == null ? void 0 : u.NODE_ENV) === "test") && (this.ctx.containerElement.scrollTop = i * c), typeof s.scrollIntoView == "function" && s.scrollIntoView({ behavior: a, block: "nearest" }), !0;
    if (this.ctx.containerElement) {
      const n = Math.max(0, i * c);
      if (typeof this.ctx.containerElement.scrollTo == "function")
        try {
          this.ctx.containerElement.scrollTo({
            top: n,
            behavior: a
          });
        } catch {
          this.ctx.containerElement.scrollTop = n;
        }
      else
        this.ctx.containerElement.scrollTop = n;
      return (a === "auto" || typeof window.happyDOM < "u" || typeof process < "u" && ((d = process.env) == null ? void 0 : d.NODE_ENV) === "test") && (this.ctx.containerElement.scrollTop = n, this.ctx.onRenderBody()), !0;
    }
    return !1;
  }
}
function P(o, t, e) {
  return o !== e ? {
    idColuna: e,
    direcao: "asc"
  } : t === "asc" ? {
    idColuna: e,
    direcao: "desc"
  } : t === "desc" ? {
    idColuna: null,
    direcao: "original"
  } : {
    idColuna: e,
    direcao: "asc"
  };
}
function F(o, t, e) {
  if (!t || e === "original")
    return [...o];
  const i = e === "asc" ? 1 : -1;
  return [...o].sort((r, a) => {
    const c = r[t], s = a[t];
    return c === s ? 0 : c == null ? 1 * i : s == null ? -1 * i : typeof c == "number" && typeof s == "number" ? (c - s) * i : String(c).localeCompare(String(s), "pt-BR", {
      numeric: !0,
      sensitivity: "base"
    }) * i;
  });
}
class V {
  constructor() {
    f(this, "dadosOriginais", []);
    f(this, "dadosExibicao", []);
    f(this, "colunaOrdenada", null);
    f(this, "direcaoOrdenacao", "original");
    f(this, "ultimoFiltro", "");
  }
  getDadosOriginais() {
    return this.dadosOriginais;
  }
  setDadosOriginais(t) {
    this.dadosOriginais = Array.isArray(t) ? [...t] : [], this.aplicarOrdenacao();
  }
  getDadosExibicao() {
    return this.dadosExibicao;
  }
  getColunaOrdenada() {
    return this.colunaOrdenada;
  }
  setColunaOrdenada(t) {
    this.colunaOrdenada = t, t ? this.direcaoOrdenacao === "original" && (this.direcaoOrdenacao = "asc") : this.direcaoOrdenacao = "original", this.aplicarOrdenacao();
  }
  getDirecaoOrdenacao() {
    return this.direcaoOrdenacao;
  }
  setDirecaoOrdenacao(t) {
    this.direcaoOrdenacao = t || "original", this.direcaoOrdenacao === "original" && (this.colunaOrdenada = null), this.aplicarOrdenacao();
  }
  alternarOrdenacaoColuna(t) {
    if (!t.ordenavel) return null;
    const e = P(this.colunaOrdenada, this.direcaoOrdenacao, t.id);
    return this.colunaOrdenada = e.idColuna, this.direcaoOrdenacao = e.direcao, this.aplicarOrdenacao(), e;
  }
  aplicarOrdenacao() {
    this.dadosExibicao = F(
      this.dadosOriginais,
      this.colunaOrdenada,
      this.direcaoOrdenacao
    );
  }
  filtrar(t) {
    if (this.ultimoFiltro = (t || "").trim().toLowerCase(), !this.ultimoFiltro) {
      this.aplicarOrdenacao();
      return;
    }
    this.dadosExibicao = this.dadosOriginais.filter((e) => Object.values(e).some((i) => i == null ? !1 : String(i).toLowerCase().includes(this.ultimoFiltro)));
  }
}
const O = ':host{display:block;width:100%;box-sizing:border-box;font-family:inherit;color:var(--ui-cor-texto, #e1e1e6);position:relative}.ui-tabela-container{width:100%;max-width:100%;max-height:var(--ui-tabela-max-height, 500px);overflow-x:auto;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;touch-action:pan-x pan-y;border:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .12));border-radius:var(--ui-raio-borda, 6px);background-color:var(--ui-cor-superficie, #141417);box-sizing:border-box;position:relative}.ui-tabela{width:100%;border-collapse:separate;border-spacing:0;text-align:left;font-size:14px}.ui-tabela thead{position:sticky;top:0;z-index:10;background-color:var(--ui-cor-fundo-elevado, #1a1a1e)}.ui-tabela th{position:sticky;top:0;z-index:10;padding:10px 16px;background-color:var(--ui-cor-fundo-elevado, #1a1a1e);color:var(--ui-cor-texto, #e1e1e6);font-weight:600;border-bottom:2px solid var(--ui-cor-borda, rgba(255, 255, 255, .12));white-space:nowrap;-webkit-user-select:none;user-select:none;box-sizing:border-box}.ui-tabela__resizer{position:absolute;top:0;right:0;width:6px;height:100%;cursor:col-resize;-webkit-user-select:none;user-select:none;z-index:20;transition:background-color .15s ease}.ui-tabela__resizer:hover,.ui-tabela__resizer--ativo{background-color:var(--ui-cor-primaria, #00E08A)}:host([densidade="compacta"]) th,:host([densidade="compacta"]) td,:host([density="compact"]) th,:host([density="compact"]) td{padding:4px 8px}:host([densidade="normal"]) th,:host([densidade="normal"]) td,:host([density="normal"]) th,:host([density="normal"]) td{padding:10px 16px}:host([densidade="relaxada"]) th,:host([densidade="relaxada"]) td,:host([density="relaxed"]) th,:host([density="relaxed"]) td{padding:16px 20px}.ui-tabela__header-content{display:inline-flex;align-items:center;vertical-align:middle;width:100%;box-sizing:border-box}.ui-tabela__header-text{margin-right:90px;display:inline-flex;align-items:center}.ui-tabela__sort-icon,.ui-tabela__header-icon{width:70px;min-width:70px;max-width:70px;display:inline-flex;justify-content:center;align-items:center;transition:transform .2s ease,opacity .2s ease}.ui-tabela th.ui-tabela__th--ordenavel{cursor:pointer}.ui-tabela th.ui-tabela__th--ordenavel:hover{background-color:var(--ui-cor-hover-menu, rgba(255, 255, 255, .08))}.ui-tabela__sort-arrow{display:inline-block;width:12px;height:12px;vertical-align:middle;shape-rendering:geometricPrecision;transition:transform .2s ease,fill .2s ease;fill:var(--ui-cor-primaria, #00E08A)}.ui-tabela__sort-arrow--desc{transform:rotate(180deg)}.ui-tabela__sort-arrow--inativo{opacity:.3;fill:var(--ui-cor-texto-secundario, #888899)}.ui-tabela td{padding:10px 16px;border-bottom:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .06));white-space:nowrap;vertical-align:middle;color:var(--ui-cor-texto, #e1e1e6);box-sizing:border-box}.ui-tabela__cell-content{display:inline-flex;align-items:center;vertical-align:middle}.ui-tabela__cell-truncate{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}.ui-tabela--alinhar-esquerda{text-align:left}.ui-tabela--alinhar-esquerda .ui-tabela__header-content,.ui-tabela--alinhar-esquerda .ui-tabela__cell-content{justify-content:flex-start}.ui-tabela--alinhar-centro{text-align:center}.ui-tabela--alinhar-centro .ui-tabela__header-content,.ui-tabela--alinhar-centro .ui-tabela__cell-content{justify-content:center}.ui-tabela--alinhar-direita{text-align:right}.ui-tabela--alinhar-direita .ui-tabela__header-content,.ui-tabela--alinhar-direita .ui-tabela__cell-content{justify-content:flex-end}.ui-tabela tbody tr:nth-child(2n){background-color:var(--ui-cor-fundo-card, rgba(255, 255, 255, .02))}.ui-tabela tbody tr:hover{background-color:var(--ui-cor-hover-menu, rgba(255, 255, 255, .08))}.ui-tabela tbody tr.ui-tabela__tr--selecionada,.ui-tabela tbody tr[data-selecionada=true]{background-color:#00e08a24!important;box-shadow:inset 3px 0 0 var(--ui-cor-primaria, #00E08A)}.ui-tabela tbody tr.ui-tabela__tr--selecionada:hover,.ui-tabela tbody tr[data-selecionada=true]:hover{background-color:#00e08a38!important}.ui-tabela__virtual-spacer td{padding:0!important;border:none!important;height:inherit;background:transparent!important}.ui-tabela__empty{padding:48px 24px;text-align:center;border:2px dashed var(--ui-cor-borda, rgba(255, 255, 255, .2));border-radius:var(--ui-raio-borda, 6px);margin:16px;color:var(--ui-cor-texto-secundario, #888899);background-color:var(--ui-cor-fundo, #0b0b0d);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;box-sizing:border-box}.ui-tabela__empty-icon{width:32px;height:32px;opacity:.5;fill:currentColor}.ui-tabela__empty-text{font-size:14px;font-weight:500;color:var(--ui-cor-texto-secundario, #888899)}.ui-tabela__loading{position:absolute;top:0;left:0;right:0;bottom:0;background-color:#0b0b0db3;-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;z-index:50;color:var(--ui-cor-primaria, #00E08A);font-size:14px}.ui-tabela__spinner{width:32px;height:32px;border:3px solid rgba(255,255,255,.15);border-top-color:var(--ui-cor-primaria, #00E08A);border-radius:50%;animation:ui-tabela-spin .8s linear infinite}@keyframes ui-tabela-spin{to{transform:rotate(360deg)}}.ui-tabela__context-menu{position:absolute;z-index:100;background-color:var(--ui-cor-fundo-elevado, #1a1a1e);border:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .2));border-radius:var(--ui-raio-borda, 6px);box-shadow:0 4px 20px #0009;padding:6px;display:flex;flex-direction:column;gap:4px;min-width:200px;font-size:13px;color:var(--ui-cor-texto, #e1e1e6)}.ui-tabela__context-item{padding:8px 12px;border-radius:4px;cursor:pointer;color:var(--ui-cor-texto, #e1e1e6);display:flex;align-items:center;justify-content:space-between;gap:8px;transition:background-color .15s ease}.ui-tabela__context-item:hover{background-color:var(--ui-cor-hover-menu, rgba(255, 255, 255, .08));color:var(--ui-cor-primaria, #00E08A)}.ui-tabela__prompt-dialog{border:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .2));border-radius:var(--ui-raio-borda, 6px);background-color:var(--ui-cor-fundo-elevado, #1a1a1e);color:var(--ui-cor-texto, #e1e1e6);padding:12px;box-shadow:0 8px 32px #000c;font-family:inherit;font-size:14px}.ui-tabela__prompt-dialog::backdrop{background:#0000004d}.ui-tabela__prompt-title{margin-bottom:8px;font-weight:500}.ui-tabela__prompt-dialog input{width:100%;padding:6px 8px;border-radius:4px;border:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .2));background:var(--ui-cor-superficie, #141417);color:var(--ui-cor-texto, #e1e1e6);margin-bottom:12px;box-sizing:border-box}.ui-tabela__prompt-actions{display:flex;justify-content:flex-end;gap:8px}.ui-tabela__prompt-actions button{background:var(--ui-cor-borda, rgba(255, 255, 255, .12));color:var(--ui-cor-texto, #e1e1e6);border:none;padding:6px 12px;border-radius:4px;cursor:pointer}.ui-tabela__prompt-actions button:last-child{background:var(--ui-cor-primaria, #00E08A);color:#000;font-weight:600}@media (max-width: 640px){.ui-tabela th{padding:8px 10px;font-size:12px}.ui-tabela td{padding:8px 10px;font-size:13px}.ui-tabela__header-text{margin-right:16px}.ui-tabela__sort-icon,.ui-tabela__header-icon{width:24px;min-width:24px;max-width:24px}.ui-tabela__resizer{width:14px}}';
function M(o) {
  return o == null || o === "" ? "" : typeof o == "number" ? `${o}px` : o;
}
function B(o) {
  return o === "centro" || o === "center" ? "ui-tabela--alinhar-centro" : o === "direita" || o === "right" ? "ui-tabela--alinhar-direita" : "ui-tabela--alinhar-esquerda";
}
function N(o) {
  return o === "centro" || o === "center" ? "center" : o === "direita" || o === "right" ? "right" : "left";
}
function q(o) {
  return o === "compacta" ? 30 : o === "relaxada" ? 56 : 42;
}
function j(o, t, e, i) {
  o.innerHTML = `<style>${O}</style>`;
  const r = document.createElement("div");
  r.className = "ui-tabela-container", e && (r.style.maxHeight = e);
  const a = document.createElement("div");
  a.className = "ui-tabela__empty", a.style.display = "none";
  const c = document.createElement("div");
  c.innerHTML = `
    <svg class="ui-tabela__empty-icon" viewBox="0 0 24 24">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h2v7H7zm4-3h2v10h-2zm4 6h2v4h-2z"/>
    </svg>`;
  const s = document.createElement("span");
  s.className = "ui-tabela__empty-text", s.textContent = t, a.appendChild(c), a.appendChild(s);
  const l = document.createElement("table");
  l.className = "ui-tabela";
  const u = document.createElement("colgroup"), d = document.createElement("thead"), n = document.createElement("tbody");
  l.appendChild(u), l.appendChild(d), l.appendChild(n), r.appendChild(a), r.appendChild(l);
  const p = document.createElement("div");
  return p.className = "ui-tabela__loading", p.style.display = i ? "flex" : "none", p.innerHTML = `
    <div class="ui-tabela__spinner"></div>
    <span>Carregando dados...</span>
  `, r.appendChild(p), o.appendChild(r), {
    containerElement: r,
    tableElement: l,
    theadElement: d,
    tbodyElement: n,
    colgroupElement: u,
    emptyElement: a,
    loadingElement: p
  };
}
function $(o) {
  if (!o.theadElement || !o.colgroupElement) return;
  o.headerListeners.cleanup(), o.theadElement.innerHTML = "", o.colgroupElement.innerHTML = "";
  const t = document.createElement("tr");
  o.colunas.forEach((e, i) => {
    const r = document.createElement("col");
    e.largura !== void 0 && (r.style.width = o.formatWidth(e.largura)), o.colgroupElement.appendChild(r);
    const a = document.createElement("th"), c = o.getAlignmentClass(e.alinhamento);
    if (a.className = c, a.style.textAlign = o.getTextAlign(e.alinhamento), e.largura !== void 0 && (a.style.width = o.formatWidth(e.largura)), e.larguraMinima !== void 0 && (a.style.minWidth = o.formatWidth(e.larguraMinima)), e.larguraMaxima !== void 0) {
      const h = o.formatWidth(e.larguraMaxima);
      a.style.maxWidth = h, a.style.overflow = "hidden", a.style.textOverflow = "ellipsis", a.style.whiteSpace = "nowrap";
    }
    if (e.tooltip && (a.title = e.tooltip), e.ordenavel) {
      a.classList.add("ui-tabela__th--ordenavel");
      const h = () => o.onHeaderClick(e);
      o.headerListeners.add(a, "click", h);
    }
    const s = (h) => o.onHeaderContextMenu(h, e, i, a);
    o.headerListeners.add(a, "contextmenu", s);
    const l = document.createElement("div");
    l.className = "ui-tabela__header-content";
    const u = document.createElement("span");
    u.className = "ui-tabela__header-text", u.textContent = e.rotulo, l.appendChild(u);
    const d = document.createElement("span");
    if (d.className = "ui-tabela__sort-icon", e.ordenavel) {
      const h = o.colunaOrdenada === e.id && o.direcaoOrdenacao !== "original", b = h && o.direcaoOrdenacao === "desc", g = h ? "" : "ui-tabela__sort-arrow--inativo", x = b ? "ui-tabela__sort-arrow--desc" : "";
      d.innerHTML = `
        <svg class="ui-tabela__sort-arrow ${g} ${x}" viewBox="0 0 24 24">
          <path d="M7 14l5-5 5 5H7z"/>
        </svg>
      `;
    }
    l.appendChild(d), a.appendChild(l);
    const n = document.createElement("div");
    n.className = "ui-tabela__resizer", n.title = "Arrastar para redimensionar largura (duplo-clique para auto-ajuste)";
    const p = (h) => o.onInitColumnResize(h, e, i, a, n);
    o.headerListeners.add(n, "mousedown", p);
    const m = (h) => {
      h.stopPropagation(), o.onColumnAutoFit(e, a, r);
    };
    o.headerListeners.add(n, "dblclick", m), a.appendChild(n), t.appendChild(a);
  }), o.theadElement.appendChild(t);
}
function W(o) {
  if (!o.tbodyElement || !o.tableElement || !o.emptyElement || !o.containerElement) return;
  if (!o.dadosExibicao || o.dadosExibicao.length === 0) {
    o.emptyElement.style.display = "flex", o.tableElement.style.display = "none";
    return;
  }
  o.emptyElement.style.display = "none", o.tableElement.style.display = "table";
  const t = o.dadosExibicao.length, e = o.rowHeight, i = o.virtualizar && t > 30;
  let r = 0, a = t;
  if (i) {
    const s = o.containerElement.scrollTop, l = o.containerElement.clientHeight || 400, u = 5;
    r = Math.max(0, Math.floor(s / e) - u), a = Math.min(t, Math.ceil((s + l) / e) + u);
  }
  o.tbodyElement.innerHTML = "";
  const c = document.createDocumentFragment();
  if (i && r > 0) {
    const s = document.createElement("tr");
    s.className = "ui-tabela__virtual-spacer", s.style.height = `${r * e}px`;
    const l = document.createElement("td");
    l.colSpan = o.colunas.length || 1, s.appendChild(l), c.appendChild(s);
  }
  for (let s = r; s < a; s++) {
    const l = o.dadosExibicao[s], u = document.createElement("tr");
    u.setAttribute("data-index", String(s));
    const d = o.chaveId;
    l[d] !== void 0 ? u.setAttribute("data-id", String(l[d])) : l.id !== void 0 ? u.setAttribute("data-id", String(l.id)) : l._id !== void 0 && u.setAttribute("data-id", String(l._id)), o.isItemSelecionado(l, s) && (u.classList.add("ui-tabela__tr--selecionada"), u.setAttribute("data-selecionada", "true")), u.addEventListener("click", (n) => {
      const p = n.target;
      p && p.closest("button, input, select, textarea, a, [data-prevent-select]") || o.onLinhaClique(l, s);
    }), o.colunas.forEach((n) => {
      const p = document.createElement("td"), m = o.getAlignmentClass(n.alinhamento);
      if (p.className = m, p.style.textAlign = o.getTextAlign(n.alinhamento), n.larguraMaxima !== void 0) {
        const g = o.formatWidth(n.larguraMaxima);
        p.style.maxWidth = g, p.style.overflow = "hidden", p.style.textOverflow = "ellipsis", p.style.whiteSpace = "nowrap";
      }
      const h = document.createElement("div");
      h.className = "ui-tabela__cell-content", n.larguraMaxima !== void 0 && h.classList.add("ui-tabela__cell-truncate");
      const b = l[n.id];
      if (typeof n.render == "function") {
        const g = n.render(b, l, s);
        g instanceof Node ? h.appendChild(g) : h.textContent = String(g ?? "");
      } else if (b instanceof Node)
        h.appendChild(b);
      else {
        const g = b != null ? String(b) : "";
        h.textContent = g, n.larguraMaxima !== void 0 && !n.tooltip && (p.title = g);
      }
      p.appendChild(h), u.appendChild(p);
    }), c.appendChild(u);
  }
  if (i && a < t) {
    const s = document.createElement("tr");
    s.className = "ui-tabela__virtual-spacer", s.style.height = `${(t - a) * e}px`;
    const l = document.createElement("td");
    l.colSpan = o.colunas.length || 1, s.appendChild(l), c.appendChild(s);
  }
  o.tbodyElement.appendChild(c);
}
function X(o) {
  const {
    evento: t,
    coluna: e,
    colIndex: i,
    thElement: r,
    resizer: a,
    colgroupElement: c,
    onResizeStart: s,
    onResizeEnd: l
  } = o;
  t.stopPropagation(), t.preventDefault(), s(), a.classList.add("ui-tabela__resizer--ativo");
  const u = t.pageX, d = r.offsetWidth, n = c == null ? void 0 : c.children[i], p = (b) => {
    const g = b.pageX - u;
    let x = d + g;
    if (e.larguraMinima !== void 0) {
      const v = typeof e.larguraMinima == "number" ? e.larguraMinima : parseInt(e.larguraMinima, 10);
      isNaN(v) || (x = Math.max(v, x));
    } else
      x = Math.max(60, x);
    if (e.larguraMaxima !== void 0) {
      const v = typeof e.larguraMaxima == "number" ? e.larguraMaxima : parseInt(e.larguraMaxima, 10);
      isNaN(v) || (x = Math.min(v, x));
    }
    e.largura = `${x}px`, r.style.width = `${x}px`, n && (n.style.width = `${x}px`);
  }, m = () => {
    h(), l(String(e.largura));
  }, h = () => {
    a.classList.remove("ui-tabela__resizer--ativo"), window.removeEventListener("mousemove", p), window.removeEventListener("mouseup", m);
  };
  return window.addEventListener("mousemove", p), window.addEventListener("mouseup", m), h;
}
function U(o) {
  const {
    evento: t,
    coluna: e,
    colIndex: i,
    thElement: r,
    colgroupElement: a,
    shadow: c,
    onResizeEnd: s
  } = o, l = document.createElement("dialog");
  l.className = "ui-tabela__prompt-dialog", l.style.position = "fixed", l.style.left = `${t.clientX}px`, l.style.top = `${t.clientY}px`;
  const u = document.createElement("div");
  u.className = "ui-tabela__prompt-title", u.textContent = `Largura para "${e.rotulo}" (px ou auto):`;
  const d = document.createElement("input");
  d.type = "text";
  const n = e.largura ? String(e.largura).replace("px", "") : "auto";
  d.value = n;
  const p = document.createElement("div");
  p.className = "ui-tabela__prompt-actions";
  const m = document.createElement("button");
  m.textContent = "Aplicar";
  const h = document.createElement("button");
  h.textContent = "Cancelar", p.appendChild(h), p.appendChild(m), l.appendChild(u), l.appendChild(d), l.appendChild(p), c.appendChild(l), l.showModal();
  const b = () => {
    const x = d.value.trim().toLowerCase();
    if (x === "" || x === "auto")
      e.largura = void 0, r.style.width = "", a != null && a.children[i] && (a.children[i].style.width = "");
    else {
      const v = parseInt(x, 10);
      !isNaN(v) && v > 20 && (e.largura = `${v}px`, r.style.width = `${v}px`, a != null && a.children[i] && (a.children[i].style.width = `${v}px`));
    }
    l.close(), l.remove(), s(e.largura ? String(e.largura) : "auto");
  };
  m.addEventListener("click", (g) => {
    g.stopPropagation(), b();
  }), h.addEventListener("click", (g) => {
    g.stopPropagation(), l.close(), l.remove();
  }), d.addEventListener("keydown", (g) => {
    g.key === "Enter" ? (g.preventDefault(), b()) : g.key === "Escape" && (g.preventDefault(), l.close(), l.remove());
  }), setTimeout(() => d.focus(), 10);
}
function Y(o, t, e, i, r, a) {
  return X({
    evento: o,
    coluna: t,
    colIndex: e,
    thElement: i,
    resizer: r,
    colgroupElement: a.colgroupElement,
    onResizeStart: () => a.onSetIsResizing(!0),
    onResizeEnd: (c) => {
      setTimeout(() => a.onSetIsResizing(!1), 50), a.host.dispatchEvent(
        new CustomEvent("ui-column-resize", {
          detail: { idColuna: t.id, largura: c },
          bubbles: !0,
          composed: !0
        })
      );
    }
  });
}
function G(o, t, e, i, r) {
  o.preventDefault(), o.stopPropagation(), U({
    evento: o,
    coluna: t,
    colIndex: e,
    thElement: i,
    colgroupElement: r.colgroupElement,
    shadow: r.shadow,
    onResizeEnd: (a) => {
      r.host.dispatchEvent(
        new CustomEvent("ui-column-resize", {
          detail: { idColuna: t.id, largura: a },
          bubbles: !0,
          composed: !0
        })
      );
    }
  });
}
function K(o) {
  $({
    theadElement: o.theadElement,
    colgroupElement: o.colgroupElement,
    colunas: o.colunas,
    colunaOrdenada: o.dadosController.getColunaOrdenada(),
    direcaoOrdenacao: o.dadosController.getDirecaoOrdenacao(),
    headerListeners: o.headerListeners,
    formatWidth: M,
    getAlignmentClass: B,
    getTextAlign: N,
    onHeaderClick: (t) => o.onHeaderClick(t),
    onHeaderContextMenu: (t, e, i, r) => {
      G(t, e, i, r, {
        host: o.host,
        colgroupElement: o.colgroupElement,
        shadow: o.shadow,
        onSetIsResizing: o.onSetIsResizing
      });
    },
    onInitColumnResize: (t, e, i, r, a) => {
      const c = Y(t, e, i, r, a, {
        host: o.host,
        colgroupElement: o.colgroupElement,
        shadow: o.shadow,
        onSetIsResizing: o.onSetIsResizing
      });
      o.onActiveResizeCleanup(c);
    },
    onColumnAutoFit: (t, e, i) => {
      t.largura = void 0, e.style.width = "", i.style.width = "", o.host.dispatchEvent(
        new CustomEvent("ui-column-resize", {
          bubbles: !0,
          composed: !0,
          detail: { idColuna: t.id, largura: "auto" }
        })
      );
    }
  });
}
function Q(o) {
  W({
    tbodyElement: o.tbodyElement,
    tableElement: o.tableElement,
    emptyElement: o.emptyElement,
    containerElement: o.containerElement,
    dadosExibicao: o.dadosController.getDadosExibicao(),
    colunas: o.colunas,
    chaveId: o.chaveId,
    virtualizar: o.virtualizar,
    rowHeight: o.rowHeight,
    isItemSelecionado: (t, e) => o.selecaoController.isItemSelecionado(t, e),
    onLinhaClique: (t, e) => {
      o.selecaoController.setItemSelecionado(t), o.host.dispatchEvent(
        new CustomEvent("ui-linha-clique", {
          bubbles: !0,
          composed: !0,
          detail: { item: t, indice: e }
        })
      );
    },
    formatWidth: M,
    getAlignmentClass: B,
    getTextAlign: N
  });
}
function J(o, t) {
  let e = !1;
  const i = () => {
    e || (window.requestAnimationFrame(() => {
      t(), e = !1;
    }), e = !0);
  };
  return o.addEventListener("scroll", i), i;
}
function Z(o, t, e, i) {
  return j(o, t, e, i);
}
function T(o) {
  const t = o.host.getAttribute("texto-vazio") || o.host.getAttribute("empty-text");
  t && o.onTextoVazioAlterado(t);
  const e = o.host.getAttribute("virtualizar") || o.host.getAttribute("virtualize");
  e !== null && o.onVirtualizarAlterado(e !== "false");
  const i = o.host.getAttribute("src");
  i && o.host.isConnected && o.onCarregarSrc(i);
  const r = o.host.hasAttribute("carregando") || o.host.hasAttribute("loading");
  o.onCarregandoAlterado(r), o.loadingElement && (o.loadingElement.style.display = r ? "flex" : "none");
}
function ee(o, t, e) {
  if (T(e), o === "max-height" && e.containerElement) {
    e.containerElement.style.maxHeight = t || "";
    return;
  }
  if ((o === "texto-vazio" || o === "empty-text") && e.emptyElement) {
    const i = e.emptyElement.querySelector(".ui-tabela__empty-text");
    i && t && (i.textContent = t), e.onRenderBody();
    return;
  }
  if (o === "carregando" || o === "loading") {
    e.loadingElement && (e.loadingElement.style.display = t !== null ? "flex" : "none");
    return;
  }
  if (o === "densidade" || o === "density") {
    e.onRenderBody();
    return;
  }
  e.onRenderTotal();
}
class te extends L {
  constructor() {
    super();
    f(this, "shadow");
    f(this, "_colunas", []);
    f(this, "_textoVazio", "Nenhum registro encontrado");
    f(this, "_virtualizar", !0);
    f(this, "_isResizing", !1);
    f(this, "_carregando", !1);
    f(this, "_src", null);
    f(this, "_containerElement", null);
    f(this, "_tableElement", null);
    f(this, "_theadElement", null);
    f(this, "_tbodyElement", null);
    f(this, "_colgroupElement", null);
    f(this, "_emptyElement", null);
    f(this, "_loadingElement", null);
    f(this, "_scrollHandler", null);
    f(this, "_activeResizeCleanup", null);
    f(this, "_headerListeners", new y());
    f(this, "remotaController");
    f(this, "selecaoController");
    f(this, "dadosController", new V());
    this.shadow = this.attachShadow({ mode: "open" }), this.remotaController = new I({
      host: this,
      onCarregandoAlterado: (e) => {
        this.carregando = e;
      },
      onDadosRecebidos: (e) => {
        this.dados = e;
      }
    }), this.selecaoController = new z({
      host: this,
      tbodyElement: null,
      containerElement: null,
      dadosExibicao: this.dadosController.getDadosExibicao(),
      chaveId: this.chaveId,
      getRowHeight: () => this.getRowHeight(),
      onRenderBody: () => this.renderBody()
    });
  }
  static get observedAttributes() {
    return ["texto-vazio", "empty-text", "max-height", "densidade", "density", "virtualizar", "virtualize", "src", "carregando", "loading", "chave-id", "id-key"];
  }
  connectedCallback() {
    this.syncAttributes(), !this.hasAttribute("densidade") && !this.hasAttribute("density") && this.setAttribute("densidade", "normal"), this.renderTotal(), this._src && this.remotaController.carregar(this._src);
  }
  disconnectedCallback() {
    this.cleanupEventListeners();
  }
  attributeChangedCallback(e, i, r) {
    ee(e, r, this.obterContextoAtributos());
  }
  syncAttributes() {
    T(this.obterContextoAtributos());
  }
  obterContextoAtributos() {
    return {
      host: this,
      containerElement: this._containerElement,
      emptyElement: this._emptyElement,
      loadingElement: this._loadingElement,
      onTextoVazioAlterado: (e) => {
        this._textoVazio = e;
      },
      onVirtualizarAlterado: (e) => {
        this._virtualizar = e;
      },
      onCarregarSrc: (e) => {
        this._src = e, this.remotaController.carregar(e);
      },
      onCarregandoAlterado: (e) => {
        this._carregando = e;
      },
      onRenderBody: () => this.renderBody(),
      onRenderTotal: () => this.renderTotal()
    };
  }
  get src() {
    return this._src;
  }
  set src(e) {
    this._src = e, e ? (this.setAttribute("src", e), this.remotaController.carregar(e)) : this.removeAttribute("src");
  }
  get carregando() {
    return this._carregando;
  }
  set carregando(e) {
    this._carregando = !!e, this._carregando ? this.setAttribute("carregando", "") : (this.removeAttribute("carregando"), this.removeAttribute("loading")), this._loadingElement && (this._loadingElement.style.display = this._carregando ? "flex" : "none");
  }
  async carregarDoEndpoint(e) {
    await this.remotaController.carregar(e || this._src || "");
  }
  async recarregar() {
    this._src ? await this.remotaController.carregar(this._src) : (this.dadosController.aplicarOrdenacao(), this.renderBody());
  }
  filtrar(e) {
    this.dadosController.filtrar(e), this.atualizarContextoSelecao(), this.renderBody();
  }
  cleanupEventListeners() {
    this._containerElement && this._scrollHandler && (this._containerElement.removeEventListener("scroll", this._scrollHandler), this._scrollHandler = null), this._activeResizeCleanup && (this._activeResizeCleanup(), this._activeResizeCleanup = null), this.remotaController.abortar(), this._headerListeners.cleanup();
  }
  get colunas() {
    return this._colunas;
  }
  set colunas(e) {
    this._colunas = Array.isArray(e) ? e : [], this.renderTotal();
  }
  get dados() {
    return this.dadosController.getDadosOriginais();
  }
  set dados(e) {
    this.dadosController.setDadosOriginais(e), this.atualizarContextoSelecao(), this.renderBody();
  }
  get itens() {
    return this.dados;
  }
  set itens(e) {
    this.dados = e;
  }
  get chaveId() {
    return this.getAttribute("chave-id") || this.getAttribute("id-key") || "id";
  }
  set chaveId(e) {
    e ? this.setAttribute("chave-id", e) : (this.removeAttribute("chave-id"), this.removeAttribute("id-key")), this.atualizarContextoSelecao();
  }
  get itemSelecionado() {
    return this.selecaoController.getItemSelecionado();
  }
  set itemSelecionado(e) {
    this.selecaoController.setItemSelecionado(e);
  }
  get indiceSelecionado() {
    return this.selecaoController.getIndiceSelecionado();
  }
  set indiceSelecionado(e) {
    this.selecaoController.setIndiceSelecionado(e);
  }
  limparSelecao() {
    this.selecaoController.limparSelecao();
  }
  get densidade() {
    const e = this.getAttribute("densidade") || this.getAttribute("density");
    return e === "compacta" || e === "compact" ? "compacta" : e === "relaxada" || e === "relaxed" ? "relaxada" : "normal";
  }
  set densidade(e) {
    e ? this.setAttribute("densidade", e) : (this.removeAttribute("densidade"), this.removeAttribute("density")), this.renderBody();
  }
  get virtualizar() {
    return this._virtualizar;
  }
  set virtualizar(e) {
    this._virtualizar = !!e, e ? this.setAttribute("virtualizar", "true") : this.removeAttribute("virtualizar"), this.renderTotal();
  }
  get colunaOrdenada() {
    return this.dadosController.getColunaOrdenada();
  }
  set colunaOrdenada(e) {
    this.dadosController.setColunaOrdenada(e), this.renderHeader(), this.renderBody();
  }
  get direcaoOrdenacao() {
    return this.dadosController.getDirecaoOrdenacao();
  }
  set direcaoOrdenacao(e) {
    this.dadosController.setDirecaoOrdenacao(e), this.renderHeader(), this.renderBody();
  }
  get textoVazio() {
    return this._textoVazio;
  }
  set textoVazio(e) {
    this._textoVazio = e || "Nenhum registro encontrado", this.renderTotal();
  }
  handleHeaderClick(e) {
    if (!e.ordenavel || this._isResizing) return;
    const i = this.dadosController.alternarOrdenacaoColuna(e);
    i && (this.atualizarContextoSelecao(), this.renderHeader(), this.renderBody(), this.dispatchEvent(new CustomEvent("ui-sort", { detail: i, bubbles: !0, composed: !0 })));
  }
  getRowHeight() {
    return q(this.densidade);
  }
  atualizarContextoSelecao() {
    this.selecaoController = new z({
      host: this,
      tbodyElement: this._tbodyElement,
      containerElement: this._containerElement,
      dadosExibicao: this.dadosController.getDadosExibicao(),
      chaveId: this.chaveId,
      getRowHeight: () => this.getRowHeight(),
      onRenderBody: () => this.renderBody()
    });
  }
  renderTotal() {
    if (this.shadow) {
      if (this._containerElement) {
        if (this._containerElement.style.maxHeight = this.getAttribute("max-height") || "", this._emptyElement) {
          const e = this._emptyElement.querySelector(".ui-tabela__empty-text");
          e && (e.textContent = this._textoVazio);
        }
      } else {
        this.cleanupEventListeners();
        const e = Z(this.shadow, this._textoVazio, this.getAttribute("max-height"), this._carregando);
        this._containerElement = e.containerElement, this._tableElement = e.tableElement, this._colgroupElement = e.colgroupElement, this._theadElement = e.theadElement, this._tbodyElement = e.tbodyElement, this._emptyElement = e.emptyElement, this._loadingElement = e.loadingElement, this.atualizarContextoSelecao();
      }
      this.renderHeader(), this.renderBody(), this._virtualizar && this._containerElement && !this._scrollHandler && (this._scrollHandler = J(this._containerElement, () => this.renderBody()));
    }
  }
  obterContextoRenderizador() {
    return {
      host: this,
      shadow: this.shadow,
      theadElement: this._theadElement,
      colgroupElement: this._colgroupElement,
      tbodyElement: this._tbodyElement,
      tableElement: this._tableElement,
      emptyElement: this._emptyElement,
      containerElement: this._containerElement,
      colunas: this._colunas,
      dadosController: this.dadosController,
      selecaoController: this.selecaoController,
      chaveId: this.chaveId,
      virtualizar: this._virtualizar,
      rowHeight: this.getRowHeight(),
      headerListeners: this._headerListeners,
      onSetIsResizing: (e) => {
        this._isResizing = e;
      },
      onActiveResizeCleanup: (e) => {
        this._activeResizeCleanup = e;
      },
      onHeaderClick: (e) => this.handleHeaderClick(e)
    };
  }
  renderHeader() {
    K(this.obterContextoRenderizador());
  }
  renderBody() {
    Q(this.obterContextoRenderizador());
  }
  rolarPara(e, i) {
    return this.selecaoController.rolarPara(e, i);
  }
}
S("ui-tabela", te);
function oe(o) {
  if (!o || typeof o != "string") return null;
  let t = o.trim();
  if (!t) return null;
  t = t.replace(/(\d),(\d)/g, "$1.$2").replace(/,/g, "."), t = t.replace(/\bpi\b/gi, String(Math.PI)), t = t.replace(/\be\b/gi, String(Math.E));
  let e = 0;
  function i() {
    return t[e] || "";
  }
  function r() {
    return t[e++] || "";
  }
  function a() {
    for (; e < t.length && /\s/.test(t[e]); )
      e++;
  }
  function c() {
    a();
    let d = s();
    for (a(); e < t.length; ) {
      const n = i();
      if (n === "+" || n === "-") {
        r(), a();
        const p = e, m = s();
        a(), t.slice(p, e).includes("%") ? d = n === "+" ? d + d * m : d - d * m : d = n === "+" ? d + m : d - m;
      } else
        break;
    }
    return d;
  }
  function s() {
    a();
    let d = l();
    for (a(); e < t.length; ) {
      const n = i();
      if (n === "*" || n === "/" || n === "x" || n === "X") {
        r(), a();
        const p = l();
        if (n === "/" && p === 0)
          throw new Error("Divisão por zero");
        d = n === "/" ? d / p : d * p, a();
      } else
        break;
    }
    return d;
  }
  function l() {
    a();
    let d = u();
    if (a(), i() === "^") {
      r();
      const n = l();
      d = Math.pow(d, n);
    } else if (t.slice(e, e + 2) === "**") {
      e += 2;
      const n = l();
      d = Math.pow(d, n);
    }
    return d;
  }
  function u() {
    a();
    const d = i();
    if (d === "+" || d === "-") {
      r();
      const m = u();
      return d === "-" ? -m : m;
    }
    if (d === "(") {
      r();
      const m = c();
      return a(), i() === ")" && r(), a(), i() === "%" ? (r(), m / 100) : m;
    }
    const n = t.slice(e).match(/^([a-zA-Z_]\w*)\s*\(/);
    if (n) {
      const m = n[1].toLowerCase();
      e += n[0].length;
      const h = c();
      a(), i() === ")" && r();
      let b = h;
      switch (m) {
        case "sqrt":
          b = Math.sqrt(h);
          break;
        case "abs":
          b = Math.abs(h);
          break;
        case "round":
          b = Math.round(h);
          break;
        case "floor":
          b = Math.floor(h);
          break;
        case "ceil":
          b = Math.ceil(h);
          break;
        case "sin":
          b = Math.sin(h);
          break;
        case "cos":
          b = Math.cos(h);
          break;
        case "tan":
          b = Math.tan(h);
          break;
      }
      return a(), i() === "%" ? (r(), b / 100) : b;
    }
    const p = t.slice(e).match(/^([0-9]+(?:\.[0-9]+)?|\.[0-9]+)/);
    if (p) {
      e += p[0].length;
      let m = parseFloat(p[0]);
      return a(), i() === "%" && (r(), m = m / 100), m;
    }
    throw new Error("Caractere inválido: " + d);
  }
  try {
    const d = c();
    return a(), e < t.length ? null : isFinite(d) ? d : null;
  } catch {
    return null;
  }
}
function ie(o) {
  const t = document.createElement("span"), e = typeof o == "number" || typeof o == "string" && /^-?\d+(\.\d+)?$/.test(o.trim());
  return t.className = `ui-prop__valor-readonly ${e ? "ui-prop__valor-readonly--numero" : ""}`.trim(), t.textContent = o != null ? String(o) : "—", t;
}
function re(o, t, e, i) {
  const r = document.createElement("label");
  r.className = "ui-prop__editor-booleano";
  const a = !!e, c = document.createElement("div");
  c.className = `ui-prop__checkbox-custom ${a ? "ui-prop__checkbox-custom--marcado" : ""}`, c.textContent = a ? "✓" : "";
  const s = document.createElement("span");
  return s.className = "ui-prop__booleano-rotulo", s.textContent = a ? "Sim" : "Não", r.appendChild(c), r.appendChild(s), r.addEventListener("click", (l) => {
    l.preventDefault();
    const u = !i.obterValorAtual(t.id);
    i.registrarAlteracao(o, t.id, u), c.classList.toggle("ui-prop__checkbox-custom--marcado", u), c.textContent = u ? "✓" : "", s.textContent = u ? "Sim" : "Não";
  }), r;
}
function ae(o, t, e, i) {
  const r = document.createElement("select");
  return r.className = "ui-prop__editor-select", (t.opcoes || []).forEach((a) => {
    const c = document.createElement("option");
    c.value = String(a.id), c.textContent = a.rotulo, String(a.id) === String(e) && (c.selected = !0), r.appendChild(c);
  }), r.addEventListener("change", () => {
    i.registrarAlteracao(o, t.id, r.value);
  }), r.addEventListener("keydown", (a) => {
    a.key === "Enter" && i.focarProximoEditor(r);
  }), r;
}
function ne(o, t, e) {
  const i = document.createElement("button");
  return i.type = "button", i.className = "ui-prop__btn-acao-inline", i.textContent = t.rotuloAcao || "Editar...", i.addEventListener("click", () => {
    typeof t.onClickAcao == "function" && t.onClickAcao(t), e.despacharEventoAcao(t, o);
  }), i.addEventListener("keydown", (r) => {
    r.key === "Enter" && i.click();
  }), i;
}
function se(o, t, e, i) {
  const r = document.createElement("input");
  r.type = "text", r.inputMode = "decimal", r.autocomplete = "off", r.spellcheck = !1, r.className = "ui-prop__editor-input ui-prop__editor-input--numero", t.placeholder && (r.placeholder = t.placeholder);
  const a = (s) => {
    if (s == null || s === "") return "";
    const l = Number(s);
    return isNaN(l) ? String(s) : t.casasDecimais !== void 0 ? l.toFixed(t.casasDecimais) : String(l);
  };
  r.value = a(e), r.addEventListener("focus", () => {
    r.select();
  }), r.addEventListener("input", () => {
    const s = r.value, l = /[\+\-\*\/\^\%\(\)]/.test(s) && !/^[+-]?[0-9]*\.?[0-9]*$/.test(s.trim());
    r.classList.toggle("ui-prop__editor-input--calculando", l);
  });
  const c = () => {
    r.classList.remove("ui-prop__editor-input--calculando");
    const s = r.value.trim();
    if (s === "") {
      i.registrarAlteracao(o, t.id, null);
      return;
    }
    const l = oe(s);
    if (l !== null && !isNaN(l)) {
      let u = l;
      t.casasDecimais !== void 0 && (u = Number(l.toFixed(t.casasDecimais))), r.value = a(u), u !== i.obterValorAtual(t.id) && i.registrarAlteracao(o, t.id, u);
    } else
      r.value = a(i.obterValorAtual(t.id));
  };
  return r.addEventListener("change", c), r.addEventListener("blur", c), r.addEventListener("keydown", (s) => {
    if (s.key === "Enter")
      c(), i.focarProximoEditor(r);
    else if (s.key === "Escape")
      r.classList.remove("ui-prop__editor-input--calculando"), r.value = a(i.obterValorAtual(t.id)), r.blur();
    else if (s.key === "ArrowUp" || s.key === "ArrowDown") {
      s.preventDefault();
      const l = parseFloat(r.value) || 0;
      let u = t.casasDecimais !== void 0 ? Math.pow(10, -t.casasDecimais) : 1;
      s.shiftKey ? u *= 10 : s.altKey && (u *= 0.1);
      let d = s.key === "ArrowUp" ? l + u : l - u;
      t.casasDecimais !== void 0 ? d = Number(d.toFixed(t.casasDecimais)) : d = Math.round(d * 100) / 100, r.value = a(d), i.registrarAlteracao(o, t.id, d);
    }
  }), r;
}
function le(o, t, e, i) {
  const r = document.createElement("input");
  r.type = "text", r.className = "ui-prop__editor-input", t.placeholder && (r.placeholder = t.placeholder), r.value = e != null ? String(e) : "", r.addEventListener("focus", () => {
    r.select();
  });
  const a = () => {
    r.value !== i.obterValorAtual(t.id) && i.registrarAlteracao(o, t.id, r.value);
  };
  return r.addEventListener("change", a), r.addEventListener("keydown", (c) => {
    c.key === "Enter" ? (a(), i.focarProximoEditor(r)) : c.key === "Escape" && (r.value = String(i.obterValorAtual(t.id) ?? ""), r.blur());
  }), r;
}
function de(o, t, e, i) {
  const r = document.createElement("div");
  r.className = "ui-prop__editor-linha-container";
  const a = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  a.setAttribute("class", "ui-prop__linha-amostra-svg"), a.setAttribute("viewBox", "0 0 44 12");
  const c = document.createElementNS("http://www.w3.org/2000/svg", "line");
  c.setAttribute("x1", "0"), c.setAttribute("y1", "6"), c.setAttribute("x2", "44"), c.setAttribute("y2", "6");
  const s = (d) => {
    const n = String(d || "").toLowerCase();
    n.includes("dash") || n.includes("tracej") || n.includes("hidden") ? c.setAttribute("stroke-dasharray", "6,3") : n.includes("dot") || n.includes("ponto") || n.includes("pontilh") ? c.setAttribute("stroke-dasharray", "2,3") : n.includes("center") || n.includes("eixo") ? c.setAttribute("stroke-dasharray", "8,3,2,3") : c.setAttribute("stroke-dasharray", "none");
  };
  s(e), a.appendChild(c);
  const l = document.createElement("select");
  return l.className = "ui-prop__linha-select", (t.opcoes && t.opcoes.length > 0 ? t.opcoes : [
    { id: "ByLayer", rotulo: "ByLayer" },
    { id: "ByBlock", rotulo: "ByBlock" },
    { id: "Continuous", rotulo: "Continuous" },
    { id: "Dashed", rotulo: "Dashed" },
    { id: "Hidden", rotulo: "Hidden" },
    { id: "Center", rotulo: "Center" },
    { id: "Dotted", rotulo: "Dotted" }
  ]).forEach((d) => {
    const n = document.createElement("option");
    n.value = String(d.id), n.textContent = d.rotulo, String(d.id).toLowerCase() === String(e).toLowerCase() && (n.selected = !0), l.appendChild(n);
  }), l.addEventListener("change", () => {
    s(l.value), i.registrarAlteracao(o, t.id, l.value);
  }), l.addEventListener("keydown", (d) => {
    d.key === "Enter" && i.focarProximoEditor(l);
  }), r.appendChild(a), r.appendChild(l), r;
}
function ce(o, t, e, i) {
  const r = document.createElement("div");
  r.className = "ui-prop__editor-espessura-container";
  const a = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  a.setAttribute("class", "ui-prop__espessura-amostra-svg"), a.setAttribute("viewBox", "0 0 38 12");
  const c = document.createElementNS("http://www.w3.org/2000/svg", "line");
  c.setAttribute("x1", "0"), c.setAttribute("y1", "6"), c.setAttribute("x2", "38"), c.setAttribute("y2", "6");
  const s = (d) => {
    const n = parseFloat(String(d).replace(/[^0-9.]/g, ""));
    return isNaN(n) || n <= 0 ? 1.5 : Math.min(8, Math.max(1, n * 8));
  };
  c.setAttribute("stroke-width", String(s(e))), a.appendChild(c);
  const l = document.createElement("select");
  return l.className = "ui-prop__espessura-select", (t.opcoes && t.opcoes.length > 0 ? t.opcoes : [
    { id: "ByLayer", rotulo: "ByLayer" },
    { id: "ByBlock", rotulo: "ByBlock" },
    { id: "0.00 mm", rotulo: "0.00 mm" },
    { id: "0.05 mm", rotulo: "0.05 mm" },
    { id: "0.09 mm", rotulo: "0.09 mm" },
    { id: "0.13 mm", rotulo: "0.13 mm" },
    { id: "0.15 mm", rotulo: "0.15 mm" },
    { id: "0.18 mm", rotulo: "0.18 mm" },
    { id: "0.20 mm", rotulo: "0.20 mm" },
    { id: "0.25 mm", rotulo: "0.25 mm" },
    { id: "0.30 mm", rotulo: "0.30 mm" },
    { id: "0.35 mm", rotulo: "0.35 mm" },
    { id: "0.40 mm", rotulo: "0.40 mm" },
    { id: "0.50 mm", rotulo: "0.50 mm" },
    { id: "0.60 mm", rotulo: "0.60 mm" },
    { id: "0.70 mm", rotulo: "0.70 mm" },
    { id: "1.00 mm", rotulo: "1.00 mm" },
    { id: "1.40 mm", rotulo: "1.40 mm" },
    { id: "2.00 mm", rotulo: "2.00 mm" }
  ]).forEach((d) => {
    const n = document.createElement("option");
    n.value = String(d.id), n.textContent = d.rotulo, String(d.id).toLowerCase() === String(e).toLowerCase() && (n.selected = !0), l.appendChild(n);
  }), l.addEventListener("change", () => {
    c.setAttribute("stroke-width", String(s(l.value))), i.registrarAlteracao(o, t.id, l.value);
  }), l.addEventListener("keydown", (d) => {
    d.key === "Enter" && i.focarProximoEditor(l);
  }), r.appendChild(a), r.appendChild(l), r;
}
function ue(o, t, e, i) {
  const r = document.createElement("div");
  r.className = "ui-prop__editor-cor-cad-container";
  const a = document.createElement("div");
  a.className = "ui-prop__cor-amostra";
  const c = (d) => {
    const n = String(d).toLowerCase();
    return n === "red" || n === "1" ? "#ff0000" : n === "yellow" || n === "2" ? "#ffff00" : n === "green" || n === "3" ? "#00ff00" : n === "cyan" || n === "4" ? "#00ffff" : n === "blue" || n === "5" ? "#0000ff" : n === "magenta" || n === "6" ? "#ff00ff" : n === "white" || n === "7" || n === "bylayer" || n === "byblock" ? "#ffffff" : n.startsWith("#") ? n : "#ffffff";
  };
  a.style.backgroundColor = c(e);
  const s = document.createElement("select");
  s.className = "ui-prop__cor-cad-select", [
    { id: "ByLayer", rotulo: "ByLayer" },
    { id: "ByBlock", rotulo: "ByBlock" },
    { id: "Red", rotulo: "Red (1)" },
    { id: "Yellow", rotulo: "Yellow (2)" },
    { id: "Green", rotulo: "Green (3)" },
    { id: "Cyan", rotulo: "Cyan (4)" },
    { id: "Blue", rotulo: "Blue (5)" },
    { id: "Magenta", rotulo: "Magenta (6)" },
    { id: "White", rotulo: "White (7)" },
    { id: "custom", rotulo: "Selecionar cor..." }
  ].forEach((d) => {
    const n = document.createElement("option");
    n.value = d.id, n.textContent = d.rotulo, String(d.id).toLowerCase() === String(e).toLowerCase() && (n.selected = !0), s.appendChild(n);
  });
  const u = document.createElement("input");
  return u.type = "color", u.className = "ui-prop__cor-picker-oculto", u.addEventListener("input", () => {
    const d = u.value;
    a.style.backgroundColor = d, i.registrarAlteracao(o, t.id, d);
  }), s.addEventListener("change", () => {
    s.value === "custom" ? u.click() : (a.style.backgroundColor = c(s.value), i.registrarAlteracao(o, t.id, s.value));
  }), s.addEventListener("keydown", (d) => {
    d.key === "Enter" && i.focarProximoEditor(s);
  }), r.appendChild(a), r.appendChild(s), r.appendChild(u), r;
}
function pe(o, t, e, i) {
  const r = document.createElement("div");
  r.className = "ui-prop__editor-cor-container";
  const a = document.createElement("div");
  a.className = "ui-prop__cor-amostra", a.style.backgroundColor = e || "#ffffff";
  const c = document.createElement("span");
  c.className = "ui-prop__cor-texto", c.textContent = t.textoAmostra || String(e || "ByLayer");
  const s = document.createElement("input");
  return s.type = "color", s.className = "ui-prop__cor-picker-oculto", s.value = typeof e == "string" && e.startsWith("#") ? e : "#ffffff", s.addEventListener("input", () => {
    const l = s.value;
    a.style.backgroundColor = l, c.textContent = l, i.registrarAlteracao(o, t.id, l);
  }), r.addEventListener("click", () => {
    s.click();
  }), r.appendChild(a), r.appendChild(c), r.appendChild(s), r;
}
function he(o, t, e, i) {
  return t.somenteLeitura || t.tipo === "readonly" ? ie(e) : t.tipo === "booleano" ? re(o, t, e, i) : t.tipo === "linha" || t.tipo === "linetype" ? de(o, t, e, i) : t.tipo === "espessura" || t.tipo === "lineweight" ? ce(o, t, e, i) : t.tipo === "cor-cad" ? ue(o, t, e, i) : t.tipo === "selecao" ? ae(o, t, e, i) : t.tipo === "cor" ? pe(o, t, e, i) : t.tipo === "acao" ? ne(o, t, i) : t.tipo === "numero" ? se(o, t, e, i) : le(o, t, e, i);
}
function me(o) {
  if (!o.tipoContainerElement) return;
  if (!o.tipos || o.tipos.length === 0) {
    o.tipoContainerElement.style.display = "none";
    return;
  }
  o.tipoContainerElement.style.display = "flex", o.tipoContainerElement.innerHTML = "";
  const t = o.tipos.find((e) => String(e.id) === String(o.tipoSelecionadoId)) || o.tipos[0];
  if (o.estiloVisual === "revit") {
    const e = document.createElement("div");
    e.className = "ui-prop__tipo-revit-card";
    const i = document.createElement("div");
    i.className = "ui-prop__tipo-miniatura", t.iconeSvg ? i.innerHTML = t.iconeSvg : i.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2"></rect>
          <path d="M3 9h18M9 21V9"></path>
        </svg>
      `;
    const r = document.createElement("div");
    r.className = "ui-prop__tipo-info";
    const a = document.createElement("div");
    a.className = "ui-prop__tipo-nome", a.textContent = t.rotulo;
    const c = document.createElement("div");
    c.className = "ui-prop__tipo-subtexto", c.textContent = t.subtipo || "Tipo de Família", r.appendChild(a), r.appendChild(c), e.appendChild(i), e.appendChild(r);
    const s = document.createElement("div");
    s.className = "ui-prop__tipo-revit-subbarra";
    const l = document.createElement("select");
    l.className = "ui-prop__tipo-select", o.tipos.forEach((d) => {
      const n = document.createElement("option");
      n.value = d.id, n.textContent = `${d.rotulo}${d.subtipo ? ` : ${d.subtipo}` : ""}`, String(d.id) === String(o.tipoSelecionadoId) && (n.selected = !0), l.appendChild(n);
    }), l.addEventListener("change", () => {
      o.onSelecionarTipo(l.value);
    });
    const u = document.createElement("button");
    u.type = "button", u.className = "ui-prop__btn-editar-tipo", u.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px; vertical-align: -1px;">
        <rect x="3" y="3" width="12" height="12" rx="1"></rect>
        <rect x="9" y="9" width="12" height="12" rx="1"></rect>
      </svg>
      <span>Editar tipo</span>
    `, u.addEventListener("click", () => {
      o.onEditarTipo(t);
    }), s.appendChild(l), s.appendChild(u), o.tipoContainerElement.appendChild(e), o.tipoContainerElement.appendChild(s);
  } else {
    const e = document.createElement("div");
    e.className = "ui-prop__tipo-autocad-bar";
    const i = document.createElement("select");
    i.className = "ui-prop__tipo-select", o.tipos.forEach((l) => {
      const u = document.createElement("option");
      u.value = l.id, u.textContent = l.rotulo, String(l.id) === String(o.tipoSelecionadoId) && (u.selected = !0), i.appendChild(u);
    }), i.addEventListener("change", () => {
      o.onSelecionarTipo(i.value);
    });
    const r = document.createElement("div");
    r.className = "ui-prop__tipo-autocad-acoes";
    const a = document.createElement("button");
    a.type = "button", a.className = "ui-prop__btn-autocad", a.title = "Seleção rápida", a.setAttribute("aria-label", "Seleção rápida"), a.innerHTML = `
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
      </svg>
    `, a.addEventListener("click", () => {
      o.onQuickSelect(t);
    });
    const c = document.createElement("button");
    c.type = "button", c.className = "ui-prop__btn-autocad", c.title = "Selecionar objetos", c.setAttribute("aria-label", "Selecionar objetos"), c.innerHTML = `
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="7"></circle>
        <line x1="12" y1="2" x2="12" y2="7"></line>
        <line x1="12" y1="17" x2="12" y2="22"></line>
        <line x1="2" y1="12" x2="7" y2="12"></line>
        <line x1="17" y1="12" x2="22" y2="12"></line>
        <line x1="12" y1="9" x2="12" y2="15" stroke-width="2.5"></line>
        <line x1="9" y1="12" x2="15" y2="12" stroke-width="2.5"></line>
      </svg>
    `, c.addEventListener("click", () => {
      o.onSelectObjects(t);
    });
    const s = document.createElement("button");
    s.type = "button", s.className = "ui-prop__btn-autocad", s.title = "Calculadora rápida", s.setAttribute("aria-label", "Calculadora rápida"), s.innerHTML = `
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="4" y="2" width="16" height="20" rx="2"></rect>
        <line x1="8" y1="6" x2="16" y2="6"></line>
        <circle cx="8" cy="11" r="1" fill="currentColor"></circle>
        <circle cx="12" cy="11" r="1" fill="currentColor"></circle>
        <circle cx="16" cy="11" r="1" fill="currentColor"></circle>
        <circle cx="8" cy="15" r="1" fill="currentColor"></circle>
        <circle cx="12" cy="15" r="1" fill="currentColor"></circle>
        <circle cx="16" cy="15" r="1" fill="currentColor"></circle>
      </svg>
    `, s.addEventListener("click", () => {
      o.onCalculadora(t);
    }), r.appendChild(a), r.appendChild(c), r.appendChild(s), e.appendChild(i), e.appendChild(r), o.tipoContainerElement.appendChild(e);
  }
}
function fe(o) {
  let t = 45;
  function e(r) {
    const a = Math.max(20, Math.min(65, r));
    return t = a, o.hostElement.style.setProperty("--ui-prop-rotulo-largura", `${a}%`), o.splitterElement && (o.splitterElement.style.left = `calc(${a}% - 4px)`), a;
  }
  function i() {
    if (!o.splitterElement || !o.corpoElement) return;
    o.splitterListeners.cleanup();
    let r = !1;
    const a = (c) => {
      if (c.button !== 0) return;
      c.preventDefault(), c.stopPropagation(), r = !0, o.splitterElement.classList.add("ui-prop__splitter--ativo");
      try {
        o.splitterElement.setPointerCapture(c.pointerId);
      } catch {
      }
      const s = o.corpoElement.getBoundingClientRect(), l = (d) => {
        if (!r) return;
        const n = s.width;
        if (n <= 0) return;
        const p = d.clientX - s.left;
        let g = Math.max(80, Math.min(n - 130, p)) / n * 100;
        g = Math.max(20, Math.min(65, g)), e(g);
      }, u = (d) => {
        if (r) {
          r = !1, o.splitterElement.classList.remove("ui-prop__splitter--ativo");
          try {
            o.splitterElement.hasPointerCapture(d.pointerId) && o.splitterElement.releasePointerCapture(d.pointerId);
          } catch {
          }
          o.splitterElement.removeEventListener("pointermove", l), o.splitterElement.removeEventListener("pointerup", u), o.splitterElement.removeEventListener("pointercancel", u), o.onLarguraAlterada(t), o.hostElement.dispatchEvent(
            new CustomEvent("ui-splitter-resize", {
              bubbles: !0,
              composed: !0,
              detail: { larguraPorcentagem: t }
            })
          );
        }
      };
      o.splitterElement.addEventListener("pointermove", l), o.splitterElement.addEventListener("pointerup", u), o.splitterElement.addEventListener("pointercancel", u);
    };
    o.splitterListeners.add(o.splitterElement, "pointerdown", a), o.splitterListeners.add(o.splitterElement, "dblclick", () => {
      e(45), o.onLarguraAlterada(45), o.hostElement.dispatchEvent(
        new CustomEvent("ui-splitter-resize", {
          bubbles: !0,
          composed: !0,
          detail: { larguraPorcentagem: 45 }
        })
      );
    });
  }
  return {
    init: i,
    definirLarguraRotulo: e
  };
}
const ge = `:host{display:flex;flex-direction:column;box-sizing:border-box;font-family:var(--ui-fonte-familia, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);font-size:var(--ui-tamanho-corpo-sm, 12px);color:var(--ui-cor-texto, #e1e1e6);background-color:var(--ui-cor-superficie, #141417);border:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .12));border-radius:var(--ui-raio-borda, 4px);overflow:hidden;width:100%;max-width:100%;height:100%;min-height:200px;-webkit-user-select:none;user-select:none;--ui-prop-altura-linha: 22px;--ui-prop-rotulo-largura: 45%}:host([densidade="compacta"]){--ui-prop-altura-linha: 19px;font-size:10.5px}:host([densidade="ultracompacta"]){--ui-prop-altura-linha: 17px;font-size:10px}:host([densidade="relaxada"]){--ui-prop-altura-linha: 28px;font-size:12px}:host([colapsado]){width:32px!important;min-width:32px!important;max-width:32px!important;height:100%!important;cursor:pointer;transition:width .2s cubic-bezier(.4,0,.2,1)}:host([colapsado]) .ui-prop__header,:host([colapsado]) .ui-prop__tipo-seletor-container,:host([colapsado]) .ui-prop__filtro-container,:host([colapsado]) .ui-prop__corpo-wrapper,:host([colapsado]) .ui-prop__footer,:host([colapsado]) .ui-prop__resizer-canto{display:none!important}:host([colapsado]) .ui-prop__faixa-estreita{display:flex!important;flex-direction:column;align-items:center;width:100%;height:100%;padding:8px 0;gap:10px;box-sizing:border-box;background-color:var(--ui-cor-fundo-elevado, #18181d);-webkit-user-select:none;user-select:none;cursor:pointer}.ui-prop__faixa-estreita{display:none}.ui-prop__faixa-icone{display:flex;align-items:center;justify-content:center;color:var(--ui-cor-destaque, #00E08A);flex-shrink:0}.ui-prop__faixa-btn-expandir{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;background:#ffffff0d;border:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .12));border-radius:3px;color:var(--ui-cor-texto, #e1e1e6);cursor:pointer;padding:0;transition:all .15s ease;flex-shrink:0}.ui-prop__faixa-btn-expandir:hover{background-color:var(--ui-cor-destaque, #00E08A);color:#000;border-color:var(--ui-cor-destaque, #00E08A)}.ui-prop__faixa-texto{writing-mode:vertical-rl;text-orientation:mixed;transform:rotate(180deg);font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:2px;color:var(--ui-cor-texto-secundario, #888899);margin-top:8px;flex:1;pointer-events:none}:host([colapsado]):hover .ui-prop__faixa-texto{color:var(--ui-cor-texto, #ffffff)}:host([flutuante]){position:fixed!important;z-index:1050!important;box-shadow:0 16px 48px #000000bf,0 0 0 1px #ffffff24,0 6px 14px #00000080!important;border-radius:6px!important;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);resize:both;overflow:hidden;max-width:95vw;max-height:95vh;min-width:220px;min-height:200px}:host([flutuante]) .ui-prop__header{cursor:grab;-webkit-user-select:none;user-select:none}:host([flutuante].arrastando) .ui-prop__header{cursor:grabbing!important}.ui-prop__resizer-canto{display:none}:host([flutuante]) .ui-prop__resizer-canto{display:block;position:absolute;bottom:0;right:0;width:14px;height:14px;cursor:nwse-resize;z-index:50;background:linear-gradient(135deg,transparent 50%,rgba(255,255,255,.25) 50%,rgba(255,255,255,.25) 65%,transparent 65%,transparent 80%,rgba(255,255,255,.25) 80%);pointer-events:auto}.ui-prop__btn-icone--ativo{background-color:#00e08a2e!important;color:var(--ui-cor-destaque, #00E08A)!important}.ui-prop__container{display:flex;flex-direction:column;width:100%;height:100%;min-height:0;flex:1;overflow:hidden;box-sizing:border-box}.ui-prop__header{display:flex;align-items:center;justify-content:space-between;height:22px;min-height:22px;padding:0 8px;background-color:var(--ui-cor-fundo-elevado, #1a1a1e);border-bottom:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .12));flex-shrink:0;box-sizing:border-box}:host([densidade="compacta"]) .ui-prop__header{height:20px;min-height:20px;padding:0 6px}:host([densidade="ultracompacta"]) .ui-prop__header{height:18px;min-height:18px;padding:0 5px}.ui-prop__header-titulo{display:flex;align-items:center;gap:5px;font-size:10.5px;font-weight:600;color:var(--ui-cor-texto, #ffffff);text-transform:uppercase;letter-spacing:.4px}:host([densidade="compacta"]) .ui-prop__header-titulo{font-size:10px;gap:4px}:host([densidade="ultracompacta"]) .ui-prop__header-titulo{font-size:9.5px;gap:3px}.ui-prop__header-icone{display:flex;align-items:center;color:var(--ui-cor-destaque, #00E08A)}.ui-prop__header-icone svg{width:12px;height:12px}:host([densidade="ultracompacta"]) .ui-prop__header-icone svg{width:10px;height:10px}.ui-prop__header-acoes{display:flex;align-items:center;gap:2px}.ui-prop__btn-icone{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;background:transparent;border:none;border-radius:2px;color:var(--ui-cor-texto-secundario, #888899);cursor:pointer;transition:all .15s ease;padding:0}.ui-prop__btn-icone:hover{background-color:var(--ui-cor-hover-menu, rgba(255, 255, 255, .08));color:var(--ui-cor-texto, #ffffff)}:host([densidade="compacta"]) .ui-prop__btn-icone{width:17px;height:17px}:host([densidade="ultracompacta"]) .ui-prop__btn-icone{width:16px;height:16px}.ui-prop__tipo-seletor-container{padding:3px 6px;background-color:var(--ui-cor-superficie, #141417);border-bottom:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .08));display:flex;flex-direction:column;gap:3px;flex-shrink:0;box-sizing:border-box}:host([densidade="compacta"]) .ui-prop__tipo-seletor-container{padding:2px 5px;gap:2px}:host([densidade="ultracompacta"]) .ui-prop__tipo-seletor-container{padding:1px 4px;gap:1px}.ui-prop__tipo-revit-card{display:flex;align-items:center;gap:10px;background-color:var(--ui-cor-fundo-card, #18181c);border:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .12));border-radius:4px;padding:6px 8px;cursor:pointer;transition:border-color .15s ease}.ui-prop__tipo-revit-card:hover{border-color:var(--ui-cor-destaque, #00E08A)}.ui-prop__tipo-miniatura{width:32px;height:32px;border-radius:3px;background-color:var(--ui-cor-fundo-elevado, #24242a);display:flex;align-items:center;justify-content:center;color:var(--ui-cor-destaque, #00E08A);flex-shrink:0}.ui-prop__tipo-info{display:flex;flex-direction:column;flex:1;min-width:0}.ui-prop__tipo-nome{font-weight:600;font-size:12px;color:var(--ui-cor-texto, #ffffff);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ui-prop__tipo-subtexto{font-size:11px;color:var(--ui-cor-texto-secundario, #888899);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ui-prop__tipo-revit-subbarra{display:flex;align-items:center;gap:6px}.ui-prop__tipo-select{flex:1;min-width:0;width:0;height:20px;background-color:transparent;color:var(--ui-cor-texto, #ffffff);border:none;border-radius:2px;padding:0 16px 0 2px;font-size:10.5px;font-weight:500;cursor:pointer;outline:none;appearance:none;-webkit-appearance:none;-moz-appearance:none;background-image:url("data:image/svg+xml,%3Csvg width='8' height='5' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23888899' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 4px center;background-size:8px 5px;text-overflow:ellipsis;overflow:hidden;white-space:nowrap;box-sizing:border-box;transition:background-color .15s ease,color .15s ease}.ui-prop__tipo-select:hover{background-color:#ffffff0d;color:#fff}.ui-prop__tipo-select:focus{background-color:#00e08a14;color:var(--ui-cor-destaque, #00E08A)}:host([densidade="compacta"]) .ui-prop__tipo-select{height:18px;font-size:10px;padding:0 14px 0 2px}:host([densidade="ultracompacta"]) .ui-prop__tipo-select{height:16px;font-size:9.5px;padding:0 12px 0 2px}.ui-prop__btn-editar-tipo{height:20px;padding:0 6px;background-color:transparent;border:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .12));border-radius:2px;color:var(--ui-cor-texto, #ffffff);font-size:10.5px;font-weight:500;cursor:pointer;white-space:nowrap;transition:all .15s ease}:host([densidade="compacta"]) .ui-prop__btn-editar-tipo{height:18px;font-size:10px}:host([densidade="ultracompacta"]) .ui-prop__btn-editar-tipo{height:16px;font-size:9.5px}.ui-prop__btn-editar-tipo:hover{background-color:var(--ui-cor-botao-secundario-hover, #2a2a34);border-color:var(--ui-cor-destaque, #00E08A)}.ui-prop__tipo-autocad-bar{display:flex;align-items:center;gap:2px;width:100%;min-width:0;box-sizing:border-box;background:transparent}.ui-prop__tipo-autocad-acoes{display:flex;align-items:center;gap:1px;flex-shrink:0;border-left:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .08));padding-left:3px;margin-left:1px}.ui-prop__btn-autocad{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;background:transparent;border:none;border-radius:2px;color:var(--ui-cor-texto-secundario, #888899);cursor:pointer;padding:0;transition:all .15s ease}:host([densidade="compacta"]) .ui-prop__btn-autocad{width:18px;height:18px}:host([densidade="ultracompacta"]) .ui-prop__btn-autocad{width:16px;height:16px}.ui-prop__btn-autocad:hover{background-color:var(--ui-cor-hover-menu, rgba(255, 255, 255, .1));color:var(--ui-cor-destaque, #00E08A)}.ui-prop__btn-autocad:active{transform:scale(.92);background-color:#00e08a26}.ui-prop__filtro-container{display:flex;align-items:center;padding:4px 8px;background-color:var(--ui-cor-fundo, #0b0b0d);border-bottom:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .08));gap:6px;flex-shrink:0}.ui-prop__filtro-icone{color:var(--ui-cor-texto-secundario, #888899);flex-shrink:0}.ui-prop__filtro-input{flex:1;background:transparent;border:none;outline:none;font-size:11px;color:var(--ui-cor-texto, #e1e1e6);padding:3px 0}.ui-prop__filtro-input::placeholder{color:var(--ui-cor-texto-secundario, #666677)}.ui-prop__corpo-wrapper{position:relative;flex:1;min-height:0;width:100%;overflow:hidden;display:flex;flex-direction:column}.ui-prop__corpo{flex:1;min-height:0;width:100%;overflow-y:auto;overflow-x:hidden;background-color:var(--ui-cor-superficie, #141417);position:relative;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.18) var(--ui-cor-fundo, #0b0b0d)}.ui-prop__corpo::-webkit-scrollbar{width:8px}.ui-prop__corpo::-webkit-scrollbar-track{background:var(--ui-cor-fundo, #0b0b0d)}.ui-prop__corpo::-webkit-scrollbar-thumb{background:#ffffff2e;border-radius:4px}.ui-prop__corpo::-webkit-scrollbar-thumb:hover{background:#ffffff4d}.ui-prop__categoria{border-bottom:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .1))}.ui-prop__categoria-header{position:relative;z-index:25;display:flex;align-items:center;justify-content:space-between;height:21px;padding:0 6px;background-color:var(--ui-cor-fundo-elevado, #18181d);cursor:pointer;-webkit-user-select:none;user-select:none;font-weight:600;font-size:10.5px;color:var(--ui-cor-texto, #ffffff);border-top:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .05));transition:background-color .15s ease;box-sizing:border-box}:host([densidade="compacta"]) .ui-prop__categoria-header{height:19px;font-size:10px;padding:0 5px}:host([densidade="ultracompacta"]) .ui-prop__categoria-header{height:17px;font-size:9.5px;padding:0 4px}.ui-prop__categoria-header:hover{background-color:var(--ui-cor-hover-menu, rgba(255, 255, 255, .06))}.ui-prop__categoria-titulo-bloco{display:flex;align-items:center;gap:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ui-prop__categoria-seta{display:inline-flex;align-items:center;justify-content:center;font-size:9px;width:12px;height:12px;color:var(--ui-cor-texto-secundario, #888899);transition:transform .15s ease}.ui-prop__categoria--aberta .ui-prop__categoria-seta{transform:rotate(90deg)}.ui-prop__categoria-contador{font-size:10px;font-weight:400;color:var(--ui-cor-texto-secundario, #888899)}.ui-prop__categoria-conteudo{display:none}.ui-prop__categoria--aberta .ui-prop__categoria-conteudo{display:block}.ui-prop__linha{display:flex;align-items:stretch;min-height:var(--ui-prop-altura-linha, 24px);border-bottom:1px dotted var(--ui-cor-borda, rgba(255, 255, 255, .08));box-sizing:border-box;position:relative;z-index:1;transition:background-color .1s ease}.ui-prop__linha:hover{background-color:var(--ui-cor-hover-menu, rgba(255, 255, 255, .04))}.ui-prop__linha:focus-within{background-color:#00e08a14}.ui-prop__linha:focus-within .ui-prop__col-rotulo{color:var(--ui-cor-texto, #ffffff);font-weight:500}.ui-prop__linha--modificada{background-color:#00e08a0d}.ui-prop__col-rotulo{width:var(--ui-prop-rotulo-largura, 45%);padding:1px 4px 1px 8px;display:flex;align-items:center;color:var(--ui-cor-texto-secundario, #9999aa);border-right:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .08));overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10.5px;position:relative;flex-shrink:0;box-sizing:border-box}:host([densidade="compacta"]) .ui-prop__col-rotulo{padding:0 4px 0 6px;font-size:10px}:host([densidade="ultracompacta"]) .ui-prop__col-rotulo{padding:0 3px 0 5px;font-size:9.5px}.ui-prop__col-rotulo span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ui-prop__col-rotulo--scrub{cursor:ew-resize;-webkit-user-select:none;user-select:none;transition:color .15s ease,background-color .15s ease}.ui-prop__col-rotulo--scrub:hover{color:var(--ui-cor-destaque, #00E08A);background-color:#00e08a0d}.ui-prop__col-rotulo--arrastando{color:#000!important;background-color:var(--ui-cor-destaque, #00E08A)!important;font-weight:600;cursor:ew-resize!important}.ui-prop__col-rotulo--arrastando span{color:#000!important}.ui-prop__splitter{position:absolute;top:0;bottom:0;min-height:100%;left:calc(var(--ui-prop-rotulo-largura, 45%) - 4px);width:8px;cursor:col-resize;z-index:30;touch-action:none;-webkit-user-select:none;user-select:none;display:flex;align-items:center;justify-content:center}.ui-prop__splitter:after{content:"";position:absolute;top:0;bottom:0;left:3px;width:2px;background-color:transparent;pointer-events:none;transition:background-color .15s ease,box-shadow .15s ease}.ui-prop__splitter:hover:after,.ui-prop__splitter--ativo:after{background-color:var(--ui-cor-destaque, #00E08A);box-shadow:0 0 6px #00e08a80}.ui-prop__splitter--ativo{background-color:#00e08a14}.ui-prop__col-valor{width:calc(100% - var(--ui-prop-rotulo-largura, 45%));flex:1 1 0px;min-width:0!important;display:flex;align-items:stretch;padding:0;overflow:hidden;box-sizing:border-box;position:relative;transition:background-color .1s ease,box-shadow .1s ease}.ui-prop__col-valor:focus-within{background-color:var(--ui-cor-fundo, #0b0b0d);box-shadow:inset 0 0 0 1px var(--ui-cor-destaque, #00E08A)}.ui-prop__editor-input{width:100%;min-width:0;height:100%;min-height:var(--ui-prop-altura-linha, 24px);background:transparent;border:none;border-radius:0;color:var(--ui-cor-texto, #ffffff);font-family:inherit;font-size:11px;padding:0 8px;outline:none;box-sizing:border-box;transition:background-color .1s ease}.ui-prop__editor-input:hover{background-color:#ffffff08}.ui-prop__editor-input--numero{text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-variant-numeric:tabular-nums}.ui-prop__editor-input--calculando{color:var(--ui-cor-destaque, #00E08A)!important;font-weight:500}.ui-prop__col-valor:has(.ui-prop__editor-input--calculando){background-color:#00e08a14!important;box-shadow:inset 0 0 0 1.5px var(--ui-cor-destaque, #00E08A)!important}.ui-prop__editor-select{flex:1 1 0px;min-width:0!important;width:0!important;max-width:100%;height:100%;min-height:var(--ui-prop-altura-linha, 24px);background-color:transparent;color:var(--ui-cor-texto, #ffffff);border:none;border-radius:0;font-size:11px;padding:0 20px 0 8px;outline:none;cursor:pointer;box-sizing:border-box;appearance:none;-webkit-appearance:none;-moz-appearance:none;background-image:url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23888899' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 6px center;background-size:8px 5px;text-overflow:ellipsis;overflow:hidden;white-space:nowrap;transition:background-color .1s ease}.ui-prop__editor-select:hover{background-color:#ffffff08}.ui-prop__editor-select option{background-color:var(--ui-cor-fundo-elevado, #18181c);color:var(--ui-cor-texto, #ffffff)}.ui-prop__editor-cor-container{display:flex;align-items:center;gap:6px;width:100%;max-width:100%;min-width:0!important;height:100%;min-height:var(--ui-prop-altura-linha, 24px);cursor:pointer;padding:0 20px 0 8px;box-sizing:border-box;position:relative;border:none;border-radius:0;background-image:url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23888899' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 6px center;background-size:8px 5px;transition:background-color .1s ease}.ui-prop__editor-cor-container:hover{background-color:#ffffff0a}.ui-prop__cor-amostra{width:13px;height:13px;border-radius:2px;border:1px solid rgba(255,255,255,.3);flex-shrink:0;box-sizing:border-box}.ui-prop__cor-texto{flex:1 1 0px;min-width:0!important;width:0!important;font-size:11px;color:var(--ui-cor-texto, #ffffff);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ui-prop__cor-picker-oculto{position:absolute;opacity:0;pointer-events:none;width:0;height:0}.ui-prop__editor-linha-container{display:flex;align-items:center;gap:6px;width:100%;max-width:100%;min-width:0!important;height:100%;min-height:var(--ui-prop-altura-linha, 24px);padding:0 0 0 8px;box-sizing:border-box;overflow:hidden;border:none;border-radius:0}.ui-prop__linha-amostra-svg{width:24px;height:10px;flex-shrink:0}.ui-prop__linha-amostra-svg line{stroke:var(--ui-cor-texto, #e1e1e6);stroke-width:1.5}.ui-prop__linha-select{flex:1 1 0px;min-width:0!important;width:0!important;max-width:100%;height:100%;background:transparent;color:var(--ui-cor-texto, #ffffff);border:none;border-radius:0;font-size:11px;padding:0 20px 0 4px;outline:none;cursor:pointer;box-sizing:border-box;appearance:none;-webkit-appearance:none;-moz-appearance:none;background-image:url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23888899' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 6px center;background-size:8px 5px;text-overflow:ellipsis;overflow:hidden;white-space:nowrap}.ui-prop__linha-select:hover{background-color:#ffffff08}.ui-prop__linha-select option{background-color:var(--ui-cor-fundo-elevado, #18181c);color:var(--ui-cor-texto, #ffffff)}.ui-prop__editor-espessura-container{display:flex;align-items:center;gap:6px;width:100%;max-width:100%;min-width:0!important;height:100%;min-height:var(--ui-prop-altura-linha, 24px);padding:0 0 0 8px;box-sizing:border-box;overflow:hidden;border:none;border-radius:0}.ui-prop__espessura-amostra-svg{width:20px;height:10px;flex-shrink:0}.ui-prop__espessura-amostra-svg line{stroke:var(--ui-cor-texto, #e1e1e6)}.ui-prop__espessura-select{flex:1 1 0px;min-width:0!important;width:0!important;max-width:100%;height:100%;background:transparent;color:var(--ui-cor-texto, #ffffff);border:none;border-radius:0;font-size:11px;padding:0 20px 0 4px;outline:none;cursor:pointer;box-sizing:border-box;appearance:none;-webkit-appearance:none;-moz-appearance:none;background-image:url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23888899' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 6px center;background-size:8px 5px;text-overflow:ellipsis;overflow:hidden;white-space:nowrap}.ui-prop__espessura-select:hover{background-color:#ffffff08}.ui-prop__espessura-select option{background-color:var(--ui-cor-fundo-elevado, #18181c);color:var(--ui-cor-texto, #ffffff)}.ui-prop__editor-cor-cad-container{display:flex;align-items:center;gap:6px;width:100%;max-width:100%;min-width:0!important;height:100%;min-height:var(--ui-prop-altura-linha, 24px);padding:0 0 0 8px;box-sizing:border-box;overflow:hidden;border:none;border-radius:0}.ui-prop__cor-cad-select{flex:1 1 0px;min-width:0!important;width:0!important;max-width:100%;height:100%;background:transparent;color:var(--ui-cor-texto, #ffffff);border:none;border-radius:0;font-size:11px;padding:0 20px 0 4px;outline:none;cursor:pointer;box-sizing:border-box;appearance:none;-webkit-appearance:none;-moz-appearance:none;background-image:url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23888899' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 6px center;background-size:8px 5px;text-overflow:ellipsis;overflow:hidden;white-space:nowrap}.ui-prop__cor-cad-select:hover{background-color:#ffffff08}.ui-prop__cor-cad-select option{background-color:var(--ui-cor-fundo-elevado, #18181c);color:var(--ui-cor-texto, #ffffff)}.ui-prop__editor-booleano{display:flex;align-items:center;gap:6px;width:100%;height:100%;min-height:var(--ui-prop-altura-linha, 24px);cursor:pointer;padding:0 8px;box-sizing:border-box;-webkit-user-select:none;user-select:none}.ui-prop__editor-booleano:hover{background-color:#ffffff08}.ui-prop__checkbox-custom{width:13px;height:13px;border:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .25));border-radius:2px;background-color:var(--ui-cor-fundo, #0b0b0d);display:flex;align-items:center;justify-content:center;transition:all .15s ease}.ui-prop__checkbox-custom--marcado{background-color:var(--ui-cor-destaque, #00E08A);border-color:var(--ui-cor-destaque, #00E08A);color:#000}.ui-prop__booleano-rotulo{font-size:11px;color:var(--ui-cor-texto, #ffffff)}.ui-prop__btn-acao-inline{width:100%;height:100%;min-height:var(--ui-prop-altura-linha, 24px);padding:0 8px;background-color:transparent;border:none;border-radius:0;color:var(--ui-cor-texto, #ffffff);font-size:11px;font-weight:500;cursor:pointer;white-space:nowrap;text-align:left;transition:all .15s ease;box-sizing:border-box}.ui-prop__btn-acao-inline:hover{background-color:#ffffff0a;color:var(--ui-cor-destaque, #00E08A)}.ui-prop__valor-readonly{display:flex;align-items:center;width:100%;height:100%;min-height:var(--ui-prop-altura-linha, 24px);font-size:11px;color:var(--ui-cor-texto-secundario, #777788);padding:0 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;box-sizing:border-box;-webkit-user-select:text;user-select:text}.ui-prop__valor-readonly--numero{justify-content:flex-end;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-variant-numeric:tabular-nums}.ui-prop__unidade-sufixo{display:flex;align-items:center;font-size:10px;color:var(--ui-cor-texto-secundario, #777788);padding-right:8px;flex-shrink:0;-webkit-user-select:none;user-select:none}.ui-prop__vazio{padding:24px 16px;text-align:center;color:var(--ui-cor-texto-secundario, #888899);font-size:12px}.ui-prop__footer{display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background-color:var(--ui-cor-fundo-elevado, #18181c);border-top:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .1));flex-shrink:0}.ui-prop__link-ajuda{font-size:11px;color:var(--ui-cor-destaque, #00E08A);text-decoration:none;cursor:pointer}.ui-prop__link-ajuda:hover{text-decoration:underline}.ui-prop__footer-botoes{display:flex;gap:6px}.ui-prop__btn-aplicar{height:24px;padding:0 12px;background-color:var(--ui-cor-destaque, #00E08A);color:#000;border:none;border-radius:3px;font-size:11px;font-weight:600;cursor:pointer;transition:all .15s ease}.ui-prop__btn-aplicar:disabled{background-color:#ffffff1a;color:#ffffff4d;cursor:not-allowed}.ui-prop__btn-desfazer{height:24px;padding:0 8px;background:transparent;color:var(--ui-cor-texto-secundario, #888899);border:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .12));border-radius:3px;font-size:11px;cursor:pointer;transition:all .15s ease}.ui-prop__btn-desfazer:hover:not(:disabled){background-color:var(--ui-cor-hover-menu, rgba(255, 255, 255, .08));color:var(--ui-cor-texto, #ffffff)}.ui-prop__btn-desfazer:disabled{opacity:.4;cursor:not-allowed}@media (max-width: 640px){:host{--ui-prop-altura-linha: 28px;font-size:13px}.ui-prop__btn-icone{min-width:28px;min-height:28px}.ui-prop__footer-botoes{gap:8px}.ui-prop__btn-aplicar,.ui-prop__btn-desfazer{height:30px;font-size:12px;padding:0 12px;touch-action:manipulation;-webkit-tap-highlight-color:transparent}.ui-prop__editor-input,.ui-prop__editor-select{touch-action:manipulation;font-size:14px}}`;
function be() {
  return `
    <style>${ge}</style>
    <div class="ui-prop__container" id="container">
      <!-- 0. Faixa Vertical da Coluna Estreita (visível quando colapsado) -->
      <div class="ui-prop__faixa-estreita" id="faixa-estreita" title="Clique para expandir painel">
        <span class="ui-prop__faixa-icone">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="3" y1="9" x2="21" y2="9"></line>
            <line x1="9" y1="21" x2="9" y2="9"></line>
          </svg>
        </span>
        <button type="button" class="ui-prop__faixa-btn-expandir" id="btn-expandir-faixa" title="Expandir painel de propriedades">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <polyline points="9 18 15 12 9 6"></polyline>
            <line x1="5" y1="5" x2="5" y2="19"></line>
          </svg>
        </button>
        <span class="ui-prop__faixa-texto">PROPRIEDADES</span>
      </div>

      <!-- 1. Header Superior -->
      <header class="ui-prop__header" id="header">
        <div class="ui-prop__header-titulo">
          <span class="ui-prop__header-icone">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="3" y1="9" x2="21" y2="9"></line>
              <line x1="9" y1="21" x2="9" y2="9"></line>
            </svg>
          </span>
          <span id="header-titulo-texto">Propriedades</span>
        </div>
        <div class="ui-prop__header-acoes">
          <button type="button" class="ui-prop__btn-icone" id="btn-flutuante" title="Desacoplar / Modo flutuante (CAD)" aria-label="Modo flutuante">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="14" height="14" rx="2"></rect>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </button>
          <button type="button" class="ui-prop__btn-icone" id="btn-colapsar-horizontal" title="Recolher para coluna estreita" aria-label="Recolher para coluna estreita">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="11 17 6 12 11 7"></polyline>
              <line x1="18" y1="5" x2="18" y2="19"></line>
            </svg>
          </button>
          <button type="button" class="ui-prop__btn-icone" id="btn-densidade" title="Alternar compressão vertical" aria-label="Alternar densidade vertical">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="4 7 12 11 20 7"></polyline>
              <polyline points="4 17 12 13 20 17"></polyline>
              <line x1="4" y1="12" x2="20" y2="12"></line>
            </svg>
          </button>
          <button type="button" class="ui-prop__btn-icone" id="btn-expandir-tudo" title="Expandir/Recolher Tudo" aria-label="Expandir ou recolher tudo">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="7 13 12 18 17 13"></polyline>
              <polyline points="7 6 12 11 17 6"></polyline>
            </svg>
          </button>
          <button type="button" class="ui-prop__btn-icone" id="btn-fechar" title="Fechar" aria-label="Fechar" style="display: none;">
            ✕
          </button>
        </div>
      </header>

      <!-- 2. Seletor de Tipo (AutoCAD / Revit) -->
      <div class="ui-prop__tipo-seletor-container" id="tipo-container" style="display: none;"></div>

      <!-- 3. Busca Rápida de Propriedades -->
      <div class="ui-prop__filtro-container" id="filtro-container" style="display: none;">
        <svg class="ui-prop__filtro-icone" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input type="text" class="ui-prop__filtro-input" id="filtro-input" placeholder="Filtrar propriedades..." />
      </div>

      <!-- 4. Corpo Rolável com Grade de Categorias -->
      <div class="ui-prop__corpo-wrapper" id="corpo-wrapper">
        <div class="ui-prop__splitter" id="splitter"></div>
        <div class="ui-prop__corpo" id="corpo">
          <div class="ui-prop__lista-categorias" id="lista-categorias"></div>
        </div>
      </div>

      <!-- 5. Rodapé com Ações (Aplicar / Desfazer) -->
      <footer class="ui-prop__footer" id="footer" style="display: none;">
        <a class="ui-prop__link-ajuda" id="link-ajuda">Ajuda de propriedades</a>
        <div class="ui-prop__footer-botoes">
          <button type="button" class="ui-prop__btn-desfazer" id="btn-desfazer" disabled>Desfazer</button>
          <button type="button" class="ui-prop__btn-aplicar" id="btn-aplicar" disabled>Aplicar</button>
        </div>
      </footer>

      <!-- 6. Grip para redimensionar no modo flutuante -->
      <div class="ui-prop__resizer-canto" id="resizer-canto" title="Redimensionar"></div>
    </div>
  `;
}
function xe(o) {
  const { listaContainer: t, categorias: e, termoBusca: i, onToggleCategoria: r, linhaCtx: a } = o;
  if (t.innerHTML = "", !e || e.length === 0) {
    const s = document.createElement("div");
    s.className = "ui-prop__vazio", s.textContent = "Nenhuma propriedade disponível.", t.appendChild(s);
    return;
  }
  const c = document.createDocumentFragment();
  e.forEach((s) => {
    const l = (s.propriedades || []).filter((x) => i ? x.rotulo.toLowerCase().includes(i) || String(x.id).toLowerCase().includes(i) : !0);
    if (i && l.length === 0)
      return;
    const u = s.aberto !== !1, d = document.createElement("div");
    d.className = `ui-prop__categoria ${u ? "ui-prop__categoria--aberta" : ""}`, d.setAttribute("data-cat-id", s.id);
    const n = document.createElement("div");
    n.className = "ui-prop__categoria-header";
    const p = document.createElement("div");
    p.className = "ui-prop__categoria-titulo-bloco";
    const m = document.createElement("span");
    m.className = "ui-prop__categoria-seta", m.textContent = "▶";
    const h = document.createElement("span");
    h.textContent = s.titulo, p.appendChild(m), p.appendChild(h);
    const b = document.createElement("span");
    b.className = "ui-prop__categoria-contador", b.textContent = String(l.length), n.appendChild(p), n.appendChild(b), n.addEventListener("click", () => r(s.id)), n.addEventListener("dblclick", () => r(s.id));
    const g = document.createElement("div");
    g.className = "ui-prop__categoria-conteudo", l.forEach((x) => {
      const v = ve(s.id, x, a);
      g.appendChild(v);
    }), d.appendChild(n), d.appendChild(g), c.appendChild(d);
  }), t.appendChild(c);
}
function ve(o, t, e) {
  const i = document.createElement("div");
  i.className = "ui-prop__linha", i.setAttribute("data-prop-id", t.id);
  const r = e.valoresAtuais[t.id] !== void 0 ? e.valoresAtuais[t.id] : t.valor, a = e.valoresOriginais[t.id];
  e.isDirty && r !== a && i.classList.add("ui-prop__linha--modificada"), i.addEventListener("dblclick", () => {
    const d = i.querySelector(
      'input:not([type="color"]):not(.ui-prop__cor-picker-oculto), select, .ui-prop__btn-acao-inline'
    );
    d && (d.focus(), d instanceof HTMLInputElement && d.select());
  });
  const c = document.createElement("div");
  c.className = "ui-prop__col-rotulo", c.title = t.rotulo;
  const s = document.createElement("span");
  s.textContent = t.rotulo, c.appendChild(s), t.tipo === "numero" && !t.somenteLeitura && _e(c, o, t, e);
  const l = document.createElement("div");
  l.className = "ui-prop__col-valor";
  const u = he(o, t, r, e.editorCtx);
  if (l.appendChild(u), t.unidade) {
    const d = document.createElement("span");
    d.className = "ui-prop__unidade-sufixo", d.textContent = t.unidade, l.appendChild(d);
  }
  return i.appendChild(c), i.appendChild(l), i;
}
function _e(o, t, e, i) {
  o.classList.add("ui-prop__col-rotulo--scrub"), o.title = `${e.rotulo} (Arraste para ajustar, duplo-clique para editar)`;
  let r = 0, a = 0, c = !1;
  o.addEventListener("pointerdown", (s) => {
    if (s.button !== 0) return;
    r = s.clientX;
    const l = i.valoresAtuais[e.id];
    a = typeof l == "number" ? l : parseFloat(String(l || 0)) || 0, c = !1;
    try {
      o.setPointerCapture(s.pointerId);
    } catch {
    }
    o.classList.add("ui-prop__col-rotulo--arrastando");
    const u = (n) => {
      const p = n.clientX - r;
      if (Math.abs(p) > 2 && (c = !0), c) {
        let m = 1;
        n.shiftKey ? m = 0.1 : (n.ctrlKey || n.metaKey) && (m = 10);
        const h = e.casasDecimais !== void 0 ? e.casasDecimais : 2, b = Math.pow(10, -Math.min(h, 2));
        let g = a + p * b * m;
        e.casasDecimais !== void 0 ? g = Number(g.toFixed(e.casasDecimais)) : g = Math.round(g * 100) / 100, i.editorCtx.registrarAlteracao(t, e.id, g), i.onAtualizarCampoVisual(e.id, g);
      }
    }, d = (n) => {
      o.classList.remove("ui-prop__col-rotulo--arrastando");
      try {
        o.hasPointerCapture(n.pointerId) && o.releasePointerCapture(n.pointerId);
      } catch {
      }
      o.removeEventListener("pointermove", u), o.removeEventListener("pointerup", d), o.removeEventListener("pointercancel", d);
    };
    o.addEventListener("pointermove", u), o.addEventListener("pointerup", d), o.addEventListener("pointercancel", d);
  });
}
class Ee {
  constructor(t) {
    f(this, "valoresOriginais", {});
    f(this, "valoresAtuais", {});
    f(this, "dirty", !1);
    this.ctx = t;
  }
  inicializarCategorias(t) {
    this.valoresOriginais = {}, this.valoresAtuais = {}, this.dirty = !1, t.forEach((e) => {
      (e.propriedades || []).forEach((i) => {
        this.valoresOriginais[i.id] = i.valor, this.valoresAtuais[i.id] = i.valor;
      });
    }), this.ctx.onAtualizarBotoesFooter(this.dirty);
  }
  get isDirty() {
    return this.dirty;
  }
  getValores() {
    return { ...this.valoresAtuais };
  }
  setValores(t) {
    !t || typeof t != "object" || (Object.keys(t).forEach((e) => {
      this.valoresAtuais[e] = t[e], this.valoresOriginais[e] = t[e];
    }), this.dirty = !1, this.ctx.onAtualizarBotoesFooter(this.dirty));
  }
  obterValor(t) {
    return this.valoresAtuais[t];
  }
  definirValor(t, e, i = !0) {
    var a;
    const r = this.valoresAtuais[t];
    if (this.valoresAtuais[t] = e, this.dirty = !0, this.ctx.onAtualizarBotoesFooter(this.dirty), this.ctx.onAtualizarCampoVisual(t, e), i) {
      let c = "";
      for (const s of this.ctx.getCategorias())
        if ((a = s.propriedades) != null && a.some((l) => l.id === t)) {
          c = s.id;
          break;
        }
      this.emitirAlteracao(t, e, r, c);
    }
  }
  registrarAlteracao(t, e, i) {
    var c;
    const r = this.valoresAtuais[e];
    this.valoresAtuais[e] = i, this.dirty = !0, this.ctx.onAtualizarBotoesFooter(this.dirty);
    const a = (c = this.ctx.hostElement.shadowRoot) == null ? void 0 : c.querySelector(`[data-prop-id="${e}"]`);
    a && a.classList.add("ui-prop__linha--modificada"), this.ctx.isModoManual() || this.emitirAlteracao(e, i, r, t);
  }
  aplicar() {
    var e;
    if (!this.dirty) return;
    this.valoresOriginais = { ...this.valoresAtuais }, this.dirty = !1, this.ctx.onAtualizarBotoesFooter(this.dirty);
    const t = (e = this.ctx.hostElement.shadowRoot) == null ? void 0 : e.querySelectorAll(".ui-prop__linha--modificada");
    t == null || t.forEach((i) => i.classList.remove("ui-prop__linha--modificada")), this.ctx.hostElement.dispatchEvent(
      new CustomEvent("ui-aplicar", {
        bubbles: !0,
        composed: !0,
        detail: { valores: { ...this.valoresAtuais } }
      })
    );
  }
  desfazer() {
    this.dirty && (this.valoresAtuais = { ...this.valoresOriginais }, this.dirty = !1, this.ctx.onAtualizarBotoesFooter(this.dirty), this.ctx.onRenderCategorias(), this.ctx.hostElement.dispatchEvent(
      new CustomEvent("ui-desfazer", {
        bubbles: !0,
        composed: !0,
        detail: { valores: { ...this.valoresAtuais } }
      })
    ));
  }
  emitirAlteracao(t, e, i, r = "") {
    this.ctx.hostElement.dispatchEvent(
      new CustomEvent("ui-propriedade-alterada", {
        bubbles: !0,
        composed: !0,
        detail: {
          id: t,
          categoriaId: r,
          valor: e,
          valorAnterior: i,
          todosValores: { ...this.valoresAtuais }
        }
      })
    );
  }
}
function ye(o) {
  const {
    shadow: t,
    listeners: e,
    host: i,
    onToggleExpandirTodas: r,
    onFiltrar: a,
    onAplicar: c,
    onDesfazer: s,
    onAlternarDensidade: l,
    onAlternarFlutuante: u,
    onAlternarColapsoHorizontal: d
  } = o, n = t.getElementById("btn-flutuante");
  n && u && e.add(n, "click", u);
  const p = t.getElementById("btn-colapsar-horizontal");
  p && d && e.add(p, "click", d);
  const m = t.getElementById("faixa-estreita");
  m && d && e.add(m, "click", d);
  const h = t.getElementById("btn-expandir-faixa");
  h && d && e.add(h, "click", (E) => {
    E.stopPropagation(), d();
  });
  const b = t.getElementById("btn-densidade");
  b && l && e.add(b, "click", l);
  const g = t.getElementById("btn-expandir-tudo");
  g && e.add(g, "click", r);
  const x = t.getElementById("btn-fechar");
  x && e.add(x, "click", () => {
    i.dispatchEvent(new CustomEvent("ui-fechar", { bubbles: !0, composed: !0 }));
  });
  const v = t.getElementById("filtro-input");
  v && e.add(v, "input", () => {
    const E = (v.value || "").trim().toLowerCase();
    a(E);
  });
  const w = t.getElementById("btn-aplicar");
  w && e.add(w, "click", c);
  const C = t.getElementById("btn-desfazer");
  C && e.add(C, "click", s);
  const k = t.getElementById("link-ajuda");
  k && e.add(k, "click", () => {
    i.dispatchEvent(new CustomEvent("ui-ajuda", { bubbles: !0, composed: !0 }));
  });
}
function _(o, t) {
  const e = o.getElementById("header-titulo-texto");
  e && (e.textContent = t.getAttribute("titulo") || "Propriedades");
  const i = o.getElementById("btn-fechar");
  i && (i.style.display = t.hasAttribute("fechavel") ? "inline-flex" : "none");
  const r = o.getElementById("btn-flutuante");
  if (r) {
    const u = t.hasAttribute("flutuante");
    r.title = u ? "Acoplar painel (Dock)" : "Desacoplar / Modo flutuante (CAD)", r.classList.toggle("ui-prop__btn-icone--ativo", u);
  }
  const a = o.getElementById("btn-colapsar-horizontal");
  if (a) {
    const u = t.hasAttribute("colapsado");
    a.title = u ? "Expandir painel" : "Recolher para coluna estreita", a.classList.toggle("ui-prop__btn-icone--ativo", u);
  }
  const c = o.getElementById("btn-densidade");
  if (c) {
    const u = t.getAttribute("densidade") || "padrão";
    c.title = `Compressão vertical: ${u} (clique para alternar)`;
  }
  const s = o.getElementById("filtro-container");
  s && (s.style.display = t.hasAttribute("filtro") ? "flex" : "none");
  const l = o.getElementById("footer");
  l && (l.style.display = t.getAttribute("modo-aplicar") === "manual" ? "flex" : "none");
}
function we(o, t) {
  const e = Array.from(
    o.querySelectorAll(
      '.ui-prop__linha input:not([disabled]):not([type="color"]):not(.ui-prop__cor-picker-oculto), .ui-prop__linha select:not([disabled]), .ui-prop__linha .ui-prop__btn-acao-inline:not([disabled])'
    )
  ), i = e.indexOf(t);
  if (i !== -1 && i + 1 < e.length) {
    const r = e[i + 1];
    r.focus(), r instanceof HTMLInputElement && r.select();
  }
}
function A(o, t, e) {
  const i = o.querySelector(`[data-prop-id="${t}"]`);
  if (!i) return;
  const r = i.querySelector('input:not([type="color"]):not(.ui-prop__cor-picker-oculto)');
  r && (r.value = String(e ?? ""));
}
function Ce(o, t) {
  t.forEach((i) => i.aberto = !0), o.querySelectorAll(".ui-prop__categoria").forEach((i) => i.classList.add("ui-prop__categoria--aberta"));
}
function ke(o, t) {
  t.forEach((i) => i.aberto = !1), o.querySelectorAll(".ui-prop__categoria").forEach((i) => i.classList.remove("ui-prop__categoria--aberta"));
}
function ze(o, t, e, i) {
  const r = e.find((a) => a.id === i);
  if (r) {
    r.aberto = r.aberto === !1;
    const a = o.querySelector(`[data-cat-id="${i}"]`);
    a && a.classList.toggle("ui-prop__categoria--aberta", !!r.aberto), t.dispatchEvent(
      new CustomEvent("ui-categoria-toggle", {
        bubbles: !0,
        composed: !0,
        detail: { id: i, aberto: r.aberto }
      })
    );
  }
}
class Ae extends L {
  constructor() {
    super();
    f(this, "shadow");
    f(this, "listeners", new y());
    f(this, "splitterListeners", new y());
    f(this, "controladorSplitter");
    f(this, "gerenciadorValores");
    f(this, "_categorias", []);
    f(this, "_tipos", []);
    f(this, "_tipoSelecionadoId", "");
    f(this, "_termoBusca", "");
    f(this, "_larguraRotuloPorcentagem", 45);
    f(this, "tipoContainerElement");
    f(this, "corpoElement");
    f(this, "btnAplicarElement");
    f(this, "btnDesfazerElement");
    f(this, "splitterElement");
    this.shadow = this.attachShadow({ mode: "open" }), this.shadow.innerHTML = be(), this.tipoContainerElement = this.shadow.getElementById("tipo-container"), this.corpoElement = this.shadow.getElementById("corpo"), this.btnAplicarElement = this.shadow.getElementById("btn-aplicar"), this.btnDesfazerElement = this.shadow.getElementById("btn-desfazer"), this.splitterElement = this.shadow.getElementById("splitter"), this.gerenciadorValores = new Ee({
      hostElement: this,
      getCategorias: () => this._categorias,
      onAtualizarBotoesFooter: (e) => {
        this.btnAplicarElement.disabled = !e, this.btnDesfazerElement.disabled = !e;
      },
      onAtualizarCampoVisual: (e, i) => A(this.shadow, e, i),
      onRenderCategorias: () => this.renderCategorias(),
      isModoManual: () => this.getAttribute("modo-aplicar") === "manual"
    }), this.controladorSplitter = fe({
      hostElement: this,
      corpoElement: this.corpoElement,
      splitterElement: this.splitterElement,
      splitterListeners: this.splitterListeners,
      onLarguraAlterada: (e) => {
        this._larguraRotuloPorcentagem = e;
      }
    });
  }
  static get observedAttributes() {
    return [
      "titulo",
      "estilo-visual",
      "modo-aplicar",
      "filtro",
      "densidade",
      "largura-rotulo",
      "fechavel",
      "colapsado",
      "flutuante"
    ];
  }
  get larguraRotuloPorcentagem() {
    return this._larguraRotuloPorcentagem;
  }
  connectedCallback() {
    this.listeners.cleanup(), ye({
      shadow: this.shadow,
      listeners: this.listeners,
      host: this,
      onToggleExpandirTodas: () => this.toggleExpandirTodas(),
      onFiltrar: (e) => {
        this._termoBusca = e, this.renderCategorias();
      },
      onAplicar: () => this.aplicar(),
      onDesfazer: () => this.desfazer(),
      onAlternarDensidade: () => this.alternarDensidade(),
      onAlternarFlutuante: () => this.alternarFlutuante(),
      onAlternarColapsoHorizontal: () => this.alternarColapsoHorizontal()
    }), this.configurarArrastoFlutuante(), this.controladorSplitter.init(), this.syncState();
  }
  disconnectedCallback() {
    this.listeners.cleanup(), this.splitterListeners.cleanup();
  }
  attributeChangedCallback(e, i, r) {
    if (e === "largura-rotulo" && r) {
      const a = parseFloat(r);
      isNaN(a) || (this._larguraRotuloPorcentagem = this.controladorSplitter.definirLarguraRotulo(a));
    }
    this.syncState();
  }
  get categorias() {
    return this._categorias;
  }
  set categorias(e) {
    this._categorias = Array.isArray(e) ? e : [], this.gerenciadorValores.inicializarCategorias(this._categorias), this.renderCategorias();
  }
  get tipos() {
    return this._tipos;
  }
  set tipos(e) {
    this._tipos = Array.isArray(e) ? e : [], this.renderSeletorTipos();
  }
  get tipoSelecionado() {
    return this._tipoSelecionadoId;
  }
  set tipoSelecionado(e) {
    this._tipoSelecionadoId = e, this.renderSeletorTipos();
  }
  get valores() {
    return this.gerenciadorValores.getValores();
  }
  set valores(e) {
    this.gerenciadorValores.setValores(e), this.renderCategorias();
  }
  get isDirty() {
    return this.gerenciadorValores.isDirty;
  }
  get dirty() {
    return this.gerenciadorValores.isDirty;
  }
  obterValor(e) {
    return this.gerenciadorValores.obterValor(e);
  }
  definirValor(e, i, r = !0) {
    this.gerenciadorValores.definirValor(e, i, r);
  }
  aplicar() {
    this.gerenciadorValores.aplicar();
  }
  desfazer() {
    this.gerenciadorValores.desfazer();
  }
  expandirTudo() {
    Ce(this.shadow, this._categorias);
  }
  colapsarTudo() {
    ke(this.shadow, this._categorias);
  }
  toggleCategoria(e) {
    ze(this.shadow, this, this._categorias, e);
  }
  get densidade() {
    return this.getAttribute("densidade") || "padrao";
  }
  set densidade(e) {
    !e || e === "padrao" ? this.removeAttribute("densidade") : this.setAttribute("densidade", e);
  }
  alternarDensidade() {
    const e = this.getAttribute("densidade") || "padrao";
    let i = "compacta";
    return e === "compacta" ? i = "ultracompacta" : e === "ultracompacta" ? i = "padrao" : i = "compacta", i === "padrao" ? this.removeAttribute("densidade") : this.setAttribute("densidade", i), this.dispatchEvent(
      new CustomEvent("ui-densidade-alterada", {
        bubbles: !0,
        composed: !0,
        detail: { densidade: i }
      })
    ), _(this.shadow, this), i;
  }
  get flutuante() {
    return this.hasAttribute("flutuante");
  }
  set flutuante(e) {
    !!e !== this.hasAttribute("flutuante") && this.alternarFlutuante();
  }
  get colapsado() {
    return this.hasAttribute("colapsado");
  }
  set colapsado(e) {
    !!e !== this.hasAttribute("colapsado") && this.alternarColapsoHorizontal();
  }
  alternarFlutuante() {
    const e = this.hasAttribute("flutuante");
    if (e)
      this.removeAttribute("flutuante"), this.style.left = "", this.style.top = "", this.style.right = "", this.style.bottom = "", this.style.position = "", this.style.zIndex = "";
    else if (this.setAttribute("flutuante", ""), this.style.position = "fixed", !this.style.left && !this.style.top) {
      const a = Math.max(20, (typeof window < "u" ? window.innerWidth : 1024) - 300 - 30);
      this.style.left = `${a}px`, this.style.top = "70px", this.style.width = "300px", this.style.height = "480px";
    }
    const i = !e;
    return _(this.shadow, this), this.dispatchEvent(new CustomEvent("ui-flutuante-alterado", {
      bubbles: !0,
      composed: !0,
      detail: {
        flutuante: i,
        left: this.style.left,
        top: this.style.top,
        width: this.style.width,
        height: this.style.height
      }
    })), i;
  }
  alternarColapsoHorizontal() {
    const e = this.hasAttribute("colapsado");
    e ? this.removeAttribute("colapsado") : this.setAttribute("colapsado", "");
    const i = !e;
    return _(this.shadow, this), this.dispatchEvent(new CustomEvent("ui-colapso-horizontal", {
      bubbles: !0,
      composed: !0,
      detail: { colapsado: i }
    })), i;
  }
  configurarArrastoFlutuante() {
    const e = this.shadow.getElementById("header");
    if (e) {
      let r = null, a = 0, c = 0, s = 0, l = 0;
      const u = (n) => {
        if (r === null) return;
        const p = n.clientX - a, m = n.clientY - c;
        let h = s + p, b = l + m;
        const g = Math.max(0, (typeof window < "u" ? window.innerWidth : 1024) - this.offsetWidth), x = Math.max(0, (typeof window < "u" ? window.innerHeight : 768) - 30);
        h = Math.max(0, Math.min(g, h)), b = Math.max(0, Math.min(x, b)), this.style.left = `${h}px`, this.style.top = `${b}px`, this.style.right = "auto", this.style.bottom = "auto";
      }, d = (n) => {
        if (r !== null) {
          try {
            e.releasePointerCapture(n.pointerId);
          } catch {
          }
          e.removeEventListener("pointermove", u), e.removeEventListener("pointerup", d), e.removeEventListener("pointercancel", d), r = null, this.classList.remove("arrastando"), this.dispatchEvent(new CustomEvent("ui-mover", {
            bubbles: !0,
            composed: !0,
            detail: { left: this.style.left, top: this.style.top }
          }));
        }
      };
      this.listeners.add(e, "pointerdown", (n) => {
        if (!this.hasAttribute("flutuante") || n.target.closest("button, input, select, a") || n.button !== 0) return;
        n.preventDefault(), r = n.pointerId, a = n.clientX, c = n.clientY;
        const m = this.getBoundingClientRect();
        s = m.left, l = m.top, this.classList.add("arrastando");
        try {
          e.setPointerCapture(n.pointerId);
        } catch {
        }
        e.addEventListener("pointermove", u), e.addEventListener("pointerup", d), e.addEventListener("pointercancel", d);
      });
    }
    const i = this.shadow.getElementById("resizer-canto");
    if (i) {
      let r = null, a = 0, c = 0, s = 0, l = 0;
      const u = (n) => {
        if (r === null) return;
        const p = Math.max(200, a + (n.clientX - s)), m = Math.max(180, c + (n.clientY - l));
        this.style.width = `${p}px`, this.style.height = `${m}px`;
      }, d = (n) => {
        if (r !== null) {
          try {
            i.releasePointerCapture(n.pointerId);
          } catch {
          }
          i.removeEventListener("pointermove", u), i.removeEventListener("pointerup", d), i.removeEventListener("pointercancel", d), r = null, this.dispatchEvent(new CustomEvent("ui-redimensionar", {
            bubbles: !0,
            composed: !0,
            detail: { width: this.style.width, height: this.style.height }
          }));
        }
      };
      this.listeners.add(i, "pointerdown", (n) => {
        if (!this.hasAttribute("flutuante") || n.button !== 0) return;
        n.preventDefault(), n.stopPropagation(), r = n.pointerId, s = n.clientX, l = n.clientY;
        const p = this.getBoundingClientRect();
        a = p.width, c = p.height;
        try {
          i.setPointerCapture(n.pointerId);
        } catch {
        }
        i.addEventListener("pointermove", u), i.addEventListener("pointerup", d), i.addEventListener("pointercancel", d);
      });
    }
  }
  syncState() {
    _(this.shadow, this);
    const e = this.getAttribute("largura-rotulo");
    if (e) {
      const i = parseFloat(e);
      isNaN(i) || (this._larguraRotuloPorcentagem = this.controladorSplitter.definirLarguraRotulo(i));
    }
    this.renderSeletorTipos(), this.renderCategorias();
  }
  toggleExpandirTodas() {
    this._categorias.some((i) => i.aberto === !1) ? this.expandirTudo() : this.colapsarTudo();
  }
  renderSeletorTipos() {
    me({
      tipoContainerElement: this.tipoContainerElement,
      tipos: this._tipos,
      tipoSelecionadoId: this._tipoSelecionadoId,
      estiloVisual: this.getAttribute("estilo-visual") || "autocad",
      onSelecionarTipo: (e) => {
        this._tipoSelecionadoId = e, this.renderSeletorTipos();
        const i = this._tipos.find((r) => String(r.id) === String(e));
        this.dispatchEvent(new CustomEvent("ui-tipo-alterado", { bubbles: !0, composed: !0, detail: { id: e, tipo: i } }));
      },
      onEditarTipo: (e) => this.dispatchEvent(new CustomEvent("ui-editar-tipo-clique", { bubbles: !0, composed: !0, detail: { tipo: e } })),
      onQuickSelect: (e) => this.dispatchEvent(new CustomEvent("ui-quick-select", { bubbles: !0, composed: !0, detail: { tipo: e } })),
      onSelectObjects: (e) => this.dispatchEvent(new CustomEvent("ui-selecionar-objetos", { bubbles: !0, composed: !0, detail: { tipo: e } })),
      onCalculadora: (e) => this.dispatchEvent(new CustomEvent("ui-calculadora", { bubbles: !0, composed: !0, detail: { tipo: e } }))
    });
  }
  renderCategorias() {
    const e = this.shadow.getElementById("lista-categorias");
    e && xe({
      listaContainer: e,
      categorias: this._categorias,
      termoBusca: this._termoBusca,
      onToggleCategoria: (i) => this.toggleCategoria(i),
      linhaCtx: {
        valoresAtuais: this.gerenciadorValores.getValores(),
        valoresOriginais: {},
        isDirty: this.gerenciadorValores.isDirty,
        onAtualizarCampoVisual: (i, r) => A(this.shadow, i, r),
        editorCtx: {
          obterValorAtual: (i) => this.gerenciadorValores.obterValor(i),
          registrarAlteracao: (i, r, a) => {
            this.gerenciadorValores.registrarAlteracao(i, r, a);
          },
          focarProximoEditor: (i) => we(this.shadow, i),
          despacharEventoAcao: (i, r) => {
            this.dispatchEvent(
              new CustomEvent("ui-acao-clique", {
                bubbles: !0,
                composed: !0,
                detail: { id: i.id, categoriaId: r, propriedade: i }
              })
            );
          }
        }
      }
    });
  }
}
S("ui-tabela-propriedades", Ae);
export {
  Y as A,
  U as B,
  Ce as C,
  we as D,
  M as E,
  B as F,
  Ee as G,
  q as H,
  N as I,
  J,
  X as K,
  H as L,
  j as M,
  Z as N,
  xe as O,
  W as P,
  $ as Q,
  me as R,
  T as S,
  V as T,
  te as U,
  _ as V,
  ee as W,
  I as a,
  z as b,
  Ae as c,
  G as d,
  ze as e,
  P as f,
  F as g,
  A as h,
  oe as i,
  ke as j,
  ye as k,
  fe as l,
  ne as m,
  re as n,
  ue as o,
  pe as p,
  de as q,
  ce as r,
  se as s,
  ie as t,
  ae as u,
  le as v,
  he as w,
  ve as x,
  Q as y,
  K as z
};
