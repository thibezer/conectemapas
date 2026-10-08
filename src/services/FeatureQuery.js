/* ==========================================================================
   ConecteMapas - FeatureQuery
   Motor de busca avançada de feições (puro, sem DOM): critérios {campo, operador,
   valor} combinados por E/OU em grupos aninhados. Devolve ids que alimentam a
   seleção e as ações em lote.

   Consulta:
     grupo    = { op: 'AND' | 'OR', not?: boolean, items: (grupo | critério)[] }
     critério = { field, operator, value?, value2? }

   Campos: name, type, layer, category, createdBy, createdAt, visible, locked,
   fillColor, strokeColor, opacity, area (m²), length (m), vertices e `prop:<chave>`
   para qualquer chave de feature.properties.
   Critérios incompletos (sem valor) são ignorados, então a UI pode consultar ao vivo.
   ========================================================================== */

import { FeatureGeometryUtils } from './MapEngine/FeatureGeometryUtils.js';

const TEXT_OPS = ['contains', 'notContains', 'equals', 'notEquals', 'startsWith', 'endsWith', 'regex', 'empty', 'notEmpty'];
const NUM_OPS = ['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'between', 'empty', 'notEmpty'];
const DATE_OPS = ['before', 'after', 'between', 'empty', 'notEmpty'];
const SET_OPS = ['in', 'notIn'];
const BOOL_OPS = ['isTrue', 'isFalse'];
const COLOR_OPS = ['equals', 'notEquals', 'in', 'notIn', 'empty', 'notEmpty'];

/** Operadores que não precisam de valor. */
const NO_VALUE_OPS = new Set(['empty', 'notEmpty', 'isTrue', 'isFalse']);

export const OPERATORS_BY_TYPE = {
  text: TEXT_OPS,
  number: NUM_OPS,
  date: DATE_OPS,
  set: SET_OPS,
  boolean: BOOL_OPS,
  color: COLOR_OPS
};

export const FIELD_DEFS = [
  { id: 'name', label: 'Nome', type: 'text' },
  { id: 'type', label: 'Tipo de geometria', type: 'set' },
  { id: 'layer', label: 'Camada', type: 'set' },
  { id: 'category', label: 'Categoria', type: 'text' },
  { id: 'createdBy', label: 'Autor', type: 'text' },
  { id: 'createdAt', label: 'Criado em', type: 'date' },
  { id: 'visible', label: 'Visível', type: 'boolean' },
  { id: 'locked', label: 'Bloqueada', type: 'boolean' },
  { id: 'fillColor', label: 'Cor de preenchimento', type: 'color' },
  { id: 'strokeColor', label: 'Cor do traço', type: 'color' },
  { id: 'opacity', label: 'Opacidade do preenchimento', type: 'number' },
  { id: 'area', label: 'Área (m²)', type: 'number' },
  { id: 'length', label: 'Comprimento / perímetro (m)', type: 'number' },
  { id: 'vertices', label: 'Nº de vértices', type: 'number' }
];

const PROP_PREFIX = 'prop:';

/** Minúsculas e sem acentos, para busca tolerante. */
export function normalizeText(value) {
  if (value == null) return '';
  return String(value).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Extrai o número inicial de valores como "12,5 ha" ou "1.234,5 m²". */
export function parseNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value == null) return null;
  const m = String(value).trim().match(/^-?\d[\d.,]*/);
  if (!m) return null;
  let s = m[0];
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function normalizeColor(value) {
  if (value == null || value === '') return '';
  let s = String(value).trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(s)) s = '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
  return s;
}

function parseDate(value) {
  if (value == null || value === '') return null;
  const t = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

/** Fim do dia para datas "YYYY-MM-DD" usadas como limite superior. */
function parseDateEnd(value) {
  const t = parseDate(value);
  if (t == null) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value).trim()) ? t + 86400000 - 1 : t;
}

function isIncomplete(c) {
  if (!c || !c.field || !c.operator) return true;
  if (NO_VALUE_OPS.has(c.operator)) return false;
  const empty = (v) => v == null || v === '' || (Array.isArray(v) && v.length === 0);
  if (empty(c.value)) return true;
  return c.operator === 'between' && empty(c.value2);
}

function fieldType(field) {
  if (field.startsWith(PROP_PREFIX)) return 'prop';
  return FIELD_DEFS.find(d => d.id === field)?.type || null;
}

