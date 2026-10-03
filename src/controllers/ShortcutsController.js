/* ==========================================================================
   ConecteMapas - ShortcutsController
   Responsabilidade Única: Gerenciamento de atalhos globais de teclado (CAD,
   Undo/Redo, Salvar, Navegação Master-Detail Workbench).
   ========================================================================== */

import { UIToast } from 'ui-components-kit';
import { StorageService } from '../services/StorageService.js';

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
    const oldFeatures = app.features;
    app.features = JSON.parse(previousSnapshot);
    StorageService.applyDiff(oldFeatures, app.features);
    app.refreshMapAndTable();
    app.saveMetadata(false);

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
    const oldFeatures = app.features;
    app.features = JSON.parse(nextSnapshot);
    StorageService.applyDiff(oldFeatures, app.features);
    app.refreshMapAndTable();
    app.saveMetadata(false);

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
        if (app.mapEngine && (app.mapEngine.isDrawing || (app.mapEngine.drawingPoints && app.mapEngine.drawingPoints.length > 0) || (app.mapEngine.drawingEngine && app.mapEngine.drawingEngine.drawingPoints.length > 0))) {
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
        app.saveState(true, { featuresChanged: true });
        UIToast.notificar({
          tipo: 'sucesso',
          titulo: 'Projeto Salvo (Ctrl+S)',
          mensagem: `${app.features.length} feições gravadas no banco de dados local.`,
          duracao: 2500
        });
      }
      // Selecionar Tudo: Ctrl+A / Cmd+A
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        const visibleFeats = app.features.filter(f => {
          if (f.visible === false) return false;
          const layer = app.layers.find(l => l.id === f.layerId);
          return !layer || layer.visible !== false;
        });
        const ids = visibleFeats.map(f => f.id);
        if (app.mapEngine) {
          app.mapEngine.selectFeatures(ids);
        }
        if (app.layerPanel) {
          app.layerPanel.setSelectedFeatures(visibleFeats, false);
        }
        UIToast.notificar({
          tipo: 'informativo',
          titulo: 'Seleção Total (Ctrl+A)',
          mensagem: `${visibleFeats.length} feições selecionadas.`,
          duracao: 1800
        });
      }
      // Busca na Tabela de Atributos: Ctrl+K / Cmd+K
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (app.attributeTable) {
          if (app.attributeTable.isCollapsed) {
            app.attributeTable.toggleCollapse();
          }
          const searchInput = document.getElementById('cm-table-search-input');
          if (searchInput) {
            setTimeout(() => {
              if (searchInput.shadowRoot) {
                const inner = searchInput.shadowRoot.querySelector('input');
                if (inner) inner.focus();
              } else {
                searchInput.focus();
              }
            }, 60);
          }
        }
      }
      // Atalhos Simples de Ferramentas CAD e Navegação (Sem modificadores)
      else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const key = e.key.toLowerCase();
        const toolMap = {
          v: 'select',
          q: 'pen-select',
          p: 'point',
          l: 'line',
          a: 'polygon',
          c: 'circle',
          r: 'rectangle',
          m: 'measure-line',
          t: 'text'
        };

        if (toolMap[key]) {
          e.preventDefault();
          if (typeof app.setDrawingTool === 'function') {
            app.setDrawingTool(toolMap[key]);
          }
        } else if (e.key === 'j' || e.key === 'ArrowDown') {
          e.preventDefault();
          this.navigateFeature(app, 1);
        } else if (e.key === 'k' || e.key === 'ArrowUp') {
          e.preventDefault();
          this.navigateFeature(app, -1);
        } else if (e.key === 'Escape') {
          if (app.contextMenu) {
            app.contextMenu.close();
          }
          if (app.mapEngine) {
            app.mapEngine.clearSelection();
          }
          if (app.layerPanel) {
            app.layerPanel.selectedFeatureIds.clear();
            app.layerPanel.selectedFeature = null;
            app.layerPanel.updateContent();
          }
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          // Exclusão rápida pelo teclado
          const hudFeats = app.selectionHUD?.selectedFeatures || [];
          const panelSelectedIds = app.layerPanel?.selectedFeatureIds ? Array.from(app.layerPanel.selectedFeatureIds) : [];
          
          if (hudFeats.length > 1) {
            e.preventDefault();
            const ids = hudFeats.map(f => f.id);
            if (app.layerPanel && typeof app.layerPanel.onBulkDelete === 'function') {
              app.layerPanel.onBulkDelete(ids);
            }
          } else if (panelSelectedIds.length > 1) {
            e.preventDefault();
            if (app.layerPanel && typeof app.layerPanel.onBulkDelete === 'function') {
              app.layerPanel.onBulkDelete(panelSelectedIds);
            }
          } else {
            const singleFeat = hudFeats[0] || app.layerPanel?.selectedFeature || (panelSelectedIds.length === 1 ? app.features.find(f => f.id === panelSelectedIds[0]) : null);
            if (singleFeat && typeof app.deleteFeature === 'function') {
              e.preventDefault();
              app.deleteFeature(singleFeat.id);
            }
          }
        }
      }
    });
  }
}
