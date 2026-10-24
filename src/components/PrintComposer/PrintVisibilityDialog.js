/* ==========================================================================
   ConecteMapas - PrintVisibilityDialog
   Responsabilidade Única: janela Visibilidade/Gráficos (atalho V V, como no Revit) do
   mapa selecionado na prancha. Cada aba edita uma parte da vista (PrintViewEdits) via
   composer.updateMapView, que grava o histórico e redesenha mapa e legenda.
   A marcação é gerada por funções estáticas, testáveis no Node.
   ========================================================================== */

import { PrintItemsManager } from './PrintItemsManager.js';
import { PrintViewResolver, PEN_WIDTHS_MM, LINE_PATTERNS, FILL_PATTERNS } from './PrintViewResolver.js';
import { PrintViewEdits } from './PrintViewEdits.js';

const esc = (s) => PrintItemsManager.escapeHtml(s);
const fmtMm = (v) => String(Math.round(v * 100) / 100).replace('.', ',');

export const VV_TABS = [
  { id: 'layers', label: 'Camadas' },
  { id: 'labels', label: 'Rótulos' },
  { id: 'filters', label: 'Filtros' },
  { id: 'elements', label: 'Feições' }
];

export class PrintVisibilityDialog {
  constructor(composer) {
    this.composer = composer;
    this.state = { itemId: null, tab: 'layers', query: '' };
    this.root = null;
  }

  isOpen() {
    return Boolean(this.root && !this.root.hidden);
  }

  /** Abre para o mapa indicado, o selecionado ou o primeiro mapa da prancha */
  open(itemId = null) {
    const maps = PrintVisibilityDialog.mapItems(this.composer.items);
    if (!maps.length) return false;
    const selected = this.composer.items.find(i => i.id === (itemId || this.composer.selectedItemId));
    this.state.itemId = (selected && selected.type === 'map' ? selected : maps[0]).id;
    if (!this.root) this.mount();
    this.root.hidden = false;
    this.refresh();
    this.root.querySelector('.cm-vv-dialog')?.focus();
    return true;
  }

  close() {
    if (this.root) this.root.hidden = true;
  }

  mount() {
    const host = document.getElementById('cm-print-composer-modal') || document.body;
    this.root = document.createElement('div');
    this.root.className = 'cm-vv-overlay';
    this.root.hidden = true;
    host.appendChild(this.root);
    this.bind();
  }

  /** Reconstrói a janela (troca de aba ou de mapa, desfazer/refazer) */
  refresh() {
    if (!this.root || this.root.hidden) return;
    const item = this.currentItem();
    if (!item) { this.close(); return; }
    const scroller = this.root.querySelector('.cm-vv-body');
    const prevScroll = scroller?.scrollTop || 0;
    this.root.innerHTML = PrintVisibilityDialog.render(this.composer, item, this.state);
    const body = this.root.querySelector('.cm-vv-body');
    if (body) body.scrollTop = prevScroll;
    this.applySearch();
  }

  currentItem() {
    return this.composer.items.find(i => i.id === this.state.itemId && i.type === 'map') || null;
  }

  // ------------------------------------------------------------------ marcação
  static mapItems(items = []) {
    return items.filter(i => i.type === 'map');
  }

