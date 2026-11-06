/* ==========================================================================
   ConecteMapas - PrintStatusBar
   Responsabilidade Única: Barra de status inferior do Layout de Impressão
   exibindo dados da folha ativa, coordenadas milimétricas do cursor (X/Y),
   nível de zoom e estado de sincronização.
   ========================================================================== */

import { PrintItemsManager } from './PrintItemsManager.js';

export class PrintStatusBar {
  static render(composer) {
    const esc = PrintItemsManager.escapeHtml;
    const curSheet = composer.sheetsManager?.getCurrentSheet?.() || { name: 'Prancha 01' };
    const paper = composer.paperSize || { name: 'A4 Paisagem', width: 297, height: 210 };
    const zoomPct = Math.round((composer.canvasEngine?.zoom || 1) * 100);

    return `
      <footer class="cm-print-statusbar" id="cm-print-statusbar" role="status" aria-label="Status do Layout">
        <div class="cm-psb-left">
          <span class="cm-psb-item cm-psb-sheet-info" id="cm-psb-sheet-info">
            <svg class="cm-psb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>
            </svg>
            <strong>${esc(curSheet.name || 'Prancha')}</strong> · ${esc(paper.name || 'A4')} (${paper.width}×${paper.height} mm)
          </span>
        </div>

        <div class="cm-psb-center">
          <span class="cm-psb-item cm-psb-coords" id="cm-psb-coords">
            <span class="cm-psb-coord-lbl">X:</span> <span id="cm-psb-coord-x">--</span> mm
            <span class="cm-psb-sep-dot">·</span>
            <span class="cm-psb-coord-lbl">Y:</span> <span id="cm-psb-coord-y">--</span> mm
          </span>
        </div>

        <div class="cm-psb-right">
          <span class="cm-psb-item" id="cm-psb-zoom">
            Zoom: <strong id="cm-psb-zoom-val">${zoomPct}%</strong>
          </span>
          <span class="cm-psb-sep"></span>
          <span class="cm-psb-item cm-psb-cloud" id="cm-psb-cloud-status">
            ${composer.readOnly ? '🔒 Somente Leitura' : '🟢 Sincronizado'}
          </span>
        </div>
      </footer>
    `;
  }

  static bind(composer) {
    const sheet = document.getElementById('cm-print-paper-sheet');
    const coordX = document.getElementById('cm-psb-coord-x');
    const coordY = document.getElementById('cm-psb-coord-y');

    if (sheet && coordX && coordY) {
      sheet.addEventListener('mousemove', (e) => {
        const rect = sheet.getBoundingClientRect();
        const pxPerMm = (composer.canvasEngine?.mmToPx || 3.78);
        if (pxPerMm <= 0) return;

        const xMm = (e.clientX - rect.left) / pxPerMm;
        const yMm = (e.clientY - rect.top) / pxPerMm;

        const paperW = composer.paperSize?.width || 297;
        const paperH = composer.paperSize?.height || 210;

        const clampedX = Math.max(0, Math.min(paperW, Math.round(xMm * 10) / 10));
        const clampedY = Math.max(0, Math.min(paperH, Math.round(yMm * 10) / 10));

        coordX.textContent = clampedX.toFixed(1);
        coordY.textContent = clampedY.toFixed(1);
      });

      sheet.addEventListener('mouseleave', () => {
        coordX.textContent = '--';
        coordY.textContent = '--';
      });
    }
  }

  static update(composer) {
    const info = document.getElementById('cm-psb-sheet-info');
    const zoomVal = document.getElementById('cm-psb-zoom-val');
    const cloudStatus = document.getElementById('cm-psb-cloud-status');

    if (info) {
      const esc = PrintItemsManager.escapeHtml;
      const curSheet = composer.sheetsManager?.getCurrentSheet?.() || { name: 'Prancha 01' };
      const paper = composer.paperSize || { name: 'A4 Paisagem', width: 297, height: 210 };
      info.innerHTML = `
        <svg class="cm-psb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>
        </svg>
        <strong>${esc(curSheet.name || 'Prancha')}</strong> · ${esc(paper.name || 'A4')} (${paper.width}×${paper.height} mm)
      `;
    }

    if (zoomVal && composer.canvasEngine) {
      zoomVal.textContent = `${Math.round(composer.canvasEngine.zoom * 100)}%`;
    }

    if (cloudStatus) {
      cloudStatus.textContent = composer.readOnly ? '🔒 Somente Leitura' : '🟢 Sincronizado';
    }
  }
}
