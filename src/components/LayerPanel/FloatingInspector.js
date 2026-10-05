/* ==========================================================================
   ConecteMapas - FloatingInspector
   Responsabilidade Única: Gerenciamento da janela flutuante arrastável (Workbench)
   Enquanto flutuante, a barra lateral exibe apenas um aviso (sem duplicar o inspetor),
   e os eventos são ligados somente dentro desta janela.
   ========================================================================== */

import { FeatureInspectorTab } from './FeatureInspectorTab.js';

export class FloatingInspector {
  static toggle(panel) {
    panel.isFloating = !panel.isFloating;
    let floatWin = document.getElementById('cm-floating-inspector-window');
    if (panel.isFloating) {
      if (!floatWin) {
        floatWin = document.createElement('div');
        floatWin.id = 'cm-floating-inspector-window';
        floatWin.className = 'cm-floating-window';
        document.body.appendChild(floatWin);
      }
      floatWin.style.display = 'flex';
    } else if (floatWin) {
      floatWin.style.display = 'none';
      floatWin.innerHTML = '';
    }
    // updateContent redesenha a barra lateral e, se flutuante, esta janela
    panel.updateContent();
  }

  static renderContent(panel) {
    const floatWin = document.getElementById('cm-floating-inspector-window');
    if (!floatWin || !panel.isFloating) return;

    const name = panel.selectedFeature ? panel.escapeHtml(panel.selectedFeature.name || '') : '';
    floatWin.innerHTML = `
      <div class="cm-floating-header" id="cm-floating-header-handle">
        <div class="cm-floating-title">
          <span>🔍 Inspetor Workbench</span>
          ${name ? `<span style="font-size: 10px; opacity: 0.7;">(${name})</span>` : ''}
        </div>
        <div style="display: flex; gap: 4px; align-items: center;">
          <button data-float="dock" class="cm-native-select" style="padding: 1px 5px; font-size: 10px;" title="Acoplar de volta na barra lateral">📌 Acoplar</button>
          <button data-float="close" class="cm-vertex-del-btn" style="font-size: 16px; padding: 0 4px;" title="Fechar">×</button>
        </div>
      </div>
      <div class="cm-floating-body">
        ${FeatureInspectorTab.render(panel, 'floating')}
      </div>
    `;

    floatWin.querySelector('[data-float="dock"]')?.addEventListener('click', () => this.toggle(panel));
    floatWin.querySelector('[data-float="close"]')?.addEventListener('click', () => this.toggle(panel));

    FeatureInspectorTab.bindEvents(panel, floatWin.querySelector('.cm-floating-body'));
    this.makeDraggable(floatWin);
  }

  static makeDraggable(win) {
    const header = win.querySelector('#cm-floating-header-handle');
    if (!header) return;

    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;

    header.onmousedown = (e) => {
      if (e.target.closest('button')) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = win.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      win.style.right = 'auto';
      win.style.left = `${initialLeft}px`;
      win.style.top = `${initialTop}px`;

      document.onmousemove = (ev) => {
        if (!isDragging) return;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;

        const maxLeft = window.innerWidth - win.offsetWidth - 10;
        const maxTop = window.innerHeight - win.offsetHeight - 10;

        const newLeft = Math.max(10, Math.min(maxLeft, initialLeft + dx));
        const newTop = Math.max(10, Math.min(maxTop, initialTop + dy));

        win.style.left = `${newLeft}px`;
        win.style.top = `${newTop}px`;
      };

      document.onmouseup = () => {
        isDragging = false;
        document.onmousemove = null;
        document.onmouseup = null;
      };
    };
  }
}
