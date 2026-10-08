/* ==========================================================================
   ConecteMapas - AdvancedSearchPanel
   Janela flutuante de Busca Avançada: construtor visual de critérios (E/OU/NÃO,
   grupos aninhados), contagem ao vivo, seleção dos resultados e ações em lote
   (mover de camada, aplicar cores, bloquear, ocultar, excluir). A lógica fica em
   FeatureQuery e BatchActions; este componente só monta a interface.
   ========================================================================== */

import './AdvancedSearchPanel.css';
import { FeatureQuery, FIELD_DEFS, OPERATORS_BY_TYPE } from '../../services/FeatureQuery.js';

const OPERATOR_LABELS = {
  contains: 'contém', notContains: 'não contém', equals: 'é igual a', notEquals: 'é diferente de',
  startsWith: 'começa com', endsWith: 'termina com', regex: 'regex', empty: 'está vazio', notEmpty: 'não está vazio',
  eq: '=', neq: '≠', lt: '<', lte: '≤', gt: '>', gte: '≥', between: 'entre',
  before: 'antes de', after: 'depois de', in: 'é um de', notIn: 'não é nenhum de',
  isTrue: 'sim', isFalse: 'não'
};

const GEOMETRY_TYPES = [
  ['Point', 'Ponto'], ['LineString', 'Linha'], ['Polygon', 'Polígono'], ['Circle', 'Círculo'], ['Text', 'Texto']
];

