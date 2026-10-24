/* ==========================================================================
   ConecteMapas - AdvancedSearchPanel
   Janela flutuante de Busca Avançada: construtor visual de critérios (E/OU/NÃO,
   grupos aninhados), contagem ao vivo, seleção dos resultados e ações em lote
   (mover de camada, aplicar cores, bloquear, ocultar, excluir). A lógica fica em
   FeatureQuery e BatchActions; este componente só monta a interface.
   ========================================================================== */

import './AdvancedSearchPanel.css';
import { FeatureQuery } from '../../services/FeatureQuery.js';
import { QueryBuilder } from './QueryBuilder.js';

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
    // Construtor de critérios (compartilhado com os filtros das vistas de prancha)
    this.builder = new QueryBuilder({
      getQuery: () => this.query,
      onChange: (structural) => (structural ? this._rerender() : this._scheduleRun())
    });
  }

  static emptyQuery() {
    return QueryBuilder.emptyQuery();
  }

  static emptyCriterion() {
    return QueryBuilder.emptyCriterion();
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
    return QueryBuilder.hasActiveCriteria(node);
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

        <div class="cm-adv-query">${this.builder.render(app)}</div>

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
      if (act === 'close') return this.close();
      if (this.builder.handleClick(e)) return;
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
      this.builder.handleChange(e);
    });

    root.addEventListener('input', (e) => this.builder.handleInput(e));

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
