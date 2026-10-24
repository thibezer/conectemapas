/* ==========================================================================
   ConecteMapas - QueryBuilder
   Responsabilidade Única: construtor visual de critérios do FeatureQuery (E/OU/NÃO,
   grupos aninhados). Usado pela Busca Avançada e pelos filtros das vistas de prancha.
   Só gera a marcação e trata os eventos dela; quem usa guarda a consulta e decide o
   que fazer a cada mudança (`onChange(structural)`: true = refazer a marcação).
   ========================================================================== */

import { FeatureQuery, FIELD_DEFS, OPERATORS_BY_TYPE } from '../../services/FeatureQuery.js';

export const OPERATOR_LABELS = {
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

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export class QueryBuilder {
  /**
   * @param {Object} options
   * @param {() => Object} options.getQuery consulta editada (grupo raiz, alterado no lugar)
   * @param {(structural: boolean) => void} options.onChange
   */
  constructor({ getQuery, onChange = () => {} }) {
    this.getQuery = getQuery;
    this.onChange = onChange;
  }

  static emptyQuery() {
    return { op: 'AND', not: false, items: [QueryBuilder.emptyCriterion()] };
  }

  static emptyCriterion() {
    return { field: 'name', operator: 'contains', value: '', value2: '' };
  }

  /** True se há ao menos um critério completo (senão a busca vazia pegaria tudo) */
  static hasActiveCriteria(node) {
    if (!node) return false;
    if (Array.isArray(node.items)) return node.items.some(n => QueryBuilder.hasActiveCriteria(n));
    if (!node.field || !node.operator) return false;
    if (NO_VALUE.has(node.operator)) return true;
    const empty = (v) => v == null || v === '' || (Array.isArray(v) && v.length === 0);
    return !empty(node.value) && (node.operator !== 'between' || !empty(node.value2));
  }

  // ---------- Estado ----------

  _node(path) {
    let node = this.getQuery();
    for (const i of path ? path.split('.').map(Number) : []) node = node.items[i];
    return node;
  }

  _parent(path) {
    const parts = path.split('.').map(Number);
    const idx = parts.pop();
    return { group: this._node(parts.join('.')), idx };
  }

  static fieldType(field) {
    if (String(field).startsWith('prop:')) return 'prop';
    return FIELD_DEFS.find(d => d.id === field)?.type || 'text';
  }

  static operators(field) {
    const t = QueryBuilder.fieldType(field);
    return t === 'prop' ? PROP_OPERATORS : OPERATORS_BY_TYPE[t];
  }

  static defaultValue(c) {
    const t = QueryBuilder.fieldType(c.field);
    if (t === 'set') return [];
    if (t === 'color') return '#00e08a';
    return '';
  }

  // ---------- Marcação ----------

  /** @param ctx { features, layers } */
  render(ctx) {
    return this._renderGroup(this.getQuery(), '', ctx);
  }

  _renderGroup(group, path, ctx) {
    const isRoot = path === '';
    const items = group.items.map((node, i) => {
      const p = isRoot ? String(i) : `${path}.${i}`;
      return Array.isArray(node.items) ? this._renderGroup(node, p, ctx) : this._renderCriterion(node, p, ctx);
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

  _renderCriterion(c, path, ctx) {
    const props = FeatureQuery.discoverProperties(ctx.features);
    const ops = QueryBuilder.operators(c.field);
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
        ${this._renderValue(c, path, ctx)}
        <button class="cm-adv-icon-btn" data-act="rm" data-path="${path}" title="Remover critério">×</button>
      </div>`;
  }

  _renderValue(c, path, ctx) {
    if (NO_VALUE.has(c.operator)) return '<span class="cm-adv-novalue"></span>';
    const t = QueryBuilder.fieldType(c.field);
    const attr = `data-role="value" data-path="${path}"`;

    if ((c.operator === 'in' || c.operator === 'notIn') && t === 'set') {
      const options = c.field === 'layer'
        ? (ctx.layers || []).map(l => [l.id, l.name])
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

  // ---------- Eventos (devolvem true quando o evento era do construtor) ----------

  handleClick(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn || btn.disabled) return false;
    const act = btn.dataset.act;
    const path = btn.dataset.path;
    if (act === 'add-crit') {
      this._node(path).items.push(QueryBuilder.emptyCriterion());
    } else if (act === 'add-group') {
      this._node(path).items.push({ op: 'OR', not: false, items: [QueryBuilder.emptyCriterion()] });
    } else if (act === 'rm') {
      const { group, idx } = this._parent(path);
      group.items.splice(idx, 1);
      const root = this.getQuery();
      if (root.items.length === 0) root.items.push(QueryBuilder.emptyCriterion());
    } else {
      return false;
    }
    this.onChange(true);
    return true;
  }

  handleChange(e) {
    const t = e.target;
    const role = t.dataset.role;
    if (!t.dataset.path && t.dataset.path !== '') return false;
    if (role === 'group-op') { this._node(t.dataset.path).op = t.value; this.onChange(true); return true; }
    if (role === 'group-not') { this._node(t.dataset.path).not = t.checked; this.onChange(true); return true; }
    if (role === 'field') {
      const c = this._node(t.dataset.path);
      c.field = t.value;
      c.operator = QueryBuilder.operators(c.field)[0];
      c.value = QueryBuilder.defaultValue(c);
      c.value2 = '';
      this.onChange(true);
      return true;
    }
    if (role === 'operator') {
      const c = this._node(t.dataset.path);
      c.operator = t.value;
      const set = c.operator === 'in' || c.operator === 'notIn';
      if (set && !Array.isArray(c.value)) c.value = QueryBuilder.fieldType(c.field) === 'set' ? [] : String(c.value || '');
      if (!set && Array.isArray(c.value)) c.value = c.value.join(', ');
      this.onChange(true);
      return true;
    }
    if (role === 'chip') {
      const c = this._node(t.dataset.path);
      const set = new Set(Array.isArray(c.value) ? c.value : []);
      if (t.checked) set.add(t.value);
      else set.delete(t.value);
      c.value = [...set];
      this.onChange(false);
      return true;
    }
    return false;
  }

  handleInput(e) {
    const t = e.target;
    if (t.dataset.role !== 'value' || !t.dataset.path) return false;
    const c = this._node(t.dataset.path);
    const slot = t.dataset.slot === 'value2' ? 'value2' : 'value';
    let v = t.value;
    if ((c.operator === 'in' || c.operator === 'notIn') && slot === 'value') v = v.split(',').map(s => s.trim()).filter(Boolean);
    c[slot] = v;
    this.onChange(false);
    return true;
  }
}
