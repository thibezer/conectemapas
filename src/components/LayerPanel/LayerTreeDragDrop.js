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

    document.querySelectorAll('.cm-ai-layer-group[draggable="true"]').forEach(layerGroup => {
      const layerId = layerGroup.getAttribute('data-layer-id');

      layerGroup.addEventListener('dragstart', (e) => {
        if (e.target.closest('input, button, select') || panel.editingLayerId || panel.editingFeatureId) {
          e.preventDefault();
          return;
        }
        draggedType = 'layer';
        draggedLayerId = layerId;
        e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'layer', id: layerId }));
        e.dataTransfer.effectAllowed = 'move';
        layerGroup.classList.add('dragging');
      });

      layerGroup.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (draggedType === 'layer') {
          if (draggedLayerId === layerId) return;
          const rect = layerGroup.getBoundingClientRect();
          const isTop = (e.clientY - rect.top) < (rect.height / 2);
          layerGroup.classList.toggle('cm-drop-above', isTop);
          layerGroup.classList.toggle('cm-drop-below', !isTop);
        } else if (draggedType === 'feature') {
          layerGroup.classList.add('cm-drop-into');
        }
      });

      layerGroup.addEventListener('dragleave', () => {
        layerGroup.classList.remove('cm-drop-above', 'cm-drop-below', 'cm-drop-into');
      });

      layerGroup.addEventListener('drop', (e) => {
        e.preventDefault();
        const dropAbove = layerGroup.classList.contains('cm-drop-above');
        layerGroup.classList.remove('cm-drop-above', 'cm-drop-below', 'cm-drop-into');

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

      layerGroup.addEventListener('dragend', () => {
        draggedType = null;
        draggedLayerId = null;
        draggedFeatId = null;
        document.querySelectorAll('.cm-ai-layer-group').forEach(el => {
          el.classList.remove('dragging', 'cm-drop-above', 'cm-drop-below', 'cm-drop-into');
        });
        document.querySelectorAll('.cm-ai-feat-row').forEach(el => el.classList.remove('dragging'));
      });
    });

    document.querySelectorAll('.cm-ai-feat-row[draggable="true"]').forEach(featRow => {
      const featId = featRow.getAttribute('data-feat-row');
      featRow.addEventListener('dragstart', (e) => {
        e.stopPropagation();
        if (e.target.closest('input, button, select') || panel.editingLayerId || panel.editingFeatureId) {
          e.preventDefault();
          return;
        }
        draggedType = 'feature';
        draggedFeatId = featId;
        e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'feature', id: featId }));
        e.dataTransfer.effectAllowed = 'move';
        featRow.classList.add('dragging');
      });

      featRow.addEventListener('dragend', (e) => {
        e.stopPropagation();
        draggedType = null;
        draggedFeatId = null;
        featRow.classList.remove('dragging');
        document.querySelectorAll('.cm-ai-layer-group').forEach(el => el.classList.remove('cm-drop-into'));
      });
    });
  }
}
