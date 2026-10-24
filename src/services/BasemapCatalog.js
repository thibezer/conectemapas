/* ==========================================================================
   ConecteMapas - BasemapCatalog
   Responsabilidade Única: lista única de mapas de fundo usada pelo mapa principal
   (CanvasMapEngine) e pelas pranchas (PrintComposer). Sem DOM nem Leaflet: quem
   monta a camada lê `tiles` daqui.
   ========================================================================== */

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';

/**
 * `exportable`: os tiles podem ser lidos no canvas da exportação (CORS liberado).
 * `background`: cor de fundo do mapa enquanto os tiles carregam (ou sem tiles).
 */
export const BASEMAPS = [
  {
    id: 'none', name: 'Vazio (branco)', icon: '⚪', tiles: [], background: '#ffffff', exportable: true
  },
  {
    id: 'google_satelite', name: 'Google Híbrido', icon: '🛰️', exportable: false,
    tiles: [{ url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', maxNativeZoom: 20, attribution: '© Google Maps' }]
  },
  {
    id: 'google_satelite_puro', name: 'Google Satélite', icon: '🛰️', exportable: false,
    tiles: [{ url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', maxNativeZoom: 20, attribution: '© Google Maps' }]
  },
  {
    id: 'satelite', name: 'Esri Satélite', icon: '🛰️', exportable: true,
    tiles: [{ url: `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, maxNativeZoom: 18, attribution: 'Esri World Imagery' }]
  },
  {
    id: 'osm', name: 'OpenStreetMap', icon: '🗺️', exportable: true,
    tiles: [{ url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', maxNativeZoom: 19, attribution: '© OpenStreetMap' }]
  },
  {
    id: 'esri_light', name: 'Esri Claro', icon: '☀️', exportable: true, background: '#f4f4f2',
    tiles: [{ url: `${ESRI}/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`, maxNativeZoom: 16, attribution: 'Esri Light Gray' }]
  },
  {
    id: 'dark', name: 'Esri Escuro', icon: '🌙', exportable: true, background: '#1f1f1f',
    tiles: [
      { url: `${ESRI}/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`, maxNativeZoom: 16, attribution: 'Esri Dark Gray' },
      { url: `${ESRI}/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`, maxNativeZoom: 16 }
    ]
  },
  {
    id: 'relevo', name: 'Esri Relevo', icon: '⛰️', exportable: true,
    tiles: [{ url: `${ESRI}/World_Topo_Map/MapServer/tile/{z}/{y}/{x}`, maxNativeZoom: 19, attribution: 'Esri World Topo' }]
  },
  {
    id: 'topografia', name: 'OpenTopoMap', icon: '⛰️', exportable: true,
    tiles: [{ url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', maxNativeZoom: 17, attribution: 'OpenTopoMap' }]
  }
];

/** Chaves antigas gravadas em pranchas e projetos -> chave atual */
const ALIASES = {
  branco: 'none',
  cartodb_positron: 'esri_light',
  light: 'esri_light',
  cartodb_dark: 'dark',
  esri_dark: 'dark',
  topography: 'topografia'
};

const BY_ID = new Map(BASEMAPS.map(b => [b.id, b]));

export const BasemapCatalog = {
  list() {
    return BASEMAPS;
  },

  /** Chave normalizada (aceita as antigas); desconhecida ou vazia vira `fallback` */
  normalize(id, fallback = 'satelite') {
    if (id === null || id === undefined || id === '') return fallback;
    const key = ALIASES[id] || id;
    return BY_ID.has(key) ? key : fallback;
  },

  get(id, fallback = 'satelite') {
    return BY_ID.get(this.normalize(id, fallback)) || BY_ID.get(fallback);
  },

  isExportable(id) {
    return this.get(id).exportable === true;
  },

  backgroundOf(id) {
    return this.get(id).background || '#f0f3f5';
  }
};