  static render(composer, item, state) {
    const view = PrintViewResolver.effectiveView(item, composer.library);
    const maps = this.mapItems(composer.items);
    const readOnly = composer.readOnly === true;
    const locked = item.locked === true || readOnly;
    const tab = VV_TABS.some(t => t.id === state.tab) ? state.tab : 'layers';
    const body = this.renderTab(tab, composer, item, view, locked);
    return `
      <div class="cm-vv-dialog" role="dialog" aria-modal="true" aria-label="Visibilidade e gráficos" tabindex="-1">
        <div class="cm-vv-header">
          <div class="cm-vv-title">
            <strong>Visibilidade/Gráficos</strong>
            ${maps.length > 1 ? `
              <select class="cm-native-select cm-vv-map-select" data-vv-map aria-label="Mapa">
                ${maps.map(m => `<option value="${esc(m.id)}" ${m.id === item.id ? 'selected' : ''}>${esc(m.name || 'Mapa')}</option>`).join('')}
              </select>
            ` : `<span class="cm-vv-map-name">${esc(item.name || 'Mapa')}</span>`}
          </div>
          <button type="button" class="cm-vv-close" data-vv-close aria-label="Fechar" title="Fechar (Esc)">✕</button>
        </div>
        <div class="cm-vv-tabs" role="tablist">
          ${VV_TABS.map(t => `<button type="button" role="tab" class="cm-vv-tab ${t.id === tab ? 'is-active' : ''}" aria-selected="${t.id === tab}" data-vv-tab="${t.id}">${t.label}</button>`).join('')}
        </div>
        ${readOnly ? '<div class="cm-vv-note">🔒 Prancha só para visualização: outro operador está editando.</div>'
          : locked ? '<div class="cm-vv-note">🔒 Mapa bloqueado: desbloqueie na lista de elementos para mudar a vista.</div>' : ''}
        ${view.followProject ? '<div class="cm-vv-note cm-vv-note--info">Este mapa ainda espelha o mapa principal. A primeira alteração aqui o torna independente.</div>' : ''}
        <div class="cm-vv-body">${body}</div>
        <div class="cm-vv-footer">
          <span class="cm-vv-hint">As mudanças valem só para este mapa. Ctrl+Z desfaz.</span>
          <button type="button" class="cm-vv-btn cm-vv-btn--primary" data-vv-close>Concluir</button>
        </div>
      </div>
    `;
  }

  static renderTab(tab, composer, item, view, locked) {
    if (tab === 'layers') return this.renderLayersTab(composer, item, view, locked);
    return '<div class="cm-vv-empty">Em breve.</div>';
  }

  /** Amostra do gráfico (SVG pequeno) */
  static swatch(g) {
    const color = (c, fb) => (c && c !== 'none' ? PrintItemsManager.sanitizeColor(c, fb) : 'none');
    const stroke = color(g.stroke.color, '#000000');
    const sw = g.stroke.widthMm > 0 && stroke !== 'none' ? Math.min(3, Math.max(1, g.stroke.widthMm * 4)) : 0;
    const dash = g.stroke.dashMm ? `stroke-dasharray="${g.stroke.dashMm.map(n => Math.max(1, n * 2)).join(' ')}"` : '';
    if (g.kind === 'line') {
      return `<svg class="cm-vv-swatch" viewBox="0 0 28 14" aria-hidden="true"><line x1="2" y1="7" x2="26" y2="7" stroke="${stroke === 'none' ? '#888' : stroke}" stroke-width="${Math.max(1.5, sw)}" ${dash}/></svg>`;
    }
    if (g.kind === 'point' || g.kind === 'text') {
      const fill = color(g.fill.color, '#00E08A');
      return `<svg class="cm-vv-swatch" viewBox="0 0 28 14" aria-hidden="true"><circle cx="14" cy="7" r="4.5" fill="${fill === 'none' ? stroke : fill}" stroke="#000" stroke-width="1"/></svg>`;
    }
    const fill = color(g.fill.color, '#00E08A');
    const hatch = g.fill.pattern && !['solido', 'nenhum'].includes(g.fill.pattern);
    return `<svg class="cm-vv-swatch" viewBox="0 0 28 14" aria-hidden="true">
      <rect x="2" y="2" width="24" height="10" fill="${fill === 'none' || hatch ? 'none' : fill}" fill-opacity="${fill === 'none' ? 0 : g.fill.opacity}" stroke="${stroke}" stroke-width="${sw}" ${dash}/>
      ${hatch && fill !== 'none' ? `<path d="M4 12 L12 2 M10 12 L18 2 M16 12 L24 2" stroke="${fill}" stroke-width="1"/>` : ''}
    </svg>`;
  }