/** Valor bruto da feição para o campo (camada resolvida via ctx.layerMap). */
function readField(feat, field, ctx) {
  if (field.startsWith(PROP_PREFIX)) return feat.properties?.[field.slice(PROP_PREFIX.length)];
  switch (field) {
    case 'name': return feat.name;
    case 'type': return feat.type;
    case 'layer': return feat.layerId;
    case 'category': return feat.category;
    case 'createdBy': return feat.createdBy;
    case 'createdAt': return feat.createdAt;
    case 'visible': return feat.visible !== false;
    case 'locked': return feat.locked === true;
    case 'fillColor': return feat.style?.fillColor ?? feat.style?.textColor ?? feat.color;
    case 'strokeColor': return feat.style?.strokeColor ?? feat.style?.color ?? feat.color;
    case 'opacity': return feat.style?.fillOpacity ?? (feat.type === 'LineString' ? 1 : 0.35);
    case 'area': return geometryMetric(feat, ctx, 'area');
    case 'length': return geometryMetric(feat, ctx, 'length');
    case 'vertices': return FeatureGeometryUtils.countVertices(feat);
    default: return undefined;
  }
}

function geometryMetric(feat, ctx, kind) {
  const cache = ctx.metricCache;
  const key = feat.id + ':' + kind;
  if (cache.has(key)) return cache.get(key);
  let v = null;
  try {
    if (feat.type === 'Polygon') {
      v = kind === 'area'
        ? FeatureGeometryUtils.calculatePolygonArea(feat.coordinates)
        : FeatureGeometryUtils.calculatePolygonPerimeter(feat.coordinates);
    } else if (feat.type === 'LineString') {
      v = kind === 'length' ? FeatureGeometryUtils.calculatePolylineLength(feat.coordinates) : null;
    } else if (feat.type === 'Circle') {
      const r = Number(feat.radius) || 0;
      v = kind === 'area' ? Math.PI * r * r : 2 * Math.PI * r;
    }
  } catch { v = null; }
  if (v != null && !Number.isFinite(v)) v = null;
  cache.set(key, v);
  return v;
}

function toList(value) {
  return (Array.isArray(value) ? value : [value]).filter(v => v != null && v !== '');
}

/** Compila um critério em predicado. Devolve null se for incompleto ou inválido. */
function compileCriterion(c, ctx) {
  if (isIncomplete(c)) return null;
  const { field, operator } = c;
  const kind = fieldType(field);
  if (!kind) return null;
  // Campos `prop:` aceitam operadores de texto e numéricos; o numérico só vale se ambos forem números
  const isLayer = field === 'layer';

  const read = (feat) => readField(feat, field, ctx);
  const isEmptyVal = (v) => v == null || v === '' || (typeof v === 'number' && !Number.isFinite(v));

  if (operator === 'empty') return (f) => isEmptyVal(read(f));
  if (operator === 'notEmpty') return (f) => !isEmptyVal(read(f));
  if (operator === 'isTrue') return (f) => read(f) === true;
  if (operator === 'isFalse') return (f) => read(f) === false;

  if (operator === 'in' || operator === 'notIn') {
    const wanted = new Set(toList(c.value).map(v => (kind === 'color' ? normalizeColor(v) : normalizeText(v))));
    const hit = (f) => {
      const v = read(f);
      if (kind === 'color') return wanted.has(normalizeColor(v));
      if (isLayer) {
        const name = ctx.layerNames.get(v);
        return wanted.has(normalizeText(v)) || (name != null && wanted.has(normalizeText(name)));
      }
      return wanted.has(normalizeText(v));
    };
    return operator === 'in' ? hit : (f) => !hit(f);
  }

  if (['eq', 'neq', 'lt', 'lte', 'gt', 'gte'].includes(operator)) {
    const target = parseNumber(c.value);
    if (target == null) return null;
    return (f) => {
      const n = parseNumber(read(f));
      if (n == null) return operator === 'neq';
      switch (operator) {
        case 'eq': return n === target;
        case 'neq': return n !== target;
        case 'lt': return n < target;
        case 'lte': return n <= target;
        case 'gt': return n > target;
        default: return n >= target;
      }
    };
  }

  if (operator === 'between') {
    if (kind === 'date') {
      const a = parseDate(c.value);
      const b = parseDateEnd(c.value2);
      if (a == null || b == null) return null;
      const lo = Math.min(a, b), hi = Math.max(a, b);
      return (f) => { const t = parseDate(read(f)); return t != null && t >= lo && t <= hi; };
    }
    const a = parseNumber(c.value), b = parseNumber(c.value2);
    if (a == null || b == null) return null;
    const lo = Math.min(a, b), hi = Math.max(a, b);
    return (f) => { const n = parseNumber(read(f)); return n != null && n >= lo && n <= hi; };
  }

  if (operator === 'before' || operator === 'after') {
    const t = operator === 'before' ? parseDate(c.value) : parseDateEnd(c.value);
    if (t == null) return null;
    return (f) => {
      const v = parseDate(read(f));
      if (v == null) return false;
      return operator === 'before' ? v < t : v > t;
    };
  }

  if (operator === 'regex') {
    let re;
    try { re = new RegExp(String(c.value), 'i'); } catch { return () => false; }
    return (f) => { const v = read(f); return v != null && re.test(String(v)); };
  }

  // Operadores de texto (também usados em cor e camada por nome)
  const needle = kind === 'color' ? normalizeColor(c.value) : normalizeText(c.value);
  const hay = (f) => {
    const v = read(f);
    if (kind === 'color') return normalizeColor(v);
    if (isLayer) return normalizeText(ctx.layerNames.get(v) ?? v);
    return normalizeText(v);
  };
  switch (operator) {
    case 'contains': return (f) => hay(f).includes(needle);
    case 'notContains': return (f) => !hay(f).includes(needle);
    case 'equals': return (f) => hay(f) === needle;
    case 'notEquals': return (f) => hay(f) !== needle;
    case 'startsWith': return (f) => hay(f).startsWith(needle);
    case 'endsWith': return (f) => hay(f).endsWith(needle);
    default: return null;
  }
}

