/* ==========================================================================
   ConecteMapas - LayerTreeEvents
   Responsabilidade Única: Vinculação de eventos de botões, seleção e filtros da árvore.
   ========================================================================== */

import { LayerTreeDragDrop } from './LayerTreeDragDrop.js';
import { UIToast } from 'ui-components-kit';

export class LayerTreeEvents {
  static bind(panel) {
    const btnToggleAllVis = document.getElementById('btn-toggle-all-vis');
    if (btnToggleAllVis) {
      btnToggleAllVis.addEventListener('click', () => {
        const someVisible = panel.layers.some(l => l.visible !== false);
        const newVis = !someVisible;
        panel.layers.forEach(l => {
          l.visible = newVis;
          panel.onLayerToggle(l.id, newVis);
        });
        panel.updateContent();
      });
    }

    const btnToggleAllExpand = document.getElementById('btn-toggle-all-expand');
    if (btnToggleAllExpand) {
      btnToggleAllExpand.addEventListener('click', (e) => {
        e.stopPropagation();
        const allExpanded = panel.layers.every(l => panel.expandedLayers.has(l.id));
        if (allExpanded) {
          panel.expandedLayers.clear();
        } else {
          panel.expandedLayers = new Set(panel.layers.map(l => l.id));
        }
        btnToggleAllExpand.title = allExpanded ? 'Expandir Todos os Grupos' : 'Recolher Todos os Grupos';
        btnToggleAllExpand.textContent = allExpanded ? '📂' : '📁';

        // Atualização instantânea in-place no DOM (0ms, sem re-renderizar todo o painel)
        document.querySelectorAll('.cm-ai-layer-group').forEach(group => {
          const layerId = group.getAttribute('data-layer-id');
          const isExp = panel.expandedLayers.has(layerId);
          const chevron = group.querySelector('.cm-ai-chevron-icon');
          if (chevron) chevron.classList.toggle('open', isExp);
          const children = group.querySelector('.cm-ai-children-container');
          if (children) children.style.display = isExp ? 'block' : 'none';
        });
      });
    }

    const btnAddLayer = document.getElementById('btn-add-layer');
    if (btnAddLayer) {
      btnAddLayer.addEventListener('click', () => panel.onAddLayer());
    }

    const inputSearch = document.getElementById('input-layer-search');
    const btnClearSearch = document.getElementById('btn-clear-layer-search');

    const applySearchFilter = (query) => {
      panel.searchQuery = query;
      const q = query.trim().toLowerCase();
      const treeMount = document.getElementById('cm-ai-layer-tree-mount');
      if (!treeMount) return;

      if (btnClearSearch) {
        btnClearSearch.style.display = q ? 'block' : 'none';
      }

      const layerGroups = treeMount.querySelectorAll('.cm-ai-layer-group');
      layerGroups.forEach(group => {
        const layerId = group.getAttribute('data-layer-id');
        const layer = panel.layers.find(l => l.id === layerId);
        const layerName = (layer?.name || '').toLowerCase();
        const featRows = group.querySelectorAll('.cm-ai-feat-row');

        if (!q) {
          group.classList.remove('cm-search-hidden');
          featRows.forEach(row => row.classList.remove('cm-search-hidden'));
          return;
        }

        let hasMatchingChild = false;
        featRows.forEach(row => {
          const featId = row.getAttribute('data-feat-row');
          const feat = panel.features.find(f => f.id === featId);
          const featName = (feat?.name || '').toLowerCase();
          const featCategory = (feat?.category || '').toLowerCase();
          const featType = (feat?.type || '').toLowerCase();

          const matches = featName.includes(q) || featCategory.includes(q) || featType.includes(q);
          if (matches) {
            row.classList.remove('cm-search-hidden');
            hasMatchingChild = true;
          } else {
            row.classList.add('cm-search-hidden');
          }
        });

        const layerMatches = layerName.includes(q);
        if (layerMatches || hasMatchingChild) {
          group.classList.remove('cm-search-hidden');
          // Garante exibição dos filhos se o grupo corresponde
          if (layerMatches && !hasMatchingChild) {
            featRows.forEach(row => row.classList.remove('cm-search-hidden'));
          }
        } else {
          group.classList.add('cm-search-hidden');
        }
      });
    };

    if (inputSearch) {
      inputSearch.addEventListener('input', (e) => {
        applySearchFilter(e.target.value);
      });
    }

    if (btnClearSearch) {
      btnClearSearch.addEventListener('click', () => {
        if (inputSearch) inputSearch.value = '';
        applySearchFilter('');
        if (inputSearch) inputSearch.focus();
      });
    }

    // Rodapé de Ações em Massa
    const btnFooterVis = document.getElementById('btn-footer-vis');
    if (btnFooterVis) {
      btnFooterVis.addEventListener('click', () => {
        const selFeats = panel.features.filter(f => panel.selectedFeatureIds.has(f.id));
        if (selFeats.length === 0) return;
        const someVisible = selFeats.some(f => f.visible !== false);
        const newVis = !someVisible;
        selFeats.forEach(f => {
          f.visible = newVis;
          panel.onFeatureToggle(f.id, newVis);
        });
        panel.updateContent();
      });
    }

    const btnFooterLock = document.getElementById('btn-footer-lock');
    if (btnFooterLock) {
      btnFooterLock.addEventListener('click', () => {
        const selFeats = panel.features.filter(f => panel.selectedFeatureIds.has(f.id));
        if (selFeats.length === 0) return;
        const someLocked = selFeats.some(f => f.locked === true);
        const newLock = !someLocked;
        selFeats.forEach(f => {
          f.locked = newLock;
          panel.onFeatureLockToggle(f.id, newLock);
        });
        panel.updateContent();
      });
    }

    const inputFooterColor = document.getElementById('input-footer-color');
    if (inputFooterColor) {
      inputFooterColor.addEventListener('change', (e) => {
        const newColor = e.target.value;
        const updated = [];
        panel.features.forEach(f => {
          if (panel.selectedFeatureIds.has(f.id)) {
            f.color = newColor;
            f.style = { ...(f.style || {}), fillColor: newColor, strokeColor: newColor };
            updated.push(f);
          }
        });
        if (updated.length > 0) {
          panel.onBulkUpdate(updated);
          panel.updateContent();
        }
      });
    }

    const selectFooterMove = document.getElementById('select-footer-move-layer');
    if (selectFooterMove) {
      selectFooterMove.addEventListener('change', (e) => {
        const targetLayerId = e.target.value;
        if (!targetLayerId) return;
        const updated = [];
        panel.features.forEach(f => {
          if (panel.selectedFeatureIds.has(f.id)) {
            f.layerId = targetLayerId;
            updated.push(f);
          }
        });
        if (updated.length > 0) {
          panel.onBulkUpdate(updated);
          panel.updateContent();
        }
      });
    }

    const btnFooterNewLayer = document.getElementById('btn-footer-new-layer');
    if (btnFooterNewLayer) {
      btnFooterNewLayer.addEventListener('click', () => panel.onAddLayer());
    }

    const btnFooterDel = document.getElementById('btn-footer-del');
    if (btnFooterDel) {
      btnFooterDel.addEventListener('click', () => {
        const ids = Array.from(panel.selectedFeatureIds);
        if (ids.length === 0) return;
        panel.onBulkDelete(ids);
        panel.selectedFeatureIds.clear();
        panel.updateContent();
      });
    }

    const btnFooterClear = document.getElementById('btn-footer-clear');
    if (btnFooterClear) {
      btnFooterClear.addEventListener('click', () => {
        panel.selectedFeatureIds.clear();
        panel.updateContent();
      });
    }

    // Camadas: Expand, Eye, Lock, Target, Fit
    document.querySelectorAll('[data-layer-expand]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const layerId = btn.getAttribute('data-layer-expand');
        const group = btn.closest('.cm-ai-layer-group');
        const isExp = !panel.expandedLayers.has(layerId);

        if (isExp) {
          panel.expandedLayers.add(layerId);
        } else {
          panel.expandedLayers.delete(layerId);
        }

        // Atualização instantânea in-place (0ms)
        const chevron = btn.querySelector('.cm-ai-chevron-icon');
        if (chevron) chevron.classList.toggle('open', isExp);
        if (group) {
          const children = group.querySelector('.cm-ai-children-container');
          if (children) children.style.display = isExp ? 'block' : 'none';
        }

        const btnToggleAll = document.getElementById('btn-toggle-all-expand');
        if (btnToggleAll) {
          const allExp = panel.layers.every(l => panel.expandedLayers.has(l.id));
          btnToggleAll.title = allExp ? 'Recolher Todos os Grupos' : 'Expandir Todos os Grupos';
          btnToggleAll.textContent = allExp ? '📁' : '📂';
        }
      });
    });

    document.querySelectorAll('[data-layer-eye]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const layerId = btn.getAttribute('data-layer-eye');
        const layer = panel.layers.find(l => l.id === layerId);
        if (layer) {
          layer.visible = layer.visible === false;
          panel.onLayerToggle(layerId, layer.visible);
          panel.updateContent();
        }
      });
    });

    document.querySelectorAll('[data-layer-lock]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const layerId = btn.getAttribute('data-layer-lock');
        const layer = panel.layers.find(l => l.id === layerId);
        if (layer) {
          layer.locked = !layer.locked;
          panel.features.forEach(f => {
            if (f.layerId === layerId) f.locked = layer.locked;
          });
          panel.updateContent();
        }
      });
    });

    document.querySelectorAll('[data-layer-target]').forEach(target => {
      target.addEventListener('click', (e) => {
        e.stopPropagation();
        const layerId = target.getAttribute('data-layer-target');
        const layerFeats = panel.features.filter(f => f.layerId === layerId);
        if (layerFeats.length === 0) return;

        const isShift = e.shiftKey;
        const isCtrl = e.ctrlKey || e.metaKey;

        if (isShift && panel.lastClickedFeatureId) {
          panel.handleItemSelection(layerFeats[0].id, true, isCtrl);
        } else {
          const allSelected = layerFeats.every(f => panel.selectedFeatureIds.has(f.id));
          if (allSelected) {
            layerFeats.forEach(f => panel.selectedFeatureIds.delete(f.id));
          } else {
            if (!isCtrl) panel.selectedFeatureIds.clear();
            layerFeats.forEach(f => panel.selectedFeatureIds.add(f.id));
          }
          panel.lastClickedFeatureId = layerFeats[layerFeats.length - 1].id;
        }
        panel.updateContent();
      });
    });

    document.querySelectorAll('[data-layer-fit]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        panel.onLayerFit(btn.getAttribute('data-layer-fit'));
      });
    });

    // Configurações Drawer
    document.querySelectorAll('[data-layer-settings]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const layerId = btn.getAttribute('data-layer-settings');
        panel.activeSettingsLayerId = panel.activeSettingsLayerId === layerId ? null : layerId;
        panel.updateContent();
      });
    });

    document.querySelectorAll('[data-layer-opacity-slider]').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const layerId = slider.getAttribute('data-layer-opacity-slider');
        const val = parseFloat(e.target.value);
        const badge = document.getElementById(`badge-op-${layerId}`);
        if (badge) badge.textContent = `${Math.round(val * 100)}%`;
        const layer = panel.layers.find(l => l.id === layerId);
        if (layer) {
          layer.opacity = val;
          panel.onLayerOpacityChange(layerId, val);
        }
      });
    });

    document.querySelectorAll('[data-layer-color-picker]').forEach(picker => {
      picker.addEventListener('change', (e) => {
        const layerId = picker.getAttribute('data-layer-color-picker');
        const color = e.target.value;
        const layer = panel.layers.find(l => l.id === layerId);
        if (layer) {
          layer.color = color;
          panel.onLayerColorChange(layerId, color);
          panel.updateContent();
        }
      });
    });

    document.querySelectorAll('[data-delete-layer]').forEach(btn => {
      btn.addEventListener('click', () => {
        const layerId = btn.getAttribute('data-delete-layer');
        if (panel.layers.length <= 1) {
          UIToast.notificar({ tipo: 'alerta', titulo: 'Aviso', mensagem: 'O mapa deve ter ao menos 1 camada ativa.' });
          return;
        }
        panel.onLayerDelete(layerId);
        panel.layers = panel.layers.filter(l => l.id !== layerId);
        panel.activeSettingsLayerId = null;
        panel.updateContent();
      });
    });

    // Feições: Select, Target, Eye, Lock, Fit
    document.querySelectorAll('[data-feat-select]').forEach(node => {
      node.addEventListener('click', (e) => {
        if (panel.editingFeatureId) return;
        const featId = node.getAttribute('data-feat-select');
        const isShift = e.shiftKey;
        const isCtrl = e.ctrlKey || e.metaKey;

        if (isShift || isCtrl) {
          panel.handleItemSelection(featId, isShift, isCtrl);
          panel.updateContent();
        } else {
          const feat = panel.features.find(f => f.id === featId);
          if (feat) {
            panel.setSelectedFeature(feat);
            panel.onFeatureSelect(feat);
            panel.onFitFeature(feat.id);
          }
        }
      });
    });

    document.querySelectorAll('[data-feat-target]').forEach(target => {
      target.addEventListener('click', (e) => {
        e.stopPropagation();
        const featId = target.getAttribute('data-feat-target');
        panel.handleItemSelection(featId, e.shiftKey, e.ctrlKey || e.metaKey);
        panel.updateContent();
      });
    });

    document.querySelectorAll('[data-feat-eye]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const featId = btn.getAttribute('data-feat-eye');
        const feat = panel.features.find(f => f.id === featId);
        if (feat) {
          feat.visible = feat.visible === false;
          panel.onFeatureToggle(featId, feat.visible);
          panel.updateContent();
        }
      });
    });

    document.querySelectorAll('[data-feat-lock]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const featId = btn.getAttribute('data-feat-lock');
        const feat = panel.features.find(f => f.id === featId);
        if (feat) {
          feat.locked = !feat.locked;
          panel.onFeatureLockToggle(featId, feat.locked);
          panel.updateContent();
        }
      });
    });

    document.querySelectorAll('[data-feat-fit]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        panel.onFitFeature(btn.getAttribute('data-feat-fit'));
      });
    });

    // Basemaps (com suporte a desativar / Sem Mapa Base e alternância instantânea)
    document.querySelectorAll('[data-basemap]').forEach(card => {
      card.addEventListener('click', () => {
        const base = card.getAttribute('data-basemap');
        const newBase = (panel.currentBasemap === base && base !== 'none') ? 'none' : base;
        panel.currentBasemap = newBase;
        panel.onBasemapChange(newBase);

        // Atualização visual instantânea in-place sem re-renderizar o painel
        document.querySelectorAll('[data-basemap]').forEach(c => {
          c.classList.toggle('active', c.getAttribute('data-basemap') === newBase);
        });
      });
    });

    // Vincula Drag & Drop e Rename Inline
    LayerTreeDragDrop.bind(panel);
  }
}