  /** Células de gráficos (traço, preenchimento, meio-tom) de uma linha */
  static graphicsCells(g, ov, disabled) {
    const o = ov || {};
    const dis = disabled ? 'disabled' : '';
    const mark = (cond) => (cond ? 'is-overridden' : '');
    const hex = (c, fb) => (PrintItemsManager.parseColor(c) || { hex: fb }).hex;
    const strokeOv = o.stroke || {};
    const fillOv = o.fill || {};
    const penOptions = [
      `<option value="" ${strokeOv.widthMm === undefined ? 'selected' : ''}>Herdar</option>`,
      ...PEN_WIDTHS_MM.map(w => `<option value="${w}" ${strokeOv.widthMm === w ? 'selected' : ''}>${fmtMm(w)} mm</option>`),
      `<option value="0" ${strokeOv.widthMm === 0 ? 'selected' : ''}>Sem traço</option>`
    ].join('');
    const patternOptions = [
      `<option value="" ${!strokeOv.pattern ? 'selected' : ''}>Herdar</option>`,
      ...Object.entries(LINE_PATTERNS).map(([id, p]) => `<option value="${id}" ${strokeOv.pattern === id ? 'selected' : ''}>${p.label}</option>`)
    ].join('');
    const fillOptions = [
      `<option value="" ${!fillOv.pattern ? 'selected' : ''}>Herdar</option>`,
      ...Object.entries(FILL_PATTERNS).map(([id, label]) => `<option value="${id}" ${fillOv.pattern === id ? 'selected' : ''}>${label}</option>`)
    ].join('');
    const strokeColor = g.stroke.color === 'none' ? '#000000' : hex(g.stroke.color, '#000000');
    const fillColor = g.fill.color === 'none' ? '#ffffff' : hex(g.fill.color, '#ffffff');
    return `
      <td class="cm-vv-cell ${mark(strokeOv.color || strokeOv.widthMm !== undefined || strokeOv.pattern)}">
        <div class="cm-vv-inline">
          <input type="color" class="cm-vv-color" data-gfx="stroke.color" value="${strokeColor}" ${dis} aria-label="Cor do traço" title="Cor do traço" />
          <select class="cm-native-select cm-vv-select" data-gfx="stroke.widthMm" ${dis} aria-label="Espessura do traço" title="Pena (atual: ${fmtMm(g.stroke.widthMm)} mm)">${penOptions}</select>
          <select class="cm-native-select cm-vv-select" data-gfx="stroke.pattern" ${dis} aria-label="Padrão do traço">${patternOptions}</select>
        </div>
      </td>
      <td class="cm-vv-cell ${mark(fillOv.color || fillOv.opacity !== undefined || fillOv.pattern)}">
        <div class="cm-vv-inline">
          <input type="color" class="cm-vv-color" data-gfx="fill.color" value="${fillColor}" ${dis} aria-label="Cor do preenchimento" title="Cor do preenchimento" />
          <input type="number" class="cm-vertex-input cm-vv-num" data-gfx="fill.opacity" min="0" max="100" step="5" value="${fillOv.opacity !== undefined ? Math.round(fillOv.opacity * 100) : ''}" placeholder="${Math.round((g.fill.opacity || 0) * 100)}" ${dis} aria-label="Opacidade do preenchimento (%)" title="Opacidade (%)" />
          <select class="cm-native-select cm-vv-select" data-gfx="fill.pattern" ${dis} aria-label="Padrão do preenchimento">${fillOptions}</select>
        </div>
      </td>
      <td class="cm-vv-cell cm-vv-center ${mark(o.halftone)}">
        <input type="checkbox" data-gfx="halftone" ${o.halftone ? 'checked' : ''} ${dis} aria-label="Meio-tom" title="Meio-tom: apaga a camada sem ocultá-la" />
      </td>
    `;
  }

