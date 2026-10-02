var v = Object.defineProperty;
var T = (s, n, t) => n in s ? v(s, n, { enumerable: !0, configurable: !0, writable: !0, value: t }) : s[n] = t;
var a = (s, n, t) => T(s, typeof n != "symbol" ? n + "" : n, t);
/* empty css               */
import { c as _, o as h } from "./leaflet-loader-Cjcdgj5R.js";
import { l as x, p as y } from "./leaflet-DkaFZYc5.js";
import { d as u, S as d } from "./ssr-safe-5cWfJP-s.js";
const M = ":host{display:block;width:100%;height:400px;position:relative;border-radius:var(--border-radius-md, 8px);overflow:hidden;box-shadow:var(--shadow-sm, 0 1px 3px rgba(0,0,0,.1))}.ui-mapa-container{width:100%;height:100%;z-index:1}.leaflet-top,.leaflet-bottom{z-index:1000}.ui-mapa-popup{font-family:inherit;font-size:13px;font-weight:500;color:#111827;padding:2px 4px}.ui-mapa-svg-pin,.ui-mapa-div-marker{background:transparent!important;border:none!important;cursor:pointer;transition:transform .15s ease,filter .15s ease}.ui-mapa-svg-pin:hover,.ui-mapa-div-marker:hover{transform:scale(1.15);filter:brightness(1.2)}";
function w(s) {
  return {
    osm: {
      nome: "OpenStreetMap",
      layer: () => s.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      })
    },
    satelite: {
      nome: "Satélite (Esri)",
      layer: () => s.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        attribution: "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
      })
    },
    topografia: {
      nome: "Topografia",
      layer: () => s.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
        attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
      })
    },
    ruas: {
      nome: "Ruas (Esri)",
      layer: () => s.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
        attribution: "Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012"
      })
    }
  };
}
class C extends d {
  constructor() {
    super();
    a(this, "mapContainer");
    a(this, "mapInstance", null);
    a(this, "_initTimer", null);
    a(this, "_resizeObserver");
    a(this, "_resizeTimer");
    const t = this.attachShadow({ mode: "open" });
    t.innerHTML = `
      <style>
        ${x}
        ${M}
      </style>
      <div class="ui-mapa-container" id="map-container"></div>
      <div style="display: none;"><slot></slot></div>
    `, this.mapContainer = t.getElementById("map-container");
  }
  static get observedAttributes() {
    return ["lat", "lng", "zoom"];
  }
  connectedCallback() {
    this._initTimer = window.setTimeout(() => {
      this.initMap();
    }, 0);
  }
  disconnectedCallback() {
    this._initTimer && (window.clearTimeout(this._initTimer), this._initTimer = null), this._resizeObserver && (this._resizeObserver.disconnect(), this._resizeObserver = void 0), this._resizeTimer && (window.clearTimeout(this._resizeTimer), this._resizeTimer = null), this.mapInstance && (this.mapInstance.remove(), this.mapInstance = null);
  }
  attributeChangedCallback(t, e, r) {
    if (e !== r && this.mapInstance) {
      const i = parseFloat(this.getAttribute("lat") || "-23.550520"), o = parseFloat(this.getAttribute("lng") || "-46.633308"), c = parseInt(this.getAttribute("zoom") || "13", 10);
      !isNaN(i) && !isNaN(o) && this.mapInstance.setView([i, o], c);
    }
  }
  async initMap() {
    var g;
    if (this.mapInstance) return;
    const t = await _();
    if (!t) {
      this.mapContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 140px; padding: 16px; box-sizing: border-box; text-align: center; color: var(--ui-cor-texto-secundario, #888899); font-family: var(--ui-fonte-base, 'Inter', sans-serif); font-size: 12px; background: var(--ui-cor-superficie, #141417); border-radius: var(--ui-raio-borda, 6px); border: 1px dashed var(--ui-cor-borda, rgba(255,255,255,0.15));">
          <span style="font-size: 20px; margin-bottom: 6px;">🗺️</span>
          <strong style="color: var(--ui-cor-texto, #e1e1e6); margin-bottom: 4px;">Leaflet não encontrado</strong>
          <span style="max-width: 320px; line-height: 1.4;">Para utilizar o componente <code>&lt;ui-mapa&gt;</code>, instale a biblioteca <code>leaflet</code> ou inclua seu script no HTML: <code>&lt;script src=".../leaflet.js"&gt;&lt;/script&gt;</code>.</span>
        </div>
      `;
      return;
    }
    const e = w(t), r = parseFloat(this.getAttribute("lat") || "-23.550520"), i = parseFloat(this.getAttribute("lng") || "-46.633308"), o = parseInt(this.getAttribute("zoom") || "13", 10);
    this.mapInstance = t.map(this.mapContainer).setView([r, i], o);
    const c = this.getAttribute("camadas");
    let p = ["osm"];
    c && (p = c.split(",").map((l) => l.trim().toLowerCase()).filter((l) => e[l]), p.length === 0 && (p = ["osm"]));
    const f = e[p[0]].layer();
    if (f.addTo(this.mapInstance), p.length > 1) {
      const l = {};
      l[e[p[0]].nome] = f;
      for (let m = 1; m < p.length; m++) {
        const b = p[m];
        l[e[b].nome] = e[b].layer();
      }
      t.control.layers(l, void 0, { position: "topright" }).addTo(this.mapInstance);
    }
    (g = t.Icon) != null && g.Default && (t.Icon.Default.imagePath = "https://unpkg.com/leaflet@1.9.4/dist/images/"), typeof ResizeObserver < "u" && this.mapContainer && (this._resizeObserver = new ResizeObserver(() => {
      this._resizeTimer && clearTimeout(this._resizeTimer), this._resizeTimer = setTimeout(() => {
        this.mapInstance && this.mapInstance.invalidateSize();
      }, 60);
    }), this._resizeObserver.observe(this.mapContainer)), setTimeout(() => {
      this.mapInstance && this.mapInstance.invalidateSize();
    }, 100), this.dispatchEvent(new CustomEvent("ui-mapa-pronto", {
      detail: { map: this.mapInstance },
      bubbles: !0,
      composed: !0
    }));
  }
  getMap() {
    return this.mapInstance;
  }
}
u("ui-mapa", C);
class I extends d {
  constructor() {
    super(...arguments);
    a(this, "marker", null);
    a(this, "_initTimer", null);
    a(this, "_retryCount", 0);
    a(this, "_parentMap", null);
    a(this, "handleMapReady", () => {
      this.marker && (this.marker.remove(), this.marker = null), this.initMarker();
    });
  }
  static get observedAttributes() {
    return ["lat", "lng", "titulo", "cor", "formato"];
  }
  connectedCallback() {
    this._parentMap = this.closest("ui-mapa"), this._parentMap && this._parentMap.addEventListener("ui-mapa-pronto", this.handleMapReady), this._initTimer = setTimeout(() => this.initMarker(), 0);
  }
  disconnectedCallback() {
    this._initTimer && (clearTimeout(this._initTimer), this._initTimer = null), this._parentMap && (this._parentMap.removeEventListener("ui-mapa-pronto", this.handleMapReady), this._parentMap = null), this.marker && (this.marker.remove(), this.marker = null);
  }
  attributeChangedCallback(t, e, r) {
    if (e !== r && this.marker) {
      if (t === "lat" || t === "lng") {
        const i = y(this.getAttribute("lat"), this.getAttribute("lng"));
        i && this.marker.setLatLng([i.lat, i.lon]);
      }
      if (t === "titulo" && (this.marker.unbindPopup(), r && this.marker.bindPopup(this.createPopupContent(r))), t === "cor" || t === "formato") {
        const i = h() || window.L;
        i && this.marker.setIcon(this.createIcon(i));
      }
    }
  }
  createPopupContent(t) {
    const e = document.createElement("div");
    return e.className = "ui-mapa-popup", e.textContent = t, e;
  }
  createIcon(t) {
    const e = this.getAttribute("cor") || "#00f5a0";
    if ((this.getAttribute("formato") || "pin") === "circle") {
      const o = `<div style="width:14px; height:14px; background-color:${e}; border-radius:50%; border:2px solid #ffffff; box-shadow:0 1px 4px rgba(0,0,0,0.6);"></div>`;
      return t.divIcon({
        className: "ui-mapa-div-marker",
        html: o,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });
    }
    const i = `
      <svg width="24" height="32" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.45));">
        <path d="M12 0C5.372 0 0 5.372 0 12C0 21 12 32 12 32C12 32 24 21 24 12C24 5.372 18.628 0 12 0Z" fill="${e}"/>
        <circle cx="12" cy="11" r="4.5" fill="#ffffff"/>
      </svg>
    `;
    return t.divIcon({
      className: "ui-mapa-svg-pin",
      html: i,
      iconSize: [24, 32],
      iconAnchor: [12, 32],
      popupAnchor: [0, -30]
    });
  }
  initMarker() {
    const t = this._parentMap || this.closest("ui-mapa");
    if (!t) {
      console.warn("<ui-mapa-marcador> deve estar dentro de um elemento <ui-mapa>");
      return;
    }
    const e = t.getMap();
    if (!e) {
      if (this._retryCount >= 30) {
        console.warn("<ui-mapa-marcador> Tempo limite esgotado aguardando inicialização do mapa pai.");
        return;
      }
      this._retryCount++, this._initTimer = setTimeout(() => this.initMarker(), 50);
      return;
    }
    this._retryCount = 0;
    const r = y(this.getAttribute("lat"), this.getAttribute("lng"));
    if (!r) return;
    const i = this.getAttribute("titulo"), o = h() || window.L;
    o && (this.marker = o.marker([r.lat, r.lon], {
      icon: this.createIcon(o)
    }), this.marker && (i && this.marker.bindPopup(this.createPopupContent(i)), this.marker.addTo(e)));
  }
}
u("ui-mapa-marcador", I);
class A extends d {
  constructor() {
    super(...arguments);
    a(this, "polyline", null);
    a(this, "_initTimer", null);
    a(this, "_retryCount", 0);
  }
  static get observedAttributes() {
    return ["pontos", "cor", "espessura"];
  }
  connectedCallback() {
    this._initTimer = setTimeout(() => this.initLinha(), 0);
  }
  disconnectedCallback() {
    this._initTimer && (clearTimeout(this._initTimer), this._initTimer = null), this.polyline && (this.polyline.remove(), this.polyline = null);
  }
  attributeChangedCallback(t, e, r) {
    e !== r && this.polyline && (t === "pontos" ? this.polyline.setLatLngs(this.getPontos()) : (t === "cor" || t === "espessura") && this.polyline.setStyle({
      color: this.getAttribute("cor") || "#3388ff",
      weight: parseInt(this.getAttribute("espessura") || "3", 10)
    }));
  }
  getPontos() {
    try {
      const t = this.getAttribute("pontos");
      if (t)
        return JSON.parse(t);
    } catch (t) {
      console.error('Formato inválido para atributo pontos no <ui-mapa-linha>. Deve ser um JSON array, ex: "[[lat, lng], ...]"', t);
    }
    return [];
  }
  initLinha() {
    const t = this.closest("ui-mapa");
    if (!t) {
      console.warn("<ui-mapa-linha> deve estar dentro de um elemento <ui-mapa>");
      return;
    }
    const e = t.getMap();
    if (!e) {
      if (this._retryCount >= 30) {
        console.warn("<ui-mapa-linha> Tempo limite esgotado aguardando inicialização do mapa pai.");
        return;
      }
      this._retryCount++, this._initTimer = setTimeout(() => this.initLinha(), 50);
      return;
    }
    this._retryCount = 0;
    const r = this.getAttribute("cor") || "#3388ff", i = parseInt(this.getAttribute("espessura") || "3", 10), o = h() || window.L;
    o && (this.polyline = o.polyline(this.getPontos(), {
      color: r,
      weight: i
    }), this.polyline && this.polyline.addTo(e));
  }
}
u("ui-mapa-linha", A);
export {
  C as UIMapa,
  A as UIMapaLinha,
  I as UIMapaMarcador
};
