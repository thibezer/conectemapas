/* ==========================================================================
   ConecteMapas - PrintToolbar
   Responsabilidade Única: Barra superior do Layout de Impressão. Agrupa as ações em
   quatro menus (Prancha, Inserir, Zoom e Exportar) com atalhos de inserção à mostra.
   Alinhamento, duplicação de item, Auto-ABNT e navegação no mapa ficam no painel de
   propriedades: a barra só tem o que vale para a prancha inteira.
   ========================================================================== */

import { PrintExporter } from './PrintExporter.js';
import { PrintItemsManager } from './PrintItemsManager.js';

const svg = (paths) =>
  `<svg class="cm-ptb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const PRINT_ICONS = {
  layout: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>'),
  chevron: svg('<path d="m6 9 6 6 6-6"/>'),
  check: svg('<path d="M20 6 9 17l-5-5"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  map: svg('<path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3z"/><path d="M9 3v15M15 6v15"/>'),
  globe: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18"/>'),
  compass: svg('<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5z"/>'),
  ruler: svg('<path d="M3 15 15 3l6 6L9 21z"/><path d="m7 11 2 2M10 8l2 2M13 5l2 2"/>'),
  legend: svg('<path d="M9 6h11M9 12h11M9 18h11"/><rect x="3" y="4" width="3" height="4" rx="0.5"/><rect x="3" y="10" width="3" height="4" rx="0.5"/><rect x="3" y="16" width="3" height="4" rx="0.5"/>'),
  table: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>'),
  title: svg('<path d="M4 7V4h16v3"/><path d="M12 4v16M9 20h6"/>'),
  notes: svg('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>'),
  stamp: svg('<rect x="3" y="13" width="18" height="8" rx="1"/><path d="M3 17h18M12 13v8M8 13V9a4 4 0 0 1 8 0v4"/>'),
  frame: svg('<rect x="3" y="3" width="18" height="18" rx="1"/><rect x="7" y="7" width="10" height="10"/>'),
  image: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>'),
  undo: svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-4"/>'),
  redo: svg('<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h4"/>'),
  magnet: svg('<path d="M6 3v9a6 6 0 0 0 12 0V3"/><path d="M6 3h4v9a2 2 0 0 0 4 0V3h4"/><path d="M6 7h4M14 7h4"/>'),
  zoomIn: svg('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M11 8v6M8 11h6"/>'),
  zoomOut: svg('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M8 11h6"/>'),
  fit: svg('<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>'),
  download: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>'),
  filePdf: svg('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 15h8"/>'),
  files: svg('<path d="M15 2H8a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"/><path d="M15 2v5h5"/><path d="M4 8v12a2 2 0 0 0 2 2h9"/>'),
  fileImage: svg('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="m8 18 3-3 2 2 3-3"/>'),
  sheetPlus: svg('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M12 12v6M9 15h6"/>'),
  copy: svg('<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16V5a2 2 0 0 1 2-2h11"/>'),
  pencil: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  trash: svg('<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>'),
  close: svg('<path d="M18 6 6 18M6 6l12 12"/>')
};

/** Elementos inseríveis, na ordem do menu Inserir. `quick` = atalho à mostra na barra. */
export const PRINT_INSERT_GROUPS = [
  {
    label: 'Mapas',
    items: [
      { type: 'map', label: 'Mapa principal', icon: 'map', quick: true },
      { type: 'inset_map', label: 'Mapa de localização', icon: 'globe' }
    ]
  },
  {
    label: 'Cartografia',
    items: [
      { type: 'north_arrow', label: 'Norte', icon: 'compass', quick: true },
      { type: 'scale_bar', label: 'Escala', icon: 'ruler', quick: true },
      { type: 'legend', label: 'Legenda', icon: 'legend', quick: true },
      { type: 'table_vertices', label: 'Tabela de vértices', icon: 'table' }
    ]
  },
  {
    label: 'Prancha',
    items: [
      { type: 'label', label: 'Título', icon: 'title', quick: true },
      { type: 'text_block', label: 'Notas', icon: 'notes' },
      { type: 'title_block', label: 'Selo ABNT', icon: 'stamp' },
      { type: 'shape', label: 'Moldura', icon: 'frame' },
      { type: 'image', label: 'Logo', icon: 'image' }
    ]
  }
];

export const PRINT_ZOOM_PRESETS = [0.5, 1, 2];
export const PRINT_EXPORT_DPIS = [
  { value: 300, label: '300 DPI · plotagem' },
  { value: 150, label: '150 DPI · rápido' }
];

const menuItem = (action, icon, label, extra = '') =>
  `<button type="button" class="cm-ptb-menu-item" role="menuitem" data-ptb-action="${action}">${icon ? PRINT_ICONS[icon] : '<span class="cm-ptb-icon"></span>'}<span class="cm-ptb-menu-label">${label}</span>${extra}</button>`;

const shortcut = (key) => `<kbd class="cm-ptb-kbd">${key}</kbd>`;

export class PrintToolbar {
  /** Menu suspenso: botão + lista. O conteúdo da lista pode ser reescrito sem perder o estado de aberto. */
  static dropdown(id, triggerHTML, menuHTML, { triggerClass = '', align = 'left', title = '' } = {}) {
    return `
      <div class="cm-ptb-dd" data-ptb-dd="${id}">
        <button type="button" class="cm-print-tool-btn cm-ptb-trigger ${triggerClass}" id="btn-ptb-${id}" aria-haspopup="menu" aria-expanded="false" title="${title}">
          ${triggerHTML}${PRINT_ICONS.chevron}
        </button>
        <div class="cm-ptb-menu cm-ptb-menu-${align}" role="menu" id="cm-ptb-menu-${id}">${menuHTML}</div>
      </div>
    `;
  }

  static renderInsertMenu() {
    return PRINT_INSERT_GROUPS.map(g => `
      <div class="cm-ptb-menu-heading">${g.label}</div>
      ${g.items.map(it => menuItem(`insert:${it.type}`, it.icon, it.label)).join('')}
    `).join('');
  }

  static renderZoomMenu() {
    return `
      ${menuItem('zoom:in', 'zoomIn', 'Aproximar', shortcut('+'))}
      ${menuItem('zoom:out', 'zoomOut', 'Afastar', shortcut('−'))}
      ${menuItem('zoom:fit', 'fit', 'Enquadrar folha', shortcut('0'))}
      <div class="cm-ptb-menu-divider"></div>
      ${PRINT_ZOOM_PRESETS.map(z => menuItem(`zoom:${z}`, null, `${Math.round(z * 100)}%`)).join('')}
    `;
  }

  static renderExportMenu(composer) {
    const total = composer.sheetsManager?.sheets?.length || 1;
    const dpi = composer.exportDpi;
    return `
      ${menuItem('export:pdf', 'filePdf', 'PDF desta prancha')}
      ${menuItem('export:all-pdf', 'files', `PDF de todas (${total})`)}
      ${menuItem('export:png', 'fileImage', 'PNG desta prancha')}
      <div class="cm-ptb-menu-divider"></div>
      <div class="cm-ptb-menu-heading">Resolução</div>
      ${PRINT_EXPORT_DPIS.map(d => `
        <button type="button" class="cm-ptb-menu-item" role="menuitemradio" aria-checked="${d.value === dpi}" data-ptb-action="dpi:${d.value}" data-ptb-keep-open>
          ${d.value === dpi ? PRINT_ICONS.check : '<span class="cm-ptb-icon"></span>'}<span class="cm-ptb-menu-label">${d.label}</span>
        </button>
      `).join('')}
    `;
  }

  static render(composer) {
    const quick = PRINT_INSERT_GROUPS.flatMap(g => g.items).filter(it => it.quick);
    return `
      <header class="cm-print-topbar" role="toolbar" aria-label="Layout de impressão">
        <span class="cm-print-title">${PRINT_ICONS.layout}<span class="cm-tb-label">Layout</span></span>
        <span class="cm-ptb-sep"></span>

        <div id="cm-print-sheets-controls" class="cm-ptb-group"></div>
        <span class="cm-ptb-sep"></span>

        <div class="cm-ptb-group" role="group" aria-label="Inserir elemento">
          ${this.dropdown('insert', `${PRINT_ICONS.plus}<span class="cm-tb-label">Inserir</span>`, this.renderInsertMenu(), { triggerClass: 'cm-ptb-outline', title: 'Inserir elemento na prancha' })}
          <span class="cm-ptb-quick">
            ${quick.map(it => `<button type="button" class="cm-print-tool-btn cm-print-icon-btn" data-ptb-action="insert:${it.type}" title="Inserir ${it.label.toLowerCase()}" aria-label="Inserir ${it.label.toLowerCase()}">${PRINT_ICONS[it.icon]}</button>`).join('')}
          </span>
        </div>
        <span class="cm-ptb-sep"></span>

        <div class="cm-ptb-group" role="group" aria-label="Histórico e guias">
          <button type="button" class="cm-print-tool-btn cm-print-icon-btn" id="btn-print-undo" title="Desfazer (Ctrl+Z)" aria-label="Desfazer">${PRINT_ICONS.undo}</button>
          <button type="button" class="cm-print-tool-btn cm-print-icon-btn" id="btn-print-redo" title="Refazer (Ctrl+Y)" aria-label="Refazer">${PRINT_ICONS.redo}</button>
          <button type="button" class="cm-print-tool-btn cm-print-icon-btn active" id="btn-toggle-smart-guides" title="Guias inteligentes (U)" aria-label="Guias inteligentes" aria-pressed="true">${PRINT_ICONS.magnet}</button>
        </div>

        <div class="cm-ptb-spacer"></div>

        ${this.dropdown('zoom', `<span id="cm-print-zoom-val">100%</span>`, this.renderZoomMenu(), { triggerClass: 'cm-ptb-outline cm-ptb-zoom', align: 'right', title: 'Zoom da prancheta (Ctrl + roda do mouse)' })}
        ${this.dropdown('export', `${PRINT_ICONS.download}<span>Exportar</span>`, this.renderExportMenu(composer), { triggerClass: 'cm-ptb-primary', align: 'right', title: 'Exportar em PDF ou PNG' })}
        <button type="button" id="btn-close-print-composer" class="cm-print-tool-btn cm-print-icon-btn cm-print-close-btn" title="Fechar layout" aria-label="Fechar layout">${PRINT_ICONS.close}</button>
      </header>
    `;
  }

  /** Executa uma ação da barra (`grupo:valor`). Devolve false para ações desconhecidas. */
  static runAction(composer, action) {
    const sep = action.indexOf(':');
    const kind = action.slice(0, sep);
    const value = action.slice(sep + 1);
    const engine = composer.canvasEngine;
    switch (kind) {
      case 'insert': composer.insertItem(value); return true;
      case 'zoom':
        if (value === 'in') engine.zoomIn();
        else if (value === 'out') engine.zoomOut();
        else if (value === 'fit') engine.zoomFit();
        else engine.setZoom(Number(value));
        return true;
      case 'export':
        if (value === 'pdf') PrintExporter.exportToPDF(composer, composer.exportDpi);
        else if (value === 'all-pdf') PrintExporter.exportAllSheetsToPDF(composer, composer.exportDpi);
        else if (value === 'png') PrintExporter.exportToPNG(composer, composer.exportDpi);
        return true;
      case 'dpi':
        composer.exportDpi = Number(value);
        this.refreshMenu(composer, 'export');
        return true;
      case 'sheet': composer.sheetsManager.runMenuAction(value); return true;
      default: return false;
    }
  }

  /** Reescreve o conteúdo de um menu (contagem de pranchas, DPI marcado) */
  static refreshMenu(composer, id) {
    const menu = document.getElementById(`cm-ptb-menu-${id}`);
    if (!menu) return;
    if (id === 'export') menu.innerHTML = this.renderExportMenu(composer);
  }

  static closeMenus(root = document) {
    root.querySelectorAll('.cm-ptb-dd.open').forEach(dd => {
      dd.classList.remove('open');
      dd.querySelector('.cm-ptb-trigger')?.setAttribute('aria-expanded', 'false');
    });
  }

  static bind(composer) {
    const bar = document.querySelector('#cm-print-composer-modal .cm-print-topbar');
    if (!bar) return;

    // Delegação: os menus (inclusive o de pranchas) são reescritos sem perder os eventos
    bar.addEventListener('click', (e) => {
      const trigger = e.target.closest('.cm-ptb-trigger');
      if (trigger) {
        const dd = trigger.closest('.cm-ptb-dd');
        const willOpen = !dd.classList.contains('open');
        this.closeMenus(bar);
        if (willOpen) {
          if (dd.dataset.ptbDd === 'export') this.refreshMenu(composer, 'export');
          dd.classList.add('open');
          trigger.setAttribute('aria-expanded', 'true');
        }
        return;
      }
      const actionEl = e.target.closest('[data-ptb-action]');
      if (actionEl) {
        if (!actionEl.hasAttribute('data-ptb-keep-open')) this.closeMenus(bar);
        this.runAction(composer, actionEl.dataset.ptbAction);
      }
    });

    document.getElementById('btn-close-print-composer')?.addEventListener('click', () => composer.close());
    document.getElementById('btn-print-undo')?.addEventListener('click', () => composer.undo());
    document.getElementById('btn-print-redo')?.addEventListener('click', () => composer.redo());
    document.getElementById('btn-toggle-smart-guides')?.addEventListener('click', () => composer.canvasEngine.toggleSmartGuides());

    // Clique fora ou Esc fecham o menu aberto (o Esc não chega a desmarcar o item da prancha)
    document.addEventListener('pointerdown', (e) => {
      if (!e.target.closest?.('.cm-ptb-dd')) this.closeMenus(bar);
    });
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !bar.querySelector('.cm-ptb-dd.open')) return;
      e.stopImmediatePropagation();
      this.closeMenus(bar);
    }, true);
  }

  /** Itens do menu de pranchas: lista para trocar e ações sobre a prancha ativa */
  static renderSheetsMenu(sheets, activeSheetId) {
    const esc = PrintItemsManager.escapeHtml;
    return `
      ${sheets.map((s, i) => `
        <button type="button" class="cm-ptb-menu-item" role="menuitemradio" aria-checked="${s.id === activeSheetId}" data-ptb-action="sheet:switch=${s.id}">
          ${s.id === activeSheetId ? PRINT_ICONS.check : '<span class="cm-ptb-icon"></span>'}
          <span class="cm-ptb-menu-label">${String(i + 1).padStart(2, '0')} · ${esc(s.name)}</span>
        </button>
      `).join('')}
      <div class="cm-ptb-menu-divider"></div>
      ${menuItem('sheet:new', 'sheetPlus', 'Nova prancha')}
      ${menuItem('sheet:duplicate', 'copy', 'Duplicar prancha')}
      ${menuItem('sheet:rename', 'pencil', 'Renomear')}
      ${menuItem('sheet:delete', 'trash', 'Excluir')}
    `;
  }
}