function isGroup(node) {
  return node && Array.isArray(node.items);
}

/** Compila grupo/critério. Devolve null quando não restringe nada. */
function compileNode(node, ctx) {
  if (isGroup(node)) {
    const preds = node.items.map(n => compileNode(n, ctx)).filter(Boolean);
    if (preds.length === 0) return null;
    const or = String(node.op).toUpperCase() === 'OR';
    const combined = or
      ? (f) => { for (const p of preds) if (p(f)) return true; return false; }
      : (f) => { for (const p of preds) if (!p(f)) return false; return true; };
    return node.not ? (f) => !combined(f) : combined;
  }
  return compileCriterion(node, ctx);
}

export class FeatureQuery {
  /**
   * Executa a consulta.
   * @param {Object[]} features
   * @param {Object} query grupo raiz (vazio = todas as feições do escopo)
   * @param {Object} [options]
   * @param {Object[]} [options.layers]
   * @param {'all'|'visible'|'activeLayer'} [options.scope]
   * @param {string} [options.activeLayerId]
   * @returns {{ids: string[], features: Object[], total: number}}
   */
  static run(features, query, options = {}) {
    const list = Array.isArray(features) ? features : [];
    const layers = options.layers || [];
    const ctx = {
      metricCache: new Map(),
      layerNames: new Map(layers.map(l => [l.id, l.name]))
    };

    let inScope = list;
    if (options.scope === 'visible') {
      const hidden = new Set(layers.filter(l => l.visible === false).map(l => l.id));
      inScope = list.filter(f => f.visible !== false && !hidden.has(f.layerId));
    } else if (options.scope === 'activeLayer') {
      inScope = list.filter(f => f.layerId === options.activeLayerId);
    }

    const pred = query ? compileNode(query, ctx) : null;
    const matched = pred ? inScope.filter(f => f && pred(f)) : inScope.filter(Boolean);
    return { ids: matched.map(f => f.id), features: matched, total: inScope.length };
  }

  /** Lista problemas da consulta (ex.: regex inválida, operador incompatível com o campo). */
  static validate(query) {
    const errors = [];
    const walk = (node, path) => {
      if (isGroup(node)) {
        node.items.forEach((n, i) => walk(n, `${path}.${i}`));
        return;
      }
      if (!node || !node.field || !node.operator) return;
      const kind = fieldType(node.field);
      if (!kind) { errors.push({ path, message: `Campo desconhecido: ${node.field}` }); return; }
      if (kind !== 'prop' && !OPERATORS_BY_TYPE[kind].includes(node.operator)) {
        errors.push({ path, message: `Operador "${node.operator}" não se aplica ao campo "${node.field}".` });
      }
      if (node.operator === 'regex' && node.value) {
        try { new RegExp(String(node.value)); } catch (e) { errors.push({ path, message: `Expressão regular inválida: ${e.message}` }); }
      }
    };
    walk(query, 'root');
    return errors;
  }

  /** Chaves de feature.properties existentes, com contagem, para o seletor de campos da UI. */
  static discoverProperties(features) {
    const counts = new Map();
    for (const f of features || []) {
      const props = f && f.properties;
      if (!props || typeof props !== 'object') continue;
      for (const k of Object.keys(props)) counts.set(k, (counts.get(k) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([key, count]) => ({ id: PROP_PREFIX + key, label: key, count, type: 'prop' }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pt-BR'));
  }
}
