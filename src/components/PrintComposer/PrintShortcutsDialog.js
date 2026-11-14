/* ==========================================================================
   ConecteMapas - PrintShortcutsDialog
   Responsabilidade Única: janela onde cada usuário vê e troca os atalhos do
   Layout de Impressão (grava em PrintShortcuts, por navegador) e atualização
   das dicas dos botões quando uma tecla muda.
   ========================================================================== */

import { PrintShortcuts, SHORTCUT_GROUPS, SHORTCUT_ACTIONS } from './PrintShortcuts.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class PrintShortcutsDialog {
  constructor(composer) {
    this.composer = composer;
    this.root = null;
    this.recordingId = null;
    this.status = '';
    this.filter = '';
    this.unsubscribe = null;
    this.onKeyDown = (e) => this.handleKey(e);
  }

  isOpen() {
    return Boolean(this.root && this.root.isConnected && !this.root.hidden);
  }

  /** Atualiza título e tecla mostrada dos botões marcados com `data-sc` / `data-sc-kbd`. */
  static applyHints(root = typeof document !== 'undefined' ? document : null) {
    if (!root?.querySelectorAll) return;
    root.querySelectorAll('[data-sc]').forEach((el) => {
      el.title = PrintShortcuts.titleFor(el.dataset.sc, el.dataset.scTitle || '');
    });
    root.querySelectorAll('[data-sc-kbd]').forEach((el) => {
      const first = PrintShortcuts.keysFor(el.dataset.scKbd)[0];
      el.textContent = first ? PrintShortcuts.prettyCombo(first) : '';
    });
  }

  /** HTML da janela. `recordingId` = linha esperando uma tecla; `filter` = texto da busca. */
  static renderHTML({ recordingId = null, status = '', filter = '' } = {}) {
    const q = filter.trim().toLowerCase();
    const groups = SHORTCUT_GROUPS.map((g) => {
      const rows = SHORTCUT_ACTIONS
        .filter((a) => a.group === g.id && (!q || a.label.toLowerCase().includes(q) || PrintShortcuts.keysFor(a.id).some((k) => PrintShortcuts.prettyCombo(k).toLowerCase().includes(q))))
        .map((a) => {
          const keys = PrintShortcuts.keysFor(a.id);
          const recording = recordingId === a.id;
          const custom = PrintShortcuts.isCustomized(a.id);
          const shown = recording
            ? 'Pressione a tecla… (Esc cancela)'
            : (keys.length ? keys.map((k) => `<kbd>${esc(PrintShortcuts.prettyCombo(k))}</kbd>`).join(' ') : '<span class="cm-psc-none">sem atalho</span>');
          return `
            <div class="cm-psc-row${custom ? ' is-custom' : ''}" data-psc-id="${esc(a.id)}">
              <span class="cm-psc-label">${esc(a.label)}</span>
              <button type="button" class="cm-psc-key${recording ? ' is-recording' : ''}" data-psc-record="${esc(a.id)}" aria-label="Alterar atalho: ${esc(a.label)}">${shown}</button>
              <button type="button" class="cm-psc-mini" data-psc-clear="${esc(a.id)}" title="Remover atalho" aria-label="Remover atalho"${keys.length ? '' : ' disabled'}>×</button>
              <button type="button" class="cm-psc-mini" data-psc-reset="${esc(a.id)}" title="Voltar ao padrão" aria-label="Voltar ao padrão"${custom ? '' : ' disabled'}>↺</button>
            </div>`;
        }).join('');
      return rows ? `<section class="cm-psc-group"><h3>${esc(g.label)}</h3>${rows}</section>` : '';
    }).join('');
    return `
      <div class="cm-psc-card" tabindex="-1">
        <header class="cm-psc-header">
          <div>
            <h2 id="cm-psc-title">Atalhos do layout</h2>
            <p class="cm-psc-sub">Clique na tecla de uma ação e digite a nova combinação. Vale para você, neste navegador.</p>
          </div>
          <button type="button" class="cm-psc-mini" data-psc-close title="Fechar (Esc)" aria-label="Fechar">×</button>
        </header>
        <div class="cm-psc-toolbar">
          <input type="search" class="cm-psc-filter" data-psc-filter placeholder="Filtrar ações ou teclas…" value="${esc(filter)}" aria-label="Filtrar atalhos" />
          <button type="button" class="cm-psc-btn" data-psc-reset-all>Restaurar todos os padrões</button>
        </div>
        <div class="cm-psc-body">${groups || '<p class="cm-psc-empty">Nenhum atalho encontrado.</p>'}</div>
        <footer class="cm-psc-footer">
          <span class="cm-psc-status" role="status" aria-live="polite">${esc(status)}</span>
          <span class="cm-psc-fixed">Fixos: Esc, setas (mover 1 mm; com Shift, 5 mm), Ctrl+S, Ctrl+A.</span>
        </footer>
      </div>`;
  }

  open() {
    if (!this.root || !this.root.isConnected) this.mount();
    this.recordingId = null;
    this.status = '';
    this.root.hidden = false;
    this.paint();
    this.root.querySelector('.cm-psc-card')?.focus();
    return true;
  }

  close() {
    this.recordingId = null;
    if (this.root) this.root.hidden = true;
  }

  mount() {
    const host = document.getElementById('cm-print-composer-modal') || document.body;
    this.root = document.createElement('div');
    this.root.className = 'cm-psc-overlay';
    this.root.id = 'cm-print-shortcuts-dialog';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-labelledby', 'cm-psc-title');
    this.root.hidden = true;
    host.appendChild(this.root);
    this.root.addEventListener('click', (e) => this.handleClick(e));
    this.root.addEventListener('input', (e) => {
      if (!e.target.matches?.('[data-psc-filter]')) return;
      this.filter = e.target.value;
      this.paint({ keepFocus: true });
    });
    // Captura: com a janela aberta nenhuma tecla chega à prancheta nem ao mapa
    window.removeEventListener('keydown', this.onKeyDown, true);
    window.addEventListener('keydown', this.onKeyDown, true);
    this.unsubscribe?.();
    this.unsubscribe = PrintShortcuts.onChange(() => PrintShortcutsDialog.applyHints());
  }

  paint({ keepFocus = false } = {}) {
    if (!this.root) return;
    const body = this.root.querySelector('.cm-psc-body');
    const prevScroll = body?.scrollTop || 0;
    const hadFilterFocus = keepFocus && document.activeElement?.matches?.('[data-psc-filter]');
    const caret = hadFilterFocus ? document.activeElement.selectionStart : null;
    this.root.innerHTML = PrintShortcutsDialog.renderHTML({ recordingId: this.recordingId, status: this.status, filter: this.filter });
    const nextBody = this.root.querySelector('.cm-psc-body');
    if (nextBody) nextBody.scrollTop = prevScroll;
    if (hadFilterFocus) {
      const input = this.root.querySelector('[data-psc-filter]');
      input?.focus();
      if (caret != null) input?.setSelectionRange(caret, caret);
    } else if (this.recordingId) {
      this.root.querySelector('.cm-psc-key.is-recording')?.focus();
    }
  }

  setStatus(text) {
    this.status = text;
    const el = this.root?.querySelector('.cm-psc-status');
    if (el) el.textContent = text;
  }

  handleClick(e) {
    const t = e.target;
    if (t === this.root || t.closest('[data-psc-close]')) { this.close(); return; }
    const rec = t.closest('[data-psc-record]');
    if (rec) {
      this.recordingId = this.recordingId === rec.dataset.pscRecord ? null : rec.dataset.pscRecord;
      this.status = '';
      this.paint();
      return;
    }
    const clear = t.closest('[data-psc-clear]');
    if (clear) {
      PrintShortcuts.clearCombo(clear.dataset.pscClear);
      this.status = 'Atalho removido.';
      this.paint();
      return;
    }
    const reset = t.closest('[data-psc-reset]');
    if (reset) {
      PrintShortcuts.reset(reset.dataset.pscReset);
      this.status = 'Voltou ao padrão.';
      this.paint();
      return;
    }
    if (t.closest('[data-psc-reset-all]')) {
      PrintShortcuts.reset();
      this.recordingId = null;
      this.status = 'Todos os atalhos voltaram ao padrão.';
      this.paint();
    }
  }

  handleKey(e) {
    if (!this.isOpen()) return;
    if (this.recordingId) {
      // Gravando: a tecla é do atalho, nunca da prancheta (nem do campo focado)
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.key === 'Escape') { this.recordingId = null; this.status = 'Cancelado.'; this.paint(); return; }
      const combo = PrintShortcuts.comboFromEvent(e);
      if (!combo) return; // só um modificador apertado: espera a tecla
      const id = this.recordingId;
      const result = PrintShortcuts.setCombo(id, combo);
      this.recordingId = null;
      if (!result.ok) this.status = result.error;
      else {
        const other = result.displaced ? PrintShortcuts.getAction(result.displaced)?.label : null;
        this.status = other
          ? `${PrintShortcuts.prettyCombo(combo)} agora é desta ação; "${other}" ficou sem atalho.`
          : `Atalho definido: ${PrintShortcuts.prettyCombo(combo)}.`;
      }
      this.paint();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.close();
    }
    // Demais teclas seguem o caminho normal: a prancheta ignora tudo enquanto a janela está aberta
  }
}
