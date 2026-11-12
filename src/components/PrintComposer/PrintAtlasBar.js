/* ==========================================================================
   ConecteMapas - PrintAtlasBar
   Responsabilidade Única: Barra de navegação e exportação em lote do Atlas
   (padrão QGIS Atlas Toolbar).
   ========================================================================== */

export class PrintAtlasBar {
  static render(composer) {
    const atlas = composer.atlas;
    const enabled = atlas?.enabled || false;
    const features = atlas?.getCoverageFeatures?.() || [];
    const curFeat = atlas?.getCurrentFeature?.();
    const curIdx = (atlas?.currentIndex || 0) + 1;
    const total = features.length;

    return `
      <div id="cm-print-atlas-bar" class="cm-print-atlas-bar ${enabled ? '' : 'hidden'}" role="toolbar" aria-label="Navegação do Atlas">
        <div class="cm-atlas-left">
          <span class="cm-atlas-badge">
            <svg class="cm-atlas-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
            <strong>ATLAS</strong>
          </span>

          <div class="cm-atlas-nav-controls">
            <button type="button" class="cm-atlas-btn cm-atlas-btn-icon" data-atlas-nav="first" title="Primeira feição" ${curIdx <= 1 ? 'disabled' : ''}>
              ⏮
            </button>
            <button type="button" class="cm-atlas-btn cm-atlas-btn-icon" data-atlas-nav="prev" title="Feição anterior" ${curIdx <= 1 ? 'disabled' : ''}>
              ◀
            </button>

            <span class="cm-atlas-page-indicator">
              <strong data-atlas-cur>${total ? curIdx : 0}</strong> / <span data-atlas-total>${total}</span>:
              <span class="cm-atlas-feat-name" data-atlas-name>${curFeat ? String(curFeat.name || curFeat.id).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) : '(Nenhuma feição)'}</span>
            </span>

            <button type="button" class="cm-atlas-btn cm-atlas-btn-icon" data-atlas-nav="next" title="Próxima feição" ${curIdx >= total ? 'disabled' : ''}>
              ▶
            </button>
            <button type="button" class="cm-atlas-btn cm-atlas-btn-icon" data-atlas-nav="last" title="Última feição" ${curIdx >= total ? 'disabled' : ''}>
              ⏭
            </button>
          </div>
        </div>

        <div class="cm-atlas-right">
          <ui-botao-primario inline tamanho="sm" id="btn-export-atlas-pdf" title="Exportar todas as feições do Atlas em um único arquivo PDF">
            <svg class="cm-ptb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 15h8"/>
            </svg>
            Exportar Caderno PDF (${total})
          </ui-botao-primario>

          <button type="button" class="cm-atlas-close-btn" id="btn-close-atlas-bar" title="Desativar Atlas">✕</button>
        </div>
      </div>
    `;
  }

  static bind(composer) {
    const bar = document.getElementById('cm-print-atlas-bar');
    if (!bar) return;

    bar.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-atlas-nav]');
      if (btn) {
        const nav = btn.dataset.atlasNav;
        if (nav === 'first') composer.atlas.goTo(0);
        else if (nav === 'prev') composer.atlas.prev();
        else if (nav === 'next') composer.atlas.next();
        else if (nav === 'last') composer.atlas.goTo(composer.atlas.getCoverageFeatures().length - 1);
        return;
      }

      if (e.target.closest('#btn-export-atlas-pdf')) {
        composer.atlas.exportAtlasPDF(composer.exportDpi || 300);
        return;
      }

      if (e.target.closest('#btn-close-atlas-bar')) {
        composer.atlas.setEnabled(false);
      }
    });
  }
}
