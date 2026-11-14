/* ==========================================================================
   ConecteMapas - PrintShortcutActions
   Responsabilidade Única: executar a ação de um atalho do Layout de Impressão
   (ids do PrintShortcuts) sobre o composer. Devolve true quando tratou a tecla
   (quem chama faz o preventDefault) e false quando não havia nada a fazer.
   ========================================================================== */

import { PrintAlignmentHelper } from './PrintAlignmentHelper.js';
import { PrintToolbar } from './PrintToolbar.js';
import { PrintShortcuts } from './PrintShortcuts.js';

/** Itens com traço personalizável: espessura padrão quando vazia e limite (mesmos do painel). */
const STROKE_RULES = {
  shape: { fallback: 1.5, max: 15 },
  image: { fallback: 0, max: 10 },
  label: { fallback: 0, max: 8 }
};
export const STROKE_STEP = 0.5;
const DOUBLE_TAP_MS = 600;

let lastLayoutKeyAt = 0;

export class PrintShortcutActions {
  /** Aumenta/diminui a espessura da linha dos itens selecionados (shape, imagem, título). */
  static changeStroke(composer, direction) {
    const targets = (composer.getSelectedItems?.() || []).filter(i => !i.locked && STROKE_RULES[i.type]);
    if (!targets.length) return false;
    let changed = false;
    targets.forEach(it => {
      const rule = STROKE_RULES[it.type];
      const raw = it.strokeWidth;
      const current = raw == null || raw === '' ? rule.fallback : (Number(raw) || 0);
      const next = Math.min(rule.max, Math.max(0, Math.round((current + direction * STROKE_STEP) * 2) / 2));
      if (next === current && raw != null && raw !== '') return;
      it.strokeWidth = next;
      composer.refreshItemContent?.(it);
      changed = true;
    });
    if (!changed) return true;
    composer.updatePropertiesPanel?.();
    composer.pushHistoryState?.('Espessura da Linha', { coalesceKey: `stroke:${targets.map(i => i.id).join(',')}` });
    return true;
  }

  static deleteSelection(composer) {
    if (composer.selectedGuide) { composer.deleteSelectedGuide(); return true; }
    const selectedId = composer.selectedItemId;
    if (!selectedId) return false;
    const item = composer.items.find(i => i.id === selectedId);
    if (!item || item.locked) return false;
    const ids = [...(composer.selectedItemIds || [selectedId])];
    if (typeof composer.deleteItems === 'function' && ids.length > 1) composer.deleteItems(ids);
    else composer.deleteItem(selectedId);
    return true;
  }

  static switchSheet(composer, delta) {
    const mgr = composer.sheetsManager;
    const sheets = mgr?.sheets || [];
    if (sheets.length < 2) return false;
    const idx = sheets.findIndex(s => s.id === mgr.activeSheetId);
    const next = sheets[(Math.max(idx, 0) + delta + sheets.length) % sheets.length];
    if (!next) return false;
    mgr.switchToSheet(next.id);
    return true;
  }

  /** Executa a ação `id`. */
  static run(composer, id) {
    if (id.startsWith('insert:')) return PrintToolbar.runAction(composer, id);
    const align = PrintAlignmentHelper;
    switch (id) {
      case 'modeLayout': {
        const now = Date.now();
        if (lastLayoutKeyAt && now - lastLayoutKeyAt < DOUBLE_TAP_MS) {
          lastLayoutKeyAt = 0;
          composer.openVisibilityDialog();
          return true;
        }
        lastLayoutKeyAt = now;
        if (composer.interactionMode === 'content_pan') composer.setInteractionMode('layout');
        return true;
      }
      case 'modeContent':
        composer.setInteractionMode(composer.interactionMode === 'content_pan' ? 'layout' : 'content_pan');
        return true;
      case 'smartGuides': composer.canvasEngine.toggleSmartGuides(); return true;
      case 'lockGuides': composer.setGuidesLocked(!composer.guidesLocked); return true;
      case 'propertiesPanel': composer.togglePropertiesPanel(); return true;
      case 'openShortcuts': composer.openShortcutsDialog?.(); return true;
      case 'atlas': composer.atlas?.setEnabled(!composer.atlas.enabled); return true;

      case 'strokeUp': return this.changeStroke(composer, 1);
      case 'strokeDown': return this.changeStroke(composer, -1);

      case 'undo': composer.undo(); return true;
      case 'redo': composer.redo(); return true;
      case 'duplicate': align.duplicateItem(composer); return true;
      case 'copy': return Boolean(composer.copySelectedItems?.());
      case 'cut': return Boolean(composer.cutSelectedItems?.());
      case 'paste':
        if (!composer.clipboardItems?.length) return false;
        composer.pasteItems?.();
        return true;
      case 'copyStyle': return Boolean(composer.copyItemStyle?.());
      case 'pasteStyle': return Boolean(composer.pasteItemStyle?.());
      case 'delete': return this.deleteSelection(composer);

      case 'bringToFront': composer.bringToFront(); return true;
      case 'sendToBack': composer.sendToBack(); return true;
      case 'bringForward': composer.bringForward(); return true;
      case 'sendBackward': composer.sendBackward(); return true;

      case 'alignLeft': composer.alignLeft(); return true;
      case 'alignRight': composer.alignRight(); return true;
      case 'alignTop': composer.alignTop(); return true;
      case 'alignBottom': composer.alignBottom(); return true;
      case 'alignCenterH': composer.alignCenterH(); return true;
      case 'alignCenterV': composer.alignCenterV(); return true;
      case 'distributeH': composer.distributeH(); return true;
      case 'distributeV': composer.distributeV(); return true;
      case 'fitToMargins': align.fitToMargins(composer); return true;
      case 'matchWidth': align.matchWidth(composer); return true;
      case 'matchHeight': align.matchHeight(composer); return true;

      case 'zoomFit': composer.canvasEngine.zoomFit(); return true;
      case 'zoomIn': composer.canvasEngine.zoomIn(); return true;
      case 'zoomOut': composer.canvasEngine.zoomOut(); return true;

      case 'prevSheet': return this.switchSheet(composer, -1);
      case 'nextSheet': return this.switchSheet(composer, 1);
      case 'exportPdf': return PrintToolbar.runAction(composer, 'export:pdf');
      case 'exportPng': return PrintToolbar.runAction(composer, 'export:png');
      default: return false;
    }
  }

  /**
   * Trata a tecla pelo registro de atalhos. `ctx`: { readOnly, dialogOpen }.
   * Devolve true se havia ação para a combinação e ela foi tratada.
   */
  static handleKeyEvent(composer, e, { readOnly = false, dialogOpen = false } = {}) {
    const id = PrintShortcuts.actionForEvent(e);
    if (!id) return false;
    const def = PrintShortcuts.getAction(id);
    if (dialogOpen && !def?.dialogOk) return false;
    if (readOnly && (def?.edit || id.startsWith('insert:'))) return false;
    if (e.repeat && (id === 'modeLayout' || id.startsWith('insert:') || id === 'atlas')) return false;
    const handled = this.run(composer, id);
    if (handled) e.preventDefault();
    return handled;
  }
}
