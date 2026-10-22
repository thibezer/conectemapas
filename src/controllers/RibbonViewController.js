/* ==========================================================================
   ConecteMapas - RibbonViewController
   Botões das abas Projeto e Dados que não dependem da seleção: histórico,
   enquadrar, snap, zoom automático e mostrar/ocultar painéis. Reaproveita as
   ações da barra de desenho e os painéis; aqui só roteia e espelha o estado.
   ========================================================================== */

import { computeViewState } from '../components/ViewRibbon.js';

/** Botões que são só um atalho para uma ação da barra de desenho (fonte única do comportamento). */
const TOOLBAR_ACTIONS = {
  'btn-undo': 'undo',
  'btn-redo': 'redo',
  'btn-fit': 'fit',
  'btn-toggle-snap': 'snap',
  'btn-toggle-autozoom': 'auto-zoom'
};

export class RibbonViewController {
  /** Estado atual dos botões de vista, lido direto do app. */
  static getState(app) {
    return computeViewState({
      history: { undo: app.historyUndo?.length || 0, redo: app.historyRedo?.length || 0 },
      snap: app.mapEngine?.snappingEnabled,
      autoZoom: app.mapEngine?.autoZoomEnabled,
      layersOpen: app.layerPanel ? !app.layerPanel.isSidebarCollapsed() : false,
      tableOpen: app.attributeTable ? !app.attributeTable.isCollapsed : false
    });
  }

  static sync(app) {
    app.headerBar?.syncItems?.(this.getState(app));
  }

  static run(app, id) {
    if (TOOLBAR_ACTIONS[id]) {
      app.drawingToolbar?.onAction?.(TOOLBAR_ACTIONS[id]);
    } else if (id === 'btn-toggle-layers') {
      const panel = app.layerPanel;
      if (panel) panel.setSidebarCollapsed(!panel.isSidebarCollapsed());
    } else if (id === 'btn-toggle-table') {
      app.attributeTable?.toggleCollapse();
    }
    // Snap e zoom automático mudam no motor sem avisar a ribbon
    app.syncRibbon?.();
  }
}
