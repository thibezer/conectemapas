/* ==========================================================================
   ConecteMapas - PrintSideToolbox
   Responsabilidade Única: Barra de ferramentas vertical de inserção rápida e
   alternância de modos na prancheta (padrão QGIS Print Layout / Figma / CAD).
   ========================================================================== */

import { PRINT_ICONS, PRINT_INSERT_GROUPS } from './PrintToolbar.js';

export class PrintSideToolbox {
  static render(composer) {
    const isPan = composer.interactionMode === 'content_pan';

    // Itens de inserção agrupados e ordenados
    const insertItems = PRINT_INSERT_GROUPS.flatMap(g => g.items);

    return `
      <aside class="cm-print-side-toolbox" id="cm-print-side-toolbox" role="toolbar" aria-label="Ferramentas de Layout">
        <!-- Modos de Interação -->
        <div class="cm-stb-group">
          <button type="button"
            class="cm-stb-btn ${!isPan ? 'is-active' : ''}"
            data-stb-mode="layout"
            title="Selecionar e mover elementos (atalho V)"
            aria-label="Modo Layout (Selecionar e mover)"
            aria-pressed="${!isPan ? 'true' : 'false'}">
            <svg class="cm-ptb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m3 3 7 18 3-7 7-3z"/>
            </svg>
            <span class="cm-stb-shortcut">V</span>
          </button>

          <button type="button"
            class="cm-stb-btn ${isPan ? 'is-active' : ''}"
            data-stb-mode="content_pan"
            title="Navegar no mapa selecionado (pan e zoom no terreno - atalho C)"
            aria-label="Modo Navegar Terreno no Mapa"
            aria-pressed="${isPan ? 'true' : 'false'}">
            <svg class="cm-ptb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M8 13V5a1.5 1.5 0 0 1 3 0v6M11 10V3.5a1.5 1.5 0 0 1 3 0V11M14 10.5V5a1.5 1.5 0 0 1 3 0v8M8 13l-1.6-2.4a1.5 1.5 0 0 0-2.5 1.6L7 18a6 6 0 0 0 5 3h1a6 6 0 0 0 6-6v-2"/>
            </svg>
            <span class="cm-stb-shortcut">C</span>
          </button>
        </div>

        <div class="cm-stb-divider"></div>

        <!-- Inserção de Itens Cartográficos -->
        <div class="cm-stb-group cm-stb-insert-list">
          ${insertItems.map(it => `
            <button type="button"
              class="cm-stb-btn"
              data-stb-insert="${it.type}"
              title="Inserir ${it.label}"
              aria-label="Inserir ${it.label}">
              ${PRINT_ICONS[it.icon] || ''}
            </button>
          `).join('')}
        </div>

        <div class="cm-stb-divider"></div>

        <!-- Gerador de Atlas (Automação de Mapas estilo QGIS) -->
        <div class="cm-stb-group">
          <button type="button"
            class="cm-stb-btn ${composer.atlas?.enabled ? 'is-active' : ''}"
            data-stb-action="toggle-atlas"
            title="Gerador de Atlas Cartográfico (Automação em Lote)"
            aria-label="Gerador de Atlas Cartográfico"
            aria-pressed="${composer.atlas?.enabled ? 'true' : 'false'}">
            <svg class="cm-ptb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              <line x1="9" y1="7" x2="15" y2="7"/>
              <line x1="9" y1="11" x2="13" y2="11"/>
            </svg>
          </button>
        </div>
      </aside>
    `;
  }

  static bind(composer) {
    const toolbox = document.getElementById('cm-print-side-toolbox');
    if (!toolbox) return;

    toolbox.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-stb-mode], button[data-stb-insert], button[data-stb-action]');
      if (!btn) return;

      if (btn.dataset.stbAction === 'toggle-atlas') {
        composer.atlas?.setEnabled(!composer.atlas.enabled);
        return;
      }

      const mode = btn.dataset.stbMode;
      if (mode) {
        composer.setInteractionMode(mode);
        this.updateActiveMode(composer);
        return;
      }

      const insertType = btn.dataset.stbInsert;
      if (insertType) {
        if (e.shiftKey && typeof composer.setPlacementTool === 'function') {
          const next = composer.canvasEngine?.placementType === insertType ? null : insertType;
          composer.setPlacementTool(next);
        } else {
          composer.insertItem(insertType);
        }
      }
    });
  }

  static updateActivePlacementTool(composer) {
    const toolbox = document.getElementById('cm-print-side-toolbox');
    if (!toolbox) return;
    const active = composer.canvasEngine?.placementType || null;
    toolbox.querySelectorAll('[data-stb-insert]').forEach(btn => {
      const match = active && btn.dataset.stbInsert === active;
      btn.classList.toggle('is-placing', !!match);
      btn.setAttribute('aria-pressed', String(!!match));
    });
  }

  static updateActiveMode(composer) {
    const toolbox = document.getElementById('cm-print-side-toolbox');
    if (!toolbox) return;

    const isPan = composer.interactionMode === 'content_pan';
    const layoutBtn = toolbox.querySelector('[data-stb-mode="layout"]');
    const panBtn = toolbox.querySelector('[data-stb-mode="content_pan"]');

    if (layoutBtn) {
      layoutBtn.classList.toggle('is-active', !isPan);
      layoutBtn.setAttribute('aria-pressed', String(!isPan));
    }
    if (panBtn) {
      panBtn.classList.toggle('is-active', isPan);
      panBtn.setAttribute('aria-pressed', String(isPan));
    }
  }
}
