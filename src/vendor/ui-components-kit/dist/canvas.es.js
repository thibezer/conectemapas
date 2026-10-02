var rt = Object.defineProperty;
var lt = (s, t, o) => t in s ? rt(s, t, { enumerable: !0, configurable: !0, writable: !0, value: o }) : s[t] = o;
var u = (s, t, o) => lt(s, typeof t != "symbol" ? t + "" : t, o);
/* empty css               */
import y from "leaflet";
import { e as C, p as j, r as W, b as Y, a as U, o as X, c as Q, l as ct } from "./leaflet-DkaFZYc5.js";
import { f as le } from "./leaflet-DkaFZYc5.js";
import { L as nt } from "./listener-bag-DQgv7OON.js";
import { d as dt, S as pt } from "./ssr-safe-5cWfJP-s.js";
const tt = {
  perimetroWeight: 1,
  fechamentoWeight: 1,
  vizinhoWeight: 1,
  bancoWeight: 1,
  markerSizeBase: 10,
  markerStyleM: "circle-dot",
  markerSizeM: 14,
  markerStyleP: "circle",
  markerSizeP: 10,
  markerStyleV: "cross",
  markerSizeV: 8,
  enableAnimations: !1,
  preferCanvas: !0,
  crosshair: !1,
  satOpacity: 1,
  magnetSnap: !1
}, F = class F {
  constructor() {
    u(this, "config");
    this.config = this.loadConfig();
  }
  static getInstance() {
    return F.instance || (F.instance = new F()), F.instance;
  }
  loadConfig() {
    try {
      const t = typeof localStorage < "u" ? localStorage.getItem("gerencigeo_mapa_config") : null;
      if (t)
        return { ...tt, ...JSON.parse(t) };
    } catch (t) {
      console.error("Erro ao carregar configurações do mapa", t);
    }
    return { ...tt };
  }
  saveConfig(t) {
    this.config = { ...this.config, ...t }, typeof localStorage < "u" && localStorage.setItem("gerencigeo_mapa_config", JSON.stringify(this.config));
  }
  getConfig() {
    return this.config = this.loadConfig(), { ...this.config };
  }
};
u(F, "instance");
let K = F;
async function ht(s, t, o, e) {
  const i = s.getSize(), n = s.getBounds(), a = n.getSouthWest(), c = n.getNorthEast(), r = `${a.lng},${a.lat},${c.lng},${c.lat}`;
  let l = 0, p = 0;
  try {
    if (t.containerPoint)
      l = Math.round(t.containerPoint.x), p = Math.round(t.containerPoint.y);
    else if (t.layerPoint) {
      const b = s.layerPointToContainerPoint(t.layerPoint);
      l = Math.round(b.x), p = Math.round(b.y);
    }
  } catch {
    l = 0, p = 0;
  }
  const d = `https://acervofundiario.incra.gov.br/i3geo/ogc.php?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo&FORMAT=image/png&TRANSPARENT=true&QUERY_LAYERS=certificada_sigef_particular_pr&LAYERS=certificada_sigef_particular_pr&INFO_FORMAT=application/json&X=${l}&Y=${p}&WIDTH=${i.x}&HEIGHT=${i.y}&SRS=EPSG:4326&BBOX=${r}`, f = s.getContainer();
  f.style.cursor = "wait";
  const h = y.popup({
    className: "compact-sigef-popup",
    maxWidth: 250
  }).setLatLng(t.latlng).setContent(`
      <div style="font-family:sans-serif; display:flex; align-items:center; gap:8px; color:rgba(255,255,255,0.9); font-size:12px;">
        <svg style="animation:spin 1s linear infinite; width:14px; height:14px; flex-shrink:0;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.2)" stroke-width="4" fill="none"></circle>
          <path fill="#00f5a0" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Consultando...
      </div>
    `).openOn(s);
  e.currentAbortController && e.currentAbortController.abort(), e.currentAbortController = new AbortController();
  const v = e.currentAbortController.signal, P = setTimeout(() => {
    e.currentAbortController && e.currentAbortController.abort();
  }, 8e3);
  try {
    const S = typeof window < "u" && (window.location.origin.includes("localhost") || window.location.origin.includes("127.0.0.1") || window.location.origin.includes("[::1]")) ? `${o}/proxy/sigef?url=${encodeURIComponent(d)}` : `${window.location.origin}/api.php?action=proxy_sigef&url=${encodeURIComponent(d)}`, I = await fetch(S, { signal: v });
    clearTimeout(P);
    let L = null;
    if (I.ok) {
      const E = await I.text();
      try {
        L = JSON.parse(E);
      } catch {
        L = null;
      }
    }
    if (L && L.features && L.features.length > 0) {
      const E = L.features[0], w = E.properties || {}, g = String(E.id || w.parcela_codigo || w.co_parcela || w.id_parcela || ""), m = String(w.nome_area || w.nome_imovel || "Imóvel Sem Nome");
      if (g) {
        const x = encodeURIComponent(g), z = `https://sigef.incra.gov.br/geo/exportar/parcela/shp/${x}/`, _ = `https://sigef.incra.gov.br/geo/parcela/detalhe/${x}/`, k = document.createElement("div");
        k.style.cssText = "font-family:sans-serif; color:rgba(255, 255, 255, 0.9); line-height:1.4; min-width:180px;", k.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; padding-bottom:5px; border-bottom:1px solid rgba(255, 255, 255, 0.1);">
            <span style="font-weight:700; font-size:11px; color:#10b981; text-transform:uppercase; letter-spacing:0.5px;">SIGEF</span>
            <span style="font-size:10px; color:rgba(255, 255, 255, 0.5);">${C(w.situacao_informada || w.status || "Certificada")}</span>
          </div>
          <div style="font-weight:700; font-size:12px; margin-bottom:4px; color:#ffffff; word-break:break-word;">${C(m)}</div>
          <div style="font-size:11px; color:rgba(255, 255, 255, 0.7); margin-bottom:2px;">Cód: <span style="font-family:monospace;">${C(w.codigo_imovel || "N/A")}</span></div>
          <div style="display:flex; gap:12px; font-size:11px; color:rgba(255, 255, 255, 0.7); margin-bottom:6px;">
            <span>Mat: <strong style="color:#ffffff;">${C(w.registro_matricula || w.matricula || "N/A")}</strong></span>
            <span>${C(w.data_submissao || "")}</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:5px; padding-top:6px; border-top:1px solid rgba(255, 255, 255, 0.1);">
            <a href="${z}" target="_blank" rel="noopener noreferrer" style="display:flex; align-items:center; justify-content:center; gap:5px; padding:5px 8px; background:rgba(16, 185, 129, 0.15); border:1px solid rgba(16, 185, 129, 0.3); color:#34d399; font-size:11px; font-weight:700; border-radius:5px; text-decoration:none; cursor:pointer;">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Baixar Shapefile
            </a>
            <button class="btn-importar-confrontante-sigef" style="display:flex; align-items:center; justify-content:center; gap:5px; padding:5px 8px; background:rgba(14, 165, 233, 0.15); border:1px solid rgba(14, 165, 233, 0.3); color:#38bdf8; font-size:11px; font-weight:700; border-radius:5px; cursor:pointer; width:100%; text-align:center;">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Importar Confrontante (CSV)
            </button>
            <a href="${_}" target="_blank" rel="noopener noreferrer" style="display:flex; align-items:center; justify-content:center; gap:4px; padding:4px 6px; background:rgba(255, 255, 255, 0.05); border:1px solid rgba(255, 255, 255, 0.1); color:rgba(255, 255, 255, 0.7); font-size:10px; font-weight:600; border-radius:5px; text-decoration:none; cursor:pointer;">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              Abrir no SIGEF
            </a>
          </div>
        `;
        const N = k.querySelector(".btn-importar-confrontante-sigef");
        N && N.addEventListener("click", () => {
          window.dispatchEvent(
            new CustomEvent("gerencigeo:importar_vizinho_sigef", {
              detail: { uuid: g, nome: m }
            })
          );
        }), h.setContent(k);
      } else
        h.setContent(`
          <div style="font-family:sans-serif; font-size:12px; color:#b45309; padding:2px 0;">
            Lote identificado, mas código da parcela indisponível.
          </div>
        `);
    } else
      h.setContent(`
        <div style="font-family:sans-serif; font-size:12px; color:rgba(255, 255, 255, 0.7); padding:2px 0;">
          Nenhum imóvel SIGEF certificado neste ponto.
        </div>
      `);
  } catch (b) {
    b.name === "AbortError" ? h.setContent(`
        <div style="font-family:sans-serif; font-size:12px; color:#f59e0b; padding:2px 0;">
          Consulta cancelada ou tempo limite de resposta esgotado.
        </div>
      `) : (console.warn("Erro ao consultar SIGEF:", b), h.setContent(`
        <div style="font-family:sans-serif; font-size:12px; color:#f59e0b; padding:2px 0;">
          Serviço de consulta SIGEF indisponível nesta área.
        </div>
      `));
  } finally {
    f.style.cursor = "";
  }
}
function ft(s, t) {
  if (!s) return;
  const o = Math.floor(s.getZoom()), e = Math.max(o, 12), i = Math.min(o + 1, 19), n = t.pad(0.2), a = ["mt0", "mt1", "mt2", "mt3"];
  let c = 0;
  const r = 32;
  for (let l = e; l <= i && c < r; l++) {
    const p = n.getNorthWest(), d = n.getSouthEast(), f = et(p.lng, l), h = et(d.lng, l), v = ot(p.lat, l), P = ot(d.lat, l);
    for (let b = f; b <= h && c < r; b++)
      for (let S = v; S <= P && c < r; S++) {
        const L = `https://${a[(b + S) % a.length]}.google.com/vt/lyrs=s,h&x=${b}&y=${S}&z=${l}`, E = new Image();
        E.src = L, c++;
      }
  }
}
function et(s, t) {
  return Math.floor((s + 180) / 360 * Math.pow(2, t));
}
function ot(s, t) {
  const o = s * Math.PI / 180;
  return Math.floor(
    (1 - Math.log(Math.tan(o) + 1 / Math.cos(o)) / Math.PI) / 2 * Math.pow(2, t)
  );
}
class ut {
  constructor(t) {
    u(this, "map", null);
    u(this, "configManager", K.getInstance());
    u(this, "config", this.configManager.getConfig());
    u(this, "apiBaseUrl", "/api");
    u(this, "bancoPontosGroup", y.layerGroup());
    u(this, "pontosVizinhosGroup", y.layerGroup());
    u(this, "controller");
    u(this, "containerElement", null);
    u(this, "bc");
    u(this, "sigefState", {});
    this.controller = t;
  }
  init(t) {
    if (this.map)
      try {
        this.map.off(), this.map.remove();
      } catch {
      } finally {
        this.map = null;
      }
    const o = typeof t == "string" ? document.getElementById(t) : t;
    if (!o) return null;
    if (this.containerElement = o, o._leaflet_id)
      try {
        delete o._leaflet_id;
      } catch {
        o._leaflet_id = void 0;
      }
    if (this.map = y.map(o, {
      maxZoom: 24,
      scrollWheelZoom: !0,
      preferCanvas: this.config.preferCanvas !== void 0 ? this.config.preferCanvas : !0,
      zoomControl: !1
    }).setView([-23.7661, -53.3204], 14), this.listenConfigBroadcast(), this.applyMapStyles(), !this.map.getPane("sigefPane")) {
      const e = this.map.createPane("sigefPane");
      e.style.zIndex = "390";
    }
    if (!this.map.getPane("perimetroPane")) {
      const e = this.map.createPane("perimetroPane");
      e.style.zIndex = "450";
    }
    if (!this.map.getPane("verticesPane")) {
      const e = this.map.createPane("verticesPane");
      e.style.zIndex = "650";
    }
    return y.control.scale({
      metric: !0,
      imperial: !1,
      position: "bottomleft"
    }).addTo(this.map), this.map.on("click", (e) => {
      if (this.controller.modoCliqueSequencialAtivo || this.controller.canvasInteracao && this.controller.canvasInteracao.selectionHappened) return;
      (this.controller.layerManager ? this.controller.layerManager.isLayerActiveAndSelectable("sigef") : !1) && this.consultarSigef(e);
    }), setTimeout(() => {
      this.invalidateSize();
    }, 250), this.map;
  }
  invalidateSize(t = !1) {
    var o, e;
    if (this.map)
      try {
        const i = (e = (o = this.map).getContainer) == null ? void 0 : e.call(o);
        if (!i || !i.parentNode) return;
        this.map.invalidateSize({ animate: t, pan: !1 });
      } catch {
      }
  }
  applyMapStyles() {
    const t = this.containerElement || document.getElementById("mapa-triagem");
    t && (t.style.cursor = this.config.crosshair ? "crosshair" : "");
  }
  listenConfigBroadcast() {
    if (!(typeof BroadcastChannel > "u"))
      try {
        this.bc = new BroadcastChannel("gerencigeo_map_config"), this.bc.onmessage = (t) => {
          t.data === "RELOAD_REQUIRED" && (this.config = this.configManager.getConfig(), this.applyMapStyles(), window.dispatchEvent(new CustomEvent("gerencigeo:map_config_changed", { detail: this.config })));
        };
      } catch {
      }
  }
  destroy() {
    if (this.sigefState.currentAbortController && (this.sigefState.currentAbortController.abort(), this.sigefState.currentAbortController = void 0), this.bc) {
      try {
        this.bc.close();
      } catch {
      }
      this.bc = void 0;
    }
    if (this.map)
      try {
        this.map.off(), this.map.remove();
      } catch {
      } finally {
        this.map = null;
      }
    if (this.containerElement && this.containerElement._leaflet_id)
      try {
        delete this.containerElement._leaflet_id;
      } catch {
        this.containerElement._leaflet_id = void 0;
      }
  }
  preCarregarTilesRegiao(t) {
    ft(this.map, t);
  }
  async consultarSigef(t) {
    this.map && await ht(this.map, t, this.apiBaseUrl, this.sigefState);
  }
}
const gt = [
  "verticesPane",
  "perimetroPane",
  "overlayPane",
  "markerPane",
  "pane-vertices",
  "pane-perimetro",
  "pane-vizinhos",
  "pane-homologados",
  "pane-homologados-pontos"
];
class mt {
  constructor(t, o, e) {
    u(this, "map");
    u(this, "mapContainer");
    u(this, "ctx");
    u(this, "selectionDiv", null);
    u(this, "isSelecting", !1);
    u(this, "selectStartPos", { x: 0, y: 0 });
    u(this, "selectStartPoint", null);
    this.map = t, this.mapContainer = o, this.ctx = e, this.criarDivSelecao();
  }
  criarDivSelecao() {
    this.selectionDiv || (this.selectionDiv = document.createElement("div"), this.selectionDiv.className = "cad-selection-box", this.selectionDiv.style.position = "absolute", this.selectionDiv.style.zIndex = "9999", this.selectionDiv.style.pointerEvents = "none", this.selectionDiv.style.display = "none", this.selectionDiv.style.borderRadius = "2px", this.mapContainer.style.position = "relative", this.mapContainer.appendChild(this.selectionDiv));
  }
  setPanesPointerEvents(t) {
    gt.forEach((o) => {
      const e = this.map.getPane(o);
      e && (e.style.pointerEvents = t);
    });
  }
  iniciarSelecao(t) {
    const o = this.mapContainer.getBoundingClientRect(), e = t.clientX - o.left, i = t.clientY - o.top;
    this.isSelecting = !0, this.selectStartPos = { x: e, y: i }, this.selectStartPoint = this.map.mouseEventToContainerPoint(t), this.selectionDiv && (this.selectionDiv.style.left = `${e}px`, this.selectionDiv.style.top = `${i}px`, this.selectionDiv.style.width = "0px", this.selectionDiv.style.height = "0px", this.selectionDiv.style.display = "block"), this.setPanesPointerEvents("none");
  }
  atualizarSelecao(t) {
    if (!this.isSelecting || !this.selectionDiv) return;
    const o = this.mapContainer.getBoundingClientRect(), e = t.clientX - o.left, i = t.clientY - o.top, n = Math.abs(e - this.selectStartPos.x), a = Math.abs(i - this.selectStartPos.y), c = Math.min(e, this.selectStartPos.x), r = Math.min(i, this.selectStartPos.y);
    this.selectionDiv.style.left = `${Math.round(c)}px`, this.selectionDiv.style.top = `${Math.round(r)}px`, this.selectionDiv.style.width = `${Math.round(n)}px`, this.selectionDiv.style.height = `${Math.round(a)}px`, e >= this.selectStartPos.x ? (this.selectionDiv.style.background = "rgba(14, 116, 144, 0.22)", this.selectionDiv.style.border = "1px solid #06b6d4") : (this.selectionDiv.style.background = "rgba(16, 185, 129, 0.22)", this.selectionDiv.style.border = "1px dashed #10b981");
  }
  finalizarSelecao(t, o, e) {
    var S, I, L, E, w, g;
    if (!this.isSelecting) return !1;
    this.isSelecting = !1, this.selectionDiv && (this.selectionDiv.style.display = "none"), this.map.closePopup(), setTimeout(() => {
      try {
        this.setPanesPointerEvents("auto"), this.ctx.layerManager && this.ctx.layerManager.ensurePanes();
      } catch {
      }
    }, 80);
    const i = this.mapContainer.getBoundingClientRect(), n = t.clientX - i.left, a = t.clientY - i.top, c = this.map.mouseEventToContainerPoint(t), r = Math.abs(n - this.selectStartPos.x), l = Math.abs(a - this.selectStartPos.y);
    if (r < 4 && l < 4) {
      const m = t.target;
      return m && ((S = m.classList) != null && S.contains("leaflet-container") || m.id === "mapa-triagem" || (I = m.closest) != null && I.call(m, ".leaflet-pane")) && ((L = m.closest) != null && L.call(m, ".custom-leaflet-marker") || (E = m.closest) != null && E.call(m, ".custom-div-icon") || e()), !1;
    }
    if (!this.selectStartPoint) return !1;
    const p = {
      x1: Math.min(this.selectStartPoint.x, c.x),
      y1: Math.min(this.selectStartPoint.y, c.y),
      x2: Math.max(this.selectStartPoint.x, c.x),
      y2: Math.max(this.selectStartPoint.y, c.y)
    }, d = ((w = this.ctx.mapaController) == null ? void 0 : w.getMarkers()) || [], f = ((g = this.ctx.mapaController) == null ? void 0 : g.getVizinhosMarkers()) || [], h = [], v = [], P = !this.ctx.layerManager || this.ctx.layerManager.isLayerActiveAndSelectable("vertices"), b = !this.ctx.layerManager || this.ctx.layerManager.isLayerActiveAndSelectable("vizinhos");
    return P && d.forEach((m) => {
      const x = m.pontoId;
      if (!x) return;
      const z = this.map.latLngToContainerPoint(m.getLatLng());
      z.x >= p.x1 && z.x <= p.x2 && z.y >= p.y1 && z.y <= p.y2 && h.push(x);
    }), b && f.forEach((m) => {
      const x = m.pontoId;
      if (!x) return;
      const z = this.map.latLngToContainerPoint(m.getLatLng());
      z.x >= p.x1 && z.x <= p.x2 && z.y >= p.y1 && z.y <= p.y2 && v.push(x);
    }), t.ctrlKey || t.metaKey ? (h.forEach((m) => {
      this.ctx.selectedPontoIds.includes(m) ? this.ctx.selectedPontoIds = this.ctx.selectedPontoIds.filter((x) => x !== m) : this.ctx.selectedPontoIds.push(m);
    }), v.forEach((m) => {
      this.ctx.selectedVizinhoPontoIds.includes(m) ? this.ctx.selectedVizinhoPontoIds = this.ctx.selectedVizinhoPontoIds.filter((x) => x !== m) : this.ctx.selectedVizinhoPontoIds.push(m);
    })) : (this.ctx.selectedPontoIds = h, this.ctx.selectedVizinhoPontoIds = v), this.ctx.selectedPontoIds.length > 0 && (this.ctx.lastSelectedPontoId = this.ctx.selectedPontoIds[this.ctx.selectedPontoIds.length - 1]), o(), !0;
  }
  cancelarSelecao() {
    this.isSelecting && (this.isSelecting = !1, this.selectionDiv && (this.selectionDiv.style.display = "none"), this.setPanesPointerEvents("auto"), this.ctx.layerManager && this.ctx.layerManager.ensurePanes());
  }
  destruir() {
    this.selectionDiv && this.selectionDiv.parentNode && (this.selectionDiv.parentNode.removeChild(this.selectionDiv), this.selectionDiv = null), this.setPanesPointerEvents("auto");
  }
}
class yt {
  constructor(t) {
    u(this, "ctx");
    u(this, "map", null);
    u(this, "mapContainer", null);
    u(this, "selecaoBox", null);
    // Estados de Pan (Rodinha)
    u(this, "isPanning", !1);
    u(this, "lastMousePos", { x: 0, y: 0 });
    u(this, "lastMiddleClickTime", 0);
    // Estados de Toque (Mobile/Tablet)
    u(this, "touchStartPos", { x: 0, y: 0 });
    u(this, "touchStartDist", 0);
    u(this, "isTouchPanning", !1);
    u(this, "selectionHappened", !1);
    u(this, "panHappened", !1);
    u(this, "handleTouchStart", (t) => {
      if (!(!this.map || !this.mapContainer)) {
        if (t.touches.length === 1)
          this.isTouchPanning = !0, this.touchStartPos = { x: t.touches[0].clientX, y: t.touches[0].clientY };
        else if (t.touches.length === 2) {
          this.isTouchPanning = !1;
          const o = t.touches[0].clientX - t.touches[1].clientX, e = t.touches[0].clientY - t.touches[1].clientY;
          this.touchStartDist = Math.hypot(o, e);
        }
      }
    });
    u(this, "handleTouchMove", (t) => {
      if (!(!this.map || !this.mapContainer)) {
        if (t.touches.length === 1 && this.isTouchPanning) {
          t.preventDefault(), this.panHappened = !0;
          const o = this.touchStartPos.x - t.touches[0].clientX, e = this.touchStartPos.y - t.touches[0].clientY;
          this.map.panBy([o, e], { animate: !1 }), this.touchStartPos = { x: t.touches[0].clientX, y: t.touches[0].clientY };
        } else if (t.touches.length === 2 && this.touchStartDist > 0) {
          t.preventDefault(), this.panHappened = !0;
          const o = t.touches[0].clientX - t.touches[1].clientX, e = t.touches[0].clientY - t.touches[1].clientY, i = Math.hypot(o, e);
          Math.abs(i - this.touchStartDist) > 25 && (i > this.touchStartDist ? this.map.zoomIn(1) : this.map.zoomOut(1), this.touchStartDist = i);
        }
      }
    });
    u(this, "handleTouchEnd", () => {
      this.isTouchPanning = !1, this.touchStartDist = 0, setTimeout(() => {
        this.panHappened = !1;
      }, 120);
    });
    u(this, "handleContextMenu", (t) => {
      t.preventDefault();
    });
    u(this, "handleMouseDown", (t) => {
      var o;
      if (!(!this.map || !this.mapContainer)) {
        if (t.button === 1) {
          t.preventDefault();
          const e = Date.now();
          if (e - this.lastMiddleClickTime < 300) {
            this.zoomExtents();
            return;
          }
          this.lastMiddleClickTime = e, this.isPanning = !0, this.panHappened = !1, this.lastMousePos = { x: t.clientX, y: t.clientY }, this.mapContainer.style.cursor = "grabbing";
          return;
        }
        if (t.button === 0) {
          if (this.selectionHappened = !1, this.ctx.mapaController && this.ctx.mapaController.modoCliqueSequencialAtivo)
            return;
          (o = this.selecaoBox) == null || o.iniciarSelecao(t);
        }
      }
    });
    u(this, "handleMouseMove", (t) => {
      var o;
      if (!(!this.map || !this.mapContainer)) {
        if (this.isPanning) {
          const e = this.lastMousePos.x - t.clientX, i = this.lastMousePos.y - t.clientY;
          (Math.abs(e) > 1 || Math.abs(i) > 1) && (this.panHappened = !0), this.map.panBy([e, i], { animate: !1 }), this.lastMousePos = { x: t.clientX, y: t.clientY };
          return;
        }
        (o = this.selecaoBox) == null || o.atualizarSelecao(t);
      }
    });
    u(this, "handleMouseUp", (t) => {
      this.isPanning && (this.isPanning = !1, this.mapContainer && (this.mapContainer.style.cursor = "grab"), setTimeout(() => {
        this.panHappened = !1;
      }, 120)), this.selecaoBox && this.selecaoBox.isSelecting && this.selecaoBox.finalizarSelecao(
        t,
        () => this.notificarSelecao(),
        () => this.limparSelecao()
      ) && (this.selectionHappened = !0, setTimeout(() => {
        this.selectionHappened = !1;
      }, 120));
    });
    u(this, "handleKeyDown", (t) => {
      var o;
      if (t.key === "Escape") {
        const e = document.activeElement;
        if (e && (e.tagName === "INPUT" || e.tagName === "TEXTAREA" || e.tagName === "SELECT" || e.isContentEditable))
          return;
        (o = this.selecaoBox) == null || o.cancelarSelecao(), this.limparSelecao();
      }
    });
    this.ctx = {
      selectedPontoIds: [],
      selectedVizinhoPontoIds: [],
      lastSelectedPontoId: null,
      pontosList: [],
      ...t
    };
  }
  ativar(t, o) {
    this.ctx.mapaController = t, o && (this.ctx.containerHost = o), this.map = t.getMap(), this.map && (this.mapContainer = this.map.getContainer(), this.mapContainer && (this.map.dragging.disable(), this.map.doubleClickZoom.disable(), this.selecaoBox = new mt(this.map, this.mapContainer, this.ctx), this.mapContainer.addEventListener("mousedown", this.handleMouseDown), this.mapContainer.addEventListener("mousemove", this.handleMouseMove), window.addEventListener("mouseup", this.handleMouseUp), this.mapContainer.addEventListener("contextmenu", this.handleContextMenu), window.addEventListener("keydown", this.handleKeyDown), this.mapContainer.addEventListener("touchstart", this.handleTouchStart, { passive: !1 }), this.mapContainer.addEventListener("touchmove", this.handleTouchMove, { passive: !1 }), this.mapContainer.addEventListener("touchend", this.handleTouchEnd), this.mapContainer.addEventListener("touchcancel", this.handleTouchEnd)));
  }
  desativar() {
    this.mapContainer && (this.mapContainer.removeEventListener("mousedown", this.handleMouseDown), this.mapContainer.removeEventListener("mousemove", this.handleMouseMove), this.mapContainer.removeEventListener("contextmenu", this.handleContextMenu), this.mapContainer.removeEventListener("touchstart", this.handleTouchStart), this.mapContainer.removeEventListener("touchmove", this.handleTouchMove), this.mapContainer.removeEventListener("touchend", this.handleTouchEnd), this.mapContainer.removeEventListener("touchcancel", this.handleTouchEnd)), window.removeEventListener("mouseup", this.handleMouseUp), window.removeEventListener("keydown", this.handleKeyDown), this.selecaoBox && (this.selecaoBox.destruir(), this.selecaoBox = null), this.map && (this.map.dragging.enable(), this.map.doubleClickZoom.enable());
  }
  limparSelecao() {
    var t, o;
    (this.ctx.selectedPontoIds.length > 0 || this.ctx.selectedVizinhoPontoIds.length > 0) && (this.ctx.selectedPontoIds = [], this.ctx.selectedVizinhoPontoIds = [], this.ctx.lastSelectedPontoId = null, this.ctx.mapaController && (this.ctx.mapaController.context.selectedPontoIds = [], (o = (t = this.ctx.mapaController).atualizarDestaqueMarcadores) == null || o.call(t)), this.notificarSelecao());
  }
  notificarSelecao() {
    var t, o;
    this.ctx.mapaController && (this.ctx.mapaController.context.selectedPontoIds = [...this.ctx.selectedPontoIds], (o = (t = this.ctx.mapaController).atualizarDestaqueMarcadores) == null || o.call(t)), this.ctx.atualizarDestaqueLinhasTabela && this.ctx.atualizarDestaqueLinhasTabela(), this.ctx.onSelectionChange && this.ctx.onSelectionChange(this.ctx.selectedPontoIds, this.ctx.selectedVizinhoPontoIds), window.dispatchEvent(new CustomEvent("gerencigeo:ponto-selecionado", {
      detail: {
        selectedPontoIds: this.ctx.selectedPontoIds,
        selectedVizinhoPontoIds: this.ctx.selectedVizinhoPontoIds,
        lastSelectedPontoId: this.ctx.lastSelectedPontoId
      }
    }));
  }
  zoomExtents() {
    if (!this.ctx.pontosList || this.ctx.pontosList.length === 0) return;
    const t = this.ctx.pontosList.filter((o) => o.tipo_ponto !== "B" && o.tipo !== "B");
    t.length > 0 && this.ctx.mapaController && this.ctx.mapaController.fitBounds(t);
  }
  destroy() {
    this.desativar();
  }
}
class G {
  static register(t, o) {
    this.renderers.set(t.toLowerCase(), o);
  }
  static get(t) {
    return this.renderers.get(t.toLowerCase());
  }
  static has(t) {
    return this.renderers.has(t.toLowerCase());
  }
  static getRegisteredTypes() {
    return Array.from(this.renderers.keys());
  }
}
u(G, "renderers", /* @__PURE__ */ new Map());
class vt {
  render(t, o, e) {
    var r, l, p;
    const i = ((r = t.dados) == null ? void 0 : r.url) || "https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}", n = ((l = t.dados) == null ? void 0 : l.subdomains) || ["mt0", "mt1", "mt2", "mt3"], a = ((p = t.dados) == null ? void 0 : p.attribution) || "Google Satélite";
    return y.tileLayer(i, {
      maxZoom: 24,
      maxNativeZoom: 20,
      subdomains: n,
      attribution: a,
      keepBuffer: 16,
      updateWhenZooming: !1,
      updateWhenIdle: !0,
      className: "smooth-zoom-layer",
      opacity: t.opacidade !== void 0 ? t.opacidade : 1,
      pane: `pane-${t.id}`
    });
  }
  update(t, o, e) {
    o instanceof y.TileLayer && e.opacidade !== void 0 && o.setOpacity(e.opacidade);
  }
  destroy(t, o) {
    o.hasLayer(t) && o.removeLayer(t);
  }
}
class bt {
  render(t, o, e) {
    var l, p, d, f;
    const i = ((l = t.dados) == null ? void 0 : l.url) || "https://acervofundiario.incra.gov.br/i3geo/ogc.php", n = ((p = t.dados) == null ? void 0 : p.layers) || "certificada_sigef_particular_pr", a = ((d = t.dados) == null ? void 0 : d.format) || "image/png", c = ((f = t.dados) == null ? void 0 : f.attribution) || "INCRA/SIGEF";
    return y.tileLayer.wms(i, {
      layers: n,
      format: a,
      transparent: !0,
      version: "1.1.1",
      pane: `pane-${t.id}`,
      attribution: c,
      className: "sigef-wms-layer",
      keepBuffer: 8,
      updateWhenZooming: !1,
      updateWhenIdle: !0,
      opacity: t.opacidade !== void 0 ? t.opacidade : 0.85
    });
  }
  update(t, o, e) {
    o instanceof y.TileLayer.WMS && e.opacidade !== void 0 && o.setOpacity(e.opacidade);
  }
  destroy(t, o) {
    o.hasLayer(t) && o.removeLayer(t);
  }
}
function st(s, t, o) {
  const e = s.estilo.espessuraLinha || o.config.perimetroWeight || 2, i = o.graphicScale.lineScaleMultiplier || 1;
  if (s.estilo.scaleMode === "world") {
    const n = s.estilo.dimensaoMetros || 0.3, a = t.getCenter(), c = t.getZoom(), r = 40075016686e-3 * Math.abs(Math.cos(a.lat * Math.PI / 180)) / Math.pow(2, c + 8), l = n / (r > 0 ? r : 1);
    return Math.max(1, Math.round(l * i));
  }
  return Math.max(1, Math.round(e * i));
}
function it(s, t, o, e, i) {
  var v, P, b, S, I, L, E, w;
  const n = s.id === "homologados", a = ((v = s.dados) == null ? void 0 : v.conexoes) ?? (Array.isArray(s.dados) && s.dados.length > 0 && "origemId" in s.dados[0] ? s.dados : null), c = ((P = s.dados) == null ? void 0 : P.segmentos) || e.segmentos || [], r = ((b = s.dados) == null ? void 0 : b.pontos) || (n ? e.bancoPontos || [] : e.pontos) || [], l = st(s, o, e), p = s.opacidade !== void 0 ? s.opacidade : 1, d = s.interativo && !s.bloqueada, f = [];
  r.forEach((g) => {
    const m = j(g.lat ?? g.latitude ?? g.y, g.lon ?? g.lng ?? g.longitude ?? g.x);
    m && f.push({ ...g, lat: m.lat, lon: m.lon });
  });
  const h = (g) => {
    const m = f.find((x) => String(x.id) === String(g));
    if (m) return m;
    if (e.pontos) {
      const x = e.pontos.find((z) => String(z.id) === String(g));
      if (x) {
        const z = j(x.lat, x.lon);
        if (z) return { ...x, lat: z.lat, lon: z.lon };
      }
    }
    return null;
  };
  if (a && Array.isArray(a)) {
    a.forEach((g) => {
      var z, _, k, N, q, V, M;
      const m = h(g.origemId), x = h(g.destinoId);
      if (m && x && m.lat && m.lon && x.lat && x.lon) {
        const $ = g.tipoLinha === "tracejada" || ((z = g.estilo) == null ? void 0 : z.tipoLinha) === "tracejada", T = ((_ = g.estilo) == null ? void 0 : _.cor) || ((k = g.estilo) == null ? void 0 : k.color) || s.estilo.corPrimaria || "#00f5a0", B = ((N = g.estilo) == null ? void 0 : N.espessura) || ((q = g.estilo) == null ? void 0 : q.weight) || l, A = y.polyline([[m.lat, m.lon], [x.lat, x.lon]], {
          color: T,
          weight: B,
          opacity: ((V = g.estilo) == null ? void 0 : V.opacidade) ?? p,
          dashArray: $ ? "6, 6" : s.estilo.dashArray,
          pane: i,
          interactive: d
        });
        if (d) {
          const O = g.acoes || s.acoes || ((M = s.dados) == null ? void 0 : M.acoes) || [], H = `${g.origemId}-${g.destinoId}`, D = W(O, H);
          A.bindPopup(`
            <div style="font-family:sans-serif; color:rgba(255, 255, 255, 0.9); line-height:1.3;">
              <div style="font-weight:700; font-size:12px; margin-bottom:3px; color:#ffffff;">Conexão ${C(String(g.origemId))} ↔ ${C(String(g.destinoId))}</div>
              <div style="font-size:11px; color:rgba(255, 255, 255, 0.65);">Tipo: ${C(g.tipoLinha || "contínua")}</div>
              ${D}
            </div>
          `, { className: "compact-popup", maxWidth: 220 }), A.on("popupopen", (R) => {
            if (e.modoSequencial) {
              A.closePopup();
              return;
            }
            Y(R.popup, g, e, A);
          });
        }
        A.addTo(t);
      }
    });
    return;
  }
  if ((S = s.dados) != null && S.polilinhaSequencial || ((I = s.dados) == null ? void 0 : I.fechar) !== void 0 && f.length >= 2) {
    const g = ((L = s.dados) == null ? void 0 : L.chaveGrupo) || e.chaveGrupo, m = U(f, g), x = ((E = s.dados) == null ? void 0 : E.fechar) !== !1, z = s.estilo.corPrimaria || "#00f5a0";
    Object.entries(m).forEach(([_, k]) => {
      const N = X(k);
      if (N.length < 2) return;
      const q = N.map((M) => [M.lat, M.lon]), V = y.polyline(q, {
        color: z,
        weight: l,
        opacity: p,
        dashArray: s.estilo.dashArray,
        pane: i,
        interactive: d
      });
      if (d && V.bindPopup(`
          <div style="font-family:sans-serif; color:rgba(255, 255, 255, 0.9); line-height:1.3;">
            <div style="font-weight:700; font-size:12px; margin-bottom:3px; color:#ffffff;">Polilinha: Grupo ${C(_)}</div>
            <div style="font-size:11px; color:rgba(255, 255, 255, 0.65);">Vértices: ${N.length}</div>
          </div>
        `, { className: "compact-popup", maxWidth: 220 }), V.addTo(t), x && q.length >= 3) {
        const M = q[q.length - 1], $ = q[0];
        y.polyline([M, $], {
          color: z,
          weight: l,
          opacity: p,
          dashArray: "4, 4",
          pane: i,
          interactive: d
        }).addTo(t);
      }
    });
    return;
  }
  if (!n && c && c.length > 0)
    c.forEach((g) => {
      var z;
      const m = f.find((_) => String(_.id) === String(g.ponto_inicio_id)), x = f.find((_) => String(_.id) === String(g.ponto_fim_id));
      if (m && x && m.lat && m.lon && x.lat && x.lon) {
        const _ = g.tipo_limite_sigef || g.tipo_limite || "", k = g.metodo_posicionamento_sigef || g.metodo_posicionamento || "", N = _ === "LA1" ? "#10b981" : _ === "LN1" ? "#3b82f6" : "#00f5a0", q = s.estilo.corPrimaria || N, V = y.polyline([[m.lat, m.lon], [x.lat, x.lon]], {
          color: q,
          weight: l,
          opacity: p,
          dashArray: _ === "LN1" ? "6, 6" : s.estilo.dashArray,
          pane: i,
          interactive: d
        });
        if (d) {
          const M = g.acoes || s.acoes || ((z = s.dados) == null ? void 0 : z.acoes) || [], $ = `${g.ponto_inicio_id}-${g.ponto_fim_id}`, T = W(M, $);
          V.bindPopup(`
            <div style="font-family:sans-serif; color:rgba(255, 255, 255, 0.9); line-height:1.3;">
              <div style="font-weight:700; font-size:12px; margin-bottom:3px; color:#ffffff;">${C(m.nome_vertice)} ↔ ${C(x.nome_vertice)}</div>
              <div style="font-size:11px; color:rgba(255, 255, 255, 0.65);">Limite: ${C(_ || "N/A")} · ${C(k || "N/A")}</div>
              ${T}
            </div>
          `, { className: "compact-popup", maxWidth: 220 }), V.on("popupopen", (B) => {
            if (e.modoSequencial) {
              V.closePopup();
              return;
            }
            Y(B.popup, g, e, V);
          });
        }
        V.addTo(t);
      }
    });
  else if (f && f.length >= 2) {
    const g = f.filter(
      (k) => k.lat && k.lon && k.tipo_ponto !== "B" && k.tipo !== "B" && k.ignorar_poligono !== 1
    ), m = ((w = s.dados) == null ? void 0 : w.chaveGrupo) || e.chaveGrupo, x = U(g, m), z = s.estilo.corPrimaria || (n ? "#f59e0b" : "#10b981"), _ = s.estilo.dashArray || (n ? "6, 8" : void 0);
    Object.values(x).forEach((k) => {
      const N = X(k);
      if (N.length < 2) return;
      const q = N.map((M) => [M.lat, M.lon]);
      if (y.polyline(q, {
        color: z,
        weight: l,
        opacity: p,
        dashArray: _,
        pane: i,
        interactive: d
      }).addTo(t), q.length >= 3) {
        const M = q[q.length - 1], $ = q[0];
        y.polyline([M, $], {
          color: z,
          weight: l,
          opacity: p,
          dashArray: n ? "6, 8" : "4, 4",
          pane: i,
          interactive: d
        }).addTo(t);
      }
    });
  }
}
class xt {
  constructor() {
    u(this, "zoomListenerMap", /* @__PURE__ */ new WeakMap());
  }
  render(t, o, e) {
    const i = y.layerGroup(), n = `pane-${t.id}`;
    it(t, i, o, e, n);
    const a = () => {
      if (t.estilo.scaleMode === "world") {
        const c = st(t, o, e);
        i.eachLayer((r) => {
          r.setStyle && r.setStyle({ weight: c });
        });
      }
    };
    return o.on("zoomend", a), this.zoomListenerMap.set(i, a), i;
  }
  update(t, o, e, i, n) {
    (e.opacidade !== void 0 || e.estilo !== void 0 || e.dados !== void 0 || e.interativo !== void 0 || e.bloqueada !== void 0) && (o.clearLayers(), it(t, o, n, i, `pane-${t.id}`));
  }
  destroy(t, o) {
    const e = this.zoomListenerMap.get(t);
    e && (o.off("zoomend", e), this.zoomListenerMap.delete(t)), t.clearLayers(), o.hasLayer(t) && o.removeLayer(t);
  }
}
function Pt(s) {
  if (!s) return "#00f5a0";
  const t = s.trim();
  if (t.startsWith("#") || t.startsWith("rgb") || t.startsWith("hsl") || t.startsWith("var("))
    return t;
  if (t.includes("bg-[#") && t.includes("]")) {
    const e = t.match(/bg-\[(#[a-fA-F0-9]+)\]/);
    if (e) return e[1];
  }
  const o = {
    "bg-mint-vibrant": "#00f5a0",
    "bg-indigo-500": "#6366f1",
    "bg-rose-500": "#f43f5e",
    "bg-amber-500": "#f59e0b",
    "bg-forest-deep": "#06130b",
    "bg-purple-500": "#a855f7",
    "bg-blue-500": "#3b82f6",
    "bg-emerald-500": "#10b981"
  };
  for (const [e, i] of Object.entries(o))
    if (t.includes(e)) return i;
  return "#00f5a0";
}
function Z(s, t, o, e = "", i = "", n = !1) {
  const a = n || e.includes("ponto-selecionado") || e.includes("cad-marker-selected"), c = Pt(o), r = t + 6, l = t, p = a ? `box-shadow: 0 0 0 2px #ffffff, 0 0 0 4.5px ${c}, 0 0 16px ${c}; filter: drop-shadow(0 0 4px ${c});` : "box-shadow: 0 1px 4px rgba(0, 0, 0, 0.65), 0 0 1px rgba(0, 0, 0, 0.9);", f = `display:flex; align-items:center; justify-content:center; width:${r}px; height:${r}px; position:relative; pointer-events:auto; ${a ? "transform: scale(1.35); transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);" : "transition: transform 0.15s ease, filter 0.15s ease;"}`, h = `${o} ${e} ${a ? "ponto-selecionado" : ""}`.trim();
  switch (s) {
    case "square":
      return `
        <div id="${i}" class="${h}" style="${f}">
          <div style="width:${l}px; height:${l}px; background-color:${c}; border-radius:2px; border:1px solid rgba(0,0,0,0.4); box-sizing:border-box; ${p}"></div>
        </div>
      `;
    case "circle-dot": {
      const v = Math.max(3, Math.floor(l / 3));
      return `
        <div id="${i}" class="${h}" style="${f}">
          <div style="width:${l}px; height:${l}px; background-color:${c}; border-radius:50%; display:flex; align-items:center; justify-content:center; border:1px solid rgba(0,0,0,0.3); box-sizing:border-box; ${p}">
            <div style="width:${v}px; height:${v}px; background-color:#ffffff; border-radius:50%; box-shadow:0 0 2px rgba(0,0,0,0.8);"></div>
          </div>
        </div>
      `;
    }
    case "diamond":
      return `
        <div id="${i}" class="${h}" style="${f}">
          <svg width="${l + 2}" height="${l + 2}" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style="overflow:visible; ${a ? `filter: drop-shadow(0 0 3px #ffffff) drop-shadow(0 0 6px ${c});` : "filter: drop-shadow(0 1px 2px rgba(0,0,0,0.7));"}">
            <polygon points="6,1 11,6 6,11 1,6" fill="${c}" stroke="#000000" stroke-width="1.2" stroke-linejoin="round" />
            ${a ? '<polygon points="6,2.5 9.5,6 6,9.5 2.5,6" fill="none" stroke="#ffffff" stroke-width="1" />' : ""}
          </svg>
        </div>
      `;
    case "cross":
      return `
        <div id="${i}" class="${h}" style="${f}">
          <svg width="${l + 4}" height="${l + 4}" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style="overflow:visible; ${a ? `filter: drop-shadow(0 0 3px #ffffff) drop-shadow(0 0 6px ${c});` : "filter: drop-shadow(0 1px 2px rgba(0,0,0,0.7));"}">
            ${a ? '<circle cx="6" cy="6" r="5.5" stroke="#ffffff" stroke-width="1.2" stroke-dasharray="2 2" fill="none" />' : ""}
            <!-- Halo escuro de contraste para satélite -->
            <line x1="6" y1="1" x2="6" y2="11" stroke="#000000" stroke-width="3" stroke-linecap="round" />
            <line x1="1" y1="6" x2="11" y2="6" stroke="#000000" stroke-width="3" stroke-linecap="round" />
            <!-- Traço colorido do marcador -->
            <line x1="6" y1="1" x2="6" y2="11" stroke="${c}" stroke-width="${a ? "2.2" : "1.6"}" stroke-linecap="round" />
            <line x1="1" y1="6" x2="11" y2="6" stroke="${c}" stroke-width="${a ? "2.2" : "1.6"}" stroke-linecap="round" />
          </svg>
        </div>
      `;
    case "x":
      return `
        <div id="${i}" class="${h}" style="${f}">
          <svg width="${l + 4}" height="${l + 4}" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style="overflow:visible; ${a ? `filter: drop-shadow(0 0 3px #ffffff) drop-shadow(0 0 6px ${c});` : "filter: drop-shadow(0 1px 2px rgba(0,0,0,0.7));"}">
            ${a ? '<circle cx="6" cy="6" r="5.5" stroke="#ffffff" stroke-width="1.2" stroke-dasharray="2 2" fill="none" />' : ""}
            <!-- Halo escuro de contraste para satélite -->
            <line x1="2" y1="2" x2="10" y2="10" stroke="#000000" stroke-width="3" stroke-linecap="round" />
            <line x1="10" y1="2" x2="2" y2="10" stroke="#000000" stroke-width="3" stroke-linecap="round" />
            <!-- Traço colorido do marcador -->
            <line x1="2" y1="2" x2="10" y2="10" stroke="${c}" stroke-width="${a ? "2.2" : "1.6"}" stroke-linecap="round" />
            <line x1="10" y1="2" x2="2" y2="10" stroke="${c}" stroke-width="${a ? "2.2" : "1.6"}" stroke-linecap="round" />
          </svg>
        </div>
      `;
    case "triangle":
      return `
        <div id="${i}" class="${h}" style="${f}">
          <svg width="${l + 2}" height="${l + 2}" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style="overflow:visible; ${a ? `filter: drop-shadow(0 0 3px #ffffff) drop-shadow(0 0 6px ${c});` : "filter: drop-shadow(0 1px 2px rgba(0,0,0,0.7));"}">
            <polygon points="6,1.5 11,10.5 1,10.5" fill="${c}" stroke="#000000" stroke-width="1.2" stroke-linejoin="round" />
            ${a ? '<polygon points="6,3.5 9.5,9.5 2.5,9.5" fill="none" stroke="#ffffff" stroke-width="1" />' : ""}
          </svg>
        </div>
      `;
    case "circle":
    default:
      return `
        <div id="${i}" class="${h}" style="${f}">
          <div style="width:${l}px; height:${l}px; background-color:${c}; border-radius:50%; border:1px solid rgba(0,0,0,0.35); box-sizing:border-box; ${p}"></div>
        </div>
      `;
  }
}
class wt {
  constructor() {
    u(this, "zoomListenerMap", /* @__PURE__ */ new WeakMap());
  }
  render(t, o, e) {
    const i = y.layerGroup(), n = `pane-${t.id}`;
    this.rebuildPoints(t, i, o, e, n);
    const a = () => {
      t.estilo.scaleMode === "world" && i.eachLayer((c) => {
        if (c.setIcon && c.baseSize && c.shapeStyle && c.markerBg && c.pontoId !== void 0) {
          const r = this.calculateSize(t, o, e, c.baseSize), l = e.config.enableAnimations ? "transition-all duration-150" : "", p = Z(
            c.shapeStyle,
            r,
            c.markerBg,
            l,
            `map-marker-${t.id}-${c.pontoId}`,
            !!c.isSelected
          ), d = y.divIcon({
            html: p,
            className: "custom-leaflet-marker flex items-center justify-center",
            iconSize: [r + 6, r + 6]
          });
          c.setIcon(d);
        }
      });
    };
    return o.on("zoomend", a), this.zoomListenerMap.set(i, a), i;
  }
  calculateSize(t, o, e, i) {
    const n = e.graphicScale.markerScaleMultiplier || 1;
    if (t.estilo.scaleMode === "world") {
      const a = t.estilo.dimensaoMetros || 0.25, c = o.getCenter(), r = o.getZoom(), l = 40075016686e-3 * Math.abs(Math.cos(c.lat * Math.PI / 180)) / Math.pow(2, r + 8), p = a / (l > 0 ? l : 1);
      return Math.max(3, Math.round(p * n));
    }
    return Math.max(4, Math.round(i * n));
  }
  rebuildPoints(t, o, e, i, n) {
    var f;
    const c = t.id === "homologados-pontos" ? i.bancoPontos || [] : ((f = t.dados) == null ? void 0 : f.pontos) || i.pontos || [], r = t.interativo && !t.bloqueada, l = t.id === "vizinhos", p = t.id === "homologados" || t.id === "homologados-pontos", d = i.selectedPontoIds || [];
    c.forEach((h) => {
      var b;
      const v = h.lat ?? h.latitude, P = h.lon ?? h.lng ?? h.longitude;
      if (v !== void 0 && P !== void 0 && v !== 0 && P !== 0 && !isNaN(Number(v)) && !isNaN(Number(P))) {
        const S = h.tipo_ponto === "B" || h.tipo === "B", I = h.tipo_ponto === "M" || h.tipo === "M";
        let L = t.estilo.estiloMarcador || "x", E = t.estilo.corPrimaria || "bg-mint-vibrant", w = t.estilo.tamanhoMarcador || 7;
        p ? (L = "circle", E = t.estilo.corPrimaria || "#f59e0b", w = 8) : l ? (L = I ? "circle-dot" : t.estilo.estiloMarcador || "cross", E = t.estilo.corPrimaria || "#a855f7", w = I ? 10 : 8) : I ? (E = "#6366f1", L = "circle-dot", w = 10) : S && (E = "#f43f5e", L = "square", w = 9);
        const g = !!(h.selecionado || d.length > 0 && (d.includes(h.id) || d.includes(String(h.id)) || d.includes(Number(h.id)))), m = this.calculateSize(t, e, i, w), x = i.config.enableAnimations ? "transition-all duration-150" : "", z = Z(
          L,
          m,
          E,
          x,
          `map-marker-${t.id}-${h.id}`,
          g
        ), _ = y.divIcon({
          html: z,
          className: `custom-leaflet-marker flex items-center justify-center ${g ? "cad-marker-selected" : ""}`,
          iconSize: [m + 6, m + 6]
        }), k = y.marker([Number(v), Number(P)], {
          icon: _,
          pane: n,
          interactive: r
        });
        if (g && k.setZIndexOffset(2e3), k.pontoId = h.id, k.layerId = t.id, k.isVizinho = l, k.baseSize = w, k.shapeStyle = L, k.markerBg = E, k.isSelected = g, r) {
          const N = p ? "Vértice Homologado SIGEF" : l ? "Confrontante (Importado)" : I ? "Base Homologada PPP" : S ? "Base de Campo (Translação)" : "Vértice de Perímetro", q = h.acoes || t.acoes || ((b = t.dados) == null ? void 0 : b.acoes) || [], V = W(q, h.id);
          k.bindPopup(`
            <div style="font-family:sans-serif; color:rgba(255, 255, 255, 0.9); line-height:1.3;">
              <div style="font-weight:700; font-size:13px; margin-bottom:4px; color:#ffffff;">${C(h.nome_vertice || String(h.id))}</div>
              <div style="font-size:11px; color:rgba(255, 255, 255, 0.65);">${C(N)} · ${C(h.tipo_ponto || h.tipo || "Vértice")}</div>
              <div style="font-size:11px; color:rgba(255, 255, 255, 0.45); font-family:monospace; margin-top:4px;">Lat ${Number(v).toFixed(6)} &nbsp; Lon ${Number(P).toFixed(6)}</div>
              ${V}
            </div>
          `, {
            className: "compact-popup",
            maxWidth: 240
          }), q && q.length > 0 && k.on("popupopen", (M) => {
            Y(M.popup, h, i, k);
          }), k.on("click", () => {
            i.onMarkerClick && i.onMarkerClick(h.id, l, h, { lat: Number(v), lon: Number(P) });
          });
        }
        k.addTo(o);
      }
    });
  }
  update(t, o, e, i, n) {
    (e.opacidade !== void 0 || e.estilo !== void 0 || e.dados !== void 0 || e.interativo !== void 0 || e.bloqueada !== void 0) && (o.clearLayers(), this.rebuildPoints(t, o, n, i, `pane-${t.id}`));
  }
  destroy(t, o) {
    const e = this.zoomListenerMap.get(t);
    e && (o.off("zoomend", e), this.zoomListenerMap.delete(t)), t.clearLayers(), o.hasLayer(t) && o.removeLayer(t);
  }
}
class Ct {
  render(t, o, e) {
    const i = y.layerGroup(), n = `pane-${t.id}`;
    return this.rebuildPolygons(t, i, e, n), i;
  }
  rebuildPolygons(t, o, e, i) {
    var d, f;
    const a = (((d = t.dados) == null ? void 0 : d.poligonos) ?? (Array.isArray(t.dados) ? t.dados : null)) || ((f = t.dados) == null ? void 0 : f.confrontantes) || e.confrontantes || [], c = t.interativo && !t.bloqueada, r = t.estilo.corPrimaria || "#a855f7", l = t.estilo.espessuraLinha || 1.5, p = t.opacidade !== void 0 ? t.opacidade : 0.8;
    a.forEach((h) => {
      var w, g, m, x, z, _, k, N, q, V;
      if (!h) return;
      const v = ((w = h.estilo) == null ? void 0 : w.cor) || ((g = h.estilo) == null ? void 0 : g.color) || r, P = ((m = h.estilo) == null ? void 0 : m.espessura) || ((x = h.estilo) == null ? void 0 : x.weight) || l, b = ((z = h.estilo) == null ? void 0 : z.opacidade) ?? p, S = ((_ = h.estilo) == null ? void 0 : _.fillColor) || v, I = ((k = h.estilo) == null ? void 0 : k.fillOpacity) ?? Math.min(0.2, b * 0.15), L = ((N = h.estilo) == null ? void 0 : N.dashArray) || t.estilo.dashArray || "4, 6";
      if (h.coordenadas && Array.isArray(h.coordenadas) && h.coordenadas.length >= 3) {
        const M = Array.isArray(h.coordenadas[0]) && Array.isArray(h.coordenadas[0][0]);
        let $;
        if (M ? $ = h.coordenadas.map(
          (T) => T.map((B) => {
            const A = j(B[0], B[1]);
            return A ? [A.lat, A.lon] : null;
          }).filter(Boolean)
        ) : $ = h.coordenadas.map((T) => {
          const B = j(T[0], T[1]);
          return B ? [B.lat, B.lon] : null;
        }).filter(Boolean), $ && (M ? ((q = $[0]) == null ? void 0 : q.length) >= 3 : $.length >= 3)) {
          const T = y.polygon($, {
            color: v,
            weight: P,
            opacity: b,
            dashArray: L,
            fillColor: S,
            fillOpacity: I,
            pane: i,
            interactive: c
          });
          if (T.poligonoId = h.id, T.layerId = t.id, c) {
            let B = "";
            h.metadados && Object.keys(h.metadados).length > 0 && (B = Object.entries(h.metadados).map(([A, O]) => `<div style="font-size:11px;"><strong>${C(A)}:</strong> ${C(String(O))}</div>`).join("")), T.bindPopup(`
              <div style="font-family:sans-serif; color:rgba(255, 255, 255, 0.9); line-height:1.3; min-width:180px;">
                <div style="font-weight:700; font-size:12px; color:#c084fc; margin-bottom:3px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:3px;">Polígono ${C(String(h.id ?? ""))}</div>
                ${B || `<div style="font-size:11px;">Área vetorial definida por ${h.coordenadas.length} vértices</div>`}
              </div>
            `, { className: "compact-popup", maxWidth: 220 }), T.on("popupopen", () => {
              e.modoSequencial && T.closePopup();
            });
          }
          T.addTo(o);
          return;
        }
      }
      const E = h.wkt || h.poligono_wkt;
      if (E) {
        const M = [...E.matchAll(/\(([^()]+)\)/g)];
        if (M.length > 0) {
          const $ = C(h.nome_propriedade || `Polígono ${String(h.id || "")}`), T = C(h.nome || "Proprietário"), B = [];
          if (M.forEach((A) => {
            const O = A[1].split(",").map((H) => {
              const D = H.trim().split(/\s+/);
              if (D.length < 2) return null;
              const R = j(D[1], D[0]);
              return R ? [R.lat, R.lon] : null;
            }).filter((H) => H !== null);
            O.length >= 3 && B.push(O);
          }), B.length > 0) {
            const A = B.length === 1 ? B[0] : B, O = y.polygon(A, {
              color: v,
              weight: P,
              opacity: b,
              dashArray: L,
              fillColor: S,
              fillOpacity: I,
              pane: i,
              interactive: c
            });
            if (O.poligonoId = h.id, O.layerId = t.id, c) {
              const H = h.acoes || t.acoes || ((V = t.dados) == null ? void 0 : V.acoes) || [], D = W(H, h.id);
              O.bindPopup(`
                <div style="font-family:sans-serif; color:rgba(255, 255, 255, 0.9); line-height:1.3; min-width:180px;">
                  <div style="font-weight:700; font-size:12px; color:#c084fc; margin-bottom:3px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:3px;">${$}</div>
                  <div style="font-size:11px; margin-bottom:2px;"><strong>Identificador:</strong> ${C(String(h.id ?? ""))}</div>
                  ${h.nome ? `<div style="font-size:11px;"><strong>Proprietário:</strong> ${T}</div>` : ""}
                  ${D}
                </div>
              `, { className: "compact-popup", maxWidth: 220 }), O.on("popupopen", (R) => {
                if (e.modoSequencial) {
                  O.closePopup();
                  return;
                }
                Y(R.popup, h, e, O);
              });
            }
            O.addTo(o);
          }
        }
      }
      h.pontos && h.pontos.length > 0 && h.pontos.forEach((M) => {
        var T;
        const $ = j(M.lat ?? M.latitude ?? M.y, M.lon ?? M.lng ?? M.longitude ?? M.x);
        if ($) {
          const B = y.divIcon({
            html: '<div style="width:8px; height:8px; background:#a855f7; border-radius:50%; border:1px solid #ffffff; box-shadow:0 0 4px rgba(168,85,247,0.8);"></div>',
            className: "custom-leaflet-marker flex items-center justify-center",
            iconSize: [12, 12]
          }), A = y.marker([$.lat, $.lon], {
            icon: B,
            pane: i,
            interactive: c
          });
          if (A.pontoId = M.id, A.isVizinho = !0, A.layerId = t.id, c) {
            const O = M.acoes || h.acoes || t.acoes || ((T = t.dados) == null ? void 0 : T.acoes) || [], H = W(O, M.id);
            A.bindPopup(`
                <div style="font-family:sans-serif; color:rgba(255, 255, 255, 0.9); line-height:1.3; min-width:170px;">
                  <div style="font-weight:700; font-size:12px; color:#c084fc; margin-bottom:3px;">${C(M.nome_vertice || String(M.id))}</div>
                  <div style="font-size:11px; color:rgba(255, 255, 255, 0.65);">Confrontante: ${C(h.nome || "Desconhecido")}</div>
                  <div style="font-size:10px; color:rgba(255, 255, 255, 0.45); font-family:monospace; margin-top:3px;">Lat ${$.lat.toFixed(6)} &nbsp; Lon ${$.lon.toFixed(6)}</div>
                  ${H}
                </div>
              `, { className: "compact-popup", maxWidth: 220 }), A.on("click", () => {
              e.modoSequencial && A.closePopup(), e.onMarkerClick && e.onMarkerClick(M.id, !0, M, { lat: $.lat, lon: $.lon });
            }), A.on("popupopen", (D) => {
              if (e.modoSequencial) {
                A.closePopup();
                return;
              }
              Y(D.popup, M, e, A);
            });
          }
          A.addTo(o);
        }
      });
    });
  }
  update(t, o, e, i) {
    e.opacidade !== void 0 && e.estilo === void 0 && e.dados === void 0 && e.interativo === void 0 && e.bloqueada === void 0 || (e.opacidade !== void 0 || e.estilo !== void 0 || e.dados !== void 0 || e.interativo !== void 0 || e.bloqueada !== void 0) && (o.clearLayers(), this.rebuildPolygons(t, o, i, `pane-${t.id}`));
  }
  destroy(t, o) {
    t.clearLayers(), o.hasLayer(t) && o.removeLayer(t);
  }
}
class St {
  constructor() {
    u(this, "moveListenerMap", /* @__PURE__ */ new WeakMap());
  }
  render(t, o, e) {
    const i = y.layerGroup(), n = `pane-${t.id}`, a = () => {
      if (i.clearLayers(), !t.visivel) return;
      if (o.getZoom() > 20) {
        const r = o.getBounds(), l = r.getSouth(), p = r.getNorth(), d = r.getWest(), f = r.getEast(), h = o.getCenter(), v = 8999e-9, P = Math.cos(h.lat * Math.PI / 180), b = v / (P > 0.1 ? P : 1), S = Math.floor((p - l) / v), I = Math.floor((f - d) / b);
        if (S < 200 && I < 200) {
          const L = Math.ceil(l / v) * v;
          for (let w = L; w <= p; w += v)
            y.polyline([[w, d], [w, f]], {
              color: t.estilo.corPrimaria || "rgba(0, 245, 160, 0.18)",
              weight: t.estilo.espessuraLinha || 0.6,
              interactive: !1,
              pane: n
            }).addTo(i);
          const E = Math.ceil(d / b) * b;
          for (let w = E; w <= f; w += b)
            y.polyline([[l, w], [p, w]], {
              color: t.estilo.corPrimaria || "rgba(0, 245, 160, 0.18)",
              weight: t.estilo.espessuraLinha || 0.6,
              interactive: !1,
              pane: n
            }).addTo(i);
        }
      }
    };
    return a(), o.on("zoomend moveend", a), this.moveListenerMap.set(i, a), i;
  }
  update(t, o) {
    t.visivel || o.clearLayers();
  }
  destroy(t, o) {
    const e = this.moveListenerMap.get(t);
    e && (o.off("zoomend moveend", e), this.moveListenerMap.delete(t)), t.clearLayers(), o.hasLayer(t) && o.removeLayer(t);
  }
}
G.register("tile", new vt());
G.register("wms", new bt());
G.register("vetorial-linhas", new xt());
G.register("vetorial-pontos", new wt());
G.register("vetorial-poligonos", new Ct());
G.register("grid", new St());
const Mt = [
  {
    id: "satelite",
    nome: "Satélite Google Híbrido",
    categoria: "base",
    tipo: "tile",
    visivel: !0,
    opacidade: 1,
    zIndex: 200,
    interativo: !1,
    bloqueada: !1,
    estilo: { scaleMode: "screen" }
  },
  {
    id: "sigef",
    nome: "Acervo Fundiário SIGEF (INCRA)",
    categoria: "wms",
    tipo: "wms",
    visivel: !0,
    opacidade: 0.85,
    zIndex: 390,
    interativo: !0,
    bloqueada: !1,
    estilo: { scaleMode: "screen" }
  },
  {
    id: "homologados",
    nome: "Poligonal Homologada (Banco)",
    categoria: "referencia",
    tipo: "vetorial-linhas",
    visivel: !0,
    opacidade: 0.9,
    zIndex: 420,
    interativo: !0,
    bloqueada: !1,
    estilo: {
      corPrimaria: "#f59e0b",
      espessuraLinha: 2,
      dashArray: "6, 8",
      scaleMode: "screen"
    }
  },
  {
    id: "homologados-pontos",
    nome: "Marcos Homologados (Banco)",
    categoria: "referencia",
    tipo: "vetorial-pontos",
    visivel: !0,
    opacidade: 1,
    zIndex: 430,
    interativo: !0,
    bloqueada: !1,
    estilo: {
      tamanhoMarcador: 8,
      estiloMarcador: "circle",
      scaleMode: "screen"
    }
  },
  {
    id: "perimetro",
    nome: "Divisas e Poligonal do Imóvel",
    categoria: "levantamento",
    tipo: "vetorial-linhas",
    visivel: !0,
    opacidade: 1,
    zIndex: 450,
    interativo: !0,
    bloqueada: !1,
    estilo: {
      corPrimaria: "#00f5a0",
      espessuraLinha: 2,
      scaleMode: "screen",
      dimensaoMetros: 0.3
    }
  },
  {
    id: "vizinhos",
    nome: "Imóveis Confrontantes (WKT/CSV)",
    categoria: "referencia",
    tipo: "vetorial-poligonos",
    visivel: !0,
    opacidade: 0.8,
    zIndex: 500,
    interativo: !0,
    bloqueada: !1,
    estilo: {
      corPrimaria: "#a855f7",
      espessuraLinha: 1.5,
      dashArray: "4, 6",
      scaleMode: "screen"
    }
  },
  {
    id: "vertices",
    nome: "Vértices e Marcos do Levantamento",
    categoria: "levantamento",
    tipo: "vetorial-pontos",
    visivel: !0,
    opacidade: 1,
    zIndex: 650,
    interativo: !0,
    bloqueada: !1,
    estilo: {
      tamanhoMarcador: 8,
      scaleMode: "screen",
      dimensaoMetros: 0.25
    }
  },
  {
    id: "grade",
    nome: "Grade de Coordenadas UTM",
    categoria: "referencia",
    tipo: "grid",
    visivel: !0,
    opacidade: 0.5,
    zIndex: 700,
    interativo: !1,
    bloqueada: !1,
    estilo: {
      corPrimaria: "rgba(0, 245, 160, 0.18)",
      espessuraLinha: 0.6,
      scaleMode: "screen"
    }
  }
];
class kt {
  constructor(t) {
    u(this, "layers", []);
    u(this, "layerInstances", /* @__PURE__ */ new Map());
    u(this, "map", null);
    u(this, "context", null);
    u(this, "listeners", []);
    this.layers = (t || Mt).map((o) => ({ ...o, estilo: { ...o.estilo } }));
  }
  attachMap(t, o) {
    this.map = t, this.context = o, this.ensurePanes(), this.renderAllLayers();
  }
  ensurePanes() {
    this.map && this.layers.forEach((t) => {
      const o = `pane-${t.id}`;
      let e = this.map.getPane(o);
      e || (e = this.map.createPane(o)), e && (e.style.zIndex = String(t.zIndex), e.style.pointerEvents = t.interativo && !t.bloqueada && t.visivel ? "auto" : "none");
    });
  }
  renderAllLayers() {
    !this.map || !this.context || (this.layers.forEach((t) => {
      if (this.layerInstances.has(t.id)) {
        const o = this.layerInstances.get(t.id), e = G.get(t.tipo);
        e && e.destroy(o, this.map), this.layerInstances.delete(t.id);
      }
      if (t.visivel) {
        const o = G.get(t.tipo);
        if (o) {
          const e = o.render(t, this.map, this.context);
          e && (e.addTo(this.map), this.layerInstances.set(t.id, e));
        }
      }
    }), this.notifyChange());
  }
  setLayerVisibility(t, o) {
    const e = this.layers.find((a) => a.id === t);
    if (!e || e.visivel === o || (e.visivel = o, !this.map || !this.context)) return;
    const i = `pane-${e.id}`, n = this.map.getPane(i);
    if (n && (n.style.display = o ? "" : "none", n.style.pointerEvents = e.visivel && e.interativo && !e.bloqueada ? "auto" : "none"), o) {
      if (!this.layerInstances.has(t)) {
        const a = G.get(e.tipo);
        if (a) {
          const c = a.render(e, this.map, this.context);
          c && (c.addTo(this.map), this.layerInstances.set(t, c));
        }
      }
    } else if (this.layerInstances.has(t)) {
      const a = this.layerInstances.get(t), c = G.get(e.tipo);
      c && c.destroy(a, this.map), this.layerInstances.delete(t);
    }
    this.notifyChange();
  }
  setLayerOpacity(t, o) {
    const e = this.layers.find((n) => n.id === t);
    if (!e) return;
    if (e.opacidade = Math.max(0, Math.min(1, o)), this.map) {
      const n = this.map.getPane(`pane-${t}`);
      n && (n.style.opacity = String(e.opacidade));
    }
    const i = this.layerInstances.get(t);
    if (i && this.map && this.context) {
      const n = G.get(e.tipo);
      n && n.update(e, i, { opacidade: e.opacidade }, this.context, this.map);
    }
    this.notifyChange();
  }
  setLayerZIndex(t, o) {
    const e = this.layers.find((i) => i.id === t);
    if (e) {
      if (e.zIndex = o, this.map) {
        const i = this.map.getPane(`pane-${t}`);
        i && (i.style.zIndex = String(o));
      }
      this.notifyChange();
    }
  }
  setLayerBlocked(t, o) {
    const e = this.layers.find((i) => i.id === t);
    if (e) {
      if (e.bloqueada = o, this.map) {
        const i = this.map.getPane(`pane-${t}`);
        i && (i.style.pointerEvents = e.visivel && e.interativo && !o ? "auto" : "none");
      }
      this.notifyChange();
    }
  }
  setLayerScaleMode(t, o) {
    const e = this.layers.find((n) => n.id === t);
    if (!e) return;
    e.estilo.scaleMode = o;
    const i = this.layerInstances.get(t);
    if (i && this.map && this.context) {
      const n = G.get(e.tipo);
      n && n.update(e, i, { estilo: e.estilo }, this.context, this.map);
    }
    this.notifyChange();
  }
  setGraphicScale(t) {
    this.context && (this.context.graphicScale = { ...this.context.graphicScale, ...t }, this.renderAllLayers());
  }
  updateContext(t) {
    this.context && (this.context = { ...this.context, ...t }, this.renderAllLayers());
  }
  getLayers() {
    return [...this.layers];
  }
  getActiveSelectableLayers() {
    return this.layers.filter((t) => t.visivel && t.interativo && !t.bloqueada);
  }
  isLayerActiveAndSelectable(t) {
    const o = this.layers.find((e) => e.id === t);
    return !!(o && o.visivel && o.interativo && !o.bloqueada);
  }
  exportState() {
    return this.layers.map((t) => ({
      id: t.id,
      visivel: t.visivel,
      opacidade: t.opacidade,
      zIndex: t.zIndex,
      bloqueada: t.bloqueada,
      estilo: { ...t.estilo }
    }));
  }
  importState(t) {
    !t || !Array.isArray(t) || (t.forEach((o) => {
      const e = this.layers.find((i) => i.id === o.id);
      e && (o.visivel !== void 0 && (e.visivel = o.visivel), o.opacidade !== void 0 && (e.opacidade = o.opacidade), o.zIndex !== void 0 && (e.zIndex = o.zIndex), o.bloqueada !== void 0 && (e.bloqueada = o.bloqueada), o.estilo && (e.estilo = { ...e.estilo, ...o.estilo }));
    }), this.ensurePanes(), this.renderAllLayers());
  }
  onChange(t) {
    return this.listeners.push(t), () => {
      this.listeners = this.listeners.filter((o) => o !== t);
    };
  }
  notifyChange() {
    const t = this.getLayers();
    this.listeners.forEach((o) => {
      try {
        o(t);
      } catch (e) {
        console.error("Erro no listener de camadas:", e);
      }
    });
  }
  getAllLayerInstances() {
    return Array.from(this.layerInstances.values());
  }
  getLayerInstance(t) {
    return this.layerInstances.get(t);
  }
  getLayer(t) {
    return this.layers.find((o) => o.id === t);
  }
  getLayerDef(t) {
    return this.layers.find((o) => o.id === t);
  }
  getOrCreateLayer(t, o, e) {
    let i = this.layers.find((n) => n.id === t);
    return i || (i = {
      id: t,
      nome: e,
      categoria: "custom",
      tipo: o,
      visivel: !0,
      opacidade: 1,
      zIndex: 600,
      interativo: !0,
      bloqueada: !1,
      estilo: { scaleMode: "screen" }
    }, this.layers.push(i), this.ensurePanes()), i;
  }
  setLayerData(t, o) {
    const e = this.layers.find((n) => n.id === t);
    if (!e) return;
    e.dados = o;
    const i = this.layerInstances.get(t);
    if (i && this.map && this.context) {
      const n = G.get(e.tipo);
      n && n.update(e, i, { dados: o }, this.context, this.map);
    } else if (e.visivel && this.map && this.context) {
      const n = G.get(e.tipo);
      if (n) {
        const a = n.render(e, this.map, this.context);
        a && (a.addTo(this.map), this.layerInstances.set(t, a));
      }
    }
    this.notifyChange();
  }
  clearLayers(t) {
    (t && t.length > 0 ? t : Array.from(this.layerInstances.keys())).forEach((e) => {
      if (this.layerInstances.has(e)) {
        const i = this.layerInstances.get(e), n = this.layers.find((a) => a.id === e);
        if (n) {
          const a = G.get(n.tipo);
          a && a.destroy(i, this.map);
        }
        this.layerInstances.delete(e);
      }
    }), this.notifyChange();
  }
  destroy() {
    this.map && (this.layerInstances.forEach((t, o) => {
      const e = this.layers.find((i) => i.id === o);
      if (e) {
        const i = G.get(e.tipo);
        i && i.destroy(t, this.map);
      }
    }), this.layerInstances.clear()), this.listeners = [];
  }
}
function at(s, t) {
  var a, c;
  if (t == null) return null;
  const o = String(t).trim(), e = (r) => r ? (r.lon = r.lng, r) : null, n = s.getMarkers().find((r) => {
    var h, v, P, b;
    const l = r.pontoId, p = r.elementoId ?? r.id ?? ((h = r.options) == null ? void 0 : h.pontoId) ?? ((v = r.options) == null ? void 0 : v.id), d = (P = r.elemento) == null ? void 0 : P.nome_vertice, f = (b = r.elemento) == null ? void 0 : b.codigo_completo;
    return String(l) === o || String(p) === o || d && String(d).toLowerCase() === o.toLowerCase() || f && String(f).toLowerCase() === o.toLowerCase();
  });
  if (n && typeof n.getLatLng == "function")
    return e(n.getLatLng());
  if (s.layerManager)
    for (const r of s.layerManager.getAllLayerInstances()) {
      let l = null;
      const p = (d) => {
        var v, P, b, S, I;
        if (l) return;
        const f = d.pontoId ?? d.elementoId ?? d.id ?? ((v = d.options) == null ? void 0 : v.id) ?? ((P = d.options) == null ? void 0 : P.pontoId), h = ((b = d.elemento) == null ? void 0 : b.nome) ?? ((S = d.elemento) == null ? void 0 : S.nome_vertice) ?? ((I = d.options) == null ? void 0 : I.nome);
        (String(f) === o || h && String(h).toLowerCase() === o.toLowerCase()) && (typeof d.getLatLng == "function" ? l = d.getLatLng() : typeof d.getBounds == "function" && (l = d.getBounds().getCenter()));
      };
      if (p(r), typeof r.eachLayer == "function" && r.eachLayer(p), l) return e(l);
    }
  if (s.context.pontos && s.context.pontos.length > 0) {
    const r = s.context.pontos.find(
      (l) => String(l.id) === o || l.nome_vertice && String(l.nome_vertice).toLowerCase() === o.toLowerCase()
    );
    if (r) {
      const l = r.lat ?? r.latitude ?? r.y, p = r.lon ?? r.lng ?? r.longitude ?? r.x, d = j(l, p);
      if (d) return e(y.latLng(d.lat, d.lon));
    }
  }
  if (s.context.bancoPontos && s.context.bancoPontos.length > 0) {
    const r = s.context.bancoPontos.find(
      (l) => String(l.id) === o || l.codigo_completo && String(l.codigo_completo).toLowerCase() === o.toLowerCase() || l.nome_vertice && String(l.nome_vertice).toLowerCase() === o.toLowerCase()
    );
    if (r) {
      const l = r.lat ?? r.latitude ?? r.y, p = r.lon ?? r.lng ?? r.longitude ?? r.x, d = j(l, p);
      if (d) return e(y.latLng(d.lat, d.lon));
    }
  }
  if (s.context.confrontantes && s.context.confrontantes.length > 0) {
    const r = s.context.confrontantes.find(
      (l) => String(l.id) === o || l.nome && String(l.nome).toLowerCase() === o.toLowerCase() || l.nome_propriedade && String(l.nome_propriedade).toLowerCase() === o.toLowerCase()
    );
    if (r) {
      if (r.pontos && r.pontos.length > 0) {
        let l = 0, p = 0, d = 0;
        for (const f of r.pontos) {
          const h = f.lat ?? f.latitude ?? f.y, v = f.lon ?? f.lng ?? f.longitude ?? f.x, P = j(h, v);
          P && (l += P.lat, p += P.lon, d++);
        }
        if (d > 0)
          return e(y.latLng(l / d, p / d));
      }
      if (r.poligono_wkt) {
        const l = Q(r.poligono_wkt);
        if (l) return e(y.latLng(l.lat, l.lon));
      }
    }
  }
  if (s.context.segmentos && s.context.segmentos.length > 0) {
    const r = s.context.segmentos.find(
      (l) => String(l.id) === o || `${l.ponto_inicio_id}-${l.ponto_fim_id}` === o
    );
    if (r) {
      const l = (a = s.context.pontos) == null ? void 0 : a.find((d) => String(d.id) === String(r.ponto_inicio_id)), p = (c = s.context.pontos) == null ? void 0 : c.find((d) => String(d.id) === String(r.ponto_fim_id));
      if (l && p) {
        const d = j(l.lat ?? l.latitude, l.lon ?? l.longitude), f = j(p.lat ?? p.latitude, p.lon ?? p.longitude);
        if (d && f)
          return e(y.latLng((d.lat + f.lat) / 2, (d.lon + f.lon) / 2));
      }
    }
  }
  if (s.layerManager) {
    for (const r of s.layerManager.getLayers())
      if (r.dados) {
        if (Array.isArray(r.dados.pontos)) {
          const l = r.dados.pontos.find((p) => String(p.id) === o || p.nome_vertice && String(p.nome_vertice) === o);
          if (l) {
            const p = j(l.lat, l.lon);
            if (p) return e(y.latLng(p.lat, p.lon));
          }
        }
        if (Array.isArray(r.dados.poligonos)) {
          const l = r.dados.poligonos.find((p) => String(p.id) === o);
          if (l) {
            if (l.wkt) {
              const p = Q(l.wkt);
              if (p) return e(y.latLng(p.lat, p.lon));
            }
            if (Array.isArray(l.coordenadas) && l.coordenadas.length > 0) {
              let p = 0, d = 0, f = 0;
              for (const h of l.coordenadas) {
                const v = j(h[0], h[1]) || j(h[1], h[0]);
                v && (p += v.lat, d += v.lon, f++);
              }
              if (f > 0) return e(y.latLng(p / f, d / f));
            }
          }
        }
      }
  }
  return null;
}
function Lt(s, t, o, e) {
  var h, v;
  J(t, s.getMap());
  const i = s.getMap();
  if (!i) return;
  const n = at(s, o);
  if (!n) {
    console.warn(`[ui-canvas-cad] Elemento com identificador "${o}" não encontrado para destaque.`);
    return;
  }
  const a = (e == null ? void 0 : e.pan) === !0, c = e == null ? void 0 : e.zoom;
  a ? c !== void 0 ? typeof i.flyTo == "function" ? i.flyTo(n, c, { animate: !0 }) : i.setView(n, c, { animate: !0 }) : typeof i.panTo == "function" ? i.panTo(n, { animate: !0 }) : i.setView(n, i.getZoom(), { animate: !0 }) : c !== void 0 && i.setZoom(c, { animate: !0 });
  const r = (e == null ? void 0 : e.cor) || "#00f5a0", l = "pane-destaque";
  let p = i.getPane(l);
  p || (p = i.createPane(l)), p && (p.style.zIndex = "850", p.style.pointerEvents = "none");
  const d = y.divIcon({
    className: "cad-destaque-marker-container",
    html: `
      <div class="cad-pulse-highlight" style="--cad-pulse-cor: ${C(r)};">
        <div class="cad-pulse-core"></div>
        <div class="cad-pulse-ring ring-1"></div>
        <div class="cad-pulse-ring ring-2"></div>
      </div>
    `,
    iconSize: [52, 52],
    iconAnchor: [26, 26]
  });
  t.destaqueMarker = y.marker(n, {
    icon: d,
    pane: l,
    interactive: !1,
    keyboard: !1
  }), t.destaqueMarker.addTo(i);
  const f = (v = (h = t.destaqueMarker).getElement) == null ? void 0 : v.call(h);
  f && (f.style.pointerEvents = "none"), e != null && e.duracaoMs && e.duracaoMs > 0 && (t.destaqueTimeoutId = window.setTimeout(() => {
    J(t, i);
  }, e.duracaoMs));
}
function J(s, t) {
  s.destaqueTimeoutId !== null && (window.clearTimeout(s.destaqueTimeoutId), s.destaqueTimeoutId = null), s.destaqueMarker && (t && t.hasLayer(s.destaqueMarker) ? t.removeLayer(s.destaqueMarker) : typeof s.destaqueMarker.remove == "function" && s.destaqueMarker.remove(), s.destaqueMarker = null);
}
function zt(s, t) {
  const o = /* @__PURE__ */ new Map();
  s.forEach((i) => {
    const n = i.lat ?? i.latitude ?? i.y, a = i.lon ?? i.lng ?? i.longitude ?? i.x, c = j(n, a);
    c && (i.lat = c.lat, i.lon = c.lon);
    const r = i.confrontante_id ?? i.id_confrontante ?? 0;
    o.has(r) || o.set(r, []), o.get(r).push(i);
  });
  const e = /* @__PURE__ */ new Map();
  return t.forEach((i) => {
    const n = i.id !== void 0 && i.id !== null ? i.id : 0;
    e.set(n, { ...i, pontos: [] });
  }), o.forEach((i, n) => {
    var a, c;
    if (e.has(n)) {
      const r = e.get(n);
      r.pontos = i;
    } else
      e.set(n, {
        id: n,
        nome: ((a = i[0]) == null ? void 0 : a.nome_confrontante) || "Confrontante",
        nome_propriedade: ((c = i[0]) == null ? void 0 : c.nome_propriedade) || "",
        pontos: i
      });
  }), Array.from(e.values()).filter((i) => i.pontos && i.pontos.length > 0 || !!i.poligono_wkt);
}
function It(s, t) {
  const o = /* @__PURE__ */ new Map();
  return t.forEach((e) => {
    e.id !== void 0 && e.id !== null && e.pontos && e.pontos.length > 0 && o.set(e.id, e.pontos);
  }), s.map((e) => {
    const i = e.id !== void 0 && e.id !== null ? e.id : void 0;
    return i !== void 0 && (!e.pontos || e.pontos.length === 0) && o.has(i) ? { ...e, pontos: o.get(i) } : { ...e };
  });
}
function Et(s, t, o = !1) {
  let e = [...s];
  o && t && t.forEach((n) => {
    n.pontos && e.push(...n.pontos);
  });
  const i = e.map((n) => {
    const a = n.lat ?? n.latitude ?? n.y, c = n.lon ?? n.lng ?? n.longitude ?? n.x, r = j(a, c);
    return r ? y.latLng(r.lat, r.lon) : null;
  }).filter((n) => n !== null);
  return i.length === 1 ? { single: i[0] } : i.length > 1 ? { bounds: y.latLngBounds(i) } : null;
}
function At(s, t) {
  const o = [], e = /* @__PURE__ */ new Set(), i = (n) => {
    n instanceof y.Marker && n.pontoId !== void 0 && !e.has(n) && (e.add(n), o.push(n));
  };
  return s && s.eachLayer((n) => {
    i(n), typeof n.eachLayer == "function" && n.eachLayer(i);
  }), t && t.getAllLayerInstances().forEach((n) => {
    i(n), typeof n.eachLayer == "function" && n.eachLayer(i);
  }), o;
}
function _t(s, t, o = "vertices", e) {
  const i = t || [];
  s.layerManager.getOrCreateLayer(o, "vetorial-pontos", "Pontos / Vértices"), o === "vertices" && (s.context.pontos = i, s.canvasInteracao.ctx.pontosList = i, e && (s.customMarkerClickCallback = (n) => {
    const a = i.find((c) => String(c.id) === String(n)) || { id: n, lat: 0, lon: 0 };
    e(a);
  })), s.layerManager.setLayerData(o, { pontos: i, onClique: e }), s.layerManager.setLayerVisibility(o, !0);
}
function $t(s, t, o = "linhas") {
  const e = t || [];
  s.layerManager.getOrCreateLayer(o, "vetorial-linhas", "Conexões / Linhas"), (o === "linhas" || o === "perimetro") && (s.context.segmentos = e.map((i) => ({
    ponto_inicio_id: Number(i.origemId) || 0,
    ponto_fim_id: Number(i.destinoId) || 0,
    tipo_limite_sigef: i.tipoLinha === "tracejada" ? "LN1" : "LA1"
  }))), s.layerManager.setLayerData(o, { conexoes: e }), s.layerManager.setLayerVisibility(o, !0);
}
function qt(s, t, o = !0, e = "polilinha", i) {
  const n = t || [];
  s.layerManager.getOrCreateLayer(e, "vetorial-linhas", "Polilinhas"), (e === "polilinha" || e === "perimetro") && (s.context.pontos = n, s.context.segmentos = [], s.canvasInteracao.ctx.pontosList = n);
  const a = i || s.chaveGrupo || s.context.chaveGrupo;
  s.layerManager.setLayerData(e, {
    pontos: n,
    fechar: o !== !1,
    polilinhaSequencial: !0,
    chaveGrupo: a
  }), s.layerManager.setLayerVisibility(e, !0);
}
function Tt(s, t, o = "poligonos") {
  const e = t || [];
  s.layerManager.getOrCreateLayer(o, "vetorial-poligonos", "Polígonos"), s.layerManager.setLayerData(o, { poligonos: e }), s.layerManager.setLayerVisibility(o, !0);
}
function Bt(s, t, o) {
  const e = t || [];
  if (o != null) {
    const i = o || [];
    s.context.pontos = i, s.canvasInteracao.ctx.pontosList = i;
  }
  s.context.segmentos = e, s.layerManager.updateContext({
    segmentos: e,
    ...o != null ? { pontos: s.context.pontos } : {}
  });
}
function Nt(s, t = !1) {
  s.context.pontos = [], s.context.segmentos = [], s.context.confrontantes = [], s.canvasInteracao.ctx.pontosList = [], s.canvasInteracao.limparSelecao();
  const o = {
    pontos: [],
    segmentos: [],
    confrontantes: []
  };
  t || (s.context.bancoPontos = [], o.bancoPontos = []), s.layerManager.updateContext(o);
}
class Vt {
  constructor(t) {
    u(this, "core");
    u(this, "layerManager");
    u(this, "canvasInteracao");
    u(this, "context");
    u(this, "modoCliqueSequencialAtivo", !1);
    u(this, "chaveGrupo");
    u(this, "zonaProjecao", 22);
    u(this, "levantamentoId", null);
    u(this, "customMarkerClickCallback");
    u(this, "customPopupActionCallback");
    u(this, "destaqueState", {
      destaqueMarker: null,
      destaqueTimeoutId: null
    });
    this.core = new ut(this), this.layerManager = new kt(t), this.canvasInteracao = new yt({
      mapaController: this,
      layerManager: this.layerManager
    }), this.context = {
      pontos: [],
      segmentos: [],
      bancoPontos: [],
      confrontantes: [],
      zonaProjecao: 22,
      config: this.core.config,
      graphicScale: {
        markerScaleMultiplier: 1,
        lineScaleMultiplier: 1,
        scaleModeGlobal: "screen"
      },
      onMarkerClick: (o, e) => {
        if (this.modoCliqueSequencialAtivo || this.context.modoSequencial) return;
        const i = o != null && !isNaN(Number(o)) && String(o).trim() !== "" ? Number(o) : o;
        if (this.customMarkerClickCallback)
          try {
            this.customMarkerClickCallback(i, e);
          } catch (n) {
            console.error("Erro no customMarkerClickCallback:", n);
          }
        e ? this.canvasInteracao.ctx.selectedVizinhoPontoIds = [i] : (this.canvasInteracao.ctx.selectedPontoIds = [i], this.canvasInteracao.ctx.lastSelectedPontoId = i), this.context.selectedPontoIds = [...this.canvasInteracao.ctx.selectedPontoIds], this.atualizarDestaqueMarcadores(), window.dispatchEvent(new CustomEvent("gerencigeo:ponto-selecionado", {
          detail: { selectedPontoIds: [i], lastSelectedPontoId: i, isVizinho: e }
        }));
      },
      onPopupAcao: (o, e, i) => {
        if (this.customPopupActionCallback)
          try {
            this.customPopupActionCallback(o, e, i);
          } catch (n) {
            console.error("Erro no customPopupActionCallback:", n);
          }
      }
    };
  }
  init(t, o) {
    const e = this.core.init(t);
    return e && (this.layerManager.attachMap(e, this.context), this.canvasInteracao.ativar(this, o)), e;
  }
  invalidateSize() {
    try {
      this.core && (typeof this.core.invalidateSize == "function" ? this.core.invalidateSize() : this.core.map && typeof this.core.map.invalidateSize == "function" && this.core.map.invalidateSize());
    } catch {
    }
  }
  setPontos(t) {
    const o = t || [];
    this.context.pontos = o, this.canvasInteracao.ctx.pontosList = o, this.layerManager.updateContext({ pontos: o });
  }
  setSegmentos(t) {
    const o = t || [];
    this.context.segmentos = o, this.layerManager.updateContext({ segmentos: o });
  }
  setBancoPontos(t) {
    const o = t || [];
    this.context.bancoPontos = o, this.layerManager.updateContext({ bancoPontos: o });
  }
  setConfrontantes(t) {
    const o = t || [];
    this.context.confrontantes = o, this.layerManager.updateContext({ confrontantes: o });
  }
  plotarPontos(t, o = "vertices", e) {
    _t(this, t, o, e);
  }
  plotarConexoes(t, o = "linhas") {
    $t(this, t, o);
  }
  plotarPolilinhaSequencial(t, o = !0, e = "polilinha", i) {
    qt(this, t, o, e, i);
  }
  plotarPoligonos(t, o = "poligonos") {
    Tt(this, t, o);
  }
  limparCamadas(t) {
    this.layerManager.clearLayers(t), (!t || t.length === 0) && this.canvasInteracao.limparSelecao();
  }
  obterMarcadores(t) {
    if (t) {
      const o = [], e = this.layerManager.getLayerInstance(t);
      if (e) {
        const i = (n) => {
          n instanceof y.Marker && o.push(n);
        };
        i(e), typeof e.eachLayer == "function" && e.eachLayer(i);
      }
      return o;
    }
    return this.getMarkers();
  }
  plotPontos(t, o) {
    o && (this.customMarkerClickCallback = o), this.setPontos(t || []);
  }
  plotSegmentos(t, o) {
    Bt(this, t, o);
  }
  plotPolilinhaTemporaria(t) {
    const o = t || [];
    this.context.pontos = o, this.context.segmentos = [], this.canvasInteracao.ctx.pontosList = o, this.layerManager.updateContext({ pontos: o, segmentos: [] });
  }
  plotPoligonalHomologada(t) {
    const o = t || [];
    this.setBancoPontos(o), this.layerManager.setLayerVisibility("homologados", !0), this.layerManager.setLayerVisibility("homologados-pontos", !0);
  }
  plotPontosVizinhos(t) {
    const o = zt(t || [], this.context.confrontantes || []);
    this.setConfrontantes(o), this.layerManager.setLayerVisibility("vizinhos", !0);
  }
  plotPoligonosVizinhos(t) {
    const o = It(t || [], this.context.confrontantes || []);
    this.setConfrontantes(o), this.layerManager.setLayerVisibility("vizinhos", !0);
  }
  clearOverlays(t = !1) {
    Nt(this, t);
  }
  setGraphicScale(t) {
    this.layerManager.setGraphicScale(t);
  }
  exportState() {
    return this.layerManager.exportState();
  }
  importState(t) {
    this.layerManager.importState(t);
  }
  selectPonto(t, o) {
    if (!this.core.map) return;
    const e = String(t), i = this.getMarkers().find((a) => String(a.pontoId) === e);
    if (i) {
      const a = o !== void 0 ? o : this.core.map.getZoom();
      this.core.map.setView(i.getLatLng(), a), i.openPopup();
    }
    const n = t != null && !isNaN(Number(t)) && String(t).trim() !== "" ? Number(t) : t;
    this.canvasInteracao.ctx.selectedPontoIds = [n], this.canvasInteracao.ctx.lastSelectedPontoId = n, this.context.selectedPontoIds = [n], this.atualizarDestaqueMarcadores();
  }
  atualizarDestaqueMarcadores() {
    var n, a, c;
    const t = this.context.selectedPontoIds || [], o = this.canvasInteracao.ctx.selectedVizinhoPontoIds || [], e = /* @__PURE__ */ new Set([
      ...t.map(String),
      ...o.map(String)
    ]), i = this.getMarkers();
    for (const r of i) {
      const l = r, p = l.pontoId;
      if (p == null) continue;
      const d = e.has(String(p));
      if (l.isSelected !== d) {
        if (l.isSelected = d, d ? r.setZIndexOffset(2e3) : r.setZIndexOffset(0), l.shapeStyle && l.baseSize && l.markerBg) {
          const h = this.layerManager.getLayerDef(l.layerId), v = l.baseSize || 8;
          let P = v;
          if (this.core.map && ((n = h == null ? void 0 : h.estilo) == null ? void 0 : n.scaleMode) === "world") {
            const L = h.estilo.dimensaoMetros || 0.25, E = this.core.map.getCenter(), w = this.core.map.getZoom(), g = 40075016686e-3 * Math.abs(Math.cos(E.lat * Math.PI / 180)) / Math.pow(2, w + 8), m = L / (g > 0 ? g : 1), x = ((a = this.context.graphicScale) == null ? void 0 : a.markerScaleMultiplier) || 1;
            P = Math.max(3, Math.round(m * x));
          } else {
            const L = ((c = this.context.graphicScale) == null ? void 0 : c.markerScaleMultiplier) || 1;
            P = Math.max(4, Math.round(v * L));
          }
          const b = this.context.config.enableAnimations ? "transition-all duration-150" : "", S = Z(
            l.shapeStyle,
            P,
            l.markerBg,
            b,
            `map-marker-${l.layerId || "pts"}-${p}`,
            d
          ), I = y.divIcon({
            html: S,
            className: `custom-leaflet-marker flex items-center justify-center ${d ? "cad-marker-selected ponto-selecionado" : ""}`,
            iconSize: [P + 6, P + 6]
          });
          r.setIcon(I);
        }
        const f = r.getElement();
        f && (d ? f.classList.add("cad-marker-selected", "ponto-selecionado") : f.classList.remove("cad-marker-selected", "ponto-selecionado"));
      }
    }
  }
  fitBounds(t, o = [40, 40], e = !1) {
    if (!this.core.map) return;
    const i = Et(t || this.context.pontos || [], this.context.confrontantes, e);
    if (i) {
      i.single ? this.core.map.setView(i.single, 18) : i.bounds && (this.core.map.fitBounds(i.bounds, { padding: o }), this.core.map.once("moveend", () => {
        this.core.preCarregarTilesRegiao(i.bounds);
      }));
      try {
        this.core.map.invalidateSize();
      } catch {
      }
    }
  }
  getMarkers() {
    return At(this.core.map, this.layerManager);
  }
  getVizinhosMarkers() {
    return this.getMarkers().filter((t) => !!t.isVizinho);
  }
  get destaqueAtivo() {
    return this.destaqueState.destaqueMarker !== null;
  }
  localizarCoordenadasElemento(t) {
    return at(this, t);
  }
  destacarElemento(t, o) {
    Lt(this, this.destaqueState, t, o);
  }
  limparDestaque() {
    J(this.destaqueState, this.getMap());
  }
  destroy() {
    if (this.limparDestaque(), this.canvasInteracao.desativar(), this.layerManager.destroy(), this.core.destroy(), this.core.map)
      try {
        this.core.map.off(), this.core.map.remove();
      } catch {
      } finally {
        this.core.map = null;
      }
  }
  getMap() {
    return this.core.map;
  }
}
function Gt(s, t, o, e) {
  if (!s) return;
  if (s.querySelectorAll(".layer-item").length === t.length) {
    t.forEach((n) => {
      var c, r;
      const a = s.querySelector(`.layer-item[data-layer-id="${n.id}"]`);
      if (a) {
        const l = a.querySelector(".layer-chk-visibility");
        l && l.checked !== n.visivel && (l.checked = n.visivel);
        const p = a.querySelector(".layer-opacity-slider"), d = a.querySelector(".opacity-percent-label"), f = Math.round(n.opacidade * 100);
        p && parseInt(p.value, 10) !== f && (p.value = String(f)), d && (d.textContent = `${f}%`);
        const h = a.querySelector(".btn-lock-layer");
        h && (h.classList.toggle("active", !!n.bloqueada), h.title = n.bloqueada ? "Desbloquear Camada" : "Bloquear Camada");
        const v = a.querySelector(".btn-toggle-scale-mode");
        v && ((c = n.estilo) != null && c.scaleMode) && (v.textContent = ((r = n.estilo) == null ? void 0 : r.scaleMode) === "world" ? "Métrico" : "Tela");
      }
    });
    return;
  }
  s.innerHTML = `
    ${t.map((n) => {
    var a, c;
    return `
      <div class="layer-item" data-layer-id="${n.id}">
        <div class="layer-item-row">
          <label class="layer-item-label">
            <input type="checkbox" class="layer-chk-visibility" data-layer-id="${n.id}" ${n.visivel ? "checked" : ""} />
            <span>${n.nome}</span>
          </label>
          <div class="layer-item-actions">
            <button class="btn-layer-action btn-lock-layer ${n.bloqueada ? "active" : ""}" data-layer-id="${n.id}" type="button" title="${n.bloqueada ? "Desbloquear Camada" : "Bloquear Camada"}">
              ${n.bloqueada ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>'}
            </button>
            ${(a = n.estilo) != null && a.scaleMode ? `
              <span class="scale-mode-pill btn-toggle-scale-mode" data-layer-id="${n.id}" title="Alternar modo de escala">
                ${((c = n.estilo) == null ? void 0 : c.scaleMode) === "world" ? "Métrico" : "Tela"}
              </span>
            ` : ""}
          </div>
        </div>
        <div class="layer-controls-row">
          <span>Opacidade</span>
          <input type="range" min="0" max="100" value="${Math.round(n.opacidade * 100)}" class="layer-opacity-slider" data-layer-id="${n.id}" />
          <span class="opacity-percent-label" style="font-family:monospace; font-size:9px; width:28px; text-align:right;">${Math.round(n.opacidade * 100)}%</span>
        </div>
      </div>
    `;
  }).join("")}
  `, o.cleanup(), s.querySelectorAll(".layer-chk-visibility").forEach((n) => {
    o.add(n, "change", (a) => {
      const c = a.target.getAttribute("data-layer-id"), r = a.target.checked;
      c && e.setLayerVisibility(c, r);
    });
  }), s.querySelectorAll(".layer-opacity-slider").forEach((n) => {
    o.add(n, "input", (a) => {
      const c = a.target.getAttribute("data-layer-id"), r = parseInt(a.target.value, 10), l = r / 100, p = a.target.closest(".layer-item"), d = p == null ? void 0 : p.querySelector(".opacity-percent-label");
      d && (d.textContent = `${r}%`), c && e.setLayerOpacity(c, l);
    });
  }), s.querySelectorAll(".btn-lock-layer").forEach((n) => {
    o.add(n, "click", (a) => {
      const c = a.currentTarget.getAttribute("data-layer-id");
      if (c) {
        const r = t.find((l) => l.id === c);
        r && e.setLayerBlocked(c, !r.bloqueada);
      }
    });
  }), s.querySelectorAll(".btn-toggle-scale-mode").forEach((n) => {
    o.add(n, "click", (a) => {
      var r;
      const c = a.currentTarget.getAttribute("data-layer-id");
      if (c) {
        const l = t.find((p) => p.id === c);
        if (l) {
          const p = ((r = l.estilo) == null ? void 0 : r.scaleMode) === "world" ? "screen" : "world";
          e.setLayerScaleMode(c, p);
        }
      }
    });
  });
}
function Ot(s, t, o, e) {
  var b, S, I, L, E, w;
  if (s.modoSequencial || s.controller.canvasInteracao.selectionHappened || s.controller.canvasInteracao.panHappened || s.mouseMovedSinceDown) return !1;
  const i = (t == null ? void 0 : t.originalEvent) || t, n = typeof (i == null ? void 0 : i.composedPath) == "function" ? i.composedPath() : [], a = n.length > 0 ? n[0] : (i == null ? void 0 : i.target) || (t == null ? void 0 : t.target);
  if (a) {
    const g = '.custom-leaflet-marker, .leaflet-marker-icon, .leaflet-interactive, .compact-popup, .leaflet-popup, .ui-popup-btn, .cad-btn-tool, .qgis-layer-panel, [class*="leaflet-marker"], [class*="leaflet-popup"]';
    if (((b = a.matches) == null ? void 0 : b.call(a, g)) || ((S = a.closest) == null ? void 0 : S.call(a, g))) return !1;
  }
  const c = s.controller.getMap();
  if (!c || !s.mapContainer) return !1;
  let r, l;
  if (e)
    r = Math.round(e.x), l = Math.round(e.y);
  else if (t != null && t.containerPoint || t != null && t.layerPoint)
    r = Math.round(((I = t.containerPoint) == null ? void 0 : I.x) ?? ((L = t.layerPoint) == null ? void 0 : L.x) ?? 0), l = Math.round(((E = t.containerPoint) == null ? void 0 : E.y) ?? ((w = t.layerPoint) == null ? void 0 : w.y) ?? 0);
  else {
    const g = s.mapContainer.getBoundingClientRect(), m = (i == null ? void 0 : i.clientX) ?? 0, x = (i == null ? void 0 : i.clientY) ?? 0;
    r = Math.round(m - g.left), l = Math.round(x - g.top);
  }
  const p = { x: r, y: l };
  let d, f;
  const h = o || (t == null ? void 0 : t.latlng);
  if (h && typeof h.lat == "number")
    d = h.lat, f = h.lng ?? h.lon ?? 0;
  else {
    const g = c.containerPointToLatLng(y.point(p.x, p.y));
    d = g.lat, f = g.lng;
  }
  const v = s.controller.layerManager ? s.controller.layerManager.getLayers().filter((g) => g.visivel).map((g) => g.id) : [], P = i;
  return s.host.dispatchEvent(new CustomEvent("ui-canvas-clique", {
    detail: {
      coordenadas: {
        lat: d,
        lng: f
      },
      pontoPixel: p,
      eventoOriginal: P,
      lat: d,
      lon: f,
      lng: f,
      camadasAtivas: v
    },
    bubbles: !0,
    composed: !0
  })), !0;
}
function jt(s, t, o, e) {
  const i = e || s.obterElementoPorId(o);
  s.host.dispatchEvent(new CustomEvent("ui-acao-popup", {
    detail: {
      acaoId: t,
      elementoId: o,
      elemento: i ?? { id: o }
    },
    bubbles: !0,
    composed: !0
  })), s.fecharPopup();
}
function Ht(s, t, o, e, i, n, a) {
  let c = e || s.obterElementoPorId(t), r = i;
  if (!r && c) {
    const l = c.lat ?? c.latitude ?? 0, p = c.lon ?? c.lng ?? c.longitude ?? 0;
    r = { lat: Number(l), lon: Number(p) };
  }
  if (r || (r = { lat: 0, lon: 0 }), s.modoSequencial) {
    s.fecharPopup(), s.host.dispatchEvent(new CustomEvent("ui-clique-sequencial", {
      detail: {
        id: t,
        elemento: c ?? { id: t, lat: r.lat, lon: r.lon },
        coordenadas: r
      },
      bubbles: !0,
      composed: !0
    }));
    return;
  }
  if (a)
    try {
      const l = t != null && !isNaN(Number(t)) && String(t).trim() !== "" ? Number(t) : t;
      a(l, o);
    } catch (l) {
      console.error("Erro no callback de clique de marcador:", l);
    }
  if (n)
    try {
      n(t, o, c, r);
    } catch (l) {
      console.error("Erro no handler anterior de marker click:", l);
    }
  s.host.dispatchEvent(new CustomEvent("ui-ponto-selecionado", {
    detail: { selectedIds: [t], lastSelectedId: t, isVizinho: o },
    bubbles: !0,
    composed: !0
  })), s.host.dispatchEvent(new CustomEvent("ui-elemento-selecionado", {
    detail: { id: t, elemento: c, tipo: o ? "vizinho" : "vertice", coordenadas: r },
    bubbles: !0,
    composed: !0
  }));
}
function Dt(s, t) {
  let o = null, e = null, i = 0, n = 0;
  function a() {
    var p;
    try {
      if (!s.isConnected) return;
      const d = t.getMap();
      if (!d) return;
      const f = (p = d.getContainer) == null ? void 0 : p.call(d);
      if (!f || !f.parentNode) return;
      t.invalidateSize();
    } catch {
    }
  }
  function c(p = 25) {
    e !== null && (window.clearTimeout(e), e = null), e = window.setTimeout(() => {
      e = null, a();
    }, p);
  }
  function r() {
    l(), !(typeof ResizeObserver > "u") && (o = new ResizeObserver((p) => {
      for (const d of p) {
        let f = 0, h = 0;
        d.contentRect ? (f = d.contentRect.width, h = d.contentRect.height) : d.borderBoxSize && d.borderBoxSize.length > 0 ? (f = d.borderBoxSize[0].inlineSize, h = d.borderBoxSize[0].blockSize) : (f = s.clientWidth || s.offsetWidth, h = s.clientHeight || s.offsetHeight), f > 0 && h > 0 && (Math.abs(f - i) >= 0.5 || Math.abs(h - n) >= 0.5) && (i = f, n = h, c(25));
      }
    }), o.observe(s));
  }
  function l() {
    o && (o.disconnect(), o = null), e !== null && (window.clearTimeout(e), e = null);
  }
  return {
    observe: r,
    disconnect: l,
    invalidateSizeSafely: a
  };
}
class Rt {
  constructor(t) {
    u(this, "canal", null);
    u(this, "contexto");
    this.contexto = t;
  }
  conectar(t) {
    this.desconectar();
    const o = t !== void 0 ? t : this.contexto.host.getAttribute("canal-configuracao");
    if (!(!o || typeof BroadcastChannel > "u"))
      try {
        this.canal = new BroadcastChannel(o), this.canal.onmessage = (e) => {
          this.processarMensagem(e.data);
        };
      } catch (e) {
        console.warn(`[ui-canvas-cad] Erro ao conectar ao BroadcastChannel "${o}":`, e);
      }
  }
  processarMensagem(t) {
    if (!t || typeof t != "object") return;
    const o = t.tipo || "ESTILOS_ALTERADOS", e = t.configuracoes || t;
    if (e.crosshair !== void 0) {
      const i = !!e.crosshair;
      this.contexto.mapContainer && (this.contexto.mapContainer.style.cursor = i ? "crosshair" : "");
      const n = this.contexto.controller.getMap();
      if (n) {
        const a = n.getContainer();
        a && (a.style.cursor = i ? "crosshair" : "");
      }
      this.contexto.controller.core.config.crosshair = i;
    }
    if (e.opacidadeBase !== void 0) {
      const i = parseFloat(e.opacidadeBase);
      isNaN(i) || this.contexto.setLayerOpacity("satelite", i);
    }
    if (e.satOpacity !== void 0) {
      const i = parseFloat(e.satOpacity);
      isNaN(i) || this.contexto.setLayerOpacity("satelite", i);
    }
    e.opacidades && typeof e.opacidades == "object" && Object.entries(e.opacidades).forEach(([i, n]) => {
      const a = parseFloat(n);
      isNaN(a) || this.contexto.setLayerOpacity(i, a);
    }), this.contexto.host.dispatchEvent(new CustomEvent("ui-config-aplicada", {
      detail: {
        tipo: o,
        configuracoes: e
      },
      bubbles: !0,
      composed: !0
    }));
  }
  desconectar() {
    if (this.canal) {
      try {
        this.canal.close();
      } catch {
      }
      this.canal = null;
    }
  }
}
class Ft {
  constructor(t) {
    u(this, "contexto");
    u(this, "uiListeners", new nt());
    u(this, "isLayersPanelOpen", !1);
    u(this, "mouseMovedSinceDown", !1);
    u(this, "mouseDownPos", { x: 0, y: 0 });
    this.contexto = t;
  }
  get estaPainelAberto() {
    return this.isLayersPanelOpen;
  }
  get houveMovimentoMouse() {
    return this.mouseMovedSinceDown;
  }
  toggleLayersPanel() {
    this.isLayersPanelOpen = !this.isLayersPanelOpen, this.contexto.layersPanel && (this.isLayersPanelOpen ? this.contexto.layersPanel.classList.remove("collapsed") : this.contexto.layersPanel.classList.add("collapsed"));
    const t = this.contexto.shadow.getElementById("btn-toggle-layers");
    t == null || t.classList.toggle("active", this.isLayersPanelOpen);
  }
  closeLayersPanel() {
    var o;
    this.isLayersPanelOpen = !1, (o = this.contexto.layersPanel) == null || o.classList.add("collapsed");
    const t = this.contexto.shadow.getElementById("btn-toggle-layers");
    t == null || t.classList.remove("active");
  }
  vincularEventos() {
    this.uiListeners.cleanup();
    const t = this.contexto.shadow.getElementById("btn-toggle-layers"), o = this.contexto.shadow.getElementById("btn-close-layers"), e = this.contexto.shadow.getElementById("btn-zoom-extents"), i = this.contexto.shadow.getElementById("btn-clear-selection");
    this.uiListeners.add(t, "click", () => {
      this.contexto.onToggleCamadas ? this.contexto.onToggleCamadas() : this.toggleLayersPanel();
    }), this.uiListeners.add(o, "click", () => {
      this.contexto.onCloseCamadas ? this.contexto.onCloseCamadas() : this.closeLayersPanel();
    }), this.uiListeners.add(e, "click", () => {
      var n, a;
      (a = (n = this.contexto).onZoomExtents) == null || a.call(n);
    }), this.uiListeners.add(i, "click", () => {
      var n, a;
      (a = (n = this.contexto).onLimparSelecao) == null || a.call(n);
    }), this.contexto.mapContainer && (this.uiListeners.add(this.contexto.mapContainer, "mousedown", (n) => {
      n.button === 0 && (this.mouseDownPos = { x: n.clientX, y: n.clientY }, this.mouseMovedSinceDown = !1);
    }), this.uiListeners.add(this.contexto.mapContainer, "mousemove", (n) => {
      Math.hypot(n.clientX - this.mouseDownPos.x, n.clientY - this.mouseDownPos.y) >= 4 && (this.mouseMovedSinceDown = !0);
    }), this.uiListeners.add(this.contexto.mapContainer, "click", (n) => {
      var a, c;
      n.button === 0 && (this.mouseMovedSinceDown || (c = (a = this.contexto).onTratarCliqueCanvas) == null || c.call(a, n));
    })), this.uiListeners.add(this.contexto.shadow, "click", (n) => {
      var r, l, p;
      const a = n.composedPath ? n.composedPath()[0] : n.target, c = (r = a == null ? void 0 : a.closest) == null ? void 0 : r.call(a, ".ui-popup-btn");
      if (c) {
        n.preventDefault(), n.stopPropagation();
        const d = c.getAttribute("data-acao-id"), f = c.getAttribute("data-elemento-id");
        d && f !== null && ((p = (l = this.contexto).onDispararAcaoPopup) == null || p.call(l, d, f));
      }
    });
  }
  limpar() {
    this.uiListeners.cleanup();
  }
}
class Wt {
  constructor(t) {
    u(this, "contexto");
    u(this, "_pontos", []);
    u(this, "_segmentos", []);
    u(this, "_bancoPontos", []);
    u(this, "_confrontantes", []);
    u(this, "customMarkerClickHandler");
    this.contexto = t;
  }
  get pontos() {
    return this._pontos;
  }
  set pontos(t) {
    this._pontos = t || [], this.contexto.obterController().setPontos(this._pontos);
  }
  get segmentos() {
    return this._segmentos;
  }
  set segmentos(t) {
    this._segmentos = t || [], this.contexto.obterController().setSegmentos(this._segmentos);
  }
  get bancoPontos() {
    return this._bancoPontos;
  }
  set bancoPontos(t) {
    this._bancoPontos = t || [], this.contexto.obterController().setBancoPontos(this._bancoPontos);
  }
  get confrontantes() {
    return this._confrontantes;
  }
  set confrontantes(t) {
    this._confrontantes = t || [], this.contexto.obterController().setConfrontantes(this._confrontantes);
  }
  sincronizarInicial() {
    const t = this.contexto.obterController();
    this._pontos.length > 0 && t.setPontos(this._pontos), this._segmentos.length > 0 && t.setSegmentos(this._segmentos), this._bancoPontos.length > 0 && t.setBancoPontos(this._bancoPontos), this._confrontantes.length > 0 && t.setConfrontantes(this._confrontantes);
  }
  obterElementoPorId(t) {
    return this._pontos.find((o) => String(o.id) === String(t)) || this._bancoPontos.find((o) => String(o.id) === String(t)) || this._confrontantes.find((o) => String(o.id) === String(t));
  }
  plotarPontos(t, o = "vertices", e) {
    const i = t || [];
    o === "vertices" && (this._pontos = i), this.contexto.obterController().plotarPontos(i, o, e);
  }
  plotarConexoes(t, o = "linhas") {
    const e = t || [];
    this.contexto.obterController().plotarConexoes(e, o);
  }
  plotarPolilinhaSequencial(t, o = !0, e = "polilinha", i) {
    const n = t || [];
    (e === "polilinha" || e === "perimetro") && (this._pontos = n, this._segmentos = []);
    const a = i ?? this.contexto.obterChaveGrupo();
    this.contexto.obterController().plotarPolilinhaSequencial(n, o, e, a);
  }
  plotarPoligonos(t, o = "poligonos") {
    const e = t || [];
    this.contexto.obterController().plotarPoligonos(e, o);
  }
  limparCamadas(t) {
    !t || t.length === 0 ? (this._pontos = [], this._segmentos = [], this._confrontantes = []) : (t.includes("vertices") && (this._pontos = []), (t.includes("linhas") || t.includes("perimetro") || t.includes("polilinha")) && (this._segmentos = []), (t.includes("poligonos") || t.includes("vizinhos")) && (this._confrontantes = [])), this.contexto.obterController().limparCamadas(t);
  }
  obterMarcadores(t) {
    return this.contexto.obterController().obterMarcadores(t);
  }
  plotPontos(t, o) {
    o && (this.customMarkerClickHandler = o);
    const e = t || [];
    this._pontos = e, this.contexto.obterController().plotPontos(e, o);
  }
  plotSegmentos(t, o) {
    const e = t || [];
    o != null && (this._pontos = o || []), this._segmentos = e, this.contexto.obterController().plotSegmentos(e, o);
  }
  plotPolilinhaTemporaria(t) {
    const o = t || [];
    this._pontos = o, this._segmentos = [], this.contexto.obterController().plotPolilinhaTemporaria(o);
  }
  plotPoligonalHomologada(t) {
    const o = t || [];
    this._bancoPontos = o, this.contexto.obterController().plotPoligonalHomologada(o), this.contexto.setLayerVisibility("homologados", !0), this.contexto.setLayerVisibility("homologados-pontos", !0);
  }
  plotPontosVizinhos(t) {
    const o = t || [], e = this.contexto.obterController();
    e.plotPontosVizinhos(o), this._confrontantes = e.context.confrontantes || [];
  }
  plotPoligonosVizinhos(t) {
    const o = t || [], e = this.contexto.obterController();
    e.plotPoligonosVizinhos(o), this._confrontantes = e.context.confrontantes || [];
  }
  clearOverlays(t = !1) {
    this._pontos = [], this._segmentos = [], this._confrontantes = [], t || (this._bancoPontos = []), this.contexto.obterController().clearOverlays(t);
  }
  getMarkers() {
    return this.contexto.obterController().getMarkers();
  }
  getVizinhosMarkers() {
    return this.contexto.obterController().getVizinhosMarkers();
  }
}
const Yt = ':host{display:block;width:100%;height:520px;position:relative;border-radius:var(--ui-radius-lg, 10px);overflow:hidden;box-shadow:0 10px 30px -5px #0009;border:1px solid rgba(255,255,255,.1);background:#080d0a;color:#fff;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Inter,sans-serif;user-select:none;-webkit-user-select:none}*,*:before,*:after{box-sizing:border-box}.cad-root{position:relative;width:100%;height:100%;display:flex;overflow:hidden}.cad-map-container{width:100%;height:100%;background:#080d0a;z-index:1}.qgis-layer-panel{position:absolute;top:12px;left:12px;z-index:1000;width:290px;max-height:calc(100% - 24px);background:#0a120eeb;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.15);border-radius:8px;box-shadow:0 20px 40px #000000b3;display:flex;flex-direction:column;transition:transform .25s cubic-bezier(.16,1,.3,1),opacity .25s ease;overflow:hidden}.qgis-layer-panel.collapsed{transform:translate(-310px);opacity:0;pointer-events:none}.layer-panel-header{padding:10px 14px;background:#ffffff08;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:space-between}.layer-panel-title{font-size:12px;font-weight:700;letter-spacing:.5px;color:#00f5a0;display:flex;align-items:center;gap:6px;text-transform:uppercase}.layer-panel-close{background:transparent;border:none;color:#ffffff80;cursor:pointer;padding:2px;border-radius:4px;display:flex;align-items:center;justify-content:center;transition:all .15s}.layer-panel-close:hover{color:#fff;background:#ffffff1a}.layer-panel-body{padding:8px 10px;overflow-y:auto;display:flex;flex-direction:column;gap:2px;max-height:400px}.layer-panel-body::-webkit-scrollbar{width:5px}.layer-panel-body::-webkit-scrollbar-track{background:transparent}.layer-panel-body::-webkit-scrollbar-thumb{background:#fff3;border-radius:4px}.layer-panel-body::-webkit-scrollbar-thumb:hover{background:#00f5a066}.layer-item{background:transparent;border:none;border-bottom:1px solid rgba(255,255,255,.08);border-radius:0;padding:4px;display:flex;flex-direction:column;gap:3px;transition:background .15s ease}.layer-item:last-child{border-bottom:none}.layer-item:hover{background:#ffffff08;border-radius:4px}.layer-item-row{display:flex;align-items:center;justify-content:space-between;min-height:18px}.layer-item-label{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:600;line-height:1.2;color:#ffffffe6;cursor:pointer;-webkit-user-select:none;user-select:none}.layer-chk-visibility{-moz-appearance:none;appearance:none;-webkit-appearance:none;width:14px;height:14px;border:1px solid rgba(255,255,255,.4);border-radius:3px;background:#0006;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;position:relative;transition:all .15s ease;flex-shrink:0;margin:0}.layer-chk-visibility:hover{border-color:#00f5a0}.layer-chk-visibility:checked{background:#00f5a0;border-color:#00f5a0}.layer-chk-visibility:checked:after{content:"";width:3.5px;height:7px;border:solid #04150c;border-width:0 1.5px 1.5px 0;transform:rotate(45deg) translateY(-.5px);display:block}.layer-item-actions{display:flex;align-items:center;gap:4px}.btn-layer-action{background:transparent;border:none;color:#fff6;cursor:pointer;padding:2px;border-radius:3px;display:flex;align-items:center;justify-content:center;transition:all .15s}.btn-layer-action:hover{color:#00f5a0;background:#ffffff14}.btn-layer-action.active{color:#f43f5e;background:#f43f5e26}.layer-controls-row{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:9.5px;line-height:1;color:#ffffff80;padding-left:21px}.layer-opacity-slider{flex:1;height:3px;margin:0;border-radius:2px;background:#ffffff26;accent-color:#00f5a0;cursor:pointer}.scale-mode-pill{font-size:8.5px;font-weight:600;padding:1px 6px;border-radius:6px;background:#ffffff0f;color:#ffffffb3;cursor:pointer;border:1px solid rgba(255,255,255,.1);transition:all .15s;line-height:1.2}.scale-mode-pill:hover{border-color:#00f5a0;color:#00f5a0;background:#00f5a01a}.cad-quick-toolbar{position:absolute;top:12px;right:12px;z-index:1000;display:flex;flex-direction:column;gap:6px;background:#0c1510eb;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:5px;box-shadow:0 10px 25px -5px #0009}.cad-btn-tool{background:transparent;border:none;color:#fff9;cursor:pointer;padding:7px;border-radius:5px;display:flex;align-items:center;justify-content:center;transition:all .15s}.cad-btn-tool:hover{background:#ffffff1a;color:#fff}.cad-btn-tool.active{background:#00f5a026;color:#00f5a0;border:1px solid rgba(0,245,160,.3)}.cad-selection-box{pointer-events:none;box-sizing:border-box}.custom-leaflet-marker{cursor:pointer}.custom-leaflet-marker:hover{filter:brightness(1.25);transform:scale(1.15);transition:transform .15s ease}.leaflet-popup-content-wrapper{background:#0f1712!important;color:#f8fafc!important;border:1px solid rgba(255,255,255,.15)!important;border-radius:8px!important;box-shadow:0 10px 25px #0009!important;padding:0!important;backdrop-filter:blur(16px)!important;-webkit-backdrop-filter:blur(16px)!important}.leaflet-popup-tip{background:#0f1712!important;border:1px solid rgba(255,255,255,.15)!important;box-shadow:none!important}.leaflet-popup-close-button{color:#fff9!important;padding:6px!important;transition:color .15s ease}.leaflet-popup-close-button:hover{color:#fff!important}.leaflet-popup-content{margin:12px 14px!important;line-height:1.4;font-family:inherit;color:#f8fafc}.compact-popup .leaflet-popup-content{margin:10px 12px!important}.ui-popup-actions-footer{display:flex;gap:6px;margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.1);justify-content:flex-end;align-items:center;flex-wrap:wrap}.ui-popup-btn{display:inline-flex;align-items:center;justify-content:center;font-family:inherit;font-size:11px;font-weight:500;padding:4px 9px;border-radius:var(--ui-raio-borda, var(--ui-radius-sm, 6px));cursor:pointer;transition:all .15s ease;border:1px solid transparent;outline:none;line-height:1.25;-webkit-user-select:none;user-select:none}.ui-popup-btn-primary{background:var(--ui-cor-primaria, #00f5a0);color:#080d0a;font-weight:600;border-color:var(--ui-cor-primaria, #00f5a0)}.ui-popup-btn-primary:hover{filter:brightness(1.1);box-shadow:0 0 10px #00f5a059}.ui-popup-btn-secondary{background:#ffffff14;color:#fff;border-color:#ffffff2e}.ui-popup-btn-secondary:hover{background:#ffffff29;border-color:#ffffff4d}.ui-popup-btn-destrutivo{background:#ef444426;color:#f87171;border-color:#ef444459}.ui-popup-btn-destrutivo:hover{background:#ef444440;border-color:#ef444499;color:#fff}@media (max-width: 520px){.qgis-layer-panel{top:8px;left:8px;right:8px;width:auto;max-height:calc(100% - 16px)}.qgis-layer-panel.collapsed{transform:translateY(-115%)}.layer-panel-close{min-width:36px;min-height:36px;font-size:16px}.layer-action-btn{min-width:32px;min-height:32px}}.cad-destaque-marker-container{pointer-events:none!important;background:transparent!important;border:none!important;overflow:visible!important}.cad-destaque-marker-container *{pointer-events:none!important}.cad-pulse-highlight{position:relative;width:52px;height:52px;display:flex;align-items:center;justify-content:center;pointer-events:none!important;user-select:none;-webkit-user-select:none}.cad-pulse-core{position:absolute;width:14px;height:14px;border-radius:50%;background-color:var(--cad-pulse-cor, #00f5a0);box-shadow:0 0 10px var(--cad-pulse-cor, #00f5a0),0 0 20px var(--cad-pulse-cor, #00f5a0);pointer-events:none!important;animation:cad-pulse-glow 1.4s ease-in-out infinite alternate}.cad-pulse-ring{position:absolute;width:100%;height:100%;border-radius:50%;border:2.5px solid var(--cad-pulse-cor, #00f5a0);box-shadow:0 0 10px var(--cad-pulse-cor, #00f5a0);pointer-events:none!important;opacity:0;animation:cad-pulse-ping 1.8s cubic-bezier(0,0,.2,1) infinite}.cad-pulse-ring.ring-2{animation-delay:.6s}@keyframes cad-pulse-ping{0%{transform:scale(.35);opacity:.95}60%{opacity:.5}to{transform:scale(2.5);opacity:0}}@keyframes cad-pulse-glow{0%{transform:scale(.85);opacity:.8}to{transform:scale(1.15);opacity:1;box-shadow:0 0 14px var(--cad-pulse-cor, #00f5a0),0 0 26px var(--cad-pulse-cor, #00f5a0)}}.cad-marker-selected,.ponto-selecionado{z-index:2000!important}.cad-marker-selected>div,.ponto-selecionado>div{animation:cad-ponto-pulse 1.8s ease-in-out infinite alternate!important}@keyframes cad-ponto-pulse{0%{filter:drop-shadow(0 0 3px #ffffff) drop-shadow(0 0 6px #00f5a0)}to{filter:drop-shadow(0 0 6px #ffffff) drop-shadow(0 0 16px #00f5a0)}}.ui-popup-actions-footer{margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,.12);display:flex;gap:6px;flex-wrap:wrap}.ui-popup-btn{display:inline-flex;align-items:center;justify-content:center;padding:4px 8px;font-size:11px;font-weight:600;border-radius:4px;border:1px solid rgba(255,255,255,.15);background:#ffffff14;color:#fff;cursor:pointer;line-height:1.2;transition:all .15s ease;-webkit-user-select:none;user-select:none}.ui-popup-btn:hover{background:#ffffff2e;border-color:#ffffff4d}.ui-popup-btn-primary{background:#00f5a0;color:#06130b;border-color:#00f5a0}.ui-popup-btn-primary:hover{background:#10ffad;box-shadow:0 0 8px #00f5a066}.ui-popup-btn-danger{background:#f43f5e33;color:#f43f5e;border-color:#f43f5e66}.ui-popup-btn-danger:hover{background:#f43f5e59;color:#fff}';
function Zt() {
  return `
    <style>
      ${ct}
      ${Yt}
    </style>
    <div class="cad-root" id="cad-root">
      <div class="cad-map-container" id="cad-map-container"></div>
      <div class="qgis-layer-panel collapsed" id="qgis-layer-panel">
        <div class="layer-panel-header">
          <div class="layer-panel-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
            Camadas
          </div>
          <button class="layer-panel-close" id="btn-close-layers" type="button" title="Fechar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="layer-panel-body" id="layers-list-container"></div>
      </div>
      <div class="cad-quick-toolbar">
        <button class="cad-btn-tool" id="btn-toggle-layers" type="button" title="Camadas">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
        </button>
        <button class="cad-btn-tool" id="btn-zoom-extents" type="button" title="Enquadrar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg>
        </button>
        <button class="cad-btn-tool" id="btn-clear-selection" type="button" title="Limpar seleção">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="3 3"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>
        </button>
      </div>
    </div>
  `;
}
function Ut(s, t, o, e) {
  if (o !== e) {
    if (t === "sat-opacity") {
      const i = parseFloat(e);
      isNaN(i) || s.setLayerOpacity("satelite", i);
    } else if (t === "scale-mode")
      (e === "world" || e === "screen") && (s.setLayerScaleMode("perimetro", e), s.setLayerScaleMode("vertices", e));
    else if (t === "modo-sequencial")
      s.host.modoSequencial = e !== null && e !== "false";
    else if (t === "chave-grupo")
      s.host.chaveGrupo = e || void 0;
    else if (t === "zona-projecao" || t === "fuso") {
      const i = parseInt(e, 10);
      !isNaN(i) && i > 0 && (s.atualizarZonaProjecao(i), t === "fuso" && s.host.getAttribute("zona-projecao") !== e ? s.host.setAttribute("zona-projecao", e) : t === "zona-projecao" && s.host.hasAttribute("fuso") && s.host.getAttribute("fuso") !== e && s.host.setAttribute("fuso", e), s.controller.zonaProjecao = i, s.controller.context.zonaProjecao = i);
    } else if (t === "canal-configuracao")
      s.broadcastConfig.conectar(e);
    else if (t === "crosshair") {
      const i = e !== null && e !== "false";
      s.mapContainer && (s.mapContainer.style.cursor = i ? "crosshair" : "");
      const n = s.controller.getMap();
      if (n) {
        const a = n.getContainer();
        a && (a.style.cursor = i ? "crosshair" : "");
      }
      s.controller.core.config.crosshair = i;
    }
  }
}
function Xt(s) {
  if (!s.mapContainer) return;
  if (s.mapContainer._leaflet_id && !s.controller.getMap())
    try {
      delete s.mapContainer._leaflet_id;
    } catch {
      s.mapContainer._leaflet_id = void 0;
    }
  if (s.controller.init(s.mapContainer, s.shadow), s.toolbarPainel.vincularEventos(), s.renderLayersUI(), s.host.hasAttribute("modo-sequencial") && (s.controller.modoCliqueSequencialAtivo = !0, s.controller.context.modoSequencial = !0), s.host.hasAttribute("chave-grupo")) {
    const e = s.host.getAttribute("chave-grupo");
    e && (s.host.chaveGrupo = e);
  }
  if (s.host.hasAttribute("zona-projecao") || s.host.hasAttribute("fuso")) {
    const e = s.host.zonaProjecao;
    s.controller.zonaProjecao = e, s.controller.context.zonaProjecao = e;
  }
  if (s.host.hasAttribute("crosshair")) {
    const e = s.host.getAttribute("crosshair") !== "false";
    s.mapContainer && (s.mapContainer.style.cursor = e ? "crosshair" : ""), s.controller.core.config.crosshair = e;
  }
  s.colecoesDados.sincronizarInicial(), s.controller.layerManager.onChange((e) => {
    s.renderLayersUI(), s.host.dispatchEvent(new CustomEvent("ui-camadas-alteradas", {
      detail: { layers: e },
      bubbles: !0,
      composed: !0
    }));
  });
  const t = s.controller.context.onMarkerClick;
  s.controller.context.onMarkerClick = (e, i, n, a) => {
    Ht(
      s.obterContextoEventos(),
      e,
      i,
      n,
      a,
      t,
      s.colecoesDados.customMarkerClickHandler
    );
  }, s.controller.context.onPopupAcao = (e, i, n) => {
    s.dispararAcaoPopup(e, i, n);
  };
  const o = s.controller.getMap();
  o && o.on("click", (e) => {
    s.toolbarPainel.houveMovimentoMouse || s.tratarCliqueLivreCanvas(e, e.latlng, e.containerPoint);
  }), setTimeout(() => {
    s.invalidateSizeSafely();
  }, 150);
}
class Kt extends pt {
  constructor() {
    super();
    u(this, "shadow");
    u(this, "mapContainer", null);
    u(this, "layersPanel", null);
    u(this, "controller");
    u(this, "controladorTamanho");
    u(this, "toolbarPainel");
    u(this, "broadcastConfig");
    u(this, "colecoesDados");
    u(this, "layerItemListeners", new nt());
    u(this, "initTimeout");
    u(this, "lastPopupActionEmit");
    u(this, "lastCanvasClickTime", 0);
    u(this, "_chaveGrupo");
    u(this, "_zonaProjecao", 22);
    this.shadow = this.attachShadow({ mode: "open" }), this.controller = new Vt(), this.controladorTamanho = Dt(this, this.controller), this.shadow.innerHTML = Zt(), this.mapContainer = this.shadow.getElementById("cad-map-container"), this.layersPanel = this.shadow.getElementById("qgis-layer-panel"), this.toolbarPainel = new Ft({
      shadow: this.shadow,
      mapContainer: this.mapContainer,
      layersPanel: this.layersPanel,
      onToggleCamadas: () => this.toggleLayersPanel(),
      onCloseCamadas: () => this.closeLayersPanel(),
      onZoomExtents: () => this.zoomExtents(),
      onLimparSelecao: () => this.limparSelecao(),
      onTratarCliqueCanvas: (o) => this.tratarCliqueLivreCanvas(o),
      onDispararAcaoPopup: (o, e) => this.dispararAcaoPopup(o, e)
    }), this.broadcastConfig = new Rt({
      host: this,
      controller: this.controller,
      mapContainer: this.mapContainer,
      setLayerOpacity: (o, e) => this.setLayerOpacity(o, e)
    }), this.colecoesDados = new Wt({
      obterController: () => this.controller,
      obterChaveGrupo: () => this.chaveGrupo,
      setLayerVisibility: (o, e) => this.setLayerVisibility(o, e)
    });
  }
  static get observedAttributes() {
    return ["sat-opacity", "scale-mode", "crosshair", "modo-sequencial", "chave-grupo", "zona-projecao", "fuso", "canal-configuracao"];
  }
  connectedCallback() {
    const o = this.getAttribute("zona-projecao") || this.getAttribute("fuso");
    if (o) {
      const e = parseInt(o, 10);
      !isNaN(e) && e > 0 && (this._zonaProjecao = e, this.controller.zonaProjecao = e, this.controller.context.zonaProjecao = e);
    }
    this.controladorTamanho.observe(), this.broadcastConfig.conectar(), this.initTimeout = window.setTimeout(() => this.initCAD(), 0);
  }
  destroy() {
    if (this.initTimeout && (window.clearTimeout(this.initTimeout), this.initTimeout = void 0), this.controladorTamanho.disconnect(), this.broadcastConfig.desconectar(), this.limparDestaque(), this.toolbarPainel.limpar(), this.layerItemListeners.cleanup(), this.controller.destroy(), this.mapContainer && this.mapContainer._leaflet_id)
      try {
        delete this.mapContainer._leaflet_id;
      } catch {
        this.mapContainer._leaflet_id = void 0;
      }
  }
  disconnectedCallback() {
    this.destroy();
  }
  invalidateSizeSafely() {
    this.controladorTamanho.invalidateSizeSafely();
  }
  attributeChangedCallback(o, e, i) {
    Ut(
      {
        host: this,
        controller: this.controller,
        mapContainer: this.mapContainer,
        broadcastConfig: this.broadcastConfig,
        setLayerOpacity: (n, a) => this.setLayerOpacity(n, a),
        setLayerScaleMode: (n, a) => this.setLayerScaleMode(n, a),
        atualizarZonaProjecao: (n) => {
          this._zonaProjecao = n;
        }
      },
      o,
      e,
      i
    );
  }
  initCAD() {
    Xt({
      host: this,
      shadow: this.shadow,
      mapContainer: this.mapContainer,
      controller: this.controller,
      toolbarPainel: this.toolbarPainel,
      colecoesDados: this.colecoesDados,
      obterContextoEventos: () => this.obterContextoEventos(),
      renderLayersUI: () => this.renderLayersUI(),
      invalidateSizeSafely: () => this.invalidateSizeSafely(),
      tratarCliqueLivreCanvas: (o, e, i) => this.tratarCliqueLivreCanvas(o, e, i),
      dispararAcaoPopup: (o, e, i) => this.dispararAcaoPopup(o, e, i)
    });
  }
  obterContextoEventos() {
    return {
      host: this,
      controller: this.controller,
      mapContainer: this.mapContainer,
      modoSequencial: this.modoSequencial,
      mouseMovedSinceDown: this.toolbarPainel.houveMovimentoMouse,
      obterElementoPorId: (o) => this.colecoesDados.obterElementoPorId(o),
      fecharPopup: () => {
        var o;
        (o = this.controller.getMap()) == null || o.closePopup();
      }
    };
  }
  tratarCliqueLivreCanvas(o, e, i) {
    const n = Date.now();
    n - this.lastCanvasClickTime < 50 || (this.lastCanvasClickTime = n, Ot(this.obterContextoEventos(), o, e, i));
  }
  dispararAcaoPopup(o, e, i) {
    const n = Date.now();
    this.lastPopupActionEmit && this.lastPopupActionEmit.acaoId === o && this.lastPopupActionEmit.elementoId === e && n - this.lastPopupActionEmit.time < 50 || (this.lastPopupActionEmit = { acaoId: o, elementoId: e, time: n }, jt(this.obterContextoEventos(), o, e, i));
  }
  toggleLayersPanel() {
    this.toolbarPainel.toggleLayersPanel();
  }
  closeLayersPanel() {
    this.toolbarPainel.closeLayersPanel();
  }
  renderLayersUI() {
    const o = this.shadow.getElementById("layers-list-container");
    Gt(o, this.controller.layerManager.getLayers(), this.layerItemListeners, {
      setLayerVisibility: (e, i) => this.setLayerVisibility(e, i),
      setLayerOpacity: (e, i) => this.setLayerOpacity(e, i),
      setLayerBlocked: (e, i) => this.controller.layerManager.setLayerBlocked(e, i),
      setLayerScaleMode: (e, i) => this.setLayerScaleMode(e, i)
    });
  }
  get pontos() {
    return this.colecoesDados.pontos;
  }
  set pontos(o) {
    this.colecoesDados.pontos = o;
  }
  get segmentos() {
    return this.colecoesDados.segmentos;
  }
  set segmentos(o) {
    this.colecoesDados.segmentos = o;
  }
  get bancoPontos() {
    return this.colecoesDados.bancoPontos;
  }
  set bancoPontos(o) {
    this.colecoesDados.bancoPontos = o;
  }
  get pontosHomologados() {
    return this.bancoPontos;
  }
  set pontosHomologados(o) {
    this.bancoPontos = o;
  }
  get confrontantes() {
    return this.colecoesDados.confrontantes;
  }
  set confrontantes(o) {
    this.colecoesDados.confrontantes = o;
  }
  get vizinhos() {
    return this.confrontantes;
  }
  set vizinhos(o) {
    this.confrontantes = o;
  }
  get modoSequencial() {
    return this.hasAttribute("modo-sequencial");
  }
  set modoSequencial(o) {
    var i;
    const e = !!o;
    e ? this.hasAttribute("modo-sequencial") || this.setAttribute("modo-sequencial", "") : this.hasAttribute("modo-sequencial") && this.removeAttribute("modo-sequencial"), this.controller.modoCliqueSequencialAtivo = e, this.controller.context.modoSequencial = e, e && ((i = this.controller.getMap()) == null || i.closePopup());
  }
  get chaveGrupo() {
    return this.getAttribute("chave-grupo") || this._chaveGrupo;
  }
  set chaveGrupo(o) {
    this._chaveGrupo = o, o ? this.getAttribute("chave-grupo") !== o && this.setAttribute("chave-grupo", o) : this.hasAttribute("chave-grupo") && this.removeAttribute("chave-grupo"), this.controller.chaveGrupo = o, this.controller.context.chaveGrupo = o, this.controller.layerManager.updateContext({ chaveGrupo: o });
  }
  get zonaProjecao() {
    return this._zonaProjecao ?? 22;
  }
  set zonaProjecao(o) {
    const e = typeof o == "number" ? Math.floor(o) : parseInt(String(o), 10);
    if (!isNaN(e) && e > 0) {
      this._zonaProjecao = e;
      const i = String(e);
      this.getAttribute("zona-projecao") !== i && this.setAttribute("zona-projecao", i), this.hasAttribute("fuso") && this.getAttribute("fuso") !== i && this.setAttribute("fuso", i), this.controller.zonaProjecao = e, this.controller.context.zonaProjecao = e;
    }
  }
  get canalConfiguracao() {
    return this.getAttribute("canal-configuracao");
  }
  set canalConfiguracao(o) {
    o ? this.setAttribute("canal-configuracao", o) : this.removeAttribute("canal-configuracao");
  }
  fitBounds(o, e = [40, 40], i = !1) {
    this.controller.fitBounds(o, e, i);
  }
  zoomExtents() {
    this.controller.canvasInteracao.zoomExtents();
  }
  selectPonto(o, e) {
    this.controller.selectPonto(o, e);
  }
  selecionarPonto(o, e) {
    this.controller.selectPonto(o, e);
  }
  get pontosSelecionados() {
    return this.controller.context.selectedPontoIds || this.controller.canvasInteracao.ctx.selectedPontoIds || [];
  }
  set pontosSelecionados(o) {
    const e = Array.isArray(o) ? o : [];
    this.controller.canvasInteracao.ctx.selectedPontoIds = e, this.controller.context.selectedPontoIds = [...e], this.controller.atualizarDestaqueMarcadores();
  }
  atualizarDestaqueMarcadores() {
    this.controller.atualizarDestaqueMarcadores();
  }
  limparSelecao() {
    this.controller.canvasInteracao.limparSelecao();
  }
  setLayerVisibility(o, e) {
    this.controller.layerManager.setLayerVisibility(o, e);
  }
  setLayerOpacity(o, e) {
    this.controller.layerManager.setLayerOpacity(o, e);
  }
  setLayerScaleMode(o, e) {
    this.controller.layerManager.setLayerScaleMode(o, e);
  }
  setGraphicScale(o) {
    this.controller.setGraphicScale(o);
  }
  exportState() {
    return this.controller.exportState();
  }
  importState(o) {
    this.controller.importState(o);
  }
  invalidateSize() {
    this.invalidateSizeSafely();
  }
  get destaqueAtivo() {
    return this.controller.destaqueAtivo;
  }
  destacarElemento(o, e) {
    !this.controller.getMap() && this.mapContainer && this.initCAD(), this.controller.destacarElemento(o, e);
  }
  limparDestaque() {
    this.controller.limparDestaque();
  }
  plotarPontos(o, e = "vertices", i) {
    this.colecoesDados.plotarPontos(o, e, i);
  }
  plotarConexoes(o, e = "linhas") {
    this.colecoesDados.plotarConexoes(o, e);
  }
  plotarPolilinhaSequencial(o, e = !0, i = "polilinha", n) {
    this.colecoesDados.plotarPolilinhaSequencial(o, e, i, n);
  }
  plotarPoligonos(o, e = "poligonos") {
    this.colecoesDados.plotarPoligonos(o, e);
  }
  limparCamadas(o) {
    this.colecoesDados.limparCamadas(o);
  }
  obterMarcadores(o) {
    return this.colecoesDados.obterMarcadores(o);
  }
  plotPontos(o, e) {
    this.colecoesDados.plotPontos(o, e);
  }
  plotSegmentos(o, e) {
    this.colecoesDados.plotSegmentos(o, e);
  }
  plotPolilinhaTemporaria(o) {
    this.colecoesDados.plotPolilinhaTemporaria(o);
  }
  plotPoligonalHomologada(o) {
    this.colecoesDados.plotPoligonalHomologada(o);
  }
  plotPontosVizinhos(o) {
    this.colecoesDados.plotPontosVizinhos(o);
  }
  plotPoligonosVizinhos(o) {
    this.colecoesDados.plotPoligonosVizinhos(o);
  }
  clearOverlays(o = !1) {
    this.colecoesDados.clearOverlays(o);
  }
  getMarkers() {
    return this.colecoesDados.getMarkers();
  }
  getVizinhosMarkers() {
    return this.colecoesDados.getVizinhosMarkers();
  }
  getMap() {
    return this.controller.getMap();
  }
  getController() {
    return this.controller;
  }
  getLayerManager() {
    return this.controller.layerManager;
  }
}
dt("ui-canvas-cad", Kt);
class ne {
  constructor(t, o) {
    u(this, "polylines", []);
    u(this, "bancoPontosAtivo", !1);
    u(this, "core");
    this.core = t;
  }
  setBancoPontosAtivo(t) {
    this.bancoPontosAtivo = t;
  }
  plotSegmentos(t, o) {
    this.core.map && t.forEach((e) => {
      const i = o.find((a) => String(a.id) === String(e.ponto_inicio_id)), n = o.find((a) => String(a.id) === String(e.ponto_fim_id));
      if (i && n && i.lat && i.lon && n.lat && n.lon) {
        const a = e.tipo_limite_sigef || e.tipo_limite || "", c = e.metodo_posicionamento_sigef || e.metodo_posicionamento || "", r = this.bancoPontosAtivo ? "#94a3b8" : a === "LA1" ? "#10b981" : "#3b82f6", l = this.core.config.perimetroWeight, p = this.bancoPontosAtivo ? 0.4 : 1, d = y.polyline([[i.lat, i.lon], [n.lat, n.lon]], {
          color: r,
          weight: l,
          opacity: p,
          dashArray: a === "LN1" ? "6, 6" : void 0,
          pane: "perimetroPane"
        }).bindPopup(`
          <div style="font-family:sans-serif; color:rgba(255, 255, 255, 0.9); line-height:1.3;">
            <div style="font-weight:700; font-size:12px; margin-bottom:3px; color:#ffffff;">${C(i.nome_vertice)} ↔ ${C(n.nome_vertice)}</div>
            <div style="font-size:11px; color:rgba(255, 255, 255, 0.65);">Limite: ${C(a)} · ${C(c)}</div>
          </div>
        `, {
          className: "compact-popup",
          maxWidth: 220
        }).addTo(this.core.map);
        this.polylines.push(d);
      }
    });
  }
  plotPolilinhaTemporaria(t) {
    var r, l, p;
    if (!this.core.map) return;
    const o = t.filter(
      (d) => d.lat && d.lon && d.lat !== 0 && d.lon !== 0 && d.tipo_ponto !== "B" && d.tipo !== "B" && d.ignorar_poligono !== 1
    );
    if (o.length < 2) return;
    const e = ((r = this.core.controller) == null ? void 0 : r.chaveGrupo) || ((p = (l = this.core.controller) == null ? void 0 : l.context) == null ? void 0 : p.chaveGrupo), i = U(o, e), n = this.bancoPontosAtivo ? "#94a3b8" : "#10b981", a = this.core.config.fechamentoWeight || 2, c = this.bancoPontosAtivo ? 0.4 : 1;
    Object.values(i).forEach((d) => {
      const f = X(d);
      if (f.length < 2) return;
      for (let b = 0; b < f.length - 1; b++) {
        const S = f[b], I = f[b + 1], L = y.polyline([[S.lat, S.lon], [I.lat, I.lon]], {
          color: n,
          weight: a,
          opacity: c,
          pane: "perimetroPane"
        }).addTo(this.core.map);
        this.polylines.push(L);
      }
      const h = f[f.length - 1], v = f[0], P = y.polyline([[h.lat, h.lon], [v.lat, v.lon]], {
        color: n,
        weight: a,
        opacity: c,
        dashArray: "4, 4",
        pane: "perimetroPane"
      }).addTo(this.core.map);
      this.polylines.push(P);
    });
  }
  plotPoligonalHomologada(t) {
    var n, a, c;
    if (!this.core.map || !this.core.bancoPontosGroup) return;
    this.core.bancoPontosGroup.clearLayers();
    const o = t.filter((r) => r.lat && r.lon && r.lat !== 0 && r.lon !== 0);
    if (o.length === 0) return;
    this.bancoPontosAtivo = !0, o.forEach((r) => {
      const l = `
        <div class="w-4.5 h-4.5 bg-amber-500 text-slate-950 border-2 border-slate-900 rounded-full flex items-center justify-center text-[7px] font-black font-mono shadow-md hover:scale-125 transition-transform" id="banco-marker-${r.id}">
          H
        </div>
      `, p = y.divIcon({
        html: l,
        className: "banco-leaflet-marker",
        iconSize: [18, 18]
      }), d = `
        <div style="font-family:sans-serif; color:rgba(255, 255, 255, 0.9); line-height:1.35; min-width:180px;">
          <div style="font-weight:800; font-size:11px; color:#fbbf24; text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid rgba(255, 255, 255, 0.1); padding-bottom:3px; margin-bottom:5px;">Vértice Homologado SIGEF</div>
          <div style="font-weight:700; font-size:13px; margin-bottom:3px; color:#ffffff;">${C(r.codigo_completo || r.nome_vertice)}</div>
          <div style="font-size:11px; color:rgba(255, 255, 255, 0.7); font-family:monospace;">Este (E): ${r.este ? r.este.toFixed(2) : "N/A"} m</div>
          <div style="font-size:11px; color:rgba(255, 255, 255, 0.7); font-family:monospace; margin-bottom:3px;">Norte (N): ${r.norte ? r.norte.toFixed(2) : "N/A"} m</div>
          <div style="font-size:11px; color:rgba(255, 255, 255, 0.7); margin-bottom:2px;">Alt (h): <strong>${r.altitude ? r.altitude.toFixed(2) : "N/A"} m</strong></div>
          <div style="font-size:10px; color:rgba(255, 255, 255, 0.45);">Método: ${C(r.metodo_posicionamento) || "N/A"} · Limite: ${C(r.tipo_limite) || "N/A"}</div>
          ${r.confrontante_descritivo ? `<div style="font-size:10px; color:rgba(255, 255, 255, 0.65); border-top:1px solid rgba(255, 255, 255, 0.1); padding-top:4px; margin-top:4px; word-break:break-word;"><strong>Conf:</strong> ${C(r.confrontante_descritivo)}</div>` : ""}
        </div>
      `;
      y.marker([r.lat, r.lon], {
        icon: p,
        pane: "verticesPane"
      }).bindPopup(d, { className: "compact-popup", maxWidth: 220 }).addTo(this.core.bancoPontosGroup);
    });
    const e = ((n = this.core.controller) == null ? void 0 : n.chaveGrupo) || ((c = (a = this.core.controller) == null ? void 0 : a.context) == null ? void 0 : c.chaveGrupo), i = U(o, e);
    for (const r in i) {
      const l = X(i[r]);
      if (l.length >= 2) {
        const p = l.map((d) => y.latLng(d.lat, d.lon));
        p.push(y.latLng(l[0].lat, l[0].lon)), y.polyline(p, {
          color: "#f59e0b",
          // Cor âmbar contrastante premium
          weight: this.core.config.bancoWeight,
          dashArray: "6, 8",
          pane: "perimetroPane"
        }).addTo(this.core.bancoPontosGroup);
      }
    }
  }
  clearLinhas() {
    this.core.map && this.polylines.forEach((t) => this.core.map.removeLayer(t)), this.core.bancoPontosGroup && this.core.bancoPontosGroup.clearLayers(), this.polylines = [];
  }
}
class se {
  constructor(t, o) {
    u(this, "markers", []);
    u(this, "vizinhosMarkers", []);
    u(this, "vizinhosPoligonos", []);
    u(this, "core");
    u(this, "controller");
    this.core = t, this.controller = o;
  }
  plotPontos(t, o) {
    this.core.map && t.forEach((e) => {
      var i, n, a;
      if (e.lat && e.lon && e.lat !== 0 && e.lon !== 0) {
        const c = e.tipo_ponto === "B" || e.tipo === "B", r = e.tipo_ponto === "M" || e.tipo === "M";
        let l = "bg-mint-vibrant", p = "x", d = 7;
        r ? (l = "bg-indigo-500", d = 9) : c && (l = "bg-rose-500", d = 9);
        const f = this.core.config.enableAnimations ? "transition-all duration-150" : "", h = (n = (i = this.controller) == null ? void 0 : i.linhas) != null && n.bancoPontosAtivo ? "opacity-40 hover:opacity-100" : "", v = Z(p, d, l, `${f} ${h}`, `map-marker-${e.id}`), P = y.divIcon({
          html: v,
          className: "custom-leaflet-marker flex items-center justify-center",
          iconSize: [d + 6, d + 6]
        }), b = r ? "Base Homologada PPP" : c ? "Base de Campo (Translação)" : "Vértice de Perímetro", S = y.marker([e.lat, e.lon], {
          icon: P,
          pane: "verticesPane"
        });
        S.pontoId = e.id, (a = this.controller) != null && a.modoCliqueSequencialAtivo || S.bindPopup(`
            <div style="font-family:sans-serif; color:rgba(255, 255, 255, 0.9); line-height:1.3;">
              <div style="font-weight:700; font-size:13px; margin-bottom:4px; color:#ffffff;">${C(e.nome_vertice)}</div>
              <div style="font-size:11px; color:rgba(255, 255, 255, 0.65);">${C(b)} · ${C(e.tipo_ponto || e.tipo)}</div>
              <div style="font-size:11px; color:rgba(255, 255, 255, 0.45); font-family:monospace; margin-top:4px;">Lat ${e.lat.toFixed(6)} &nbsp; Lon ${e.lon.toFixed(6)}</div>
            </div>
          `, {
          className: "compact-popup",
          maxWidth: 220
        }), S.addTo(this.core.map), S.setZIndexOffset(1e3), S.on("click", () => {
          o(e.id);
        }), this.markers.push(S);
      }
    });
  }
  plotPontosVizinhos(t) {
    if (!this.core.map || !this.core.pontosVizinhosGroup) return;
    this.core.map.hasLayer(this.core.pontosVizinhosGroup) || this.core.pontosVizinhosGroup.addTo(this.core.map), this.vizinhosMarkers && this.vizinhosMarkers.length > 0 && (this.vizinhosMarkers.forEach((e) => {
      e.off(), e.unbindPopup();
    }), this.vizinhosMarkers = []), this.core.pontosVizinhosGroup.clearLayers();
    const o = /* @__PURE__ */ new Map();
    (t || []).forEach((e) => {
      const i = e.lat ?? e.latitude ?? e.y, n = e.lon ?? e.lng ?? e.longitude ?? e.x, a = typeof i == "string" ? parseFloat(i.replace(",", ".")) : Number(i), c = typeof n == "string" ? parseFloat(n.replace(",", ".")) : Number(n);
      if (a !== void 0 && c !== void 0 && !isNaN(a) && !isNaN(c) && a !== 0 && c !== 0) {
        e.lat = a, e.lon = c;
        const r = e.confrontante_id !== void 0 && e.confrontante_id !== null ? String(e.confrontante_id) : "0";
        o.has(r) || o.set(r, []), o.get(r).push(e);
      }
    }), o.forEach((e) => {
      if (e.length >= 2) {
        e.sort((n, a) => Number(n.id) - Number(a.id));
        const i = e.map((n) => y.latLng(n.lat, n.lon));
        e.length > 2 && i.push(y.latLng(e[0].lat, e[0].lon)), y.polyline(i, {
          color: "#a855f7",
          weight: this.core.config.vizinhoWeight,
          dashArray: "4, 6",
          pane: "overlayPane"
        }).addTo(this.core.pontosVizinhosGroup);
      }
      e.forEach((i) => {
        var f, h;
        const n = document.createElement("div");
        n.className = "p-2 font-sans text-xs bg-[#0c1510] text-white min-w-[200px] rounded", n.innerHTML = `
          <div class="font-bold text-purple-400 mb-1 border-b border-white/10 pb-1">Confrontante (Importado)</div>
          <div class="mb-1"><strong>Vértice:</strong> <span class="font-mono">${C(i.nome_vertice || "")}</span></div>
          <div class="mb-1"><strong>Proprietário:</strong> ${C(i.nome_confrontante || "") || "Desconhecido"}</div>
          <div class="mb-1"><strong>Propriedade:</strong> ${C(i.nome_propriedade || "") || "Desconhecida"}</div>
          <div class="mb-1"><strong>Coordenadas:</strong> ${i.lat.toFixed(7)}, ${i.lon.toFixed(7)}</div>
          <div class="text-[10px] text-white/50 border-t border-white/5 pt-1 mt-1 font-mono uppercase tracking-wider mb-2">Pontos Imutáveis do Vizinho</div>
          <div style="display:flex; gap:6px; border-top:1px solid rgba(255,255,255,0.1); padding-top:6px;">
            <button class="btn-integrar" style="padding:3px 8px; font-size:10px; font-weight:700; border-radius:4px; background:#00f5a0; color:#04150c; border:none; cursor:pointer;" type="button">
              Integrar
            </button>
            <button class="btn-ocultar" style="padding:3px 8px; font-size:10px; font-weight:700; border-radius:4px; background:rgba(255,255,255,0.1); color:rgba(255,255,255,0.8); border:1px solid rgba(255,255,255,0.15); cursor:pointer;" type="button">
              Ocultar
            </button>
          </div>
        `, (f = n.querySelector(".btn-integrar")) == null || f.addEventListener("click", () => {
          window.dispatchEvent(new CustomEvent("gerencigeo:integrar_vizinho", { detail: { pontoId: i.id } }));
        }), (h = n.querySelector(".btn-ocultar")) == null || h.addEventListener("click", () => {
          window.dispatchEvent(new CustomEvent("gerencigeo:ocultar_vizinho", { detail: { pontoId: i.id } }));
        });
        let a = this.core.config.markerStyleV || "cross", c = this.core.config.markerSizeV || 8;
        i.tipo_ponto === "M" || i.tipo === "M" || i.tipo === "B" ? (a = this.core.config.markerStyleM || "circle-dot", c = this.core.config.markerSizeM || 14) : (i.tipo_ponto === "P" || i.tipo === "P" || i.tipo === "O") && (a = this.core.config.markerStyleP || "circle", c = this.core.config.markerSizeP || 10);
        const r = this.core.config.enableAnimations ? "transition-all duration-150" : "", l = Z(a, c, "bg-[#a855f7]", r, `map-marker-vizinho-${i.id}`), p = y.divIcon({
          html: l,
          className: "custom-leaflet-marker flex items-center justify-center",
          iconSize: [c + 4, c + 4]
        }), d = y.marker([i.lat, i.lon], {
          icon: p,
          pane: "overlayPane"
        }).bindPopup(n, { className: "custom-leaflet-popup" });
        d.pontoId = i.id, d.isVizinho = !0, d.addTo(this.core.pontosVizinhosGroup), this.vizinhosMarkers.push(d);
      });
    });
  }
  /**
   * Desenha o perímetro (limites) dos imóveis vizinhos importados via WKT POLYGON
   */
  plotPoligonosVizinhos(t) {
    !this.core.map || !this.core.pontosVizinhosGroup || (this.core.map.hasLayer(this.core.pontosVizinhosGroup) || this.core.pontosVizinhosGroup.addTo(this.core.map), this.vizinhosPoligonos.length > 0 && (this.vizinhosPoligonos.forEach((o) => o.off()), this.vizinhosPoligonos = []), (t || []).forEach((o) => {
      if (!o || !o.poligono_wkt) return;
      const e = /POLYGON\s*\(\s*\(\s*(.*?)\s*\)\s*\)/i.exec(o.poligono_wkt);
      if (!e) return;
      const i = e[1].split(",").map((r) => {
        const l = r.trim().split(/\s+/), p = parseFloat(l[0]), d = parseFloat(l[1]);
        return !isNaN(d) && !isNaN(p) ? [d, p] : null;
      }).filter((r) => r !== null);
      if (i.length < 3) return;
      const n = C(o.nome_propriedade || "Propriedade Vizinha"), a = C(o.nome || "Desconhecido"), c = y.polygon(i, {
        color: "#a855f7",
        weight: this.core.config.vizinhoWeight,
        dashArray: "4, 6",
        fillColor: "#a855f7",
        fillOpacity: 0.05,
        pane: "overlayPane"
      }).bindPopup(`
        <div class="p-2 font-sans text-xs bg-[#0c1510] text-white min-w-[200px] rounded">
          <div class="font-bold text-purple-400 mb-1 border-b border-white/10 pb-1">Limite do Vizinho (Importado)</div>
          <div class="mb-1"><strong>Propriedade:</strong> ${n}</div>
          <div class="mb-1"><strong>Proprietário:</strong> ${a}</div>
        </div>
      `, { className: "custom-leaflet-popup" });
      c.addTo(this.core.pontosVizinhosGroup), this.vizinhosPoligonos.push(c);
    }));
  }
  clearMarkers() {
    this.markers && (this.markers.forEach((t) => {
      t.off(), t.unbindPopup(), this.core.map && this.core.map.removeLayer(t);
    }), this.markers = []), this.vizinhosMarkers && (this.vizinhosMarkers.forEach((t) => {
      t.off(), t.unbindPopup();
    }), this.vizinhosMarkers = []), this.vizinhosPoligonos && (this.vizinhosPoligonos.forEach((t) => t.off()), this.vizinhosPoligonos = []), this.core.pontosVizinhosGroup && this.core.pontosVizinhosGroup.clearLayers();
  }
}
export {
  Vt as CADMapaController,
  gt as CAD_INTERACTIVE_PANES,
  Vt as CanvasCADController,
  yt as CanvasInteracao,
  kt as CanvasLayerManager,
  tt as DEFAULT_CONFIG,
  Mt as DEFAULT_LAYERS,
  Vt as GerenciGeoMapaController,
  St as GridLayerRenderer,
  G as LayerRendererFactory,
  K as MapaConfigManager,
  ut as MapaCore,
  ne as MapaLinhas,
  se as MapaMarcadores,
  vt as TileLayerRenderer,
  Kt as UICanvasCAD,
  xt as VectorLinesLayerRenderer,
  wt as VectorPointsLayerRenderer,
  Ct as VectorPolygonsLayerRenderer,
  bt as WmsLayerRenderer,
  U as agruparPontosPorChave,
  Y as bindPopupAcoesEvents,
  Dt as criarControladorTamanho,
  C as escapeHtml,
  Q as extrairCentroDeWkt,
  Pt as extrairCorPonto,
  le as formatUTM,
  Z as getPointShapeHtml,
  X as ordenarPontosPorSequencia,
  j as parseCoordenada,
  jt as processarAcaoPopup,
  Ot as processarCliqueLivreCanvas,
  W as renderPopupAcoesHtml,
  Gt as renderizarPainelCamadas,
  Ht as tratarCliqueMarcador
};
