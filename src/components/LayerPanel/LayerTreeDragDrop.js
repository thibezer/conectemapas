/* ==========================================================================
   ConecteMapas - LayerTreeDragDrop
   Responsabilidade Única: Gerenciamento do Drag and Drop nativo HTML5 e
   edição inline (duplo clique) para camadas e feições na árvore.
   ========================================================================== */

import { UIToast } from 'ui-components-kit';

export class LayerTreeDragDrop {
  static bind(panel) {
    this.bindInlineRename(panel);
    this.bindDragAndDrop(panel);
  }

  static bindInlineRename(panel) {
    // Inline Rename Camada
    document.querySelectorAll('[data-layer-name-trigger]').forEach(nameElem => {
      nameElem.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const layerId = nameElem.getAttribute('data-layer-name-trigger');
        panel.editingLayerId = layerId;
        panel.updateContent();

        const input = document.querySelector(`[data-inline-layer-input="${layerId}"]`);
        if (input) {
          input.focus();
          input.select();
          let committed = false;
          const finishEdit = (save) => {
            if (committed) return;
            committed = true;
            panel.editingLayerId = null;
            if (save) {
              const newName = input.value.trim();
              const layer = panel.layers.find(l => l.id === layerId);
              if (newName && layer && layer.name !== newName) {
                layer.name = newName;
                panel.onLayerRename(layerId, newName);
              }
            }
            panel.updateContent();
          };

          input.addEventListener('keydown', (ke) => {
            if (ke.key === 'Enter') { ke.preventDefault(); finishEdit(true); }
            else if (ke.key === 'Escape') { ke.preventDefault(); finishEdit(false); }
          });
          input.addEventListener('blur', () => finishEdit(true));
        }
      });
    });

    // Inline Rename Feição
    document.querySelectorAll('[data-feat-name-trigger]').forEach(nameElem => {
      nameElem.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const featId = nameElem.getAttribute('data-feat-name-trigger');
        panel.editingFeatureId = featId;
        panel.updateContent();

        const input = document.querySelector(`[data-inline-feat-input="${featId}"]`);
        if (input) {
          input.focus();
          input.select();
          let committed = false;
          const finishEdit = (save) => {
            if (committed) return;
            committed = true;
            panel.editingFeatureId = null;
            if (save) {
              const newName = input.value.trim();
              const feat = panel.features.find(f => f.id === featId);
              if (newName && feat && feat.name !== newName) {
                feat.name = newName;
                panel.onFeatureUpdate(feat);
                UIToast.notificar({
                  tipo: 'sucesso',
                  titulo: 'Feição Renomeada',
                  mensagem: `Nome alterado para "${newName}".`,
                  duracao: 1800
                });
              }
            }
            panel.updateContent();
          };

          input.addEventListener('keydown', (ke) => {
            if (ke.key === 'Enter') { ke.preventDefault(); finishEdit(true); }
            else if (ke.key === 'Escape') { ke.preventDefault(); finishEdit(false); }
          });
          input.addEventListener('blur', () => finishEdit(true));
        }
      });
    });
  }

  static bindDragAndDrop(panel) {
    let draggedType = null;
    let draggedLayerId = null;
    let draggedFeatId = null;

    const clearAllDragClasses = () => {
      document.querySelectorAll('.cm-ai-layer-row, .cm-ai-feat-row, .cm-ai-layer-group').forEach(el => {
        el.classList.remove('dragging', 'cm-drop-above', 'cm-drop-below', 'cm-drop-into');
      });
    };

    // -------------------------------------------------------------------------
    // 1. DRAG AND DROP DE CAMADAS (Reordenação de Camadas / Z-Index)
    // -------------------------------------------------------------------------
    document.querySelectorAll('.cm-ai-layer-row[draggable="true"]').forEach(layerRow => {
      const layerId = layerRow.getAttribute('data-layer-id');

      layerRow.addEventListener('dragstart', (e) => {
        if (e.target.closest('input, button, select') || panel.editingLayerId || panel.editingFeatureId) {
          e.preventDefault();
          return;
        }
        draggedType = 'layer';
        draggedLayerId = layerId;
        e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'layer', id: layerId }));
        e.dataTransfer.effectAllowed = 'move';
        layerRow.classList.add('dragging');
      });

      layerRow.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';

        if (draggedType === 'layer') {
          if (draggedLayerId === layerId) return;
          const rect = layerRow.getBoundingClientRect();
          const isTop = (e.clientY - rect.top) < (rect.height / 2);
          layerRow.classList.toggle('cm-drop-above', isTop);
          layerRow.classList.toggle('cm-drop-below', !isTop);
        } else if (draggedType === 'feature') {
          layerRow.classList.add('cm-drop-into');
        }
      });

      layerRow.addEventListener('dragleave', () => {
        layerRow.classList.remove('cm-drop-above', 'cm-drop-below', 'cm-drop-into');
      });

      layerRow.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const dropAbove = layerRow.classList.contains('cm-drop-above');
        clearAllDragClasses();

        if (draggedType === 'layer') {
          if (!draggedLayerId || draggedLayerId === layerId) return;
          const srcIdx = panel.layers.findIndex(l => l.id === draggedLayerId);
          if (srcIdx === -1) return;
          const [movedLayer] = panel.layers.splice(srcIdx, 1);
          let tgtIdx = panel.layers.findIndex(l => l.id === layerId);
          if (tgtIdx === -1) {
            panel.layers.push(movedLayer);
          } else {
            panel.layers.splice(dropAbove ? tgtIdx : tgtIdx + 1, 0, movedLayer);
          }
          panel.onLayerReorder(panel.layers);
          panel.updateContent();
        } else if (draggedType === 'feature') {
          if (!draggedFeatId) return;
          const feat = panel.features.find(f => f.id === draggedFeatId);
          const targetLayer = panel.layers.find(l => l.id === layerId);
          if (feat && targetLayer && feat.layerId !== layerId) {
            feat.layerId = layerId;
            panel.onFeatureUpdate(feat);
            if (typeof panel.onFeaturesReorder === 'function') {
              panel.onFeaturesReorder(panel.features);
            }
            UIToast.notificar({
              tipo: 'sucesso',
              titulo: 'Feição Movida',
              mensagem: `"${feat.name}" transferida para a camada "${targetLayer.name}".`,
              duracao: 2000
            });
            panel.updateContent();
          }
        }
      });

      layerRow.addEventListener('dragend', () => {
        draggedType = null;
        draggedLayerId = null;
        draggedFeatId = null;
        clearAllDragClasses();
      });
    });

    // -------------------------------------------------------------------------
    // 2. DRAG AND DROP DE FEIÇÕES (Reordenação interna e entre camadas)
    // -------------------------------------------------------------------------
    document.querySelectorAll('.cm-ai-feat-row[draggable="true"]').forEach(featRow => {
      const featId = featRow.getAttribute('data-feat-row');
      const featLayerId = featRow.getAttribute('data-feat-layer');

      featRow.addEventListener('dragstart', (e) => {
        if (e.target.closest('input, button, select') || panel.editingLayerId || panel.editingFeatureId) {
          e.preventDefault();
          return;
        }
        e.stopPropagation();
        draggedType = 'feature';
        draggedFeatId = featId;
        draggedLayerId = featLayerId;
        e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'feature', id: featId, layerId: featLayerId }));
        e.dataTransfer.effectAllowed = 'move';
        featRow.classList.add('dragging');
      });

      featRow.addEventListener('dragover', (e) => {
        if (draggedType !== 'feature' || draggedFeatId === featId) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';

        const rect = featRow.getBoundingClientRect();
        const isTop = (e.clientY - rect.top) < (rect.height / 2);
        featRow.classList.toggle('cm-drop-above', isTop);
        featRow.classList.toggle('cm-drop-below', !isTop);
      });

      featRow.addEventListener('dragleave', () => {
        featRow.classList.remove('cm-drop-above', 'cm-drop-below');
      });

      featRow.addEventListener('drop', (e) => {
        if (draggedType !== 'feature' || !draggedFeatId || draggedFeatId === featId) return;
        e.preventDefault();
        e.stopPropagation();

        const dropAbove = featRow.classList.contains('cm-drop-above');
        clearAllDragClasses();

        const srcIdx = panel.features.findIndex(f => f.id === draggedFeatId);
        if (srcIdx === -1) return;

        const targetFeat = panel.features.find(f => f.id === featId);
        if (!targetFeat) return;

        const [movedFeat] = panel.features.splice(srcIdx, 1);
        const originalLayerId = movedFeat.layerId;
        const targetLayerId = targetFeat.layerId;

        // Se moveu para camada diferente, atualiza o layerId
        const layerChanged = originalLayerId !== targetLayerId;
        if (layerChanged) {
          movedFeat.layerId = targetLayerId;
        }

        let targetIdx = panel.features.findIndex(f => f.id === featId);
        if (targetIdx === -1) {
          panel.features.push(movedFeat);
        } else {
          panel.features.splice(dropAbove ? targetIdx : targetIdx + 1, 0, movedFeat);
        }

        if (layerChanged) {
          panel.onFeatureUpdate(movedFeat);
          const targetLayerObj = panel.layers.find(l => l.id === targetLayerId);
          UIToast.notificar({
            tipo: 'sucesso',
            titulo: 'Feição Movida',
            mensagem: `"${movedFeat.name}" transferida para a camada "${targetLayerObj?.name || 'Alvo'}".`,
            duracao: 2000
          });
        } else {
          UIToast.notificar({
            tipo: 'informativo',
            titulo: 'Ordem Alterada',
            mensagem: `"${movedFeat.name}" reposicionada na lista.`,
            duracao: 1500
          });
        }

        if (typeof panel.onFeaturesReorder === 'function') {
          panel.onFeaturesReorder(panel.features);
        }

        panel.updateContent();
      });

      featRow.addEventListener('dragend', (e) => {
        e.stopPropagation();
        draggedType = null;
        draggedFeatId = null;
        draggedLayerId = null;
        clearAllDragClasses();
      });
    });
  }
}
