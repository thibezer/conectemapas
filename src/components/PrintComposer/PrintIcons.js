/* ==========================================================================
   ConecteMapas - PrintIcons
   Ícones de linha (mesmo traço da barra superior do Layout) para o painel de
   propriedades, no lugar de emojis. Sem dependências: só devolve strings SVG.
   ========================================================================== */

const PATHS = {
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  unlock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M9.9 4.2A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.6 3.6M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a10 10 0 0 0 5.4-1.6"/><path d="m2 2 20 20"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  front: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16V5a1 1 0 0 1 1-1h11"/>',
  back: '<rect x="3" y="3" width="13" height="13" rx="2"/><path d="M20 8v11a1 1 0 0 1-1 1H8"/>',
  alignLeft: '<path d="M4 3v18"/><rect x="8" y="6" width="12" height="4" rx="1"/><rect x="8" y="14" width="7" height="4" rx="1"/>',
  alignCenterH: '<path d="M12 3v18"/><rect x="5" y="6" width="14" height="4" rx="1"/><rect x="8" y="14" width="8" height="4" rx="1"/>',
  alignRight: '<path d="M20 3v18"/><rect x="4" y="6" width="12" height="4" rx="1"/><rect x="9" y="14" width="7" height="4" rx="1"/>',
  alignTop: '<path d="M3 4h18"/><rect x="6" y="8" width="4" height="12" rx="1"/><rect x="14" y="8" width="4" height="7" rx="1"/>',
  alignCenterV: '<path d="M3 12h18"/><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="8" width="4" height="8" rx="1"/>',
  alignBottom: '<path d="M3 20h18"/><rect x="6" y="4" width="4" height="12" rx="1"/><rect x="14" y="9" width="4" height="7" rx="1"/>',
  distributeH: '<path d="M4 2v20M20 2v20"/><rect x="7" y="6" width="3" height="12" rx="0.5"/><rect x="14" y="6" width="3" height="12" rx="0.5"/>',
  distributeV: '<path d="M2 4h20M2 20h20"/><rect x="6" y="7" width="12" height="3" rx="0.5"/><rect x="6" y="14" width="12" height="3" rx="0.5"/>',
  settings: '<path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  collapse: '<path d="m6 17 5-5-5-5M13 17l5-5-5-5"/>',
  expand: '<path d="m11 17-5-5 5-5M18 17l-5-5 5-5"/>',
  sheet: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>',
  layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
  hand: '<path d="M8 13V5a1.5 1.5 0 0 1 3 0v6M11 10V3.5a1.5 1.5 0 0 1 3 0V11M14 10.5V5a1.5 1.5 0 0 1 3 0v8M8 13l-1.6-2.4a1.5 1.5 0 0 0-2.5 1.6L7 18a6 6 0 0 0 5 3h1a6 6 0 0 0 6-6v-2"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.4 1 2.5h6c0-1.1.3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
  // Tipos de elemento da prancha
  map: '<path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3z"/><path d="M9 3v15M15 6v15"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5z"/>',
  ruler: '<path d="M3 15 15 3l6 6L9 21z"/><path d="m7 11 2 2M10 8l2 2M13 5l2 2"/>',
  legend: '<path d="M9 6h11M9 12h11M9 18h11"/><rect x="3" y="4" width="3" height="4" rx="0.5"/><rect x="3" y="10" width="3" height="4" rx="0.5"/><rect x="3" y="16" width="3" height="4" rx="0.5"/>',
  table: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
  title: '<path d="M4 7V4h16v3"/><path d="M12 4v16M9 20h6"/>',
  stamp: '<rect x="3" y="13" width="18" height="8" rx="1"/><path d="M3 17h18M12 13v8M8 13V9a4 4 0 0 1 8 0v4"/>',
  frame: '<rect x="3" y="3" width="18" height="18" rx="1"/><rect x="7" y="7" width="10" height="10"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>'
};

/**
 * SVG de linha de 14 px (herda a cor do texto). Nome desconhecido devolve string vazia.
 * @param {string} name Chave de PATHS
 * @returns {string}
 */
export function ppIcon(name) {
  const paths = PATHS[name];
  if (!paths) return '';
  return `<svg class="cm-pp-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

/** Ícone por tipo de elemento da prancha (lista de elementos). */
export function itemTypeIcon(type) {
  const map = {
    map: 'map', inset_map: 'globe', north_arrow: 'compass', scale_bar: 'ruler', legend: 'legend',
    title_block: 'stamp', table_vertices: 'table', text_block: 'sheet', shape: 'frame', image: 'image', label: 'title'
  };
  return ppIcon(map[type] || 'frame');
}
