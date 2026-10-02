var re = Object.defineProperty;
var oe = (p, d, e) => d in p ? re(p, d, { enumerable: !0, configurable: !0, writable: !0, value: e }) : p[d] = e;
var w = (p, d, e) => oe(p, typeof d != "symbol" ? d + "" : d, e);
/* empty css               */
import { d as D, S as se } from "./ssr-safe-5cWfJP-s.js";
import { L as ne } from "./listener-bag-DQgv7OON.js";
const v = {
  camadas: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
    <polyline points="2 17 12 22 22 17"></polyline>
    <polyline points="2 12 12 17 22 12"></polyline>
  </svg>`,
  inspecao: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>`,
  equipe: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
  </svg>`,
  olhoAberto: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  </svg>`,
  olhoFechado: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
    <line x1="1" y1="1" x2="23" y2="23"></line>
  </svg>`,
  cadeadoTrancado: `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
  </svg>`,
  cadeadoAberto: `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
    <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
  </svg>`,
  chevronDir: `<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="9 18 15 12 9 6"></polyline>
  </svg>`,
  dragHandle: `<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
    <line x1="8" y1="6" x2="8" y2="6.01"></line>
    <line x1="16" y1="6" x2="16" y2="6.01"></line>
    <line x1="8" y1="12" x2="8" y2="12.01"></line>
    <line x1="16" y1="12" x2="16" y2="12.01"></line>
    <line x1="8" y1="18" x2="8" y2="18.01"></line>
    <line x1="16" y1="18" x2="16" y2="18.01"></line>
  </svg>`,
  alvoEnquadrar: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="2" x2="12" y2="6"></line>
    <line x1="12" y1="18" x2="12" y2="22"></line>
    <line x1="2" y1="12" x2="6" y2="12"></line>
    <line x1="18" y1="12" x2="22" y2="12"></line>
  </svg>`,
  engrenagem: `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="3"></circle>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
  </svg>`,
  mais: `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>`,
  lixeira: `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>`,
  fechar: `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>`,
  busca: `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>`,
  recolherPainel: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="13 17 18 12 13 7"></polyline>
    <polyline points="6 17 11 12 6 7"></polyline>
  </svg>`,
  expandirPainel: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="11 17 6 12 11 7"></polyline>
    <polyline points="18 17 13 12 18 7"></polyline>
  </svg>`,
  reguaMetrica: `<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21.3 15.3l-9.6-9.6a1 1 0 0 0-1.4 0l-7 7a1 1 0 0 0 0 1.4l9.6 9.6a1 1 0 0 0 1.4 0l7-7a1 1 0 0 0 0-1.4z"></path>
    <line x1="14.5" y1="8.5" x2="12" y2="11"></line>
    <line x1="10.5" y1="12.5" x2="8" y2="15"></line>
  </svg>`,
  moverPasta: `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
  </svg>`,
  mapa: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
    <line x1="8" y1="2" x2="8" y2="18"></line>
    <line x1="16" y1="6" x2="16" y2="22"></line>
  </svg>`,
  gradeCad: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="3" y1="9" x2="21" y2="9"></line>
    <line x1="3" y1="15" x2="21" y2="15"></line>
    <line x1="9" y1="3" x2="9" y2="21"></line>
    <line x1="15" y1="3" x2="15" y2="21"></line>
  </svg>`
}, q = 6378137;
function de(p, d) {
  if (!p || !d) return 0;
  const e = p[0] * Math.PI / 180, t = p[1] * Math.PI / 180, i = d[0] * Math.PI / 180, s = d[1] * Math.PI / 180, c = i - e, l = s - t, u = Math.sin(c / 2) * Math.sin(c / 2) + Math.cos(e) * Math.cos(i) * Math.sin(l / 2) * Math.sin(l / 2);
  return q * 2 * Math.atan2(Math.sqrt(u), Math.sqrt(1 - u));
}
function K(p) {
  if (!Array.isArray(p) || p.length < 2) return 0;
  if (Array.isArray(p[0]) && Array.isArray(p[0][0]))
    return p.reduce((e, t) => e + K(t), 0);
  let d = 0;
  for (let e = 0; e < p.length - 1; e++) {
    const t = p[e], i = p[e + 1];
    Array.isArray(t) && Array.isArray(i) && t.length >= 2 && i.length >= 2 && (d += de([t[0], t[1]], [i[0], i[1]]));
  }
  return d;
}
function Q(p) {
  if (!Array.isArray(p) || p.length === 0) return 0;
  if (Array.isArray(p[0]) && Array.isArray(p[0][0]))
    return p.reduce((i, s) => i + Q(s), 0);
  const d = p.length;
  if (d < 3) return 0;
  let e = 0;
  for (let i = 0; i < d; i++) {
    const s = p[i], c = p[(i + 1) % d], l = p[(i + 2) % d];
    if (!Array.isArray(s) || !Array.isArray(c) || !Array.isArray(l)) continue;
    const u = (c[1] - s[1]) * (Math.PI / 180), a = (c[0] - s[0]) * (Math.PI / 180), n = (l[1] - c[1]) * (Math.PI / 180), o = (l[0] - c[0]) * (Math.PI / 180);
    e += u * o - a * n;
  }
  const t = Math.abs(e * (q * q) / 2);
  return isNaN(t) ? 0 : t;
}
function Y(p) {
  if (!p || p.length === 0) return "";
  const d = p.filter(
    (t) => t.type === "Polygon" || t.type === "MultiPolygon" || t.geometryType === "Polygon"
  );
  if (d.length > 0) {
    const t = d.reduce(
      (i, s) => i + (Q(s.coordinates) || 0),
      0
    );
    return t >= 1e4 ? `${(t / 1e4).toLocaleString("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2
    })} ha` : `${Math.round(t).toLocaleString("pt-BR")} m²`;
  }
  const e = p.filter(
    (t) => t.type === "LineString" || t.type === "MultiLineString" || t.geometryType === "LineString"
  );
  if (e.length > 0) {
    const t = e.reduce(
      (i, s) => i + (K(s.coordinates) || 0),
      0
    );
    return t >= 1e3 ? `${(t / 1e3).toLocaleString("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2
    })} km` : `${Math.round(t).toLocaleString("pt-BR")} m`;
  }
  return "";
}
const J = [
  {
    id: "none",
    nome: "Sem Mapa",
    descricao: "Tela CAD neutra com grade quadriculada"
  },
  {
    id: "google_satelite_puro",
    nome: "Google Puro",
    descricao: "Satélite limpo sem ruas ou rótulos",
    thumbnailUrl: "https://images.unsplash.com/photo-1524661135-423995f22d0b?w=160&auto=format&fit=crop&q=80"
  },
  {
    id: "google_satelite",
    nome: "Google Híbrido",
    descricao: "Satélite com nomes de ruas e divisas",
    thumbnailUrl: "https://images.unsplash.com/photo-1524661135-423995f22d0b?w=160&auto=format&fit=crop&q=80"
  },
  {
    id: "satelite",
    nome: "Esri Satélite",
    descricao: "Imagens orbitais de alta resolução",
    thumbnailUrl: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=160&auto=format&fit=crop&q=80"
  },
  {
    id: "osm",
    nome: "OpenStreetMap",
    descricao: "Mapa viário e urbano colaborativo",
    thumbnailUrl: "https://images.unsplash.com/photo-1569336415962-a4bd9f69cd83?w=160&auto=format&fit=crop&q=80"
  },
  {
    id: "topografia",
    nome: "Topografia",
    descricao: "Curvas de nível e relevo sombreado",
    thumbnailUrl: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=160&auto=format&fit=crop&q=80"
  },
  {
    id: "dark",
    nome: "Dark Canvas",
    descricao: "Mapa escuro de alto contraste para CAD",
    thumbnailUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=160&auto=format&fit=crop&q=80"
  }
];
function le(p = J, d = "satelite") {
  return !p || p.length === 0 ? "" : `
    <div class="ui-basemap-section">
      <div class="ui-basemap-title">Mapa Base</div>
      <div class="ui-basemap-grid">
        ${p.map((t) => {
    const i = d === t.id, s = $(t.id), c = $(t.nome), l = $(t.descricao || t.nome);
    let u = "";
    return t.thumbnailUrl ? u = `<img class="ui-basemap-preview" src="${$(t.thumbnailUrl)}" alt="${c}" loading="lazy" />` : u = `<div class="ui-basemap-preview-none">${v.gradeCad}</div>`, `
        <div class="ui-basemap-card ${i ? "active" : ""}" data-basemap-id="${s}" title="${l}">
          ${u}
          <span>${c}</span>
        </div>
      `;
  }).join("")}
      </div>
    </div>
  `;
}
function $(p) {
  return p ? String(p).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;") : "";
}
function L(p) {
  return p == null ? "" : String(p).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
const ce = /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(\s*,\s*[\d.]+\s*)?\)|hsla?\(\s*\d+\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?(\s*,\s*[\d.]+\s*)?\)|transparent|currentColor)$/i;
function S(p, d = "#00E08A") {
  if (!p || typeof p != "string") return d;
  const e = p.trim();
  return ce.test(e) ? e : d;
}
function ue(p, d = 80) {
  let e = null;
  return (...t) => {
    e && clearTimeout(e), e = setTimeout(() => {
      p(...t), e = null;
    }, d);
  };
}
function pe(p, d, e) {
  const t = d.filter((a) => e.has(a.id)), i = t.length > 0, s = Y(t), c = i ? t.length : p.length, l = i ? t.length > 1 ? "selecionados" : "selecionado" : p.length > 1 ? "camadas" : "camada", u = p.map((a) => `<option value="${L(a.id)}">${L(a.name)}</option>`).join("");
  return `
    <div class="ui-tree-footer">
      <div class="ui-footer-left">
        <span class="ui-footer-count" id="footer-count">${c}</span>
        <span class="ui-footer-label" id="footer-label">${l}</span>
        ${s ? `<span class="ui-footer-metric">${v.reguaMetrica} ${s}</span>` : ""}
      </div>
      <div class="ui-footer-right">
        <button class="ui-footer-btn ${i ? "" : "disabled"}" id="btn-footer-vis" title="Alternar visibilidade coletiva" ${i ? "" : "disabled"}>
          ${v.olhoAberto}
        </button>

        <button class="ui-footer-btn ${i ? "" : "disabled"}" id="btn-footer-lock" title="Alternar bloqueio coletivo" ${i ? "" : "disabled"}>
          ${v.cadeadoTrancado}
        </button>

        <div class="ui-footer-color-wrapper ${i ? "" : "disabled"}" title="Alterar cor dos selecionados">
          <input type="color" id="input-footer-color" value="#00E08A" class="ui-footer-color" ${i ? "" : "disabled"} />
        </div>

        <div class="ui-footer-move-wrapper ${i ? "" : "disabled"}" title="Mover selecionados para outra camada">
          <select id="select-footer-move" class="ui-footer-select" ${i ? "" : "disabled"}>
            <option value="" disabled selected>📂</option>
            ${u}
          </select>
        </div>

        <button class="ui-footer-btn" id="btn-footer-new-layer" title="Criar Nova Camada">
          ${v.mais}
        </button>

        <button class="ui-footer-btn ${i ? "" : "disabled"}" id="btn-footer-del" title="Excluir selecionados" ${i ? "" : "disabled"}>
          ${v.lixeira}
        </button>

        ${i ? `<button class="ui-footer-btn" id="btn-footer-clear" title="Limpar seleção">${v.fechar}</button>` : ""}
      </div>
    </div>
  `;
}
function he(p, d) {
  const e = S(d, "#00E08A"), t = (p || "").toLowerCase();
  return t === "polygon" || t === "multipolygon" ? `<svg viewBox="0 0 16 16" width="11" height="11"><polygon points="2,14 14,14 12,2 4,4" fill="${e}" fill-opacity="0.45" stroke="${e}" stroke-width="1.5"/></svg>` : t === "linestring" || t === "multilinestring" ? `<svg viewBox="0 0 16 16" width="11" height="11"><polyline points="2,13 8,3 14,10" fill="none" stroke="${e}" stroke-width="2"/></svg>` : t === "text" ? `<svg viewBox="0 0 16 16" width="11" height="11"><text x="8" y="12" font-size="12" font-weight="bold" fill="${e}" text-anchor="middle" font-family="sans-serif">T</text></svg>` : `<svg viewBox="0 0 16 16" width="11" height="11"><circle cx="8" cy="8" r="4.2" fill="${e}" stroke="#ffffff" stroke-width="1.2"/></svg>`;
}
function fe(p) {
  const {
    camadas: d,
    feicoes: e,
    camadaAtivaId: t,
    expandedLayers: i,
    selectedFeatureIds: s,
    activeSettingsLayerId: c,
    editingLayerId: l,
    editingFeatureId: u,
    searchQuery: a,
    limiteFeicoesPorCamada: n = 80
  } = p, o = (a || "").trim().toLowerCase(), r = /* @__PURE__ */ new Map();
  for (let g = 0; g < e.length; g++) {
    const m = e[g], A = m.layerId || "";
    r.has(A) || r.set(A, []), r.get(A).push(m);
  }
  const h = d.every((g) => g.visible !== !1), f = d.length > 0 && d.every((g) => i.has(g.id)), b = `
    <div class="ui-tree-toolbar">
      <div class="ui-tree-title-group">
        <span class="ui-tree-section-title">CAMADAS</span>
        <span class="ui-tree-count-badge">${d.length}</span>
      </div>
      <div class="ui-tree-actions">
        <button id="btn-toggle-all-vis" class="ui-tree-action-btn" title="${h ? "Ocultar Todas as Camadas" : "Exibir Todas as Camadas"}">
          ${h ? v.olhoAberto : v.olhoFechado}
        </button>
        <button id="btn-toggle-all-expand" class="ui-tree-action-btn" title="${f ? "Recolher Todos os Grupos" : "Expandir Todos os Grupos"}">
          <span class="ui-chevron-icon ${f ? "open" : ""}">${v.chevronDir}</span>
        </button>
        <button id="btn-add-layer" class="ui-tree-btn-new" title="Adicionar nova camada vetorial">
          ${v.mais} Camada
        </button>
      </div>
    </div>

    <div class="ui-tree-search-wrapper">
      <span class="ui-tree-search-icon">${v.busca}</span>
      <input type="text" class="ui-tree-search-input" id="input-layer-search" placeholder="Buscar camada ou feição..." value="${L(
    a
  )}" />
      ${a ? `<button class="ui-tree-search-clear" id="btn-clear-layer-search" title="Limpar busca">${v.fechar}</button>` : ""}
    </div>
  `, x = d.map((g) => {
    const m = L(g.id), A = L(g.name || "Camada"), k = S(g.color, "#00E08A"), C = g.visible !== !1, F = g.locked === !0, j = o ? !0 : i.has(g.id), O = c === g.id, P = t === g.id;
    let E = r.get(g.id) || [];
    o && (E = E.filter(
      (y) => (y.name || "").toLowerCase().includes(o) || (y.category || "").toLowerCase().includes(o) || (y.type || "").toLowerCase().includes(o)
    ));
    const H = E.length > 0 && E.every((y) => s.has(y.id)), W = !H && E.some((y) => s.has(y.id)), X = E.slice(0, n), Z = E.length > n, ee = X.map((y) => {
      const I = L(y.id), R = L(y.name || "Feição"), N = S(y.color, k), M = y.visible !== !1, U = y.locked === !0 || F, G = s.has(y.id), _ = y.status;
      let B = "";
      return _ === "oficial" ? B = '<span class="ui-geom-tag oficial" title="Geometria Oficial">OFICIAL</span>' : _ === "previa" && (B = '<span class="ui-geom-tag previa" title="Geometria Prévia">PRÉVIA</span>'), `
            <div class="ui-feat-row ${G ? "selected-row" : ""} ${M ? "" : "hidden-row"}" data-feat-row="${I}" data-feat-select="${I}" data-feat-layer="${m}" draggable="true" title="Clique para selecionar | Arraste para reordenar">
              <div class="ui-col ui-col-eye" data-feat-eye="${I}" title="${M ? "Ocultar Feição" : "Exibir Feição"}">
                ${M ? v.olhoAberto : v.olhoFechado}
              </div>

              <div class="ui-col ui-col-lock" data-feat-lock="${I}" title="${U ? "Desbloquear Feição" : "Bloquear Feição"}">
                ${U ? v.cadeadoTrancado : ""}
              </div>

              <div class="ui-col ui-col-colorbar" style="background: ${N};"></div>
              <div class="ui-col ui-col-branch"><span style="opacity: 0.35;">└─</span></div>
              <div class="ui-col ui-col-thumb">
                <div class="ui-thumb-box">${he(y.type || y.geometryType, N)}</div>
              </div>

              <div class="ui-col ui-col-name" data-feat-name-trigger="${I}" title="Duplo clique para renomear">
                ${u === y.id ? `<input type="text" class="ui-inline-rename-input" data-inline-feat-input="${I}" value="${R}" />` : `<span class="ui-name-text">${R}</span>${B}`}
              </div>

              <div class="ui-col ui-col-actions">
                <button class="ui-micro-btn" data-feat-fit="${I}" title="Enquadrar no mapa">${v.alvoEnquadrar}</button>
              </div>

              <div class="ui-col ui-col-target" data-feat-target="${I}" title="Selecionar feição">
                <div class="ui-target-circle ${G ? "selected" : ""}"></div>
              </div>
            </div>
          `;
    }).join(""), ae = Z ? `<div style="padding: 4px 10px; font-size: 10px; color: var(--ui-cor-texto-secundario, #888899); font-style: italic; background: rgba(0,0,0,0.2);">Exibindo ${n} de ${E.length} feições. Use a busca acima para filtrar.</div>` : "", V = g.opacity !== void 0 ? g.opacity : 1, te = Math.round(V * 100), ie = O ? `
        <div class="ui-layer-settings-drawer" id="settings-drawer-${m}" style="--drawer-cor-camada: ${k};">
          <div class="ui-drawer-header">
            <div class="ui-drawer-header-left">
              <span class="ui-drawer-icon">${v.engrenagem}</span>
              <span class="ui-drawer-title">Configurações da Camada</span>
            </div>
            <button type="button" class="ui-drawer-btn-fechar" data-layer-settings-close="${m}" title="Fechar configurações (Esc)">
              ${v.fechar}
            </button>
          </div>

          <div class="ui-drawer-body">
            <!-- Cor da Camada -->
            <div class="ui-drawer-row">
              <div class="ui-drawer-row-label">
                <span>Cor do Vetor</span>
              </div>
              <div class="ui-drawer-color-group">
                <label class="ui-drawer-color-pill" title="Clique para alterar a cor da camada">
                  <span class="ui-drawer-color-sample" id="sample-color-${m}" style="background-color: ${k};"></span>
                  <span class="ui-drawer-color-hex" id="hex-color-${m}">${k.toUpperCase()}</span>
                  <input type="color" data-layer-color-picker="${m}" value="${k}" class="ui-drawer-color-native" />
                </label>
              </div>
            </div>

            <!-- Opacidade da Camada -->
            <div class="ui-drawer-row">
              <div class="ui-drawer-row-label">
                <span>Opacidade</span>
                <span class="ui-drawer-badge" id="badge-op-${m}">${te}%</span>
              </div>
              <div class="ui-drawer-slider-container">
                <input type="range" min="0.05" max="1" step="0.05" value="${V}" data-layer-opacity-slider="${m}" class="ui-drawer-slider" />
              </div>
            </div>
          </div>

          <div class="ui-drawer-footer">
            <div class="ui-drawer-meta-info">
              <span>${E.length} ${E.length === 1 ? "feição" : "feições"} nesta camada</span>
            </div>
            <div class="ui-drawer-actions">
              <button type="button" class="ui-drawer-btn-danger" data-delete-layer="${m}" title="Excluir esta camada e todas as suas feições">
                ${v.lixeira}
                <span class="ui-btn-label">Excluir Camada</span>
              </button>
            </div>
          </div>
        </div>
      ` : "";
    return `
        <div class="ui-layer-group" data-layer-id="${m}">
          <div class="ui-layer-row ${C ? "" : "hidden-layer"} ${P ? "active-drawing-layer" : ""}" data-layer-row="${m}" data-layer-id="${m}" draggable="true" style="--layer-active-color: ${k};">
            <div class="ui-col ui-col-drag" title="Arrastar para reordenar Z-Index">${v.dragHandle}</div>

            <div class="ui-col ui-col-eye" data-layer-eye="${m}" title="${C ? "Ocultar Camada" : "Exibir Camada"}">
              ${C ? v.olhoAberto : v.olhoFechado}
            </div>

            <div class="ui-col ui-col-lock" data-layer-lock="${m}" title="${F ? "Desbloquear Camada" : "Bloquear Camada"}">
              ${F ? v.cadeadoTrancado : ""}
            </div>

            <div class="ui-col ui-col-colorbar" style="background: ${k};"></div>

            <div class="ui-col ui-col-chevron" data-layer-expand="${m}">
              <span class="ui-chevron-icon ${j ? "open" : ""}">${v.chevronDir}</span>
            </div>

            <div class="ui-col ui-col-name" data-layer-name-trigger="${m}" title="Clique para ativar camada de desenho | Duplo clique para renomear">
              ${l === g.id ? `<input type="text" class="ui-inline-rename-input" data-inline-layer-input="${m}" value="${A}" />` : `<span class="ui-name-text">${A}</span>
                     ${P ? '<span class="ui-active-badge" title="Camada ativa para novos desenhos">✓ Ativa</span>' : ""}
                     <span class="ui-count-chip">${E.length}</span>`}
            </div>

            <div class="ui-col ui-col-actions">
              <button class="ui-micro-btn" data-layer-fit="${m}" title="Enquadrar camada no mapa">${v.alvoEnquadrar}</button>
              <button class="ui-micro-btn ${O ? "active" : ""}" data-layer-settings="${m}" title="Ajustar cor, opacidade e excluir">${v.engrenagem}</button>
            </div>

            <div class="ui-col ui-col-target" data-layer-target="${m}" title="Selecionar todas as feições deste grupo">
              <div class="ui-target-circle ${H ? "selected" : W ? "partial" : ""}"></div>
            </div>
          </div>

          ${ie}

          <div class="ui-children-container" style="display: ${j ? "block" : "none"};">
            ${ee}
            ${ae}
            ${E.length === 0 ? `<div class="ui-empty-row"><span>${o ? "Nenhum item correspondente" : "Nenhum elemento neste grupo"}</span></div>` : ""}
          </div>
        </div>
      `;
  }).join("");
  return `
    ${b}
    <div class="ui-panel-box">
      <div class="ui-layer-tree" id="ui-layer-tree-mount">
        ${x}
      </div>
    </div>
  `;
}
class ge {
  constructor(d, e) {
    w(this, "host");
    w(this, "shadow");
    this.host = d, this.shadow = e;
  }
  bindAll() {
    this.bindInlineRename(), this.bindDragAndDrop();
  }
  bindInlineRename() {
    this.shadow.querySelectorAll("[data-layer-name-trigger]").forEach((d) => {
      d.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        const t = d.getAttribute("data-layer-name-trigger");
        if (!t) return;
        this.host.editingLayerId = t, this.host.solicitarRenderizacao();
        const i = this.shadow.querySelector(
          `[data-inline-layer-input="${t}"]`
        );
        if (i) {
          i.focus(), i.select();
          let s = !1;
          const c = (l) => {
            var u, a;
            if (!s) {
              if (s = !0, this.host.editingLayerId = null, l) {
                const n = i.value.trim(), o = this.host.camadas.find((r) => r.id === t);
                n && o && o.name !== n && (o.name = n, (a = (u = this.host).salvarLembrancaEstado) == null || a.call(u), this.host.dispararEvento("ui-camada-renomeada", {
                  camadaId: t,
                  novoNome: n,
                  camada: o
                }));
              }
              this.host.solicitarRenderizacao();
            }
          };
          i.addEventListener("keydown", (l) => {
            l.key === "Enter" ? (l.preventDefault(), c(!0)) : l.key === "Escape" && (l.preventDefault(), c(!1));
          }), i.addEventListener("blur", () => c(!0));
        }
      });
    }), this.shadow.querySelectorAll("[data-feat-name-trigger]").forEach((d) => {
      d.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        const t = d.getAttribute("data-feat-name-trigger");
        if (!t) return;
        this.host.editingFeatureId = t, this.host.solicitarRenderizacao();
        const i = this.shadow.querySelector(
          `[data-inline-feat-input="${t}"]`
        );
        if (i) {
          i.focus(), i.select();
          let s = !1;
          const c = (l) => {
            if (!s) {
              if (s = !0, this.host.editingFeatureId = null, l) {
                const u = i.value.trim(), a = this.host.feicoes.find((n) => n.id === t);
                u && a && a.name !== u && (a.name = u, this.host.dispararEvento("ui-feicao-renomeada", {
                  feicaoId: t,
                  novoNome: u,
                  feicao: a
                }));
              }
              this.host.solicitarRenderizacao();
            }
          };
          i.addEventListener("keydown", (l) => {
            l.key === "Enter" ? (l.preventDefault(), c(!0)) : l.key === "Escape" && (l.preventDefault(), c(!1));
          }), i.addEventListener("blur", () => c(!0));
        }
      });
    });
  }
  bindDragAndDrop() {
    let d = null, e = null, t = null;
    const i = () => {
      this.shadow.querySelectorAll(".ui-layer-row, .ui-feat-row, .ui-layer-group").forEach((s) => {
        s.classList.remove("dragging", "drop-above", "drop-below", "drop-into");
      });
    };
    this.shadow.querySelectorAll('.ui-layer-row[draggable="true"]').forEach((s) => {
      const c = s.getAttribute("data-layer-id");
      c && (s.addEventListener("dragstart", (l) => {
        const u = l;
        if (u.target.closest("input, button, select") || this.host.editingLayerId || this.host.editingFeatureId) {
          u.preventDefault();
          return;
        }
        d = "layer", e = c, u.dataTransfer && (u.dataTransfer.setData("text/plain", JSON.stringify({ type: "layer", id: c })), u.dataTransfer.effectAllowed = "move"), s.classList.add("dragging");
      }), s.addEventListener("dragover", (l) => {
        const u = l;
        if (u.preventDefault(), u.stopPropagation(), u.dataTransfer && (u.dataTransfer.dropEffect = "move"), d === "layer") {
          if (e === c) return;
          const a = s.getBoundingClientRect(), n = u.clientY - a.top < a.height / 2;
          s.classList.toggle("drop-above", n), s.classList.toggle("drop-below", !n);
        } else d === "feature" && s.classList.add("drop-into");
      }), s.addEventListener("dragleave", () => {
        s.classList.remove("drop-above", "drop-below", "drop-into");
      }), s.addEventListener("drop", (l) => {
        var n, o;
        const u = l;
        u.preventDefault(), u.stopPropagation();
        const a = s.classList.contains("drop-above");
        if (i(), d === "layer") {
          if (!e || e === c) return;
          const r = this.host.camadas.findIndex((b) => b.id === e);
          if (r === -1) return;
          const [h] = this.host.camadas.splice(r, 1), f = this.host.camadas.findIndex((b) => b.id === c);
          f === -1 ? this.host.camadas.push(h) : this.host.camadas.splice(a ? f : f + 1, 0, h), (o = (n = this.host).salvarLembrancaEstado) == null || o.call(n), this.host.dispararEvento("ui-camadas-reordenadas", {
            camadas: [...this.host.camadas]
          }), this.host.solicitarRenderizacao();
        } else if (d === "feature") {
          if (!t) return;
          const r = this.host.feicoes.find((f) => f.id === t), h = this.host.camadas.find((f) => f.id === c);
          if (r && h && r.layerId !== c) {
            const f = r.layerId;
            r.layerId = c, this.host.dispararEvento("ui-feicao-movida", {
              feicaoId: r.id,
              camadaOrigemId: f,
              camadaDestinoId: c,
              feicao: r
            }), this.host.solicitarRenderizacao();
          }
        }
      }), s.addEventListener("dragend", () => {
        d = null, e = null, t = null, i();
      }));
    }), this.shadow.querySelectorAll('.ui-feat-row[draggable="true"]').forEach((s) => {
      const c = s.getAttribute("data-feat-row"), l = s.getAttribute("data-feat-layer");
      c && (s.addEventListener("dragstart", (u) => {
        const a = u;
        if (a.target.closest("input, button, select") || this.host.editingLayerId || this.host.editingFeatureId) {
          a.preventDefault();
          return;
        }
        a.stopPropagation(), d = "feature", t = c, e = l, a.dataTransfer && (a.dataTransfer.setData(
          "text/plain",
          JSON.stringify({ type: "feature", id: c, layerId: l })
        ), a.dataTransfer.effectAllowed = "move"), s.classList.add("dragging");
      }), s.addEventListener("dragover", (u) => {
        const a = u;
        if (d !== "feature" || t === c) return;
        a.preventDefault(), a.stopPropagation(), a.dataTransfer && (a.dataTransfer.dropEffect = "move");
        const n = s.getBoundingClientRect(), o = a.clientY - n.top < n.height / 2;
        s.classList.toggle("drop-above", o), s.classList.toggle("drop-below", !o);
      }), s.addEventListener("dragleave", () => {
        s.classList.remove("drop-above", "drop-below");
      }), s.addEventListener("drop", (u) => {
        const a = u;
        if (d !== "feature" || !t || t === c) return;
        a.preventDefault(), a.stopPropagation();
        const n = s.classList.contains("drop-above");
        i();
        const o = this.host.feicoes.findIndex((m) => m.id === t);
        if (o === -1) return;
        const r = this.host.feicoes.find((m) => m.id === c);
        if (!r) return;
        const [h] = this.host.feicoes.splice(o, 1), f = h.layerId, b = r.layerId, x = f !== b;
        x && (h.layerId = b);
        const g = this.host.feicoes.findIndex((m) => m.id === c);
        g === -1 ? this.host.feicoes.push(h) : this.host.feicoes.splice(n ? g : g + 1, 0, h), x && this.host.dispararEvento("ui-feicao-movida", {
          feicaoId: h.id,
          camadaOrigemId: f,
          camadaDestinoId: b,
          feicao: h
        }), this.host.dispararEvento("ui-feicoes-reordenadas", {
          feicoes: [...this.host.feicoes]
        }), this.host.solicitarRenderizacao();
      }), s.addEventListener("dragend", (u) => {
        u.stopPropagation(), d = null, t = null, e = null, i();
      }));
    });
  }
}
const me = "ui_camadas_estado_";
function ve(p, d) {
  const e = (p || d || "default").trim();
  return `${me}${e}`;
}
function z(p) {
  if (typeof window > "u" || typeof localStorage > "u")
    return null;
  try {
    const d = localStorage.getItem(p);
    if (!d) return null;
    const e = JSON.parse(d);
    if (e && typeof e == "object")
      return e;
  } catch (d) {
    console.warn(`[UI-Camadas] Não foi possível carregar o estado persistido (${p}):`, d);
  }
  return null;
}
function be(p, d) {
  if (!(typeof window > "u" || typeof localStorage > "u"))
    try {
      localStorage.setItem(p, JSON.stringify(d));
    } catch (e) {
      console.warn(`[UI-Camadas] Não foi possível salvar o estado persistido (${p}):`, e);
    }
}
function xe(p) {
  if (!(typeof window > "u" || typeof localStorage > "u"))
    try {
      localStorage.removeItem(p);
    } catch {
    }
}
function ye(p, d, e) {
  if (!Array.isArray(p)) return;
  const t = (d == null ? void 0 : d.camadasOverrides) || {}, i = new Set((d == null ? void 0 : d.expandedLayerIds) || []), s = new Set((d == null ? void 0 : d.collapsedLayerIds) || []), c = i.size > 0 || s.size > 0;
  for (let l = 0; l < p.length; l++) {
    const u = p[l], a = t[u.id];
    a && (typeof a.name == "string" && a.name.trim() && (u.name = a.name), typeof a.visible == "boolean" && (u.visible = a.visible), typeof a.locked == "boolean" && (u.locked = a.locked), typeof a.opacity == "number" && (u.opacity = a.opacity), typeof a.color == "string" && (u.color = a.color)), c ? i.has(u.id) ? e.add(u.id) : s.has(u.id) ? e.delete(u.id) : e.add(u.id) : e.add(u.id);
  }
  if (Array.isArray(d == null ? void 0 : d.ordemCamadasIds) && d.ordemCamadasIds.length > 0) {
    const l = /* @__PURE__ */ new Map();
    d.ordemCamadasIds.forEach((u, a) => l.set(u, a)), p.sort((u, a) => {
      const n = l.has(u.id) ? l.get(u.id) : 9999, o = l.has(a.id) ? l.get(a.id) : 9999;
      return n - o;
    });
  }
}
const we = ':host{display:block;font-family:inherit;font-size:11px;color:var(--ui-cor-texto, #e1e1e6);-webkit-user-select:none;user-select:none;box-sizing:border-box;--camada-linha-altura: 25px;--camada-thumb-tamanho: 15px;--camada-transicao: .16s cubic-bezier(.16, 1, .3, 1)}:host([densidade="compacto"]){--camada-linha-altura: 22px;--camada-thumb-tamanho: 13px;font-size:10px}:host([flutuante]){position:absolute;top:10px;right:10px;bottom:46px;z-index:500}*,*:before,*:after{box-sizing:border-box}:host(:not([flutuante])) .ui-camadas-container{max-width:100%;min-width:0;border:none;box-shadow:none;border-radius:0;background:transparent;backdrop-filter:none;-webkit-backdrop-filter:none}.ui-camadas-container{display:flex;flex-direction:column;height:100%;width:100%;max-width:380px;min-width:270px;background:var(--ui-cor-superficie, #141417);border:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .12));border-radius:var(--ui-raio-borda, 8px);box-shadow:0 10px 30px -4px #00000080,0 0 0 1px #ffffff0d;overflow:hidden;transition:transform .24s cubic-bezier(.16,1,.3,1),opacity .2s ease;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}:host([colapsado]) .ui-camadas-container{transform:translate(calc(100% + 24px));opacity:0;pointer-events:none}.ui-camadas-toggle-flutuante{display:none;position:absolute;top:10px;right:10px;z-index:499;background:var(--ui-cor-superficie, #141417);border:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .18));border-radius:var(--ui-raio-borda, 6px);color:var(--ui-cor-texto, #ffffff);width:34px;height:34px;cursor:pointer;align-items:center;justify-content:center;box-shadow:0 8px 20px #00000073;transition:all var(--camada-transicao)}:host([colapsado][flutuante]) .ui-camadas-toggle-flutuante{display:flex}.ui-camadas-toggle-flutuante:hover{border-color:var(--ui-cor-primaria, #00E08A);color:var(--ui-cor-primaria, #00E08A);transform:scale(1.08);box-shadow:0 0 14px #00e08a59}.ui-camadas-header{height:32px;min-height:32px;max-height:32px;display:flex;align-items:center;justify-content:space-between;padding:0 5px;border-bottom:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .08));background:var(--ui-cor-fundo-elevado, rgba(0, 0, 0, .28));gap:4px}.ui-camadas-tabs{display:flex;gap:3px;flex:1}.ui-camadas-tab-btn{flex:1;background:transparent;border:none;color:var(--ui-cor-texto-secundario, #888899);height:24px;padding:0 6px;font-size:11px;font-weight:500;border-radius:4px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;white-space:nowrap;transition:all var(--camada-transicao)}.ui-camadas-tab-btn:hover{color:var(--ui-cor-texto, #ffffff);background:var(--ui-cor-hover-menu, rgba(255, 255, 255, .07))}.ui-camadas-tab-btn.active{color:var(--ui-cor-primaria, #00E08A);background:#00e08a1f;box-shadow:inset 0 0 0 1px #00e08a40;font-weight:600}.ui-camadas-btn-colapsar{background:transparent;border:none;color:var(--ui-cor-texto-secundario, #888899);width:22px;height:22px;cursor:pointer;border-radius:4px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all var(--camada-transicao)}.ui-camadas-btn-colapsar:hover{color:var(--ui-cor-texto, #ffffff);background:var(--ui-cor-hover-menu, rgba(255, 255, 255, .09))}.ui-camadas-corpo{flex:1;overflow-y:auto;overflow-x:hidden;padding:6px 6px 4px;display:flex;flex-direction:column;gap:6px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.16) transparent}.ui-camadas-corpo::-webkit-scrollbar{width:4px}.ui-camadas-corpo::-webkit-scrollbar-thumb{background:#ffffff2e;border-radius:4px}.ui-camadas-corpo::-webkit-scrollbar-thumb:hover{background:#ffffff52}.ui-tree-toolbar{display:flex;align-items:center;justify-content:space-between;padding:1px 2px 3px;border-bottom:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .06))}.ui-tree-title-group{display:flex;align-items:center;gap:5px}.ui-tree-section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--ui-cor-texto-secundario, #888899)}.ui-tree-count-badge{font-size:9px;font-family:var(--ui-fonte-mono, monospace);font-variant-numeric:tabular-nums;background:#ffffff12;color:var(--ui-cor-texto-secundario, #888899);padding:1px 5px;border-radius:8px;border:1px solid rgba(255,255,255,.06)}.ui-tree-actions{display:flex;align-items:center;gap:3px}.ui-tree-action-btn{background:transparent;border:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .1));color:var(--ui-cor-texto-secundario, #888899);border-radius:4px;width:22px;height:22px;padding:0;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all var(--camada-transicao)}.ui-tree-action-btn:hover{color:var(--ui-cor-texto, #ffffff);border-color:var(--ui-cor-primaria, #00E08A);background:var(--ui-cor-hover-menu, rgba(255, 255, 255, .09))}.ui-tree-btn-new{background:#00e08a1f;border:1px solid rgba(0,224,138,.35);color:var(--ui-cor-primaria, #00E08A);border-radius:4px;height:22px;padding:0 8px;font-size:10px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:4px;transition:all var(--camada-transicao)}.ui-tree-btn-new:hover{background:var(--ui-cor-primaria, #00E08A);color:var(--ui-cor-texto-sobre-primaria, #000000);box-shadow:0 0 10px #00e08a59}.ui-tree-search-wrapper{position:relative;display:flex;align-items:center;margin:1px 0}.ui-tree-search-icon{position:absolute;left:8px;color:var(--ui-cor-texto-secundario, #888899);pointer-events:none;display:flex;align-items:center}.ui-tree-search-input{width:100%;height:25px;background:var(--ui-cor-fundo, #0a0a0c);border:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .1));border-radius:var(--ui-raio-borda, 5px);padding:0 24px 0 26px;color:var(--ui-cor-texto, #ffffff);font-size:10.5px;outline:none;transition:border-color var(--camada-transicao),box-shadow var(--camada-transicao)}.ui-tree-search-input:focus{border-color:var(--ui-cor-primaria, #00E08A);box-shadow:0 0 0 2px #00e08a2e}.ui-tree-search-clear{position:absolute;right:5px;background:transparent;border:none;color:var(--ui-cor-texto-secundario, #888899);cursor:pointer;width:18px;height:18px;display:flex;align-items:center;justify-content:center;border-radius:3px;transition:all var(--camada-transicao)}.ui-tree-search-clear:hover{color:var(--ui-cor-texto, #ffffff);background:#ffffff1a}.ui-panel-box{background:var(--ui-cor-fundo, #0c0c0f);border:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .08));border-radius:var(--ui-raio-borda, 6px);overflow:hidden;display:flex;flex-direction:column}.ui-layer-tree{max-height:380px;overflow-y:auto;overflow-x:hidden}.ui-layer-group{border-bottom:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .04));transition:background var(--camada-transicao)}.ui-layer-group.drop-into{background:#00e08a17!important;outline:1.5px dashed var(--ui-cor-primaria, #00E08A);outline-offset:-1.5px}.ui-layer-row,.ui-feat-row{display:flex;align-items:center;height:var(--camada-linha-altura);min-height:var(--camada-linha-altura);max-height:var(--camada-linha-altura);padding:0 4px;-webkit-user-select:none;user-select:none;cursor:default;transition:background .1s ease;position:relative}.ui-layer-row{background:var(--ui-cor-fundo-elevado, #18181d);font-weight:600;cursor:pointer;border-left:3px solid transparent}.ui-layer-row:hover{background:var(--ui-cor-hover-menu, #22222a)}.ui-layer-row.active-drawing-layer{background:#00e08a1f!important;border-left:3px solid var(--layer-active-color, var(--ui-cor-primaria, #00E08A))!important;box-shadow:inset 0 0 12px #00e08a12}.ui-layer-row.active-drawing-layer .ui-name-text{color:#fff;font-weight:700}.ui-feat-row{background:var(--ui-cor-fundo, #101014);font-weight:400;cursor:pointer}.ui-feat-row:hover{background:var(--ui-cor-hover-menu, #19191f)}.ui-feat-row.selected-row{background:#38bdf82e!important;outline:1px solid rgba(56,189,248,.5)!important;outline-offset:-1px}.ui-layer-row.hidden-layer,.ui-feat-row.hidden-row{opacity:.52}.ui-layer-row.hidden-layer .ui-col-eye,.ui-feat-row.hidden-row .ui-col-eye{color:#f59e0b;opacity:.95}.ui-layer-row.dragging,.ui-feat-row.dragging{opacity:.35;background:#38bdf829!important}.ui-layer-row.drop-above:before,.ui-feat-row.drop-above:before{content:"";position:absolute;top:0;left:0;right:0;height:2px;background:#38bdf8;box-shadow:0 0 8px #38bdf8;z-index:20;pointer-events:none}.ui-layer-row.drop-below:after,.ui-feat-row.drop-below:after{content:"";position:absolute;bottom:0;left:0;right:0;height:2px;background:#38bdf8;box-shadow:0 0 8px #38bdf8;z-index:20;pointer-events:none}.ui-col{display:flex;align-items:center;justify-content:center;flex-shrink:0;height:var(--camada-linha-altura)}.ui-col-drag{width:14px;cursor:grab;color:var(--ui-cor-texto-secundario, #888899);opacity:.35;transition:opacity var(--camada-transicao),color var(--camada-transicao)}.ui-layer-row:hover .ui-col-drag,.ui-feat-row:hover .ui-col-drag{opacity:.9;color:var(--ui-cor-primaria, #00E08A)}.ui-col-drag:active{cursor:grabbing}.ui-col-eye{width:20px;cursor:pointer;color:var(--ui-cor-texto-secundario, #888899);transition:color var(--camada-transicao)}.ui-col-eye:hover{color:var(--ui-cor-primaria, #00E08A)}.ui-col-lock{width:18px;cursor:pointer;color:var(--ui-cor-texto-secundario, #888899);transition:color var(--camada-transicao)}.ui-col-lock:hover{color:#f59e0b}.ui-col-colorbar{width:3.5px;height:16px;margin:0 3px 0 2px;border-radius:1.5px;flex-shrink:0}.ui-col-chevron{width:14px;cursor:pointer;color:var(--ui-cor-texto-secundario, #888899);display:flex;align-items:center;justify-content:center}.ui-chevron-icon{display:inline-flex;align-items:center;justify-content:center;transition:transform var(--camada-transicao)}.ui-chevron-icon.open{transform:rotate(90deg)}.ui-col-branch{width:14px;display:flex;align-items:center;justify-content:center;color:#ffffff38;font-size:10px;font-family:var(--ui-fonte-mono, monospace)}.ui-col-thumb{width:18px;margin-right:4px;display:flex;align-items:center;justify-content:center}.ui-thumb-box{width:var(--camada-thumb-tamanho);height:var(--camada-thumb-tamanho);border:1px solid rgba(255,255,255,.15);border-radius:2.5px;background:#0d0d10;display:flex;align-items:center;justify-content:center}.ui-col-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10.5px;color:var(--ui-cor-texto, #e1e1e6);padding-left:2px;padding-right:4px;cursor:pointer;display:flex;align-items:center;justify-content:flex-start;text-align:left;gap:4px}.ui-name-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ui-active-badge{font-size:8px;font-weight:700;color:var(--ui-cor-primaria, #00E08A);background:#00e08a2e;border:1px solid rgba(0,224,138,.45);padding:1px 4px;border-radius:3px;display:inline-flex;align-items:center;gap:2px;white-space:nowrap;flex-shrink:0;animation:pulseBadge 2.8s infinite}@keyframes pulseBadge{0%{opacity:.85}50%{opacity:1;filter:drop-shadow(0 0 4px rgba(0,224,138,.5))}to{opacity:.85}}.ui-count-chip{font-size:9px;font-family:var(--ui-fonte-mono, monospace);font-variant-numeric:tabular-nums;color:var(--ui-cor-texto-secundario, #888899);background:#ffffff0f;padding:0 4px;border-radius:8px}.ui-col-actions{display:flex;align-items:center;gap:2px;opacity:0;transition:opacity var(--camada-transicao)}.ui-layer-row:hover .ui-col-actions,.ui-feat-row:hover .ui-col-actions{opacity:1}.ui-micro-btn{background:transparent;border:none;color:var(--ui-cor-texto-secundario, #888899);width:18px;height:18px;padding:0;border-radius:3px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all var(--camada-transicao)}.ui-micro-btn:hover{color:var(--ui-cor-primaria, #00E08A);background:var(--ui-cor-hover-menu, rgba(255, 255, 255, .12))}.ui-micro-btn.active{color:var(--ui-cor-primaria, #00E08A);background:#00e08a2e}.ui-col-target{width:22px;cursor:pointer}.ui-target-circle{width:11px;height:11px;border-radius:50%;border:1.5px solid rgba(255,255,255,.32);background:transparent;transition:all .12s ease}.ui-col-target:hover .ui-target-circle{border-color:#38bdf8;transform:scale(1.18)}.ui-target-circle.selected{border:2px solid #38bdf8;background:#38bdf8;box-shadow:inset 0 0 0 2px #141418}.ui-target-circle.partial{border:2px solid #38bdf8;background:#38bdf866}.ui-inline-rename-input{width:100%;height:20px;background:#0d0d10;color:#fff;border:1px solid var(--ui-cor-primaria, #00E08A);border-radius:3px;font-size:10.5px;padding:0 4px;outline:none;box-shadow:0 0 8px #00e08a66}.ui-layer-settings-drawer{background:linear-gradient(180deg,#17171e,#0f0f13);padding:10px 14px 12px;border-top:1px solid rgba(255,255,255,.08);border-bottom:1px solid rgba(255,255,255,.12);border-left:3px solid var(--drawer-cor-camada, var(--ui-cor-primaria, #00E08A));display:flex;flex-direction:column;gap:10px;box-shadow:inset 0 1px #ffffff0f,0 6px 16px #00000073;animation:drawerSlideDown .18s cubic-bezier(.16,1,.3,1);position:relative;z-index:10}@keyframes drawerSlideDown{0%{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:translateY(0)}}.ui-drawer-header{display:flex;align-items:center;justify-content:space-between;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,.07)}.ui-drawer-header-left{display:flex;align-items:center;gap:7px;min-width:0}.ui-drawer-icon{color:var(--drawer-cor-camada, var(--ui-cor-primaria, #00E08A));display:flex;align-items:center;flex-shrink:0}.ui-drawer-title{font-size:10.5px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:.6px;white-space:nowrap}.ui-drawer-layer-chip{font-size:9.5px;font-weight:500;color:#99b;background:#ffffff12;padding:1px 6px;border-radius:4px;border:1px solid rgba(255,255,255,.08);max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ui-drawer-btn-fechar{background:transparent;border:none;color:var(--ui-cor-texto-secundario, #888899);width:20px;height:20px;padding:0;border-radius:4px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all var(--camada-transicao)}.ui-drawer-btn-fechar:hover{color:#fff;background:#ffffff1f}.ui-drawer-body{display:flex;flex-direction:column;gap:10px}.ui-drawer-row{display:flex;flex-direction:column;gap:5px}.ui-drawer-row-label{display:flex;justify-content:space-between;align-items:center;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:#9f9fb5}.ui-drawer-color-group{display:flex;align-items:center;justify-content:space-between;gap:8px}.ui-drawer-color-pill{position:relative;display:inline-flex;align-items:center;gap:6px;padding:3px 8px 3px 5px;background:#0006;border:1px solid rgba(255,255,255,.16);border-radius:4px;cursor:pointer;transition:all var(--camada-transicao);-webkit-user-select:none;user-select:none}.ui-drawer-color-pill:hover{border-color:var(--drawer-cor-camada, var(--ui-cor-primaria, #00E08A));background:#ffffff14;box-shadow:0 0 10px #00e08a40}.ui-drawer-color-sample{width:14px;height:14px;border-radius:3px;border:1px solid rgba(255,255,255,.35);box-shadow:0 1px 3px #00000080;flex-shrink:0;transition:background-color .1s ease}.ui-drawer-color-hex{font-size:10px;font-family:var(--ui-fonte-mono, monospace);font-variant-numeric:tabular-nums;font-weight:700;color:#f1f1f5;letter-spacing:.5px}.ui-drawer-color-native{position:absolute;opacity:0;width:0;height:0;pointer-events:none}.ui-drawer-badge{font-size:9.5px;font-family:var(--ui-fonte-mono, monospace);font-variant-numeric:tabular-nums;font-weight:700;color:#fff;background:#ffffff1a;padding:1px 6px;border-radius:4px;border:1px solid rgba(255,255,255,.12)}.ui-drawer-slider-container{display:flex;flex-direction:column;gap:4px}.ui-drawer-slider{-webkit-appearance:none;-moz-appearance:none;appearance:none;width:100%;height:5px;background:linear-gradient(90deg,rgba(255,255,255,.08) 0%,var(--drawer-cor-camada, var(--ui-cor-primaria, #00E08A)) 100%);border-radius:3px;outline:none;margin:3px 0;cursor:pointer;border:1px solid rgba(255,255,255,.12)}.ui-drawer-slider::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:#fff;border:3px solid var(--drawer-cor-camada, var(--ui-cor-primaria, #00E08A));box-shadow:0 0 6px #0009,0 0 10px var(--drawer-cor-camada, rgba(0, 224, 138, .6));cursor:pointer;transition:transform .12s ease}.ui-drawer-slider::-webkit-slider-thumb:hover{transform:scale(1.22)}.ui-drawer-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:#fff;border:3px solid var(--drawer-cor-camada, var(--ui-cor-primaria, #00E08A));box-shadow:0 0 6px #0009,0 0 10px var(--drawer-cor-camada, rgba(0, 224, 138, .6));cursor:pointer}.ui-drawer-footer{display:flex;align-items:center;justify-content:space-between;padding-top:8px;border-top:1px solid rgba(255,255,255,.07)}.ui-drawer-meta-info{font-size:9.5px;color:#77778b;font-style:italic}.ui-drawer-actions{display:flex;align-items:center;gap:6px}.ui-drawer-btn-danger{background:#ef44441a;border:1px solid rgba(239,68,68,.35);color:#f87171;border-radius:4px;height:24px;padding:0 10px;font-size:10px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:5px;transition:all var(--camada-transicao)}.ui-drawer-btn-danger:hover{background:#ef4444;color:#fff;border-color:#ef4444;box-shadow:0 0 10px #ef444473;transform:translateY(-.5px)}.ui-drawer-btn-danger.confirming{background:#dc2626;color:#fff;border-color:#f87171;animation:pulseDanger 1.2s infinite}@keyframes pulseDanger{0%{transform:scale(1)}50%{transform:scale(1.02)}to{transform:scale(1)}}.ui-geom-tag{font-size:8px;font-weight:700;letter-spacing:.4px;padding:1px 4px;border-radius:3px;margin-left:4px;text-transform:uppercase;flex-shrink:0}.ui-geom-tag.oficial{background:#10b98129;color:#10b981;border:1px solid rgba(16,185,129,.35)}.ui-geom-tag.previa{background:#f59e0b29;color:#f59e0b;border:1px solid rgba(245,158,11,.35)}.ui-tree-footer{height:28px;min-height:28px;background:var(--ui-cor-fundo-elevado, #111115);border-top:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .08));display:flex;align-items:center;justify-content:space-between;padding:0 6px;gap:4px}.ui-footer-left{display:flex;align-items:center;gap:4px;white-space:nowrap;min-width:0}.ui-footer-count{font-size:10.5px;font-family:var(--ui-fonte-mono, monospace);font-variant-numeric:tabular-nums;font-weight:700;color:var(--ui-cor-primaria, #00E08A)}.ui-footer-label{font-size:10px;font-weight:500;color:var(--ui-cor-texto-secundario, #888899)}.ui-footer-metric{font-size:9.5px;font-family:var(--ui-fonte-mono, monospace);font-variant-numeric:tabular-nums;color:var(--ui-cor-primaria, #00E08A);display:inline-flex;align-items:center;gap:3px;white-space:nowrap}.ui-footer-right{display:flex;align-items:center;gap:2px;flex-shrink:0}.ui-footer-btn{background:transparent;border:none;color:var(--ui-cor-texto-secundario, #888899);width:20px;height:20px;padding:0;cursor:pointer;display:flex;align-items:center;justify-content:center;border-radius:3px;transition:all var(--camada-transicao)}.ui-footer-btn:hover:not(.disabled){color:#fff;background:var(--ui-cor-hover-menu, rgba(255, 255, 255, .12))}.ui-footer-btn.disabled{opacity:.25;cursor:not-allowed}.ui-footer-color-wrapper,.ui-footer-move-wrapper{display:flex;align-items:center}.ui-footer-color{width:15px;height:15px;border:none;background:transparent;cursor:pointer;padding:0}.ui-footer-select{background:var(--ui-cor-fundo, #18181d);border:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .12));color:#fff;border-radius:3px;font-size:9.5px;height:20px;padding:0 2px;cursor:pointer}.ui-basemap-section{display:flex;flex-direction:column;gap:4px}.ui-basemap-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--ui-cor-texto-secundario, #888899)}.ui-basemap-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:4px}.ui-basemap-card{display:flex;flex-direction:column;align-items:center;gap:2px;padding:3px;border-radius:var(--ui-raio-borda, 5px);background:var(--ui-cor-fundo, #101014);border:1px solid var(--ui-cor-borda, rgba(255, 255, 255, .08));cursor:pointer;transition:all var(--camada-transicao);text-align:center;overflow:hidden}.ui-basemap-card:hover{border-color:var(--ui-cor-primaria, #00E08A);background:var(--ui-cor-fundo-elevado, #17171c)}.ui-basemap-card.active{border-color:var(--ui-cor-primaria, #00E08A);background:#00e08a1f;color:var(--ui-cor-primaria, #00E08A);font-weight:600;box-shadow:inset 0 0 0 1px #00e08a59}.ui-basemap-preview{width:100%;height:22px;border-radius:3px;object-fit:cover;opacity:.85;transition:opacity var(--camada-transicao)}.ui-basemap-preview-none{width:100%;height:22px;display:flex;align-items:center;justify-content:center;background:#ffffff0a;border-radius:3px;color:var(--ui-cor-texto-secundario, #888899)}.ui-basemap-card:hover .ui-basemap-preview,.ui-basemap-card.active .ui-basemap-preview{opacity:1}.ui-basemap-card span{font-size:9.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}.ui-search-hidden{display:none!important}.ui-empty-row{height:22px;display:flex;align-items:center;padding-left:36px;font-size:10px;color:var(--ui-cor-texto-secundario, #666677);font-style:italic;background:#00000026}:host-context([data-tema="claro"]),:host-context(.light),:host([data-tema="claro"]){color:#1a1a1e}:host-context([data-tema="claro"]) .ui-camadas-container,:host([data-tema="claro"]) .ui-camadas-container{background:#fff;border-color:#0000001f;box-shadow:0 10px 30px -4px #00000026}:host-context([data-tema="claro"]) .ui-layer-row,:host([data-tema="claro"]) .ui-layer-row{background:#f1f3f5;color:#1a1a1e}:host-context([data-tema="claro"]) .ui-feat-row,:host([data-tema="claro"]) .ui-feat-row{background:#fff;color:#2b2b36}:host-context([data-tema="claro"]) .ui-panel-box,:host([data-tema="claro"]) .ui-panel-box{background:#fff;border-color:#00000014}';
class T extends se {
  constructor() {
    super();
    w(this, "shadow");
    w(this, "listeners", new ne());
    w(this, "dragDropManager");
    // Estado interno
    w(this, "camadas", []);
    w(this, "feicoes", []);
    w(this, "mapasBase", [...J]);
    w(this, "expandedLayers", /* @__PURE__ */ new Set());
    w(this, "selectedFeatureIds", /* @__PURE__ */ new Set());
    w(this, "lastClickedFeatureId", null);
    w(this, "activeSettingsLayerId", null);
    w(this, "editingLayerId", null);
    w(this, "editingFeatureId", null);
    w(this, "searchQuery", "");
    w(this, "corpoElement");
    w(this, "btnExpandirFlutuante");
    this.shadow = this.attachShadow({ mode: "open" }), this.shadow.innerHTML = `
      <style>${we}</style>
      <div class="ui-camadas-container" id="panel-container" role="region" aria-label="Painel de Camadas">
        <div class="ui-camadas-corpo" id="painel-corpo"></div>
      </div>
      <button class="ui-camadas-toggle-flutuante" id="btn-expandir-flutuante" title="Expandir Painel de Camadas" aria-label="Expandir Painel de Camadas">
        ${v.camadas}
      </button>
    `, this.corpoElement = this.shadow.getElementById("painel-corpo"), this.btnExpandirFlutuante = this.shadow.getElementById("btn-expandir-flutuante"), this.dragDropManager = new ge(this, this.shadow);
  }
  static get observedAttributes() {
    return [
      "titulo",
      "mapa-base-ativo",
      "camada-ativa",
      "aba-ativa",
      "colapsavel",
      "colapsado",
      "flutuante",
      "mostrar-mapas-base",
      "mostrar-rodape",
      "mostrar-busca",
      "densidade",
      "persistir",
      "storage-key"
    ];
  }
  connectedCallback() {
    if (this.persistir) {
      const e = z(this.obterChaveStorageAtual());
      e && (typeof e.painelColapsado == "boolean" && (this.colapsado = e.painelColapsado), e.camadaAtivaId && !this.getAttribute("camada-ativa") && (this.camadaAtivaId = e.camadaAtivaId), e.mapaBaseAtivo && !this.getAttribute("mapa-base-ativo") && (this.mapaBaseAtivo = e.mapaBaseAtivo), e.densidade && !this.getAttribute("densidade") && (this.densidade = e.densidade));
    }
    this.render(), this.conectarEventosGerais(), this.conectarTecladoAcessibilidade();
  }
  disconnectedCallback() {
    this.listeners.cleanup();
  }
  attributeChangedCallback(e, t, i) {
    if (t !== i)
      if (e === "colapsado") {
        const s = i !== null;
        this.dispararEvento("ui-colapso-alterado", { colapsado: s }), this.salvarLembrancaEstado();
      } else e === "camada-ativa" && (this.sincronizarCamadaAtivaDOM(), this.salvarLembrancaEstado());
  }
  // --- Getters e Setters de Propriedades Reativas ---
  get titulo() {
    return this.getAttribute("titulo") || "Camadas";
  }
  set titulo(e) {
    this.setAttribute("titulo", e);
  }
  get camadaAtivaId() {
    var e;
    return this.getAttribute("camada-ativa") || (((e = this.camadas[0]) == null ? void 0 : e.id) ?? null);
  }
  set camadaAtivaId(e) {
    e ? this.setAttribute("camada-ativa", e) : this.removeAttribute("camada-ativa");
  }
  get mapaBaseAtivo() {
    return this.getAttribute("mapa-base-ativo") || "satelite";
  }
  set mapaBaseAtivo(e) {
    this.setAttribute("mapa-base-ativo", e);
  }
  get abaAtiva() {
    return this.getAttribute("aba-ativa") || "camadas";
  }
  set abaAtiva(e) {
    this.setAttribute("aba-ativa", e);
  }
  get colapsado() {
    return this.hasAttribute("colapsado");
  }
  set colapsado(e) {
    e ? this.setAttribute("colapsado", "") : this.removeAttribute("colapsado");
  }
  get flutuante() {
    return this.hasAttribute("flutuante");
  }
  set flutuante(e) {
    e ? this.setAttribute("flutuante", "") : this.removeAttribute("flutuante");
  }
  get densidade() {
    return this.getAttribute("densidade") || "normal";
  }
  set densidade(e) {
    this.setAttribute("densidade", e);
  }
  get mostrarMapasBase() {
    return this.getAttribute("mostrar-mapas-base") !== "false";
  }
  set mostrarMapasBase(e) {
    this.setAttribute("mostrar-mapas-base", String(e));
  }
  get mostrarRodape() {
    return this.getAttribute("mostrar-rodape") !== "false";
  }
  set mostrarRodape(e) {
    this.setAttribute("mostrar-rodape", String(e));
  }
  get mostrarBusca() {
    return this.getAttribute("mostrar-busca") !== "false";
  }
  set mostrarBusca(e) {
    this.setAttribute("mostrar-busca", String(e));
  }
  get persistir() {
    return this.getAttribute("persistir") !== "false";
  }
  set persistir(e) {
    this.setAttribute("persistir", String(e));
  }
  get storageKey() {
    return this.getAttribute("storage-key");
  }
  set storageKey(e) {
    e ? this.setAttribute("storage-key", e) : this.removeAttribute("storage-key");
  }
  // --- Gerenciamento de Persistência / Lembrança ---
  obterChaveStorageAtual() {
    return ve(this.storageKey, this.id);
  }
  salvarLembrancaEstado() {
    if (!this.persistir) return;
    const e = this.obterChaveStorageAtual(), t = z(e);
    let i = (t == null ? void 0 : t.expandedLayerIds) || [], s = (t == null ? void 0 : t.collapsedLayerIds) || [], c = (t == null ? void 0 : t.ordemCamadasIds) || [];
    const l = {
      ...(t == null ? void 0 : t.camadasOverrides) || {}
    };
    this.camadas.length > 0 && (i = [], s = [], c = this.camadas.map((a) => a.id), this.camadas.forEach((a) => {
      this.expandedLayers.has(a.id) ? i.push(a.id) : s.push(a.id), l[a.id] = {
        name: a.name,
        visible: a.visible !== !1,
        locked: !!a.locked,
        opacity: typeof a.opacity == "number" ? a.opacity : 1,
        color: a.color || "#00E08A"
      };
    }));
    const u = {
      versao: 1,
      expandedLayerIds: i,
      collapsedLayerIds: s,
      camadaAtivaId: this.camadaAtivaId,
      painelColapsado: this.colapsado,
      ordemCamadasIds: c,
      mapaBaseAtivo: this.mapaBaseAtivo,
      densidade: this.densidade,
      camadasOverrides: l,
      ultimaAtualizacao: Date.now()
    };
    be(e, u);
  }
  limparLembranca() {
    xe(this.obterChaveStorageAtual());
  }
  // --- API Pública de Alta Ergonomia ---
  definirCamadas(e, t) {
    if (this.camadas = Array.isArray(e) ? e.map((i) => ({ ...i })) : [], this.persistir) {
      const i = z(this.obterChaveStorageAtual());
      ye(this.camadas, i, this.expandedLayers), i != null && i.camadaAtivaId && this.camadas.some((s) => s.id === i.camadaAtivaId) && (this.camadaAtivaId = i.camadaAtivaId);
    } else
      this.camadas.forEach((i) => {
        this.expandedLayers.has(i.id) || this.expandedLayers.add(i.id);
      });
    if (Array.isArray(t)) {
      this.feicoes = [...t];
      const i = new Set(this.camadas.map((c) => c.id)), s = this.feicoes.filter((c) => c.layerId && !i.has(c.layerId));
      s.length > 0 && console.warn(
        `[UI-Camadas] ${s.length} feição(ões) possuem 'layerId' não cadastrado nas camadas:`,
        s.map((c) => ({ id: c.id, nome: c.name, layerId: c.layerId }))
      ), this.sincronizarSelecoesComFeicoesValidas();
    }
    !this.getAttribute("camada-ativa") && this.camadas.length > 0 && (this.camadaAtivaId = this.camadas[0].id), this.salvarLembrancaEstado(), this.solicitarRenderizacao();
  }
  definirFeicoes(e) {
    this.feicoes = Array.isArray(e) ? [...e] : [], this.sincronizarSelecoesComFeicoesValidas(), this.solicitarRenderizacao();
  }
  definirMapasBase(e) {
    this.mapasBase = Array.isArray(e) ? [...e] : [], this.solicitarRenderizacao();
  }
  definirCamadaAtiva(e, t = !0) {
    !e || this.camadaAtivaId === e || (this.camadaAtivaId = e, this.sincronizarCamadaAtivaDOM(), this.salvarLembrancaEstado(), t && this.dispararEvento("ui-camada-selecionada", {
      camadaId: e,
      camada: this.camadas.find((i) => i.id === e)
    }));
  }
  obterCamada(e) {
    return this.camadas.find((t) => t.id === e);
  }
  obterCamadaAtiva() {
    return this.camadas.find((e) => e.id === this.camadaAtivaId);
  }
  obterFeicao(e) {
    return this.feicoes.find((t) => t.id === e);
  }
  obterFeicoesSelecionadas() {
    return this.feicoes.filter((e) => this.selectedFeatureIds.has(e.id));
  }
  adicionarCamada(e) {
    !e || !e.id || (this.camadas.push(e), this.expandedLayers.add(e.id), this.salvarLembrancaEstado(), this.solicitarRenderizacao());
  }
  removerCamada(e) {
    var t;
    this.camadas = this.camadas.filter((i) => i.id !== e), this.feicoes = this.feicoes.filter((i) => i.layerId !== e), this.camadaAtivaId === e && (this.camadaAtivaId = ((t = this.camadas[0]) == null ? void 0 : t.id) ?? null), this.salvarLembrancaEstado(), this.solicitarRenderizacao();
  }
  adicionarFeicao(e) {
    !e || !e.id || (this.feicoes.push(e), this.solicitarRenderizacao());
  }
  atualizarFeicao(e) {
    const t = this.feicoes.findIndex((i) => i.id === e.id);
    t !== -1 && (this.feicoes[t] = { ...this.feicoes[t], ...e }, this.solicitarRenderizacao());
  }
  removerFeicao(e) {
    this.feicoes = this.feicoes.filter((t) => t.id !== e), this.selectedFeatureIds.delete(e), this.notificarMudancaSelecao(), this.solicitarRenderizacao();
  }
  selecionarFeicao(e, t = !1, i = !1) {
    const s = this.obterIdsVisiveisFeicoes();
    if (s.includes(e)) {
      if (i && this.lastClickedFeatureId && s.includes(this.lastClickedFeatureId)) {
        const c = s.indexOf(this.lastClickedFeatureId), l = s.indexOf(e), u = Math.min(c, l), a = Math.max(c, l);
        t || this.selectedFeatureIds.clear();
        for (let n = u; n <= a; n++)
          this.selectedFeatureIds.add(s[n]);
      } else t ? (this.selectedFeatureIds.has(e) ? this.selectedFeatureIds.delete(e) : this.selectedFeatureIds.add(e), this.lastClickedFeatureId = e) : (this.selectedFeatureIds.clear(), this.selectedFeatureIds.add(e), this.lastClickedFeatureId = e);
      this.sincronizarSelecaoDOM(), this.notificarMudancaSelecao();
    }
  }
  selecionarFeicoes(e, t = !1) {
    const i = e || [];
    i.length === this.selectedFeatureIds.size && i.every((l) => this.selectedFeatureIds.has(l)) || (this.selectedFeatureIds.clear(), i.forEach((l) => this.selectedFeatureIds.add(l)), this.sincronizarSelecaoDOM(), t && this.notificarMudancaSelecao());
  }
  limparSelecao(e = !0) {
    this.selectedFeatureIds.size !== 0 && (this.selectedFeatureIds.clear(), this.lastClickedFeatureId = null, this.sincronizarSelecaoDOM(), e && this.notificarMudancaSelecao());
  }
  expandirTodas() {
    this.expandedLayers = new Set(this.camadas.map((e) => e.id)), this.salvarLembrancaEstado(), this.solicitarRenderizacao();
  }
  colapsarTodas() {
    this.expandedLayers.clear(), this.salvarLembrancaEstado(), this.solicitarRenderizacao();
  }
  alternarVisibilidadeTodas() {
    const t = !this.camadas.some((i) => i.visible !== !1);
    this.camadas.forEach((i) => {
      i.visible = t, this.dispararEvento("ui-camada-visibilidade", { camadaId: i.id, visivel: t });
    }), this.salvarLembrancaEstado(), this.solicitarRenderizacao();
  }
  colapsar() {
    this.colapsado = !0;
  }
  expandir() {
    this.colapsado = !1;
  }
  alternarColapso() {
    this.colapsado = !this.colapsado;
  }
  // --- Renderização e Ciclo de Vida ---
  solicitarRenderizacao() {
    this.render();
  }
  dispararEvento(e, t) {
    this.dispatchEvent(
      new CustomEvent(e, {
        detail: t,
        bubbles: !0,
        composed: !0
      })
    );
  }
  render() {
    if (!this.corpoElement) return;
    const e = fe({
      camadas: this.camadas,
      feicoes: this.feicoes,
      camadaAtivaId: this.camadaAtivaId,
      expandedLayers: this.expandedLayers,
      selectedFeatureIds: this.selectedFeatureIds,
      activeSettingsLayerId: this.activeSettingsLayerId,
      editingLayerId: this.editingLayerId,
      editingFeatureId: this.editingFeatureId,
      searchQuery: this.searchQuery
    }), t = this.mostrarMapasBase ? le(this.mapasBase, this.mapaBaseAtivo) : "", i = this.mostrarRodape ? pe(this.camadas, this.feicoes, this.selectedFeatureIds) : "";
    this.corpoElement.innerHTML = `
      ${e}
      ${i}
      ${t}
    `, this.conectarEventosArvore(), this.dragDropManager.bindAll();
  }
  // --- Conexão de Eventos ---
  conectarEventosGerais() {
    const e = this.shadow.getElementById("btn-colapsar");
    e && e.addEventListener("click", () => this.colapsar()), this.btnExpandirFlutuante && this.btnExpandirFlutuante.addEventListener("click", () => this.expandir());
  }
  conectarEventosArvore() {
    const e = this.shadow.getElementById("btn-toggle-all-vis");
    e && e.addEventListener("click", () => this.alternarVisibilidadeTodas());
    const t = this.shadow.getElementById("btn-toggle-all-expand");
    t && t.addEventListener("click", (a) => {
      a.stopPropagation(), this.camadas.length > 0 && this.camadas.every((o) => this.expandedLayers.has(o.id)) ? this.colapsarTodas() : this.expandirTodas();
    });
    const i = this.shadow.getElementById("btn-add-layer");
    i && i.addEventListener("click", () => {
      this.dispararEvento("ui-camada-adicionar", {});
    });
    const s = this.shadow.getElementById("input-layer-search"), c = this.shadow.getElementById("btn-clear-layer-search");
    if (s) {
      const a = ue((n) => {
        this.aplicarFiltroBuscaDOM(n);
      }, 75);
      s.addEventListener("input", (n) => {
        this.searchQuery = n.target.value, a(this.searchQuery);
      });
    }
    c && c.addEventListener("click", () => {
      this.searchQuery = "", s && (s.value = ""), this.aplicarFiltroBuscaDOM(""), s && s.focus();
    }), this.shadow.querySelectorAll("[data-layer-row]").forEach((a) => {
      a.addEventListener("click", (n) => {
        if (n.target.closest(
          "[data-layer-eye], [data-layer-lock], [data-layer-expand], [data-layer-target], [data-layer-fit], [data-layer-settings], input, button"
        ))
          return;
        const r = a.getAttribute("data-layer-row");
        r && this.definirCamadaAtiva(r);
      });
    }), this.shadow.querySelectorAll("[data-layer-expand]").forEach((a) => {
      a.addEventListener("click", (n) => {
        n.stopPropagation();
        const o = a.getAttribute("data-layer-expand");
        if (!o) return;
        this.expandedLayers.has(o) ? this.expandedLayers.delete(o) : this.expandedLayers.add(o);
        const r = a.closest(".ui-layer-group"), h = a.querySelector(".ui-chevron-icon"), f = this.expandedLayers.has(o);
        if (h && h.classList.toggle("open", f), r) {
          const b = r.querySelector(".ui-children-container");
          b && (b.style.display = f ? "block" : "none");
        }
        this.salvarLembrancaEstado();
      });
    }), this.shadow.querySelectorAll("[data-layer-eye]").forEach((a) => {
      a.addEventListener("click", (n) => {
        n.stopPropagation();
        const o = a.getAttribute("data-layer-eye"), r = this.camadas.find((h) => h.id === o);
        if (r) {
          r.visible = r.visible === !1;
          const h = r.visible !== !1;
          a.innerHTML = h ? v.olhoAberto : v.olhoFechado, a.setAttribute("title", h ? "Ocultar Camada" : "Exibir Camada");
          const f = a.closest(".ui-layer-row");
          f && f.classList.toggle("hidden-layer", !h), this.salvarLembrancaEstado(), this.dispararEvento("ui-camada-visibilidade", {
            camadaId: r.id,
            visivel: h
          });
        }
      });
    }), this.shadow.querySelectorAll("[data-layer-lock]").forEach((a) => {
      a.addEventListener("click", (n) => {
        n.stopPropagation();
        const o = a.getAttribute("data-layer-lock"), r = this.camadas.find((h) => h.id === o);
        r && (r.locked = !r.locked, a.innerHTML = r.locked ? v.cadeadoTrancado : "", a.setAttribute("title", r.locked ? "Desbloquear Camada" : "Bloquear Camada"), this.salvarLembrancaEstado(), this.dispararEvento("ui-camada-bloqueio", {
          camadaId: r.id,
          bloqueado: r.locked
        }));
      });
    }), this.shadow.querySelectorAll("[data-layer-fit]").forEach((a) => {
      a.addEventListener("click", (n) => {
        n.stopPropagation();
        const o = a.getAttribute("data-layer-fit");
        o && this.dispararEvento("ui-camada-enquadrar", { camadaId: o });
      });
    }), this.shadow.querySelectorAll("[data-layer-settings]").forEach((a) => {
      a.addEventListener("click", (n) => {
        n.stopPropagation();
        const o = a.getAttribute("data-layer-settings");
        this.activeSettingsLayerId = this.activeSettingsLayerId === o ? null : o, this.solicitarRenderizacao();
      });
    }), this.shadow.querySelectorAll("[data-layer-settings-close]").forEach((a) => {
      a.addEventListener("click", (n) => {
        n.stopPropagation(), this.activeSettingsLayerId = null, this.solicitarRenderizacao();
      });
    });
    const l = (a, n) => {
      const o = this.camadas.find((g) => g.id === a);
      if (!o) return;
      const r = S(n, o.color || "#00E08A");
      o.color = r;
      const h = this.shadow.getElementById(`sample-color-${a}`);
      h && (h.style.backgroundColor = r);
      const f = this.shadow.getElementById(`hex-color-${a}`);
      f && (f.textContent = r.toUpperCase());
      const b = this.shadow.getElementById(`settings-drawer-${a}`);
      b && b.style.setProperty("--drawer-cor-camada", r);
      const x = this.shadow.querySelector(`[data-layer-row="${a}"]`);
      if (x) {
        x.style.setProperty("--layer-active-color", r);
        const g = x.querySelector(".ui-col-colorbar");
        g && (g.style.backgroundColor = r);
      }
      this.salvarLembrancaEstado(), this.dispararEvento("ui-camada-cor", { camadaId: o.id, cor: r });
    };
    this.shadow.querySelectorAll("[data-layer-color-picker]").forEach((a) => {
      const n = a, o = (r) => {
        const h = n.getAttribute("data-layer-color-picker");
        if (!h) return;
        const f = r.target.value;
        l(h, f);
      };
      n.addEventListener("input", o), n.addEventListener("change", o);
    });
    const u = (a, n) => {
      const o = this.camadas.find((f) => f.id === a);
      if (!o) return;
      o.opacity = n;
      const r = this.shadow.getElementById(`badge-op-${a}`);
      r && (r.textContent = `${Math.round(n * 100)}%`);
      const h = this.shadow.querySelector(`[data-layer-opacity-slider="${a}"]`);
      h && parseFloat(h.value) !== n && (h.value = String(n)), this.salvarLembrancaEstado(), this.dispararEvento("ui-camada-opacidade", { camadaId: o.id, opacidade: n });
    };
    this.shadow.querySelectorAll("[data-layer-opacity-slider]").forEach((a) => {
      a.addEventListener("input", (n) => {
        const o = a.getAttribute("data-layer-opacity-slider");
        if (!o) return;
        const r = parseFloat(n.target.value);
        u(o, r);
      });
    }), this.shadow.querySelectorAll("[data-delete-layer]").forEach((a) => {
      let n = null;
      a.addEventListener("click", (o) => {
        o.stopPropagation();
        const r = a.getAttribute("data-delete-layer");
        if (!r) return;
        if (a.classList.contains("confirming"))
          n && clearTimeout(n), this.dispararEvento("ui-camada-excluida", { camadaId: r }), this.removerCamada(r);
        else {
          a.classList.add("confirming");
          const f = a.querySelector(".ui-btn-label");
          f && (f.textContent = "Confirmar Exclusão?"), n = setTimeout(() => {
            a.classList.remove("confirming"), f && (f.textContent = "Excluir Camada");
          }, 3500);
        }
      });
    }), this.shadow.querySelectorAll("[data-layer-target]").forEach((a) => {
      a.addEventListener("click", (n) => {
        n.stopPropagation();
        const o = n, r = a.getAttribute("data-layer-target"), h = this.feicoes.filter((b) => b.layerId === r);
        if (h.length === 0) return;
        h.every((b) => this.selectedFeatureIds.has(b.id)) ? h.forEach((b) => this.selectedFeatureIds.delete(b.id)) : (!o.ctrlKey && !o.metaKey && this.selectedFeatureIds.clear(), h.forEach((b) => this.selectedFeatureIds.add(b.id))), this.lastClickedFeatureId = h[h.length - 1].id, this.sincronizarSelecaoDOM(), this.notificarMudancaSelecao();
      });
    }), this.shadow.querySelectorAll("[data-feat-select]").forEach((a) => {
      a.addEventListener("click", (n) => {
        if (this.editingFeatureId) return;
        const o = n;
        if (o.target.closest(
          "[data-feat-eye], [data-feat-lock], [data-feat-fit], [data-feat-target], input, button"
        ))
          return;
        const h = a.getAttribute("data-feat-select");
        h && this.selecionarFeicao(h, o.ctrlKey || o.metaKey, o.shiftKey);
      });
    }), this.shadow.querySelectorAll("[data-feat-target]").forEach((a) => {
      a.addEventListener("click", (n) => {
        n.stopPropagation();
        const o = n, r = a.getAttribute("data-feat-target");
        r && this.selecionarFeicao(r, o.ctrlKey || o.metaKey, o.shiftKey);
      });
    }), this.shadow.querySelectorAll("[data-feat-eye]").forEach((a) => {
      a.addEventListener("click", (n) => {
        n.stopPropagation();
        const o = a.getAttribute("data-feat-eye"), r = this.feicoes.find((h) => h.id === o);
        if (r) {
          r.visible = r.visible === !1;
          const h = r.visible !== !1;
          a.innerHTML = h ? v.olhoAberto : v.olhoFechado, a.setAttribute("title", h ? "Ocultar Feição" : "Exibir Feição");
          const f = a.closest(".ui-feat-row");
          f && f.classList.toggle("hidden-row", !h), this.dispararEvento("ui-feicao-visibilidade", {
            feicaoId: r.id,
            visivel: h
          });
        }
      });
    }), this.shadow.querySelectorAll("[data-feat-lock]").forEach((a) => {
      a.addEventListener("click", (n) => {
        n.stopPropagation();
        const o = a.getAttribute("data-feat-lock"), r = this.feicoes.find((h) => h.id === o);
        r && (r.locked = !r.locked, a.innerHTML = r.locked ? v.cadeadoTrancado : "", a.setAttribute("title", r.locked ? "Desbloquear Feição" : "Bloquear Feição"), this.dispararEvento("ui-feicao-bloqueio", {
          feicaoId: r.id,
          bloqueado: r.locked
        }));
      });
    }), this.shadow.querySelectorAll("[data-feat-fit]").forEach((a) => {
      a.addEventListener("click", (n) => {
        n.stopPropagation();
        const o = a.getAttribute("data-feat-fit");
        o && this.dispararEvento("ui-feicao-enquadrar", { feicaoId: o });
      });
    }), this.shadow.querySelectorAll("[data-basemap-id]").forEach((a) => {
      a.addEventListener("click", () => {
        const n = a.getAttribute("data-basemap-id");
        !n || this.mapaBaseAtivo === n || (this.mapaBaseAtivo = n, this.shadow.querySelectorAll("[data-basemap-id]").forEach((o) => {
          o.classList.toggle("active", o.getAttribute("data-basemap-id") === n);
        }), this.salvarLembrancaEstado(), this.dispararEvento("ui-mapa-base-alterado", { mapaBaseId: n }));
      });
    }), this.conectarEventosRodape();
  }
  conectarEventosRodape() {
    const e = this.shadow.getElementById("btn-footer-vis");
    e && e.addEventListener("click", () => {
      const a = this.feicoes.filter((r) => this.selectedFeatureIds.has(r.id));
      if (a.length === 0) return;
      const o = !a.some((r) => r.visible !== !1);
      a.forEach((r) => r.visible = o), this.dispararEvento("ui-acao-massa", {
        acao: "visibilidade",
        feicoesIds: a.map((r) => r.id),
        feicoes: a,
        valor: o
      }), this.solicitarRenderizacao();
    });
    const t = this.shadow.getElementById("btn-footer-lock");
    t && t.addEventListener("click", () => {
      const a = this.feicoes.filter((r) => this.selectedFeatureIds.has(r.id));
      if (a.length === 0) return;
      const o = !a.some((r) => r.locked === !0);
      a.forEach((r) => r.locked = o), this.dispararEvento("ui-acao-massa", {
        acao: "bloqueio",
        feicoesIds: a.map((r) => r.id),
        feicoes: a,
        valor: o
      }), this.solicitarRenderizacao();
    });
    const i = this.shadow.getElementById("input-footer-color");
    i && i.addEventListener("change", (a) => {
      const n = a.target.value, o = this.feicoes.filter((r) => this.selectedFeatureIds.has(r.id));
      o.length !== 0 && (o.forEach((r) => {
        r.color = n, r.style = { ...r.style || {}, fillColor: n, strokeColor: n };
      }), this.dispararEvento("ui-acao-massa", {
        acao: "cor",
        feicoesIds: o.map((r) => r.id),
        feicoes: o,
        valor: n
      }), this.solicitarRenderizacao());
    });
    const s = this.shadow.getElementById("select-footer-move");
    s && s.addEventListener("change", (a) => {
      const n = a.target.value;
      if (!n) return;
      const o = this.feicoes.filter((r) => this.selectedFeatureIds.has(r.id));
      o.length !== 0 && (o.forEach((r) => r.layerId = n), this.dispararEvento("ui-acao-massa", {
        acao: "mover",
        feicoesIds: o.map((r) => r.id),
        feicoes: o,
        valor: n
      }), this.solicitarRenderizacao());
    });
    const c = this.shadow.getElementById("btn-footer-new-layer");
    c && c.addEventListener("click", () => {
      this.dispararEvento("ui-camada-adicionar", {});
    });
    const l = this.shadow.getElementById("btn-footer-del");
    l && l.addEventListener("click", () => {
      const a = Array.from(this.selectedFeatureIds);
      if (a.length === 0) return;
      const n = this.feicoes.filter((o) => this.selectedFeatureIds.has(o.id));
      this.feicoes = this.feicoes.filter((o) => !this.selectedFeatureIds.has(o.id)), this.selectedFeatureIds.clear(), this.lastClickedFeatureId = null, this.dispararEvento("ui-acao-massa", {
        acao: "excluir",
        feicoesIds: a,
        feicoes: n
      }), this.notificarMudancaSelecao(), this.solicitarRenderizacao();
    });
    const u = this.shadow.getElementById("btn-footer-clear");
    u && u.addEventListener("click", () => this.limparSelecao());
  }
  conectarTecladoAcessibilidade() {
    this.addEventListener("keydown", (e) => {
      e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.key === "Escape" && this.selectedFeatureIds.size > 0 && (e.preventDefault(), this.limparSelecao());
    });
  }
  // --- Sincronização Cirúrgica de DOM (0ms lag) ---
  sincronizarCamadaAtivaDOM() {
    this.shadow.querySelectorAll("[data-layer-row]").forEach((t) => {
      const s = t.getAttribute("data-layer-row") === this.camadaAtivaId;
      t.classList.toggle("active-drawing-layer", s);
      const c = t.querySelector(".ui-col-name");
      if (c) {
        let l = c.querySelector(".ui-active-badge");
        if (s && !l) {
          l = document.createElement("span"), l.className = "ui-active-badge", l.textContent = "✓ Ativa";
          const u = c.querySelector(".ui-count-chip");
          u ? c.insertBefore(l, u) : c.appendChild(l);
        } else !s && l && l.remove();
      }
    });
  }
  sincronizarSelecaoDOM() {
    this.shadow.querySelectorAll(".ui-feat-row").forEach((f) => {
      const b = f.getAttribute("data-feat-row"), x = b ? this.selectedFeatureIds.has(b) : !1;
      f.classList.toggle("selected-row", x);
      const g = f.querySelector(".ui-target-circle");
      g && g.classList.toggle("selected", x);
    }), this.shadow.querySelectorAll(".ui-layer-group").forEach((f) => {
      const b = f.getAttribute("data-layer-id"), x = this.feicoes.filter((m) => m.layerId === b), g = f.querySelector(".ui-layer-row .ui-target-circle");
      if (g && x.length > 0) {
        const m = x.every((k) => this.selectedFeatureIds.has(k.id)), A = !m && x.some((k) => this.selectedFeatureIds.has(k.id));
        g.classList.toggle("selected", m), g.classList.toggle("partial", A);
      } else g && g.classList.remove("selected", "partial");
    });
    const e = this.feicoes.filter((f) => this.selectedFeatureIds.has(f.id)), t = e.length > 0, i = this.shadow.getElementById("footer-count"), s = this.shadow.getElementById("footer-label");
    i && (i.textContent = String(t ? e.length : this.camadas.length)), s && (s.textContent = t ? e.length > 1 ? "selecionados" : "selecionado" : this.camadas.length > 1 ? "camadas" : "camada");
    const c = this.shadow.querySelector(".ui-footer-metric"), l = Y(e);
    c && (l ? (c.innerHTML = `${v.reguaMetrica} ${l}`, c.style.display = "inline-flex") : c.style.display = "none"), ["btn-footer-vis", "btn-footer-lock", "btn-footer-del"].forEach((f) => {
      const b = this.shadow.getElementById(f);
      b && (b.disabled = !t, b.classList.toggle("disabled", !t));
    });
    const u = this.shadow.querySelector(".ui-footer-move-wrapper");
    u && u.classList.toggle("disabled", !t);
    const a = this.shadow.getElementById("select-footer-move");
    a && (a.disabled = !t);
    const n = this.shadow.querySelector(".ui-footer-color-wrapper");
    n && n.classList.toggle("disabled", !t);
    const o = this.shadow.getElementById("input-footer-color");
    o && (o.disabled = !t);
    let r = this.shadow.getElementById("btn-footer-clear");
    const h = this.shadow.querySelector(".ui-footer-right");
    t && !r && h ? (r = document.createElement("button"), r.id = "btn-footer-clear", r.className = "ui-footer-btn", r.title = "Limpar seleção", r.innerHTML = v.fechar, r.addEventListener("click", () => this.limparSelecao()), h.appendChild(r)) : !t && r && r.remove();
  }
  // --- Auxiliares Internos ---
  aplicarFiltroBuscaDOM(e) {
    const t = (e || "").trim().toLowerCase(), i = this.shadow.getElementById("ui-layer-tree-mount");
    if (!i) return;
    const s = this.shadow.getElementById("btn-clear-layer-search");
    s && (s.style.display = t ? "flex" : "none"), i.querySelectorAll(".ui-layer-group").forEach((l) => {
      const u = l.getAttribute("data-layer-id"), a = this.camadas.find((f) => f.id === u), n = ((a == null ? void 0 : a.name) || "").toLowerCase(), o = l.querySelectorAll(".ui-feat-row");
      if (!t) {
        l.classList.remove("ui-search-hidden"), o.forEach((f) => f.classList.remove("ui-search-hidden"));
        return;
      }
      let r = !1;
      o.forEach((f) => {
        const b = f.getAttribute("data-feat-row"), x = this.feicoes.find((C) => C.id === b), g = ((x == null ? void 0 : x.name) || "").toLowerCase(), m = ((x == null ? void 0 : x.category) || "").toLowerCase(), A = ((x == null ? void 0 : x.type) || "").toLowerCase();
        g.includes(t) || m.includes(t) || A.includes(t) ? (f.classList.remove("ui-search-hidden"), r = !0) : f.classList.add("ui-search-hidden");
      });
      const h = n.includes(t);
      h || r ? (l.classList.remove("ui-search-hidden"), h && !r && o.forEach((f) => f.classList.remove("ui-search-hidden"))) : l.classList.add("ui-search-hidden");
    });
  }
  obterIdsVisiveisFeicoes() {
    const e = [], t = /* @__PURE__ */ new Map();
    for (let i = 0; i < this.feicoes.length; i++) {
      const s = this.feicoes[i];
      t.has(s.layerId) || t.set(s.layerId, []), t.get(s.layerId).push(s);
    }
    for (let i = 0; i < this.camadas.length; i++) {
      const s = this.camadas[i];
      if (this.expandedLayers.has(s.id)) {
        const c = t.get(s.id) || [];
        for (let l = 0; l < c.length; l++)
          e.push(c[l].id);
      }
    }
    return e;
  }
  sincronizarSelecoesComFeicoesValidas() {
    if (this.selectedFeatureIds.size === 0) return;
    const e = new Set(this.feicoes.map((t) => t.id));
    for (const t of this.selectedFeatureIds)
      e.has(t) || this.selectedFeatureIds.delete(t);
  }
  notificarMudancaSelecao() {
    const e = this.feicoes.filter((t) => this.selectedFeatureIds.has(t.id));
    this.dispararEvento("ui-feicoes-selecionadas", {
      feicoesIds: Array.from(this.selectedFeatureIds),
      feicoes: e
    }), e.length === 1 ? this.dispararEvento("ui-feicao-selecionada", {
      feicaoId: e[0].id,
      feicao: e[0]
    }) : e.length === 0 && this.dispararEvento("ui-feicao-selecionada", {
      feicaoId: null,
      feicao: null
    });
  }
}
class ke extends T {
}
class Ee extends T {
}
D("ui-camadas", T);
D("ui-painel-camadas", ke);
D("ui-layer-panel", Ee);
export {
  ge as CamadasDragDropManager,
  v as ICONES,
  J as MAPAS_BASE_PADRAO,
  T as UICamadas,
  Ee as UILayerPanel,
  ke as UIPainelCamadas,
  Q as calcularAreaPoligono,
  K as calcularComprimentoLinha,
  de as calcularDistanciaPontos,
  z as carregarEstadoPersistido,
  L as escapeHtml,
  Y as formatarMetricaFeicoes,
  ve as gerarChaveStorage,
  xe as limparEstadoPersistido,
  ye as reidratarCamadasComOverrides,
  fe as renderizarArvoreCamadas,
  le as renderizarGridMapasBase,
  pe as renderizarRodapeAcoes,
  he as renderizarThumbGeometria,
  be as salvarEstadoPersistido
};
