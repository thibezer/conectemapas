/* ==========================================================================
   ConecteMapas - ShortcutsController
   Responsabilidade Única: Gerenciamento de atalhos globais de teclado (CAD,
   Undo/Redo, Salvar, Navegação Master-Detail Workbench).
   ========================================================================== */

import { UIToast } from '@thibezer/ui-components-kit';
import { StorageService } from '../services/StorageService.js';

export class ShortcutsController {
  static pushHistory(app, description = '') {
    if (!app.historyUndo) app.historyUndo = [];
    const count = app.features ? app.features.length : 0;
    const maxSteps = count > 2000 ? 15 : (count > 500 ? 25 : 50);

    try {
      app.historyUndo.push(JSON.stringify(app.features));
      if (app.historyUndo.length > maxSteps) {
        app.historyUndo.splice(0, app.historyUndo.length - maxSteps);
      }
      app.historyRedo = [];
    } catch (e) {
      console.warn('[ShortcutsController] Falha ao capturar snapshot de histórico:', e);
    }
  }

  static undo(app) {
    if (app.historyUndo.length === 0) {
      UIToast.notificar({
        tipo: 'informativo',
        titulo: 'Nada para desfazer',
        mensagem: 'O histórico está vazio.',
        duracao: 1500
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

  }

  static redo(app) {
    if (app.historyRedo.length === 0) {
      UIToast.notificar({
        tipo: 'informativo',
        titulo: 'Nada para refazer',
        mensagem: 'O histórico está vazio.',
        duracao: 1500
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
          titulo: 'Projeto salvo',
          mensagem: `${app.features.length} feições gravadas localmente.`,
          duracao: 1800
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
      }
      // Busca Avançada: Ctrl+Shift+F / Cmd+Shift+F
      else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        app.advancedSearch?.toggle();
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
          m: 'measure',
          t: 'text',
          i: 'eyedropper',
          k: 'split',
          n: 'pen'
        };

        if (key === 'x') {
          e.preventDefault();
          if (app.drawingToolbar && typeof app.drawingToolbar.swapColors === 'function') {
            app.drawingToolbar.swapColors();
          }
          return;
        }

        if (key === 'd') {
          e.preventDefault();
          if (app.drawingToolbar && typeof app.drawingToolbar.resetDefaultColors === 'function') {
            app.drawingToolbar.resetDefaultColors();
          }
          return;
        }

        if (key === 's') {
          e.preventDefault();
          if (app.mapEngine) {
            const isEnabled = app.mapEngine.toggleSnapping();
            if (app.drawingToolbar) {
              app.drawingToolbar.setSnappingEnabled(isEnabled);
            }
            UIToast.notificar({
              tipo: 'info',
              titulo: isEnabled ? 'Ímã / Snap Ativado' : 'Ímã / Snap Desativado',
              mensagem: isEnabled ? 'Atração magnética a vértices ligada [S].' : 'Cursor livre de atração magnética [S].',
              duracao: 1500
            });
          }
          return;
        }

        if (key === 'j') {
          e.preventDefault();
          if (app.drawingToolbar && typeof app.drawingToolbar.onAction === 'function') {
            app.drawingToolbar.onAction(e.shiftKey ? 'join-bridge' : 'join');
          }
          return;
        }

        if (toolMap[key]) {
          e.preventDefault();
          if (typeof app.setDrawingTool === 'function') {
            app.setDrawingTool(toolMap[key]);
          }
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.navigateFeature(app, 1);
        } else if (e.key === 'ArrowUp') {
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
