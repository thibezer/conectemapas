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
import { FeatureQuery } from '../../services/FeatureQuery.js';
import { QueryBuilder } from '../AdvancedSearch/QueryBuilder.js';

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
    this.state = { itemId: null, tab: 'layers', query: '', filterDraft: null };
    this.root = null;
    // Critérios do filtro em edição (mesmo construtor da Busca Avançada)
    this.builder = new QueryBuilder({
      getQuery: () => this.state.filterDraft?.query,
      onChange: (structural) => (structural ? this.refresh() : this.updateDraftCount())
    });
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
    const body = this.renderTab(tab, composer, item, view, locked, state);
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

  static renderTab(tab, composer, item, view, locked, state = {}) {
    if (tab === 'layers') return this.renderLayersTab(composer, item, view, locked);
    if (tab === 'labels') return this.renderLabelsTab(composer, item, view, locked);
    if (tab === 'filters') return this.renderFiltersTab(composer, item, view, locked, state);
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

  /** Campos que podem ir no rótulo: os da feição e as chaves de `properties` do projeto */
  static labelFields(features) {
    const base = ['name', 'category', 'description', 'type'];
    const props = FeatureQuery.discoverProperties(features || []).map(p => p.label).filter(k => typeof k === 'string');
    return [...base, ...props.filter(k => !base.includes(k) && !k.startsWith('_'))];
  }

  static renderLabelsTab(composer, item, view, locked) {
    const layers = composer.layers || [];
    if (!layers.length) return '<div class="cm-vv-empty">O projeto ainda não tem camadas.</div>';
    const fields = this.labelFields(composer.features);
    const dis = locked ? 'disabled' : '';
    return `
      <div class="cm-vv-toolbar">
        <input type="search" class="cm-vertex-input cm-vv-search" data-vv-search placeholder="Buscar camada…" aria-label="Buscar camada" />
        <button type="button" class="cm-vv-btn" data-vv-action="labels-on" ${dis}>Ligar todos</button>
        <button type="button" class="cm-vv-btn" data-vv-action="labels-off" ${dis}>Desligar todos</button>
      </div>
      <p class="cm-vv-hint cm-vv-help">Escreva o texto e use campos entre chaves, por exemplo <code>Lote {name}</code>. Para quebrar a linha, digite <code>\\n</code>.</p>
      <div class="cm-vv-chips" aria-label="Campos disponíveis">
        ${fields.map(f => `<button type="button" class="cm-vv-chip" data-vv-field="${esc(f)}" title="Inserir {${esc(f)}} no texto em foco">{${esc(f)}}</button>`).join('')}
      </div>
      <table class="cm-vv-table">
        <thead>
          <tr>
            <th class="cm-vv-center">Mostrar</th>
            <th>Camada</th>
            <th>Texto</th>
            <th>Tamanho (pt)</th>
            <th>Cor</th>
            <th class="cm-vv-center">Halo</th>
            <th>Exemplo</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${layers.map(l => this.labelRow(composer, l, view, locked)).join('')}</tbody>
      </table>
    `;
  }

  static labelRow(composer, layer, view, locked) {
    const ov = view.labels?.[layer.id] || null;
    const g = PrintViewResolver.layerPreview(layer, composer.features, view);
    const lb = g.label;
    const dis = locked ? 'disabled' : '';
    const sample = (composer.features || []).find(f => f.layerId === layer.id);
    const example = sample ? PrintViewResolver.labelText(sample, lb.text) : '';
    const hex = (c) => (PrintItemsManager.parseColor(c) || { hex: '#111111' }).hex;
    const mark = (k) => (ov && ov[k] !== undefined ? 'is-overridden' : '');
    return `
      <tr class="cm-vv-row ${lb.show ? '' : 'is-hidden'}" data-row-kind="label" data-row-id="${esc(layer.id)}" data-name="${esc(String(layer.name || '').toLowerCase())}">
        <td class="cm-vv-cell cm-vv-center ${mark('show')}">
          <input type="checkbox" data-gfx="show" ${lb.show ? 'checked' : ''} ${dis} aria-label="Mostrar rótulo: ${esc(layer.name)}" />
        </td>
        <td class="cm-vv-cell cm-vv-name">
          ${this.swatch(g)}
          <span class="cm-vv-name-text" title="${esc(layer.name)}">${esc(layer.name || 'Camada')}</span>
        </td>
        <td class="cm-vv-cell ${mark('text')}">
          <input type="text" class="cm-vertex-input cm-vv-text" data-gfx="text" value="${esc(ov?.text ?? '')}" placeholder="${esc(lb.text)}" ${dis} aria-label="Texto do rótulo de ${esc(layer.name)}" />
        </td>
        <td class="cm-vv-cell ${mark('sizePt')}">
          <input type="number" class="cm-vertex-input cm-vv-num" data-gfx="sizePt" min="3" max="48" step="0.5" value="${ov?.sizePt ?? ''}" placeholder="${lb.sizePt}" ${dis} aria-label="Tamanho do rótulo (pt)" />
        </td>
        <td class="cm-vv-cell ${mark('color')}">
          <input type="color" class="cm-vv-color" data-gfx="color" value="${hex(lb.color)}" ${dis} aria-label="Cor do rótulo" />
        </td>
        <td class="cm-vv-cell cm-vv-center ${mark('halo')}">
          <input type="checkbox" data-gfx="halo" ${lb.halo ? 'checked' : ''} ${dis} aria-label="Halo branco" title="Contorno branco para ler sobre a imagem" />
        </td>
        <td class="cm-vv-cell cm-vv-example" title="${esc(example)}">${example ? esc(example.split('\n').join(' / ')) : '<span class="cm-vv-muted">—</span>'}</td>
        <td class="cm-vv-cell cm-vv-center">
          <button type="button" class="cm-vv-reset" data-vv-reset ${ov && !locked ? '' : 'disabled'} title="Voltar ao rótulo do projeto" aria-label="Voltar o rótulo de ${esc(layer.name)} ao projeto">↺</button>
        </td>
      </tr>
    `;
  }

  /** Feições que o filtro pega (escopo das camadas dele; sem critérios = todas) */
  static filterMatches(def, composer) {
    const features = composer.features || [];
    const scoped = Array.isArray(def?.layerIds) && def.layerIds.length
      ? features.filter(f => def.layerIds.includes(f.layerId))
      : features;
    const query = QueryBuilder.hasActiveCriteria(def?.query) ? def.query : null;
    try {
      return FeatureQuery.run(scoped, query, { layers: composer.layers }).ids;
    } catch (e) {
      return [];
    }
  }

  static renderFiltersTab(composer, item, view, locked, state) {
    const library = composer.library || { filters: [] };
    const defs = new Map((library.filters || []).map(f => [f.id, f]));
    const inView = new Set((view.filters || []).map(f => f.filterId));
    const libLocked = composer.readOnly === true;
    const rows = (view.filters || []).map((entry, i) => this.filterRow(composer, view, entry, defs.get(entry.filterId), locked, i, view.filters.length)).join('');
    const dis = locked ? 'disabled' : '';
    const available = (library.filters || []).filter(f => !inView.has(f.id));
    return `
      <div class="cm-vv-section-title">Filtros desta vista <span class="cm-vv-muted">(o de cima vence)</span></div>
      ${rows ? `
        <table class="cm-vv-table">
          <thead>
            <tr>
              <th>Prioridade</th>
              <th class="cm-vv-center">Ativo</th>
              <th class="cm-vv-center">Visível</th>
              <th>Filtro</th>
              <th>Traço</th>
              <th>Preenchimento</th>
              <th class="cm-vv-center">Meio-tom</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      ` : '<div class="cm-vv-empty cm-vv-empty--small">Nenhum filtro nesta vista. Adicione um da biblioteca abaixo.</div>'}
      <div class="cm-vv-toolbar cm-vv-toolbar--spaced">
        <select class="cm-native-select" data-vv-add-filter aria-label="Filtro da biblioteca" ${dis || (available.length ? '' : 'disabled')}>
          ${available.length ? available.map(f => `<option value="${esc(f.id)}">${esc(f.name || 'Filtro')}</option>`).join('') : '<option value="">Todos os filtros já estão na vista</option>'}
        </select>
        <button type="button" class="cm-vv-btn" data-vv-action="filter-add" ${dis || (available.length ? '' : 'disabled')}>Adicionar à vista</button>
      </div>

      <div class="cm-vv-section-title">Biblioteca de filtros do projeto <span class="cm-vv-muted">(vale para todas as pranchas)</span></div>
      <table class="cm-vv-table cm-vv-table--compact">
        <thead><tr><th>Nome</th><th>Camadas</th><th>Feições</th><th></th></tr></thead>
        <tbody>
          ${(library.filters || []).map(f => `
            <tr class="cm-vv-row" data-filter-id="${esc(f.id)}">
              <td class="cm-vv-cell">${esc(f.name || 'Filtro')}</td>
              <td class="cm-vv-cell cm-vv-muted">${(f.layerIds || []).length ? esc((f.layerIds || []).map(id => (composer.layers || []).find(l => l.id === id)?.name || id).join(', ')) : 'Todas'}</td>
              <td class="cm-vv-cell">${this.filterMatches(f, composer).length}</td>
              <td class="cm-vv-cell cm-vv-actions-cell">
                <button type="button" class="cm-vv-btn" data-vv-action="filter-edit" data-filter-id="${esc(f.id)}" ${libLocked ? 'disabled' : ''}>Editar</button>
                <button type="button" class="cm-vv-btn" data-vv-action="filter-dup" data-filter-id="${esc(f.id)}" ${libLocked ? 'disabled' : ''}>Duplicar</button>
                <button type="button" class="cm-vv-btn cm-vv-btn--danger" data-vv-action="filter-delete" data-filter-id="${esc(f.id)}" ${libLocked ? 'disabled' : ''}>Excluir</button>
              </td>
            </tr>
          `).join('') || '<tr><td class="cm-vv-cell cm-vv-muted" colspan="4">A biblioteca ainda não tem filtros.</td></tr>'}
        </tbody>
      </table>
      <div class="cm-vv-toolbar cm-vv-toolbar--spaced">
        <button type="button" class="cm-vv-btn cm-vv-btn--primary" data-vv-action="filter-new" ${libLocked ? 'disabled' : ''}>+ Novo filtro</button>
      </div>
      ${state.filterDraft ? this.renderFilterEditor(composer, state.filterDraft) : ''}
    `;
  }

  static filterRow(composer, view, entry, def, locked, index, total) {
    const id = entry.filterId;
    const dis = locked ? 'disabled' : '';
    if (!def) {
      return `
        <tr class="cm-vv-row is-hidden" data-row-kind="filter" data-row-id="${esc(id)}">
          <td class="cm-vv-cell" colspan="7">Filtro excluído da biblioteca</td>
          <td class="cm-vv-cell cm-vv-center"><button type="button" class="cm-vv-icon-btn" data-vv-remove-filter ${dis} title="Tirar da vista" aria-label="Tirar da vista">✕</button></td>
        </tr>`;
    }
    const ids = this.filterMatches(def, composer);
    const sample = (composer.features || []).find(f => ids.includes(String(f.id)) || ids.includes(f.id))
      || { id: '__amostra', type: 'Polygon', coordinates: [] };
    const layer = (composer.layers || []).find(l => l.id === sample.layerId) || {};
    const layerOv = view.layers?.[sample.layerId];
    const g = PrintViewResolver.graphicsOf(sample, layer, [layerOv, entry].filter(Boolean));
    const has = PrintViewEdits.hasOverride(view, 'filter', id);
    return `
      <tr class="cm-vv-row ${entry.enabled === false ? 'is-hidden' : ''}" data-row-kind="filter" data-row-id="${esc(id)}">
        <td class="cm-vv-cell">
          <div class="cm-vv-inline">
            <button type="button" class="cm-vv-icon-btn" data-vv-move="-1" ${dis || (index === 0 ? 'disabled' : '')} title="Subir (mais prioridade)" aria-label="Subir ${esc(def.name)}">↑</button>
            <button type="button" class="cm-vv-icon-btn" data-vv-move="1" ${dis || (index === total - 1 ? 'disabled' : '')} title="Descer" aria-label="Descer ${esc(def.name)}">↓</button>
          </div>
        </td>
        <td class="cm-vv-cell cm-vv-center"><input type="checkbox" data-gfx="enabled" ${entry.enabled !== false ? 'checked' : ''} ${dis} aria-label="Filtro ativo: ${esc(def.name)}" /></td>
        <td class="cm-vv-cell cm-vv-center ${entry.visible === false ? 'is-overridden' : ''}"><input type="checkbox" data-gfx="visible" ${entry.visible !== false ? 'checked' : ''} ${dis} aria-label="Mostrar o que o filtro pega" title="Desmarcado: oculta as feições que o filtro pega" /></td>
        <td class="cm-vv-cell cm-vv-name">
          ${this.swatch(g)}
          <span class="cm-vv-name-text" title="${esc(def.name)}">${esc(def.name || 'Filtro')}</span>
          <span class="cm-vv-count" title="${ids.length} feições">${ids.length}</span>
        </td>
        ${this.graphicsCells(g, entry, locked)}
        <td class="cm-vv-cell cm-vv-center">
          <div class="cm-vv-inline">
            <button type="button" class="cm-vv-reset" data-vv-reset ${has && !locked ? '' : 'disabled'} title="Tirar os gráficos do filtro" aria-label="Tirar os gráficos de ${esc(def.name)}">↺</button>
            <button type="button" class="cm-vv-icon-btn" data-vv-remove-filter ${dis} title="Tirar da vista" aria-label="Tirar ${esc(def.name)} da vista">✕</button>
          </div>
        </td>
      </tr>
    `;
  }

  static renderFilterEditor(composer, draft) {
    const builder = new QueryBuilder({ getQuery: () => draft.query });
    const chosen = new Set(draft.layerIds || []);
    const count = this.filterMatches(draft, composer).length;
    return `
      <div class="cm-vv-editor" data-vv-editor>
        <div class="cm-vv-section-title">${draft.id ? 'Editar filtro' : 'Novo filtro'}</div>
        <div class="cm-vv-toolbar">
          <input type="text" class="cm-vertex-input cm-vv-text" data-vv-draft="name" value="${esc(draft.name || '')}" placeholder="Nome do filtro (ex.: APP, Lotes acima de 1 ha)" aria-label="Nome do filtro" />
        </div>
        <div class="cm-vv-hint">Camadas (nenhuma marcada = todas):</div>
        <div class="cm-vv-chips">
          ${(composer.layers || []).map(l => `<label class="cm-vv-chip"><input type="checkbox" data-vv-draft-layer value="${esc(l.id)}" ${chosen.has(l.id) ? 'checked' : ''}/> ${esc(l.name)}</label>`).join('')}
        </div>
        <div class="cm-vv-hint">Critérios (vazio = todas as feições das camadas escolhidas):</div>
        <div class="cm-vv-query">${builder.render({ features: composer.features || [], layers: composer.layers || [] })}</div>
        <div class="cm-vv-toolbar cm-vv-toolbar--spaced">
          <span class="cm-vv-count-lg" data-vv-draft-count>${count} feição(ões) casam</span>
          <span class="cm-vv-grow"></span>
          <button type="button" class="cm-vv-btn" data-vv-action="filter-cancel">Cancelar</button>
          <button type="button" class="cm-vv-btn cm-vv-btn--primary" data-vv-action="filter-save">Salvar filtro</button>
        </div>
      </div>
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
    if (kind === 'label') {
      const layer = (composer.layers || []).find(l => String(l.id) === String(id));
      return layer ? this.labelRow(composer, layer, view, item.locked === true || composer.readOnly === true) : null;
    }
    return null;
  }

  /** Valor de um campo da janela -> valor gravado (null = herda) */
  static parseField(input) {
    const path = input.dataset.gfx;
    if (input.type === 'checkbox') {
      if (path === 'visible' || path === 'show' || path === 'enabled' || path === 'halo') return input.checked;
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
      if (this.state.filterDraft && t.closest('[data-vv-editor]') && this.builder.handleClick(e)) return;
      const move = t.closest('[data-vv-move]');
      if (move && !move.disabled) {
        const row = move.closest('[data-row-kind]');
        this.edit(row, (view) => PrintViewEdits.moveFilter(view, row.dataset.rowId, Number(move.dataset.vvMove)), 'Prioridade do filtro', null, true, null, true);
        return;
      }
      const remove = t.closest('[data-vv-remove-filter]');
      if (remove && !remove.disabled) {
        const row = remove.closest('[data-row-kind]');
        this.edit(row, (view) => PrintViewEdits.removeFilter(view, row.dataset.rowId), 'Tirar filtro da vista', null, true, null, true);
        return;
      }
      const tab = t.closest('[data-vv-tab]');
      if (tab) {
        this.state.tab = tab.dataset.vvTab;
        this.state.query = '';
        this.state.filterDraft = null;
        this.refresh();
        return;
      }
      const chip = t.closest('[data-vv-field]');
      if (chip) { this.insertField(chip.dataset.vvField); return; }
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
      if (!committed && !(input.type === 'color' || input.type === 'range' || input.type === 'text')) return;
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
      if (this.state.filterDraft && e.target.closest?.('[data-vv-editor]')) {
        if (e.target.matches('[data-vv-draft="name"]')) { this.state.filterDraft.name = e.target.value; return; }
        if (this.builder.handleInput(e)) return;
      }
      if (e.target.matches?.('[data-vv-search]')) {
        this.state.query = e.target.value;
        this.applySearch();
        return;
      }
      onField(e, false);
    });
    root.addEventListener('change', (e) => {
      if (this.state.filterDraft && e.target.closest?.('[data-vv-editor]')) {
        if (e.target.matches('[data-vv-draft-layer]')) {
          const ids = new Set(this.state.filterDraft.layerIds || []);
          if (e.target.checked) ids.add(e.target.value);
          else ids.delete(e.target.value);
          this.state.filterDraft.layerIds = [...ids];
          this.updateDraftCount();
          return;
        }
        if (this.builder.handleChange(e)) return;
        return;
      }
      if (e.target.matches?.('[data-vv-map]')) {
        this.state.itemId = e.target.value;
        this.refresh();
        return;
      }
      onField(e, true);
    });
    root.addEventListener('focusin', (e) => {
      if (e.target.matches?.('[data-gfx="text"]')) this.lastTextInput = e.target;
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
    const html = row.dataset.rowKind === 'filter' ? null : PrintVisibilityDialog.rowHtml(this.composer, item, row.dataset.rowKind, row.dataset.rowId);
    if (!html) { this.refresh(); return; }
    const tpl = document.createElement('tbody');
    tpl.innerHTML = html.trim();
    const fresh = tpl.firstElementChild;
    row.replaceWith(fresh);
    if (input?.dataset.gfx) fresh.querySelector(`[data-gfx="${input.dataset.gfx}"]`)?.focus({ preventScroll: true });
    // A faixa "espelha o mapa principal" some na 1ª edição
    this.root.querySelector('.cm-vv-note--info')?.remove();
  }

  runAction(action, el = null) {
    const item = this.currentItem();
    if (!item) return;
    if (action.startsWith('filter-')) { this.runFilterAction(action, el, item); return; }
    const layers = this.composer.layers || [];
    const ops = {
      'show-all': ['Mostrar todas as camadas', (v) => PrintViewEdits.setAllLayersVisible(v, layers, true)],
      'hide-all': ['Ocultar todas as camadas', (v) => PrintViewEdits.setAllLayersVisible(v, layers, false)],
      'copy-project': ['Copiar visibilidade do mapa principal', (v) => PrintViewEdits.copyProjectVisibility(v, layers)],
      'labels-on': ['Ligar rótulos', (v) => layers.forEach(l => PrintViewEdits.setField(v, 'label', l.id, 'show', true))],
      'labels-off': ['Desligar rótulos', (v) => layers.forEach(l => PrintViewEdits.setField(v, 'label', l.id, 'show', false))]
    };
    const op = ops[action];
    if (!op) return;
    this.composer.updateMapView(item.id, op[1], op[0]);
    this.refresh();
  }

  /** Biblioteca de filtros (vale para todas as pranchas) e filtros da vista */
  runFilterAction(action, el, item) {
    const composer = this.composer;
    const filterId = el?.dataset.filterId;
    const def = (composer.library?.filters || []).find(f => f.id === filterId);
    if (action === 'filter-add') {
      const id = this.root.querySelector('[data-vv-add-filter]')?.value;
      if (id) composer.updateMapView(item.id, (v) => PrintViewEdits.addFilter(v, id), 'Adicionar filtro à vista');
    } else if (action === 'filter-new') {
      this.state.filterDraft = { id: null, name: '', layerIds: [], query: QueryBuilder.emptyQuery() };
    } else if (action === 'filter-edit' && def) {
      this.state.filterDraft = JSON.parse(JSON.stringify({ layerIds: [], query: QueryBuilder.emptyQuery(), ...def }));
    } else if (action === 'filter-dup' && def) {
      composer.updateLibrary(lib => {
        lib.filters.push({ ...JSON.parse(JSON.stringify(def)), id: `flt-${Date.now().toString(36)}`, name: `${def.name || 'Filtro'} (cópia)` });
      });
    } else if (action === 'filter-delete' && def) {
      if (!confirm(`Excluir o filtro "${def.name || 'Filtro'}" da biblioteca? Ele sai de todas as pranchas.`)) return;
      composer.updateLibrary(lib => { lib.filters = lib.filters.filter(f => f.id !== def.id); });
    } else if (action === 'filter-cancel') {
      this.state.filterDraft = null;
    } else if (action === 'filter-save') {
      const draft = this.state.filterDraft;
      if (!draft) return;
      const name = String(draft.name || '').trim();
      const problems = FeatureQuery.validate(draft.query || {});
      if (!name || problems.length) {
        const count = this.root.querySelector('[data-vv-draft-count]');
        if (count) count.textContent = !name ? 'Dê um nome ao filtro.' : problems[0].message;
        return;
      }
      const isNew = !draft.id;
      const saved = { id: draft.id || `flt-${Date.now().toString(36)}`, name, layerIds: draft.layerIds || [], query: draft.query };
      const ok = composer.updateLibrary(lib => {
        const i = lib.filters.findIndex(f => f.id === saved.id);
        if (i >= 0) lib.filters[i] = saved;
        else lib.filters.push(saved);
      });
      if (!ok) return;
      // Filtro novo já entra na vista deste mapa (no topo)
      if (isNew) composer.updateMapView(item.id, (v) => PrintViewEdits.addFilter(v, saved.id), 'Adicionar filtro à vista');
      this.state.filterDraft = null;
    }
    this.refresh();
  }

  /** Contagem ao vivo do filtro em edição */
  updateDraftCount() {
    const el = this.root?.querySelector('[data-vv-draft-count]');
    if (el && this.state.filterDraft) {
      el.textContent = `${PrintVisibilityDialog.filterMatches(this.state.filterDraft, this.composer).length} feição(ões) casam`;
    }
  }

  /** Insere {campo} no texto de rótulo em foco (ou no último usado) */
  insertField(field) {
    const last = this.lastTextInput && this.root.contains(this.lastTextInput) ? this.lastTextInput : null;
    const input = last || this.root.querySelector('[data-gfx="text"]:not(:disabled)');
    if (!input || input.disabled) return;
    const token = `{${field}}`;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.value = input.value.slice(0, start) + token + input.value.slice(end);
    input.focus();
    input.setSelectionRange(start + token.length, start + token.length);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
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