const NO_VALUE = new Set(['empty', 'notEmpty', 'isTrue', 'isFalse']);
// Atributos livres aceitam operadores de texto e de número
const PROP_OPERATORS = [...OPERATORS_BY_TYPE.text, 'eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'between'];
const MAX_LIVE_HIGHLIGHT = 2000;
const STORAGE_PREFIX = 'cm-adv-search:';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export class AdvancedSearchPanel {
  /**
   * @param {Object} options
   * @param {Function} options.getApp retorna o app (features, layers, mapEngine...)
   * @param {Object} options.actions { select(ids, mode), zoom(ids), moveToLayer(ids, layerId, opts), applyColors(ids, colors),
   *   setLocked(ids, bool), setVisible(ids, bool), remove(ids) }
   */
  constructor(options = {}) {
    this.getApp = options.getApp || (() => null);
    this.actions = options.actions || {};
    this.root = null;
    this.query = AdvancedSearchPanel.emptyQuery();
    this.scope = 'all';
    this.liveHighlight = true;
    this.results = { ids: [], total: 0 };
    this._timer = null;
  }

  static emptyQuery() {
    return { op: 'AND', not: false, items: [AdvancedSearchPanel.emptyCriterion()] };
  }

  static emptyCriterion() {
    return { field: 'name', operator: 'contains', value: '', value2: '' };
  }

  get isOpen() {
    return !!this.root && this.root.style.display !== 'none';
  }

  toggle() { this.isOpen ? this.close() : this.open(); }

  open() {
    if (!this.root) {
      this.root = document.createElement('div');
      this.root.id = 'cm-adv-search';
      this.root.className = 'cm-adv-window';
      document.body.appendChild(this.root);
      this._bind();
    }
    this.root.style.display = 'flex';
    this.render();
    this.runNow();
    setTimeout(() => this.root.querySelector('[data-role="value"]')?.focus(), 30);
  }

  close() {
    if (this.root) this.root.style.display = 'none';
  }

  /** Chamado quando features/camadas mudam, para manter contagem e listas atualizadas. */
  refresh() {
    if (!this.isOpen) return;
    this.render();
    this.runNow({ highlight: false });
  }

  /** True se há ao menos um critério completo (senão a busca vazia selecionaria tudo). */
  _hasActiveCriteria(node = this.query) {
    if (Array.isArray(node.items)) return node.items.some(n => this._hasActiveCriteria(n));
    if (!node.field || !node.operator) return false;
    if (NO_VALUE.has(node.operator)) return true;
    const empty = (v) => v == null || v === '' || (Array.isArray(v) && v.length === 0);
    return !empty(node.value) && (node.operator !== 'between' || !empty(node.value2));
  }

  // ---------- Estado ----------

  _node(path) {
    let node = this.query;
    for (const i of path ? path.split('.').map(Number) : []) node = node.items[i];
    return node;
  }

  _parent(path) {
    const parts = path.split('.').map(Number);
    const idx = parts.pop();
    return { group: this._node(parts.join('.')), idx };
  }

  _fieldType(field) {
    if (field.startsWith('prop:')) return 'prop';
    return FIELD_DEFS.find(d => d.id === field)?.type || 'text';
  }

  _operators(field) {
    const t = this._fieldType(field);
    return t === 'prop' ? PROP_OPERATORS : OPERATORS_BY_TYPE[t];
  }

  _defaultValue(c) {
    const t = this._fieldType(c.field);
    if (t === 'set') return [];
    if (t === 'color') return '#00e08a';
    return '';
  }

  // ---------- Renderização ----------

  render() {
    const app = this.getApp();
    if (!app || !this.root) return;
    const layers = app.layers || [];
    const readOnly = document.body.classList.contains('cm-readonly');
    const saved = this._loadSaved(app);

    this.root.innerHTML = `
      <div class="cm-adv-header" data-role="drag">
        <span class="cm-adv-title">🔎 Busca Avançada</span>
        <button class="cm-adv-icon-btn" data-act="close" title="Fechar (Esc)">×</button>
      </div>
      <div class="cm-adv-body">
        <div class="cm-adv-row cm-adv-toprow">
          <label class="cm-adv-lbl" for="cm-adv-scope">Buscar em</label>
          <select id="cm-adv-scope" class="cm-native-select" data-role="scope">
            <option value="all" ${this.scope === 'all' ? 'selected' : ''}>Todo o projeto</option>
            <option value="visible" ${this.scope === 'visible' ? 'selected' : ''}>Só camadas visíveis</option>
            <option value="activeLayer" ${this.scope === 'activeLayer' ? 'selected' : ''}>Só a camada ativa</option>
          </select>
          <select class="cm-native-select" data-role="saved" title="Filtros salvos">
            <option value="">Filtros salvos…</option>
            ${saved.map((s, i) => `<option value="${i}">${esc(s.name)}</option>`).join('')}
          </select>
          <button class="cm-adv-btn" data-act="save-filter" title="Salvar esta busca">💾</button>
          <button class="cm-adv-btn" data-act="del-filter" title="Excluir o filtro salvo escolhido">🗑</button>
        </div>

        <div class="cm-adv-query">${this._renderGroup(this.query, '', app)}</div>

        <div class="cm-adv-resultbar">
          <span class="cm-adv-count" id="cm-adv-count" aria-live="polite"></span>
          <label class="cm-adv-check" title="Seleciona os resultados no mapa enquanto você edita a busca (até ${MAX_LIVE_HIGHLIGHT} feições)">
            <input type="checkbox" data-role="live" ${this.liveHighlight ? 'checked' : ''}> destacar ao digitar
          </label>
        </div>
        <div class="cm-adv-errors" id="cm-adv-errors"></div>

        <div class="cm-adv-actions">
          <div class="cm-adv-row">
            <button class="cm-adv-btn primary" data-act="select">Selecionar</button>
            <button class="cm-adv-btn" data-act="select-add">+ À seleção</button>
            <button class="cm-adv-btn" data-act="select-sub">− Da seleção</button>
            <button class="cm-adv-btn" data-act="zoom">Zoom</button>
            <button class="cm-adv-btn" data-act="table" title="Mostrar só os resultados na Tabela de Atributos">Ver na tabela</button>
          </div>
          <fieldset class="cm-adv-fs" ${readOnly ? 'disabled' : ''}>
            <legend>Mover resultados para camada</legend>
            <div class="cm-adv-row">
              <select class="cm-native-select" data-role="target-layer" aria-label="Camada de destino">
                ${layers.map(l => `<option value="${esc(l.id)}">${esc(l.name)}</option>`).join('')}
              </select>
              <label class="cm-adv-check"><input type="checkbox" data-role="inherit"> adotar cor da camada</label>
              <button class="cm-adv-btn primary" data-act="move">Mover</button>
            </div>
          </fieldset>
          <fieldset class="cm-adv-fs" ${readOnly ? 'disabled' : ''}>
            <legend>Aplicar cores aos resultados</legend>
            <div class="cm-adv-row">
              <label class="cm-adv-check"><input type="checkbox" data-role="use-fill" checked>
                Preench. <input type="color" data-role="fill" value="#00e08a" aria-label="Cor de preenchimento"></label>
              <label class="cm-adv-check"><input type="checkbox" data-role="use-stroke" checked>
                Traço <input type="color" data-role="stroke" value="#ffffff" aria-label="Cor do traço"></label>
              <button class="cm-adv-btn primary" data-act="paint">Aplicar</button>
            </div>
          </fieldset>
          <fieldset class="cm-adv-fs" ${readOnly ? 'disabled' : ''}>
            <legend>Outras ações nos resultados</legend>
            <div class="cm-adv-row">
              <button class="cm-adv-btn" data-act="lock">Bloquear</button>
              <button class="cm-adv-btn" data-act="unlock">Desbloquear</button>
              <button class="cm-adv-btn" data-act="hide">Ocultar</button>
              <button class="cm-adv-btn" data-act="show">Mostrar</button>
              <button class="cm-adv-btn danger" data-act="delete">Excluir</button>
            </div>
          </fieldset>
        </div>
      </div>`;
    this._updateResultUi();
  }

  _renderGroup(group, path, app) {
    const isRoot = path === '';
    const items = group.items.map((node, i) => {
      const p = isRoot ? String(i) : `${path}.${i}`;
      return Array.isArray(node.items) ? this._renderGroup(node, p, app) : this._renderCriterion(node, p, app);
    }).join('');
    return `
      <div class="cm-adv-group ${isRoot ? 'root' : ''}" data-path="${path}">
        <div class="cm-adv-grouphead">
          <span>Casar</span>
          <select class="cm-native-select" data-role="group-op" data-path="${path}" aria-label="Combinação do grupo">
            <option value="AND" ${group.op === 'AND' ? 'selected' : ''}>todos (E)</option>
            <option value="OR" ${group.op === 'OR' ? 'selected' : ''}>qualquer (OU)</option>
          </select>
          <label class="cm-adv-check"><input type="checkbox" data-role="group-not" data-path="${path}" ${group.not ? 'checked' : ''}> negar</label>
          ${isRoot ? '' : `<button class="cm-adv-icon-btn" data-act="rm" data-path="${path}" title="Remover grupo">×</button>`}
        </div>
        ${items}
        <div class="cm-adv-row">
          <button class="cm-adv-btn" data-act="add-crit" data-path="${path}">+ Critério</button>
          <button class="cm-adv-btn" data-act="add-group" data-path="${path}">+ Grupo</button>
        </div>
      </div>`;
  }

  _renderCriterion(c, path, app) {
    const props = FeatureQuery.discoverProperties(app.features);
    const ops = this._operators(c.field);
    if (!ops.includes(c.operator)) c.operator = ops[0];
    return `
      <div class="cm-adv-crit" data-path="${path}">
        <select class="cm-native-select" data-role="field" data-path="${path}" aria-label="Campo">
          <optgroup label="Campos">
            ${FIELD_DEFS.map(d => `<option value="${d.id}" ${c.field === d.id ? 'selected' : ''}>${esc(d.label)}</option>`).join('')}
          </optgroup>
          ${props.length ? `<optgroup label="Atributos">
            ${props.map(p => `<option value="${esc(p.id)}" ${c.field === p.id ? 'selected' : ''}>${esc(p.label)}</option>`).join('')}
          </optgroup>` : ''}
        </select>
        <select class="cm-native-select" data-role="operator" data-path="${path}" aria-label="Operador">
          ${ops.map(o => `<option value="${o}" ${c.operator === o ? 'selected' : ''}>${esc(OPERATOR_LABELS[o] || o)}</option>`).join('')}
        </select>
        ${this._renderValue(c, path, app)}
        <button class="cm-adv-icon-btn" data-act="rm" data-path="${path}" title="Remover critério">×</button>
      </div>`;
  }

  _renderValue(c, path, app) {
    if (NO_VALUE.has(c.operator)) return '<span class="cm-adv-novalue"></span>';
    const t = this._fieldType(c.field);
    const attr = `data-role="value" data-path="${path}"`;

    if ((c.operator === 'in' || c.operator === 'notIn') && t === 'set') {
      const options = c.field === 'layer'
        ? (app.layers || []).map(l => [l.id, l.name])
        : GEOMETRY_TYPES;
      const chosen = new Set(Array.isArray(c.value) ? c.value : []);
      return `<div class="cm-adv-chips" ${attr}>${options.map(([v, label]) =>
        `<label class="cm-adv-chip"><input type="checkbox" data-role="chip" data-path="${path}" value="${esc(v)}" ${chosen.has(v) ? 'checked' : ''}> ${esc(label)}</label>`
      ).join('')}</div>`;
    }
    if (c.operator === 'in' || c.operator === 'notIn') {
      return `<input class="cm-adv-input" ${attr} value="${esc(Array.isArray(c.value) ? c.value.join(', ') : c.value)}" placeholder="a, b, c" aria-label="Valores separados por vírgula">`;
    }
    const inputType = t === 'color' ? 'color' : t === 'date' ? 'date' : (t === 'number' ? 'number' : 'text');
    const val = (v) => esc(Array.isArray(v) ? v.join(', ') : v);
    const first = `<input class="cm-adv-input" type="${inputType}" step="any" ${attr} data-slot="value" value="${val(c.value)}" aria-label="Valor" placeholder="valor">`;
    if (c.operator !== 'between') return first;
    return `${first}<span class="cm-adv-and">e</span><input class="cm-adv-input" type="${inputType}" step="any" ${attr} data-slot="value2" value="${val(c.value2)}" aria-label="Segundo valor">`;
  }

  // ---------- Execução ----------

  _scheduleRun() {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.runNow(), 140);
  }

  runNow({ highlight = true } = {}) {
    clearTimeout(this._timer);
    const app = this.getApp();
    if (!app) return;
    const r = FeatureQuery.run(app.features, this.query, { layers: app.layers, scope: this.scope, activeLayerId: app.activeLayerId });
    this.results = { ids: r.ids, total: r.total };
    this._updateResultUi();
    if (highlight && this.liveHighlight && this._hasActiveCriteria() && r.ids.length <= MAX_LIVE_HIGHLIGHT && this.actions.select) {
      this.actions.select(r.ids, 'replace', { silent: true });
    }
  }

  _updateResultUi() {
    if (!this.root) return;
    const n = this.results.ids.length;
    const countEl = this.root.querySelector('#cm-adv-count');
    if (countEl) countEl.textContent = `${n.toLocaleString('pt-BR')} de ${this.results.total.toLocaleString('pt-BR')} feições`;
    const errors = FeatureQuery.validate(this.query);
    const errEl = this.root.querySelector('#cm-adv-errors');
    if (errEl) errEl.innerHTML = errors.map(e => `<div>⚠ ${esc(e.message)}</div>`).join('');
    this.root.querySelectorAll('.cm-adv-actions [data-act]').forEach(b => { b.disabled = n === 0; });
  }

  async _doAction(act, btn) {
    const ids = this.results.ids.slice();
    if (ids.length === 0) return;
    const q = (sel) => this.root.querySelector(sel);
    const a = this.actions;
    switch (act) {
      case 'select': return a.select?.(ids, 'replace');
      case 'select-add': return a.select?.(ids, 'add');
      case 'select-sub': return a.select?.(ids, 'subtract');
      case 'zoom': return a.zoom?.(ids);
      case 'table': return a.showInTable?.(ids);
      case 'move': return this._afterBatch(a.moveToLayer?.(ids, q('[data-role="target-layer"]').value, { inheritColor: q('[data-role="inherit"]').checked }));
      case 'paint': {
        const colors = {};
        if (q('[data-role="use-fill"]').checked) colors.fillColor = q('[data-role="fill"]').value;
        if (q('[data-role="use-stroke"]').checked) colors.strokeColor = q('[data-role="stroke"]').value;
        return this._afterBatch(a.applyColors?.(ids, colors));
      }
      case 'lock': return this._afterBatch(a.setLocked?.(ids, true));
      case 'unlock': return this._afterBatch(a.setLocked?.(ids, false));
      case 'hide': return this._afterBatch(a.setVisible?.(ids, false));
      case 'show': return this._afterBatch(a.setVisible?.(ids, true));
      case 'delete': return this._afterBatch(a.remove?.(ids));
      default: return null;
    }
  }

  /** Após uma ação em lote os dados mudaram: recalcula resultados sem perder a busca. */
  _afterBatch() {
    this.render();
    this.runNow({ highlight: false });
  }

  // ---------- Filtros salvos ----------

  _storageKey(app) { return STORAGE_PREFIX + (app.projectId || 'projeto_padrao'); }

  _loadSaved(app) {
    try { return JSON.parse(localStorage.getItem(this._storageKey(app)) || '[]'); } catch { return []; }
  }

  _storeSaved(app, list) {
    try { localStorage.setItem(this._storageKey(app), JSON.stringify(list)); } catch { /* armazenamento indisponível */ }
  }

  // ---------- Eventos ----------

  _bind() {
    const root = this.root;

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn || btn.disabled) return;
      const act = btn.dataset.act;
      const path = btn.dataset.path;
      if (act === 'close') return this.close();
      if (act === 'add-crit') { this._node(path).items.push(AdvancedSearchPanel.emptyCriterion()); return this._rerender(); }
      if (act === 'add-group') { this._node(path).items.push({ op: 'OR', not: false, items: [AdvancedSearchPanel.emptyCriterion()] }); return this._rerender(); }
      if (act === 'rm') {
        const { group, idx } = this._parent(path);
        group.items.splice(idx, 1);
        if (this.query.items.length === 0) this.query.items.push(AdvancedSearchPanel.emptyCriterion());
        return this._rerender();
      }
      if (act === 'save-filter') return this._saveFilter();
      if (act === 'del-filter') return this._deleteFilter();
      this._doAction(act, btn);
    });

    root.addEventListener('change', (e) => {
      const t = e.target;
      const role = t.dataset.role;
      if (role === 'scope') { this.scope = t.value; return this.runNow(); }
      if (role === 'live') { this.liveHighlight = t.checked; return this.runNow(); }
      if (role === 'saved') return this._loadFilter(t.value);
      if (role === 'group-op') { this._node(t.dataset.path).op = t.value; return this._rerender(); }
      if (role === 'group-not') { this._node(t.dataset.path).not = t.checked; return this._rerender(); }
      if (role === 'field') {
        const c = this._node(t.dataset.path);
        c.field = t.value;
        c.operator = this._operators(c.field)[0];
        c.value = this._defaultValue(c);
        c.value2 = '';
        return this._rerender();
      }
      if (role === 'operator') {
        const c = this._node(t.dataset.path);
        c.operator = t.value;
        const set = c.operator === 'in' || c.operator === 'notIn';
        if (set && !Array.isArray(c.value)) c.value = this._fieldType(c.field) === 'set' ? [] : String(c.value || '');
        if (!set && Array.isArray(c.value)) c.value = c.value.join(', ');
        return this._rerender();
      }
      if (role === 'chip') {
        const c = this._node(t.dataset.path);
        const set = new Set(Array.isArray(c.value) ? c.value : []);
        t.checked ? set.add(t.value) : set.delete(t.value);
        c.value = [...set];
        return this._scheduleRun();
      }
    });

    root.addEventListener('input', (e) => {
      const t = e.target;
      if (t.dataset.role !== 'value' || !t.dataset.path) return;
      const c = this._node(t.dataset.path);
      const slot = t.dataset.slot === 'value2' ? 'value2' : 'value';
      let v = t.value;
      if ((c.operator === 'in' || c.operator === 'notIn') && slot === 'value') v = v.split(',').map(s => s.trim()).filter(Boolean);
      c[slot] = v;
      this._scheduleRun();
    });

    root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); this.close(); }
      else if (e.key === 'Enter' && e.target.matches('.cm-adv-input')) { e.preventDefault(); this._doAction('select'); }
    });

    this._makeDraggable();
  }

  _rerender() {
    this.render();
    this._scheduleRun();
  }

  _saveFilter() {
    const app = this.getApp();
    const name = (window.prompt('Nome do filtro:') || '').trim();
    if (!name) return;
    const list = this._loadSaved(app).filter(s => s.name !== name);
    list.push({ name, scope: this.scope, query: JSON.parse(JSON.stringify(this.query)) });
    this._storeSaved(app, list);
    this.render();
  }

  _loadFilter(index) {
    if (index === '') return;
    const app = this.getApp();
    const item = this._loadSaved(app)[Number(index)];
    if (!item) return;
    this.query = JSON.parse(JSON.stringify(item.query));
    this.scope = item.scope || 'all';
    this.render();
    this.runNow();
    const sel = this.root.querySelector('[data-role="saved"]');
    if (sel) sel.value = index;
  }

  _deleteFilter() {
    const app = this.getApp();
    const sel = this.root.querySelector('[data-role="saved"]');
    if (!sel || sel.value === '') return;
    const list = this._loadSaved(app);
    list.splice(Number(sel.value), 1);
    this._storeSaved(app, list);
    this.render();
  }

  _makeDraggable() {
    const win = this.root;
    win.addEventListener('mousedown', (e) => {
      const handle = e.target.closest('[data-role="drag"]');
      if (!handle || e.target.closest('button')) return;
      const rect = win.getBoundingClientRect();
      const dx = e.clientX - rect.left;
      const dy = e.clientY - rect.top;
      win.style.right = 'auto';
      const move = (ev) => {
        win.style.left = `${Math.max(0, Math.min(window.innerWidth - win.offsetWidth, ev.clientX - dx))}px`;
        win.style.top = `${Math.max(0, Math.min(window.innerHeight - 40, ev.clientY - dy))}px`;
      };
      const up = () => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
  }

  destroy() {
    clearTimeout(this._timer);
    this.root?.remove();
    this.root = null;
  }
}
