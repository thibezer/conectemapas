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
    app.syncModifyRibbon?.();
  }

  /**
   * Converte um snapshot em feições reaproveitando a MESMA referência das feições que não mudaram.
   * Sem isso, o JSON.parse cria objetos novos para todas e o applyDiff (por referência)
   * regravaria e reenviaria o projeto inteiro a cada Desfazer/Refazer.
   */
  static restoreSnapshot(snapshot, current) {
    const restored = JSON.parse(snapshot);
    const byId = new Map();
    for (let i = 0; i < current.length; i++) byId.set(current[i].id, current[i]);
    for (let i = 0; i < restored.length; i++) {
      const old = byId.get(restored[i].id);
      if (old && JSON.stringify(old) === JSON.stringify(restored[i])) restored[i] = old;
    }
    return restored;
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
    app.features = ShortcutsController.restoreSnapshot(previousSnapshot, oldFeatures);
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
    app.features = ShortcutsController.restoreSnapshot(nextSnapshot, oldFeatures);
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
      app.mapEngine.revealFeature(nextFeature.id);
    }
  }

  /** Tecla vinda de um campo de digitação: os atalhos globais não devem interceptá-la. */
  static isTypingTarget(e) {
    const path = e.composedPath ? e.composedPath() : [e.target];
    return path.some(el =>
      el && el.tagName && (
        el.tagName === 'INPUT' ||
        el.tagName === 'TEXTAREA' ||
        el.tagName === 'SELECT' ||
        el.tagName.toLowerCase().includes('campo-texto') ||
        el.tagName.toLowerCase().includes('lista-flutuante') ||
        el.isContentEditable
      )
    );
  }

  /** Esc: fecha o menu de contexto e desfaz a seleção (mapa, painel e HUD). */
  static clearSelectionOnEscape(app) {
    if (app.contextMenu) {
      app.contextMenu.close();
    }
    if (app.mapEngine) {
      app.mapEngine.clearSelection();
    }
    if (app.layerPanel) {
      // Passa pelo painel para a árvore de camadas também desmarcar as linhas
      app.layerPanel.setSelectedFeatures([]);
      app.layerPanel.updateContent();
    }
    app.selectionHUD?.hide();
  }

  /** Seleciona todas as feições visíveis (feição e camada não ocultas). Ctrl+A e botão da ribbon. */
  static selectAll(app) {
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

  static bindGlobalShortcuts(app) {
    // O Leaflet escuta o teclado no document e engole o Esc (stopPropagation) quando o mapa tem
    // um popup registrado, o que acontece ao selecionar uma única feição. Por isso o Esc é
    // tratado na fase de captura, antes de chegar ao Leaflet.
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (this.isTypingTarget(e)) return;
      this.clearSelectionOnEscape(app);
    }, true);

    window.addEventListener('keydown', (e) => {
      if (this.isTypingTarget(e)) return;

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
        this.selectAll(app);
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
        if (e.key === '?' || e.key === 'F1') {
          e.preventDefault();
          const modal = document.getElementById('modal-shortcuts');
          if (modal) {
            if (typeof modal.abrir === 'function') modal.abrir();
            else modal.setAttribute('aberto', '');
          }
          return;
        }

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
          if (app.drawingToolbar) {
            if (e.shiftKey) {
              app.drawingToolbar.swapColors?.();
            } else {
              app.drawingToolbar.toggleActiveColorTarget?.();
            }
          }
          return;
        }

        if (e.key === '/' || e.code === 'Slash') {
          e.preventDefault();
          if (app.drawingToolbar && typeof app.drawingToolbar.setNoneColor === 'function') {
            app.drawingToolbar.setNoneColor();
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
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          // Com uma figura em andamento, Backspace desfaz o último vértice (tratado pelo mapa)
          if (app.mapEngine?.isDrawing) return;
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