  static renderLayersTab(composer, item, view, locked) {
    const layers = composer.layers || [];
    if (!layers.length) return '<div class="cm-vv-empty">O projeto ainda não tem camadas.</div>';
    const counts = new Map();
    (composer.features || []).forEach(f => counts.set(f.layerId, (counts.get(f.layerId) || 0) + 1));
    const rows = layers.map(l => this.layerRow(composer, l, view, locked, counts.get(l.id) || 0)).join('');
    const dis = locked ? 'disabled' : '';
    return `
      <div class="cm-vv-toolbar">
        <input type="search" class="cm-vertex-input cm-vv-search" data-vv-search placeholder="Buscar camada…" aria-label="Buscar camada" />
        <button type="button" class="cm-vv-btn" data-vv-action="show-all" ${dis}>Mostrar todas</button>
        <button type="button" class="cm-vv-btn" data-vv-action="hide-all" ${dis}>Ocultar todas</button>
        <button type="button" class="cm-vv-btn" data-vv-action="copy-project" ${dis} title="Liga e desliga as camadas como estão no mapa principal">Copiar do mapa principal</button>
      </div>
      <table class="cm-vv-table">
        <thead>
          <tr>
            <th class="cm-vv-center">Visível</th>
            <th>Camada</th>
            <th>Traço</th>
            <th>Preenchimento</th>
            <th class="cm-vv-center">Meio-tom</th>
            <th title="Faixa de escala em que a camada aparece (vazio = sempre)">Escala 1: mín. / máx.</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  static layerRow(composer, layer, view, locked, count) {
    const ov = view.layers?.[layer.id] || null;
    const g = PrintViewResolver.layerPreview(layer, composer.features, view);
    const visible = ov?.visible !== false;
    const dis = locked ? 'disabled' : '';
    const has = PrintViewEdits.hasOverride(view, 'layer', layer.id);
    return `
      <tr class="cm-vv-row ${visible ? '' : 'is-hidden'}" data-row-kind="layer" data-row-id="${esc(layer.id)}" data-name="${esc(String(layer.name || '').toLowerCase())}">
        <td class="cm-vv-cell cm-vv-center ${ov?.visible === false ? 'is-overridden' : ''}">
          <input type="checkbox" data-gfx="visible" ${visible ? 'checked' : ''} ${dis} aria-label="Visível: ${esc(layer.name)}" />
        </td>
        <td class="cm-vv-cell cm-vv-name">
          ${this.swatch(g)}
          <span class="cm-vv-name-text" title="${esc(layer.name)}">${esc(layer.name || 'Camada')}</span>
          <span class="cm-vv-count" title="${count} feições">${count}</span>
        </td>
        ${this.graphicsCells(g, ov, locked)}
        <td class="cm-vv-cell ${ov?.minScale || ov?.maxScale ? 'is-overridden' : ''}">
          <div class="cm-vv-inline">
            <input type="number" class="cm-vertex-input cm-vv-num cm-vv-num--wide" data-gfx="minScale" min="0" step="100" value="${ov?.minScale || ''}" placeholder="—" ${dis} aria-label="Escala mínima (1:)" title="Aparece a partir de 1:" />
            <input type="number" class="cm-vertex-input cm-vv-num cm-vv-num--wide" data-gfx="maxScale" min="0" step="100" value="${ov?.maxScale || ''}" placeholder="—" ${dis} aria-label="Escala máxima (1:)" title="Aparece até 1:" />
          </div>
        </td>
        <td class="cm-vv-cell cm-vv-center">
          <button type="button" class="cm-vv-reset" data-vv-reset ${has && !locked ? '' : 'disabled'} title="Voltar ao estilo do projeto" aria-label="Voltar ${esc(layer.name)} ao estilo do projeto">↺</button>
        </td>
      </tr>
    `;
  }

  /** Marcação de uma linha, para trocar só ela depois de uma edição */
  static rowHtml(composer, item, kind, id) {
    const view = PrintViewResolver.effectiveView(item, composer.library);
    if (kind === 'layer') {
      const layer = (composer.layers || []).find(l => String(l.id) === String(id));
      if (!layer) return null;
      const count = (composer.features || []).filter(f => f.layerId === layer.id).length;
      return this.layerRow(composer, layer, view, item.locked === true || composer.readOnly === true, count);
    }
    return null;
  }

  /** Valor de um campo da janela -> valor gravado (null = herda) */
  static parseField(input) {
    const path = input.dataset.gfx;
    if (input.type === 'checkbox') {
      if (path === 'visible' || path === 'show' || path === 'enabled') return input.checked;
      return input.checked ? true : null; // meio-tom, halo: desmarcado volta a herdar
    }
    const raw = input.value;
    if (raw === '' || raw === null) return null;
    if (path === 'fill.opacity') return Math.min(100, Math.max(0, Number(raw))) / 100;
    if (path === 'stroke.widthMm' || path === 'sizePt') return Number(raw);
    if (path === 'minScale' || path === 'maxScale') {
      const n = Math.round(Number(raw));
      return n > 0 ? n : null;
    }
    return raw;
  }

  // ------------------------------------------------------------------ eventos
  bind() {
    const root = this.root;

    root.addEventListener('click', (e) => {
      const t = e.target;
      if (t === root || t.closest('[data-vv-close]')) { this.close(); return; }
      const tab = t.closest('[data-vv-tab]');
      if (tab) {
        this.state.tab = tab.dataset.vvTab;
        this.state.query = '';
        this.refresh();
        return;
      }
      const action = t.closest('[data-vv-action]');
      if (action && !action.disabled) { this.runAction(action.dataset.vvAction, action); return; }
      const reset = t.closest('[data-vv-reset]');
      if (reset && !reset.disabled) {
        const row = reset.closest('[data-row-kind]');
        this.edit(row, (view) => PrintViewEdits.reset(view, row.dataset.rowKind, row.dataset.rowId), 'Voltar ao projeto', null, true);
      }
    });

    const onField = (e, committed) => {
      const input = e.target.closest?.('[data-gfx]');
      if (!input || input.disabled) return;
      // Cores e números: aplica ao vivo ('input') e só reconstrói a linha ao confirmar ('change')
      if (!committed && !(input.type === 'color' || input.type === 'range')) return;
      const row = input.closest('[data-row-kind]');
      if (!row) return;
      const kind = row.dataset.rowKind;
      const id = row.dataset.rowId;
      const path = input.dataset.gfx;
      const value = PrintVisibilityDialog.parseField(input);
      this.edit(row, (view) => {
        if (path === 'visible') return PrintViewEdits.setVisible(view, kind, id, value);
        if (kind === 'filter' && path === 'enabled') return PrintViewEdits.setFilterEnabled(view, id, value);
        return PrintViewEdits.setField(view, kind, id, path, value);
      }, this.actionName(kind, path), `vv:${kind}:${id}:${path}`, committed, input);
    };
    root.addEventListener('input', (e) => {
      if (e.target.matches?.('[data-vv-search]')) {
        this.state.query = e.target.value;
        this.applySearch();
        return;
      }
      onField(e, false);
    });
    root.addEventListener('change', (e) => {
      if (e.target.matches?.('[data-vv-map]')) {
        this.state.itemId = e.target.value;
        this.refresh();
        return;
      }
      onField(e, true);
    });
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        this.close();
      }
    });
  }

  actionName(kind, path) {
    const what = { layer: 'Camada', label: 'Rótulo', filter: 'Filtro', element: 'Feição' }[kind] || 'Vista';
    if (path === 'visible') return `${what}: visibilidade`;
    return `${what}: gráficos`;
  }

  /**
   * Aplica uma edição à vista do mapa. `committed` reconstrói a linha (ou a aba inteira,
   * quando `full`) e devolve o foco ao mesmo campo.
   */
  edit(row, mutate, actionName, coalesceKey, committed, input = null, full = false) {
    const item = this.currentItem();
    if (!item) return;
    const ok = this.composer.updateMapView(item.id, mutate, actionName, { coalesceKey });
    if (!ok || !committed) return;
    if (full || !row) { this.refresh(); return; }
    const html = PrintVisibilityDialog.rowHtml(this.composer, item, row.dataset.rowKind, row.dataset.rowId);
    if (!html) { this.refresh(); return; }
    const tpl = document.createElement('tbody');
    tpl.innerHTML = html.trim();
    const fresh = tpl.firstElementChild;
    row.replaceWith(fresh);
    if (input?.dataset.gfx) fresh.querySelector(`[data-gfx="${input.dataset.gfx}"]`)?.focus({ preventScroll: true });
    // A faixa "espelha o mapa principal" some na 1ª edição
    this.root.querySelector('.cm-vv-note--info')?.remove();
  }

  runAction(action) {
    const item = this.currentItem();
    if (!item) return;
    const layers = this.composer.layers || [];
    const ops = {
      'show-all': ['Mostrar todas as camadas', (v) => PrintViewEdits.setAllLayersVisible(v, layers, true)],
      'hide-all': ['Ocultar todas as camadas', (v) => PrintViewEdits.setAllLayersVisible(v, layers, false)],
      'copy-project': ['Copiar visibilidade do mapa principal', (v) => PrintViewEdits.copyProjectVisibility(v, layers)]
    };
    const op = ops[action];
    if (!op) return;
    this.composer.updateMapView(item.id, op[1], op[0]);
    this.refresh();
  }

  applySearch() {
    if (!this.root) return;
    const q = (this.state.query || '').trim().toLowerCase();
    const input = this.root.querySelector('[data-vv-search]');
    if (input && input.value !== this.state.query) input.value = this.state.query;
    this.root.querySelectorAll('.cm-vv-row[data-name]').forEach(r => {
      r.hidden = Boolean(q) && !r.dataset.name.includes(q);
    });
  }
}
