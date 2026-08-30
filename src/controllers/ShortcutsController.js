/* ==========================================================================
   ConecteMapas - ShortcutsController
   Responsabilidade Única: Gerenciamento de atalhos globais de teclado (CAD,
   Undo/Redo, Salvar, Navegação Master-Detail Workbench).
   ========================================================================== */

import { UIToast } from 'ui-components-kit';

export class ShortcutsController {
  static pushHistory(app, description = '') {
    app.historyUndo.push(JSON.stringify(app.features));
    if (app.historyUndo.length > 50) app.historyUndo.shift();
    app.historyRedo = [];
  }

  static undo(app) {
    if (app.historyUndo.length === 0) {
      UIToast.notificar({
        tipo: 'informativo',
        titulo: 'Histórico Vazio',
        mensagem: 'Nenhuma ação recente para desfazer.',
        duracao: 2000
      });
      return;
    }

    app.historyRedo.push(JSON.stringify(app.features));
    const previousSnapshot = app.historyUndo.pop();
    app.features = JSON.parse(previousSnapshot);
    app.refreshMapAndTable();
    app.saveState();

    UIToast.notificar({
      tipo: 'sucesso',
      titulo: 'Desfeito (Ctrl+Z)',
      mensagem: 'Estado anterior recuperado.',
      duracao: 2000
    });
  }

  static redo(app) {
    if (app.historyRedo.length === 0) {
      UIToast.notificar({
        tipo: 'informativo',
        titulo: 'Histórico Vazio',
        mensagem: 'Nenhuma ação para refazer.',
        duracao: 2000
      });
      return;
    }

    app.historyUndo.push(JSON.stringify(app.features));
    const nextSnapshot = app.historyRedo.pop();
    app.features = JSON.parse(nextSnapshot);
    app.refreshMapAndTable();
    app.saveState();

    UIToast.notificar({
      tipo: 'sucesso',
      titulo: 'Refeito (Ctrl+Y)',
      mensagem: 'Alteração reaplicada.',
      duracao: 2000
    });
  }

  static navigateFeature(app, direction = 1) {
    if (!app.features || app.features.length === 0) return;
    const currentId = app.layerPanel?.selectedFeature?.id;
    let currentIdx = app.features.findIndex(f => f.id === currentId);
    if (currentIdx === -1) {
      currentIdx = direction > 0 ? -1 : app.features.length;
    }
    let nextIdx = currentIdx + direction;
    if (nextIdx < 0) nextIdx = app.features.length - 1;
    if (nextIdx >= app.features.length) nextIdx = 0;

    const nextFeature = app.features[nextIdx];
    if (nextFeature) {
      app.layerPanel.setSelectedFeature(nextFeature);
      app.mapEngine.zoomToFeature(nextFeature.id);
    }
  }

  static bindGlobalShortcuts(app) {
    window.addEventListener('keydown', (e) => {
      const path = e.composedPath ? e.composedPath() : [e.target];
      const isInput = path.some(el => 
        el && el.tagName && (
          el.tagName === 'INPUT' || 
          el.tagName === 'TEXTAREA' || 
          el.tagName === 'SELECT' || 
          el.tagName.toLowerCase().includes('campo-texto') || 
          el.tagName.toLowerCase().includes('lista-flutuante') || 
          el.isContentEditable
        )
      );
      if (isInput) return;

      // Undo: Ctrl+Z / Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (app.mapEngine && app.mapEngine.drawingPoints && app.mapEngine.drawingPoints.length > 0) {
          return;
        }
        e.preventDefault();
        this.undo(app);
      }
      // Redo: Ctrl+Y / Ctrl+Shift+Z / Cmd+Shift+Z
      else if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') || 
               ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && e.shiftKey)) {
        e.preventDefault();
        this.redo(app);
      }
      // Save: Ctrl+S / Cmd+S
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        const btnSave = document.getElementById('btn-save-inspector');
        if (btnSave) {
          btnSave.click();
        } else {
          app.saveState();
          UIToast.notificar({
            tipo: 'sucesso',
            titulo: 'Projeto Salvo (Ctrl+S)',
            mensagem: `${app.features.length} feições gravadas no banco de dados local.`,
            duracao: 2500
          });
        }
      }
      // Navegação Master-Detail Workbench (J / K / Setas)
      else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === 'j' || e.key === 'ArrowDown') {
          e.preventDefault();
          this.navigateFeature(app, 1);
        } else if (e.key === 'k' || e.key === 'ArrowUp') {
          e.preventDefault();
          this.navigateFeature(app, -1);
        } else if (e.key === 'Delete') {
          if (app.layerPanel && app.layerPanel.selectedFeature) {
            e.preventDefault();
            app.deleteFeature(app.layerPanel.selectedFeature.id);
          }
        }
      }
    });
  }
}
